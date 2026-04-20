import mongoose from "mongoose";

const faultSchema = new mongoose.Schema({
    stationId: { type: mongoose.Schema.Types.ObjectId, ref: "Station", required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    type: { type: String, required: true, enum: ["overheat", "disconnect", "power failure", "system error"] },
    severity: { type: String, enum: ["low", "medium", "high"], default: "low" },
    message: { type: String },
    status: { type: String, enum: ["active", "resolved"], default: "active" },
    createdAt: { type: Date, default: Date.now },
    resolvedAt: { type: Date }
});

export default mongoose.model("Fault", faultSchema);