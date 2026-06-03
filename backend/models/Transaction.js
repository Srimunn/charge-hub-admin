import mongoose from "mongoose";

const transactionSchema = new mongoose.Schema(
  {
    stationId: { type: mongoose.Schema.Types.ObjectId, ref: "Station", required: true },
    stationNumber: { type: String, required: true },
    connectorId: { type: Number, default: 0 },
    ocppTransactionId: { type: Number, required: true, index: true },
    idTag: { type: String, required: true },
    meterStart: { type: Number, default: 0 },
    meterStop: { type: Number },
    startTime: { type: Date, required: true },
    endTime: { type: Date },
    status: { type: String, enum: ["active", "completed"], default: "active" },
    stopRequestedAt: { type: Date },
    energyUsed: { type: Number },
    cost: { type: Number },
    appliedPrice: { type: Number },
    convenienceFee: { type: Number },
    tax: { type: Number },
    paymentId: { type: String },
    orderId: { type: String },
    sessionId: { type: String },
  },
  { timestamps: true, collection: "transactions" }
);

transactionSchema.index({ stationId: 1, ocppTransactionId: 1 }, { unique: true });

export default mongoose.model("Transaction", transactionSchema);
