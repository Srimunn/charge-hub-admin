import "./config/env.js";
import crypto from "crypto";
if (!global.crypto) global.crypto = crypto;

import path from "path";
import fs from "fs";
import http from "http";
import { fileURLToPath } from "url";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { Server } from "socket.io";
import { inArray, lt, sql } from "drizzle-orm";

import { db, schema, pool, connectDb, isDbReady } from "./db/index.js";
import { verifyToken, loadUser } from "./middleware/authMiddleware.js";
import { setIo } from "./services/realtime.js";
import OcppCentralSystem from "./services/ocppCentralSystem.js";
import { refundStalePayments } from "./controllers/paymentController.js";

import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import stationRoutes from "./routes/stationRoutes.js";
import sessionRoutes from "./routes/sessionRoutes.js";
import faultRoutes from "./routes/faultRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
fs.mkdirSync(path.join(__dirname, "uploads"), { recursive: true });

// ── CORS ──────────────────────────────────────────────────────────────────────
// CORS_ORIGIN accepts a comma-separated list, e.g. https://operator.magnertia.in
const allowedOrigins = new Set(["http://localhost:3000", "http://127.0.0.1:3000"]);
for (const o of (process.env.CORS_ORIGIN || "").split(",")) {
  const trimmed = o.trim().replace(/\/$/, "");
  if (trimmed) allowedOrigins.add(trimmed);
}
const originAllowed = (origin) => !origin || allowedOrigins.has("*") || allowedOrigins.has(origin);
console.log("✅ CORS allowed origins:", [...allowedOrigins]);

const app = express();
app.set("trust proxy", 1); // Railway / reverse proxy: real client IP for rate limiting
app.disable("x-powered-by");
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: (origin, cb) => cb(null, originAllowed(origin)), methods: ["GET", "POST"], credentials: true },
});
setIo(io);

// Socket auth: optional JWT → private rooms. Unauthenticated sockets only get public station events.
io.use(async (socket, next) => {
  const token = socket.handshake.auth?.token || socket.handshake.query?.token;
  if (token) {
    try {
      const decoded = verifyToken(String(token));
      const user = await loadUser(decoded.id);
      if (user && user.status !== "blocked") socket.data.user = user;
    } catch {
      /* invalid token → treat as anonymous */
    }
  }
  next();
});

io.on("connection", (socket) => {
  const user = socket.data.user;
  if (user) {
    socket.join(`user:${user.id}`);
    if (user.role === "admin") socket.join("admin");
  }
  socket.on("join_station", (stationId) => {
    if (typeof stationId === "string" && stationId.length <= 64) socket.join(`station:${stationId}`);
  });
  socket.on("leave_station", (stationId) => {
    if (typeof stationId === "string") socket.leave(`station:${stationId}`);
  });
});

const ocppCentralSystem = new OcppCentralSystem({ server, io, pathPrefix: "/ocpp" });
ocppCentralSystem.attach();

// ── HTTP middleware ───────────────────────────────────────────────────────────
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(
  cors({
    origin: (origin, cb) => (originAllowed(origin) ? cb(null, true) : cb(null, false)),
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
// Keep the raw body for Razorpay webhook signature verification.
app.use(express.json({ limit: "2mb", verify: (req, _res, buf) => { req.rawBody = buf; } }));
app.use(express.urlencoded({ limit: "2mb", extended: true }));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: (req) => `${ipKeyGenerator(req.ip || "")}:${String(req.body?.email || "").toLowerCase()}`,
  message: { error: "Too many attempts. Please try again in 15 minutes." },
});
const otpLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: "draft-7", legacyHeaders: false, message: { error: "Too many OTP attempts. Please try again later." } });
const apiLimiter = rateLimit({ windowMs: 60 * 1000, limit: 600, standardHeaders: "draft-7", legacyHeaders: false });

app.use("/api", apiLimiter);
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/register", otpLimiter);
app.use("/api/auth/verify-otp", otpLimiter);
app.use("/api/auth/verify-password-otp", otpLimiter);

app.use((req, _res, next) => {
  req.ocppCentralSystem = ocppCentralSystem;
  next();
});

// ── Routes ────────────────────────────────────────────────────────────────────
app.get("/", (_req, res) => res.send("Charge Hub API"));
app.get("/api/health", async (_req, res) => {
  let database = "disconnected";
  if (isDbReady()) {
    try {
      await pool.query("select 1");
      database = "connected";
    } catch {
      database = "error";
    }
  }
  const ok = database === "connected";
  res.status(ok ? 200 : 503).json({
    status: ok ? "ok" : "degraded",
    database,
    chargersConnected: ocppCentralSystem.connections.size,
    timestamp: new Date().toISOString(),
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/stations", stationRoutes);
app.use("/api/sessions", sessionRoutes);
app.use("/api/faults", faultRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.use((req, res) => res.status(404).json({ error: "Not found" }));
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  const status = err.status || err.statusCode || 500;
  if (status >= 500) console.error("Unhandled Error:", err);
  res.status(status).json({ error: status >= 500 ? "Internal Server Error" : err.message });
});

// ── Startup ───────────────────────────────────────────────────────────────────
/** Promote the emails in ADMIN_EMAILS to platform admin (bootstrap the first admin). */
const bootstrapAdmins = async () => {
  const emails = (process.env.ADMIN_EMAILS || "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
  if (!emails.length) return;
  const rows = await db.update(schema.users).set({ role: "admin" }).where(inArray(schema.users.email, emails)).returning({ email: schema.users.email });
  if (rows.length) console.log(`👑 Admin role ensured for: ${rows.map((r) => r.email).join(", ")}`);
};

const TELEMETRY_RETENTION_DAYS = Number(process.env.TELEMETRY_RETENTION_DAYS || 90);
const runMaintenance = async () => {
  try {
    await refundStalePayments();
    await db.delete(schema.telemetry).where(lt(schema.telemetry.timestamp, new Date(Date.now() - TELEMETRY_RETENTION_DAYS * 86400000)));
    await db.delete(schema.otpCodes).where(lt(schema.otpCodes.expiresAt, new Date(Date.now() - 3600000)));
    // Stations that silently dropped off without a clean close
    await db.execute(sql`update stations set ocpp_connected = false, status = 'offline'
      where ocpp_connected = true and (last_seen is null or last_seen < now() - interval '10 minutes')`);
  } catch (err) {
    console.error("❌ Maintenance job failed:", err.message);
  }
};

const port = Number(process.env.PORT || 5000);
// "::" = dual-stack (IPv6 + IPv4). Railway's private network (*.railway.internal) is IPv6-only.
server.listen(port, "::", () => {
  console.log(`🌐 Server listening on port ${port} (TZ=${process.env.TZ})`);
});

connectDb().then(async (ok) => {
  if (!ok) return;
  await bootstrapAdmins().catch((e) => console.error("Admin bootstrap failed:", e.message));
  // Chargers reconnect after a deploy; reset the stale "connected" flags first.
  await db.execute(sql`update stations set ocpp_connected = false where ocpp_connected = true`).catch(() => {});
  setInterval(runMaintenance, 5 * 60 * 1000).unref();
  runMaintenance();
  if (process.env.OCPP_SIMULATOR !== "false") {
    import("./services/ocppSimulator.js").then((m) => m.default()).catch((e) => console.error("Simulator failed:", e.message));
  }
});

const shutdown = (signal) => {
  console.log(`${signal} received – shutting down`);
  server.close(() => pool.end().finally(() => process.exit(0)));
  setTimeout(() => process.exit(0), 10000).unref();
};
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
