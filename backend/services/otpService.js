import crypto from "crypto";
import { eq } from "drizzle-orm";
import { db, schema } from "../db/index.js";

const OTP_TTL_MS = 5 * 60 * 1000;
const RESEND_COOLDOWN_MS = 30 * 1000;
export const MAX_OTP_ATTEMPTS = 5;

const hash = (code) =>
  crypto.createHmac("sha256", process.env.JWT_SECRET || "otp").update(String(code)).digest("hex");

const keyFor = (purpose, email) => `${purpose}:${String(email).toLowerCase()}`;

/** OTP_DEBUG=true returns codes in API responses – only for demos without SMS/email providers. */
export const otpDebugEnabled = () => process.env.OTP_DEBUG === "true";

/** Create (or replace) an OTP. Throws { status: 429 } if requested again too quickly. */
export const issueOtp = async ({ purpose, email, userId }) => {
  const key = keyFor(purpose, email);
  const [existing] = await db.select().from(schema.otpCodes).where(eq(schema.otpCodes.key, key)).limit(1);
  if (existing && Date.now() - existing.lastSentAt.getTime() < RESEND_COOLDOWN_MS) {
    const wait = Math.ceil((RESEND_COOLDOWN_MS - (Date.now() - existing.lastSentAt.getTime())) / 1000);
    const err = new Error(`Please wait ${wait} seconds before requesting a new OTP.`);
    err.status = 429;
    throw err;
  }
  const code = crypto.randomInt(100000, 1000000).toString();
  const row = {
    key,
    userId: String(userId),
    purpose,
    codeHash: hash(code),
    expiresAt: new Date(Date.now() + OTP_TTL_MS),
    attempts: 0,
    verified: false,
    lastSentAt: new Date(),
  };
  await db.insert(schema.otpCodes).values(row).onConflictDoUpdate({ target: schema.otpCodes.key, set: row });
  return code;
};

/**
 * Check an OTP. Returns { ok: true, userId } or { ok: false, error }.
 * `consume` deletes it on success; otherwise it is marked verified (for multi-step flows).
 */
export const checkOtp = async ({ purpose, email, code, consume = true }) => {
  const key = keyFor(purpose, email);
  const [row] = await db.select().from(schema.otpCodes).where(eq(schema.otpCodes.key, key)).limit(1);
  if (!row) return { ok: false, error: "No active OTP request found. Please request a new OTP." };
  if (row.expiresAt.getTime() < Date.now()) {
    await db.delete(schema.otpCodes).where(eq(schema.otpCodes.key, key));
    return { ok: false, error: "OTP has expired. Please request a new one." };
  }
  const a = Buffer.from(hash(code));
  const b = Buffer.from(row.codeHash);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    const attempts = row.attempts + 1;
    if (attempts >= MAX_OTP_ATTEMPTS) {
      await db.delete(schema.otpCodes).where(eq(schema.otpCodes.key, key));
      return { ok: false, error: "Too many failed attempts. Please request a new OTP." };
    }
    await db.update(schema.otpCodes).set({ attempts }).where(eq(schema.otpCodes.key, key));
    return { ok: false, error: `Incorrect OTP code. ${MAX_OTP_ATTEMPTS - attempts} attempts remaining.` };
  }
  if (consume) await db.delete(schema.otpCodes).where(eq(schema.otpCodes.key, key));
  else await db.update(schema.otpCodes).set({ verified: true }).where(eq(schema.otpCodes.key, key));
  return { ok: true, userId: row.userId };
};

export const isOtpVerified = async ({ purpose, email }) => {
  const [row] = await db
    .select()
    .from(schema.otpCodes)
    .where(eq(schema.otpCodes.key, keyFor(purpose, email)))
    .limit(1);
  return Boolean(row && row.verified && row.expiresAt.getTime() > Date.now());
};

export const clearOtp = async ({ purpose, email }) => {
  await db.delete(schema.otpCodes).where(eq(schema.otpCodes.key, keyFor(purpose, email)));
};
