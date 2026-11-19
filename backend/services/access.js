import { eq, inArray } from "drizzle-orm";
import { db, schema } from "../db/index.js";

/**
 * Station IDs the current operator may see/manage.
 * Admin → null (meaning "all stations"); owner → their own station IDs.
 */
export const operatorStationIds = async (req) => {
  if (req.user?.role === "admin") return null;
  const rows = await db
    .select({ id: schema.stations.id })
    .from(schema.stations)
    .where(eq(schema.stations.userId, req.user.id));
  return rows.map((r) => r.id);
};

/** Drizzle condition limiting `column` (a station_id column) to the operator's stations. */
export const stationScope = (column, ids) => {
  if (ids === null) return undefined; // admin: no restriction
  if (ids.length === 0) return inArray(column, ["__none__"]);
  return inArray(column, ids);
};

/** Load a station the current operator is allowed to manage, or null. */
export const findManagedStation = async (req, stationId) => {
  const [station] = await db.select().from(schema.stations).where(eq(schema.stations.id, String(stationId))).limit(1);
  if (!station) return null;
  if (req.user?.role === "admin" || station.userId === req.user?.id) return station;
  return null;
};

export const clientIp = (req) => {
  const fwd = req.headers["x-forwarded-for"];
  const ip = (typeof fwd === "string" && fwd.split(",")[0].trim()) || req.socket?.remoteAddress || "unknown";
  return ip;
};
