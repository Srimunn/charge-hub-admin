import mongoose from 'mongoose';
import Session from './models/Session.js';
import Fault from './models/Fault.js';
import Station from './models/Station.js';
import mqtt from 'mqtt';

export const startSimulation = () => {
    const brokerUrl = process.env.MQTT_BROKER_URL || "mqtt://broker.emqx.io";
    const client = mqtt.connect(brokerUrl);

    client.on("connect", () => {
        console.log("🤖 Simulator connected to MQTT Broker");
    });

    // Run simulation loop every 5 seconds
    setInterval(async () => {
        try {
            if (mongoose.connection.readyState !== 1) return;

            const activeSessions = await Session.find({ status: 'active' }).populate('stationId');

            for (let session of activeSessions) {
                if (!session.stationId) continue;
                
                const stationNumber = session.stationId.stationNumber;

                // 1. Publish Heartbeat
                client.publish(`stations/${stationNumber}/heartbeat`, JSON.stringify({ tick: Date.now() }));

                // 2. Simulate Live Telemetry
                const liveData = {
                    voltage: 230 + Math.random() * 10,
                    current: 16 + Math.random() * 16,
                    power: 7 + Math.random() * 43, 
                    temperature: 30 + Math.random() * 20,
                    energyConsumed: session.energyUsed + 0.069,
                    connectorStatus: "locked",
                    chargingStatus: "charging",
                    chargingSpeed: 7 + Math.random() * 43
                };

                // Update session energy incrementally for DB
                session.energyUsed = liveData.energyConsumed;
                session.cost = session.energyUsed * (session.stationId.basePricePerKwh || 15);
                await session.save();

                // Publish to MQTT (Mimics Raspberry Pi)
                client.publish(`stations/${stationNumber}/live`, JSON.stringify(liveData), { qos: 1 });

                // Random 1% chance for fault
                if (Math.random() < 0.01) {
                    const types = ["overheat", "disconnect", "power failure", "system error"];
                    const alert = {
                        type: types[Math.floor(Math.random() * types.length)],
                        severity: Math.random() < 0.2 ? "high" : "medium",
                        message: "Hardware malfunction detected by Pi Controller"
                    };
                    client.publish(`stations/${stationNumber}/alerts`, JSON.stringify(alert), { qos: 1 });
                    
                    if (alert.severity === "high") {
                        client.publish(`stations/${stationNumber}/status`, JSON.stringify({ status: "offline" }), { qos: 1 });
                    }
                }
            }
        } catch (err) {
            console.error("Simulation Tick Error:", err);
        }
    }, 5000);
};
