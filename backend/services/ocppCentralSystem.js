import { WebSocketServer } from "ws";
import { randomUUID } from "crypto";
import Station from "../models/Station.js";
import Telemetry from "../models/Telemetry.js";
import Fault from "../models/Fault.js";
import Transaction from "../models/Transaction.js";

const toNumber = (value) => {
  if (value === null || value === undefined) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
};

const calculateCurrentRate = (station, at = new Date()) => {
  let pricePerKwh = station?.basePricePerKwh || 0;
  if (station?.dynamicPricing?.length) {
    const hh = String(at.getHours()).padStart(2, "0");
    const mm = String(at.getMinutes()).padStart(2, "0");
    const t = `${hh}:${mm}`;
    for (const rule of station.dynamicPricing) {
      if (rule?.startTime && rule?.endTime && t >= rule.startTime && t <= rule.endTime) {
        pricePerKwh = rule.pricePerKwh;
        break;
      }
    }
  }
  const convenienceFee = station?.convenienceFee || 0;
  const tax = station?.tax || 0;
  return { pricePerKwh, convenienceFee, tax };
};

const mapOcppErrorToFaultType = (errorCode) => {
  const key = String(errorCode || "").toLowerCase();
  if (!key || key === "noerror") return null;
  if (key.includes("overtemperature")) return "overheat";
  if (key.includes("overvoltage")) return "overvoltage";
  if (key.includes("emergencystop")) return "emergency stop";
  if (key.includes("communicationerror") || key.includes("internalerror")) return "communication failure";
  if (key.includes("power") || key.includes("powermeterfailure")) return "power fault";
  if (key.includes("connectorlockfailure") || key.includes("groundfailure")) return "power fault";
  return "power fault";
};

export default class OcppCentralSystem {
  constructor({ server, io, pathPrefix = "/ocpp" }) {
    this.server = server;
    this.io = io;
    this.pathPrefix = pathPrefix;
    this.wss = new WebSocketServer({ noServer: true });
    this.connections = new Map(); // chargePointId -> ws
    this.pending = new Map(); // uniqueId -> { resolve, reject, timeout }
    this.lastMessageAt = new Map(); // chargePointId -> epoch ms
    this.offlineThresholdMs = 60000;
  }

  attach() {
    setInterval(() => {
      const now = Date.now();
      for (const [chargePointId, lastAt] of this.lastMessageAt.entries()) {
        if (now - lastAt <= this.offlineThresholdMs) continue;
        const ws = this.connections.get(chargePointId);
        if (ws && ws.readyState === ws.OPEN) {
          try {
            ws.close();
          } catch {}
        } else {
          this.lastMessageAt.delete(chargePointId);
        }
      }
    }, 10000);

    this.server.on("upgrade", (request, socket, head) => {
      try {
        const url = new URL(request.url, "http://localhost");
        if (!url.pathname.startsWith(`${this.pathPrefix}/`)) return;

        const protocols = request.headers["sec-websocket-protocol"];
        if (protocols && !String(protocols).toLowerCase().includes("ocpp1.6")) {
          socket.destroy();
          return;
        }

        this.wss.handleUpgrade(request, socket, head, (ws) => {
          this.wss.emit("connection", ws, request);
        });
      } catch {
        socket.destroy();
      }
    });

    this.wss.on("connection", (ws, request) => {
      const url = new URL(request.url, "http://localhost");
      const chargePointId = decodeURIComponent(url.pathname.slice(`${this.pathPrefix}/`.length));

      if (!chargePointId) {
        ws.close();
        return;
      }

      this.connections.set(chargePointId, ws);
      this.lastMessageAt.set(chargePointId, Date.now());
      this.emitOcppStatus(chargePointId, true);
      this.markStationOnline(chargePointId).catch(() => {});

      ws.on("message", (data) => {
        this.lastMessageAt.set(chargePointId, Date.now());
        const raw = data?.toString?.() ?? "";
        this.onMessage(chargePointId, ws, raw).catch(() => {});
      });

      ws.on("close", () => {
        this.connections.delete(chargePointId);
        this.lastMessageAt.delete(chargePointId);
        this.emitOcppStatus(chargePointId, false);
        this.markStationOffline(chargePointId).catch(() => {});
      });

      ws.on("error", () => {});
    });
  }

  isConnected(chargePointId) {
    const ws = this.connections.get(chargePointId);
    return Boolean(ws && ws.readyState === ws.OPEN);
  }

