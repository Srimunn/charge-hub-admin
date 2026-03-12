import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { stationUtilizationData } from '@/data/mockData';
import { Radio } from 'lucide-react';

export function StationUtilizationChart() {
  return (
    <Card className="premium-card border-0 animate-fade-in-up" style={{ animationDelay: '0.6s' }}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base font-semibold">Station Utilization</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">Current usage by station</p>
          </div>
          <div className="flex items-center gap-1.5 text-primary bg-primary/10 px-2.5 py-1 rounded-lg">
            <Radio className="w-3.5 h-3.5" />
            <span className="text-xs font-semibold">Live</span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={stationUtilizationData} barCategoryGap="20%">
            <defs>
              <linearGradient id="utilizationHigh" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={1} />
                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.6} />
              </linearGradient>
              <linearGradient id="utilizationLow" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--accent))" stopOpacity={0.8} />
                <stop offset="100%" stopColor="hsl(var(--accent))" stopOpacity={0.4} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis
              dataKey="name"
              stroke="hsl(var(--muted-foreground))"
              fontSize={11}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke="hsl(var(--muted-foreground))"
              fontSize={11}
              tickFormatter={(v) => `${v}%`}
              tickLine={false}
              axisLine={false}
              width={40}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '12px',
                boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
                fontSize: '12px',
              }}
              formatter={(value: number) => [`${value}%`, 'Utilization']}
            />
            <Bar dataKey="utilization" radius={[8, 8, 0, 0]} animationDuration={1400} animationEasing="ease-in-out">
              {stationUtilizationData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.utilization > 70 ? 'url(#utilizationHigh)' : 'url(#utilizationLow)'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
