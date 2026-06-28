import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: false },
    title: { type: String, required: true },
    message: { type: String, required: true },
    type: { 
        type: String, 
        enum: ["otp", "fault", "payment", "session_start", "session_end", "system", "general"],
        default: "general"
    },
    read: { type: Boolean, default: false },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    createdAt: { type: Date, default: Date.now }
}, { collection: "notifications" });

export default mongoose.model("Notification", notificationSchema);
