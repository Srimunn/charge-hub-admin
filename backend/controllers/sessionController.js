import Session from '../models/Session.js';
import Station from '../models/Station.js';

export const startSession = async (req, res) => {
    try {
        const { stationId } = req.body;
        if (!stationId) return res.status(400).json({ error: "stationId is required" });

        const session = new Session({
            stationId,
            userId: req.user.id,
            startTime: new Date(),
            status: "active",
            energyUsed: 0,
            cost: 0
        });

        await session.save();
        res.status(201).json(session);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

export const stopSession = async (req, res) => {
    try {
        const { id } = req.params; // sessionId
        const session = await Session.findById(id);

        if (!session) return res.status(404).json({ error: "Session not found" });
        if (session.status === "completed") return res.status(400).json({ error: "Session already completed" });

        session.endTime = new Date();
        session.status = "completed";

        const station = await Station.findById(session.stationId);
        
        const durationHours = (session.endTime - session.startTime) / (1000 * 60 * 60);
        
        let powerOutput = station && station.powerOutput ? station.powerOutput : 50;
        if (session.energyUsed === 0 && durationHours > 0) {
            session.energyUsed = Math.max(durationHours * powerOutput, 0.5);
        }

        let pricePerKwh = station?.basePricePerKwh || 15; // default ₹15 if not set
        
        if (station && station.dynamicPricing && station.dynamicPricing.length > 0) {
            const currentHour = session.endTime.getHours();
            const currentMinute = session.endTime.getMinutes();
            const currentTimeStr = `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`;

            for (let rule of station.dynamicPricing) {
                if (rule.startTime && rule.endTime && currentTimeStr >= rule.startTime && currentTimeStr <= rule.endTime) {
                    pricePerKwh = rule.pricePerKwh;
                    break;
                }
            }
        }

        const convenienceFee = station?.convenienceFee || 0;
        const tax = station?.tax || 0;

        const energyCost = session.energyUsed * pricePerKwh;
        session.appliedPrice = pricePerKwh;
        session.convenienceFee = convenienceFee;
        session.tax = tax;
        session.cost = energyCost + convenienceFee + tax;

        await session.save();
        res.json(session);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

export const getSessions = async (req, res) => {
    try {
        const isDbConnected = Session.db.readyState === 1;
        if (isDbConnected) {
            const sessions = await Session.find({ userId: req.user.id })
                                          .populate('stationId')
                                          .sort({ startTime: -1 });
            res.json(sessions);
        } else {
            // Mock data for sessions
            res.json([
                { _id: 's1', stationId: { name: 'Downtown Plaza Station' }, energyUsed: 45, cost: 675, status: 'completed', startTime: new Date(Date.now() - 86400000) },
                { _id: 's2', stationId: { name: 'Mall Parking Level 2' }, energyUsed: 22, cost: 330, status: 'active', startTime: new Date(Date.now() - 3600000) },
                { _id: 's3', stationId: { name: 'Airport Terminal 1' }, energyUsed: 120, cost: 1800, status: 'completed', startTime: new Date(Date.now() - 172800000) },
            ]);
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

export const getLiveSessions = async (req, res) => {
    try {
        const activeSessions = await Session.find({ userId: req.user.id, status: 'active' }).populate('stationId');
        
        const liveData = activeSessions.map(session => {
            const station = session.stationId;
            const durationHrs = (new Date() - new Date(session.startTime)) / (1000 * 60 * 60);
            const powerKw = station?.powerOutput || 50;
            const energy = (durationHrs * powerKw).toFixed(2);
            
            // Randomly fluctuate voltage and current slightly for "live" feel
            const voltage = 390 + Math.floor(Math.random() * 20); // 390 - 410 V
            const current = Math.floor((powerKw * 1000) / voltage);
            const temperature = 35 + Math.floor(Math.random() * 15); // 35 - 50 C
            
            return {
                id: session._id,
                stationNumber: station?.stationNumber || "UNKNOWN",
                userVehicleId: `EV-${req.user.id.substring(0, 4).toUpperCase()}`,
                chargingStatus: "Charging",
                voltage: voltage,
                current: current,
                powerOutput: powerKw,
                chargingSpeed: powerKw,
                energyDelivered: parseFloat(energy),
                connectorStatus: "Locked",
                temperature: temperature
            };
        });

        res.json(liveData);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
