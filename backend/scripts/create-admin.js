/**
 * Create (or promote) a platform admin.
 *
 *   node scripts/create-admin.js --email admin@magnertia.in --name "Admin" [--mobile 9xxxxxxxxx]
 *
 * A random 6-digit PIN is generated and printed once if the user has no PIN yet.
 * On Railway: `railway run --service charge-hub-backend node scripts/create-admin.js ...`
 */
import "../config/env.js";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, schema, connectDb, newId, pool } from "../db/index.js";

const args = new Map(process.argv.slice(2).map((a) => a.replace(/^--/, "").split("=")).map(([k, v]) => [k, v]));
// also support "--email x" style
process.argv.slice(2).forEach((a, i, arr) => {
  if (a.startsWith("--") && !a.includes("=") && arr[i + 1] && !arr[i + 1].startsWith("--")) args.set(a.slice(2), arr[i + 1]);
});

const email = String(args.get("email") || "").trim().toLowerCase();
const name = args.get("name") || email.split("@")[0];
const mobile = args.get("mobile") || null;
if (!email) {
  console.error('Usage: node scripts/create-admin.js --email admin@example.com --name "Admin"');
  process.exit(1);
}

if (!(await connectDb({ retries: 3, delayMs: 2000 }))) process.exit(1);
const [existing] = await db.select().from(schema.users).where(eq(schema.users.email, email)).limit(1);
let pin = null;
if (existing) {
  const values = { role: "admin", status: "active", updatedAt: new Date() };
  if (!existing.password) {
    pin = crypto.randomInt(100000, 1000000).toString();
    values.password = await bcrypt.hash(pin, 10);
  }
  await db.update(schema.users).set(values).where(eq(schema.users.id, existing.id));
  console.log(`✅ ${email} is now an admin.`);
} else {
  pin = crypto.randomInt(100000, 1000000).toString();
  await db.insert(schema.users).values({ id: newId(), name, email, mobile, role: "admin", password: await bcrypt.hash(pin, 10) });
  console.log(`✅ Admin ${email} created.`);
}
if (pin) console.log(`🔑 Temporary 6-digit PIN: ${pin}  (change it in Settings after first login)`);
await pool.end();
