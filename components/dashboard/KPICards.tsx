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
      iconColor: 'text-accent',
      bgColor: 'bg-accent/10',
      ringColor: 'ring-accent/20',
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
      iconColor: 'text-success',
      bgColor: 'bg-success/10',
      ringColor: 'ring-success/20',
      size: 'large' as const,
    },
    {
      title: 'Energy Delivered',
      value: `${(totalEnergy / 1000).toFixed(1)} MWh`,
      change: 'All time total',
      icon: Plug,
      iconColor: 'text-primary',
      bgColor: 'bg-primary/10',
      ringColor: 'ring-primary/20',
      size: 'large' as const,
    },
    {
      title: 'CO₂ Saved',
      value: `${co2Saved.toFixed(1)} tons`,
      change: 'Environmental impact',
      icon: Leaf,
      iconColor: 'text-success',
      bgColor: 'bg-success/10',
      ringColor: 'ring-success/20',
      size: 'medium' as const,
    },
    {
      title: 'Stations Online',
      value: `${onlineStations}/${totalStations}`,
      change: 'Network status',
      icon: Radio,
      iconColor: 'text-accent',
      bgColor: 'bg-accent/10',
      ringColor: 'ring-accent/20',
      size: 'medium' as const,
    },
    {
      title: 'Fault Alerts',
      value: activeFaults,
      change: 'Require attention',
      icon: AlertTriangle,
      iconColor: activeFaults > 0 ? 'text-white' : 'text-destructive',
      bgColor: activeFaults > 0 ? 'bg-destructive animate-pulse' : 'bg-destructive/10',
      ringColor: activeFaults > 0 ? 'ring-destructive' : 'ring-destructive/20',
      size: 'medium' as const,
    },
    {
      title: 'Maintenance',
      value: maintenanceStations,
      change: 'In progress',
      icon: Wrench,
      iconColor: 'text-warning',
      bgColor: 'bg-warning/10',
      ringColor: 'ring-warning/20',
      size: 'small' as const,
    },
    {
      title: 'Idle Stations',
      value: Math.max(0, idleStations),
      change: 'Available',
      icon: ParkingCircle,
      iconColor: 'text-muted-foreground',
      bgColor: 'bg-muted',
      ringColor: 'ring-muted/30',
      size: 'small' as const,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4">
      {kpis.map((kpi, index) => {
        const spanClass = kpi.size === 'small' ? 'col-span-1' : 'col-span-2';

        const CardUI = (
          <Card
            key={kpi.title}
            className={`premium-card relative overflow-hidden w-full border-y-0 border-r-0 border-l-4 ${kpi.iconColor.replace('text-', 'border-')} animate-fade-in-up group ${spanClass}`}
            style={{ animationDelay: `${index * 0.06}s` }}
          >
            {/* Glow accent for large cards */}
            {kpi.size === 'large' && (
              <div className={`absolute top-0 right-0 w-32 h-32 ${kpi.bgColor} rounded-full blur-3xl opacity-40 -translate-y-1/2 translate-x-1/2 group-hover:opacity-60 transition-opacity duration-500`} />
            )}
            <CardContent className="p-5">
              <div className="flex items-start justify-between relative z-10">
                <div className="flex-1">
                  <p className="font-semibold text-muted-foreground tracking-wider uppercase text-[11px] flex items-center gap-1.5">
                    {kpi.title} {kpi.tooltip && <span className="px-1.5 py-0.5 rounded-full bg-primary/10 text-primary text-[9px] cursor-pointer">Hover for breakdown</span>}
                  </p>
                  <h3 className={`font-bold mt-2 tracking-tight ${
                    kpi.size === 'large' ? 'text-3xl' : 'text-2xl'
                  }`}>
                    {kpi.value}
                  </h3>
                  <p className="text-muted-foreground mt-1.5 text-xs">
                    {kpi.change}
                  </p>
                  {/* Mini progress bar for large cards */}
                  {kpi.size === 'large' && (
                    <div className={`mt-4 h-2 w-full bg-secondary rounded-full overflow-hidden ${kpi.title === 'Active Sessions' && kpi.value > 0 ? 'ring-1 ring-success/20' : ''}`}>
                      <div
                        className={`h-full rounded-full transition-all duration-1000 ${kpi.iconColor.replace('text-', 'bg-')} ${kpi.title === 'Active Sessions' && kpi.value > 0 ? 'animate-pulse' : 'animate-slide-in'}`}
                        style={{ width: `${Math.min(100, 40 + (typeof kpi.value === 'number' ? kpi.value * 10 : 20))}%`, animationDelay: `${0.2}s` }}
                      />
                    </div>
                  )}
                </div>
                <div className={`rounded-2xl ${kpi.bgColor} ring-1 ${kpi.ringColor} p-3.5 backdrop-blur-sm transition-transform duration-300 group-hover:scale-110`}>
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
