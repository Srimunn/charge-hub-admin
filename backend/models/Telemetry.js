import mongoose from "mongoose";

const telemetrySchema = new mongoose.Schema({
    stationId: { type: String, required: true },
    sessionId: { type: mongoose.Schema.Types.ObjectId, ref: "Session" },
    voltage: Number,
    current: Number,
    power: Number,
    temperature: Number,
    energyConsumed: Number,
    timestamp: { type: Date, default: Date.now }
});

export default mongoose.model("Telemetry", telemetrySchema);
