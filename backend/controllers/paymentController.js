import crypto from "crypto";
import { and, desc, eq, inArray, isNull, lt } from "drizzle-orm";
import { db, schema, newId, toApi, sessionToApi } from "../db/index.js";
import { computeBill, stationRates } from "../services/pricing.js";
import {
  getRazorpay,
  razorpayConfigured,
  paymentsDemoMode,
  verifyCheckoutSignature,
  verifyWebhookSignature,
} from "../services/razorpay.js";
import { findStationById, refundFull, settlePayment } from "../services/chargingService.js";
import { operatorStationIds, stationScope, findManagedStation } from "../services/access.js";
import { notify } from "../services/notificationService.js";
import { emitToOperatorsAndUser } from "../services/realtime.js";
import { logEvent } from "./auditLogController.js";

const MAX_ENERGY_KWH = Number(process.env.MAX_PREPAID_ENERGY_KWH || 200);
const isOperator = (req) => ["admin", "owner"].includes(req.user?.role);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const setPayment = async (id, values, extraWhere) => {
  const where = extraWhere ? and(eq(schema.payments.id, id), extraWhere) : eq(schema.payments.id, id);
  const [row] = await db.update(schema.payments).set({ ...values, updatedAt: new Date() }).where(where).returning();
  return row || null;
};

const stationIsReachable = (ocpp, station) => station.simulated || ocpp?.isConnected(station.stationNumber);

// POST /api/payments/create-order { stationId, estimatedEnergyKwh }
export const createOrder = async (req, res) => {
  try {
    const { stationId } = req.body;
    const estimatedEnergyKwh = Number(req.body.estimatedEnergyKwh);
    if (!stationId || !Number.isFinite(estimatedEnergyKwh)) {
      return res.status(400).json({ error: "stationId and estimatedEnergyKwh are required" });
    }
    if (estimatedEnergyKwh <= 0 || estimatedEnergyKwh > MAX_ENERGY_KWH) {
      return res.status(400).json({ error: `estimatedEnergyKwh must be between 0 and ${MAX_ENERGY_KWH}` });
    }

    const station = await findStationById(stationId);
    if (!station) return res.status(404).json({ error: "Station not found" });
    if (["Faulted", "FAULT", "maintenance"].includes(station.status)) {
      return res.status(409).json({ error: "Station is not available right now" });
    }
    if (!stationIsReachable(req.ocppCentralSystem, station)) {
      return res.status(409).json({ error: "Station is offline. Please try another station." });
    }
    const [busy] = await db
      .select({ id: schema.chargingSessions.id })
      .from(schema.chargingSessions)
      .where(and(eq(schema.chargingSessions.stationId, station.id), inArray(schema.chargingSessions.status, ["active", "FAULT_PAUSED"])))
      .limit(1);
    if (busy) return res.status(409).json({ error: "Station is currently in use" });

    const rates = stationRates(station);
    if (rates.pricePerKwh <= 0) return res.status(409).json({ error: "Station pricing is not configured" });
    const bill = computeBill({ energyKwh: estimatedEnergyKwh, ...rates });
    if (bill.total < 1) return res.status(400).json({ error: "Order amount must be at least ₹1" });
    const amountInPaise = Math.round(bill.total * 100);

    let orderId;
    let keyId = process.env.RAZORPAY_KEY_ID;
    if (razorpayConfigured()) {
      const order = await getRazorpay().orders.create({
        amount: amountInPaise,
        currency: "INR",
        receipt: `rcpt_${Date.now()}_${req.user.id.slice(-6)}`,
        notes: { stationId: station.id, userId: req.user.id },
      });
      orderId = order.id;
    } else if (paymentsDemoMode()) {
      orderId = `order_demo_${crypto.randomBytes(8).toString("hex")}`;
      keyId = "demo";
    } else {
      return res.status(503).json({ error: "Payments are not configured" });
    }

    await db.insert(schema.payments).values({
      id: newId(),
      userId: req.user.id,
      stationId: station.id,
      orderId,
      amount: bill.total,
      currency: "INR",
      tax: bill.tax,
      taxPercent: rates.taxPercent,
      convenienceFee: bill.convenienceFee,
      energyCost: bill.energyCost,
      totalAmount: bill.total,
      estimatedAmount: bill.total,
      estimatedEnergyKwh,
      pricePerKwh: rates.pricePerKwh,
      status: "pending",
    });

    res.status(201).json({
      orderId,
      amount: bill.total,
      amountInPaise,
      currency: "INR",
      keyId,
      breakdown: { ...bill, pricePerKwh: rates.pricePerKwh, taxPercent: rates.taxPercent, estimatedEnergyKwh },
    });
  } catch (error) {
    console.error("❌ createOrder error:", error?.error?.description || error.message);
    res.status(500).json({ error: "Could not create payment order" });
  }
};

