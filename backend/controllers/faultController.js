import Fault from '../models/Fault.js';

export const createFault = async (req, res) => {
    try {
        const { stationId, type, severity, message } = req.body;
        if (!stationId || !type) return res.status(400).json({ error: "stationId and type are required" });

        const fault = new Fault({
            stationId,
            userId: req.user ? req.user.id : null,
            type,
            severity: severity || "medium",
            message,
            status: "active",
        });

        await fault.save();
        res.status(201).json(fault);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

export const getFaults = async (req, res) => {
    try {
        const faults = await Fault.find({ userId: req.user.id }).populate('stationId').sort({ createdAt: -1 });
        res.json(faults);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

export const resolveFault = async (req, res) => {
    try {
        const { id } = req.params;
        const fault = await Fault.findById(id);

        if (!fault) return res.status(404).json({ error: "Fault not found" });

        fault.status = "resolved";
        fault.resolvedAt = new Date();

        await fault.save();
        res.json(fault);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
