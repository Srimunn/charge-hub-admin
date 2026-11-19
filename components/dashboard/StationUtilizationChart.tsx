"use client";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';
import { Radio } from 'lucide-react';
import { useAnalytics, shortName } from '@/hooks/use-analytics';

const BAR_GRADIENTS = [
  { id: 'gradBlue0', start: '#2563eb', end: '#1d4ed8' },
  { id: 'gradCyan1', start: '#0ea5e9', end: '#0284c7' },
  { id: 'gradTeal2', start: '#0d9488', end: '#0f766e' },
  { id: 'gradSky3', start: '#38bdf8', end: '#0284c7' },
  { id: 'gradIndigo4', start: '#3b82f6', end: '#1e40af' },
  { id: 'gradMint5', start: '#14b8a6', end: '#0d9488' },
];

export function StationUtilizationChart() {
  const { data } = useAnalytics('utilization', 'last7');
  const chartData = [...((data as any)?.stationUtilization || [])]
    .sort((a: any, b: any) => b.utilization - a.utilization)
    .slice(0, 6)
    .map((d: any) => ({ name: shortName(d.name), utilization: d.utilization }));
  const hasData = chartData.some((d: any) => d.utilization > 0);

  return (
    <Card className="relative overflow-hidden w-full border-y-0 border-r-0 border-l-[6px] border-sky-500 bg-gradient-to-br from-sky-50/80 via-white to-blue-50/30 dark:from-sky-950/20 dark:via-slate-900 dark:to-slate-900 rounded-2xl shadow-sm hover:shadow-md transition-all duration-200 ease-in-out animate-fade-in-up" style={{ animationDelay: '0.6s' }}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base font-bold text-slate-900 dark:text-slate-100">Station Utilization</CardTitle>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">Share of time charging, last 7 days</p>
          </div>
          <div className={`flex items-center gap-1.5 ${hasData ? 'text-sky-700 bg-sky-100 dark:bg-sky-950 dark:text-sky-300' : 'text-slate-500 bg-slate-100 dark:bg-slate-800'} px-2.5 py-1 rounded-full border border-sky-200/50 dark:border-sky-800/50`}>
            <Radio className={`w-3.5 h-3.5 ${hasData ? 'animate-pulse text-sky-600' : ''}`} />
            <span className="text-xs font-bold">{hasData ? 'Active' : 'No usage'}</span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={450}>
          <BarChart data={chartData} barCategoryGap="22%">
            <defs>
              {BAR_GRADIENTS.map((g) => (
                <linearGradient key={g.id} id={g.id} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={g.start} stopOpacity={1} />
                  <stop offset="100%" stopColor={g.end} stopOpacity={0.8} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="4 4" stroke="rgba(148, 163, 184, 0.2)" vertical={false} />
            <XAxis
              dataKey="name"
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
              tickFormatter={(v) => `${v}%`}
              tickLine={false}
              axisLine={false}
              width={40}
              domain={[0, 100]}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '14px',
                boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.05)',
                fontSize: '12px',
                fontWeight: '600',
              }}
              formatter={(value: number) => [`${value}%`, 'Utilization']}
            />
            <Bar dataKey="utilization" radius={[8, 8, 0, 0]} animationDuration={1400} animationEasing="ease-in-out">
              <LabelList dataKey="utilization" position="top" formatter={(v: number) => (v > 0 ? `${v}%` : '')} fill="#64748b" fontSize={11} fontWeight={600} />
              {chartData.map((_: any, index: number) => (
                <Cell
                  key={`cell-${index}`}
                  fill={`url(#${BAR_GRADIENTS[index % BAR_GRADIENTS.length].id})`}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
