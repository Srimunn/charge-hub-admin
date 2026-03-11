import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { energyUsageData } from '@/data/mockData';
import { TrendingUp } from 'lucide-react';

export function EnergyUsageChart() {
  return (
    <Card className="premium-card border-0 animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base font-semibold">Energy Usage Today</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">Hourly consumption trend</p>
          </div>
          <div className="flex items-center gap-1.5 text-success bg-success/10 px-2.5 py-1 rounded-lg">
            <TrendingUp className="w-3.5 h-3.5" />
            <span className="text-xs font-semibold">+8.2%</span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={energyUsageData}>
            <defs>
              <linearGradient id="energyGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis
              dataKey="time"
              stroke="hsl(var(--muted-foreground))"
              fontSize={11}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke="hsl(var(--muted-foreground))"
              fontSize={11}
              tickFormatter={(value) => `${value}`}
              tickLine={false}
              axisLine={false}
              width={35}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '12px',
                boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
                fontSize: '12px',
              }}
              labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 600 }}
            />
            <Area
              type="monotone"
              dataKey="usage"
              stroke="hsl(var(--primary))"
              strokeWidth={2.5}
              fill="url(#energyGradient)"
              dot={false}
              activeDot={{ r: 5, fill: 'hsl(var(--primary))', stroke: 'white', strokeWidth: 2 }}
              animationDuration={1800}
              animationEasing="ease-in-out"
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
