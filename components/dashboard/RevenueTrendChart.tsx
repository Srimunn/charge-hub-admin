"use client";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { monthlyRevenueData } from '@/data/mockData';
import { TrendingUp } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { getDashboardKPIs } from '@/services/api';

export function RevenueTrendChart() {
  const { data } = useQuery({ queryKey: ['dashboardKPIs'], queryFn: getDashboardKPIs, refetchInterval: 5000 });
  const kpiData: any = data || {};
  const hasData = (kpiData.totalRevenue || 0) > 0;
  const chartData = hasData ? monthlyRevenueData : monthlyRevenueData.map(d => ({ ...d, revenue: 0 }));

  return (
    <Card className="relative overflow-hidden w-full border-y-0 border-r-0 border-l-[6px] border-sky-500 bg-gradient-to-br from-sky-50/80 via-white to-blue-50/30 dark:from-sky-950/20 dark:via-slate-900 dark:to-slate-900 rounded-2xl shadow-sm hover:shadow-md transition-all duration-200 ease-in-out animate-fade-in-up" style={{ animationDelay: '0.45s' }}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base font-bold text-slate-900 dark:text-slate-100">Revenue Trend</CardTitle>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">Monthly revenue growth</p>
          </div>
          <div className={`flex items-center gap-1.5 ${hasData ? 'text-sky-700 bg-sky-100 dark:bg-sky-950 dark:text-sky-300' : 'text-slate-500 bg-slate-100 dark:bg-slate-800'} px-2.5 py-1 rounded-full border border-sky-200/50 dark:border-sky-800/50`}>
            <TrendingUp className="w-3.5 h-3.5 text-sky-600" />
            <span className="text-xs font-bold">{hasData ? '+18.4%' : '0.0%'}</span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="revTrendGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0284c7" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#0284c7" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="4 4" stroke="rgba(148, 163, 184, 0.2)" vertical={false} />
            <XAxis dataKey="month" stroke="#64748b" fontSize={11} fontWeight={500} tickLine={false} axisLine={false} />
            <YAxis stroke="#64748b" fontSize={11} fontWeight={500} tickFormatter={(v) => `₹${(v/1000).toFixed(0)}k`} tickLine={false} axisLine={false} width={45} />
            <Tooltip
              contentStyle={{
                backgroundColor: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '14px',
                boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.05)',
                fontSize: '12px',
                fontWeight: 600,
              }}
              formatter={(value: number) => [`₹${value.toLocaleString()}`, 'Revenue']}
            />
            <Area
              type="monotone"
              dataKey="revenue"
              stroke="#0284c7"
              strokeWidth={3}
              fill="url(#revTrendGradient)"
              dot={false}
              activeDot={{ r: 6, fill: '#0284c7', stroke: '#ffffff', strokeWidth: 3 }}
              animationDuration={1800}
              animationEasing="ease-in-out"
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
