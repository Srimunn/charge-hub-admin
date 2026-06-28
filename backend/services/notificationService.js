import { GoogleAuth } from "google-auth-library";
import Notification from "../models/Notification.js";
import User from "../models/User.js";

// Global OTP memory store (using Map as fallback)
export const otpStore = new Map();

// Local Socket.io instance reference
let ioInstance = null;

export const setIoInstance = (io) => {
    ioInstance = io;
    console.log("📡 Notification Service successfully linked with Socket.io");
};

/**
 * Get Access Token for Firebase Cloud Messaging using Google Auth Library
 */
const getFcmAccessToken = async () => {
    const serviceAccountStr = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (!serviceAccountStr) return null;

    try {
        const credentials = JSON.parse(serviceAccountStr);
        const auth = new GoogleAuth({
            credentials,
            scopes: ["https://www.googleapis.com/auth/firebase.messaging"],
        });
        const client = await auth.getClient();
        const tokenResponse = await client.getAccessToken();
        return tokenResponse.token;
    } catch (err) {
        console.error("❌ Error fetching FCM access token:", err.message);
        return null;
    }
};

/**
 * Dispatch Transactional Email via Resend API
 */
export const sendEmail = async (to, subject, text, html) => {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
        console.log(`✉️ [MOCK EMAIL] To: ${to} | Subject: ${subject}`);
        console.log(`   Text: ${text}`);
        return { mock: true, success: true };
    }

    try {
        const from = process.env.EMAIL_FROM || "onboarding@resend.dev";
        const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({ from, to: [to], subject, text, html }),
        });

        if (!res.ok) {
            const errText = await res.text();
            throw new Error(`Resend API returned error status ${res.status}: ${errText}`);
        }

        const data = await res.json();
        console.log(`✅ Email sent successfully via Resend to ${to} (ID: ${data.id})`);
        return { success: true, id: data.id };
    } catch (err) {
        console.error(`❌ Failed to send email to ${to} via Resend:`, err.message);
        return { success: false, error: err.message };
    }
};

/**
 * Send Transactional SMS via MSG91 API
 */
export const sendSMS = async (mobile, message) => {
    const authKey = process.env.MSG91_AUTH_KEY;
    const senderId = process.env.MSG91_SENDER_ID || "EVCHRG";
    const flowId = process.env.MSG91_SMS_FLOW_ID;

    if (!authKey) {
        console.log(`📱 [MOCK SMS] To: ${mobile} | Msg: ${message}`);
        return { mock: true, success: true };
    }

    try {
        // MSG91 Flow API structure
        const res = await fetch("https://control.msg91.com/api/v5/flow", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                authkey: authKey,
            },
            body: JSON.stringify({
                flow_id: flowId || "default_sms_flow",
                sender: senderId,
                recipients: [
                    {
                        mobiles: mobile.replace(/\+/g, ""), // MSG91 expects number without plus sign
                        message: message,
                    },
                ],
            }),
        });

        if (!res.ok) {
            const errText = await res.text();
            throw new Error(`MSG91 API error ${res.status}: ${errText}`);
        }

        const data = await res.json();
        console.log(`✅ SMS dispatched via MSG91 to ${mobile}`);
        return { success: true, response: data };
    } catch (err) {
        console.error(`❌ Failed to dispatch SMS to ${mobile} via MSG91:`, err.message);
        return { success: false, error: err.message };
    }
};

/**
 * Dispatch Push Notification via Firebase Cloud Messaging REST API
 */
export const sendPush = async (fcmToken, title, body, metadata = {}) => {
    if (!fcmToken) return { success: false, error: "No target FCM token" };

    const token = await getFcmAccessToken();
    const serviceAccountStr = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

    if (!token || !serviceAccountStr) {
        console.log(`🔔 [MOCK PUSH] Token: ${fcmToken.slice(0, 10)}... | Title: ${title} | Body: ${body}`);
        return { mock: true, success: true };
    }

    try {
        const credentials = JSON.parse(serviceAccountStr);
        const projectId = credentials.project_id;

        // Construct standardized FCM v1 payload
        const res = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
                message: {
                    token: fcmToken,
                    notification: { title, body },
                    data: Object.keys(metadata).reduce((acc, key) => {
                        acc[key] = String(metadata[key]);
                        return acc;
                    }, {}),
                },
            }),
        });

        if (!res.ok) {
            const errText = await res.text();
            throw new Error(`FCM API error ${res.status}: ${errText}`);
        }

        const data = await res.json();
        console.log(`✅ Push notification sent successfully to token ${fcmToken.slice(0, 10)}...`);
        return { success: true, name: data.name };
    } catch (err) {
        console.error("❌ Failed to send FCM push notification:", err.message);
        return { success: false, error: err.message };
    }
};