const findSessionForOrder = async (orderId) => {
  const [row] = await db.select().from(schema.chargingSessions).where(eq(schema.chargingSessions.orderId, orderId)).limit(1);
  return row || null;
};

// POST /api/payments/verify { razorpay_order_id, razorpay_payment_id, razorpay_signature }
export const verifyPayment = async (req, res) => {
  try {
    const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = req.body;
    if (!orderId || !paymentId || !signature) return res.status(400).json({ error: "Missing Razorpay payment details" });

    const [payment] = await db
      .select()
      .from(schema.payments)
      .where(and(eq(schema.payments.orderId, String(orderId)), eq(schema.payments.userId, req.user.id)))
      .limit(1);
    if (!payment) return res.status(404).json({ error: "Payment record not found" });

    const station = await findStationById(payment.stationId);

    // Idempotent: verifying again returns the current state instead of starting twice.
    if (payment.status !== "pending") {
      const session = await findSessionForOrder(payment.orderId);
      if (session) {
        const s = sessionToApi(session, station);
        return res.status(200).json({ message: "Payment already verified", payment: toApi(payment), session: s, transaction: s });
      }
      if (payment.status === "paid") return res.status(202).json({ message: "Payment verified; charging is starting", payment: toApi(payment) });
      return res.status(409).json({ error: `Payment is ${payment.status}`, payment: toApi(payment) });
    }

    const demo = paymentsDemoMode() && payment.orderId.startsWith("order_demo_") && String(paymentId).startsWith("pay_mock_");
    if (!demo && !verifyCheckoutSignature(payment.orderId, paymentId, signature)) {
      console.warn(`❌ verifyPayment: invalid signature for order ${payment.orderId}`);
      return res.status(400).json({ error: "Invalid payment signature" });
    }

    const paid = await setPayment(payment.id, { status: "paid", paymentId: String(paymentId), signature: String(signature) }, eq(schema.payments.status, "pending"));
    if (!paid) return res.status(409).json({ error: "Payment is already being processed" });

    notify({
      userId: paid.userId,
      title: "Payment Successful",
      message: `Your payment of ₹${paid.totalAmount.toFixed(2)} was successful. Order ID: ${paid.orderId}.`,
      type: "payment",
      metadata: { paymentId: paid.id, orderId: paid.orderId, amount: paid.totalAmount },
    });
    emitToOperatorsAndUser(station, paid.userId, "payment_update", toApi(paid));

    const ocpp = req.ocppCentralSystem;
    const fail = async (reason) => {
      // Claim the payment for refund only if charging has not started in the meantime.
      const claimed = await setPayment(paid.id, { status: "pending_refund" }, eq(schema.payments.status, "paid"));
      if (!claimed) return null;
      const { payment: refunded, refunded: ok } = await refundFull(claimed, reason, station);
      return res.status(400).json({
        error: ok
          ? `Charging could not start (${reason}). A full refund has been initiated.`
          : `Charging could not start (${reason}). Your refund is being processed.`,
        payment: toApi(refunded),
      });
    };

    if (!station) return fail("Station not found");
    if (station.simulated && !ocpp.isConnected(station.stationNumber)) {
      const sim = await import("../services/ocppSimulator.js");
      sim.simulateStation(station.stationNumber);
      for (let i = 0; i < 10 && !ocpp.isConnected(station.stationNumber); i++) await sleep(200);
    }
    if (!ocpp.isConnected(station.stationNumber)) return (await fail("Station not connected")) ?? res.status(200).json({ payment: toApi(paid) });

    try {
      const result = await ocpp.sendCall(station.stationNumber, "RemoteStartTransaction", { connectorId: 1, idTag: `user:${req.user.id}` });
      if (String(result?.status).toLowerCase() !== "accepted") {
        return (await fail("Charger rejected the start request")) ?? res.status(200).json({ payment: toApi(paid) });
      }
    } catch (e) {
      return (await fail(`Charger did not respond: ${e.message}`)) ?? res.status(200).json({ payment: toApi(paid) });
    }

    let session = null;
    for (let i = 0; i < 25 && !session; i++) {
      await sleep(300);
      session = await findSessionForOrder(paid.orderId);
    }
    if (!session) {
      const failed = await fail("Charger did not start the session in time");
      if (failed) return failed;
      session = await findSessionForOrder(paid.orderId); // started just in time
    }

    const [current] = await db.select().from(schema.payments).where(eq(schema.payments.id, paid.id)).limit(1);
    const s = sessionToApi(session, station);
    res.status(200).json({
      message: "Payment verified and charging session started successfully",
      payment: toApi(current),
      session: s,
      transaction: s,
    });
  } catch (error) {
    console.error("❌ verifyPayment error:", error.message);
    res.status(500).json({ error: "Payment verification failed" });
  }
};

