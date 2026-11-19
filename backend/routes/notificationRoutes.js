import express from "express";
import { and, count, desc, eq, gte, inArray } from "drizzle-orm";
import { protect } from "../middleware/authMiddleware.js";
import { db, schema, newId, toApi } from "../db/index.js";
import { sendNotification } from "../services/notificationService.js";

const router = express.Router();
const N = schema.notifications;

// GET /api/notifications?page=&limit=
router.get("/", protect, async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 100);
    const rows = await db
      .select()
      .from(N)
      .where(eq(N.userId, req.user.id))
      .orderBy(desc(N.createdAt))
      .limit(limit)
      .offset((page - 1) * limit);
    res.status(200).json(rows.map((r) => toApi(r)));
  } catch (err) {
    res.status(500).json({ error: "Failed to load notifications" });
  }
});

// GET /api/notifications/stats
router.get("/stats", protect, async (req, res) => {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const mine = eq(N.userId, req.user.id);
    const countWhere = async (where) => (await db.select({ c: count() }).from(N).where(where))[0].c;

    const totalNotifications = await countWhere(mine);
    const sentToday = await countWhere(and(mine, gte(N.createdAt, todayStart)));
    const unread = await countWhere(and(mine, eq(N.read, false)));
    const emailCount = await countWhere(and(mine, inArray(N.type, ["session_start", "session_end", "payment", "fault"])));
    const smsCount = await countWhere(and(mine, eq(N.type, "otp")));
    const pushCount = await countWhere(and(mine, inArray(N.type, ["fault", "payment", "session_start", "session_end"])));

    res.status(200).json({
      totalNotifications,
      sentToday,
      unread,
      failedNotifications: 0,
      smsStatistics: { total: smsCount, delivered: smsCount, failed: 0 },
      emailStatistics: { total: emailCount, sent: emailCount, failed: 0 },
      pushStatistics: { total: pushCount, sent: pushCount, failed: 0 },
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to load notification stats" });
  }
});

// POST /api/notifications/send – send a test notification to yourself
router.post("/send", protect, async (req, res) => {
  try {
    const { title, message, type, metadata } = req.body;
    if (!title || !message) return res.status(400).json({ error: "Title and message are required" });
    const allowed = ["fault", "payment", "session_start", "session_end", "system", "general"];
    const result = await sendNotification({
      userId: req.user.id,
      title: String(title).slice(0, 200),
      message: String(message).slice(0, 2000),
      type: allowed.includes(type) ? type : "general",
      metadata: metadata && typeof metadata === "object" ? metadata : {},
    });
    if (!result.success) return res.status(500).json({ error: result.error });
    res.status(201).json(result);
  } catch (err) {
    res.status(500).json({ error: "Could not send notification" });
  }
});

// PUT /api/notifications/read { notificationIds?: string[] }
router.put("/read", protect, async (req, res) => {
  try {
    const { notificationIds } = req.body;
    const where =
      Array.isArray(notificationIds) && notificationIds.length > 0
        ? and(eq(N.userId, req.user.id), inArray(N.id, notificationIds.map(String)))
        : and(eq(N.userId, req.user.id), eq(N.read, false));
    await db.update(N).set({ read: true }).where(where);
    res.status(200).json({ success: true, message: "Notifications updated successfully" });
  } catch (err) {
    res.status(500).json({ error: "Could not update notifications" });
  }
});

// PUT /api/notifications/preferences
router.put("/preferences", protect, async (req, res) => {
  try {
    const keys = ["emailAlerts", "smsAlerts", "pushAlerts", "faultAlerts", "paymentAlerts"];
    const prefs = { ...(req.user.notificationPreferences || {}) };
    for (const k of keys) if (typeof req.body[k] === "boolean") prefs[k] = req.body[k];
    const [updated] = await db
      .update(schema.users)
      .set({ notificationPreferences: prefs, updatedAt: new Date() })
      .where(eq(schema.users.id, req.user.id))
      .returning({ notificationPreferences: schema.users.notificationPreferences });
    res.status(200).json(updated.notificationPreferences);
  } catch (err) {
    res.status(500).json({ error: "Could not update preferences" });
  }
});

// POST /api/notifications/register-device { deviceToken|token, platform, appVersion }
router.post("/register-device", protect, async (req, res) => {
  try {
    const actualToken = req.body.deviceToken || req.body.token;
    if (!actualToken) return res.status(400).json({ error: "Device token is required" });
    const values = {
      userId: req.user.id,
      platform: req.body.platform || "android",
      appVersion: req.body.appVersion || "1.0.0",
      updatedAt: new Date(),
    };
    await db
      .insert(schema.deviceTokens)
      .values({ id: newId(), deviceToken: String(actualToken), ...values })
      .onConflictDoUpdate({ target: schema.deviceTokens.deviceToken, set: values });
    await db.update(schema.users).set({ fcmToken: String(actualToken) }).where(eq(schema.users.id, req.user.id));
    res.status(200).json({ success: true, message: "Device token registered successfully" });
  } catch (err) {
    res.status(500).json({ error: "Could not register device" });
  }
});

// DELETE /api/notifications/unregister-device
router.delete("/unregister-device", protect, async (req, res) => {
  try {
    const actualToken = req.body?.deviceToken || req.body?.token;
    const D = schema.deviceTokens;
    if (actualToken) await db.delete(D).where(and(eq(D.deviceToken, String(actualToken)), eq(D.userId, req.user.id)));
    else await db.delete(D).where(eq(D.userId, req.user.id));
    if (!actualToken || req.user.fcmToken === actualToken) {
      await db.update(schema.users).set({ fcmToken: "" }).where(eq(schema.users.id, req.user.id));
    }
    res.status(200).json({ success: true, message: "Device token unregistered successfully" });
  } catch (err) {
    res.status(500).json({ error: "Could not unregister device" });
  }
});

export default router;
