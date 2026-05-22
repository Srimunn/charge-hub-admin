import express from "express";
import Station from "../models/Station.js";
import Fault from "../models/Fault.js";
import Transaction from "../models/Transaction.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/kpis", protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const stations = await Station.find({ userId });
    const stationIds = stations.map((s) => s._id);

    const transactions = await Transaction.find({ stationId: { $in: stationIds } });
    const activeTx = transactions.filter((t) => t.status === "active");
    const completedTx = transactions.filter((t) => t.status === "completed");
    const faults = await Fault.find({ stationId: { $in: stationIds }, status: "active" });

    const totalRevenue = completedTx.reduce((sum, t) => sum + (t.cost || 0), 0);
    const totalEnergyCost = completedTx.reduce((sum, t) => sum + ((t.energyUsed || 0) * (t.appliedPrice || 0)), 0);
    const totalConvenienceFee = completedTx.reduce((sum, t) => sum + (t.convenienceFee || 0), 0);
    const totalTax = completedTx.reduce((sum, t) => sum + (t.tax || 0), 0);

    const activeSessions = activeTx.length;
    const totalEnergy = completedTx.reduce((sum, t) => sum + (t.energyUsed || 0), 0);
    const co2Saved = totalEnergy * 0.4 / 1000;
    const onlineStations = stations.filter((s) => s.status === "online").length;
    const activeFaults = faults.length;

    res.json({
      totalRevenue,
      totalEnergyCost,
      totalConvenienceFee,
      totalTax,
      activeSessions,
      totalEnergy,
      co2Saved,
      onlineStations,
      totalStations: stations.length,
      activeFaults,
      maintenanceStations: stations.filter((s) => s.status === "maintenance").length,
      idleStations: Math.max(0, onlineStations - activeSessions),
    });
  } catch (error) {
    console.error("Dashboard KPI Error:", error);
    res.status(500).json({ error: "Server Error" });
  }
});

export default router;
