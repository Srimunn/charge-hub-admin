import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { eq, or } from "drizzle-orm";
import { db, schema, newId } from "../db/index.js";
import { logEvent } from "./auditLogController.js";
import { sendEmail, sendSMS } from "../services/notificationService.js";
import { issueOtp, checkOtp, isOtpVerified, clearOtp, otpDebugEnabled } from "../services/otpService.js";

export const generateToken = (id) => {
  if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET is not set in environment variables");
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "7d" });
};

export const hashPin = async (pin) => bcrypt.hash(String(pin), 10);
export const isValidPin = (pin) => typeof pin === "string" && /^\d{6}$/.test(pin);
export const normalizeEmail = (email) => String(email || "").trim().toLowerCase();
/** Emails listed in ADMIN_EMAILS (comma-separated) are platform admins. */
export const isAdminEmail = (email) =>
  (process.env.ADMIN_EMAILS || "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean).includes(normalizeEmail(email));
const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const otpEmailHtml = (heading, intro, code, color = "#3b82f6") => `
  <div style="font-family:sans-serif;text-align:center;padding:20px;max-width:500px;margin:auto;border:1px solid #eee;border-radius:12px">
    <h3 style="color:#0f172a">${heading}</h3>
    <p style="color:#475569;font-size:14px">${intro}</p>
    <div style="font-size:32px;font-weight:bold;letter-spacing:0.2em;margin:24px 0;color:${color}">${code}</div>
    <p style="color:#94a3b8;font-size:12px">This code expires in 5 minutes. Do not share it with anyone.</p>
  </div>`;

const authPayload = (user) => ({
  _id: user.id,
  name: user.name,
  email: user.email,
  mobile: user.mobile,
  role: user.role,
  token: generateToken(user.id),
});

export const registerUser = async (req, res) => {
  try {
    const { name, password, mobile } = req.body;
    const email = normalizeEmail(req.body.email);

    if (!name || !email || !password || !mobile) return res.status(400).json({ error: "Please add all fields" });
    if (!isValidEmail(email)) return res.status(400).json({ error: "Please enter a valid email address" });
    if (!isValidPin(password)) return res.status(400).json({ error: "PIN must be exactly 6 digits" });

    const [exists] = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(or(eq(schema.users.email, email), eq(schema.users.mobile, String(mobile))))
      .limit(1);
    if (exists) return res.status(400).json({ error: "User already exists with this email or mobile" });

    // Self-registration is for mobile-app customers. Owners/admins are created by an admin.
    const [user] = await db
      .insert(schema.users)
      .values({
        id: newId(),
        name: String(name).trim(),
        email,
        password: await hashPin(password),
        mobile: String(mobile),
        role: "customer",
      })
      .returning();

    const otpCode = await issueOtp({ purpose: "register", email, userId: user.id });
    await sendEmail(
      email,
      "EV Charge - Security Code for Account Registration",
      `Your account registration security code is: ${otpCode}. Valid for 5 minutes.`,
      otpEmailHtml("Welcome to EV Charge!", "Use this code to complete your registration:", otpCode)
    );
    await sendSMS(mobile, `Your EV Charge registration OTP is ${otpCode}. Valid for 5 mins.`);

    return res.status(201).json({
      message: "Registration successful. An OTP has been sent to your email and mobile.",
      ...(otpDebugEnabled() ? { otp: otpCode } : {}),
      user: { id: user.id, name: user.name, email: user.email, mobile: user.mobile },
    });
  } catch (err) {
    console.error("Register Error:", err.message);
    res.status(500).json({ error: "Registration failed. Please try again." });
  }
};

export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Please enter email/mobile and PIN" });

    const identifier = String(email).trim();
    const [user] = await db
      .select()
      .from(schema.users)
      .where(or(eq(schema.users.email, identifier.toLowerCase()), eq(schema.users.mobile, identifier)))
      .limit(1);

    const valid = user?.password ? await bcrypt.compare(String(password), user.password) : false;
    if (!user || !valid) return res.status(400).json({ error: "Invalid credentials" });
    if (user.status === "blocked") return res.status(403).json({ error: "Account is blocked. Contact the administrator." });

    await logEvent(user.id, "Login", req);
    return res.status(200).json(authPayload(user));
  } catch (err) {
    console.error("Login Error:", err.message);
    res.status(500).json({ error: "Login failed. Please try again." });
  }
};

export const verifyOTP = async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const { otp } = req.body;
    if (!email || !otp) return res.status(400).json({ error: "Email and OTP required" });

    const result = await checkOtp({ purpose: "register", email, code: otp });
    if (!result.ok) return res.status(400).json({ error: result.error });

    const [user] = await db.select().from(schema.users).where(eq(schema.users.id, result.userId)).limit(1);
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(authPayload(user));
  } catch (err) {
    console.error("OTP Verify Error:", err.message);
    res.status(500).json({ error: "OTP verification failed" });
  }
};

