import "../config/env.js";
import crypto from "crypto";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import * as schema from "./schema.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const connectionString = process.env.DATABASE_URL;

const useSsl =
  process.env.DATABASE_SSL === "true" ||
  (connectionString && /sslmode=require/.test(connectionString));

export const pool = new pg.Pool({
  connectionString,
  max: Number(process.env.DATABASE_POOL_MAX || 10),
  ssl: useSsl ? { rejectUnauthorized: false } : undefined,
});

pool.on("error", (err) => console.error("❌ Postgres pool error:", err.message));

export const db = drizzle(pool, { schema });
export { schema };

let ready = false;
export const isDbReady = () => ready;

/** Apply pending SQL migrations from backend/drizzle, retrying until the DB is reachable. */
export const connectDb = async ({ retries = Infinity, delayMs = 5000 } = {}) => {
  if (!connectionString) {
    console.error("❌ DATABASE_URL is not set. On Railway, reference the Postgres service's DATABASE_URL.");
    return false;
  }
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await pool.query("select 1");
      await migrate(db, { migrationsFolder: path.join(__dirname, "../drizzle") });
      ready = true;
      const { rows } = await pool.query("select current_database() as db, current_setting('server_encoding') as enc");
      console.log(`✅ PostgreSQL connected (database: ${rows[0].db}), migrations applied`);
      if (rows[0].enc !== "UTF8") {
        console.warn(`⚠️ Database encoding is ${rows[0].enc}, not UTF8 – text such as "₹" cannot be stored. Recreate the database with ENCODING 'UTF8'.`);
      }
      return true;
    } catch (err) {
      console.error(`❌ PostgreSQL connection attempt ${attempt} failed: ${err.message}`);
      if (attempt >= retries) return false;
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  return false;
};

/** 24-char hex id, same shape as a MongoDB ObjectId (4-byte time + 8 random bytes). */
export const newId = () =>
  Math.floor(Date.now() / 1000).toString(16).padStart(8, "0") + crypto.randomBytes(8).toString("hex");

export const isId = (value) => typeof value === "string" && /^[a-f0-9]{24}$/i.test(value);

/**
 * Convert a DB row into the JSON shape the dashboard and mobile app already expect
 * (Mongo-style `_id` plus `id`).
 */
export const toApi = (row, extra = {}) => {
  if (!row) return row;
  const out = { _id: row.id, ...row, ...extra };
  return out;
};

export const userToApi = (user) => {
  if (!user) return user;
  // eslint-disable-next-line no-unused-vars
  const { password, ...rest } = user;
  return toApi(rest);
};

export const stationToApi = (station) => {
  if (!station) return station;
  // eslint-disable-next-line no-unused-vars
  const { ocppPasswordHash, ...rest } = station;
  return toApi(rest, {
    stationName: station.name,
    availabilityStatus: station.status,
    ocppPasswordSet: Boolean(ocppPasswordHash),
  });
};

/** Charging session in the old "Transaction" shape (stationId optionally populated). */
export const sessionToApi = (row, station) => {
  if (!row) return row;
  return toApi(row, {
    sessionId: row.id,
    stationId: station ? stationToApi(station) : row.stationId,
  });
};

export const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