  sendCall(chargePointId, action, payload) {
    const ws = this.connections.get(chargePointId);
    if (!ws || ws.readyState !== ws.OPEN) {
      const err = new Error("Charge point not connected");
      err.code = "CP_NOT_CONNECTED";
      throw err;
    }

    const uniqueId = randomUUID();
    const message = JSON.stringify([2, uniqueId, action, payload ?? {}]);
    ws.send(message);

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

    const messageTypeId = msg[0];
    const uniqueId = msg[1];

    if (messageTypeId === 3) {
      const pending = this.pending.get(uniqueId);
      if (!pending) return;
      clearTimeout(pending.timeout);
      this.pending.delete(uniqueId);
      pending.resolve(msg[2]);
      return;
    }

    if (messageTypeId === 4) {
      const pending = this.pending.get(uniqueId);
      if (!pending) return;
      clearTimeout(pending.timeout);
      this.pending.delete(uniqueId);
      const err = new Error(msg[3] || "OCPP error");
      err.ocpp = { errorCode: msg[2], errorDescription: msg[3], errorDetails: msg[4] };
      pending.reject(err);
      return;
    }

    if (messageTypeId !== 2) return;

    const action = msg[2];
    const payload = msg[3] || {};

    try {
      const result = await this.handleCall(chargePointId, action, payload);
      ws.send(JSON.stringify([3, uniqueId, result ?? {}]));
    } catch (e) {
      ws.send(JSON.stringify([4, uniqueId, "InternalError", e?.message || "Internal Error", {}]));
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
        return { idTagInfo: { status: "Accepted" } };
      case "StartTransaction":
        return await this.onStartTransaction(chargePointId, payload);
      case "StopTransaction":
        return await this.onStopTransaction(chargePointId, payload);
      default:
        return {};
    }
  }

  async findStation(chargePointId) {
    return Station.findOne({ stationNumber: chargePointId });
  }

  async markStationOnline(chargePointId) {
    const station = await this.findStation(chargePointId);
    if (!station) return;
    station.status = "online";
    station.lastSeen = new Date();
    station.ocppConnected = true;
    await station.save();
    this.io.emit("station_update", { stationId: station._id, stationNumber: station.stationNumber, status: station.status });
  }

  async markStationOffline(chargePointId) {
    const station = await this.findStation(chargePointId);
    if (!station) return;
    station.status = "offline";
    station.ocppConnected = false;
    await station.save();
    this.io.emit("station_update", { stationId: station._id, stationNumber: station.stationNumber, status: station.status });
  }

  emitOcppStatus(chargePointId, connected) {
    this.io.emit("ocpp_status", { stationNumber: chargePointId, connected, timestamp: new Date().toISOString() });
  }

  async onBootNotification(chargePointId, payload) {
    const station = await this.findStation(chargePointId);
    if (!station) return;
    station.ocpp = {
      ...station.ocpp,
      vendor: payload?.chargePointVendor,
      model: payload?.chargePointModel,
      firmwareVersion: payload?.firmwareVersion,
    };
    station.lastSeen = new Date();
    station.status = "online";
    station.ocppConnected = true;
    await station.save();
    this.io.emit("station_update", { stationId: station._id, stationNumber: station.stationNumber, status: station.status });
  }

  async onHeartbeat(chargePointId) {
    const station = await this.findStation(chargePointId);
    if (!station) return;
    station.lastSeen = new Date();
    if (station.status !== "online" && station.status !== "Faulted" && station.status !== "FAULT" && station.status !== "charging") station.status = "online";
    station.ocppConnected = true;
    await station.save();
    this.io.emit("station_update", { stationId: station._id, stationNumber: station.stationNumber, status: station.status });
  }

  async onStatusNotification(chargePointId, payload) {
    const station = await this.findStation(chargePointId);
    if (!station) return;

    const connectorId = toNumber(payload?.connectorId) ?? 0;
    let status = payload?.status || "Unknown";
    let errorCode = payload?.errorCode || "NoError";

    station.lastSeen = new Date();
    station.ocppConnected = true;
    station.connectors = station.connectors || [];

    const faultType = mapOcppErrorToFaultType(errorCode);
    if (faultType) {
      station.status = "Faulted";
      station.faultStatus = faultType;
      status = "Faulted";
      
      const fault = await Fault.create({
        stationId: station._id,
        type: faultType,
        message: payload?.info || errorCode,
        severity: "high",
        status: "active",
        raw: { errorCode, status, connectorId },
      });
      this.io.emit("fault_alert", {
        stationId: station._id,
        stationNumber: station.stationNumber,
        faultId: fault._id,
        type: fault.type,
        message: fault.message,
        severity: fault.severity,
        createdAt: fault.createdAt,
      });
    }

    if (station.status === "Faulted" || station.status === "FAULT") {
      status = "Faulted";
      if (errorCode === "NoError" && station.connectors && station.connectors.length > 0) {
        const activeConn = station.connectors.find(c => Number(c.connectorId) === connectorId);
        if (activeConn && activeConn.status === "Faulted") {
          errorCode = activeConn.errorCode || "NoError";
        }
      }
    }

    const existingIdx = station.connectors.findIndex((c) => Number(c.connectorId) === connectorId);
    const connector = {
      connectorId,
      status,
      errorCode,
      updatedAt: new Date(),
    };
    if (existingIdx >= 0) station.connectors[existingIdx] = connector;
    else station.connectors.push(connector);

    await station.save();

    this.io.emit("station_update", {
      stationId: station._id,
      stationNumber: station.stationNumber,
      status: station.status,
      connectorId,
      connectorStatus: status,
      errorCode,
    });
  }

