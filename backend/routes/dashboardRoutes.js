import express from "express";
import Station from "../models/Station.js";
import Fault from "../models/Fault.js";
import Transaction from "../models/Transaction.js";
import Session from "../models/Session.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// Helper to parse date filters
const parseDateRange = (dateFilter, fromDate, toDate) => {
  const now = new Date();
  let start = new Date(0); // all time default
  let end = new Date(now.getTime() + 24 * 60 * 60 * 1000); // end of tomorrow

  const getStartOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const getEndOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

  switch (dateFilter) {
    case 'today':
      start = getStartOfDay(now);
      end = getEndOfDay(now);
      break;
    case 'yesterday':
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      start = getStartOfDay(yesterday);
      end = getEndOfDay(yesterday);
      break;
    case 'last7':
      start = getStartOfDay(new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000));
      end = getEndOfDay(now);
      break;
    case 'last30':
      start = getStartOfDay(new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000));
      end = getEndOfDay(now);
      break;
    case 'week':
      // Start of current week (Sunday)
      const day = now.getDay();
      const diff = now.getDate() - day;
      start = getStartOfDay(new Date(now.setDate(diff)));
      end = getEndOfDay(new Date());
      break;
    case 'month':
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = getEndOfDay(new Date());
      break;
    case 'quarter':
      const currentQuarter = Math.floor(now.getMonth() / 3);
      start = new Date(now.getFullYear(), currentQuarter * 3, 1);
      end = getEndOfDay(new Date());
      break;
    case 'halfyear':
      const currentHalf = now.getMonth() < 6 ? 0 : 6;
      start = new Date(now.getFullYear(), currentHalf, 1);
      end = getEndOfDay(new Date());
      break;
    case 'yearly':
      start = new Date(now.getFullYear(), 0, 1);
      end = getEndOfDay(new Date());
      break;
    case 'custom':
      if (fromDate) start = getStartOfDay(new Date(fromDate));
      if (toDate) end = getEndOfDay(new Date(toDate));
      break;
    case 'all':
    default:
      start = new Date(0);
      end = new Date(now.getFullYear() + 10, 11, 31); // far future
      break;
  }
  return { start, end };
};

// Helper for dynamic grouping (Hourly, Daily, Monthly)
const getTrendData = (items, dateField, valueField, start, end) => {
  const diffMs = end.getTime() - start.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  const formatHour = (d) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const formatDateStr = (d) => d.toLocaleDateString([], { month: 'short', day: '2-digit' });
  const formatMonth = (d) => d.toLocaleDateString([], { month: 'short', year: '2-digit' });

  let groupFn = formatDateStr;
  let incrementHours = 0;
  let incrementDays = 0;
  let incrementMonths = 0;

  if (diffDays <= 2) {
    groupFn = formatHour;
    incrementHours = 2; // group by 2 hours for spacing
  } else if (diffDays > 60) {
    groupFn = formatMonth;
    incrementMonths = 1;
  } else {
    groupFn = formatDateStr;
    incrementDays = 1;
  }

  const slots = new Map();
  let curr = new Date(start);
  while (curr <= end) {
    slots.set(groupFn(curr), 0);
    if (incrementHours > 0) {
      curr.setHours(curr.getHours() + incrementHours);
    } else if (incrementMonths > 0) {
      curr.setMonth(curr.getMonth() + incrementMonths);
    } else {
      curr.setDate(curr.getDate() + incrementDays);
    }
  }

  items.forEach(item => {
    const d = new Date(item[dateField]);
    const label = groupFn(d);
    if (slots.has(label)) {
      slots.set(label, slots.get(label) + (Number(item[valueField]) || 0));
    }
  });

  return Array.from(slots.entries()).map(([label, val]) => ({
    label,
    value: Number(val.toFixed(2))
  }));
};

