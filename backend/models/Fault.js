import mongoose from "mongoose";

const faultSchema = new mongoose.Schema({
    stationId: { type: mongoose.Schema.Types.ObjectId, ref: "Station", required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    sessionId: { type: mongoose.Schema.Types.ObjectId, ref: "Session" },
    type: { type: String, required: true },
    faultCode: { type: String },
    faultName: { type: String },
    source: { type: String, enum: ["SIMULATION", "HARDWARE"], default: "SIMULATION" },
    severity: { type: String, default: "low" },
    message: { type: String },
    status: { type: String, enum: ["active", "resolved", "ACTIVE", "RESOLVED"], default: "active" },
    raw: { type: mongoose.Schema.Types.Mixed },
    createdAt: { type: Date, default: Date.now },
    timestamp: { type: Date, default: Date.now },
    resolvedAt: { type: Date },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
}, { collection: "faults_alerts" });

export default mongoose.model("Fault", faultSchema);
