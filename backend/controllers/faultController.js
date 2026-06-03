import Fault from '../models/Fault.js';
import Station from "../models/Station.js";
import Transaction from "../models/Transaction.js";
import Session from "../models/Session.js";
import Alert from "../models/Alert.js";

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
        const stations = await Station.find({ userId: req.user.id }).select("_id");
        const stationIds = stations.map((s) => s._id);
        const faults = await Fault.find({ stationId: { $in: stationIds } })
            .populate("stationId")
            .sort({ createdAt: -1 });
        res.json(faults);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

export const getFaultById = async (req, res) => {
    try {
        const stations = await Station.find({ userId: req.user.id }).select("_id");
        const stationIds = stations.map((s) => s._id);
        const fault = await Fault.findOne({ _id: req.params.id, stationId: { $in: stationIds } }).populate("stationId");
        if (!fault) return res.status(404).json({ error: "Fault not found" });
        res.json(fault);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

export const simulateFault = async (req, res) => {
    try {
        const { stationId, faultCode } = req.body;
        if (!stationId || !faultCode) {
            return res.status(400).json({ error: "stationId and faultCode are required" });
        }

        const station = await Station.findById(stationId);
        if (!station) {
            return res.status(404).json({ error: "Station not found" });
        }

        // Map faultCode to descriptive details
        let mappedName = "Over Temperature";
        let mappedMessage = "Thermal sensor exceeded safe operating limit";
        let mappedType = "overheat";
        let severity = "high";

        if (faultCode === "VOLT_HIGH") {
            mappedName = "Over Voltage";
            mappedMessage = "Over voltage detected on charging circuit";
            mappedType = "overvoltage";
        } else if (faultCode === "CURRENT_HIGH") {
            mappedName = "Over Current";
            mappedMessage = "Over current detected on charging connector";
            mappedType = "power fault";
        } else if (faultCode === "EMERGENCY_STOP") {
            mappedName = "Emergency Stop";
            mappedMessage = "Emergency shutdown initiated by emergency stop button";
            mappedType = "emergency stop";
        }

        // 1. Stop charging session if active
        const tx = await Transaction.findOne({ stationId: station._id, status: "active" });
        let sessionId = null;

        if (tx) {
            sessionId = tx.sessionId;
            
            // Try to notify the simulator via OCPP
            const ocpp = req.ocppCentralSystem;
            if (ocpp && ocpp.isConnected(station.stationNumber)) {
                try {
                    await ocpp.sendCall(station.stationNumber, "RemoteStopTransaction", { transactionId: tx.ocppTransactionId });
                } catch (ocppErr) {
                    console.warn(`Could not remote stop simulator: ${ocppErr.message}`);
                }
            }

            // Programmatically complete the transaction/session in the DB immediately
            tx.status = "completed";
            tx.endTime = new Date();
            const energyUsed = tx.energyUsed || 0;
            const { pricePerKwh, convenienceFee, tax } = calculateCurrentRate(station, new Date());
            tx.appliedPrice = pricePerKwh;
            tx.convenienceFee = convenienceFee;
            tx.tax = tax;
            tx.cost = energyUsed * pricePerKwh + convenienceFee + tax;
            await tx.save();

            const session = await Session.findOne({ $or: [{ _id: tx.sessionId }, { orderId: tx.orderId }, { paymentId: tx.paymentId }] });
            if (session) {
                session.status = "completed";
                session.endTime = new Date();
                session.cost = tx.cost;
                session.energyUsed = energyUsed;
                await session.save();
            }

            const Payment = (await import("../models/Payment.js")).default;
            const payment = await Payment.findOne({ $or: [{ sessionId: tx.sessionId }, { orderId: tx.orderId }, { paymentId: tx.paymentId }] });
            if (payment) {
                payment.status = "completed";
                payment.actualAmount = tx.cost;
                await payment.save();
            }

            // Emit live transaction stop update
            ocpp?.io?.emit("transaction_update", {
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

        // 2. Create Fault record
        const fault = new Fault({
            stationId: station._id,
            userId: req.user ? req.user.id : null,
            sessionId: sessionId,
            type: mappedType,
            faultCode,
            faultName: mappedName,
            source: "SIMULATION",
            severity,
            message: mappedMessage,
            status: "ACTIVE",
            timestamp: new Date(),
        });
        await fault.save();

        // 3. Create Alert record
        const alert = new Alert({
            type: "FAULT",
            title: `${mappedName} Detected`,
            stationId: station._id,
            severity: "HIGH",
            source: "SIMULATION",
            timestamp: new Date(),
            status: "ACTIVE"
        });
        await alert.save();

        // 4. Update Station & Connector Status
        station.status = "Faulted";
        station.faultStatus = mappedType;
        if (station.connectors && station.connectors.length > 0) {
            const conn = station.connectors.find(c => c.connectorId === 1);
            if (conn) {
                conn.status = "Faulted";
                conn.errorCode = faultCode;
                conn.updatedAt = new Date();
            }
        }
        await station.save();

        // 5. Emit Real-time Socket Updates
        const ocpp = req.ocppCentralSystem;
        if (ocpp?.io) {
            ocpp.io.emit("station_update", {
                stationId: station._id,
                stationNumber: station.stationNumber,
                status: "Faulted",
                connectorId: 1,
                connectorStatus: "Faulted",
                errorCode: faultCode
            });

            ocpp.io.emit("fault_alert", {
                stationId: station._id,
                stationNumber: station.stationNumber,
                faultId: fault._id,
                type: fault.type,
                message: fault.message,
                severity: fault.severity,
                createdAt: fault.createdAt,
            });
        }

        res.status(201).json({ message: "Fault simulated successfully", fault, alert });
    } catch (err) {
        console.error("Simulation fault error:", err);
        res.status(500).json({ error: err.message });
    }
};

export const resolveFault = async (req, res) => {
    try {
        const { id } = req.params;
        const fault = await Fault.findById(id);

        if (!fault) return res.status(404).json({ error: "Fault not found" });

        fault.status = "RESOLVED";
        fault.resolvedAt = new Date();
        await fault.save();

        // Also mark any Alerts for this station as RESOLVED
        await Alert.updateMany({ stationId: fault.stationId, status: "ACTIVE" }, { status: "RESOLVED" });

        // Restore Station and Connector
        const station = await Station.findById(fault.stationId);
        if (station) {
            station.status = "online";
            station.faultStatus = "none";
            if (station.connectors && station.connectors.length > 0) {
                const conn = station.connectors.find(c => c.connectorId === 1);
                if (conn) {
                    conn.status = "Available";
                    conn.errorCode = "NoError";
                    conn.updatedAt = new Date();
                }
            }
            await station.save();

            req.ocppCentralSystem?.io?.emit("station_update", {
                stationId: station._id,
                stationNumber: station.stationNumber,
                status: "online",
                connectorId: 1,
                connectorStatus: "Available",
                errorCode: "NoError"
            });
        }

        res.json(fault);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
