/**
 * One-time data migration: MongoDB (Atlas) → PostgreSQL.
 *
 *   MONGO_URI=mongodb+srv://...  DATABASE_URL=postgres://...  node scripts/migrate-from-mongo.js [options]
 *
 * Options
 *   --wipe                 empty all Postgres tables first (fresh import)
 *   --real-stations        do NOT mark migrated stations as simulated (default: simulated = demo)
 *   --telemetry-days=N     copy only the last N days of telemetry (default 30, 0 = none)
 *   --dry-run              read and transform everything, write nothing
 *
 * IDs are kept (Mongo ObjectId hex → text id), so the mobile app's stored IDs stay valid.
 * Safe to re-run: existing rows are skipped (ON CONFLICT DO NOTHING).
 */
import "../config/env.js";
import { MongoClient } from "mongodb";
import { sql } from "drizzle-orm";
import { db, schema, connectDb, newId, pool } from "../db/index.js";

const args = new Map(process.argv.slice(2).map((a) => a.replace(/^--/, "").split("=")).map(([k, v]) => [k, v ?? "true"]));
const WIPE = args.has("wipe");
const DRY = args.has("dry-run");
const SIMULATED = !args.has("real-stations");
const TELEMETRY_DAYS = Number(args.get("telemetry-days") ?? 30);
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);

if (!process.env.MONGO_URI) {
  console.error("MONGO_URI is required");
  process.exit(1);
}

const sid = (v) => (v === null || v === undefined ? null : String(v));
const num = (v, d = null) => (v === null || v === undefined || v === "" || !Number.isFinite(Number(v)) ? d : Number(v));
const date = (v, d = null) => {
  if (!v) return d;
  const x = new Date(v);
  return Number.isNaN(x.getTime()) ? d : x;
};
const stats = {};
const count = (k, n = 1) => (stats[k] = (stats[k] || 0) + n);

const insertMany = async (table, rows, label) => {
  count(`${label} (read)`, rows.length);
  if (DRY || rows.length === 0) return;
  for (let i = 0; i < rows.length; i += 500) {
    const res = await db.insert(table).values(rows.slice(i, i + 500)).onConflictDoNothing().returning({ one: sql`1` });
    count(`${label} (inserted)`, res.length);
  }
};

