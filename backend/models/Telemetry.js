import mongoose from "mongoose";

const telemetrySchema = new mongoose.Schema({
    stationId: { type: String, required: true },
    stationObjectId: { type: mongoose.Schema.Types.ObjectId, ref: "Station" },
    sessionId: { type: mongoose.Schema.Types.ObjectId, ref: "Session" },
    connectorId: Number,
    transactionId: Number,
    voltage: Number,
    current: Number,
    power: Number,
    temperature: Number,
    energyConsumed: Number,
    timestamp: { type: Date, default: Date.now }
}, { collection: "telemetry" });

export default mongoose.model("Telemetry", telemetrySchema);
