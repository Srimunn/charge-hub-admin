"use client";
import { Radio, Zap, AlertTriangle, IndianRupee, Leaf, Plug, Wrench, ParkingCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { getDashboardKPIs } from '@/services/api';
import { useQuery } from '@tanstack/react-query';

export function KPICards() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['dashboardKPIs'],
    queryFn: getDashboardKPIs,
    refetchInterval: 5000, // Real-time polling
  });

  if (isLoading) {
    return <div className="p-4 text-center w-full">Loading Dashboard Metrics...</div>;
  }

  if (isError) {
    return <div className="p-4 text-center text-destructive w-full">Error loading metrics. Please ensure backend is running and DB is connected.</div>;
  }

  const {
    totalRevenue = 0,
    totalEnergyCost = 0,
    totalConvenienceFee = 0,
    totalTax = 0,
    activeSessions = 0,
    totalEnergy = 0,
    co2Saved = 0,
    onlineStations = 0,
    totalStations = 0,
    activeFaults = 0,
    maintenanceStations = 0,
    idleStations = 0
  } = (data as any) || {};

  const kpis = [
    {
      title: 'Total Revenue',
      value: `₹${totalRevenue.toFixed(2)}`,
      change: '+12.5% vs yesterday',
      icon: IndianRupee,
      iconColor: 'text-sky-600 dark:text-sky-400',
      bgColor: 'bg-sky-500/15',
      ringColor: 'ring-sky-500/30',
      borderAccent: 'border-sky-500',
      cardBg: 'bg-gradient-to-br from-sky-50/90 via-white to-blue-50/40 dark:from-sky-950/30 dark:via-slate-900 dark:to-slate-900',
      gradientFill: 'bg-gradient-to-r from-sky-400 to-blue-600',
      size: 'large' as const,
      tooltip: (
        <div className="space-y-1 text-xs">
          <div className="flex justify-between gap-4"><span>Energy Cost:</span> <span className="font-medium">₹{totalEnergyCost.toFixed(2)}</span></div>
          <div className="flex justify-between gap-4"><span>Conv. Fee:</span> <span className="font-medium">₹{totalConvenienceFee.toFixed(2)}</span></div>
          <div className="flex justify-between gap-4"><span>Tax/Surcharges:</span> <span className="font-medium">₹{totalTax.toFixed(2)}</span></div>
          <div className="border-t border-border/50 pt-1 mt-1 flex justify-between gap-4 font-bold text-primary"><span>Total:</span> <span>₹{totalRevenue.toFixed(2)}</span></div>
        </div>
      )
    },
    {
      title: 'Active Sessions',
      value: activeSessions,
      change: 'Live now',
      icon: Zap,
      iconColor: 'text-emerald-600 dark:text-emerald-400',
      bgColor: 'bg-emerald-500/15',
      ringColor: 'ring-emerald-500/30',
      borderAccent: 'border-emerald-500',
      cardBg: 'bg-gradient-to-br from-emerald-50/90 via-white to-teal-50/40 dark:from-emerald-950/30 dark:via-slate-900 dark:to-slate-900',
      gradientFill: 'bg-gradient-to-r from-emerald-400 to-teal-600',
      size: 'large' as const,
    },
    {
      title: 'Energy Delivered',
      value: `${(totalEnergy / 1000).toFixed(1)} MWh`,
      change: 'All time total',
      icon: Plug,
      iconColor: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-500/15',
      ringColor: 'ring-blue-500/30',
      borderAccent: 'border-blue-600',
      cardBg: 'bg-gradient-to-br from-blue-50/90 via-white to-indigo-50/40 dark:from-blue-950/30 dark:via-slate-900 dark:to-slate-900',
      gradientFill: 'bg-gradient-to-r from-blue-400 to-indigo-600',
      size: 'large' as const,
    },
    {
      title: 'CO₂ Saved',
      value: `${co2Saved.toFixed(1)} tons`,
      change: 'Environmental impact',
      icon: Leaf,
      iconColor: 'text-emerald-600 dark:text-emerald-400',
      bgColor: 'bg-emerald-500/15',
      ringColor: 'ring-emerald-500/30',
      borderAccent: 'border-emerald-500',
      cardBg: 'bg-gradient-to-br from-emerald-50/70 via-white to-emerald-100/30 dark:from-emerald-950/20 dark:via-slate-900 dark:to-slate-900',
      size: 'medium' as const,
    },
    {
      title: 'Stations Online',
      value: `${onlineStations}/${totalStations}`,
      change: 'Network status',
      icon: Radio,
      iconColor: 'text-sky-600 dark:text-sky-400',
      bgColor: 'bg-sky-500/15',
      ringColor: 'ring-sky-500/30',
      borderAccent: 'border-sky-500',
      cardBg: 'bg-gradient-to-br from-sky-50/70 via-white to-cyan-50/30 dark:from-sky-950/20 dark:via-slate-900 dark:to-slate-900',
      size: 'medium' as const,
    },
    {
      title: 'Fault Alerts',
      value: activeFaults,
      change: 'Require attention',
      icon: AlertTriangle,
      iconColor: activeFaults > 0 ? 'text-white' : 'text-rose-600 dark:text-rose-400',
      bgColor: activeFaults > 0 ? 'bg-rose-500 animate-pulse' : 'bg-rose-500/15',
      ringColor: activeFaults > 0 ? 'ring-rose-500' : 'ring-rose-500/30',
      borderAccent: 'border-rose-500',
      cardBg: activeFaults > 0 ? 'bg-gradient-to-br from-rose-100/90 via-rose-50 to-red-100/50 dark:from-rose-950/50 dark:via-slate-900 dark:to-slate-900' : 'bg-gradient-to-br from-rose-50/70 via-white to-red-50/30 dark:from-rose-950/20 dark:via-slate-900 dark:to-slate-900',
      size: 'medium' as const,
    },
    {
      title: 'Maintenance',
      value: maintenanceStations,
      change: 'In progress',
      icon: Wrench,
      iconColor: 'text-amber-600 dark:text-amber-400',
      bgColor: 'bg-amber-500/15',
      ringColor: 'ring-amber-500/30',
      borderAccent: 'border-amber-500',
      cardBg: 'bg-gradient-to-br from-amber-50/70 via-white to-yellow-50/30 dark:from-amber-950/20 dark:via-slate-900 dark:to-slate-900',
      size: 'small' as const,
    },
    {
      title: 'Idle Stations',
      value: Math.max(0, idleStations),
      change: 'Available',
      icon: ParkingCircle,
      iconColor: 'text-slate-500 dark:text-slate-400',
      bgColor: 'bg-slate-200/60 dark:bg-slate-800',
      ringColor: 'ring-slate-300 dark:ring-slate-700',
      borderAccent: 'border-slate-400',
      cardBg: 'bg-gradient-to-br from-slate-50/80 via-white to-slate-100/40 dark:from-slate-900/40 dark:via-slate-900 dark:to-slate-900',
      size: 'small' as const,
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {kpis.map((kpi, index) => {
        const spanClass = (kpi.size === 'large' || kpi.title === 'Fault Alerts')
          ? 'col-span-1 sm:col-span-2'
          : 'col-span-1 sm:col-span-1';

        const CardUI = (
          <Card
            key={kpi.title}
            className={`relative overflow-hidden w-full border-y-0 border-r-0 border-l-[6px] ${kpi.borderAccent} ${kpi.cardBg} rounded-2xl shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 ease-in-out animate-fade-in-up group ${spanClass}`}
            style={{ animationDelay: `${index * 0.05}s` }}
          >
            {/* Glow accent for large cards */}
            {kpi.size === 'large' && (
              <div className={`absolute top-0 right-0 w-36 h-36 ${kpi.bgColor} rounded-full blur-3xl opacity-30 -translate-y-1/2 translate-x-1/2 group-hover:opacity-50 transition-opacity duration-500`} />
            )}
            <CardContent className="p-5">
              <div className="flex items-start justify-between relative z-10">
                <div className="flex-1">
                  <p className="font-semibold text-slate-500 dark:text-slate-400 tracking-wider uppercase text-[11px] flex items-center gap-1.5">
                    {kpi.title} {kpi.tooltip && <span className="px-1.5 py-0.5 rounded-full bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300 text-[9px] cursor-pointer font-medium">Hover for breakdown</span>}
                  </p>
                  <h3 className={`font-bold mt-2 tracking-tight text-slate-900 dark:text-slate-100 ${
                    kpi.size === 'large' ? 'text-3xl' : 'text-2xl'
                  }`}>
                    {kpi.value}
                  </h3>
                  <p className="text-slate-500 dark:text-slate-400 mt-1.5 text-xs font-medium">
                    {kpi.change}
                  </p>
                  {/* Gradient progress bar for large cards */}
                  {kpi.size === 'large' && (
                    <div className={`mt-4 h-2.5 w-full bg-slate-200/70 dark:bg-slate-800 rounded-full overflow-hidden ${kpi.title === 'Active Sessions' && kpi.value > 0 ? 'ring-1 ring-emerald-400/30' : ''}`}>
                      <div
                        className={`h-full rounded-full transition-all duration-1000 ${kpi.gradientFill || 'bg-blue-600'} ${kpi.title === 'Active Sessions' && kpi.value > 0 ? 'animate-pulse' : 'animate-slide-in'}`}
                        style={{ width: `${Math.min(100, 40 + (typeof kpi.value === 'number' ? kpi.value * 10 : 20))}%`, animationDelay: `${0.2}s` }}
                      />
                    </div>
                  )}
                </div>
                <div className={`rounded-2xl ${kpi.bgColor} ring-1 ${kpi.ringColor} p-3.5 backdrop-blur-sm transition-transform duration-200 group-hover:scale-105 shadow-xs`}>
                  <kpi.icon className={`${kpi.iconColor} w-5 h-5`} />
                </div>
              </div>
            </CardContent>
          </Card>
        );

        return kpi.tooltip ? (
          <Tooltip key={kpi.title}>
            <TooltipTrigger asChild>
              {CardUI}
            </TooltipTrigger>
            <TooltipContent className="bg-card border shadow-xl p-3" side="right">
              {kpi.tooltip}
            </TooltipContent>
          </Tooltip>
        ) : CardUI;
      })}
    </div>
  );
}
