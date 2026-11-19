import jwt from "jsonwebtoken";
import { eq } from "drizzle-orm";
import { db, schema, isDbReady } from "../db/index.js";

export const verifyToken = (token) => {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not set");
  return jwt.verify(token, secret);
};

export const loadUser = async (userId) => {
  const [user] = await db.select().from(schema.users).where(eq(schema.users.id, String(userId))).limit(1);
  if (!user) return null;
  // eslint-disable-next-line no-unused-vars
  const { password, ...safe } = user;
  return { ...safe, _id: user.id };
};

export const protect = async (req, res, next) => {
  if (!process.env.JWT_SECRET) {
    console.error("JWT_SECRET environment variable is not set.");
    return res.status(500).json({ error: "Server configuration error" });
  }
  const header = req.headers.authorization || "";
  if (!header.toLowerCase().startsWith("bearer ")) {
    return res.status(401).json({ error: "Not authorized, no token" });
  }
  const token = header.slice(7).trim();
  if (!token) return res.status(401).json({ error: "Not authorized, invalid token format" });

  let decoded;
  try {
    decoded = verifyToken(token);
  } catch (error) {
    const message =
      error?.name === "TokenExpiredError" ? "Token expired, please log in again" : "Invalid token, please log in again";
    return res.status(401).json({ error: message });
  }

  if (!isDbReady()) return res.status(503).json({ error: "Database not connected" });

  try {
    const user = await loadUser(decoded.id);
    if (!user) return res.status(401).json({ error: "Not authorized, user not found" });
    if (user.status === "blocked") return res.status(403).json({ error: "Account is blocked. Contact the administrator." });
    req.user = user;
    return next();
  } catch (err) {
    return next(err);
  }
};

/** Allow only the given roles, e.g. requireRole("admin", "owner"). Use after `protect`. */
export const requireRole =
  (...roles) =>
  (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: "You do not have permission to do this" });
    }
    return next();
  };

/** Operator dashboard access: platform admins and charging-centre owners. */
export const operatorOnly = requireRole("admin", "owner");

export const isAdmin = (req) => req.user?.role === "admin";
