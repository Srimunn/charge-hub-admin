"use client";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { IndianRupee } from 'lucide-react';
import { useAnalytics, shortName } from '@/hooks/use-analytics';

export function RevenuePerStationChart() {
  const { data } = useAnalytics('revenue', 'last30');
  const chartData = [...((data as any)?.revenueByStation || [])]
    .sort((a: any, b: any) => b.revenue - a.revenue)
    .slice(0, 6)
    .map((d: any) => ({ name: shortName(d.name), revenue: d.revenue }));
  const hasData = chartData.some((d: any) => d.revenue > 0);

  return (
    <Card className="relative overflow-hidden w-full border-y-0 border-r-0 border-l-[6px] border-blue-600 bg-gradient-to-br from-blue-50/80 via-white to-sky-50/30 dark:from-blue-950/20 dark:via-slate-900 dark:to-slate-900 rounded-2xl shadow-sm hover:shadow-md transition-all duration-200 ease-in-out animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base font-bold text-slate-900 dark:text-slate-100">Revenue per Station</CardTitle>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">Top stations, last 30 days</p>
          </div>
          <div className={`flex items-center gap-1.5 ${hasData ? 'text-sky-700 bg-sky-100 dark:bg-sky-950 dark:text-sky-300' : 'text-slate-500 bg-slate-100 dark:bg-slate-800'} px-2.5 py-1 rounded-full border border-sky-200/50 dark:border-sky-800/50`}>
            <IndianRupee className="w-3.5 h-3.5 text-sky-600" />
            <span className="text-xs font-bold">₹ Revenue</span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={chartData} barCategoryGap="25%">
            <defs>
              <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#2563eb" stopOpacity={1} />
                <stop offset="100%" stopColor="#1d4ed8" stopOpacity={0.7} />
              </linearGradient>
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
              tickFormatter={(value) => `₹${value}`}
              tickLine={false}
              axisLine={false}
              width={45}
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
              formatter={(value: number) => [`₹${value}`, 'Revenue']}
            />
            <Bar
              dataKey="revenue"
              fill="url(#barGradient)"
              radius={[8, 8, 0, 0]}
              animationDuration={1400}
              animationEasing="ease-in-out"
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
