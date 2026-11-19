import bcrypt from "bcryptjs";
import { and, desc, eq, ilike, or } from "drizzle-orm";
import { db, schema, newId, stationToApi } from "../db/index.js";
import { storeUploadedFile } from "../config/cloudinary.js";
import { findManagedStation } from "../services/access.js";
import { DEFAULT_GST_PERCENT } from "../services/pricing.js";
import { logEvent } from "./auditLogController.js";

const num = (v) => {
  if (v === undefined || v === null || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};
const bool = (v) => (v === undefined || v === null || v === "" ? undefined : v === true || v === "true" || v === "1");

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const parseDynamicPricing = (raw) => {
  if (raw === undefined || raw === null || raw === "") return undefined;
  let rules = raw;
  if (typeof raw === "string") {
    try {
      rules = JSON.parse(raw);
    } catch {
      throw Object.assign(new Error("dynamicPricing must be valid JSON"), { status: 400 });
    }
  }
  if (!Array.isArray(rules)) throw Object.assign(new Error("dynamicPricing must be an array"), { status: 400 });
  return rules.map((r) => {
    const price = Number(r?.pricePerKwh);
    if (!HHMM.test(r?.startTime || "") || !HHMM.test(r?.endTime || "") || !Number.isFinite(price) || price < 0) {
      throw Object.assign(new Error("Each pricing rule needs startTime/endTime (HH:MM) and a non-negative pricePerKwh"), { status: 400 });
    }
    return { startTime: r.startTime, endTime: r.endTime, pricePerKwh: price };
  });
};

// GST is set by the platform admin (default 18%); owners cannot change it.
const parseGst = (raw, role) => {
  if (role !== "admin") return undefined;
  const v = num(raw);
  if (v === undefined) return undefined;
  if (v < 0 || v > 28) throw Object.assign(new Error("GST must be between 0 and 28%"), { status: 400 });
  return v;
};

const validateFee = (fee) => {
  if (fee !== undefined && fee !== 0 && (fee < 2 || fee > 5)) {
    throw Object.assign(new Error("Convenience fee must be between ₹2 and ₹5"), { status: 400 });
  }
};

const generateStationNumber = async (pinPrefix) => {
  const prefix = /^\d{3}$/.test(String(pinPrefix || "")) ? String(pinPrefix) : "000";
  for (let i = 0; i < 20; i++) {
    const candidate = `${prefix}${Math.floor(10000 + Math.random() * 90000)}`;
    const [exists] = await db.select({ id: schema.stations.id }).from(schema.stations).where(eq(schema.stations.stationNumber, candidate)).limit(1);
    if (!exists) return candidate;
  }
  throw new Error("Could not generate a unique station number");
};

const sendError = (res, err, fallback) => {
  if (err?.status) return res.status(err.status).json({ error: err.message });
  console.error(fallback, err?.message || err);
  return res.status(500).json({ error: fallback });
};

// GET /api/stations – operator: own stations (admin: all)
export const getStations = async (req, res) => {
  try {
    const q = db.select().from(schema.stations);
    const rows =
      req.user.role === "admin"
        ? await q.orderBy(desc(schema.stations.createdAt))
        : await q.where(eq(schema.stations.userId, req.user.id)).orderBy(desc(schema.stations.createdAt));
    res.status(200).json(rows.map(stationToApi));
  } catch (err) {
    sendError(res, err, "Failed to load stations");
  }
};

// GET /api/stations/public – mobile app station list
export const getAllStationsPublic = async (req, res) => {
  try {
    const rows = await db.select().from(schema.stations).orderBy(desc(schema.stations.createdAt));
    res.status(200).json(rows.map(stationToApi));
  } catch (err) {
    sendError(res, err, "Failed to load stations");
  }
};

export const getStationById = async (req, res) => {
  try {
    const station = await findManagedStation(req, req.params.id);
    if (!station) return res.status(404).json({ error: "Station not found" });
    res.status(200).json(stationToApi(station));
  } catch (err) {
    sendError(res, err, "Failed to load station");
  }
};

export const getStationByIdPublic = async (req, res) => {
  try {
    const [station] = await db.select().from(schema.stations).where(eq(schema.stations.id, String(req.params.id))).limit(1);
    if (!station) return res.status(404).json({ error: "Station not found" });
    res.status(200).json(stationToApi(station));
  } catch (err) {
    sendError(res, err, "Failed to load station");
  }
};

// POST /api/stations
export const setStation = async (req, res) => {
  try {
    const b = req.body;
    if (!b.name || !b.location) return res.status(400).json({ error: "Name and location are required" });

    const convenienceFee = num(b.convenienceFee) ?? 0;
    validateFee(convenienceFee);
    const dynamicPricing = parseDynamicPricing(b.dynamicPricing) ?? [];

    // Admins may create a station on behalf of an owner.
    let ownerId = req.user.id;
    if (req.user.role === "admin" && b.ownerId) {
      const [owner] = await db.select().from(schema.users).where(eq(schema.users.id, String(b.ownerId))).limit(1);
      if (!owner || owner.role !== "owner") return res.status(400).json({ error: "ownerId must be an owner account" });
      ownerId = owner.id;
    }

    const image = req.file ? await storeUploadedFile(req.file) : "";
    const [station] = await db
      .insert(schema.stations)
      .values({
        id: newId(),
        stationNumber: await generateStationNumber(b.districtPin),
        name: String(b.name).trim(),
        location: String(b.location).trim(),
        district: b.district || null,
        latitude: num(b.latitude),
        longitude: num(b.longitude),
        powerOutput: num(b.powerOutput) ?? 0,
        ports: Math.max(1, Math.trunc(num(b.ports) ?? 1)),
        connectorType: b.connectorType || "Type 2",
        image,
        status: "offline",
        userId: ownerId,
        basePricePerKwh: Math.max(0, num(b.basePricePerKwh) ?? 0),
        dynamicPricing,
        convenienceFee,
        tax: parseGst(b.tax, req.user.role) ?? DEFAULT_GST_PERCENT,
        simulated: req.user.role === "admin" ? Boolean(bool(b.simulated)) : false,
        ocppPasswordHash: b.ocppPassword ? await bcrypt.hash(String(b.ocppPassword), 10) : null,
      })
      .returning();

    await logEvent(req.user.id, `Station created: ${station.stationNumber}`, req);
    if (station.simulated) {
      import("../services/ocppSimulator.js").then((m) => m.simulateStation(station.stationNumber)).catch(() => {});
    }
    res.status(201).json(stationToApi(station));
  } catch (err) {
    sendError(res, err, "Failed to create station");
  }
};

// PUT /api/stations/:id
export const updateStation = async (req, res) => {
  try {
    const station = await findManagedStation(req, req.params.id);
    if (!station) return res.status(404).json({ error: "Station not found" });
    const b = req.body;

    const values = { updatedAt: new Date() };
    if (b.name) values.name = String(b.name).trim();
    if (b.location) values.location = String(b.location).trim();
    if (b.district !== undefined) values.district = b.district || null;
    if (num(b.latitude) !== undefined) values.latitude = num(b.latitude);
    if (num(b.longitude) !== undefined) values.longitude = num(b.longitude);
    if (num(b.powerOutput) !== undefined) values.powerOutput = num(b.powerOutput);
    if (num(b.ports) !== undefined) values.ports = Math.max(1, Math.trunc(num(b.ports)));
    if (b.connectorType) values.connectorType = b.connectorType;
    if (b.status && ["online", "offline", "maintenance"].includes(b.status)) values.status = b.status;
    if (num(b.basePricePerKwh) !== undefined) values.basePricePerKwh = Math.max(0, num(b.basePricePerKwh));
    const dyn = parseDynamicPricing(b.dynamicPricing);
    if (dyn !== undefined) values.dynamicPricing = dyn;
    if (num(b.convenienceFee) !== undefined) {
      validateFee(num(b.convenienceFee));
      values.convenienceFee = num(b.convenienceFee);
    }
    const gst = parseGst(b.tax, req.user.role);
    if (gst !== undefined) values.tax = gst;
    if (req.file) values.image = await storeUploadedFile(req.file);
    if (b.ocppPassword !== undefined) {
      values.ocppPasswordHash = b.ocppPassword ? await bcrypt.hash(String(b.ocppPassword), 10) : null;
    }
    if (req.user.role === "admin") {
      if (bool(b.simulated) !== undefined) values.simulated = bool(b.simulated);
      if (b.ownerId) {
        const [owner] = await db.select().from(schema.users).where(eq(schema.users.id, String(b.ownerId))).limit(1);
        if (!owner || owner.role !== "owner") return res.status(400).json({ error: "ownerId must be an owner account" });
        values.userId = owner.id;
      }
    }

    const [updated] = await db.update(schema.stations).set(values).where(eq(schema.stations.id, station.id)).returning();
    await logEvent(req.user.id, `Station updated: ${updated.stationNumber}`, req);

    if (values.simulated !== undefined && values.simulated !== station.simulated) {
      const sim = await import("../services/ocppSimulator.js");
      if (values.simulated) sim.simulateStation(updated.stationNumber);
      else sim.stopSimulation(updated.stationNumber);
    }
    res.status(200).json(stationToApi(updated));
  } catch (err) {
    sendError(res, err, "Failed to update station");
  }
};

// DELETE /api/stations/:id
export const deleteStation = async (req, res) => {
  try {
    const station = await findManagedStation(req, req.params.id);
    if (!station) return res.status(404).json({ error: "Station not found" });

    const [active] = await db
      .select({ id: schema.chargingSessions.id })
      .from(schema.chargingSessions)
      .where(and(eq(schema.chargingSessions.stationId, station.id), eq(schema.chargingSessions.status, "active")))
      .limit(1);
    if (active) return res.status(409).json({ error: "Station has an active charging session. Stop it first." });

    const [hasHistory] = await db
      .select({ id: schema.chargingSessions.id })
      .from(schema.chargingSessions)
      .where(eq(schema.chargingSessions.stationId, station.id))
      .limit(1);
    const [hasPayments] = await db
      .select({ id: schema.payments.id })
      .from(schema.payments)
      .where(eq(schema.payments.stationId, station.id))
      .limit(1);
    if (hasHistory || hasPayments) {
      return res.status(409).json({
        error: "Station has charging/payment history and cannot be deleted. Set its status to offline or maintenance instead.",
      });
    }

    import("../services/ocppSimulator.js").then((m) => m.stopSimulation(station.stationNumber)).catch(() => {});
    await db.delete(schema.stations).where(eq(schema.stations.id, station.id));
    await logEvent(req.user.id, `Station deleted: ${station.stationNumber}`, req);
    res.status(200).json({ message: "Station removed" });
  } catch (err) {
    sendError(res, err, "Failed to delete station");
  }
};

// GET /api/stations/search?query=
export const searchStations = async (req, res) => {
  try {
    const query = String(req.query.query || "").trim().slice(0, 100);
    if (!query) return res.status(400).json({ error: "Search query is required" });
    const pattern = `%${query.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    const rows = await db
      .select()
      .from(schema.stations)
      .where(or(ilike(schema.stations.name, pattern), ilike(schema.stations.location, pattern), ilike(schema.stations.district, pattern)))
      .limit(50);
    res.status(200).json(rows.map(stationToApi));
  } catch (err) {
    sendError(res, err, "Search failed");
  }
};
