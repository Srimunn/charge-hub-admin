import { OAuth2Client } from "google-auth-library";
import { eq, or, and, ne } from "drizzle-orm";
import { db, schema, newId } from "../db/index.js";
import { generateToken, hashPin, isValidPin, normalizeEmail } from "./authController.js";

const client = () => new OAuth2Client(process.env.GOOGLE_CLIENT_ID || "");

export const googleAuth = async (req, res) => {
  try {
    const { idToken } = req.body;
    if (!idToken) return res.status(400).json({ error: "Google ID Token is required" });
    if (!process.env.GOOGLE_CLIENT_ID) return res.status(500).json({ error: "Google sign-in is not configured" });

    const ticket = await client().verifyIdToken({ idToken, audience: process.env.GOOGLE_CLIENT_ID });
    const payload = ticket.getPayload();
    const googleId = payload?.sub;
    const email = normalizeEmail(payload?.email);
    if (!email) return res.status(400).json({ error: "Email not provided by Google" });
    if (payload?.email_verified === false) return res.status(400).json({ error: "Google email is not verified" });

    let [user] = await db
      .select()
      .from(schema.users)
      .where(or(eq(schema.users.googleId, googleId), eq(schema.users.email, email)))
      .limit(1);

    if (!user) {
      [user] = await db
        .insert(schema.users)
        .values({ id: newId(), name: payload?.name || email.split("@")[0], email, googleId, authProvider: "google", role: "customer" })
        .returning();
    } else if (!user.googleId) {
      [user] = await db
        .update(schema.users)
        .set({ googleId, authProvider: "google", updatedAt: new Date() })
        .where(eq(schema.users.id, user.id))
        .returning();
    }

    if (user.status === "blocked") return res.status(403).json({ error: "Account is blocked. Contact the administrator." });

    return res.status(200).json({
      _id: user.id,
      name: user.name,
      email: user.email,
      mobile: user.mobile || null,
      role: user.role,
      hasPin: Boolean(user.password),
      hasMobile: Boolean(user.mobile),
      hasProfileComplete: Boolean(user.mobile && user.password),
      sessionTimeout: user.sessionTimeout,
      token: generateToken(user.id),
    });
  } catch (err) {
    console.error("Google Auth Error:", err.message);
    return res.status(401).json({ error: "Google sign-in failed" });
  }
};

export const setPin = async (req, res) => {
  try {
    const { pin, mobile } = req.body;
    if (!isValidPin(pin)) return res.status(400).json({ error: "PIN must be exactly 6 digits" });
    if (!mobile) return res.status(400).json({ error: "Mobile number is required" });

    const [taken] = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(and(eq(schema.users.mobile, String(mobile)), ne(schema.users.id, req.user.id)))
      .limit(1);
    if (taken) return res.status(400).json({ error: "Mobile number is already registered by another user" });

    await db
      .update(schema.users)
      .set({ password: await hashPin(pin), mobile: String(mobile), updatedAt: new Date() })
      .where(eq(schema.users.id, req.user.id));
    return res.status(200).json({ message: "PIN and mobile registered successfully" });
  } catch (err) {
    console.error("Set PIN Error:", err.message);
    return res.status(500).json({ error: "Could not set PIN" });
  }
};
