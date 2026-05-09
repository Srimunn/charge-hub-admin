import mongoose from 'mongoose';
import Session from './models/Session.js';
import Fault from './models/Fault.js';
import Station from './models/Station.js';

export const startSimulation = () => {
    // Run simulation loop every 5 seconds
    setInterval(async () => {
        try {
            // Skip simulation if database is not connected
            if (mongoose.connection.readyState !== 1) {
                return;
            }

            // Find active sessions
            const activeSessions = await Session.find({ status: 'active' });

            for (let session of activeSessions) {
                // Determine duration so far
                const now = new Date();
                const durationMs = now - session.startTime;
                const hours = durationMs / (1000 * 60 * 60);

                // Add energy incrementally (simulate 50 kW per hour average = ~0.069 kWh per 5 seconds)
                session.energyUsed += 0.069; 
                session.cost = session.energyUsed * 0.25; // 0.25 cents per kWh
                await session.save();

                // Random 1% chance for fault per 5 second simulation tick if station is active
                if (Math.random() < 0.01) {
                    const existingFaults = await Fault.find({ stationId: session.stationId, status: 'active' });
                    if (existingFaults.length === 0) {
                        const types = ["overheat", "disconnect", "power failure", "system error"];
                        const faultType = types[Math.floor(Math.random() * types.length)];
                        const severity = Math.random() < 0.2 ? "high" : "medium"; // 20% high severity

                        const newFault = new Fault({
                            stationId: session.stationId,
                            userId: session.userId,
                            type: faultType,
                            message: `Simulated Fault: ${faultType}`,
                            severity: severity,
                            status: "active"
                        });
                        console.log(`⚠️ Simulator injected a fault on Station ${session.stationId}`);
                        await newFault.save();
                    }
                }
            }
        } catch (err) {
            console.error("Simulation Tick Error:", err);
        }
    }, 5000);
};
