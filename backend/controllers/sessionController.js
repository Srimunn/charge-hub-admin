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
        const sessions = await Session.find({ userId: req.user.id })
                                      .populate('stationId')
                                      .sort({ startTime: -1 });
        res.json(sessions);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
