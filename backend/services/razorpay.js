import crypto from "crypto";
import Razorpay from "razorpay";

let instance = null;

export const razorpayConfigured = () => Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);

/**
 * Demo mode: lets the mobile app complete payments without Razorpay (orders `order_demo_*`,
 * payments `pay_mock_*`). Only active when PAYMENTS_DEMO_MODE=true — never enable in production.
 */
export const paymentsDemoMode = () => process.env.PAYMENTS_DEMO_MODE === "true";

export const getRazorpay = () => {
  if (!razorpayConfigured()) throw new Error("Razorpay configuration missing");
  if (!instance) {
    instance = new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET });
  }
  return instance;
};

const safeEqualHex = (a, b) => {
  const ab = Buffer.from(String(a || ""));
  const bb = Buffer.from(String(b || ""));
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
};

export const verifyCheckoutSignature = (orderId, paymentId, signature) => {
  if (!process.env.RAZORPAY_KEY_SECRET) return false;
  const expected = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");
  return safeEqualHex(expected, signature);
};

/** Webhook signature must be computed over the exact raw request body. */
export const verifyWebhookSignature = (rawBody, signature) => {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret || !rawBody) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  return safeEqualHex(expected, signature);
};

/**
 * Refund `amount` (₹) of a captured payment.
 * Returns { ok: true, refundId } or { ok: false, error }. Demo payments refund instantly.
 */
export const refundPayment = async (paymentId, amount, notes = {}) => {
  if (!paymentId) return { ok: false, error: "No payment id" };
  if (String(paymentId).startsWith("pay_mock_")) {
    return { ok: true, refundId: `ref_demo_${crypto.randomBytes(5).toString("hex")}`, demo: true };
  }
  try {
    const refund = await getRazorpay().payments.refund(paymentId, { amount: Math.round(amount * 100), notes });
    return { ok: true, refundId: refund.id };
  } catch (err) {
    const message = err?.error?.description || err?.message || "Refund failed";
    console.error("❌ Razorpay refund error:", message);
    return { ok: false, error: message };
  }
};
