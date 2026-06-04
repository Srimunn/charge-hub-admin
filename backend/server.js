import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from the backend directory (where the file actually lives)
dotenv.config({ path: path.join(__dirname, ".env") });

import express from "express";
import mongoose from "mongoose";
import cors from "cors";

// Import models
import User from "./models/User.js";
import Station from "./models/Station.js";
import Session from "./models/Session.js";
import Fault from "./models/Fault.js";
import Payment from "./models/Payment.js";

// Import routes
import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import stationRoutes from "./routes/stationRoutes.js";
import sessionRoutes from "./routes/sessionRoutes.js";
import faultRoutes from "./routes/faultRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";

import http from "http";
import { Server } from "socket.io";
import OcppCentralSystem from "./services/ocppCentralSystem.js";

// Ensure uploads directory exists to avoid ENOENT when saving files
try {
  fs.mkdirSync(path.join(__dirname, "uploads"), { recursive: true });
  console.log("✅ Ensured uploads directory exists");
} catch (e) {
  console.warn("Could not create uploads directory:", e?.message || e);
}

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const ocppCentralSystem = new OcppCentralSystem({ server, io, pathPrefix: "/ocpp" });
ocppCentralSystem.attach();

app.use(cors({ origin: process.env.CORS_ORIGIN || "*", credentials: true }));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

app.use((req, res, next) => {
  req.ocppCentralSystem = ocppCentralSystem;
  next();
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/stations', stationRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/faults', faultRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/dashboard', dashboardRoutes);

console.log("MONGO_URI:", process.env.MONGO_URI);

const mongoUri = process.env.MONGO_URI;

// Start HTTP & Socket.io server immediately (so health checks work and server doesn't crash)
const port = process.env.PORT || 5000;
console.log("ℹ️ [System] process.env.PORT is:", process.env.PORT);
console.log(`ℹ️ [System] Server attempting to listen on port: ${port}`);
server.listen(port, "0.0.0.0", () => {
  console.log(`🌐 Server running on http://0.0.0.0:${port}`);
  console.log("📡 Socket.io and OCPP Ready");
  
  // Start OCPP Simulator
  import("./services/ocppSimulator.js").then((module) => {
    module.default();
  }).catch((err) => {
    console.error("❌ Failed to start OCPP Simulator:", err);
  });
});

// Helper to extract database and cluster names from URI
const getClusterAndDb = (uri) => {
  try {
    const parsed = new URL(uri);
    const dbName = parsed.pathname.substring(1) || "ev_chargings";

    let clusterName = "EVapp"; // fallback
    const appName = parsed.searchParams.get("appName");
    if (appName) {
      clusterName = appName;
    } else {
      const host = parsed.host;
      const parts = host.split('.');
      if (parts.length > 0) {
        const sub = parts[0];
        clusterName = sub.charAt(0).toUpperCase() + sub.slice(1);
      }
    }
    return { dbName, clusterName };
  } catch (e) {
    return { dbName: "ev_chargings", clusterName: "EVapp" };
  }
};

// Set connection event listeners for automatic reconnection events
mongoose.connection.on("disconnected", () => {
  console.log("⚠️ MongoDB Disconnected. Reconnecting...");
});
mongoose.connection.on("reconnected", () => {
  console.log("✅ MongoDB Reconnected");
});
mongoose.connection.on("error", (err) => {
  console.error("❌ MongoDB connection error:", err);
});

// Connect to MongoDB with auto-retry
const connectDB = () => {
  if (!mongoUri) {
    console.error("❌ Error: MONGO_URI environment variable is not defined!");
    return;
  }
  const isAtlas = mongoUri.startsWith("mongodb+srv://") || mongoUri.includes("mongodb.net");
  mongoose.connect(mongoUri)
    .then(() => {
      if (isAtlas) {
        console.log("✅ MongoDB Atlas Connected");
        const { dbName, clusterName } = getClusterAndDb(mongoUri);
        console.log(`📊 Database: ${dbName}`);
        console.log(`🌐 Cluster: ${clusterName}`);
      } else {
        console.log("✅ MongoDB Connected");
        const { dbName } = getClusterAndDb(mongoUri);
        console.log(`📊 Database: ${dbName}`);
      }
    })
    .catch(err => {
      console.error("❌ MongoDB Connection Error:", err?.message || err);
      console.log("⚠️ Retrying database connection in 5 seconds...");
      setTimeout(connectDB, 5000);
    });
};

connectDB();

// Socket.io Room Logic
io.on("connection", (socket) => {
  console.log("🔌 New Client Connected:", socket.id);

  socket.on("join_station", (stationId) => {
    socket.join(`station:${stationId}`);
    console.log(`👥 Client ${socket.id} joined room: station:${stationId}`);
  });

  socket.on("leave_station", (stationId) => {
    socket.leave(`station:${stationId}`);
    console.log(`🏃 Client ${socket.id} left room: station:${stationId}`);
  });

  socket.on("disconnect", () => {
    console.log("🔌 Client Disconnected:", socket.id);
  });
});

// Mongoose configuration moved to connection block above

// Server start moved into MongoDB connection promise above

app.get("/api/health", (req, res) => {
  console.log(`💚 [Health Check] Ping received from: ${req.ip} at ${new Date().toISOString()}`);
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.get("/test", (req, res) => {
  res.send("Test working ✅");
});

// Centralized error handling middleware
app.use((err, req, res, next) => {
  console.error("Unhandled Error:", err);
  const status = err.status || 500;
  res.status(status).json({ error: err.message || "Internal Server Error" });
});
// Static folder for uploads
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
