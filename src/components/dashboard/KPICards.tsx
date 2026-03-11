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
    // Large cards
    {
      title: 'Total Revenue',
      value: `₹${revenueToday.toFixed(2)}`,
      change: '+12.5% vs yesterday',
      icon: DollarSign,
      iconColor: 'text-accent',
      bgColor: 'bg-accent/10',
      size: 'large' as const,
    },
    {
      title: 'Active Sessions',
      value: activeSessions,
      change: 'Live now',
      icon: Zap,
      iconColor: 'text-success',
      bgColor: 'bg-success/10',
      size: 'large' as const,
    },
    {
      title: 'Energy Delivered',
      value: `${(totalEnergy / 1000).toFixed(1)} MWh`,
      change: 'All time total',
      icon: Plug,
      iconColor: 'text-primary',
      bgColor: 'bg-primary/10',
      size: 'large' as const,
    },
    // Medium cards
    {
      title: 'CO₂ Saved',
      value: `${(totalEnergy * 0.4 / 1000).toFixed(1)} tons`,
      change: 'Environmental impact',
      icon: Leaf,
      iconColor: 'text-success',
      bgColor: 'bg-success/10',
      size: 'medium' as const,
    },
    {
      title: 'Stations Online',
      value: `${onlineStations}/${mockStations.length}`,
      change: 'Network status',
      icon: Radio,
      iconColor: 'text-accent',
      bgColor: 'bg-accent/10',
      size: 'medium' as const,
    },
    {
      title: 'Fault Alerts',
      value: faultAlerts,
      change: 'Require attention',
      icon: AlertTriangle,
      iconColor: 'text-destructive',
      bgColor: 'bg-destructive/10',
      size: 'medium' as const,
    },
    // Small cards
    {
      title: 'Maintenance',
      value: maintenanceStations,
      change: 'In progress',
      icon: Wrench,
      iconColor: 'text-warning',
      bgColor: 'bg-warning/10',
      size: 'small' as const,
    },
    {
      title: 'Idle Stations',
      value: Math.max(0, idleStations),
      change: 'Available',
      icon: ParkingCircle,
      iconColor: 'text-muted-foreground',
      bgColor: 'bg-muted',
      size: 'small' as const,
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4 auto-rows-auto">
      {kpis.map((kpi, index) => {
        const sizeClasses = {
          large: 'col-span-2 row-span-1',
          medium: 'col-span-2 sm:col-span-2 row-span-1',
          small: 'col-span-1 sm:col-span-1 row-span-1',
        };

        return (
          <Card
            key={kpi.title}
            className={`relative overflow-hidden ${sizeClasses[kpi.size]} transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 animate-fade-in-up`}
            style={{ animationDelay: `${index * 0.08}s` }}
          >
            <CardContent className={`${kpi.size === 'small' ? 'p-4' : 'p-6'}`}>
              <div className="flex items-start justify-between">
                <div>
                  <p className={`font-medium text-muted-foreground ${kpi.size === 'small' ? 'text-xs' : 'text-sm'}`}>
                    {kpi.title}
                  </p>
                  <h3 className={`font-bold mt-1 ${
                    kpi.size === 'large' ? 'text-3xl' : kpi.size === 'medium' ? 'text-2xl' : 'text-xl'
                  }`}>
                    {kpi.value}
                  </h3>
                  <p className={`text-muted-foreground mt-1 ${kpi.size === 'small' ? 'text-[10px]' : 'text-xs'}`}>
                    {kpi.change}
                  </p>
                </div>
                <div className={`rounded-xl ${kpi.bgColor} ${kpi.size === 'small' ? 'p-2' : 'p-3'}`}>
                  <kpi.icon className={`${kpi.iconColor} ${kpi.size === 'small' ? 'w-4 h-4' : 'w-6 h-6'}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
