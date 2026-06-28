import mongoose from "mongoose";

const auditLogSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    action: { type: String, required: true },
    ipAddress: { type: String, required: true },
    timestamp: { type: Date, default: Date.now }
});

export default mongoose.model("AuditLog", auditLogSchema);
