import Station from '../models/Station.js';
import Transaction from "../models/Transaction.js";
import Telemetry from "../models/Telemetry.js";

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

export const startSession = async (req, res) => {
    try {
        const { stationId } = req.body;
        if (!stationId) return res.status(400).json({ error: "stationId is required" });

        const station = await Station.findById(stationId);
        if (!station) return res.status(404).json({ error: "Station not found" });

        const ocpp = req.ocppCentralSystem;
        if (!ocpp) return res.status(500).json({ error: "OCPP Central System not available" });

        if (!ocpp.isConnected(station.stationNumber)) {
            console.log(`⚠️ Station ${station.stationNumber} is not connected. Attempting dynamic simulation connection...`);
            try {
                const ocppSimulator = await import("../services/ocppSimulator.js");
                ocppSimulator.simulateStation(station.stationNumber);
                // Give it a brief moment (800ms) to establish connection and register
                await new Promise((resolve) => setTimeout(resolve, 800));
            } catch (simErr) {
                console.error("❌ Failed to dynamically spin up OCPP simulator:", simErr.message);
            }
        }

        if (!ocpp.isConnected(station.stationNumber)) {
            return res.status(409).json({ error: "Station not connected via OCPP" });
        }


        const idTag = `user:${req.user.id}`;
        const result = await ocpp.sendCall(station.stationNumber, "RemoteStartTransaction", { connectorId: 1, idTag });
        
        // Poll for the asynchronously created OCPP Transaction record in MongoDB
        let tx = null;
        if (result && (result.status === "Accepted" || result.status === "accepted")) {
            console.log(`⏳ [startSession] Waiting for OCPP StartTransaction to register in MongoDB...`);
            for (let i = 0; i < 15; i++) {
                await new Promise((resolve) => setTimeout(resolve, 200));
                tx = await Transaction.findOne({
                    stationId: station._id,
                    idTag: idTag,
                    status: "active"
                });
                if (tx) {
                    console.log(`✅ [startSession] Transaction found in DB: ${tx._id} (OCPP Tx ID: ${tx.ocppTransactionId})`);
                    break;
                }
            }
        }

        if (tx) {
            // Return the created transaction record as the session object
            res.status(201).json(tx);
        } else {
            // Fail-safe fallback to prevent mobile app from failing navigation
            console.warn(`⚠️ [startSession] OCPP Transaction record was not created in time. Returning fallback session details.`);
            res.status(201).json({
                _id: `fallback_${Math.floor(Date.now() / 1000)}`,
                status: "accepted",
                stationId: station._id,
                stationNumber: station.stationNumber,
                result
            });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

export const stopSession = async (req, res) => {
    try {
        const { id } = req.params; // sessionId
        const query = id?.length === 24 ? { $or: [{ _id: id }, { sessionId: id }] } : { ocppTransactionId: Number(id) };
        const tx = await Transaction.findOne(query).populate("stationId");
        if (!tx) return res.status(404).json({ error: "Transaction not found" });
        if (tx.status === "completed") return res.status(400).json({ error: "Transaction already completed" });

        const station = tx.stationId;
        const ocpp = req.ocppCentralSystem;
        if (!ocpp) return res.status(500).json({ error: "OCPP Central System not available" });
        if (!ocpp.isConnected(tx.stationNumber)) return res.status(409).json({ error: "Station not connected via OCPP" });

        const result = await ocpp.sendCall(tx.stationNumber, "RemoteStopTransaction", { transactionId: tx.ocppTransactionId });

        tx.stopRequestedAt = new Date();
        await tx.save();

        res.json({ status: "accepted", transactionId: tx.ocppTransactionId, result });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

export const getSessions = async (req, res) => {
    try {
        const { scope } = req.query;
        let filter = {};
        if (scope === "user") {
            filter = { idTag: `user:${req.user.id}` };
        } else {
            const stations = await Station.find({ userId: req.user.id }).select("_id");
            const stationIds = stations.map((s) => s._id);
            filter = { stationId: { $in: stationIds } };
        }
        const transactions = await Transaction.find(filter).populate("stationId").sort({ startTime: -1 });
        res.json(transactions);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

export const getLiveSessions = async (req, res) => {
    try {
        const stations = await Station.find({ userId: req.user.id }).select("_id");
        const stationIds = stations.map((s) => s._id);
        const active = await Transaction.find({ stationId: { $in: stationIds }, status: { $in: ["active", "FAULT_PAUSED"] } }).populate("stationId").sort({ startTime: -1 });

        const Fault = (await import("../models/Fault.js")).default;
        const activeFaults = await Fault.find({ stationId: { $in: stationIds }, status: { $in: ["active", "ACTIVE"] } });
        const faultMap = new Map();
        for (const f of activeFaults) {
            faultMap.set(String(f.stationId), f);
        }

        const stationNumbers = active.map((t) => t.stationNumber);
        const latestTelemetry = await Telemetry.aggregate([
            { $match: { stationId: { $in: stationNumbers } } },
            { $sort: { timestamp: -1 } },
            { $group: { _id: { stationId: "$stationId", transactionId: "$transactionId" }, doc: { $first: "$$ROOT" } } }
        ]);

        const telIndex = new Map();
        for (const row of latestTelemetry) {
            const key = `${row._id.stationId}:${row._id.transactionId || ""}`;
            telIndex.set(key, row.doc);
        }

        const live = active.map((tx) => {
            const station = tx.stationId;
            const tel = telIndex.get(`${tx.stationNumber}:${tx.ocppTransactionId}`) || telIndex.get(`${tx.stationNumber}:`);
            const voltage = tel?.voltage ?? 0;
            const current = tel?.current ?? 0;
            const powerOutput = tel?.power ?? 0;
            const energyDelivered = tel?.energyConsumed ?? tx.energyUsed ?? 0;
            const temperature = tel?.temperature ?? 0;

            const sessionTimeSeconds = Math.max(Math.floor((Date.now() - new Date(tx.startTime).getTime()) / 1000), 0);
            const { pricePerKwh, convenienceFee, tax } = calculateCurrentRate(station, new Date());
            const chargingCost = energyDelivered * pricePerKwh + convenienceFee + tax;

            const connectorStatus = Array.isArray(station?.connectors)
                ? station.connectors.find((c) => Number(c.connectorId) === Number(tx.connectorId))?.status
                : undefined;

            const fault = station ? faultMap.get(String(station._id)) : undefined;

            return {
                id: String(tx._id),
                stationId: station ? String(station._id) : undefined,
                stationNumber: tx.stationNumber,
                userVehicleId: tx.idTag,
                connectorId: tx.connectorId,
                transactionId: tx.ocppTransactionId,
                voltage,
                current,
                powerOutput,
                chargingSpeed: powerOutput,
                energyDelivered,
                temperature,
                sessionTimeSeconds,
                chargingCost,
                connectorStatus: connectorStatus || "Unknown",
                chargingStatus: tx.status === "FAULT_PAUSED" ? "FAULT" : "Charging",
                sessionStatus: tx.status === "FAULT_PAUSED" ? "FAULT_PAUSED" : "ACTIVE",
                ocppStatus: station?.ocppConnected ? "Connected" : "Disconnected",
                faultType: fault ? fault.faultName || fault.type : undefined,
                faultMessage: fault ? fault.message : undefined,
                faultTime: fault ? fault.timestamp || fault.createdAt : undefined
            };
        });

        res.json(live);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
