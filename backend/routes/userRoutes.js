import express from "express";
import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import { db, schema, newId, userToApi, round2 } from "../db/index.js";
import { protect, operatorOnly, requireRole } from "../middleware/authMiddleware.js";
import { hashPin, isValidPin, normalizeEmail } from "../controllers/authController.js";
import { operatorStationIds } from "../services/access.js";
import { logEvent } from "../controllers/auditLogController.js";

const router = express.Router();
router.use(protect, operatorOnly);

const U = schema.users;
const C = schema.chargingSessions;

/** Per-user session totals within an optional set of stations. */
const sessionStats = async (userIds, stationIds) => {
  if (userIds.length === 0) return new Map();
  const conds = [inArray(C.userId, userIds)];
  if (stationIds) conds.push(inArray(C.stationId, stationIds.length ? stationIds : ["__none__"]));
  const rows = await db
    .select({ userId: C.userId, totalSessions: sql`count(*)::int`, totalSpent: sql`coalesce(sum(${C.cost}), 0)::float` })
    .from(C)
    .where(and(...conds))
    .groupBy(C.userId);
  return new Map(rows.map((r) => [r.userId, r]));
};

const stationCounts = async (ownerIds) => {
  if (ownerIds.length === 0) return new Map();
  const rows = await db
    .select({ userId: schema.stations.userId, count: sql`count(*)::int` })
    .from(schema.stations)
    .where(inArray(schema.stations.userId, ownerIds))
    .groupBy(schema.stations.userId);
  return new Map(rows.map((r) => [r.userId, r.count]));
};

/**
 * GET /api/users
 *  admin: every user (owners, customers, admins)  – ?role=owner|customer|admin to filter
 *  owner: customers who have charged at their stations
 */
router.get("/", async (req, res) => {
  try {
    let users;
    let scopeStations = null;
    if (req.user.role === "admin") {
      const role = ["owner", "customer", "admin"].includes(req.query.role) ? req.query.role : null;
      users = await db.select().from(U).where(role ? eq(U.role, role) : undefined).orderBy(desc(U.createdAt)).limit(2000);
    } else {
      scopeStations = await operatorStationIds(req);
      if (scopeStations.length === 0) return res.json([]);
      const ids = await db
        .selectDistinct({ userId: C.userId })
        .from(C)
        .where(and(inArray(C.stationId, scopeStations), sql`${C.userId} is not null`));
      const userIds = ids.map((r) => r.userId);
      users = userIds.length ? await db.select().from(U).where(and(inArray(U.id, userIds), eq(U.role, "customer"))) : [];
    }

    const stats = await sessionStats(users.map((u) => u.id), scopeStations);
    const counts = req.user.role === "admin" ? await stationCounts(users.filter((u) => u.role === "owner").map((u) => u.id)) : new Map();
    res.json(
      users.map((u) => ({
        ...userToApi(u),
        totalSessions: stats.get(u.id)?.totalSessions || 0,
        totalSpent: round2(stats.get(u.id)?.totalSpent || 0),
        stationCount: counts.get(u.id) || 0,
        type: u.role === "owner" ? "business" : "individual",
      }))
    );
  } catch (err) {
    console.error("GET /users error:", err.message);
    res.status(500).json({ error: "Failed to load users" });
  }
});

/** POST /api/users – admin creates an owner (or another admin) account. */
router.post("/", requireRole("admin"), async (req, res) => {
  try {
    const { name, mobile, password } = req.body;
    const email = normalizeEmail(req.body.email);
    const role = ["owner", "admin"].includes(req.body.role) ? req.body.role : "owner";
    if (!name || !email) return res.status(400).json({ error: "Name and email are required" });
    if (password && !isValidPin(String(password))) return res.status(400).json({ error: "PIN must be exactly 6 digits" });

    const conds = [eq(U.email, email)];
    if (mobile) conds.push(eq(U.mobile, String(mobile)));
    const [exists] = await db.select({ id: U.id, role: U.role }).from(U).where(or(...conds)).limit(1);
    if (exists) return res.status(400).json({ error: "A user with this email or mobile already exists" });

    const [user] = await db
      .insert(U)
      .values({
        id: newId(),
        name: String(name).trim(),
        email,
        mobile: mobile ? String(mobile) : null,
        password: password ? await hashPin(String(password)) : null,
        role,
        operatorId: req.user.id,
      })
      .returning();
    await logEvent(req.user.id, `Created ${role} account ${email}`, req);
    res.status(201).json(userToApi(user));
  } catch (err) {
    console.error("POST /users error:", err.message);
    res.status(500).json({ error: "Could not create user" });
  }
});

/** PATCH /api/users/:id – admin changes role/status (block/unblock), name, mobile or resets PIN. */
router.patch("/:id", requireRole("admin"), async (req, res) => {
  try {
    const [target] = await db.select().from(U).where(eq(U.id, String(req.params.id))).limit(1);
    if (!target) return res.status(404).json({ error: "User not found" });
    if (target.id === req.user.id && (req.body.role || req.body.status)) {
      return res.status(400).json({ error: "You cannot change your own role or status" });
    }
    const values = { updatedAt: new Date() };
    if (req.body.name) values.name = String(req.body.name).trim();
    if (req.body.mobile !== undefined) values.mobile = req.body.mobile ? String(req.body.mobile) : null;
    if (["owner", "customer", "admin"].includes(req.body.role)) values.role = req.body.role;
    if (["active", "blocked"].includes(req.body.status)) values.status = req.body.status;
    if (req.body.password) {
      if (!isValidPin(String(req.body.password))) return res.status(400).json({ error: "PIN must be exactly 6 digits" });
      values.password = await hashPin(String(req.body.password));
    }
    const [updated] = await db.update(U).set(values).where(eq(U.id, target.id)).returning();
    await logEvent(req.user.id, `Updated user ${target.email}: ${Object.keys(values).filter((k) => k !== "updatedAt" && k !== "password").join(", ")}${values.password ? " (PIN reset)" : ""}`, req);
    res.json(userToApi(updated));
  } catch (err) {
    console.error("PATCH /users error:", err.message);
    res.status(500).json({ error: "Could not update user" });
  }
});

/** GET /api/users/audit-logs – admin activity log */
router.get("/audit-logs", requireRole("admin"), async (req, res) => {
  const rows = await db.select().from(schema.auditLogs).orderBy(desc(schema.auditLogs.timestamp)).limit(500);
  res.json(rows.map((r) => ({ ...r, _id: r.id })));
});

export default router;
