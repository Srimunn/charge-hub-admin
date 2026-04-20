import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    sessionId: { type: mongoose.Schema.Types.ObjectId, ref: "Session" },
    amount: Number,
    status: String,
    method: String,
    createdAt: { type: Date, default: Date.now }
});

export default mongoose.model("Payment", paymentSchema);