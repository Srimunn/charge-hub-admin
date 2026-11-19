import express from "express";
import { and, eq, gte, ilike, inArray, lte } from "drizzle-orm";
import { db, schema, round2 } from "../db/index.js";
import { protect, operatorOnly } from "../middleware/authMiddleware.js";

const router = express.Router();
router.use(protect, operatorOnly);

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
const getTrendData = (items, dateField, valueField, rangeStart, rangeEnd) => {
  // Clamp open-ended ranges ("all time") to the data actually present (max 24 months).
  const now = new Date();
  let start = new Date(rangeStart);
  let end = new Date(Math.min(rangeEnd.getTime(), now.getTime() + 60 * 1000));
  if (now.getTime() - start.getTime() > 2 * 365 * 86400000) {
    const times = items.map((i) => new Date(i[dateField]).getTime()).filter(Number.isFinite);
    const earliest = times.length ? Math.min(...times) : now.getTime() - 30 * 86400000;
    start = new Date(Math.max(earliest, now.getTime() - 730 * 86400000));
  }
  if (end <= start) end = new Date(start.getTime() + 86400000);
  const diffDays = (end.getTime() - start.getTime()) / 86400000;

  const pad = (n) => String(n).padStart(2, "0");
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  let groupFn;
  let step;
  if (diffDays <= 2) {
    // 2-hour buckets
    groupFn = (d) => `${diffDays > 1.01 ? `${pad(d.getDate())} ${MONTHS[d.getMonth()]} ` : ""}${pad(d.getHours() - (d.getHours() % 2))}:00`;
    step = (d) => d.setHours(d.getHours() + 2);
    start.setMinutes(0, 0, 0);
    start.setHours(start.getHours() - (start.getHours() % 2));
  } else if (diffDays > 60) {
    groupFn = (d) => `${MONTHS[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`;
    step = (d) => d.setMonth(d.getMonth() + 1);
    start = new Date(start.getFullYear(), start.getMonth(), 1);
  } else {
    groupFn = (d) => `${MONTHS[d.getMonth()]} ${pad(d.getDate())}`;
    step = (d) => d.setDate(d.getDate() + 1);
    start = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  }

  const slots = new Map();
  for (const curr = new Date(start); curr <= end && slots.size < 400; step(curr)) slots.set(groupFn(curr), 0);

  for (const item of items) {
    const d = new Date(item[dateField]);
    const label = groupFn(d);
    if (!slots.has(label)) continue;
    const v = valueField ? Number(item[valueField]) || 0 : 1;
    slots.set(label, slots.get(label) + v);
  }
  return Array.from(slots.entries()).map(([label, val]) => ({ label, value: Number(val.toFixed(2)) }));
};

// Stations visible to this operator (admin: all), with optional dashboard filters
const getFilteredStationIds = async (req) => {
  const { stationId, chargerType, status, searchQuery } = req.query;
  const S = schema.stations;
  const conds = [];
  if (req.user.role !== "admin") conds.push(eq(S.userId, req.user.id));
  if (stationId) conds.push(eq(S.id, String(stationId)));
  if (chargerType) conds.push(eq(S.connectorType, String(chargerType)));
  if (status && ["online", "offline", "maintenance"].includes(status)) conds.push(eq(S.status, status));
  if (searchQuery) conds.push(ilike(S.name, `%${String(searchQuery).replace(/[\\%_]/g, (c) => "\\" + c)}%`));
  const stations = await (conds.length ? db.select().from(S).where(and(...conds)) : db.select().from(S));
  return { stations: stations.map((s) => ({ ...s, _id: s.id })), stationIds: stations.map((s) => s.id) };
};

const sessionsIn = async (stationIds, start, end, status) => {
  if (stationIds.length === 0) return [];
  const C = schema.chargingSessions;
  const conds = [inArray(C.stationId, stationIds), gte(C.startTime, start), lte(C.startTime, end)];
  if (status) conds.push(eq(C.status, String(status)));
  const rows = await db.select().from(C).where(and(...conds));
  return rows.map((r) => ({ ...r, _id: r.id }));
};

const faultsIn = async (stationIds, start, end) => {
  if (stationIds.length === 0) return [];
  const F = schema.faults;
  const rows = await db.select().from(F).where(and(inArray(F.stationId, stationIds), gte(F.createdAt, start), lte(F.createdAt, end)));
  return rows.map((r) => ({ ...r, _id: r.id }));
};

// GET DASHBOARD KPIS (main dashboard tab)
router.get("/kpis", async (req, res) => {
  try {
    const { stations, stationIds } = await getFilteredStationIds({ ...req, query: {} });
    const all = await sessionsIn(stationIds, new Date(0), new Date(Date.now() + 86400000));
    const activeTx = all.filter((t) => t.status === "active" || t.status === "FAULT_PAUSED");
    const completed = all.filter((t) => t.status === "completed");
    const activeFaults = stationIds.length
      ? (await db.select({ id: schema.faults.id }).from(schema.faults).where(and(inArray(schema.faults.stationId, stationIds), eq(schema.faults.status, "active")))).length
      : 0;

    const sum = (arr, f) => round2(arr.reduce((acc, t) => acc + (Number(f(t)) || 0), 0));
    const totalEnergy = sum(completed, (t) => t.energyUsed);
    const onlineStations = stations.filter((s) => ["online", "charging"].includes(s.status)).length;

    res.json({
      totalRevenue: sum(completed, (t) => t.cost),
      totalEnergyCost: sum(completed, (t) => (t.energyUsed || 0) * (t.appliedPrice || 0)),
      totalConvenienceFee: sum(completed, (t) => t.convenienceFee),
      totalTax: sum(completed, (t) => t.tax),
      activeSessions: activeTx.length,
      totalSessions: all.length,
      totalEnergy,
      // ~0.82 kg CO2/kWh Indian grid vs petrol equivalent is complex; keep the existing 0.4 kg/kWh factor (tonnes)
      co2Saved: round2((totalEnergy * 0.4) / 1000),
      onlineStations,
      totalStations: stations.length,
      activeFaults,
      maintenanceStations: stations.filter((s) => s.status === "maintenance").length,
      offlineStations: stations.filter((s) => s.status === "offline").length,
      idleStations: Math.max(0, onlineStations - activeTx.length),
    });
  } catch (error) {
    console.error("Dashboard KPI Error:", error.message);
    res.status(500).json({ error: "Server Error" });
  }
});

