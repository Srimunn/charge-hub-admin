import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    stationId: { type: mongoose.Schema.Types.ObjectId, ref: "Station", required: true },
    sessionId: { type: mongoose.Schema.Types.ObjectId, ref: "Session" },
    orderId: { type: String, required: true }, // Razorpay Order ID
    paymentId: { type: String }, // Razorpay Payment ID
    signature: { type: String }, // Razorpay Signature
    amount: { type: Number, required: true },
    currency: { type: String, default: "INR" },
    tax: { type: Number, default: 0 },
    convenienceFee: { type: Number, default: 0 },
    energyCost: { type: Number, required: true },
    totalAmount: { type: Number, required: true },
    estimatedAmount: { type: Number },
    actualAmount: { type: Number },
    refundAmount: { type: Number },
    extraAmount: { type: Number },
    refundId: { type: String },
    refundTimestamp: { type: Date },
    status: { 
        type: String, 
        enum: ["pending", "paid", "charging", "completed", "pending_refund", "refunded", "failed"],
        default: "pending" 
    }
}, { timestamps: true });

export default mongoose.model("Payment", paymentSchema);