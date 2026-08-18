"use client";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Leaf, TrendingUp, ShieldCheck } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { getDashboardKPIs } from '@/services/api';

export function CO2SavingsChart() {
  const { data } = useQuery({ queryKey: ['dashboardKPIs'], queryFn: getDashboardKPIs, refetchInterval: 5000 });
  const kpiData: any = data || {};
  const co2Saved = kpiData.co2Saved || 0;
  
  const chartData = [
    { name: 'CO₂ Saved', value: co2Saved > 0 ? co2Saved : 0.1 },
    { name: 'Target Remaining', value: Math.max(0, 100 - co2Saved) },
  ];

  return (
    <Card className="relative overflow-hidden w-full border-y-0 border-r-0 border-l-[6px] border-emerald-500 bg-gradient-to-br from-emerald-50/80 via-white to-teal-50/30 dark:from-emerald-950/20 dark:via-slate-900 dark:to-slate-900 rounded-2xl shadow-sm hover:shadow-md transition-all duration-200 ease-in-out animate-fade-in-up" style={{ animationDelay: '0.5s' }}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base font-bold text-slate-900 dark:text-slate-100">CO₂ Savings</CardTitle>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">Environmental impact tracker</p>
          </div>
          <div className="flex items-center gap-1.5 text-emerald-700 bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-300 px-2.5 py-1 rounded-full border border-emerald-200/50 dark:border-emerald-800/50">
            <Leaf className="w-3.5 h-3.5 text-emerald-600" />
            <span className="text-xs font-bold">{co2Saved.toFixed(1)} tons</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col items-center justify-center p-6">
        <div className="relative">
          <ResponsiveContainer width={260} height={240}>
            <PieChart>
              <defs>
                <linearGradient id="co2Gradient" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#059669" />
                  <stop offset="50%" stopColor="#10b981" />
                  <stop offset="100%" stopColor="#0d9488" />
                </linearGradient>
              </defs>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={78}
                outerRadius={108}
                paddingAngle={5}
                dataKey="value"
                animationDuration={1600}
                animationEasing="ease-in-out"
                stroke="none"
              >
                <Cell key="cell-0" fill="url(#co2Gradient)" />
                <Cell key="cell-1" fill="#e2e8f0" />
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)',
                  fontSize: '12px',
                  fontWeight: 600
                }}
                formatter={(value: number, name: string) => [`${value.toFixed(1)} tons`, name]}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-3xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">{co2Saved.toFixed(1)}</span>
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">tons saved</span>
          </div>
        </div>

        {/* Legend / Comparison Label */}
        <div className="flex flex-wrap items-center justify-center gap-3 mt-3 pt-3 border-t border-slate-200/60 dark:border-slate-800 w-full text-xs text-slate-600 dark:text-slate-400">
          <div className="flex items-center gap-1.5 font-medium">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
            <span>+14.2% vs last month</span>
          </div>
          <div className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-700 hidden sm:block" />
          <div className="flex items-center gap-1.5 font-medium">
            <ShieldCheck className="w-3.5 h-3.5 text-sky-600" />
            <span>100 Ton Annual Target</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
