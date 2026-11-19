import { WebSocketServer } from "ws";
import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db, schema, newId, round2, toApi } from "../db/index.js";
import { notify } from "./notificationService.js";
import { emitToOperators, emitToOperatorsAndUser, emitPublicStation, emitStationRoom, getIo } from "./realtime.js";
import { stationRates } from "./pricing.js";
import {
  findStationByNumber,
  updateStation,
  setConnectorStatus,
  findPaidPayment,
  activeSessionFor,
  finalizeSession,
  sessionBill,
  userIdFromTag,
} from "./chargingService.js";

const toNumber = (value) => {
  if (value === null || value === undefined || value === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
};

const mapOcppErrorToFaultType = (errorCode) => {
  const key = String(errorCode || "").toLowerCase();
  if (!key || key === "noerror") return null;
  if (key.includes("overtemperature") || key.includes("highTemperature".toLowerCase())) return "overheat";
  if (key.includes("overvoltage")) return "overvoltage";
  if (key.includes("emergencystop")) return "emergency stop";
  if (key.includes("communicationerror") || key.includes("internalerror")) return "communication failure";
  if (key.includes("connectorlockfailure")) return "connector failure";
  return "power fault";
};

const allowUnknownStations = () => process.env.OCPP_ALLOW_UNKNOWN_STATIONS === "true";
const acceptAnyIdTag = () => process.env.OCPP_ACCEPT_ANY_IDTAG === "true";
const OPERATOR_START_TTL_MS = 2 * 60 * 1000;

const publicStationPayload = (station, extra = {}) => ({
  stationId: station.id,
  stationNumber: station.stationNumber,
  status: station.status,
  ...extra,
});

export default class OcppCentralSystem {
  constructor({ server, io, pathPrefix = "/ocpp" }) {
    this.server = server;
    this.io = io;
    this.pathPrefix = pathPrefix;
    this.wss = new WebSocketServer({
      noServer: true,
      handleProtocols: (protocols) => (protocols.has("ocpp1.6") ? "ocpp1.6" : false),
    });
    this.connections = new Map(); // chargePointId -> ws
    this.pending = new Map(); // uniqueId -> { resolve, reject, timeout }
    this.lastMessageAt = new Map(); // chargePointId -> epoch ms
    this.operatorStarts = new Map(); // chargePointId -> { idTag, expiresAt }
    this.offlineThresholdMs = 90000;
  }

  attach() {
    setInterval(() => {
      const now = Date.now();
      for (const [cp, lastAt] of this.lastMessageAt.entries()) {
        if (now - lastAt <= this.offlineThresholdMs) continue;
        const ws = this.connections.get(cp);
        if (ws && ws.readyState === ws.OPEN) ws.terminate();
        else this.lastMessageAt.delete(cp);
      }
    }, 15000).unref();

    this.server.on("upgrade", (request, socket, head) => {
      let url;
      try {
        url = new URL(request.url, "http://localhost");
      } catch {
        socket.destroy();
        return;
      }
      if (!url.pathname.startsWith(`${this.pathPrefix}/`)) return; // Socket.io and others
      this.authorizeUpgrade(request, url)
        .then((chargePointId) => {
          if (!chargePointId) {
            socket.write("HTTP/1.1 401 Unauthorized\r\nWWW-Authenticate: Basic realm=\"OCPP\"\r\n\r\n");
            socket.destroy();
            return;
          }
          this.wss.handleUpgrade(request, socket, head, (ws) => this.onConnection(ws, chargePointId));
        })
        .catch(() => socket.destroy());
    });
  }

  /** Only stations registered in the dashboard may connect; optional Basic Auth per station. */
  async authorizeUpgrade(request, url) {
    const chargePointId = decodeURIComponent(url.pathname.slice(`${this.pathPrefix}/`.length)).trim();
    if (!chargePointId || chargePointId.includes("/")) return null;
    const station = await findStationByNumber(chargePointId);
    if (!station) {
      if (allowUnknownStations()) return chargePointId;
      console.warn(`⚠️ [OCPP] Rejected unknown charge point "${chargePointId}"`);
      return null;
    }
    if (station.ocppPasswordHash) {
      const header = request.headers.authorization || "";
      if (!header.startsWith("Basic ")) return null;
      const decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
      const sep = decoded.indexOf(":");
      const user = decoded.slice(0, sep);
      const pass = decoded.slice(sep + 1);
      if (user !== chargePointId || !(await bcrypt.compare(pass, station.ocppPasswordHash))) {
        console.warn(`⚠️ [OCPP] Bad credentials for charge point "${chargePointId}"`);
        return null;
      }
    }
    return chargePointId;
  }

  onConnection(ws, chargePointId) {
    const previous = this.connections.get(chargePointId);
    if (previous && previous !== ws) {
      try {
        previous.terminate();
      } catch {}
    }
    this.connections.set(chargePointId, ws);
    this.lastMessageAt.set(chargePointId, Date.now());
    this.emitOcppStatus(chargePointId, true);
    this.markStationOnline(chargePointId).catch((e) => console.error("[OCPP] online:", e.message));

    ws.on("message", (data) => {
      this.lastMessageAt.set(chargePointId, Date.now());
      this.onMessage(chargePointId, ws, data?.toString?.() ?? "").catch((e) =>
        console.error(`[OCPP] ${chargePointId} message error:`, e.message)
      );
    });
    ws.on("close", () => {
      if (this.connections.get(chargePointId) !== ws) return; // replaced by a newer connection
      this.connections.delete(chargePointId);
      this.lastMessageAt.delete(chargePointId);
      this.emitOcppStatus(chargePointId, false);
      this.markStationOffline(chargePointId).catch((e) => console.error("[OCPP] offline:", e.message));
    });
    ws.on("error", () => {});
  }

  isConnected(chargePointId) {
    const ws = this.connections.get(chargePointId);
    return Boolean(ws && ws.readyState === ws.OPEN);
  }

  /** Remember that an operator requested a remote start, so StartTransaction for it is accepted. */
  allowOperatorStart(chargePointId, idTag) {
    this.operatorStarts.set(chargePointId, { idTag, expiresAt: Date.now() + OPERATOR_START_TTL_MS });
  }

  sendCall(chargePointId, action, payload) {
    const ws = this.connections.get(chargePointId);
    if (!ws || ws.readyState !== ws.OPEN) {
      const err = new Error("Charge point not connected");
      err.code = "CP_NOT_CONNECTED";
      return Promise.reject(err);
    }
    const uniqueId = randomUUID();
    ws.send(JSON.stringify([2, uniqueId, action, payload ?? {}]));
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(uniqueId);
        reject(new Error("OCPP request timeout"));
      }, 15000);
      this.pending.set(uniqueId, { resolve, reject, timeout });
    });
  }

  async onMessage(chargePointId, ws, raw) {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    if (!Array.isArray(msg) || msg.length < 3) return;
    const [messageTypeId, uniqueId] = msg;

    if (messageTypeId === 3 || messageTypeId === 4) {
      const pending = this.pending.get(uniqueId);
      if (!pending) return;
      clearTimeout(pending.timeout);
      this.pending.delete(uniqueId);
      if (messageTypeId === 3) pending.resolve(msg[2]);
      else {
        const err = new Error(msg[3] || "OCPP error");
        err.ocpp = { errorCode: msg[2], errorDescription: msg[3], errorDetails: msg[4] };
        pending.reject(err);
      }
      return;
    }
    if (messageTypeId !== 2) return;

    const action = msg[2];
    const payload = msg[3] || {};
    try {
      const result = await this.handleCall(chargePointId, action, payload);
      ws.send(JSON.stringify([3, uniqueId, result ?? {}]));
    } catch (e) {
      console.error(`[OCPP] ${chargePointId} ${action} failed:`, e.message);
      ws.send(JSON.stringify([4, uniqueId, "InternalError", "Internal Error", {}]));
    }
  }

  async handleCall(chargePointId, action, payload) {
    switch (action) {
      case "BootNotification":
        await this.onBootNotification(chargePointId, payload);
        return { status: "Accepted", currentTime: new Date().toISOString(), interval: 30 };
      case "Heartbeat":
        await this.onHeartbeat(chargePointId);
        return { currentTime: new Date().toISOString() };
      case "StatusNotification":
        await this.onStatusNotification(chargePointId, payload);
        return {};
      case "MeterValues":
        await this.onMeterValues(chargePointId, payload);
        return {};
      case "Authorize":
        return { idTagInfo: { status: await this.authorizeIdTag(chargePointId, payload?.idTag) } };
      case "StartTransaction":
        return await this.onStartTransaction(chargePointId, payload);
      case "StopTransaction":
        return await this.onStopTransaction(chargePointId, payload);
      case "DataTransfer":
        return { status: "UnknownVendorId" };
      default:
        return {};
    }
  }

  async authorizeIdTag(chargePointId, idTag) {
    const tag = String(idTag || "");
    const userId = userIdFromTag(tag);
    if (userId) {
      const [user] = await db.select({ status: schema.users.status }).from(schema.users).where(eq(schema.users.id, userId)).limit(1);
      return user && user.status !== "blocked" ? "Accepted" : "Invalid";
    }
    return acceptAnyIdTag() ? "Accepted" : "Invalid";
  }

  async markStationOnline(chargePointId) {
    const station = await findStationByNumber(chargePointId);
    if (!station) return;
    const wasOffline = !station.ocppConnected;
    const status = ["Faulted", "FAULT", "charging", "maintenance"].includes(station.status) ? station.status : "online";
    const updated = await updateStation(station.id, { status, lastSeen: new Date(), ocppConnected: true });
    emitPublicStation(updated, "station_update", publicStationPayload(updated));
    if (wasOffline) {
      notify({
        userId: station.userId,
        title: "Station Online",
        message: `Your EV charging station ${station.name || station.stationNumber} is online.`,
        type: "system",
        metadata: { stationId: station.id, stationNumber: station.stationNumber },
      });
    }
  }

  async markStationOffline(chargePointId) {
    const station = await findStationByNumber(chargePointId);
    if (!station) return;
    const updated = await updateStation(station.id, { status: "offline", ocppConnected: false });
    emitPublicStation(updated, "station_update", publicStationPayload(updated));
    notify({
      userId: station.userId,
      title: "Station Offline",
      message: `EV charger ${station.name || station.stationNumber} has disconnected. Please check power and network.`,
      type: "fault",
      metadata: { stationId: station.id, stationNumber: station.stationNumber },
    });
  }

  emitOcppStatus(chargePointId, connected) {
    getIo()?.emit("ocpp_status", { stationNumber: chargePointId, connected, timestamp: new Date().toISOString() });
  }

  async onBootNotification(chargePointId, payload) {
    const station = await findStationByNumber(chargePointId);
    if (!station) return;
    const status = ["Faulted", "FAULT", "charging", "maintenance"].includes(station.status) ? station.status : "online";
    const updated = await updateStation(station.id, {
      ocpp: {
        ...(station.ocpp || {}),
        vendor: payload?.chargePointVendor,
        model: payload?.chargePointModel,
        firmwareVersion: payload?.firmwareVersion,
        serialNumber: payload?.chargePointSerialNumber,
      },
      lastSeen: new Date(),
      status,
      ocppConnected: true,
    });
    emitPublicStation(updated, "station_update", publicStationPayload(updated));
  }

  async onHeartbeat(chargePointId) {
    const station = await findStationByNumber(chargePointId);
    if (!station) return;
    await updateStation(station.id, { lastSeen: new Date(), ocppConnected: true });
  }

  async onStatusNotification(chargePointId, payload) {
    const station = await findStationByNumber(chargePointId);
    if (!station) return;

    const connectorId = toNumber(payload?.connectorId) ?? 0;
    let status = payload?.status || "Unknown";
    const errorCode = payload?.errorCode || "NoError";
    const values = { lastSeen: new Date(), ocppConnected: true };

    const faultType = mapOcppErrorToFaultType(errorCode);
    if (faultType) {
      status = "Faulted";
      values.status = "Faulted";
      values.faultStatus = faultType;
      values.health = "WARNING";

      // One active hardware fault per station/type – avoid duplicates on repeated notifications.
      const [existing] = await db
        .select({ id: schema.faults.id })
        .from(schema.faults)
        .where(and(eq(schema.faults.stationId, station.id), eq(schema.faults.type, faultType), eq(schema.faults.status, "active")))
        .limit(1);
      if (!existing) {
        const [fault] = await db
          .insert(schema.faults)
          .values({
            id: newId(),
            stationId: station.id,
            type: faultType,
            faultCode: errorCode,
            faultName: errorCode,
            source: "HARDWARE",
            message: payload?.info || errorCode,
            severity: "high",
            status: "active",
            raw: { errorCode, status: payload?.status, connectorId, vendorErrorCode: payload?.vendorErrorCode },
          })
          .returning();
        notify({
          userId: station.userId,
          title: "Charger Fault Detected",
          message: `Station ${station.name || station.stationNumber} reported a fault: ${payload?.info || errorCode}.`,
          type: "fault",
          metadata: { stationId: station.id, stationNumber: station.stationNumber, faultId: fault.id, type: faultType },
        });
        emitToOperators(station, "fault_alert", {
          stationId: station.id,
          stationNumber: station.stationNumber,
          faultId: fault.id,
          type: fault.type,
          message: fault.message,
          severity: fault.severity,
          createdAt: fault.createdAt,
        });
      }
    } else if (connectorId > 0 && !["Faulted", "FAULT", "maintenance"].includes(station.status)) {
      values.status = status === "Charging" ? "charging" : status === "Unavailable" ? "offline" : "online";
    }

    if (connectorId > 0) values.connectors = setConnectorStatus(station.connectors, connectorId, status, errorCode);
    const updated = await updateStation(station.id, values);
    emitPublicStation(updated, "station_update", publicStationPayload(updated, { connectorId, connectorStatus: status, errorCode }));
  }

  extractMeterValues(payload) {
    const connectorId = toNumber(payload?.connectorId);
    const transactionId = toNumber(payload?.transactionId);
    const blocks = Array.isArray(payload?.meterValue) ? payload.meterValue : [];
    let timestamp = new Date();
    let voltage, current, power, temperature, energyWh;

    for (const block of blocks) {
      if (block?.timestamp) timestamp = new Date(block.timestamp);
      for (const s of Array.isArray(block?.sampledValue) ? block.sampledValue : []) {
        const meas = String(s?.measurand || "Energy.Active.Import.Register").toLowerCase();
        const unit = String(s?.unit || "").toLowerCase();
        const value = toNumber(s?.value);
        if (value === undefined) continue;
        if (meas.startsWith("voltage")) voltage = value;
        else if (meas.startsWith("current.import") || meas === "current") current = value;
        else if (meas.startsWith("power.active.import") || meas === "power") power = unit === "w" ? value / 1000 : value;
        else if (meas.startsWith("temperature")) temperature = value;
        else if (meas.startsWith("energy.active.import.register")) energyWh = unit === "kwh" ? value * 1000 : value;
      }
    }
    if (Number.isNaN(timestamp.getTime())) timestamp = new Date();
    return { connectorId, transactionId, timestamp, voltage, current, power, temperature, energyWh };
  }

  async onMeterValues(chargePointId, payload) {
    const station = await findStationByNumber(chargePointId);
    if (!station) return;
    const data = this.extractMeterValues(payload);

    const session = data.transactionId !== undefined ? await activeSessionFor(station.id, data.transactionId) : null;
    const energyKwh = data.energyWh !== undefined ? data.energyWh / 1000 : undefined;

    await db.insert(schema.telemetry).values({
      stationId: station.stationNumber,
      stationObjectId: station.id,
      sessionId: session?.id,
      connectorId: data.connectorId,
      transactionId: data.transactionId,
      voltage: data.voltage,
      current: data.current,
      power: data.power,
      temperature: data.temperature,
      energyConsumed: energyKwh,
      timestamp: data.timestamp,
    });

    const stationValues = { lastSeen: new Date(), ocppConnected: true };
    if (energyKwh !== undefined) stationValues.totalEnergyConsumed = energyKwh;
    await updateStation(station.id, stationValues);

    let sessionEnergy;
    let bill;
    if (session && data.energyWh !== undefined) {
      sessionEnergy = Math.max(data.energyWh - (Number(session.meterStart) || 0), 0) / 1000;
      bill = sessionBill(session, sessionEnergy);
      await db
        .update(schema.chargingSessions)
        .set({ energyUsed: sessionEnergy, cost: bill.total, tax: bill.tax, updatedAt: new Date() })
        .where(eq(schema.chargingSessions.id, session.id));
      await this.enforcePrepaidLimit(station, session, bill.total);
    }

    const eventPayload = {
      stationId: station.id,
      stationNumber: station.stationNumber,
      connectorId: data.connectorId,
      transactionId: data.transactionId,
      sessionId: session?.id,
      voltage: data.voltage,
      current: data.current,
      power: data.power,
      temperature: data.temperature,
      energyDelivered: sessionEnergy ?? energyKwh,
      cost: bill?.total,
      prepaidAmount: session?.prepaidAmount ?? undefined,
      timestamp: data.timestamp,
    };
    emitStationRoom(station, "live_data", eventPayload);
    if (session) {
      emitToOperatorsAndUser(station, userIdFromTag(session.idTag), "transaction_update", {
        stationId: station.id,
        stationNumber: station.stationNumber,
        transactionId: data.transactionId,
        sessionId: session.id,
        telemetry: eventPayload,
      });
    }
  }

  /** Stop charging automatically once the running bill reaches the prepaid amount. */
  async enforcePrepaidLimit(station, session, runningTotal) {
    const prepaid = Number(session.prepaidAmount) || 0;
    if (prepaid <= 0 || session.stopRequestedAt) return;
    // Stop slightly early so the next meter reading does not overshoot the prepaid amount.
    if (runningTotal < prepaid * 0.99) return;
    console.log(`💰 [OCPP] Prepaid limit reached for session ${session.id} (₹${runningTotal}/₹${prepaid}); stopping`);
    await db
      .update(schema.chargingSessions)
      .set({ stopRequestedAt: new Date(), stopReason: "prepaid_limit", updatedAt: new Date() })
      .where(eq(schema.chargingSessions.id, session.id));
    this.sendCall(station.stationNumber, "RemoteStopTransaction", { transactionId: session.ocppTransactionId }).catch((e) =>
      console.error(`[OCPP] Auto-stop failed for ${station.stationNumber}:`, e.message)
    );
  }

  async nextTransactionId() {
    const { rows } = await db.execute(sql`select nextval('ocpp_transaction_id_seq')::int as id`);
    return rows[0].id;
  }

  async onStartTransaction(chargePointId, payload) {
    const transactionId = await this.nextTransactionId();
    const station = await findStationByNumber(chargePointId);
    if (!station) return { transactionId, idTagInfo: { status: "Invalid" } };

    const connectorId = toNumber(payload?.connectorId) ?? 1;
    const meterStart = toNumber(payload?.meterStart) ?? 0;
    const idTag = String(payload?.idTag || "unknown");
    const startedAt = payload?.timestamp && !Number.isNaN(new Date(payload.timestamp).getTime()) ? new Date(payload.timestamp) : new Date();

    // Who is allowed to start, and at what price?
    const rates = stationRates(station, startedAt);
    let pricing = { appliedPrice: rates.pricePerKwh, convenienceFee: rates.convenienceFee, taxPercent: rates.taxPercent };
    let payment = null;
    let userId = null;

    if (idTag.startsWith("user:")) {
      userId = userIdFromTag(idTag);
      payment = await findPaidPayment(userId, station.id);
      if (!payment) {
        console.warn(`⚠️ [OCPP] StartTransaction rejected at ${chargePointId}: no paid order for ${idTag}`);
        return { transactionId, idTagInfo: { status: "Invalid" } };
      }
      pricing = {
        appliedPrice: payment.pricePerKwh ?? rates.pricePerKwh,
        convenienceFee: payment.convenienceFee ?? rates.convenienceFee,
        taxPercent: payment.taxPercent ?? rates.taxPercent,
      };
    } else if (idTag.startsWith("operator:")) {
      const allowed = this.operatorStarts.get(chargePointId);
      if (!allowed || allowed.idTag !== idTag || allowed.expiresAt < Date.now()) {
        return { transactionId, idTagInfo: { status: "Invalid" } };
      }
      this.operatorStarts.delete(chargePointId);
      userId = userIdFromTag(idTag);
    } else if (!acceptAnyIdTag()) {
      console.warn(`⚠️ [OCPP] StartTransaction rejected at ${chargePointId}: unknown idTag`);
      return { transactionId, idTagInfo: { status: "Invalid" } };
    }

    const [session] = await db
      .insert(schema.chargingSessions)
      .values({
        id: newId(),
        stationId: station.id,
        stationNumber: station.stationNumber,
        userId,
        connectorId,
        ocppTransactionId: transactionId,
        idTag,
        meterStart,
        startTime: startedAt,
        status: "active",
        ...pricing,
        prepaidAmount: payment ? Number(payment.totalAmount) : null,
        paymentId: payment?.paymentId,
        orderId: payment?.orderId,
      })
      .returning();

    if (payment) {
      const [p] = await db
        .update(schema.payments)
        .set({ status: "charging", sessionId: session.id, updatedAt: new Date() })
        .where(eq(schema.payments.id, payment.id))
        .returning();
      emitToOperatorsAndUser(station, userId, "payment_update", toApi(p));
    }

    const updated = await updateStation(station.id, {
      status: "charging",
      connectors: setConnectorStatus(station.connectors, connectorId, "Charging"),
    });
    emitPublicStation(updated, "station_update", publicStationPayload(updated, { connectorId, connectorStatus: "Charging" }));

    if (idTag.startsWith("user:")) {
      notify({
        userId,
        title: "Charging Started",
        message: `Your charging session has started at ${station.name || station.stationNumber}.`,
        type: "session_start",
        metadata: { stationId: station.id, stationNumber: station.stationNumber, ocppTransactionId: transactionId, sessionId: session.id },
      });
    }
    emitToOperatorsAndUser(station, userId, "transaction_update", {
      stationId: station.id,
      stationNumber: station.stationNumber,
      connectorId,
      transactionId,
      sessionId: session.id,
      status: "active",
      startedAt: session.startTime,
      idTag,
    });

    return { transactionId, idTagInfo: { status: "Accepted" } };
  }

  async onStopTransaction(chargePointId, payload) {
    const station = await findStationByNumber(chargePointId);
    if (!station) return { idTagInfo: { status: "Accepted" } };

    const ocppTransactionId = toNumber(payload?.transactionId);
    const meterStop = toNumber(payload?.meterStop);
    const endedAt = payload?.timestamp && !Number.isNaN(new Date(payload.timestamp).getTime()) ? new Date(payload.timestamp) : new Date();

    const session = ocppTransactionId !== undefined ? await activeSessionFor(station.id, ocppTransactionId) : null;
    if (session) {
      await finalizeSession({ session, station, meterStop, endedAt, reason: payload?.reason || "stopped" });
    }

    const [stillActive] = await db
      .select({ id: schema.chargingSessions.id })
      .from(schema.chargingSessions)
      .where(and(eq(schema.chargingSessions.stationId, station.id), inArray(schema.chargingSessions.status, ["active", "FAULT_PAUSED"])))
      .limit(1);
    const values = {};
    if (!stillActive && station.status === "charging") values.status = "online";
    if (session) values.connectors = setConnectorStatus(station.connectors, session.connectorId, "Available");
    if (Object.keys(values).length) {
      const updated = await updateStation(station.id, values);
      emitPublicStation(updated, "station_update", publicStationPayload(updated, { connectorId: session?.connectorId, connectorStatus: "Available" }));
    }
    return { idTagInfo: { status: "Accepted" } };
  }
}

export { round2 };
