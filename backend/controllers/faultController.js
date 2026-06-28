import Fault from '../models/Fault.js';
import Station from "../models/Station.js";
import Transaction from "../models/Transaction.js";
import Session from "../models/Session.js";
import Alert from "../models/Alert.js";
import { logEvent } from "./auditLogController.js";

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
        
        let query = {};
        if (stationIds.length > 0) {
            query = { stationId: { $in: stationIds } };
        } else {
            // For customers, return active faults in the system
            query = { status: { $in: ["active", "ACTIVE"] } };
        }

        const faults = await Fault.find(query)
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
        let mappedName = "Emergency Stop";
        let mappedMessage = "Emergency shutdown initiated by emergency stop button";
        let mappedType = "emergency stop";
        let severity = "high";

        if (faultCode === "OVER_TEMP" || faultCode === "TEMP_HIGH") {
            mappedName = "Over Temperature";
            mappedMessage = "Thermal sensor exceeded safe operating limit";
            mappedType = "overheat";
        } else if (faultCode === "CONNECTOR_FAILURE") {
            mappedName = "Connector Failure";
            mappedMessage = "Connector pin degradation or lock failure detected";
            mappedType = "connector failure";
        } else if (faultCode === "POWER_FAILURE") {
            mappedName = "Power Failure";
            mappedMessage = "Power grid instability or utility loss detected";
            mappedType = "power failure";
        } else if (faultCode === "VOLT_HIGH") {
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

        // 1. Pause charging session if active - status = FAULT_PAUSED
        const tx = await Transaction.findOne({ stationId: station._id, status: "active" });
        let sessionId = null;

        if (tx) {
            sessionId = tx.sessionId;
            tx.status = "FAULT_PAUSED";
            await tx.save();

            const session = await Session.findOne({ $or: [{ _id: tx.sessionId }, { orderId: tx.orderId }, { paymentId: tx.paymentId }] });
            if (session) {
                session.status = "FAULT_PAUSED";
                await session.save();
            }
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
        station.status = "FAULT";
        station.faultStatus = mappedType;
        station.health = "WARNING";
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
                status: "FAULT",
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

            // Trigger transaction_update to refresh the live session card instantly on the frontend
            ocpp.io.emit("transaction_update", {
                stationId: station._id,
                stationNumber: station.stationNumber,
                status: "FAULT_PAUSED"
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

        const previousStatus = fault.status;
        fault.status = "RESOLVED";
        fault.resolvedAt = new Date();
        fault.resolvedBy = req.user?.id || req.user?._id;
        await fault.save();

        // Check if there are any remaining ACTIVE faults for that station
        const activeFaultCount = await Fault.countDocuments({
            stationId: fault.stationId,
            status: { $in: ["active", "ACTIVE"] }
        });

        const station = await Station.findById(fault.stationId);
        let newStationStatus = "online";
        let newConnectorStatus = "Available";
        let newErrorCode = "NoError";

        if (station) {
            if (activeFaultCount === 0) {
                // Check if there was an active transaction paused due to fault
                const tx = await Transaction.findOne({ stationId: station._id, status: "FAULT_PAUSED" });
                let hasActiveCharging = false;
                
                if (tx) {
                    tx.status = "active";
                    await tx.save();
                    
                    const session = await Session.findOne({ $or: [{ _id: tx.sessionId }, { orderId: tx.orderId }, { paymentId: tx.paymentId }] });
                    if (session) {
                        session.status = "active";
                        await session.save();
                    }
                    hasActiveCharging = true;
                }

                station.status = hasActiveCharging ? "charging" : "online";
                station.faultStatus = "none";
                station.health = "NORMAL";
                station.lastResolvedAt = new Date();

                if (station.connectors && station.connectors.length > 0) {
                    const conn = station.connectors.find(c => c.connectorId === 1);
                    if (conn) {
                        conn.status = hasActiveCharging ? "Charging" : "Available";
                        conn.errorCode = "NoError";
                        conn.updatedAt = new Date();
                    }
                }
                newStationStatus = station.status;
                newConnectorStatus = hasActiveCharging ? "Charging" : "Available";
                
                // Mark any ACTIVE Alerts for this station as RESOLVED
                await Alert.updateMany({ stationId: fault.stationId, status: "ACTIVE" }, { status: "RESOLVED" });
            } else {
                newStationStatus = "FAULT";
                newConnectorStatus = "Faulted";
                
                // Find another active fault to map the faultStatus and faultCode
                const nextActiveFault = await Fault.findOne({
                    stationId: fault.stationId,
                    status: { $in: ["active", "ACTIVE"] }
                });
                
                station.status = "FAULT";
                station.faultStatus = nextActiveFault ? nextActiveFault.type : "Faulted";
                station.health = "WARNING";

                if (station.connectors && station.connectors.length > 0) {
                    const conn = station.connectors.find(c => c.connectorId === 1);
                    if (conn) {
                        conn.status = "Faulted";
                        conn.errorCode = nextActiveFault ? nextActiveFault.faultCode : "Faulted";
                        newErrorCode = conn.errorCode;
                        conn.updatedAt = new Date();
                    }
                }
            }
            
            await station.save();

            // Emit Real-time OCPP and dashboard updates
            const ocpp = req.ocppCentralSystem;
            if (ocpp?.io) {
                // 1. Emit station_status_updated (required by spec)
                ocpp.io.emit("station_status_updated", {
                    stationId: station._id,
                    stationNumber: station.stationNumber,
                    status: station.status,
                    health: station.health,
                    lastResolvedAt: station.lastResolvedAt,
                    activeFaultCount
                });

                // 2. Emit standard station_update
                ocpp.io.emit("station_update", {
                    stationId: station._id,
                    stationNumber: station.stationNumber,
                    status: station.status,
                    health: station.health,
                    faultStatus: station.faultStatus,
                    connectorId: 1,
                    connectorStatus: newConnectorStatus,
                    errorCode: newErrorCode
                });

                // 3. Emit fault_resolved for frontend cache invalidation
                ocpp.io.emit("fault_resolved", {
                    faultId: fault._id,
                    stationId: station._id,
                    stationNumber: station.stationNumber,
                    activeFaultCount
                });

                // 4. Trigger transaction_update to refresh charging state instantly on live sessions page
                ocpp.io.emit("transaction_update", {
                    stationId: station._id,
                    stationNumber: station.stationNumber,
                    status: activeFaultCount === 0 ? "active" : "FAULT_PAUSED"
                });
            }
        }

        // Store Audit Log event
        const actionMessage = `Fault Resolved | Fault ID: ${fault._id} | Station ID: ${fault.stationId} | Resolved By: ${req.user?.id || req.user?._id} | Previous Status: ${previousStatus} | New Status: ${activeFaultCount === 0 ? "AVAILABLE" : "FAULTED"}`;
        await logEvent(req.user?.id || req.user?._id, actionMessage, req);

        res.json(fault);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

export const getAlerts = async (req, res) => {
    try {
        const stations = await Station.find({ userId: req.user.id }).select("_id");
        const stationIds = stations.map((s) => s._id);
        
        let query = {};
        if (stationIds.length > 0) {
            query = { stationId: { $in: stationIds } };
        } else {
            // For customers, return active alerts in the system
            query = { status: { $in: ["active", "ACTIVE"] } };
        }

        const alerts = await Alert.find(query)
            .populate("stationId")
            .sort({ timestamp: -1 });
        res.json(alerts);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
