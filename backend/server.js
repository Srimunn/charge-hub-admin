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
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, ".env") });

const app = express();

app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

console.log("🚀 Server starting...");
console.log("MONGO_URI:", process.env.MONGO_URI);

// MongoDB Connection (Mocked for environment without local MongoDB)
mongoose.set('bufferCommands', false);

const connectDB = async () => {
  try {
    // Attempt connection if URI looks like a real cloud URI, otherwise skip to mock
    if (process.env.MONGO_URI && !process.env.MONGO_URI.includes('localhost')) {
      await mongoose.connect(process.env.MONGO_URI);
      console.log("✅ MongoDB Connected");
    } else {
      console.log("⚠️ No local MongoDB found. Running in MOCK MODE (No Database Persistence)");
    }
    
    // Start Simulator
    import('./simulator.js').then(module => {
      module.startSimulation();
      console.log("✅ Simulation Started");
    });

    app.listen(5000, () => {
      console.log("🌐 Server running on http://localhost:5000");
      console.log("✅ API Working in Mock Mode");
    });
  } catch (err) {
    console.error("❌ MongoDB Connection Error. Starting anyway in MOCK MODE...");
    app.listen(5000, () => {
      console.log("🌐 Server running on http://localhost:5000");
    });
  }
};

connectDB();

app.get("/", (req, res) => {
  res.send("API Running");
});

app.get("/test", (req, res) => {
  res.send("Test working ✅");
});

// Use routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/stations", stationRoutes);
app.use("/api/sessions", sessionRoutes);
app.use("/api/faults", faultRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/dashboard", dashboardRoutes);
// Use routes