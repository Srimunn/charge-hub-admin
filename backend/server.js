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

// Connect to MongoDB first, then start HTTP & Socket.io server
const mongoUri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/ev_chargings";

mongoose.connect(mongoUri)
  .then(() => {
    console.log("✅ MongoDB Connected");
    // Start server after DB is ready
    server.listen(5000, "0.0.0.0", () => {
      console.log("🌐 Server running on http://0.0.0.0:5000");
      console.log("📡 Socket.io and OCPP Ready");
      
      // Start OCPP Simulator
      import("./services/ocppSimulator.js").then((module) => {
        module.default();
      }).catch((err) => {
        console.error("❌ Failed to start OCPP Simulator:", err);
      });
    });
  })
  .catch(err => {
    console.error("❌ MongoDB Connection Error:", err?.message || err);
    process.exit(1);
  });

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
  res.json({ status: "ok", timestamp: Date.now() });
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
