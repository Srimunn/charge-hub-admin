"use client";

import { DashboardHeader } from '@/components/layout/DashboardHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileText, FileSpreadsheet, ShieldAlert, Clock, BarChart3, AlertCircle, Zap, Calendar, TrendingUp } from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { getReports } from '@/services/api';
import { useToast } from '@/hooks/use-toast';
import { useQuery } from '@tanstack/react-query';

const chartTooltipStyle = {
  backgroundColor: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '8px',
};

export default function ReportsPage() {
  const { toast } = useToast();

  const { data, isLoading } = useQuery({
    queryKey: ["reports"],
    queryFn: getReports,
  });

  const handleExport = (type: 'pdf' | 'csv') => {
    toast({ title: 'Export Started', description: `Generating ${type.toUpperCase()} report...` });
    setTimeout(() => {
      toast({ title: 'Export Complete', description: `Report has been downloaded as ${type.toUpperCase()}` });
    }, 1500);
  };

  const kpis = data?.kpis;
  const charts = data?.charts;

  const isEmpty = !data || (
    kpis.totalSessionsMonth === 0 && 
    kpis.totalFaultsMonth === 0 && 
    kpis.totalEnergyMonth === 0 &&
    kpis.totalRevenueMonth === 0
  );

  return (
    <div className="flex flex-col min-h-screen">
      <DashboardHeader title="Reports & Analytics" subtitle="Detailed performance insights" />
      
      <div className="flex-1 p-6 space-y-6">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">Loading reports and analytics...</div>
        ) : isEmpty ? (
          <Card className="border-dashed bg-muted/20 border-border">
            <CardContent className="flex flex-col items-center justify-center p-16 text-muted-foreground">
              <BarChart3 className="w-16 h-16 mb-4 opacity-40 text-primary animate-pulse" />
              <h3 className="text-xl font-bold text-foreground">No Reports Available</h3>
              <p className="text-sm text-center max-w-sm mt-2">
                Currently, there are no charging session records or faults registered. Complete active sessions to unlock network performance reports.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Export Actions */}
            <Card>
              <CardContent className="flex flex-wrap items-center justify-between gap-4 p-4">
                <div>
                  <h3 className="font-semibold">Export Reports</h3>
                  <p className="text-sm text-muted-foreground">Download data for further analysis</p>
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => handleExport('pdf')} variant="outline" className="gap-2">
                    <FileText className="w-4 h-4" /> Export PDF
                  </Button>
                  <Button onClick={() => handleExport('csv')} variant="outline" className="gap-2">
                    <FileSpreadsheet className="w-4 h-4" /> Export CSV
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4 text-center">
                  <div className="flex justify-center mb-2"><ShieldAlert className="w-6 h-6 text-destructive" /></div>
                  <p className="text-sm text-muted-foreground">Total Faults (Month)</p>
                  <p className="text-2xl font-bold mt-1 font-mono">{kpis.totalFaultsMonth}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <div className="flex justify-center mb-2"><Clock className="w-6 h-6 text-warning" /></div>
                  <p className="text-sm text-muted-foreground">Avg Resolution Time</p>
                  <p className="text-2xl font-bold mt-1 font-mono">{kpis.avgResolutionHours}h</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <div className="flex justify-center mb-2"><Zap className="w-6 h-6 text-primary" /></div>
                  <p className="text-sm text-muted-foreground">Total Energy (Month)</p>
                  <p className="text-2xl font-bold mt-1 font-mono">{kpis.totalEnergyMonth.toFixed(1)} kWh</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <div className="flex justify-center mb-2"><TrendingUp className="w-6 h-6 text-success" /></div>
                  <p className="text-sm text-muted-foreground">Total Revenue (Month)</p>
                  <p className="text-2xl font-bold mt-1 font-mono">₹{kpis.totalRevenueMonth.toFixed(2)}</p>
                </CardContent>
              </Card>
            </div>

            {/* Fault Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card>
                <CardHeader><CardTitle>Faults by Station</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={charts.faultsByStation}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={10} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} allowDecimals={false} />
                      <Tooltip contentStyle={chartTooltipStyle} />
                      <Bar dataKey="faults" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>Faults by Type</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={charts.faultsByType}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="type" stroke="hsl(var(--muted-foreground))" fontSize={10} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} allowDecimals={false} />
                      <Tooltip contentStyle={chartTooltipStyle} />
                      <Bar dataKey="count" fill="hsl(var(--warning))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>Downtime (hours/month)</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={charts.monthlyDowntime}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <Tooltip contentStyle={chartTooltipStyle} />
                      <Line type="monotone" dataKey="downtime" stroke="hsl(var(--destructive))" strokeWidth={2} dot={{ fill: 'hsl(var(--destructive))' }} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            {/* Revenue & Energy Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader><CardTitle>Daily Energy Consumption</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={charts.dailyEnergy}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(v) => `${v} kWh`} />
                      <Tooltip contentStyle={chartTooltipStyle} />
                      <Bar dataKey="energy" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>Monthly Revenue</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={charts.monthlyRevenue}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(v) => `₹${v}`} />
                      <Tooltip contentStyle={chartTooltipStyle} formatter={(value: number) => [`₹${value.toLocaleString()}`, 'Revenue']} />
                      <Line type="monotone" dataKey="revenue" stroke="hsl(var(--success))" strokeWidth={3} dot={{ fill: 'hsl(var(--success))' }} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            {/* Station Utilization */}
            <Card>
              <CardHeader><CardTitle>Station Utilization</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={charts.stationUtilization} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(v) => `${v}%`} />
                    <YAxis type="category" dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} width={120} />
                    <Tooltip contentStyle={chartTooltipStyle} formatter={(value: number) => [`${value}%`, 'Utilization']} />
                    <Bar dataKey="utilization" fill="hsl(var(--info))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Summary Stats Footer */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-sm text-muted-foreground">Avg Utilization</p>
                  <p className="text-2xl font-bold mt-1 font-mono">{kpis.avgUtilization}%</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-sm text-muted-foreground">Sessions (Month)</p>
                  <p className="text-2xl font-bold mt-1 font-mono">{kpis.totalSessionsMonth}</p>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