  extractMeterValues(payload) {
    const connectorId = toNumber(payload?.connectorId);
    const transactionId = toNumber(payload?.transactionId);

    const mv = Array.isArray(payload?.meterValue) ? payload.meterValue : [];
    let timestamp = new Date();
    let voltage;
    let current;
    let power;
    let temperature;
    let energyDelivered;

    for (const block of mv) {
      if (block?.timestamp) timestamp = new Date(block.timestamp);
      const sampled = Array.isArray(block?.sampledValue) ? block.sampledValue : [];
      for (const s of sampled) {
        const meas = String(s?.measurand || "").toLowerCase();
        const value = toNumber(s?.value);
        if (value === undefined) continue;
        if (meas.includes("voltage")) voltage = value;
        else if (meas.includes("current")) current = value;
        else if (meas.includes("power")) power = value;
        else if (meas.includes("temperature")) temperature = value;
        else if (meas.includes("energy.active.import.register")) energyDelivered = value;
      }
    }

    return { connectorId, transactionId, timestamp, voltage, current, power, temperature, energyDelivered };
  }

  async onMeterValues(chargePointId, payload) {
    const station = await this.findStation(chargePointId);
    if (!station) return;

    const data = this.extractMeterValues(payload);

    const telemetry = await Telemetry.create({
      stationId: station.stationNumber,
      stationObjectId: station._id,
      connectorId: data.connectorId,
      transactionId: data.transactionId,
      voltage: data.voltage,
      current: data.current,
      power: data.power,
      temperature: data.temperature,
      energyConsumed: data.energyDelivered,
      timestamp: data.timestamp,
    });

    if (data.energyDelivered !== undefined) {
      station.totalEnergyConsumed = data.energyDelivered;
    }
    station.lastSeen = new Date();
    station.ocppConnected = true;
    await station.save();

    const eventPayload = {
      stationId: station._id,
      stationNumber: station.stationNumber,
      connectorId: data.connectorId,
      transactionId: data.transactionId,
      voltage: data.voltage,
      current: data.current,
      power: data.power,
      temperature: data.temperature,
      energyDelivered: data.energyDelivered,
      timestamp: telemetry.timestamp || new Date(),
    };

    this.io.emit("live_data", eventPayload);
    this.io.to(`station:${station._id}`).emit("live_data", eventPayload);

    if (data.transactionId !== undefined) {
      this.io.emit("transaction_update", {
        stationId: station._id,
        stationNumber: station.stationNumber,
        transactionId: data.transactionId,
        telemetry: eventPayload,
      });
    }
  }

  async onStartTransaction(chargePointId, payload) {
    const station = await this.findStation(chargePointId);
    if (!station) return { transactionId: Math.floor(Date.now() / 1000), idTagInfo: { status: "Accepted" } };

    const ocppTransactionId = Math.floor(Date.now() / 1000) + Math.floor(Math.random() * 1000);
    const connectorId = toNumber(payload?.connectorId) ?? 0;
    const meterStart = toNumber(payload?.meterStart) ?? 0;
    const idTag = payload?.idTag || "unknown";
    const startedAt = payload?.timestamp ? new Date(payload.timestamp) : new Date();

    let paymentId = undefined;
    let orderId = undefined;
    if (idTag.startsWith("user:")) {
      try {
        const Payment = (await import("../models/Payment.js")).default;
        const userId = idTag.replace("user:", "");
        const payment = await Payment.findOne({
          userId: userId,
          stationId: station._id,
          status: "paid"
        }).sort({ createdAt: -1 });

        if (payment) {
          paymentId = payment.paymentId;
          orderId = payment.orderId;
        }
      } catch (err) {
        console.error("❌ Error linking payment in onStartTransaction:", err.message);
      }
    }

    const tx = await Transaction.create({
      stationId: station._id,
      stationNumber: station.stationNumber,
      connectorId,
      ocppTransactionId,
      idTag,
      meterStart,
      startTime: startedAt,
      status: "active",
      paymentId,
      orderId,
    });

    this.io.emit("transaction_update", {
      stationId: station._id,
      stationNumber: station.stationNumber,
      connectorId,
      transactionId: ocppTransactionId,
      status: "active",
      startedAt: tx.startTime,
      idTag,
    });

    return { transactionId: ocppTransactionId, idTagInfo: { status: "Accepted" } };
  }

