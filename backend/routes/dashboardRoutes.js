import express from "express";
import Station from "../models/Station.js";
import Fault from "../models/Fault.js";
import Transaction from "../models/Transaction.js";
import Session from "../models/Session.js";
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

router.get("/reports", protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const stations = await Station.find({ userId });
    const stationIds = stations.map((s) => s._id);

    const sessions = await Session.find({ stationId: { $in: stationIds } }).lean();
    const faults = await Fault.find({ stationId: { $in: stationIds } }).lean();

    // 1. KPI Totals
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    const monthlySessions = sessions.filter(s => s.startTime >= startOfMonth);
    const monthlyFaults = faults.filter(f => f.createdAt >= startOfMonth);
    const resolvedMonthlyFaults = monthlyFaults.filter(f => f.status === "resolved" || f.status === "RESOLVED");

    const totalFaultsMonth = monthlyFaults.length;
    
    let avgResolutionHours = 0;
    if (resolvedMonthlyFaults.length > 0) {
      const totalResolutionMs = resolvedMonthlyFaults.reduce((sum, f) => {
        const end = f.resolvedAt ? new Date(f.resolvedAt) : new Date();
        return sum + (end.getTime() - new Date(f.createdAt).getTime());
      }, 0);
      avgResolutionHours = Number((totalResolutionMs / (1000 * 60 * 60 * resolvedMonthlyFaults.length)).toFixed(1));
    }

    const totalEnergyMonth = monthlySessions.reduce((sum, s) => sum + (s.energyUsed || 0), 0);
    const totalRevenueMonth = monthlySessions.reduce((sum, s) => sum + (s.cost || 0), 0);
    const totalSessionsMonth = monthlySessions.length;

    // 2. Charts Data
    const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dailyEnergy = weekdays.map(day => ({ day, energy: 0 }));
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const recentSessions = sessions.filter(s => s.startTime >= sevenDaysAgo);
    recentSessions.forEach(s => {
      const dayName = weekdays[new Date(s.startTime).getDay()];
      const dayObj = dailyEnergy.find(d => d.day === dayName);
      if (dayObj) {
        dayObj.energy += (s.energyUsed || 0);
      }
    });

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const currentYear = now.getFullYear();
    const monthlyRevenue = months.map(month => ({ month, revenue: 0 }));
    sessions.forEach(s => {
      const date = new Date(s.startTime);
      if (date.getFullYear() === currentYear) {
        const monthName = months[date.getMonth()];
        const monthObj = monthlyRevenue.find(m => m.month === monthName);
        if (monthObj) {
          monthObj.revenue += (s.cost || 0);
        }
      }
    });

    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sessions30Days = sessions.filter(s => s.startTime >= thirtyDaysAgo);
    
    const stationUtilization = stations.map(station => {
      const stationSessions = sessions30Days.filter(s => String(s.stationId) === String(station._id));
      const totalChargeTimeMs = stationSessions.reduce((sum, s) => {
        const end = s.endTime ? new Date(s.endTime) : new Date();
        return sum + (end.getTime() - new Date(s.startTime).getTime());
      }, 0);
      const totalPeriodMs = 30 * 24 * 60 * 60 * 1000;
      let utilization = Number(((totalChargeTimeMs / totalPeriodMs) * 100).toFixed(1));
      utilization = Math.min(100, Math.max(0, utilization));
      return {
        station: String(station._id),
        name: station.name,
        utilization,
      };
    });

    const avgUtilization = stationUtilization.length > 0
      ? Number((stationUtilization.reduce((sum, s) => sum + s.utilization, 0) / stationUtilization.length).toFixed(1))
      : 0;

    const faultsByStation = stations.map(station => {
      const count = faults.filter(f => String(f.stationId) === String(station._id)).length;
      return {
        station: String(station._id),
        name: station.name,
        faults: count
      };
    });

    const faultTypeCounts = {};
    faults.forEach(f => {
      const type = f.type || "Other";
      faultTypeCounts[type] = (faultTypeCounts[type] || 0) + 1;
    });
    const faultsByType = Object.keys(faultTypeCounts).map(type => ({
      type,
      count: faultTypeCounts[type]
    }));

    const monthlyDowntime = months.map(month => ({ month, downtime: 0 }));
    faults.forEach(f => {
      const date = new Date(f.createdAt);
      if (date.getFullYear() === currentYear) {
        const monthName = months[date.getMonth()];
        const end = f.resolvedAt ? new Date(f.resolvedAt) : new Date();
        const durationHours = (end.getTime() - date.getTime()) / (1000 * 60 * 60);
        const monthObj = monthlyDowntime.find(m => m.month === monthName);
        if (monthObj) {
          monthObj.downtime += Number(durationHours.toFixed(1));
        }
      }
    });

    res.json({
      kpis: {
        totalFaultsMonth,
        avgResolutionHours,
        totalEnergyMonth,
        totalRevenueMonth,
        avgUtilization,
        totalSessionsMonth
      },
      charts: {
        dailyEnergy,
        monthlyRevenue,
        stationUtilization,
        faultsByStation,
        faultsByType,
        monthlyDowntime
      }
    });
  } catch (error) {
    console.error("Reports API Error:", error);
    res.status(500).json({ error: "Server Error" });
  }
});

export default router;
