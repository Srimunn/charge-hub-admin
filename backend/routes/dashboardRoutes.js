import express from "express";
import Station from "../models/Station.js";
import Session from "../models/Session.js";
import Fault from "../models/Fault.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/kpis", protect, async (req, res) => {
  try {
    const isDbConnected = Station.db.readyState === 1;

    if (isDbConnected) {
      const userId = req.user.id;
      const stations = await Station.find({ userId });
      const stationIds = stations.map(s => s._id);

      const sessions = await Session.find({ userId });
      const faults = await Fault.find({ stationId: { $in: stationIds }, status: 'active' });

      const totalRevenue = sessions.reduce((sum, s) => sum + (s.cost || 0), 0);
      const totalEnergyCost = sessions.reduce((sum, s) => sum + ((s.energyUsed * (s.appliedPrice || 15)) || 0), 0);
      const totalConvenienceFee = sessions.reduce((sum, s) => sum + (s.convenienceFee || 0), 0);
      const totalTax = sessions.reduce((sum, s) => sum + (s.tax || 0), 0);

      const activeSessions = sessions.filter(s => s.status === 'active').length;
      const totalEnergy = sessions.reduce((sum, s) => sum + (s.energyUsed || 0), 0);
      const co2Saved = totalEnergy * 0.4 / 1000;
      const onlineStations = stations.filter(s => s.status === 'online').length;
      const activeFaults = faults.length;

      res.json({
        totalRevenue,
        totalEnergyCost,
        totalConvenienceFee,
        totalTax,
        activeSessions,
        totalEnergy: totalEnergy, 
        co2Saved,
        onlineStations,
        totalStations: stations.length,
        activeFaults,
        maintenanceStations: stations.filter(s => s.status === 'maintenance').length,
        idleStations: Math.max(0, onlineStations - activeSessions),
      });
    } else {
      // Return mock data if database is not connected
      res.json({
        totalRevenue: 1254.50,
        totalEnergyCost: 850.20,
        totalConvenienceFee: 300.30,
        totalTax: 104.00,
        activeSessions: 12,
        totalEnergy: 45000, 
        co2Saved: 18.5,
        onlineStations: 8,
        totalStations: 10,
        activeFaults: 2,
        maintenanceStations: 1,
        idleStations: 5,
      });
    }
  } catch (error) {
    console.error("Dashboard KPI Error:", error);
    res.status(500).json({ error: "Server Error" });
  }
});

export default router;
