import mqtt from "mqtt";
import Telemetry from "../models/Telemetry.js";
import Station from "../models/Station.js";
import Fault from "../models/Fault.js";

class MQTTService {
  constructor(io) {
    this.io = io;
    this.brokerUrl = process.env.MQTT_BROKER_URL || "mqtt://broker.emqx.io";
    this.options = {
      username: process.env.MQTT_USERNAME,
      password: process.env.MQTT_PASSWORD,
      reconnectPeriod: 5000,
      connectTimeout: 30 * 1000,
      clean: true,
      clientId: `charge_hub_backend_${Math.random().toString(16).slice(2, 8)}`,
    };
    this.client = null;
    this.heartbeats = new Map(); // stationNumber -> lastSeen Timestamp
    this.offlineThreshold = 30000; // 30 seconds
  }

  connect() {
    console.log(`🔌 Attempting MQTT connection to: ${this.brokerUrl}`);
    this.client = mqtt.connect(this.brokerUrl, this.options);

    this.client.on("connect", () => {
      console.log("✅ MQTT Connected Successfully");
      this.subscribeToTopics();
      this.startHeartbeatMonitor();
    });

    this.client.on("message", (topic, message) => {
      this.handleMessage(topic, message.toString());
    });

    this.client.on("error", (err) => {
      console.error("❌ MQTT Error:", err.message);
    });

    this.client.on("reconnect", () => {
      console.log("🔄 MQTT Reconnecting...");
    });

  }

  publish(topic, message, options = {}) {
    if (this.client && this.client.connected) {
      const payload = typeof message === 'string' ? message : JSON.stringify(message);
      this.client.publish(topic, payload, { qos: 1, ...options });
      return true;
    }
    console.error("❌ MQTT Publish failed: Client not connected");
    return false;
  }

  subscribeToTopics() {
    const topics = [
      "stations/+/live",
      "stations/+/status",
      "stations/+/alerts",
      "stations/+/heartbeat"
    ];

    topics.forEach(topic => {
      this.client.subscribe(topic, { qos: 1 }, (err) => {
        if (!err) {
          console.log(`📡 Subscribed to: ${topic}`);
        } else {
          console.error(`❌ Subscription error for ${topic}:`, err);
        }
      });
    });
  }

  async handleMessage(topic, payload) {
    try {
      const topicParts = topic.split("/");
      if (topicParts.length < 3) return;

      const stationNumber = topicParts[1];
      const subTopic = topicParts[2];
      
      let data;
      try {
        data = JSON.parse(payload);
      } catch (e) {
        console.warn(`⚠️ Invalid JSON on topic ${topic}:`, payload);
        return;
      }

      // Update heartbeat on ANY message from the station
      this.heartbeats.set(stationNumber, Date.now());

      // Production-style logging
      // console.log(`📩 [MQTT] ${stationNumber}/${subTopic}:`, data);

      const station = await Station.findOne({ stationNumber });
      if (!station) {
        if (subTopic !== 'heartbeat') {
          console.warn(`⚠️ Message for unknown station: ${stationNumber}`);
        }
        return;
      }

      // Update lastSeen in DB periodically or on important messages
      station.lastSeen = new Date();
      if (station.status === 'offline') {
        station.status = 'online';
        this.io.emit("station_update", { stationId: station._id, status: "online" });
      }

      switch (subTopic) {
        case "live":
          await this.handleLiveData(station, data);
          break;
        case "status":
          await this.handleStatusUpdate(station, data);
          break;
        case "alerts":
          await this.handleAlert(station, data);
          break;
        case "heartbeat":
          await station.save();
          break;
      }
    } catch (error) {
      console.error("❌ Error processing MQTT message:", error);
    }
  }

  async handleLiveData(station, data) {
    // 1. Persist to Telemetry Collection (Production QoS 1 equivalent logic)
    const telemetry = new Telemetry({
      stationId: station.stationNumber,
      voltage: data.voltage,
      current: data.current,
      power: data.power,
      temperature: data.temperature,
      energyConsumed: data.energyConsumed,
    });
    await telemetry.save();

    // 2. Update Station Summary
    station.totalEnergyConsumed = data.energyConsumed;
    await station.save();

    // 3. Emit to specific station room (Scalable Socket.io)
    const roomName = `station:${station._id}`;
    this.io.to(roomName).emit("live_data", {
      ...data,
      stationId: station._id,
      timestamp: new Date(),
    });

    // 4. Emit to global live view room
    this.io.emit("live_updates", {
      stationId: station._id,
      stationNumber: station.stationNumber,
      type: "live",
      data,
    });
  }

  async handleStatusUpdate(station, data) {
    station.status = data.status || "online";
    await station.save();

    this.io.emit("station_update", { 
      stationId: station._id, 
      stationNumber: station.stationNumber,
      status: data.status 
    });
  }

  async handleAlert(station, data) {
    const validTypes = ["overheat", "disconnect", "power failure", "system error"];
    const faultType = validTypes.includes(data.type) ? data.type : "system error";

    const fault = new Fault({
      stationId: station._id,
      type: faultType,
      message: data.message || "Hardware Alert",
      severity: data.severity || "high",
      status: "active",
    });
    await fault.save();

    station.faultStatus = data.type;
    await station.save();

    this.io.to(`station:${station._id}`).emit("alert", data);
    this.io.emit("new_alert", { stationId: station._id, ...data });
  }

  startHeartbeatMonitor() {
    setInterval(async () => {
      const now = Date.now();
      for (const [stationNumber, lastSeen] of this.heartbeats.entries()) {
        if (now - lastSeen > this.offlineThreshold) {
          console.log(`📡 Station ${stationNumber} timed out. Marking offline.`);
          this.heartbeats.delete(stationNumber);
          
          try {
            const station = await Station.findOne({ stationNumber });
            if (station && station.status !== 'offline') {
              station.status = 'offline';
              await station.save();
              
              this.io.emit("station_update", { 
                stationId: station._id, 
                stationNumber: station.stationNumber,
                status: "offline" 
              });
            }
          } catch (err) {
            console.error("Error updating offline status:", err);
          }
        }
      }
    }, 10000); // Check every 10 seconds
  }
}

export default MQTTService;
