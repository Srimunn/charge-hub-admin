import { and, eq, desc, inArray, isNull, gte } from "drizzle-orm";
import { db, schema, round2, sessionToApi, toApi } from "../db/index.js";
import { computeBill, stationRates } from "./pricing.js";
import { refundPayment } from "./razorpay.js";
import { notify } from "./notificationService.js";
import { emitToOperatorsAndUser, emitToUser } from "./realtime.js";

/** idTag formats: "user:<id>" (paid customer session) and "operator:<id>" (owner/admin test start). */
export const userIdFromTag = (idTag) => {
  const m = /^(user|operator):(.+)$/.exec(String(idTag || ""));
  return m ? m[2] : null;
};

export const findStationByNumber = async (stationNumber) => {
  const [station] = await db
    .select()
    .from(schema.stations)
    .where(eq(schema.stations.stationNumber, String(stationNumber)))
    .limit(1);
  return station || null;
};

export const findStationById = async (id) => {
  const [station] = await db.select().from(schema.stations).where(eq(schema.stations.id, String(id))).limit(1);
  return station || null;
};

export const updateStation = async (id, values) => {
  const [row] = await db
    .update(schema.stations)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(schema.stations.id, id))
    .returning();
  return row;
};

export const setConnectorStatus = (connectors, connectorId, status, errorCode = "NoError") => {
  const list = Array.isArray(connectors) ? [...connectors] : [];
  const idx = list.findIndex((c) => Number(c.connectorId) === Number(connectorId));
  const entry = { connectorId: Number(connectorId), status, errorCode, updatedAt: new Date().toISOString() };
  if (idx >= 0) list[idx] = { ...list[idx], ...entry };
  else list.push(entry);
  return list;
};

/** Most recent paid, not-yet-used payment for this customer at this station (last 30 min). */
export const findPaidPayment = async (userId, stationId) => {
  const [payment] = await db
    .select()
    .from(schema.payments)
    .where(
      and(
        eq(schema.payments.userId, userId),
        eq(schema.payments.stationId, stationId),
        eq(schema.payments.status, "paid"),
        isNull(schema.payments.sessionId),
        gte(schema.payments.updatedAt, new Date(Date.now() - 30 * 60 * 1000))
      )
    )
    .orderBy(desc(schema.payments.updatedAt))
    .limit(1);
  return payment || null;
};

export const activeSessionFor = async (stationId, ocppTransactionId) => {
  const [row] = await db
    .select()
    .from(schema.chargingSessions)
    .where(
      and(
        eq(schema.chargingSessions.stationId, stationId),
        eq(schema.chargingSessions.ocppTransactionId, ocppTransactionId),
        inArray(schema.chargingSessions.status, ["active", "FAULT_PAUSED"])
      )
    )
    .limit(1);
  return row || null;
};

/** Running bill for a session given energy so far (kWh), using the prices locked at start. */
export const sessionBill = (session, energyKwh) =>
  computeBill({
    energyKwh,
    pricePerKwh: session.appliedPrice,
    convenienceFee: session.convenienceFee,
    taxPercent: session.taxPercent ?? 0,
  });

const updatePayment = async (id, values) => {
  const [row] = await db
    .update(schema.payments)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(schema.payments.id, id))
    .returning();
  return row;
};

/**
 * Refund the unused part of a prepaid payment once charging ends.
 * The payment is only marked "refunded" when Razorpay confirms; otherwise "refund_failed"
 * so an admin can retry from the Payments page.
 */
export const settlePayment = async (payment, actualAmount, station) => {
  const paid = Number(payment.totalAmount || payment.amount) || 0;
  const actual = round2(Math.min(actualAmount, paid));
  const refundAmount = round2(paid - actual);

  let updated = await updatePayment(payment.id, {
    actualAmount: actual,
    estimatedAmount: paid,
    extraAmount: 0,
    refundAmount,
    status: refundAmount >= 1 ? "pending_refund" : "completed",
  });

  if (refundAmount >= 1) {
    const result = await refundPayment(payment.paymentId, refundAmount, {
      reason: "Unused prepaid amount for EV charging session",
    });
    if (result.ok) {
      updated = await updatePayment(payment.id, {
        status: "refunded",
        refundId: result.refundId,
        refundTimestamp: new Date(),
        refundError: null,
      });
      notify({
        userId: payment.userId,
        title: "Refund Initiated",
        message: `₹${refundAmount.toFixed(2)} of your prepaid amount was unused and has been refunded. Refund ID: ${result.refundId}.`,
        type: "payment",
        metadata: { paymentId: payment.id, refundId: result.refundId, amount: refundAmount },
      });
    } else {
      updated = await updatePayment(payment.id, { status: "refund_failed", refundError: result.error });
      notify({
        userId: station?.userId,
        title: "Refund Failed",
        message: `Automatic refund of ₹${refundAmount.toFixed(2)} for order ${payment.orderId} failed: ${result.error}. Retry from the Payments page.`,
        type: "payment",
        metadata: { paymentId: payment.id, amount: refundAmount },
      });
    }
  }
  emitToOperatorsAndUser(station, payment.userId, "payment_update", toApi(updated));
  return updated;
};