// POST /api/payments/webhook (Razorpay → server, HMAC over raw body)
export const webhookHandler = async (req, res) => {
  try {
    if (!process.env.RAZORPAY_WEBHOOK_SECRET) {
      console.error("❌ RAZORPAY_WEBHOOK_SECRET not set – webhook rejected");
      return res.status(503).send("Webhook not configured");
    }
    if (!verifyWebhookSignature(req.rawBody, req.headers["x-razorpay-signature"])) {
      console.warn("❌ Webhook invalid signature");
      return res.status(400).send("Invalid signature");
    }

    const event = req.body?.event;
    const entity = req.body?.payload?.payment?.entity;
    if (entity?.order_id) {
      const [payment] = await db.select().from(schema.payments).where(eq(schema.payments.orderId, entity.order_id)).limit(1);
      if (payment) {
        const station = await findStationById(payment.stationId);
        if ((event === "payment.captured" || event === "payment.authorized") && payment.status === "pending") {
          // Money received but the app never called /verify; the stale-payment job refunds it if charging never starts.
          const p = await setPayment(payment.id, { status: "paid", paymentId: entity.id }, eq(schema.payments.status, "pending"));
          if (p) emitToOperatorsAndUser(station, p.userId, "payment_update", toApi(p));
        } else if (event === "payment.failed" && payment.status === "pending") {
          const p = await setPayment(payment.id, { status: "failed", paymentId: entity.id }, eq(schema.payments.status, "pending"));
          if (p) {
            emitToOperatorsAndUser(station, p.userId, "payment_update", toApi(p));
            notify({
              userId: p.userId,
              title: "Payment Failed",
              message: `Your payment for order ${p.orderId} of ₹${p.totalAmount.toFixed(2)} failed.`,
              type: "payment",
              metadata: { paymentId: p.id, orderId: p.orderId },
            });
          }
        }
      }
    }
    res.status(200).send("OK");
  } catch (error) {
    console.error("❌ webhookHandler error:", error.message);
    res.status(500).send("Internal Server Error");
  }
};

/** Payments with user + station populated (old Mongo shape). */
const withRelations = async (rows) => {
  const userIds = [...new Set(rows.map((r) => r.userId))];
  const stationIds = [...new Set(rows.map((r) => r.stationId))];
  const users = userIds.length
    ? await db.select({ id: schema.users.id, name: schema.users.name, email: schema.users.email }).from(schema.users).where(inArray(schema.users.id, userIds))
    : [];
  const stations = stationIds.length
    ? await db
        .select({ id: schema.stations.id, name: schema.stations.name, stationNumber: schema.stations.stationNumber })
        .from(schema.stations)
        .where(inArray(schema.stations.id, stationIds))
    : [];
  const u = new Map(users.map((x) => [x.id, toApi(x)]));
  const s = new Map(stations.map((x) => [x.id, toApi(x)]));
  return rows.map((r) => toApi(r, { userId: u.get(r.userId) || r.userId, stationId: s.get(r.stationId) || r.stationId }));
};

