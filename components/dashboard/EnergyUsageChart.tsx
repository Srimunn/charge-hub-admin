"use client";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp } from 'lucide-react';
import { useAnalytics } from '@/hooks/use-analytics';

export function EnergyUsageChart() {
  const { data } = useAnalytics('sessions', 'today');
  const chartData = ((data as any)?.energyTrends || []).map((d: any) => ({ time: d.label, usage: d.energy }));
  const total = chartData.reduce((sum: number, d: any) => sum + (d.usage || 0), 0);
  const hasData = total > 0;

  return (
    <Card className="relative overflow-hidden w-full border-y-0 border-r-0 border-l-[6px] border-blue-600 bg-gradient-to-br from-blue-50/80 via-white to-indigo-50/30 dark:from-blue-950/20 dark:via-slate-900 dark:to-slate-900 rounded-2xl shadow-sm hover:shadow-md transition-all duration-200 ease-in-out animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base font-bold text-slate-900 dark:text-slate-100">Energy Usage Today</CardTitle>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">Energy delivered through the day (kWh)</p>
          </div>
          <div className={`flex items-center gap-1.5 ${hasData ? 'text-blue-700 bg-blue-100 dark:bg-blue-950 dark:text-blue-300' : 'text-slate-500 bg-slate-100 dark:bg-slate-800'} px-2.5 py-1 rounded-full border border-blue-200/50 dark:border-blue-800/50`}>
            <TrendingUp className="w-3.5 h-3.5 text-blue-600" />
            <span className="text-xs font-bold">{total.toFixed(1)} kWh</span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="energyGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#2563eb" stopOpacity={0.4} />
                <stop offset="60%" stopColor="#3b82f6" stopOpacity={0.15} />
                <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="4 4" stroke="rgba(148, 163, 184, 0.2)" vertical={false} />
            <XAxis
              dataKey="time"
              stroke="#64748b"
              fontSize={11}
              fontWeight={500}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke="#64748b"
              fontSize={11}
              fontWeight={500}
              tickFormatter={(value) => `${value}`}
              tickLine={false}
              axisLine={false}
              width={38}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '14px',
                boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.05)',
                fontSize: '12px',
                fontWeight: 600,
              }}
              labelStyle={{ color: '#0f172a', fontWeight: 700 }}
              formatter={(value: number) => [`${value} kWh`, 'Energy Usage']}
            />
            <Area
              type="monotone"
              dataKey="usage"
              stroke="#1d4ed8"
              strokeWidth={3}
              fill="url(#energyGradient)"
              dot={false}
              activeDot={{ r: 6, fill: '#1d4ed8', stroke: '#ffffff', strokeWidth: 3 }}
              animationDuration={1800}
              animationEasing="ease-in-out"
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