const main = async () => {
  if (!(await connectDb({ retries: 3, delayMs: 2000 }))) process.exit(1);
  const mongo = new MongoClient(process.env.MONGO_URI);
  await mongo.connect();
  const mdb = mongo.db();
  console.log(`📥 Reading MongoDB database "${mdb.databaseName}"`);
  const all = async (name) => {
    const exists = await mdb.listCollections({ name }).hasNext();
    return exists ? mdb.collection(name).find({}).toArray() : [];
  };

  if (WIPE && !DRY) {
    console.log("🧹 Wiping Postgres tables");
    await db.execute(sql`truncate table telemetry, notifications, device_tokens, audit_logs, otp_codes, alerts, faults, payments, charging_sessions, stations, users restart identity cascade`);
  }

  // ── Users ──────────────────────────────────────────────────────────────────
  const mUsers = await all("users");
  const mStations = await all("stations");
  const ownerIds = new Set(mStations.map((s) => sid(s.userId)));
  const seenEmail = new Set();
  const seenMobile = new Set();
  const seenGoogle = new Set();
  const users = [];
  for (const u of mUsers) {
    const email = String(u.email || "").trim().toLowerCase();
    if (!email || seenEmail.has(email)) {
      console.warn(`⚠️ Skipping user ${u._id}: missing/duplicate email "${email}"`);
      count("users skipped");
      continue;
    }
    seenEmail.add(email);
    const mobile = u.mobile && !seenMobile.has(String(u.mobile)) ? String(u.mobile) : null;
    if (mobile) seenMobile.add(mobile);
    const googleId = u.googleId && !seenGoogle.has(u.googleId) ? u.googleId : null;
    if (googleId) seenGoogle.add(googleId);
    const id = sid(u._id);
    users.push({
      id,
      name: u.name || email.split("@")[0],
      email,
      password: u.password || null, // bcrypt hashes are compatible
      mobile,
      googleId,
      authProvider: u.authProvider || "local",
      role: ADMIN_EMAILS.includes(email) ? "admin" : ownerIds.has(id) ? "owner" : "customer",
      status: "active",
      vehicleType: u.vehicleType || null,
      sessionTimeout: num(u.sessionTimeout, 30),
      operatorId: sid(u.operatorId),
      fcmToken: u.fcmToken || "",
      notificationPreferences: { emailAlerts: true, smsAlerts: false, pushAlerts: true, faultAlerts: true, paymentAlerts: true, ...(u.notificationPreferences || {}) },
      createdAt: date(u.createdAt, new Date()),
      updatedAt: new Date(),
    });
  }
  const userIds = new Set(users.map((u) => u.id));

  // Stations need an owner; orphans go to a placeholder owner the admin can reassign.
  let placeholderOwner = null;
  const ownerFor = (userId) => {
    if (userIds.has(sid(userId))) return sid(userId);
    if (!placeholderOwner) {
      placeholderOwner = { id: newId(), name: "Unassigned Owner", email: "unassigned-owner@invalid.local", role: "owner", status: "blocked", authProvider: "local", sessionTimeout: 30, notificationPreferences: {}, createdAt: new Date(), updatedAt: new Date() };
      users.push(placeholderOwner);
      userIds.add(placeholderOwner.id);
    }
    return placeholderOwner.id;
  };

  // ── Stations ───────────────────────────────────────────────────────────────
  const seenNumbers = new Set();
  const stations = [];
  for (const s of mStations) {
    if (!s.stationNumber || seenNumbers.has(s.stationNumber)) {
      console.warn(`⚠️ Skipping station ${s._id}: missing/duplicate stationNumber`);
      count("stations skipped");
      continue;
    }
    seenNumbers.add(s.stationNumber);
    stations.push({
      id: sid(s._id),
      userId: ownerFor(s.userId),
      stationNumber: String(s.stationNumber),
      name: s.name || s.stationNumber,
      location: s.location || "-",
      district: s.district || null,
      latitude: num(s.latitude),
      longitude: num(s.longitude),
      status: "offline",
      ports: num(s.ports, 1),
      slots: num(s.slots),
      powerOutput: num(s.powerOutput),
      connectorType: s.connectorType || "Type 2",
      image: s.image || null,
      basePricePerKwh: num(s.basePricePerKwh, 0),
      dynamicPricing: (s.dynamicPricing || []).map((r) => ({ startTime: r.startTime, endTime: r.endTime, pricePerKwh: num(r.pricePerKwh, 0) })),
      convenienceFee: num(s.convenienceFee, 0),
      tax: 18, // GST 18% (old data stored a flat rupee amount)
      lastSeen: date(s.lastSeen),
      ocppConnected: false,
      ocpp: s.ocpp || {},
      connectors: (s.connectors || []).map((c) => ({ connectorId: num(c.connectorId, 1), status: c.status, errorCode: c.errorCode, updatedAt: date(c.updatedAt)?.toISOString() })),
      faultStatus: s.faultStatus || "none",
      totalEnergyConsumed: num(s.totalEnergyConsumed, 0),
      health: s.health || "NORMAL",
      lastResolvedAt: date(s.lastResolvedAt),
      simulated: SIMULATED,
      createdAt: date(s.createdAt, new Date()),
      updatedAt: new Date(),
    });
  }
  const stationById = new Map(stations.map((s) => [s.id, s]));

  await insertMany(schema.users, users, "users");
  await insertMany(schema.stations, stations, "stations");

  // ── Charging sessions (Mongo transactions + payment sessions merged) ─────────
  const mTx = await all("transactions");
  const mSessions = await all("sessions");
  const mPayments = await all("payments");
  const paymentByOrder = new Map(mPayments.map((p) => [p.orderId, p]));
  const sessionById = new Map(mSessions.map((s) => [sid(s._id), s]));
  const oldSessionToNew = new Map();
  const sessions = [];
  const usedTx = new Set();

  for (const t of mTx) {
    const stationId = sid(t.stationId);
    if (!stationById.has(stationId)) {
      count("sessions skipped (no station)");
      continue;
    }
    const key = `${stationId}:${t.ocppTransactionId}`;
    if (usedTx.has(key)) continue;
    usedTx.add(key);
    const linked = t.sessionId ? sessionById.get(String(t.sessionId)) : null;
    const orderId = t.orderId || linked?.orderId || null;
    const pay = orderId ? paymentByOrder.get(orderId) : null;
    const tagUser = /^user:(.+)$/.exec(t.idTag || "")?.[1];
    const id = sid(t._id);
    if (linked) oldSessionToNew.set(sid(linked._id), id);
    sessions.push({
      id,
      stationId,
      stationNumber: t.stationNumber || stationById.get(stationId).stationNumber,
      userId: tagUser && userIds.has(tagUser) ? tagUser : linked && userIds.has(sid(linked.userId)) ? sid(linked.userId) : null,
      connectorId: num(t.connectorId, 1) || 1,
      ocppTransactionId: num(t.ocppTransactionId),
      idTag: t.idTag || "unknown",
      meterStart: num(t.meterStart, 0),
      meterStop: num(t.meterStop),
      startTime: date(t.startTime, date(t.createdAt, new Date())),
      endTime: date(t.endTime),
      status: t.status === "active" || t.status === "FAULT_PAUSED" ? "completed" : t.status || "completed", // nothing is live after migration
      stopReason: t.status === "active" || t.status === "FAULT_PAUSED" ? "migrated_open_session" : null,
      energyUsed: num(t.energyUsed, num(linked?.energyUsed, 0)),
      cost: num(t.cost, num(linked?.cost, 0)),
      appliedPrice: num(t.appliedPrice, num(linked?.appliedPrice, 0)),
      convenienceFee: num(t.convenienceFee, num(linked?.convenienceFee, 0)),
      tax: num(t.tax, num(linked?.tax, 0)),
      prepaidAmount: pay ? num(pay.totalAmount) : null,
      paymentId: t.paymentId || linked?.paymentId || null,
      orderId,
      createdAt: date(t.createdAt, new Date()),
      updatedAt: new Date(),
    });
  }
  for (const s of mSessions) {
    const oldId = sid(s._id);
    if (oldSessionToNew.has(oldId)) continue;
    const stationId = sid(s.stationId);
    if (!stationById.has(stationId)) {
      count("sessions skipped (no station)");
      continue;
    }
    const pay = s.orderId ? paymentByOrder.get(s.orderId) : null;
    oldSessionToNew.set(oldId, oldId);
    sessions.push({
      id: oldId,
      stationId,
      stationNumber: stationById.get(stationId).stationNumber,
      userId: userIds.has(sid(s.userId)) ? sid(s.userId) : null,
      connectorId: num(s.connectorId, 1) || 1,
      ocppTransactionId: null,
      idTag: s.userId ? `user:${sid(s.userId)}` : "unknown",
      startTime: date(s.startTime, new Date()),
      endTime: date(s.endTime),
      status: "completed",
      stopReason: s.status === "completed" ? null : "migrated_open_session",
      energyUsed: num(s.energyUsed, 0),
      cost: num(s.cost, 0),
      appliedPrice: num(s.appliedPrice, 0),
      convenienceFee: num(s.convenienceFee, 0),
      tax: num(s.tax, 0),
      prepaidAmount: pay ? num(pay.totalAmount) : null,
      paymentId: s.paymentId || null,
      orderId: s.orderId || null,
      createdAt: date(s.startTime, new Date()),
      updatedAt: new Date(),
    });
  }
  await insertMany(schema.chargingSessions, sessions, "charging sessions");

  // ── Payments ───────────────────────────────────────────────────────────────
  const seenOrders = new Set();
  const payments = [];
  for (const p of mPayments) {
    if (!userIds.has(sid(p.userId)) || !stationById.has(sid(p.stationId)) || !p.orderId || seenOrders.has(p.orderId)) {
      count("payments skipped");
      continue;
    }
    seenOrders.add(p.orderId);
    const status = ["paid", "charging"].includes(p.status) ? "completed" : p.status || "pending";
    payments.push({
      id: sid(p._id),
      userId: sid(p.userId),
      stationId: sid(p.stationId),
      sessionId: p.sessionId ? oldSessionToNew.get(sid(p.sessionId)) || sid(p.sessionId) : null,
      orderId: p.orderId,
      paymentId: p.paymentId || null,
      signature: p.signature || null,
      amount: num(p.amount, 0),
      currency: p.currency || "INR",
      tax: num(p.tax, 0),
      convenienceFee: num(p.convenienceFee, 0),
      energyCost: num(p.energyCost, 0),
      totalAmount: num(p.totalAmount, num(p.amount, 0)),
      estimatedAmount: num(p.estimatedAmount),
      actualAmount: num(p.actualAmount),
      refundAmount: num(p.refundAmount),
      extraAmount: num(p.extraAmount),
      refundId: p.refundId || null,
      refundTimestamp: date(p.refundTimestamp),
      status,
      createdAt: date(p.createdAt, new Date()),
      updatedAt: date(p.updatedAt, new Date()),
    });
  }
  await insertMany(schema.payments, payments, "payments");

  // ── Faults & alerts ────────────────────────────────────────────────────────
  const faults = (await all("faults_alerts"))
    .filter((f) => stationById.has(sid(f.stationId)))
    .map((f) => ({
      id: sid(f._id),
      stationId: sid(f.stationId),
      userId: sid(f.userId),
      sessionId: f.sessionId ? oldSessionToNew.get(sid(f.sessionId)) || sid(f.sessionId) : null,
      type: f.type || "unknown",
      faultCode: f.faultCode || null,
      faultName: f.faultName || null,
      source: f.source === "HARDWARE" ? "HARDWARE" : "SIMULATION",
      severity: String(f.severity || "low").toLowerCase(),
      message: f.message || f.description || null,
      status: String(f.status || "active").toLowerCase() === "resolved" ? "resolved" : "active",
      raw: f.raw ?? null,
      createdAt: date(f.createdAt, date(f.timestamp, new Date())),
      timestamp: date(f.timestamp, date(f.createdAt, new Date())),
      resolvedAt: date(f.resolvedAt),
      resolvedBy: sid(f.resolvedBy),
    }));
  await insertMany(schema.faults, faults, "faults");

  const alerts = (await all("alerts"))
    .filter((a) => stationById.has(sid(a.stationId)))
    .map((a) => ({
      id: sid(a._id),
      type: a.type || "FAULT",
      title: a.title || "Alert",
      stationId: sid(a.stationId),
      severity: a.severity || "HIGH",
      source: a.source || "SIMULATION",
      timestamp: date(a.timestamp, new Date()),
      status: a.status === "RESOLVED" ? "RESOLVED" : "ACTIVE",
    }));
  await insertMany(schema.alerts, alerts, "alerts");

  // ── Notifications, device tokens, audit logs ───────────────────────────────
  const notifications = (await all("notifications")).map((n) => ({
    id: sid(n._id),
    userId: userIds.has(sid(n.userId)) ? sid(n.userId) : null,
    title: n.title || "-",
    message: n.message || "-",
    type: n.type || "general",
    read: Boolean(n.read),
    metadata: n.metadata ? JSON.parse(JSON.stringify(n.metadata)) : {},
    createdAt: date(n.createdAt, new Date()),
  }));
  await insertMany(schema.notifications, notifications, "notifications");

  const seenTokens = new Set();
  const tokens = (await all("deviceTokens"))
    .filter((t) => userIds.has(sid(t.userId)) && t.deviceToken && !seenTokens.has(t.deviceToken) && seenTokens.add(t.deviceToken))
    .map((t) => ({
      id: sid(t._id),
      userId: sid(t.userId),
      deviceToken: t.deviceToken,
      platform: t.platform || "android",
      appVersion: t.appVersion || "1.0.0",
      createdAt: date(t.createdAt, new Date()),
      updatedAt: date(t.updatedAt, new Date()),
    }));
  await insertMany(schema.deviceTokens, tokens, "device tokens");

  const audit = (await all("auditlogs")).map((a) => ({
    id: sid(a._id),
    userId: sid(a.userId) || "unknown",
    action: a.action || "-",
    ipAddress: a.ipAddress || "unknown",
    timestamp: date(a.timestamp, new Date()),
  }));
  await insertMany(schema.auditLogs, audit, "audit logs");

  // ── Telemetry (recent only) ────────────────────────────────────────────────
  if (TELEMETRY_DAYS > 0) {
    const since = new Date(Date.now() - TELEMETRY_DAYS * 86400000);
    const cursor = mdb.collection("telemetry").find({ timestamp: { $gte: since } }).sort({ timestamp: 1 });
    let batch = [];
    for await (const t of cursor) {
      batch.push({
        stationId: String(t.stationId || ""),
        stationObjectId: sid(t.stationObjectId),
        sessionId: t.sessionId ? oldSessionToNew.get(sid(t.sessionId)) || sid(t.sessionId) : null,
        connectorId: num(t.connectorId),
        transactionId: num(t.transactionId),
        voltage: num(t.voltage),
        current: num(t.current),
        power: num(t.power),
        temperature: num(t.temperature),
        energyConsumed: num(t.energyConsumed),
        timestamp: date(t.timestamp, new Date()),
      });
      if (batch.length >= 2000) {
        await insertMany(schema.telemetry, batch, "telemetry");
        batch = [];
      }
    }
    await insertMany(schema.telemetry, batch, "telemetry");
  }

  // Continue OCPP transaction ids after the highest migrated one.
  if (!DRY) {
    await db.execute(sql`select setval('ocpp_transaction_id_seq', greatest((select coalesce(max(ocpp_transaction_id), 0) from charging_sessions), 1))`);
  }

  await mongo.close();
  console.log("\n✅ Migration finished" + (DRY ? " (dry run – nothing written)" : ""));
  console.table(stats);
  if (placeholderOwner) console.log("ℹ️ Stations without a valid owner were assigned to 'Unassigned Owner' – reassign them in the dashboard.");
  if (!users.some((u) => u.role === "admin")) {
    console.log("ℹ️ No admin account yet. Set ADMIN_EMAILS or run: node scripts/create-admin.js --email you@example.com --name \"Your Name\"");
  }
  await pool.end();
};

main().catch(async (err) => {
  console.error("❌ Migration failed:", err);
  await pool.end().catch(() => {});
  process.exit(1);
});