// Helper to query filtered stations
const getFilteredStationIds = async (req) => {
  const userId = req.user.id;
  const { stationId, chargerType, status, searchQuery } = req.query;

  const query = { userId };

  if (stationId) {
    query._id = stationId;
  }
  if (chargerType) {
    query.connectorType = chargerType;
  }
  if (status) {
    // If status is online/offline/maintenance, filter stations
    if (["online", "offline", "maintenance"].includes(status)) {
      query.status = status;
    }
  }
  if (searchQuery) {
    query.name = { $regex: searchQuery, $options: "i" };
  }

  const stations = await Station.find(query).lean();
  return {
    stations,
    stationIds: stations.map(s => s._id)
  };
};

// GET DASHBOARD KPIS (main dashboard tab)
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

// GET COMPREHENSIVE REPORTS
router.get("/reports", protect, async (req, res) => {
  try {
    const { dateFilter, fromDate, toDate, sessionStatus } = req.query;
    const { start, end } = parseDateRange(dateFilter, fromDate, toDate);

    const { stations, stationIds } = await getFilteredStationIds(req);
    if (stationIds.length === 0) {
      return res.json({
        kpis: {
          totalFaultsMonth: 0,
          avgResolutionHours: 0,
          totalEnergyMonth: 0,
          totalRevenueMonth: 0,
          avgUtilization: 0,
          totalSessionsMonth: 0,
          avgSessionDuration: 0,
          avgRevenuePerSession: 0,
          activeStations: 0,
          downtimeHours: 0
        },
        charts: {
          dailyEnergy: [],
          monthlyRevenue: [],
          stationUtilization: [],
          faultsByStation: [],
          faultsByType: [],
          monthlyDowntime: [],
          revenueByStation: [],
          revenueByChargerType: [],
          peakUsageHours: [],
          topPerformingStations: [],
          sessionGrowth: [],
          faultTrends: [],
          downtimeTrends: []
        }
      });
    }

    const sessionQuery = { stationId: { $in: stationIds }, startTime: { $gte: start, $lte: end } };
    if (sessionStatus) {
      sessionQuery.status = sessionStatus;
    }
    const sessions = await Session.find(sessionQuery).lean();
    const faults = await Fault.find({ stationId: { $in: stationIds }, createdAt: { $gte: start, $lte: end } }).lean();

    // Calculate KPIs
    const totalRevenueMonth = sessions.reduce((sum, s) => sum + (s.cost || 0), 0);
    const totalEnergyMonth = sessions.reduce((sum, s) => sum + (s.energyUsed || 0), 0);
    const totalSessionsMonth = sessions.length;

    // Active stations
    const activeStationsSet = new Set(sessions.map(s => String(s.stationId)));
    const activeStations = activeStationsSet.size;

    // Fault count and downtime
    const totalFaultsMonth = faults.length;
    const resolvedFaults = faults.filter(f => ["resolved", "RESOLVED"].includes(f.status));
    
    let avgResolutionHours = 0;
    if (resolvedFaults.length > 0) {
      const totalResolutionMs = resolvedFaults.reduce((sum, f) => {
        const endF = f.resolvedAt ? new Date(f.resolvedAt) : new Date();
        return sum + (endF.getTime() - new Date(f.createdAt).getTime());
      }, 0);
      avgResolutionHours = Number((totalResolutionMs / (1000 * 60 * 60 * resolvedFaults.length)).toFixed(1));
    }

    const downtimeHours = faults.reduce((sum, f) => {
      const endF = f.resolvedAt ? new Date(f.resolvedAt) : new Date();
      return sum + ((endF.getTime() - new Date(f.createdAt).getTime()) / (1000 * 60 * 60));
    }, 0);

    // Session durations
    const completedSessions = sessions.filter(s => s.endTime);
    let avgSessionDuration = 0;
    if (completedSessions.length > 0) {
      const totalDurationMs = completedSessions.reduce((sum, s) => {
        return sum + (new Date(s.endTime).getTime() - new Date(s.startTime).getTime());
      }, 0);
      avgSessionDuration = Number((totalDurationMs / (1000 * 60 * completedSessions.length)).toFixed(1));
    }

    const avgRevenuePerSession = totalSessionsMonth > 0 ? Number((totalRevenueMonth / totalSessionsMonth).toFixed(2)) : 0;

    // Station Utilization
    const stationUtilization = stations.map(station => {
      const stationSessions = sessions.filter(s => String(s.stationId) === String(station._id));
      const totalChargeTimeMs = stationSessions.reduce((sum, s) => {
        const endS = s.endTime ? new Date(s.endTime) : new Date();
        return sum + (endS.getTime() - new Date(s.startTime).getTime());
      }, 0);
      
      const totalPeriodMs = Math.max(1000, end.getTime() - start.getTime());
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

    // Faults by station
    const faultsByStation = stations.map(station => {
      const count = faults.filter(f => String(f.stationId) === String(station._id)).length;
      return {
        station: String(station._id),
        name: station.name,
        faults: count
      };
    });

    // Faults by type
    const faultTypeCounts = {};
    faults.forEach(f => {
      const type = f.type || "Other";
      faultTypeCounts[type] = (faultTypeCounts[type] || 0) + 1;
    });
    const faultsByType = Object.keys(faultTypeCounts).map(type => ({
      type,
      count: faultTypeCounts[type]
    }));

    // Grouped Revenue & Energy Trends
    const dailyEnergy = getTrendData(sessions, "startTime", "energyUsed", start, end).map(d => ({ day: d.label, energy: d.value }));
    const monthlyRevenue = getTrendData(sessions, "startTime", "cost", start, end).map(m => ({ month: m.label, revenue: m.value }));
    const downtimeTrends = getTrendData(
      faults.map(f => {
        const endF = f.resolvedAt ? new Date(f.resolvedAt) : new Date();
        const downtime = (endF.getTime() - new Date(f.createdAt).getTime()) / (1000 * 60 * 60);
        return { ...f, downtime };
      }),
      "createdAt",
      "downtime",
      start,
      end
    ).map(d => ({ label: d.label, downtime: d.value }));

    // Revenue by Station
    const revenueByStationMap = {};
    sessions.forEach(s => {
      const station = stations.find(st => String(st._id) === String(s.stationId));
      const stationName = station ? station.name : "Unknown Station";
      revenueByStationMap[stationName] = (revenueByStationMap[stationName] || 0) + (s.cost || 0);
    });
    const revenueByStation = Object.keys(revenueByStationMap).map(stationName => ({
      name: stationName,
      revenue: Number(revenueByStationMap[stationName].toFixed(2))
    }));

    // Revenue by Charger Type
    const revenueByChargerTypeMap = {};
    sessions.forEach(s => {
      const station = stations.find(st => String(st._id) === String(s.stationId));
      const chargerType = station ? (station.connectorType || "Type 2") : "Type 2";
      revenueByChargerTypeMap[chargerType] = (revenueByChargerTypeMap[chargerType] || 0) + (s.cost || 0);
    });
    const revenueByChargerType = Object.keys(revenueByChargerTypeMap).map(chargerType => ({
      name: chargerType,
      value: Number(revenueByChargerTypeMap[chargerType].toFixed(2))
    }));

    // Peak Usage Hours
    const hours = Array.from({ length: 24 }, (_, i) => ({ hour: `${i.toString().padStart(2, '0')}:00`, count: 0 }));
    sessions.forEach(s => {
      const hr = new Date(s.startTime).getHours();
      hours[hr].count += 1;
    });

    // Top Performing Stations
    const topPerformingStations = stations.map(station => {
      const stationSessions = sessions.filter(s => String(s.stationId) === String(station._id));
      const revenue = stationSessions.reduce((sum, s) => sum + (s.cost || 0), 0);
      return {
        name: station.name,
        revenue: Number(revenue.toFixed(2)),
        sessionsCount: stationSessions.length
      };
    }).sort((a, b) => b.revenue - a.revenue).slice(0, 5);

    // Fault Trends
    const faultTrends = getTrendData(faults, "createdAt", "_id", start, end).map(d => ({ label: d.label, count: d.value }));

    res.json({
      kpis: {
        totalFaultsMonth,
        avgResolutionHours,
        totalEnergyMonth,
        totalRevenueMonth,
        avgUtilization,
        totalSessionsMonth,
        avgSessionDuration,
        avgRevenuePerSession,
        activeStations,
        downtimeHours: Number(downtimeHours.toFixed(1))
      },
      charts: {
        dailyEnergy,
        monthlyRevenue,
        stationUtilization,
        faultsByStation,
        faultsByType,
        monthlyDowntime: downtimeTrends.map(d => ({ month: d.label, downtime: d.downtime })), // backward compatibility
        revenueByStation,
        revenueByChargerType,
        peakUsageHours: hours,
        topPerformingStations,
        sessionGrowth: getTrendData(sessions, "startTime", "_id", start, end).map(d => ({ label: d.label, sessions: d.value })),
        faultTrends,
        downtimeTrends
      }
    });
  } catch (error) {
    console.error("Reports API Error:", error);
    res.status(500).json({ error: "Server Error" });
  }
});

// GET /analytics/revenue
router.get("/analytics/revenue", protect, async (req, res) => {
  try {
    const { dateFilter, fromDate, toDate } = req.query;
    const { start, end } = parseDateRange(dateFilter, fromDate, toDate);
    const { stations, stationIds } = await getFilteredStationIds(req);

    if (stationIds.length === 0) {
      return res.json({ revenueTrends: [], revenueByStation: [], revenueByChargerType: [] });
    }

    const sessions = await Session.find({ stationId: { $in: stationIds }, startTime: { $gte: start, $lte: end } }).lean();

    const revenueTrends = getTrendData(sessions, "startTime", "cost", start, end);

    const revenueByStationMap = {};
    sessions.forEach(s => {
      const station = stations.find(st => String(st._id) === String(s.stationId));
      const stationName = station ? station.name : "Unknown Station";
      revenueByStationMap[stationName] = (revenueByStationMap[stationName] || 0) + (s.cost || 0);
    });
    const revenueByStation = Object.keys(revenueByStationMap).map(name => ({
      name,
      revenue: Number(revenueByStationMap[name].toFixed(2))
    }));

    const revenueByChargerTypeMap = {};
    sessions.forEach(s => {
      const station = stations.find(st => String(st._id) === String(s.stationId));
      const chargerType = station ? (station.connectorType || "Type 2") : "Type 2";
      revenueByChargerTypeMap[chargerType] = (revenueByChargerTypeMap[chargerType] || 0) + (s.cost || 0);
    });
    const revenueByChargerType = Object.keys(revenueByChargerTypeMap).map(name => ({
      name,
      value: Number(revenueByChargerTypeMap[name].toFixed(2))
    }));

    res.json({ revenueTrends, revenueByStation, revenueByChargerType });
  } catch (error) {
    console.error("Analytics Revenue Error:", error);
    res.status(500).json({ error: "Server Error" });
  }
});

// GET /analytics/sessions
router.get("/analytics/sessions", protect, async (req, res) => {
  try {
    const { dateFilter, fromDate, toDate } = req.query;
    const { start, end } = parseDateRange(dateFilter, fromDate, toDate);
    const { stationIds } = await getFilteredStationIds(req);

    if (stationIds.length === 0) {
      return res.json({ sessionTrends: [], peakUsageHours: [] });
    }

    const sessions = await Session.find({ stationId: { $in: stationIds }, startTime: { $gte: start, $lte: end } }).lean();

    const sessionTrends = getTrendData(sessions, "startTime", "_id", start, end).map(d => ({ label: d.label, count: d.value }));

    const hours = Array.from({ length: 24 }, (_, i) => ({ hour: `${i.toString().padStart(2, '0')}:00`, count: 0 }));
    sessions.forEach(s => {
      const hr = new Date(s.startTime).getHours();
      hours[hr].count += 1;
    });

    res.json({ sessionTrends, peakUsageHours: hours });
  } catch (error) {
    console.error("Analytics Sessions Error:", error);
    res.status(500).json({ error: "Server Error" });
  }
});

// GET /analytics/faults
router.get("/analytics/faults", protect, async (req, res) => {
  try {
    const { dateFilter, fromDate, toDate } = req.query;
    const { start, end } = parseDateRange(dateFilter, fromDate, toDate);
    const { stations, stationIds } = await getFilteredStationIds(req);

    if (stationIds.length === 0) {
      return res.json({ faultTrends: [], faultsByType: [], downtimeTrends: [] });
    }

    const faults = await Fault.find({ stationId: { $in: stationIds }, createdAt: { $gte: start, $lte: end } }).lean();

    const faultTrends = getTrendData(faults, "createdAt", "_id", start, end).map(d => ({ label: d.label, count: d.value }));

    const faultTypeCounts = {};
    faults.forEach(f => {
      const type = f.type || "Other";
      faultTypeCounts[type] = (faultTypeCounts[type] || 0) + 1;
    });
    const faultsByType = Object.keys(faultTypeCounts).map(type => ({
      type,
      count: faultTypeCounts[type]
    }));

    const downtimeTrends = getTrendData(
      faults.map(f => {
        const endF = f.resolvedAt ? new Date(f.resolvedAt) : new Date();
        const downtime = (endF.getTime() - new Date(f.createdAt).getTime()) / (1000 * 60 * 60);
        return { ...f, downtime };
      }),
      "createdAt",
      "downtime",
      start,
      end
    ).map(d => ({ label: d.label, downtime: d.value }));

    res.json({ faultTrends, faultsByType, downtimeTrends });
  } catch (error) {
    console.error("Analytics Faults Error:", error);
    res.status(500).json({ error: "Server Error" });
  }
});

// GET /analytics/utilization
router.get("/analytics/utilization", protect, async (req, res) => {
  try {
    const { dateFilter, fromDate, toDate } = req.query;
    const { start, end } = parseDateRange(dateFilter, fromDate, toDate);
    const { stations, stationIds } = await getFilteredStationIds(req);

    if (stationIds.length === 0) {
      return res.json({ stationUtilization: [], topPerformingStations: [] });
    }

    const sessions = await Session.find({ stationId: { $in: stationIds }, startTime: { $gte: start, $lte: end } }).lean();

    const stationUtilization = stations.map(station => {
      const stationSessions = sessions.filter(s => String(s.stationId) === String(station._id));
      const totalChargeTimeMs = stationSessions.reduce((sum, s) => {
        const endS = s.endTime ? new Date(s.endTime) : new Date();
        return sum + (endS.getTime() - new Date(s.startTime).getTime());
      }, 0);
      
      const totalPeriodMs = Math.max(1000, end.getTime() - start.getTime());
      let utilization = Number(((totalChargeTimeMs / totalPeriodMs) * 100).toFixed(1));
      utilization = Math.min(100, Math.max(0, utilization));
      return {
        station: String(station._id),
        name: station.name,
        utilization,
      };
    });

    const topPerformingStations = stations.map(station => {
      const stationSessions = sessions.filter(s => String(s.stationId) === String(station._id));
      const revenue = stationSessions.reduce((sum, s) => sum + (s.cost || 0), 0);
      return {
        name: station.name,
        revenue: Number(revenue.toFixed(2)),
        sessionsCount: stationSessions.length
      };
    }).sort((a, b) => b.revenue - a.revenue).slice(0, 5);

    res.json({ stationUtilization, topPerformingStations });
  } catch (error) {
    console.error("Analytics Utilization Error:", error);
    res.status(500).json({ error: "Server Error" });
  }
});

export default router;
