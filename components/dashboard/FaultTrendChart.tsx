"use client";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { AlertTriangle } from 'lucide-react';

const faultTrendData = [
  { week: 'W1', faults: 8 },
  { week: 'W2', faults: 12 },
  { week: 'W3', faults: 6 },
  { week: 'W4', faults: 15 },
  { week: 'W5', faults: 9 },
  { week: 'W6', faults: 4 },
  { week: 'W7', faults: 7 },
  { week: 'W8', faults: 3 },
];

import { useQuery } from '@tanstack/react-query';
import { getDashboardKPIs } from '@/services/api';

export function FaultTrendChart() {
  const { data } = useQuery({ queryKey: ['dashboardKPIs'], queryFn: getDashboardKPIs, refetchInterval: 5000 });
  const kpiData: any = data || {};
  const hasFaults = (kpiData.activeFaults || 0) > 0;
  const chartData = hasFaults ? faultTrendData : faultTrendData.map(d => ({ ...d, faults: 0 }));

  return (
    <Card className="relative overflow-hidden w-full border-y-0 border-r-0 border-l-[6px] border-rose-500 bg-gradient-to-br from-rose-50/70 via-white to-red-50/30 dark:from-rose-950/20 dark:via-slate-900 dark:to-slate-900 rounded-2xl shadow-sm hover:shadow-md transition-all duration-200 ease-in-out animate-fade-in-up" style={{ animationDelay: '0.7s' }}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base font-bold text-slate-900 dark:text-slate-100">Fault Trend</CardTitle>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">Weekly fault occurrences</p>
          </div>
          <div className={`flex items-center gap-1.5 ${hasFaults ? 'text-rose-700 bg-rose-100 dark:bg-rose-950 dark:text-rose-300' : 'text-emerald-700 bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-300'} px-2.5 py-1 rounded-full border ${hasFaults ? 'border-rose-200/50 dark:border-rose-800/50' : 'border-emerald-200/50 dark:border-emerald-800/50'}`}>
            <AlertTriangle className={`w-3.5 h-3.5 ${hasFaults ? 'text-rose-600 animate-pulse' : 'text-emerald-600'}`} />
            <span className="text-xs font-bold">{hasFaults ? '⚠️ Active' : 'All Clear'}</span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={chartData}>
            <defs>
              <linearGradient id="faultGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f43f5e" stopOpacity={0.25} />
                <stop offset="100%" stopColor="#f43f5e" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="4 4" stroke="rgba(148, 163, 184, 0.2)" vertical={false} />
            <XAxis dataKey="week" stroke="#64748b" fontSize={11} fontWeight={500} tickLine={false} axisLine={false} />
            <YAxis stroke="#64748b" fontSize={11} fontWeight={500} tickLine={false} axisLine={false} width={30} />
            <Tooltip
              contentStyle={{
                backgroundColor: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '14px',
                boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.05)',
                fontSize: '12px',
                fontWeight: 600,
              }}
              formatter={(value: number) => [`${value} faults`, 'Occurrences']}
            />
            <Line
              type="monotone"
              dataKey="faults"
              stroke="#f43f5e"
              strokeWidth={3}
              dot={{ r: 4, fill: '#f43f5e', stroke: '#ffffff', strokeWidth: 2 }}
              activeDot={{ r: 6, fill: '#f43f5e', stroke: '#ffffff', strokeWidth: 3 }}
              animationDuration={1600}
              animationEasing="ease-in-out"
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
