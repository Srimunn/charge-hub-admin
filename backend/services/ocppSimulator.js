import WebSocket from "ws";
import { randomUUID } from "crypto";
import Station from "../models/Station.js";

class StationClient {
  constructor(stationNumber) {
    this.stationNumber = stationNumber;
    this.ws = null;
    this.reconnectTimer = null;
    this.chargingTimer = null;
    this.energyUsed = 0.0;
    this.activeTransactionId = null;
    this.isConnecting = false;
    this.pendingCalls = new Map(); // uniqueId -> { resolve, reject }
  }

  connect() {
    if (this.ws || this.isConnecting) return;
    this.isConnecting = true;
    const port = process.env.PORT || 5000;
    console.log(`🔌 [OCPP Simulator] Station ${this.stationNumber} connecting to ws://127.0.0.1:${port}/ocpp/${this.stationNumber}...`);

    try {
      this.ws = new WebSocket(`ws://127.0.0.1:${port}/ocpp/${this.stationNumber}`, "ocpp1.6");

      this.ws.on("open", () => {
        this.isConnecting = false;
        console.log(`✅ [OCPP Simulator] Station ${this.stationNumber} connected!`);
        this.sendBootNotification();
        this.sendStatusNotification(1, "Available");
      });

      this.ws.on("message", (data) => {
        const msgStr = data.toString();
        this.handleMessage(msgStr);
      });

      this.ws.on("close", () => {
        this.cleanup();
        this.scheduleReconnect();
      });

      this.ws.on("error", (err) => {
        console.error(`❌ [OCPP Simulator] Station ${this.stationNumber} error:`, err.message);
        this.cleanup();
        this.scheduleReconnect();
      });
    } catch (err) {
      console.error(`❌ [OCPP Simulator] Station ${this.stationNumber} failed to instantiate WebSocket:`, err.message);
      this.isConnecting = false;
      this.scheduleReconnect();
    }
  }

  cleanup() {
    this.isConnecting = false;
    if (this.ws) {
      try {
        this.ws.terminate();
      } catch {}
      this.ws = null;
    }
    if (this.chargingTimer) {
      clearInterval(this.chargingTimer);
      this.chargingTimer = null;
    }
    this.pendingCalls.clear();
  }

  scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, 5000);
  }

  sendCall(action, payload) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error("WebSocket not open"));
    }
    const uniqueId = randomUUID();
    const message = JSON.stringify([2, uniqueId, action, payload]);
    this.ws.send(message);

    return new Promise((resolve, reject) => {
      this.pendingCalls.set(uniqueId, { resolve, reject });
      setTimeout(() => {
        if (this.pendingCalls.has(uniqueId)) {
          this.pendingCalls.delete(uniqueId);
          reject(new Error("Timeout waiting for call result"));
        }
      }, 10000);
    });
  }

  sendBootNotification() {
    this.sendCall("BootNotification", {
      chargePointVendor: "SimulatedVendor",
      chargePointModel: "SimulatedModel-X1",
      firmwareVersion: "1.0.0-mock",
    }).then((res) => {
      console.log(`🤖 [OCPP Simulator] Station ${this.stationNumber} boot accepted:`, res);
    }).catch((err) => {
      console.error(`❌ [OCPP Simulator] Station ${this.stationNumber} boot error:`, err.message);
    });
  }

  sendStatusNotification(connectorId, status) {
    this.sendCall("StatusNotification", {
      connectorId,
      status,
      errorCode: "NoError",
    }).catch((err) => {
      console.error(`❌ [OCPP Simulator] Station ${this.stationNumber} status notification error:`, err.message);
    });
  }

  handleMessage(msgStr) {
    let msg;
    try {
      msg = JSON.parse(msgStr);
    } catch {
      return;
    }

    if (!Array.isArray(msg) || msg.length < 3) return;

    const messageTypeId = msg[0];
    const uniqueId = msg[1];

    if (messageTypeId === 3) {
      // Call Result
      const pending = this.pendingCalls.get(uniqueId);
      if (pending) {
        this.pendingCalls.delete(uniqueId);
        pending.resolve(msg[2]);
      }
      return;
    }

    if (messageTypeId === 4) {
      // Call Error
      const pending = this.pendingCalls.get(uniqueId);
      if (pending) {
        this.pendingCalls.delete(uniqueId);
        pending.reject(new Error(msg[2] || "Call error"));
      }
      return;
    }

    if (messageTypeId !== 2) return;

    // Call Request from Central System
    const action = msg[2];
    const payload = msg[3] || {};

    this.handleCall(uniqueId, action, payload);
  }

  async handleCall(uniqueId, action, payload) {
    console.log(`📥 [OCPP Simulator] Station ${this.stationNumber} received Call: ${action}`, payload);

    if (action === "RemoteStartTransaction") {
      // 1. Acknowledge Accepted
      this.respond(uniqueId, { status: "Accepted" });

      // 2. Set Status Notification to Occupied/Charging
      this.sendStatusNotification(1, "Charging");

      // 3. Initiate StartTransaction to get transaction ID from backend
      setTimeout(async () => {
        try {
          const res = await this.sendCall("StartTransaction", {
            connectorId: 1,
            idTag: payload.idTag || "simulated-user",
            meterStart: 0,
            timestamp: new Date().toISOString(),
          });

          console.log(`🔌 [OCPP Simulator] Station ${this.stationNumber} StartTransaction Result:`, res);
          const txId = res?.transactionId;
          if (txId) {
            this.activeTransactionId = txId;
            this.energyUsed = 0.0;
            this.startStreamingTelemetry();
          }
        } catch (err) {
          console.error(`❌ [OCPP Simulator] Station ${this.stationNumber} StartTransaction failed:`, err.message);
        }
      }, 1000);

    } else if (action === "RemoteStopTransaction") {
      // 1. Acknowledge Accepted
      this.respond(uniqueId, { status: "Accepted" });

      // 2. Stop streaming telemetry
      if (this.chargingTimer) {
        clearInterval(this.chargingTimer);
        this.chargingTimer = null;
      }

      // 3. Send StopTransaction
      const txId = this.activeTransactionId || payload.transactionId;
      setTimeout(async () => {
        try {
          await this.sendCall("StopTransaction", {
            transactionId: txId,
            meterStop: Math.round(this.energyUsed * 1000),
            timestamp: new Date().toISOString(),
          });
          console.log(`🔌 [OCPP Simulator] Station ${this.stationNumber} StopTransaction sent for txId ${txId}`);
        } catch (err) {
          console.error(`❌ [OCPP Simulator] Station ${this.stationNumber} StopTransaction failed:`, err.message);
        }

        this.activeTransactionId = null;
        // 4. Return to Available
        this.sendStatusNotification(1, "Available");
      }, 1000);
    } else {
      // Unknown call action, return empty result
      this.respond(uniqueId, {});
    }
  }

  respond(uniqueId, payload) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify([3, uniqueId, payload]));
  }

  startStreamingTelemetry() {
    if (this.chargingTimer) clearInterval(this.chargingTimer);
    
    this.chargingTimer = setInterval(async () => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN || !this.activeTransactionId) {
        clearInterval(this.chargingTimer);
        this.chargingTimer = null;
        return;
      }

      // Check if station has active faults in database
      let isFaulted = false;
      try {
        const station = await Station.findOne({ stationNumber: this.stationNumber });
        if (station && (station.status === "Faulted" || station.status === "FAULT")) {
          isFaulted = true;
        }
      } catch (err) {
        console.error(`⚠️ [OCPP Simulator] Failed to check station status for ${this.stationNumber}:`, err.message);
      }

      const meterValuePayload = {
        connectorId: 1,
        transactionId: this.activeTransactionId,
        meterValue: [{
          timestamp: new Date().toISOString(),
          sampledValue: []
        }]
      };

      if (isFaulted) {
        // Station is stopped due to fault - send 0 kW power/current/voltage
        meterValuePayload.meterValue[0].sampledValue = [
          { measurand: "Voltage", value: 0 },
          { measurand: "Current", value: 0 },
          { measurand: "Power", value: 0 },
          { measurand: "Temperature", value: 45 },
          { measurand: "Energy.Active.Import.Register", value: this.energyUsed }
        ];
      } else {
        // Normal operation - increment energy and stream active charging data
        this.energyUsed += 0.05; // Increment 0.05 kWh every 5 seconds (fast charging simulation)
        
        meterValuePayload.meterValue[0].sampledValue = [
          { measurand: "Voltage", value: 230 + Math.random() * 5 },
          { measurand: "Current", value: 16 + Math.random() * 2 },
          { measurand: "Power", value: 7.2 + Math.random() * 0.5 },
          { measurand: "Temperature", value: 35 + Math.random() * 3 },
          { measurand: "Energy.Active.Import.Register", value: this.energyUsed }
        ];
      }

      this.sendCall("MeterValues", meterValuePayload).catch((err) => {
        console.error(`❌ [OCPP Simulator] Station ${this.stationNumber} MeterValues send failed:`, err.message);
      });
    }, 5000);
  }
}

const activeClients = new Map(); // stationNumber -> StationClient

export function simulateStation(stationNumber) {
  if (activeClients.has(stationNumber)) {
    const client = activeClients.get(stationNumber);
    if (client.ws && client.ws.readyState === WebSocket.OPEN) {
      return client;
    }
    // If client exists but is disconnected, reconnect it
    client.cleanup();
    client.connect();
    return client;
  }

  console.log(`🔌 [OCPP Simulator] Dynamically starting client simulator for station ${stationNumber}...`);
  const client = new StationClient(stationNumber);
  client.connect();
  activeClients.set(stationNumber, client);
  return client;
}

export default async function startOcppSimulator() {
  console.log("🚀 [OCPP Simulator] Initializing station client simulator...");
  try {
    const stations = await Station.find({});
    console.log(`🔋 [OCPP Simulator] Found ${stations.length} stations in DB to simulate.`);
    
    for (const station of stations) {
      if (!station.stationNumber) continue;
      simulateStation(station.stationNumber);
    }
  } catch (err) {
    console.error("❌ [OCPP Simulator] Failed to retrieve stations for simulation:", err.message);
  }
}

