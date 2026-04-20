
import { Leaf, Award } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { mockChargingSessions } from '@/data/mockData';

export function SustainabilityCards() {
    // Simple estimation: 0.7 kg CO2 per kWh
    const CO2_FACTOR = 0.7;

    // Calculate total energy delivered today
    // For mock data, we'll just sum up all active sessions' charging power * duration (approx)
    // In a real app, you'd filter by date
    const totalEnergyToday = mockChargingSessions.reduce((sum, s) => {
        // Estimating energy as power (kW) * duration (hours)
        // Duration in mock data seems to be in minutes based on context from Sessions.tsx
        const energyKwh = s.chargingPower * (s.duration / 60);
        return sum + energyKwh;
    }, 0);

    // Calculate for "This Month" - for mock purposes multiply by 30 to simulate volume
    const totalEnergyMonth = totalEnergyToday * 30;

    const co2SavedToday = totalEnergyToday * CO2_FACTOR;
    const co2SavedMonth = totalEnergyMonth * CO2_FACTOR;

    const kpis = [
        {
            title: 'CO₂ Saved Today',
            value: `${co2SavedToday.toFixed(1)}`,
            unit: 'kg CO₂',
            subtitle: 'Estimated from energy delivered',
            icon: Leaf,
            iconColor: 'text-emerald-600',
            bgColor: 'bg-emerald-100 dark:bg-emerald-900/20',
        },
        {
            title: 'CO₂ Saved This Month',
            value: `${(co2SavedMonth / 1000).toFixed(2)}`,
            unit: 'tons CO₂',
            subtitle: 'Estimated from energy delivered',
            icon: Award,
            iconColor: 'text-blue-600',
            bgColor: 'bg-blue-100 dark:bg-blue-900/20',
        },
    ];

    return (
        <div className="space-y-4">
            <h2 className="text-2xl font-bold tracking-tight">Sustainability</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {kpis.map((kpi) => (
                    <Card key={kpi.title} className="relative overflow-hidden">
                        <CardContent className="p-6">
                            <div className="flex items-start justify-between">
                                <div>
                                    <p className="text-sm font-medium text-muted-foreground">{kpi.title}</p>
                                    <div className="flex items-baseline gap-2 mt-2">
                                        <h3 className="text-3xl font-bold">{kpi.value}</h3>
                                        <span className="text-sm font-medium text-muted-foreground">{kpi.unit}</span>
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-1">{kpi.subtitle}</p>
                                </div>
                                <div className={`p-3 rounded-xl ${kpi.bgColor}`}>
                                    <kpi.icon className={`w-6 h-6 ${kpi.iconColor}`} />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <p className="text-xs text-muted-foreground italic">
                * CO₂ savings are estimated using an emission factor of 0.7 kg CO₂ per kWh.
            </p>
        </div>
    );
}