export const requestPasswordOTP = async (req, res) => {
  try {
    const email = req.user.email;
    let otpCode;
    try {
      otpCode = await issueOtp({ purpose: "change-password", email, userId: req.user.id });
    } catch (e) {
      if (e.status === 429) return res.status(400).json({ error: e.message });
      throw e;
    }
    await sendEmail(
      email,
      "EV Charge - Security Code for PIN Change",
      `Your PIN change security code is: ${otpCode}. It will expire in 5 minutes.`,
      otpEmailHtml("EV Charge Security Verification", "Your PIN change verification code is:", otpCode, "#ef4444")
    );
    if (req.user.mobile) await sendSMS(req.user.mobile, `Your EV Charge PIN change OTP is ${otpCode}. Valid for 5 mins.`);
    await logEvent(req.user.id, "OTP Sent", req);

    res.status(200).json({
      message: "OTP sent to your registered email and mobile number",
      ...(otpDebugEnabled() ? { otp: otpCode } : {}),
    });
  } catch (err) {
    console.error("Request Password OTP Error:", err.message);
    res.status(500).json({ error: "Could not send OTP" });
  }
};

export const verifyPasswordOTP = async (req, res) => {
  try {
    const { otp } = req.body;
    if (!otp) return res.status(400).json({ error: "OTP is required" });
    const result = await checkOtp({ purpose: "change-password", email: req.user.email, code: otp, consume: false });
    if (!result.ok) return res.status(400).json({ error: result.error });
    await logEvent(req.user.id, "OTP Verified", req);
    res.status(200).json({ message: "OTP verified successfully. You can now set your new PIN." });
  } catch (err) {
    console.error("Verify Password OTP Error:", err.message);
    res.status(500).json({ error: "OTP verification failed" });
  }
};

export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!isValidPin(newPassword)) return res.status(400).json({ error: "New PIN must be exactly 6 digits and numeric" });

    const [user] = await db.select().from(schema.users).where(eq(schema.users.id, req.user.id)).limit(1);
    if (!user) return res.status(404).json({ error: "User not found" });

    if (currentPassword) {
      if (currentPassword === newPassword) return res.status(400).json({ error: "New PIN cannot be the same as current PIN" });
      const ok = user.password ? await bcrypt.compare(String(currentPassword), user.password) : false;
      if (!ok) return res.status(400).json({ error: "Current PIN is incorrect" });
      await db.update(schema.users).set({ password: await hashPin(newPassword), updatedAt: new Date() }).where(eq(schema.users.id, user.id));
      await logEvent(user.id, "PIN Changed", req);
    } else {
      if (!(await isOtpVerified({ purpose: "change-password", email: user.email }))) {
        return res.status(400).json({ error: "OTP verification required before resetting PIN." });
      }
      await db.update(schema.users).set({ password: await hashPin(newPassword), updatedAt: new Date() }).where(eq(schema.users.id, user.id));
      await clearOtp({ purpose: "change-password", email: user.email });
      await logEvent(user.id, "PIN Reset via OTP", req);
    }
    res.status(200).json({ message: "Security PIN updated successfully." });
  } catch (err) {
    console.error("Change Password Error:", err.message);
    res.status(500).json({ error: "Could not update PIN" });
  }
};

export const updateSessionTimeout = async (req, res) => {
  try {
    const parsed = parseInt(req.body.timeout, 10);
    if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 24 * 60) {
      return res.status(400).json({ error: "Please provide a valid session timeout in minutes." });
    }
    await db.update(schema.users).set({ sessionTimeout: parsed, updatedAt: new Date() }).where(eq(schema.users.id, req.user.id));
    await logEvent(req.user.id, "Session Timeout Changed", req);
    res.status(200).json({ message: "Session timeout updated successfully.", sessionTimeout: parsed });
  } catch (err) {
    res.status(500).json({ error: "Could not update session timeout" });
  }
};

const maskEmail = (email) => {
  if (!email) return "";
  const [name, domain] = email.split("@");
  if (name.length <= 2) return `${name[0]}***@${domain}`;
  return `${name[0]}${"*".repeat(name.length - 2)}${name[name.length - 1]}@${domain}`;
};
const maskMobile = (mobile) => {
  if (!mobile) return "";
  const clean = mobile.replace(/\s+/g, "");
  if (clean.length <= 6) return clean;
  return `${clean.substring(0, 3)}XXXXXXX${clean.substring(clean.length - 3)}`;
};

export const getMe = async (req, res) => {
  const user = req.user;
  res.json({
    _id: user.id,
    name: user.name,
    email: user.email,
    mobile: user.mobile,
    role: user.role,
    maskedEmail: maskEmail(user.email),
    maskedMobile: maskMobile(user.mobile),
    sessionTimeout: user.sessionTimeout || 30,
    notificationPreferences: user.notificationPreferences,
  });
};
