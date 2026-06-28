import mongoose from "mongoose";

const sessionSchema = new mongoose.Schema({
    stationId: { type: mongoose.Schema.Types.ObjectId, ref: "Station", required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    startTime: { type: Date, required: true },
    endTime: { type: Date },
    energyUsed: { type: Number, default: 0 },
    cost: { type: Number, default: 0 },
    appliedPrice: { type: Number, default: 0 },
    convenienceFee: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    status: { type: String, enum: ["active", "completed", "FAULT_PAUSED"], default: "active" },
    connectorId: { type: Number },
    paymentId: { type: String },
    orderId: { type: String },
    sessionId: { type: String }
});

export default mongoose.model("Session", sessionSchema);