import { Radio, Zap, AlertTriangle, DollarSign } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { mockStations, mockChargingSessions, mockAlerts } from '@/data/mockData';

export function KPICards() {
  const totalStations = mockStations.length;
  const activeSessions = mockChargingSessions.filter(s => s.status === 'active').length;
  const faultAlerts = mockAlerts.filter(a => !a.acknowledged).length;
  const revenueToday = mockChargingSessions.reduce((sum, s) => sum + s.revenue, 0);

  const kpis = [
    {
      title: 'Total Stations',
      value: totalStations,
      change: '+2 this month',
      icon: Radio,
      gradient: 'gradient-primary',
      iconColor: 'text-primary',
      bgColor: 'bg-primary/10',
    },
    {
      title: 'Active Sessions',
      value: activeSessions,
      change: 'Live now',
      icon: Zap,
      gradient: 'gradient-success',
      iconColor: 'text-success',
      bgColor: 'bg-success/10',
    },
    {
      title: 'Fault Alerts',
      value: faultAlerts,
      change: 'Require attention',
      icon: AlertTriangle,
      gradient: 'gradient-danger',
      iconColor: 'text-destructive',
      bgColor: 'bg-destructive/10',
    },
    {
      title: 'Revenue Today',
      value: `$${revenueToday.toFixed(2)}`,
      change: '+12.5% vs yesterday',
      icon: DollarSign,
      gradient: 'gradient-warning',
      iconColor: 'text-warning',
      bgColor: 'bg-warning/10',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {kpis.map((kpi) => (
        <Card key={kpi.title} className="relative overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">{kpi.title}</p>
                <h3 className="text-3xl font-bold mt-2">{kpi.value}</h3>
                <p className="text-xs text-muted-foreground mt-1">{kpi.change}</p>
              </div>
              <div className={`p-3 rounded-xl ${kpi.bgColor}`}>
                <kpi.icon className={`w-6 h-6 ${kpi.iconColor}`} />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