/** Full refund when charging could not start after payment. */
export const refundFull = async (payment, reason, station) => {
  const amount = Number(payment.totalAmount || payment.amount) || 0;
  await updatePayment(payment.id, { status: "pending_refund", actualAmount: 0, refundAmount: amount });
  const result = await refundPayment(payment.paymentId, amount, { reason: `Charging failed to start: ${reason}` });
  const updated = result.ok
    ? await updatePayment(payment.id, { status: "refunded", refundId: result.refundId, refundTimestamp: new Date(), refundError: null })
    : await updatePayment(payment.id, { status: "refund_failed", refundError: result.error });
  notify({
    userId: payment.userId,
    title: result.ok ? "Refund Initiated" : "Refund Pending",
    message: result.ok
      ? `Charging could not start (${reason}). A full refund of ₹${amount.toFixed(2)} has been initiated.`
      : `Charging could not start (${reason}). Your refund of ₹${amount.toFixed(2)} is being processed by our team.`,
    type: "payment",
    metadata: { paymentId: payment.id, amount },
  });
  emitToOperatorsAndUser(station, payment.userId, "payment_update", toApi(updated));
  return { payment: updated, refunded: result.ok };
};

/**
 * Close a charging session: compute energy and the final bill (capped at the prepaid amount),
 * settle the payment, notify the customer, and broadcast the update.
 */
export const finalizeSession = async ({ session, station, meterStop, endedAt = new Date(), reason }) => {
  const meterStart = Number(session.meterStart) || 0;
  const energyUsed =
    meterStop !== undefined && meterStop !== null
      ? Math.round(Math.max(Number(meterStop) - meterStart, 0)) / 1000 // Wh → kWh
      : Number(session.energyUsed) || 0;

  const bill = sessionBill(session, energyUsed);
  const prepaid = Number(session.prepaidAmount) || 0;
  const cost = prepaid > 0 ? Math.min(bill.total, prepaid) : bill.total;

  const [closed] = await db
    .update(schema.chargingSessions)
    .set({
      status: "completed",
      endTime: endedAt,
      meterStop: meterStop ?? session.meterStop,
      energyUsed,
      cost: round2(cost),
      tax: prepaid > 0 && bill.total > prepaid ? round2((cost * (session.taxPercent || 0)) / (100 + (session.taxPercent || 0))) : bill.tax,
      stopReason: session.stopReason || reason || "stopped",
      updatedAt: new Date(),
    })
    .where(eq(schema.chargingSessions.id, session.id))
    .returning();

  const customerId = userIdFromTag(closed.idTag);
  if (closed.idTag?.startsWith("user:")) {
    notify({
      userId: customerId,
      title: "Charging Completed",
      message: `Your charging session at ${station.name || station.stationNumber} is complete. Energy: ${energyUsed.toFixed(2)} kWh. Cost: ₹${closed.cost.toFixed(2)}.`,
      type: "session_end",
      metadata: { stationId: station.id, stationNumber: station.stationNumber, ocppTransactionId: closed.ocppTransactionId, energyUsed, cost: closed.cost },
    });
  }

  if (closed.orderId) {
    const [payment] = await db.select().from(schema.payments).where(eq(schema.payments.orderId, closed.orderId)).limit(1);
    if (payment && ["charging", "paid"].includes(payment.status)) await settlePayment(payment, closed.cost, station);
  }

  emitToOperatorsAndUser(station, customerId, "transaction_update", {
    stationId: station.id,
    stationNumber: station.stationNumber,
    connectorId: closed.connectorId,
    transactionId: closed.ocppTransactionId,
    sessionId: closed.id,
    status: "completed",
    endedAt: closed.endTime,
    energyUsed: closed.energyUsed,
    cost: closed.cost,
  });
  return closed;
};

export const sessionPayload = (row, station) => sessionToApi(row, station);
export { emitToUser, stationRates };
