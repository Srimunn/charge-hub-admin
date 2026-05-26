import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
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

import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

import http from "http";
import { Server } from "socket.io";
import OcppCentralSystem from "./services/ocppCentralSystem.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, ".env") });

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

app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

console.log("🚀 Server starting...");
console.log("MONGO_URI:", process.env.MONGO_URI);

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

mongoose.set("bufferCommands", false);

const mongoUri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/ev_chargings";

mongoose.connect(mongoUri).then(
  () => console.log("✅ MongoDB Connected"),
  (err) => console.error("❌ MongoDB Connection Error:", err?.message || err)
);

const ocppCentralSystem = new OcppCentralSystem({ server, io, pathPrefix: "/ocpp" });
ocppCentralSystem.attach();

server.listen(5000, () => {
  console.log("🌐 Server running on http://localhost:5000");
  console.log("📡 Socket.io and OCPP Ready");
});

app.get("/", (req, res) => {
  res.send("API Running");
});

app.get("/test", (req, res) => {
  res.send("Test working ✅");
});

app.use((req, res, next) => {
  req.ocppCentralSystem = ocppCentralSystem;
  next();
});

// Use routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/stations", stationRoutes);
app.use("/api/sessions", sessionRoutes);
app.use("/api/faults", faultRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/dashboard", dashboardRoutes);

// Static folder for uploads
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
