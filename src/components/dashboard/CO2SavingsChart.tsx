import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Leaf } from 'lucide-react';
import { mockStations } from '@/data/mockData';

const totalEnergy = mockStations.reduce((sum, s) => sum + s.totalEnergy, 0);
const co2Saved = totalEnergy * 0.4 / 1000;

const data = [
  { name: 'CO₂ Saved', value: co2Saved },
  { name: 'Remaining Target', value: Math.max(0, 100 - co2Saved) },
];

const COLORS = ['hsl(var(--success))', 'hsl(var(--secondary))'];

export function CO2SavingsChart() {
  return (
    <Card className="premium-card border-0 animate-fade-in-up" style={{ animationDelay: '0.5s' }}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base font-semibold">CO₂ Savings</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">Environmental impact tracker</p>
          </div>
          <div className="flex items-center gap-1.5 text-success bg-success/10 px-2.5 py-1 rounded-lg">
            <Leaf className="w-3.5 h-3.5" />
            <span className="text-xs font-semibold">{co2Saved.toFixed(1)} tons</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex items-center justify-center">
        <div className="relative">
          <ResponsiveContainer width={220} height={220}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={70}
                outerRadius={100}
                paddingAngle={4}
                dataKey="value"
                animationDuration={1600}
                animationEasing="ease-in-out"
                stroke="none"
              >
                {data.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '12px',
                  fontSize: '12px',
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold text-foreground">{co2Saved.toFixed(1)}</span>
            <span className="text-xs text-muted-foreground">tons saved</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
