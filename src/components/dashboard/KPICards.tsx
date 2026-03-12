import { Radio, Zap, AlertTriangle, DollarSign, Leaf, Plug, Wrench, ParkingCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { mockStations, mockChargingSessions, mockAlerts } from '@/data/mockData';

export function KPICards() {
  const activeSessions = mockChargingSessions.filter(s => s.status === 'active').length;
  const faultAlerts = mockAlerts.filter(a => !a.acknowledged).length;
  const revenueToday = mockChargingSessions.reduce((sum, s) => sum + s.revenue, 0);
  const totalEnergy = mockStations.reduce((sum, s) => sum + s.totalEnergy, 0);
  const onlineStations = mockStations.filter(s => s.status === 'online').length;
  const idleStations = mockStations.filter(s => s.status === 'online').length - activeSessions;
  const maintenanceStations = mockStations.filter(s => s.status === 'maintenance').length;

  const kpis = [
    {
      title: 'Total Revenue',
      value: `₹${revenueToday.toFixed(2)}`,
      change: '+12.5% vs yesterday',
      icon: DollarSign,
      iconColor: 'text-accent',
      bgColor: 'bg-accent/10',
      ringColor: 'ring-accent/20',
      size: 'large' as const,
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
      value: `${(totalEnergy * 0.4 / 1000).toFixed(1)} tons`,
      change: 'Environmental impact',
      icon: Leaf,
      iconColor: 'text-success',
      bgColor: 'bg-success/10',
      ringColor: 'ring-success/20',
      size: 'medium' as const,
    },
    {
      title: 'Stations Online',
      value: `${onlineStations}/${mockStations.length}`,
      change: 'Network status',
      icon: Radio,
      iconColor: 'text-accent',
      bgColor: 'bg-accent/10',
      ringColor: 'ring-accent/20',
      size: 'medium' as const,
    },
    {
      title: 'Fault Alerts',
      value: faultAlerts,
      change: 'Require attention',
      icon: AlertTriangle,
      iconColor: 'text-destructive',
      bgColor: 'bg-destructive/10',
      ringColor: 'ring-destructive/20',
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
    <div className="grid grid-cols-12 gap-4 lg:gap-5 auto-rows-auto">
      {kpis.map((kpi, index) => {
        const sizeClasses = {
          large: 'col-span-12 sm:col-span-6 lg:col-span-4 row-span-1',
          medium: 'col-span-6 lg:col-span-4',
          small: 'col-span-6 lg:col-span-3',
        };

        return (
          <Card
            key={kpi.title}
            className={`premium-card relative overflow-hidden ${sizeClasses[kpi.size]} border-0 animate-fade-in-up group`}
            style={{ animationDelay: `${index * 0.06}s` }}
          >
            {/* Glow accent for large cards */}
            {kpi.size === 'large' && (
              <div className={`absolute top-0 right-0 w-32 h-32 ${kpi.bgColor} rounded-full blur-3xl opacity-40 -translate-y-1/2 translate-x-1/2 group-hover:opacity-60 transition-opacity duration-500`} />
            )}
            <CardContent className={kpi.size === 'small' ? 'p-4' : kpi.size === 'large' ? 'p-6' : 'p-5'}>
              <div className="flex items-start justify-between relative z-10">
                <div className="flex-1">
                  <p className={`font-semibold text-muted-foreground tracking-wider uppercase ${kpi.size === 'small' ? 'text-[10px]' : 'text-[11px]'}`}>
                    {kpi.title}
                  </p>
                  <h3 className={`font-bold mt-2 tracking-tight ${
                    kpi.size === 'large' ? 'text-3xl lg:text-4xl' : kpi.size === 'medium' ? 'text-2xl' : 'text-xl'
                  }`}>
                    {kpi.value}
                  </h3>
                  <p className={`text-muted-foreground mt-1.5 ${kpi.size === 'small' ? 'text-[10px]' : 'text-xs'}`}>
                    {kpi.change}
                  </p>
                  {/* Mini progress bar for large cards */}
                  {kpi.size === 'large' && (
                    <div className="mt-4 h-1 w-full bg-secondary rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${kpi.iconColor.replace('text-', 'bg-')} animate-slide-in`}
                        style={{ width: `${60 + index * 12}%`, animationDelay: `${0.5 + index * 0.1}s` }}
                      />
                    </div>
                  )}
                </div>
                <div className={`rounded-2xl ${kpi.bgColor} ring-1 ${kpi.ringColor} ${kpi.size === 'small' ? 'p-2.5' : kpi.size === 'large' ? 'p-4' : 'p-3.5'} backdrop-blur-sm transition-transform duration-300 group-hover:scale-110`}>
                  <kpi.icon className={`${kpi.iconColor} ${kpi.size === 'small' ? 'w-4 h-4' : kpi.size === 'large' ? 'w-7 h-7' : 'w-5 h-5'}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
