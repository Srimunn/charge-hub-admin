import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load the first .env found (local development). On Railway variables come from the service.
const candidatePaths = [
  path.join(__dirname, "../.env"), // backend/.env
  path.join(__dirname, "../../.env"), // repo root .env
  path.join(process.cwd(), ".env"),
];
for (const envPath of candidatePaths) {
  if (fs.existsSync(envPath) && !dotenv.config({ path: envPath, quiet: true }).error) break;
}

// All business logic (pricing windows, report grouping) runs in Indian time.
if (!process.env.TZ) process.env.TZ = "Asia/Kolkata";

const isProduction = process.env.NODE_ENV === "production" || Boolean(process.env.RAILWAY_ENVIRONMENT_NAME);

if (!process.env.DATABASE_URL && !isProduction) {
  process.env.DATABASE_URL = "postgres://postgres:postgres@127.0.0.1:5432/charge_hub";
  console.log("ℹ️ DATABASE_URL not set – using local default postgres://127.0.0.1:5432/charge_hub");
}

if (isProduction) {
  const missing = ["DATABASE_URL", "JWT_SECRET"].filter((k) => !process.env[k]);
  if (missing.length) console.error(`❌ Missing required environment variables: ${missing.join(", ")}`);
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
    console.warn("⚠️ JWT_SECRET is shorter than 32 characters – use a long random value in production.");
  }
  if (process.env.PAYMENTS_DEMO_MODE === "true") console.warn("⚠️ PAYMENTS_DEMO_MODE is ON – demo payments are accepted.");
  if (process.env.OTP_DEBUG === "true") console.warn("⚠️ OTP_DEBUG is ON – OTPs are returned in API responses.");
}

export const IS_PRODUCTION = isProduction;
export default process.env;