/**
 * Main Centralized Notification Dispatcher
 * Persists to DB, updates Socket.io real-time, and checks preferences for Email/SMS/Push
 */
export const sendNotification = async ({ userId, title, message, type, metadata = {} }) => {
    try {
        // 1. Persist notification to MongoDB
        const newNotif = new Notification({
            userId,
            title,
            message,
            type,
            metadata,
            read: false,
        });
        await newNotif.save();

        // 2. Emit Real-time Socket.io Update
        if (ioInstance) {
            // General broadcast
            ioInstance.emit("new_notification", newNotif);

            // Specific event-driven real-time updates
            if (type === "fault") {
                ioInstance.emit("new_fault", metadata);
            } else if (type === "payment") {
                ioInstance.emit("new_payment", metadata);
            } else if (type === "session_start") {
                ioInstance.emit("charging_started", metadata);
            } else if (type === "session_end") {
                ioInstance.emit("charging_completed", metadata);
            }
        }

        // If target user is not specified, resolve early (system-wide dashboard updates)
        if (!userId) {
            return { success: true, notificationId: newNotif._id };
        }

        // 3. Retrieve User Preferences
        const user = await User.findById(userId);
        if (!user) {
            console.log(`⚠️ User not found for ID: ${userId}. Skipping channels dispatch.`);
            return { success: true, notificationId: newNotif._id };
        }

        const prefs = user.notificationPreferences || {
            emailAlerts: true,
            smsAlerts: false,
            pushAlerts: true,
            faultAlerts: true,
            paymentAlerts: true,
        };

        const results = { dbId: newNotif._id };

        // 4. Dispatch to Email
        if (prefs.emailAlerts && user.email) {
            const htmlContent = `
                <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
                    <h2 style="color: #0f172a;">${title}</h2>
                    <p style="color: #475569; font-size: 16px; line-height: 1.6;">${message}</p>
                    <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
                    <p style="color: #94a3b8; font-size: 12px;">This is an automated message from the EV Charge Operator System.</p>
                </div>
            `;
            results.email = await sendEmail(user.email, title, message, htmlContent);
        }

        // 5. Dispatch to SMS
        if (prefs.smsAlerts && user.mobile) {
            results.sms = await sendSMS(user.mobile, `${title}: ${message}`);
        }

        // 6. Dispatch to Push
        if (prefs.pushAlerts && user.fcmToken) {
            results.push = await sendPush(user.fcmToken, title, message, metadata);
        }

        return { success: true, results };
    } catch (err) {
        console.error("❌ Notification Dispatcher encountered error:", err);
        return { success: false, error: err.message };
    }
};

/**
 * Handle OTP Sending for Verification, Password Changes, or Login
 */
export const dispatchOTP = async (email, mobile, userId) => {
    // Generate random 6-digit code
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

    // Store in global maps
    otpStore.set(email, {
        otp: otpCode,
        userId: userId,
        expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes
        attempts: 0,
        lastSentAt: Date.now(),
    });

    console.log(`[OTP] Dispatched verification code for ${email}: ${otpCode}`);

    // Send email alert
    await sendEmail(
        email,
        "EV Charge - Security Code",
        `Your verification OTP code is: ${otpCode}. It will expire in 5 minutes.`,
        `<div style="font-family: sans-serif; text-align: center; padding: 20px;">
            <h3>EV Charge Security Verification</h3>
            <p>Your verification OTP is:</p>
            <div style="font-size: 32px; font-weight: bold; letter-spacing: 0.2em; margin: 20px 0; color: #3b82f6;">${otpCode}</div>
            <p style="color: #64748b; font-size: 13px;">Expires in 5 minutes. Do not share this code with anyone.</p>
         </div>`
    );

    // Send SMS alert (if mobile provided)
    if (mobile) {
        await sendSMS(mobile, `Your EV Charge OTP code is ${otpCode}. Valid for 5 mins.`);
    }

    return otpCode;
};