const paymentScope = async (req) => {
  if (req.query.scope === "user" || !isOperator(req)) return eq(schema.payments.userId, req.user.id);
  return stationScope(schema.payments.stationId, await operatorStationIds(req));
};

// GET /api/payments
export const getPayments = async (req, res) => {
  try {
    const where = await paymentScope(req);
    const limit = Math.min(Number(req.query.limit) || 500, 2000);
    const q = db.select().from(schema.payments);
    const rows = await (where ? q.where(where) : q).orderBy(desc(schema.payments.createdAt)).limit(limit);
    res.json(await withRelations(rows));
  } catch (err) {
    console.error("getPayments error:", err.message);
    res.status(500).json({ error: "Failed to load payments" });
  }
};

const findAccessiblePayment = async (req, condition) => {
  const scope = isOperator(req)
    ? stationScope(schema.payments.stationId, await operatorStationIds(req))
    : eq(schema.payments.userId, req.user.id);
  const [row] = await db.select().from(schema.payments).where(scope ? and(condition, scope) : condition).limit(1);
  return row ? (await withRelations([row]))[0] : null;
};

// GET /api/payments/:id
export const getPaymentById = async (req, res) => {
  try {
    const payment = await findAccessiblePayment(req, eq(schema.payments.id, String(req.params.id)));
    if (!payment) return res.status(404).json({ error: "Payment not found" });
    res.json(payment);
  } catch (err) {
    res.status(500).json({ error: "Failed to load payment" });
  }
};

// GET /api/payments/session/:sessionId
export const getPaymentBySessionId = async (req, res) => {
  try {
    const payment = await findAccessiblePayment(req, eq(schema.payments.sessionId, String(req.params.sessionId)));
    if (!payment) return res.status(404).json({ error: "Payment not found" });
    res.json(payment);
  } catch (err) {
    res.status(500).json({ error: "Failed to load payment" });
  }
};

// POST /api/payments/:id/retry-refund – operator retries a failed refund
export const retryRefund = async (req, res) => {
  try {
    const [payment] = await db.select().from(schema.payments).where(eq(schema.payments.id, String(req.params.id))).limit(1);
    if (!payment) return res.status(404).json({ error: "Payment not found" });
    const station = await findManagedStation(req, payment.stationId);
    if (!station) return res.status(404).json({ error: "Payment not found" });
    if (payment.status !== "refund_failed") return res.status(400).json({ error: "Only failed refunds can be retried" });

    let updated;
    if (payment.sessionId) updated = await settlePayment(payment, payment.actualAmount ?? 0, station);
    else updated = (await refundFull(payment, "retry", station)).payment;
    await logEvent(req.user.id, `Refund retried for order ${payment.orderId}`, req);
    res.json(toApi(updated));
  } catch (err) {
    console.error("retryRefund error:", err.message);
    res.status(500).json({ error: "Refund retry failed" });
  }
};

/**
 * Safety net: money captured but charging never started (app closed, charger offline…).
 * Refund paid payments with no session after 15 minutes. Runs periodically from server.js.
 */
export const refundStalePayments = async () => {
  const cutoff = new Date(Date.now() - 15 * 60 * 1000);
  const stale = await db
    .select()
    .from(schema.payments)
    .where(and(eq(schema.payments.status, "paid"), isNull(schema.payments.sessionId), lt(schema.payments.updatedAt, cutoff)));
  for (const p of stale) {
    const claimed = await setPayment(p.id, { status: "pending_refund" }, eq(schema.payments.status, "paid"));
    if (!claimed) continue;
    const station = await findStationById(p.stationId);
    console.log(`💸 Refunding stale payment ${p.orderId} (charging never started)`);
    await refundFull(claimed, "Charging did not start", station);
  }
  // Abandoned checkouts
  await db
    .update(schema.payments)
    .set({ status: "failed", updatedAt: new Date() })
    .where(and(eq(schema.payments.status, "pending"), lt(schema.payments.createdAt, new Date(Date.now() - 24 * 60 * 60 * 1000))));
};


