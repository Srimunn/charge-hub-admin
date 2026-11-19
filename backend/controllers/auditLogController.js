import { db, schema, newId } from "../db/index.js";
import { clientIp } from "../services/access.js";

export const logEvent = async (userId, action, req) => {
  try {
    if (!userId) return;
    const ipAddress = req ? clientIp(req) : "system";
    await db.insert(schema.auditLogs).values({ id: newId(), userId: String(userId), action, ipAddress });
  } catch (err) {
    console.error("❌ Failed to create Audit Log:", err.message);
  }
};
