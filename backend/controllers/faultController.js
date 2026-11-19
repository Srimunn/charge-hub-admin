import { and, desc, eq, inArray, ne } from "drizzle-orm";
import { db, schema, newId, toApi, stationToApi } from "../db/index.js";
import { logEvent } from "./auditLogController.js";
import { findManagedStation, operatorStationIds, stationScope } from "../services/access.js";
import { setConnectorStatus } from "../services/chargingService.js";
import { emitToOperators, emitPublicStation, emitToOperatorsAndUser } from "../services/realtime.js";

const isOperator = (req) => ["admin", "owner"].includes(req.user?.role);

const SIMULATED_FAULTS = {
  OVER_TEMP: { name: "Over Temperature", message: "Thermal sensor exceeded safe operating limit", type: "overheat" },
  TEMP_HIGH: { name: "Over Temperature", message: "Thermal sensor exceeded safe operating limit", type: "overheat" },
  CONNECTOR_FAILURE: { name: "Connector Failure", message: "Connector pin degradation or lock failure detected", type: "connector failure" },
  POWER_FAILURE: { name: "Power Failure", message: "Power grid instability or utility loss detected", type: "power failure" },
  VOLT_HIGH: { name: "Over Voltage", message: "Over voltage detected on charging circuit", type: "overvoltage" },
  CURRENT_HIGH: { name: "Over Current", message: "Over current detected on charging connector", type: "power fault" },
  EMERGENCY_STOP: { name: "Emergency Stop", message: "Emergency shutdown initiated by emergency stop button", type: "emergency stop" },
};

/** Attach the populated station (old Mongo `.populate("stationId")` shape). */
const withStation = async (rows) => {
  const ids = [...new Set(rows.map((r) => r.stationId))];
  const stations = ids.length ? await db.select().from(schema.stations).where(inArray(schema.stations.id, ids)) : [];
  const byId = new Map(stations.map((s) => [s.id, stationToApi(s)]));
  return rows.map((r) => toApi(r, { stationId: byId.get(r.stationId) || r.stationId }));
};

const listScope = async (req, column) => {
  if (isOperator(req)) return stationScope(column, await operatorStationIds(req));
  return undefined; // customers: public list of active issues (filtered below)
};

// POST /api/faults – operator logs a fault manually
export const createFault = async (req, res) => {
  try {
    const { stationId, type, severity, message } = req.body;
    if (!stationId || !type) return res.status(400).json({ error: "stationId and type are required" });
    const station = await findManagedStation(req, stationId);
    if (!station) return res.status(404).json({ error: "Station not found" });
    const [fault] = await db
      .insert(schema.faults)
      .values({
        id: newId(),
        stationId: station.id,
        userId: req.user.id,
        type: String(type),
        severity: ["low", "medium", "high"].includes(severity) ? severity : "medium",
        message: message ? String(message).slice(0, 1000) : null,
        source: "HARDWARE",
        status: "active",
      })
      .returning();
    emitToOperators(station, "fault_alert", { stationId: station.id, stationNumber: station.stationNumber, faultId: fault.id, type: fault.type, message: fault.message, severity: fault.severity, createdAt: fault.createdAt });
    await logEvent(req.user.id, `Fault logged at ${station.stationNumber}: ${fault.type}`, req);
    res.status(201).json(toApi(fault));
  } catch (err) {
    console.error("createFault error:", err.message);
    res.status(500).json({ error: "Could not create fault" });
  }
};

// GET /api/faults
export const getFaults = async (req, res) => {
  try {
    let where = await listScope(req, schema.faults.stationId);
    if (!isOperator(req)) where = eq(schema.faults.status, "active");
    const q = db.select().from(schema.faults);
    const rows = await (where ? q.where(where) : q).orderBy(desc(schema.faults.createdAt)).limit(1000);
    res.json(await withStation(rows));
  } catch (err) {
    console.error("getFaults error:", err.message);
    res.status(500).json({ error: "Failed to load faults" });
  }
};

// GET /api/faults/:id
export const getFaultById = async (req, res) => {
  try {
    const scope = await listScope(req, schema.faults.stationId);
    const cond = eq(schema.faults.id, String(req.params.id));
    const [fault] = await db.select().from(schema.faults).where(scope ? and(cond, scope) : cond).limit(1);
    if (!fault) return res.status(404).json({ error: "Fault not found" });
    res.json((await withStation([fault]))[0]);
  } catch (err) {
    res.status(500).json({ error: "Failed to load fault" });
  }
};

