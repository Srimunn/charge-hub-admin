import mongoose from "mongoose";

const faultSchema = new mongoose.Schema({
    stationId: { type: mongoose.Schema.Types.ObjectId, ref: "Station", required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    type: { type: String, required: true, enum: ["overheat", "overvoltage", "disconnect", "emergency stop", "communication failure", "power fault"] },
    severity: { type: String, enum: ["low", "medium", "high"], default: "low" },
    message: { type: String },
    status: { type: String, enum: ["active", "resolved"], default: "active" },
    raw: { type: mongoose.Schema.Types.Mixed },
    createdAt: { type: Date, default: Date.now },
    resolvedAt: { type: Date }
}, { collection: "faults_alerts" });

export default mongoose.model("Fault", faultSchema);