// GET COMPREHENSIVE REPORTS
router.get("/reports", async (req, res) => {
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

    const sessions = await sessionsIn(stationIds, start, end, sessionStatus);
    const faults = await faultsIn(stationIds, start, end);

    // Calculate KPIs
    const totalRevenueMonth = sessions.reduce((sum, s) => sum + (s.cost || 0), 0);
    const totalEnergyMonth = sessions.reduce((sum, s) => sum + (s.energyUsed || 0), 0);
    const totalSessionsMonth = sessions.length;

    // Active stations
    const activeStationsSet = new Set(sessions.map(s => String(s.stationId)));
    const activeStations = activeStationsSet.size;

    // Fault count and downtime
    const totalFaultsMonth = faults.length;
    const resolvedFaults = faults.filter(f => f.status === "resolved");
    
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
      
      const totalPeriodMs = Math.max(3600000, Math.min(end.getTime(), Date.now()) - Math.max(start.getTime(), new Date(station.createdAt).getTime()));
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
    const faultTrends = getTrendData(faults, "createdAt", null, start, end).map(d => ({ label: d.label, count: d.value }));

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
        sessionGrowth: getTrendData(sessions, "startTime", null, start, end).map(d => ({ label: d.label, sessions: d.value })),
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
router.get("/analytics/revenue", async (req, res) => {
  try {
    const { dateFilter, fromDate, toDate } = req.query;
    const { start, end } = parseDateRange(dateFilter, fromDate, toDate);
    const { stations, stationIds } = await getFilteredStationIds(req);

    if (stationIds.length === 0) {
      return res.json({ revenueTrends: [], revenueByStation: [], revenueByChargerType: [] });
    }

    const sessions = await sessionsIn(stationIds, start, end);

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
router.get("/analytics/sessions", async (req, res) => {
  try {
    const { dateFilter, fromDate, toDate } = req.query;
    const { start, end } = parseDateRange(dateFilter, fromDate, toDate);
    const { stationIds } = await getFilteredStationIds(req);

    if (stationIds.length === 0) {
      return res.json({ sessionTrends: [], energyTrends: [], peakUsageHours: [] });
    }

    const sessions = await sessionsIn(stationIds, start, end);

    const sessionTrends = getTrendData(sessions, "startTime", null, start, end).map(d => ({ label: d.label, count: d.value }));

    const hours = Array.from({ length: 24 }, (_, i) => ({ hour: `${i.toString().padStart(2, '0')}:00`, count: 0 }));
    sessions.forEach(s => {
      const hr = new Date(s.startTime).getHours();
      hours[hr].count += 1;
    });

    const energyTrends = getTrendData(sessions, "startTime", "energyUsed", start, end).map(d => ({ label: d.label, energy: d.value }));

    res.json({ sessionTrends, energyTrends, peakUsageHours: hours });
  } catch (error) {
    console.error("Analytics Sessions Error:", error);
    res.status(500).json({ error: "Server Error" });
  }
});

// GET /analytics/faults
router.get("/analytics/faults", async (req, res) => {
  try {
    const { dateFilter, fromDate, toDate } = req.query;
    const { start, end } = parseDateRange(dateFilter, fromDate, toDate);
    const { stations, stationIds } = await getFilteredStationIds(req);

    if (stationIds.length === 0) {
      return res.json({ faultTrends: [], faultsByType: [], downtimeTrends: [] });
    }

    const faults = await faultsIn(stationIds, start, end);

    const faultTrends = getTrendData(faults, "createdAt", null, start, end).map(d => ({ label: d.label, count: d.value }));

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
router.get("/analytics/utilization", async (req, res) => {
  try {
    const { dateFilter, fromDate, toDate } = req.query;
    const { start, end } = parseDateRange(dateFilter, fromDate, toDate);
    const { stations, stationIds } = await getFilteredStationIds(req);

    if (stationIds.length === 0) {
      return res.json({ stationUtilization: [], topPerformingStations: [] });
    }

    const sessions = await sessionsIn(stationIds, start, end);

    const stationUtilization = stations.map(station => {
      const stationSessions = sessions.filter(s => String(s.stationId) === String(station._id));
      const totalChargeTimeMs = stationSessions.reduce((sum, s) => {
        const endS = s.endTime ? new Date(s.endTime) : new Date();
        return sum + (endS.getTime() - new Date(s.startTime).getTime());
      }, 0);
      
      const totalPeriodMs = Math.max(3600000, Math.min(end.getTime(), Date.now()) - Math.max(start.getTime(), new Date(station.createdAt).getTime()));
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
