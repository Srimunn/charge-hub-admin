import { and, desc, eq, inArray, or } from "drizzle-orm";
import { db, schema, isId, sessionToApi } from "../db/index.js";
import { findManagedStation, operatorStationIds, stationScope } from "../services/access.js";
import { findStationById, findPaidPayment } from "../services/chargingService.js";
import { logEvent } from "./auditLogController.js";

const isOperator = (req) => ["admin", "owner"].includes(req.user?.role);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Make sure a demo (simulated) station's simulator is connected. Never used for real chargers. */
const ensureSimulatorConnected = async (ocpp, station) => {
  if (!station.simulated || ocpp.isConnected(station.stationNumber)) return;
  const sim = await import("../services/ocppSimulator.js");
  sim.simulateStation(station.stationNumber);
  for (let i = 0; i < 10 && !ocpp.isConnected(station.stationNumber); i++) await sleep(200);
};

const waitForSession = async (stationId, idTag, sinceMs, attempts = 20) => {
  for (let i = 0; i < attempts; i++) {
    const [row] = await db
      .select()
      .from(schema.chargingSessions)
      .where(and(eq(schema.chargingSessions.stationId, stationId), eq(schema.chargingSessions.idTag, idTag), eq(schema.chargingSessions.status, "active")))
      .orderBy(desc(schema.chargingSessions.startTime))
      .limit(1);
    if (row && row.createdAt.getTime() >= sinceMs - 1000) return row;
    await sleep(300);
  }
  return null;
};

/**
 * POST /api/sessions/start { stationId }
 *  - customer: starts charging only if they hold a paid, unused order for this station
 *    (returns their existing active session if charging already started)
 *  - owner/admin: remote test start on a station they manage
 */
export const startSession = async (req, res) => {
  try {
    const { stationId } = req.body;
    if (!stationId) return res.status(400).json({ error: "stationId is required" });
    const ocpp = req.ocppCentralSystem;

    let station;
    let idTag;
    if (isOperator(req)) {
      station = await findManagedStation(req, stationId);
      if (!station) return res.status(404).json({ error: "Station not found" });
      idTag = `operator:${req.user.id}`;
    } else {
      station = await findStationById(stationId);
      if (!station) return res.status(404).json({ error: "Station not found" });
      idTag = `user:${req.user.id}`;
      const [existing] = await db
        .select()
        .from(schema.chargingSessions)
        .where(and(eq(schema.chargingSessions.stationId, station.id), eq(schema.chargingSessions.idTag, idTag), inArray(schema.chargingSessions.status, ["active", "FAULT_PAUSED"])))
        .limit(1);
      if (existing) return res.status(201).json(sessionToApi(existing, station));
      if (!(await findPaidPayment(req.user.id, station.id))) {
        return res.status(402).json({ error: "Payment required. Please pay for the session before starting." });
      }
    }

    await ensureSimulatorConnected(ocpp, station);
    if (!ocpp.isConnected(station.stationNumber)) return res.status(409).json({ error: "Station is offline (not connected via OCPP)" });

    const started = Date.now();
    if (idTag.startsWith("operator:")) ocpp.allowOperatorStart(station.stationNumber, idTag);
    const result = await ocpp.sendCall(station.stationNumber, "RemoteStartTransaction", { connectorId: 1, idTag });
    if (String(result?.status).toLowerCase() !== "accepted") {
      return res.status(409).json({ error: "Charger rejected the start request", result });
    }

    const session = await waitForSession(station.id, idTag, started);
    if (isOperator(req)) await logEvent(req.user.id, `Remote start requested at ${station.stationNumber}`, req);
    if (!session) {
      return res.status(202).json({ status: "accepted", message: "Start accepted by charger; waiting for it to begin.", stationId: station.id, stationNumber: station.stationNumber, result });
    }
    res.status(201).json(sessionToApi(session, station));
  } catch (err) {
    console.error("startSession error:", err.message);
    res.status(500).json({ error: "Could not start charging" });
  }
};

/** Load a session the current user may act on (customer: own; operator: managed stations). */
const findAccessibleSession = async (req, idParam) => {
  const id = String(idParam || "");
  const where = isId(id)
    ? eq(schema.chargingSessions.id, id)
    : Number.isInteger(Number(id))
      ? eq(schema.chargingSessions.ocppTransactionId, Number(id))
      : null;
  if (!where) return null;

  let scope;
  if (isOperator(req)) scope = stationScope(schema.chargingSessions.stationId, await operatorStationIds(req));
  else scope = eq(schema.chargingSessions.userId, req.user.id);

  const [row] = await db
    .select()
    .from(schema.chargingSessions)
    .where(scope ? and(where, scope) : where)
    .orderBy(desc(schema.chargingSessions.startTime))
    .limit(1);
  return row || null;
};

