import mongoose from "mongoose";

const alertSchema = new mongoose.Schema({
    type: { type: String, default: "FAULT" },
    title: { type: String, required: true },
    stationId: { type: mongoose.Schema.Types.ObjectId, ref: "Station", required: true },
    severity: { type: String, enum: ["LOW", "MEDIUM", "HIGH"], default: "HIGH" },
    source: { type: String, default: "SIMULATION" },
    timestamp: { type: Date, default: Date.now },
    status: { type: String, enum: ["ACTIVE", "RESOLVED"], default: "ACTIVE" }
}, { collection: "alerts" });

export default mongoose.model("Alert", alertSchema);
