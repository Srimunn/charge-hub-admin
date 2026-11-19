"use client";

import { useQuery } from "@tanstack/react-query";
import {
  getFaultAnalytics,
  getRevenueAnalytics,
  getSessionAnalytics,
  getUtilizationAnalytics,
} from "@/services/api";

export type DateFilter = "today" | "yesterday" | "last7" | "last30" | "week" | "month" | "quarter" | "halfyear" | "yearly" | "all";

const fetchers = {
  revenue: getRevenueAnalytics,
  sessions: getSessionAnalytics,
  faults: getFaultAnalytics,
  utilization: getUtilizationAnalytics,
} as const;

/** Dashboard analytics from the backend, refreshed every 30 s (realtime events also invalidate "analytics"). */
export function useAnalytics(kind: keyof typeof fetchers, dateFilter: DateFilter) {
  return useQuery({
    queryKey: ["analytics", kind, dateFilter],
    queryFn: () => fetchers[kind]({ dateFilter }),
    refetchInterval: 30000,
  });
}

export const shortName = (name?: string) => {
  const n = String(name || "Station");
  return n.length > 14 ? `${n.slice(0, 13)}…` : n;
};