  async onStopTransaction(chargePointId, payload) {
    const station = await this.findStation(chargePointId);
    if (!station) return { idTagInfo: { status: "Accepted" } };

    const ocppTransactionId = toNumber(payload?.transactionId);
    const meterStop = toNumber(payload?.meterStop);
    const endedAt = payload?.timestamp ? new Date(payload.timestamp) : new Date();

    const tx = await Transaction.findOne({ stationId: station._id, ocppTransactionId, status: "active" });
    if (tx) {
      tx.status = "completed";
      tx.endTime = endedAt;
      if (meterStop !== undefined) tx.meterStop = meterStop;

      const meterStart = tx.meterStart || 0;
      const energyUsed = meterStop !== undefined ? Math.max((meterStop - meterStart) / 1000, 0) : undefined;
      if (energyUsed !== undefined) tx.energyUsed = energyUsed;

      const { pricePerKwh, convenienceFee, tax } = calculateCurrentRate(station, endedAt);
      if (energyUsed !== undefined) {
        tx.appliedPrice = pricePerKwh;
        tx.convenienceFee = convenienceFee;
        tx.tax = tax;
        tx.cost = energyUsed * pricePerKwh + convenienceFee + tax;
      }

      await tx.save();

      // Reconcile Cost and Auto-Refund
      try {
        const Payment = (await import("../models/Payment.js")).default;
        const Session = (await import("../models/Session.js")).default;
        
        let payment = null;
        if (tx.orderId) {
          payment = await Payment.findOne({ orderId: tx.orderId });
        } else if (tx.paymentId) {
          payment = await Payment.findOne({ paymentId: tx.paymentId });
        } else {
          payment = await Payment.findOne({ sessionId: tx.sessionId });
        }

        if (payment) {
          const estimatedAmount = payment.totalAmount || payment.amount;
          const actualAmount = tx.cost !== undefined ? tx.cost : (energyUsed * pricePerKwh + convenienceFee + tax);
          
          payment.estimatedAmount = estimatedAmount;
          payment.actualAmount = actualAmount;
          
          if (!payment.sessionId && tx.sessionId) {
            payment.sessionId = tx.sessionId;
          }

          if (estimatedAmount > actualAmount) {
            const refundAmount = Number((estimatedAmount - actualAmount).toFixed(2));
            payment.refundAmount = refundAmount;
            payment.extraAmount = 0;
            payment.status = "pending_refund";
            await payment.save();
            
            this.io.emit("payment_update", payment);

            let refundId = `ref_mock_${Math.random().toString(36).substring(2, 10)}`;
            if (payment.paymentId && !payment.paymentId.startsWith("pay_mock_")) {
              try {
                const Razorpay = (await import("razorpay")).default;
                const razorpay = new Razorpay({
                  key_id: process.env.RAZORPAY_KEY_ID,
                  key_secret: process.env.RAZORPAY_KEY_SECRET,
                });
                const refund = await razorpay.payments.refund(payment.paymentId, {
                  amount: Math.round(refundAmount * 100),
                  notes: { reason: "Auto refund for EV charging unused energy difference" }
                });
                refundId = refund.id;
              } catch (refundErr) {
                console.error("❌ Razorpay Auto-Refund Call Error:", refundErr.message);
              }
            }

            payment.status = "refunded";
            payment.refundId = refundId;
            payment.refundTimestamp = new Date();
            await payment.save();
          } else {
            payment.status = "completed";
            payment.refundAmount = 0;
            payment.extraAmount = Number((actualAmount - estimatedAmount).toFixed(2));
            await payment.save();
          }

          this.io.emit("payment_update", payment);

          // Update MongoDB Session schema to completed if exists
          const sessionObjId = payment.sessionId || tx.sessionId;
          if (sessionObjId) {
            const session = await Session.findById(sessionObjId);
            if (session) {
              session.status = "completed";
              session.endTime = endedAt;
              session.energyUsed = energyUsed || 0;
              session.cost = actualAmount;
              session.appliedPrice = pricePerKwh;
              session.convenienceFee = convenienceFee;
              session.tax = tax;
              await session.save();
            }
          }
        }
      } catch (reconErr) {
        console.error("❌ Error during stop cost reconciliation:", reconErr.message);
      }

      this.io.emit("transaction_update", {
        stationId: station._id,
        stationNumber: station.stationNumber,
        connectorId: tx.connectorId,
        transactionId: tx.ocppTransactionId,
        status: "completed",
        endedAt: tx.endTime,
        energyUsed: tx.energyUsed,
        cost: tx.cost,
      });
    }

    return { idTagInfo: { status: "Accepted" } };
  }
}
