import { GoogleAuth } from "google-auth-library";
import { eq } from "drizzle-orm";
import { db, schema, newId, toApi } from "../db/index.js";
import { emitToUser, getIo } from "./realtime.js";

// Kept for backwards compatibility with older imports; realtime.js owns the instance now.
export const setIoInstance = () => {};

const escapeHtml = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const getFcmAccessToken = async () => {
  const serviceAccountStr = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!serviceAccountStr) return null;
  try {
    const credentials = JSON.parse(serviceAccountStr);
    const auth = new GoogleAuth({ credentials, scopes: ["https://www.googleapis.com/auth/firebase.messaging"] });
    const client = await auth.getClient();
    const tokenResponse = await client.getAccessToken();
    return tokenResponse.token;
  } catch (err) {
    console.error("❌ Error fetching FCM access token:", err.message);
    return null;
  }
};

/** Transactional email via Resend. Without RESEND_API_KEY the email is skipped (logged without content). */
export const sendEmail = async (to, subject, text, html) => {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log(`✉️ [EMAIL SKIPPED – RESEND_API_KEY not set] To: ${to} | Subject: ${subject}`);
    return { skipped: true, success: false };
  }
  try {
    const from = process.env.EMAIL_FROM || "onboarding@resend.dev";
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ from, to: [to], subject, text, html }),
    });
    if (!res.ok) throw new Error(`Resend API returned ${res.status}: ${await res.text()}`);
    const data = await res.json();
    return { success: true, id: data.id };
  } catch (err) {
    console.error(`❌ Failed to send email via Resend:`, err.message);
    return { success: false, error: err.message };
  }
};

/** Transactional SMS via MSG91. Without MSG91_AUTH_KEY the SMS is skipped. */
export const sendSMS = async (mobile, message) => {
  const authKey = process.env.MSG91_AUTH_KEY;
  if (!authKey) {
    console.log(`📱 [SMS SKIPPED – MSG91_AUTH_KEY not set] To: ${String(mobile).slice(0, 4)}******`);
    return { skipped: true, success: false };
  }
  try {
    const res = await fetch("https://control.msg91.com/api/v5/flow", {
      method: "POST",
      headers: { "Content-Type": "application/json", authkey: authKey },
      body: JSON.stringify({
        flow_id: process.env.MSG91_SMS_FLOW_ID || "default_sms_flow",
        sender: process.env.MSG91_SENDER_ID || "EVCHRG",
        recipients: [{ mobiles: String(mobile).replace(/\+/g, ""), message }],
      }),
    });
    if (!res.ok) throw new Error(`MSG91 API error ${res.status}: ${await res.text()}`);
    return { success: true, response: await res.json() };
  } catch (err) {
    console.error(`❌ Failed to dispatch SMS via MSG91:`, err.message);
    return { success: false, error: err.message };
  }
};

/** Push notification via Firebase Cloud Messaging (HTTP v1). */
export const sendPush = async (fcmToken, title, body, metadata = {}) => {
  if (!fcmToken) return { success: false, error: "No target FCM token" };
  const serviceAccountStr = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const token = await getFcmAccessToken();
  if (!token || !serviceAccountStr) return { skipped: true, success: false };
  try {
    const { project_id: projectId } = JSON.parse(serviceAccountStr);
    const res = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        message: {
          token: fcmToken,
          notification: { title, body },
          data: Object.fromEntries(Object.entries(metadata || {}).map(([k, v]) => [k, String(v)])),
        },
      }),
    });
    if (!res.ok) throw new Error(`FCM API error ${res.status}: ${await res.text()}`);
    const data = await res.json();
    return { success: true, name: data.name };
  } catch (err) {
    console.error("❌ Failed to send FCM push notification:", err.message);
    return { success: false, error: err.message };
  }
};

const TYPE_EVENTS = {
  fault: "new_fault",
  payment: "new_payment",
  session_start: "charging_started",
  session_end: "charging_completed",
};

/**
 * Persist a notification, push it to the user's sockets, then email/SMS/push
 * according to the user's preferences.
 */
export const sendNotification = async ({ userId, title, message, type = "general", metadata = {} }) => {
  try {
    const [notif] = await db
      .insert(schema.notifications)
      .values({ id: newId(), userId: userId ? String(userId) : null, title, message, type, metadata, read: false })
      .returning();
    const apiNotif = toApi(notif);

    if (userId) {
      emitToUser(String(userId), "new_notification", apiNotif);
      if (TYPE_EVENTS[type]) emitToUser(String(userId), TYPE_EVENTS[type], metadata);
    } else {
      getIo()?.to("admin").emit("new_notification", apiNotif);
    }

    if (!userId) return { success: true, notificationId: notif.id };

    const [user] = await db.select().from(schema.users).where(eq(schema.users.id, String(userId))).limit(1);
    if (!user) return { success: true, notificationId: notif.id };

    const prefs = user.notificationPreferences || {};
    const results = { dbId: notif.id };
    const categoryAllowed =
      (type !== "fault" || prefs.faultAlerts !== false) && (type !== "payment" || prefs.paymentAlerts !== false);

    if (categoryAllowed && prefs.emailAlerts !== false && user.email) {
      const html = `<div style="font-family:sans-serif;max-width:600px;margin:auto;padding:20px;border:1px solid #eee;border-radius:8px">
        <h2 style="color:#0f172a">${escapeHtml(title)}</h2>
        <p style="color:#475569;font-size:16px;line-height:1.6">${escapeHtml(message)}</p>
        <hr style="border:0;border-top:1px solid #eee;margin:20px 0"/>
        <p style="color:#94a3b8;font-size:12px">This is an automated message from the Magnertia EV charging platform.</p></div>`;
      results.email = await sendEmail(user.email, title, message, html);
    }
    if (categoryAllowed && prefs.smsAlerts && user.mobile) {
      results.sms = await sendSMS(user.mobile, `${title}: ${message}`);
    }
    if (categoryAllowed && prefs.pushAlerts !== false) {
      const tokens = await db.select().from(schema.deviceTokens).where(eq(schema.deviceTokens.userId, user.id));
      if (tokens.length > 0) {
        results.push = [];
        for (const t of tokens) results.push.push(await sendPush(t.deviceToken, title, message, metadata));
      } else if (user.fcmToken) {
        results.push = await sendPush(user.fcmToken, title, message, metadata);
      }
    }
    return { success: true, notificationId: notif.id, results };
  } catch (err) {
    console.error("❌ Notification dispatcher error:", err.message);
    return { success: false, error: err.message };
  }
};

/** Fire-and-forget wrapper so a notification failure never breaks the main flow. */
export const notify = (args) => {
  sendNotification(args).catch((err) => console.error("❌ notify failed:", err.message));
};
