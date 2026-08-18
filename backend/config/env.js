import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Candidate paths for .env configuration
const candidatePaths = [
  path.join(__dirname, "../.env"),             // backend/.env
  path.join(__dirname, "../../.env"),            // root/.env
  path.join(process.cwd(), ".env"),              // current working directory/.env
  path.join(process.cwd(), "backend/.env")       // cwd/backend/.env
];

let loadedPath = null;
for (const envPath of candidatePaths) {
  if (fs.existsSync(envPath)) {
    const result = dotenv.config({ path: envPath });
    if (!result.error) {
      loadedPath = envPath;
      break;
    }
  }
}

if (!loadedPath) {
  dotenv.config();
}

// Fallback logic for local development if MONGO_URI is missing
if (!process.env.MONGO_URI) {
  const isProduction = process.env.NODE_ENV === "production" || process.env.NIMBUZ_ENV;
  if (!isProduction) {
    process.env.MONGO_URI = "mongodb://127.0.0.1:27017/ev_chargings";
    console.log("ℹ️ [System] MONGO_URI not set. Using local fallback: mongodb://127.0.0.1:27017/ev_chargings");
  } else {
    console.warn("⚠️ [System] WARNING: MONGO_URI environment variable is missing in production deployment!");
  }
}

export default process.env;