// POST /api/sessions/stop/:id
export const stopSession = async (req, res) => {
  try {
    const session = await findAccessibleSession(req, req.params.id);
    if (!session) return res.status(404).json({ error: "Session not found" });
    if (session.status === "completed") return res.status(400).json({ error: "Session already completed" });

    const ocpp = req.ocppCentralSystem;
    if (!ocpp.isConnected(session.stationNumber)) return res.status(409).json({ error: "Station is offline (not connected via OCPP)" });

    const result = await ocpp.sendCall(session.stationNumber, "RemoteStopTransaction", { transactionId: session.ocppTransactionId });
    await db
      .update(schema.chargingSessions)
      .set({ stopRequestedAt: new Date(), stopReason: isOperator(req) ? "operator_stop" : "customer_stop", updatedAt: new Date() })
      .where(eq(schema.chargingSessions.id, session.id));
    if (isOperator(req)) await logEvent(req.user.id, `Remote stop requested for session ${session.id}`, req);
    res.json({ status: "accepted", transactionId: session.ocppTransactionId, sessionId: session.id, result });
  } catch (err) {
    console.error("stopSession error:", err.message);
    res.status(500).json({ error: "Could not stop charging" });
  }
};

/** Sessions with their station populated (old Mongo `.populate("stationId")` shape). */
export const withStations = async (rows) => {
  const ids = [...new Set(rows.map((r) => r.stationId))];
  const stations = ids.length ? await db.select().from(schema.stations).where(inArray(schema.stations.id, ids)) : [];
  const byId = new Map(stations.map((s) => [s.id, s]));
  return rows.map((r) => sessionToApi(r, byId.get(r.stationId)));
};

// GET /api/sessions[?scope=user]
export const getSessions = async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 500, 2000);
    let where;
    if (req.query.scope === "user" || !isOperator(req)) {
      where = or(eq(schema.chargingSessions.userId, req.user.id), eq(schema.chargingSessions.idTag, `user:${req.user.id}`));
    } else {
      where = stationScope(schema.chargingSessions.stationId, await operatorStationIds(req));
    }
    const q = db.select().from(schema.chargingSessions);
    const rows = await (where ? q.where(where) : q).orderBy(desc(schema.chargingSessions.startTime)).limit(limit);
    res.json(await withStations(rows));
  } catch (err) {
    console.error("getSessions error:", err.message);
    res.status(500).json({ error: "Failed to load sessions" });
  }
};

// GET /api/sessions/live – operator live view
export const getLiveSessions = async (req, res) => {
  try {
    const ids = await operatorStationIds(req);
    const scope = stationScope(schema.chargingSessions.stationId, ids);
    const statusCond = inArray(schema.chargingSessions.status, ["active", "FAULT_PAUSED"]);
    const active = await db
      .select()
      .from(schema.chargingSessions)
      .where(scope ? and(scope, statusCond) : statusCond)
      .orderBy(desc(schema.chargingSessions.startTime));
    if (active.length === 0) return res.json([]);

    const stationIds = [...new Set(active.map((s) => s.stationId))];
    const stations = await db.select().from(schema.stations).where(inArray(schema.stations.id, stationIds));
    const stationById = new Map(stations.map((s) => [s.id, s]));

    const faults = await db
      .select()
      .from(schema.faults)
      .where(and(inArray(schema.faults.stationId, stationIds), eq(schema.faults.status, "active")));
    const faultByStation = new Map(faults.map((f) => [f.stationId, f]));

    // Latest telemetry row per session
    const sessionIds = active.map((s) => s.id);
    const T = schema.telemetry;
    const tel = await db
      .selectDistinctOn([T.sessionId], { sessionId: T.sessionId, voltage: T.voltage, current: T.current, power: T.power, temperature: T.temperature })
      .from(T)
      .where(inArray(T.sessionId, sessionIds))
      .orderBy(T.sessionId, desc(T.timestamp));
    const telBySession = new Map(tel.map((r) => [r.sessionId, r]));

    const live = active.map((tx) => {
      const station = stationById.get(tx.stationId);
      const t = telBySession.get(tx.id);
      const fault = faultByStation.get(tx.stationId);
      const paused = tx.status === "FAULT_PAUSED";
      const connectorStatus = Array.isArray(station?.connectors)
        ? station.connectors.find((c) => Number(c.connectorId) === Number(tx.connectorId))?.status
        : undefined;
      return {
        id: tx.id,
        stationId: tx.stationId,
        stationNumber: tx.stationNumber,
        stationName: station?.name,
        userVehicleId: tx.idTag,
        connectorId: tx.connectorId,
        transactionId: tx.ocppTransactionId,
        voltage: Number(t?.voltage ?? 0),
        current: Number(t?.current ?? 0),
        powerOutput: Number(t?.power ?? 0),
        chargingSpeed: Number(t?.power ?? 0),
        energyDelivered: Number(tx.energyUsed ?? 0),
        temperature: Number(t?.temperature ?? 0),
        sessionTimeSeconds: Math.max(Math.floor((Date.now() - new Date(tx.startTime).getTime()) / 1000), 0),
        chargingCost: Number(tx.cost ?? 0),
        prepaidAmount: tx.prepaidAmount,
        connectorStatus: connectorStatus || "Unknown",
        chargingStatus: paused ? "FAULT" : "Charging",
        sessionStatus: paused ? "FAULT_PAUSED" : "ACTIVE",
        ocppStatus: station?.ocppConnected ? "Connected" : "Disconnected",
        faultType: fault ? fault.faultName || fault.type : undefined,
        faultMessage: fault?.message,
        faultTime: fault ? fault.timestamp || fault.createdAt : undefined,
      };
    });
    res.json(live);
  } catch (err) {
    console.error("getLiveSessions error:", err.message);
    res.status(500).json({ error: "Failed to load live sessions" });
  }
};
