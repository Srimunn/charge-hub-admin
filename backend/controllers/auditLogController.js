import AuditLog from "../models/AuditLog.js";

export const logEvent = async (userId, action, req) => {
    try {
        const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress || "127.0.0.1";
        // If x-forwarded-for is a list of IPs, get the first one
        const clientIp = typeof ipAddress === "string" ? ipAddress.split(",")[0].trim() : ipAddress;
        
        await AuditLog.create({
            userId,
            action,
            ipAddress: clientIp
        });
        console.log(`📝 [Audit Log] User ${userId} performed: ${action} from IP ${clientIp}`);
    } catch (err) {
        console.error("❌ Failed to create Audit Log:", err);
    }
};