// POST /api/faults/simulate { stationId, faultCode } – demo/testing
export const simulateFault = async (req, res) => {
  try {
    const { stationId, faultCode } = req.body;
    if (!stationId || !faultCode) return res.status(400).json({ error: "stationId and faultCode are required" });
    const station = await findManagedStation(req, stationId);
    if (!station) return res.status(404).json({ error: "Station not found" });
    const def = SIMULATED_FAULTS[faultCode] || SIMULATED_FAULTS.EMERGENCY_STOP;

    // Pause the active session on this station (simulated chargers stop delivering power)
    const [tx] = await db
      .update(schema.chargingSessions)
      .set({ status: "FAULT_PAUSED", updatedAt: new Date() })
      .where(and(eq(schema.chargingSessions.stationId, station.id), eq(schema.chargingSessions.status, "active")))
      .returning();

    const [fault] = await db
      .insert(schema.faults)
      .values({
        id: newId(),
        stationId: station.id,
        userId: req.user.id,
        sessionId: tx?.id,
        type: def.type,
        faultCode,
        faultName: def.name,
        source: "SIMULATION",
        severity: "high",
        message: def.message,
        status: "active",
      })
      .returning();

    const [alert] = await db
      .insert(schema.alerts)
      .values({ id: newId(), type: "FAULT", title: `${def.name} Detected`, stationId: station.id, severity: "HIGH", source: "SIMULATION", status: "ACTIVE" })
      .returning();

    const [updated] = await db
      .update(schema.stations)
      .set({
        status: "FAULT",
        faultStatus: def.type,
        health: "WARNING",
        connectors: setConnectorStatus(station.connectors, 1, "Faulted", faultCode),
        updatedAt: new Date(),
      })
      .where(eq(schema.stations.id, station.id))
      .returning();

    emitPublicStation(updated, "station_update", { stationId: station.id, stationNumber: station.stationNumber, status: "FAULT", connectorId: 1, connectorStatus: "Faulted", errorCode: faultCode });
    emitToOperators(station, "fault_alert", { stationId: station.id, stationNumber: station.stationNumber, faultId: fault.id, type: fault.type, message: fault.message, severity: fault.severity, createdAt: fault.createdAt });
    emitToOperatorsAndUser(station, tx?.userId, "transaction_update", { stationId: station.id, stationNumber: station.stationNumber, sessionId: tx?.id, status: "FAULT_PAUSED" });
    await logEvent(req.user.id, `Fault simulated at ${station.stationNumber}: ${faultCode}`, req);

    res.status(201).json({ message: "Fault simulated successfully", fault: toApi(fault), alert: toApi(alert) });
  } catch (err) {
    console.error("Simulation fault error:", err.message);
    res.status(500).json({ error: "Could not simulate fault" });
  }
};

// PUT /api/faults/:id – resolve
export const resolveFault = async (req, res) => {
  try {
    const [fault] = await db.select().from(schema.faults).where(eq(schema.faults.id, String(req.params.id))).limit(1);
    if (!fault) return res.status(404).json({ error: "Fault not found" });
    const station = await findManagedStation(req, fault.stationId);
    if (!station) return res.status(404).json({ error: "Fault not found" });

    const previousStatus = fault.status;
    const [resolved] = await db
      .update(schema.faults)
      .set({ status: "resolved", resolvedAt: new Date(), resolvedBy: req.user.id })
      .where(eq(schema.faults.id, fault.id))
      .returning();

    const remaining = await db
      .select()
      .from(schema.faults)
      .where(and(eq(schema.faults.stationId, station.id), eq(schema.faults.status, "active"), ne(schema.faults.id, fault.id)))
      .orderBy(desc(schema.faults.createdAt));
    const activeFaultCount = remaining.length;

    let values;
    let connectorStatus;
    let errorCode = "NoError";
    if (activeFaultCount === 0) {
      const [resumed] = await db
        .update(schema.chargingSessions)
        .set({ status: "active", updatedAt: new Date() })
        .where(and(eq(schema.chargingSessions.stationId, station.id), eq(schema.chargingSessions.status, "FAULT_PAUSED")))
        .returning();
      const charging = Boolean(resumed);
      connectorStatus = charging ? "Charging" : "Available";
      values = {
        status: charging ? "charging" : station.ocppConnected ? "online" : "offline",
        faultStatus: "none",
        health: "NORMAL",
        lastResolvedAt: new Date(),
        connectors: setConnectorStatus(station.connectors, 1, connectorStatus),
      };
      await db.update(schema.alerts).set({ status: "RESOLVED" }).where(and(eq(schema.alerts.stationId, station.id), eq(schema.alerts.status, "ACTIVE")));
      if (resumed) emitToOperatorsAndUser(station, resumed.userId, "transaction_update", { stationId: station.id, stationNumber: station.stationNumber, sessionId: resumed.id, status: "active" });
    } else {
      const next = remaining[0];
      connectorStatus = "Faulted";
      errorCode = next.faultCode || "Faulted";
      values = {
        status: "FAULT",
        faultStatus: next.type,
        health: "WARNING",
        connectors: setConnectorStatus(station.connectors, 1, "Faulted", errorCode),
      };
    }
    const [updated] = await db
      .update(schema.stations)
      .set({ ...values, updatedAt: new Date() })
      .where(eq(schema.stations.id, station.id))
      .returning();

    emitToOperators(station, "station_status_updated", { stationId: station.id, stationNumber: station.stationNumber, status: updated.status, health: updated.health, lastResolvedAt: updated.lastResolvedAt, activeFaultCount });
    emitPublicStation(updated, "station_update", { stationId: station.id, stationNumber: station.stationNumber, status: updated.status, health: updated.health, faultStatus: updated.faultStatus, connectorId: 1, connectorStatus, errorCode });
    emitToOperators(station, "fault_resolved", { faultId: fault.id, stationId: station.id, stationNumber: station.stationNumber, activeFaultCount });

    await logEvent(req.user.id, `Fault resolved | ${fault.id} | station ${station.stationNumber} | ${previousStatus} → ${activeFaultCount === 0 ? "AVAILABLE" : "FAULTED"}`, req);
    res.json(toApi(resolved));
  } catch (err) {
    console.error("resolveFault error:", err.message);
    res.status(500).json({ error: "Could not resolve fault" });
  }
};

// GET /api/faults/alerts
export const getAlerts = async (req, res) => {
  try {
    let where = await listScope(req, schema.alerts.stationId);
    if (!isOperator(req)) where = eq(schema.alerts.status, "ACTIVE");
    const q = db.select().from(schema.alerts);
    const rows = await (where ? q.where(where) : q).orderBy(desc(schema.alerts.timestamp)).limit(500);
    res.json(await withStation(rows));
  } catch (err) {
    res.status(500).json({ error: "Failed to load alerts" });
  }
};
