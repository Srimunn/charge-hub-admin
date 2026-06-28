"use client";

import { useState, useMemo, useEffect } from 'react';
import { DashboardHeader } from '@/components/layout/DashboardHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  FileText,
  FileSpreadsheet,
  ShieldAlert,
  Clock,
  BarChart3,
  AlertCircle,
  Zap,
  Calendar,
  TrendingUp,
  Search,
  Filter,
  RefreshCw,
  Info,
  MapPin,
  Activity,
  Layers,
  Award,
  Download
} from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell
} from 'recharts';
import { getReports, getStations } from '@/services/api';
import { useToast } from '@/hooks/use-toast';
import { useQuery } from '@tanstack/react-query';

const chartTooltipStyle = {
  backgroundColor: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '8px',
};

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

export default function ReportsPage() {
  const { toast } = useToast();

  const [activeFilters, setActiveFilters] = useState({
    dateFilter: 'month',
    fromDate: '',
    toDate: '',
    stationId: '',
    chargerType: '',
    status: '',
    searchQuery: '',
  });

  const [filterForm, setFilterForm] = useState({ ...activeFilters });

  // Load user stations for filter dropdown
  const { data: stations } = useQuery({
    queryKey: ["stations"],
    queryFn: () => getStations(),
  });

  // Query aggregated analytics based on active filters
  const { data, isLoading } = useQuery({
    queryKey: ["reports", activeFilters],
    queryFn: () => getReports(activeFilters),
  });

  const kpis = data?.kpis;
  const charts = data?.charts;

  // Drill down details
  const [drillDownStation, setDrillDownStation] = useState<any>(null);
  const [isDrillDownOpen, setIsDrillDownOpen] = useState(false);

  const handleChartClick = (node: any) => {
    if (!node || !node.activePayload || node.activePayload.length === 0) return;
    const payload = node.activePayload[0].payload;
    // Find station
    const stationName = payload.name || payload.stationName;
    const station = (stations || []).find((s: any) => s.name === stationName);
    if (station) {
      // Aggregate specific metrics for drill down
      const utilizationObj = (charts?.stationUtilization || []).find((u: any) => u.name === station.name);
      const faultsObj = (charts?.faultsByStation || []).find((f: any) => f.name === station.name);
      const revenueObj = (charts?.revenueByStation || []).find((r: any) => r.name === station.name);

      setDrillDownStation({
        ...station,
        utilization: utilizationObj?.utilization ?? 0,
        faultsCount: faultsObj?.faults ?? 0,
        revenue: revenueObj?.revenue ?? 0,
      });
      setIsDrillDownOpen(true);
    }
  };

  const handleApplyFilters = () => {
    setActiveFilters({ ...filterForm });
    toast({ title: 'Filters Applied', description: 'Refreshing reports datasets...' });
  };

  const handleResetFilters = () => {
    const cleared = {
      dateFilter: 'month',
      fromDate: '',
      toDate: '',
      stationId: '',
      chargerType: '',
      status: '',
      searchQuery: '',
    };
    setFilterForm(cleared);
    setActiveFilters(cleared);
    toast({ title: 'Filters Reset', description: 'Reports reset to default This Month view.' });
  };

  // Expose empty checks
  const isDataEmpty = useMemo(() => {
    if (!kpis) return true;
    return kpis.totalSessionsMonth === 0 && kpis.totalFaultsMonth === 0 && kpis.totalEnergyMonth === 0;
  }, [kpis]);

  // Chart Empty State Placeholder
  const renderEmptyPlaceholder = () => (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/90 backdrop-blur-sm z-10 transition-all rounded-xl p-4">
      <AlertCircle className="w-8 h-8 text-muted-foreground opacity-50 mb-2" />
      <p className="text-sm font-semibold text-foreground text-center">No data available for selected date range.</p>
      <p className="text-xs text-muted-foreground text-center mt-0.5">Modify parameters or complete active charges to view stats.</p>
      <Button 
        variant="outline" 
        size="sm" 
        className="mt-3 text-xs h-7" 
        onClick={() => {
          setFilterForm(prev => ({ ...prev, dateFilter: 'all' }));
          setActiveFilters(prev => ({ ...prev, dateFilter: 'all' }));
        }}
      >
        Select Another Date Range
      </Button>
    </div>
  );

  // PDF Export
  const handleExportPDF = () => {
    toast({ title: 'Export Started', description: `Generating PDF report...` });
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast({ title: 'Export Failed', description: 'Failed to open print window.', variant: 'destructive' });
      return;
    }

    const title = `ChargeHub EV Network Analytics Report`;
    const dateStr = new Date().toLocaleString();

    const stationRows = (charts?.stationUtilization || []).map((s: any) => {
      const rev = (charts?.revenueByStation || []).find((r: any) => r.name === s.name)?.revenue ?? 0;
      const flts = (charts?.faultsByStation || []).find((f: any) => f.name === s.name)?.faults ?? 0;
      return `
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #ddd;">${s.name}</td>
          <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">${s.utilization}%</td>
          <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">₹${rev.toFixed(2)}</td>
          <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">${flts}</td>
        </tr>
      `;
    }).join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>${title}</title>
          <style>
            body { font-family: system-ui, sans-serif; color: #1e293b; padding: 40px; }
            h1 { font-size: 24px; margin-bottom: 5px; color: #0f172a; }
            h2 { font-size: 16px; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; margin-top: 30px; }
            .meta { font-size: 12px; color: #64748b; margin-bottom: 20px; }
            .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 30px; }
            .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; text-align: center; }
            .card-title { font-size: 11px; color: #64748b; text-transform: uppercase; margin-bottom: 4px; }
            .card-value { font-size: 18px; font-weight: 700; color: #0f172a; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 13px; }
            th { background: #f1f5f9; padding: 8px; text-align: left; border-bottom: 2px solid #cbd5e1; font-size: 11px; text-transform: uppercase; color: #475569; }
          </style>
        </head>
        <body>
          <h1>ChargeHub EV Charging Network Report</h1>
          <div class="meta">Generated on ${dateStr} | Filters: Filter Presets (${activeFilters.dateFilter.toUpperCase()})</div>
          
          <h2>Key Metrics</h2>
          <div class="grid">
            <div class="card"><div class="card-title">Total Revenue</div><div class="card-value">₹${kpis?.totalRevenueMonth.toFixed(2) ?? "0.00"}</div></div>
            <div class="card"><div class="card-title">Energy Delivered</div><div class="card-value">${kpis?.totalEnergyMonth.toFixed(1) ?? "0.0"} kWh</div></div>
            <div class="card"><div class="card-title">Total Sessions</div><div class="card-value">${kpis?.totalSessionsMonth ?? 0}</div></div>
            <div class="card"><div class="card-title">Active Stations</div><div class="card-value">${kpis?.activeStations ?? 0}</div></div>
            <div class="card"><div class="card-title">Total Faults</div><div class="card-value">${kpis?.totalFaultsMonth ?? 0}</div></div>
            <div class="card"><div class="card-title">Downtime Hours</div><div class="card-value">${kpis?.downtimeHours ?? 0}h</div></div>
            <div class="card"><div class="card-title">Avg Session</div><div class="card-value">${kpis?.avgSessionDuration ?? 0} min</div></div>
            <div class="card"><div class="card-title">Avg Revenue/Session</div><div class="card-value">₹${kpis?.avgRevenuePerSession ?? 0}</div></div>
          </div>

          <h2>Station Performances</h2>
          <table>
            <thead>
              <tr>
                <th>Station Name</th>
                <th style="text-align: right;">Utilization</th>
                <th style="text-align: right;">Revenue</th>
                <th style="text-align: right;">Fault Count</th>
              </tr>
            </thead>
            <tbody>
              ${stationRows || '<tr><td colspan="4" style="text-align:center;">No records available</td></tr>'}
            </tbody>
          </table>

          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // CSV Export
  const handleExportCSV = () => {
    toast({ title: 'Export Started', description: `Generating CSV report...` });
    let csv = "ChargeHub EV Network Performance Report\n";
    csv += `Generated at: ${new Date().toLocaleString()}\n`;
    csv += `Active filters: Date=${activeFilters.dateFilter}, From=${activeFilters.fromDate}, To=${activeFilters.toDate}\n\n`;

    csv += "--- METRICS ---\n";
    csv += `Total Revenue (INR),₹${kpis?.totalRevenueMonth.toFixed(2) ?? 0}\n`;
    csv += `Energy Delivered (kWh),${kpis?.totalEnergyMonth ?? 0}\n`;
    csv += `Total Sessions,${kpis?.totalSessionsMonth ?? 0}\n`;
    csv += `Active Stations,${kpis?.activeStations ?? 0}\n`;
    csv += `Fault Count,${kpis?.totalFaultsMonth ?? 0}\n`;
    csv += `Downtime (hours),${kpis?.downtimeHours ?? 0}\n`;
    csv += `Avg Session Duration (min),${kpis?.avgSessionDuration ?? 0}\n`;
    csv += `Avg Revenue Per Session (INR),₹${kpis?.avgRevenuePerSession ?? 0}\n\n`;

    csv += "--- STATION ANALYTICS ---\n";
    csv += "Station Name,Utilization (%),Revenue (INR),Faults\n";
    (charts?.stationUtilization || []).forEach((s: any) => {
      const rev = (charts?.revenueByStation || []).find((r: any) => r.name === s.name)?.revenue ?? 0;
      const flts = (charts?.faultsByStation || []).find((f: any) => f.name === s.name)?.faults ?? 0;
      csv += `"${s.name}",${s.utilization},${rev},${flts}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", `chargehub_report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast({ title: 'Export Complete', description: 'Report downloaded as CSV' });
  };

  // Excel Mock Export
  const handleExportExcel = () => {
    toast({ title: 'Excel Export', description: `Generating spreadsheet...` });
    let xls = "ChargeHub EV Network Analytics Sheet\n\n";
    xls += "METRICS SUMMARY\n";
    xls += `Total Revenue\t₹${kpis?.totalRevenueMonth.toFixed(2) ?? 0}\n`;
    xls += `Energy Delivered\t${kpis?.totalEnergyMonth ?? 0} kWh\n`;
    xls += `Total Sessions\t${kpis?.totalSessionsMonth ?? 0}\n`;
    xls += `Active Stations\t${kpis?.activeStations ?? 0}\n\n`;
    
    xls += "STATION PERFORMANCE DETAIL\n";
    xls += "Station Name\tUtilization\tRevenue\tFaults\n";
    (charts?.stationUtilization || []).forEach((s: any) => {
      const rev = (charts?.revenueByStation || []).find((r: any) => r.name === s.name)?.revenue ?? 0;
      const flts = (charts?.faultsByStation || []).find((f: any) => f.name === s.name)?.faults ?? 0;
      xls += `${s.name}\t${s.utilization}%\t₹${rev}\t${flts}\n`;
    });

    const blob = new Blob([xls], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", `chargehub_report_${new Date().toISOString().split('T')[0]}.xls`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast({ title: 'Export Complete', description: 'Spreadsheet has been downloaded' });
  };

  return (
    <div className="flex flex-col min-h-screen">
      <DashboardHeader 
        title="Reports & Analytics" 
        subtitle="Detailed EV network performance insights" 
      />
      
      <div className="flex-1 p-4 md:p-6 space-y-4 md:space-y-6">
        {/* Filter Controls Bar */}
        <Card className="border border-black/5 shadow-sm">
          <CardHeader className="pb-3 flex flex-row items-center gap-2">
            <Filter className="w-4 h-4 text-primary" />
            <CardTitle className="text-base font-semibold">Analytical Filters</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              
              {/* Date Filter Presets (Scrollable Chips) */}
              <div className="space-y-1.5 col-span-1 sm:col-span-2 md:col-span-4">
                <Label>Date Range</Label>
                <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-none snap-x">
                  {[
                    { value: 'today', label: 'Today' },
                    { value: 'yesterday', label: 'Yesterday' },
                    { value: 'last7', label: 'Last 7 Days' },
                    { value: 'last30', label: 'Last 30 Days' },
                    { value: 'week', label: 'This Week' },
                    { value: 'month', label: 'This Month' },
                    { value: 'quarter', label: 'This Quarter' },
                    { value: 'halfyear', label: 'Half Yearly' },
                    { value: 'yearly', label: 'Yearly' },
                    { value: 'all', label: 'All Time' },
                    { value: 'custom', label: 'Custom Range' },
                  ].map((preset) => {
                    const isSelected = filterForm.dateFilter === preset.value;
                    return (
                      <Button
                        key={preset.value}
                        type="button"
                        variant={isSelected ? 'default' : 'outline'}
                        onClick={() => setFilterForm({ ...filterForm, dateFilter: preset.value })}
                        className="h-11 md:h-9 text-sm md:text-xs rounded-full shrink-0 snap-align-start px-4 font-semibold"
                      >
                        {preset.label}
                      </Button>
                    );
                  })}
                </div>
              </div>

              {/* Station Selection */}
              <div className="space-y-1.5">
                <Label>Station</Label>
                <Select 
                  value={filterForm.stationId} 
                  onValueChange={(val) => setFilterForm({ ...filterForm, stationId: val === "all" ? "" : val })}
                >
                  <SelectTrigger className="bg-white dark:bg-slate-900 border-slate-200 h-11 md:h-10">
                    <SelectValue placeholder="All Stations" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Stations</SelectItem>
                    {(stations || []).map((s: any) => (
                      <SelectItem key={s._id} value={s._id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>


              {/* Status */}
              <div className="space-y-1.5">
                <Label>Station Status</Label>
                <Select 
                  value={filterForm.status} 
                  onValueChange={(val) => setFilterForm({ ...filterForm, status: val === "all" ? "" : val })}
                >
                  <SelectTrigger className="bg-white dark:bg-slate-900 border-slate-200 h-11 md:h-10">
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="online">Online</SelectItem>
                    <SelectItem value="offline">Offline</SelectItem>
                    <SelectItem value="maintenance">Maintenance</SelectItem>
                  </SelectContent>
                </Select>
              </div>

            </div>

            {/* Custom Range Picker Fields (Visible conditionally) */}
            {filterForm.dateFilter === 'custom' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-black/5 animate-in slide-in-from-top-1 duration-200">
                <div className="space-y-1.5">
                  <Label>From Date</Label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-3.5 h-4 w-4 text-slate-500" />
                    <Input 
                      type="date" 
                      value={filterForm.fromDate} 
                      onChange={(e) => setFilterForm({ ...filterForm, fromDate: e.target.value })}
                      className="pl-10 h-11 md:h-10 bg-white dark:bg-slate-900" 
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>To Date</Label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-3.5 h-4 w-4 text-slate-500" />
                    <Input 
                      type="date" 
                      value={filterForm.toDate} 
                      onChange={(e) => setFilterForm({ ...filterForm, toDate: e.target.value })}
                      className="pl-10 h-11 md:h-10 bg-white dark:bg-slate-900" 
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Action Bar */}
            <div className="flex flex-col lg:flex-row justify-between items-stretch lg:items-center pt-2 gap-4 border-t border-black/5">
              <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto">
                <Button onClick={handleApplyFilters} className="w-full sm:w-auto h-11 md:h-10 px-5">Apply Filters</Button>
                <Button onClick={handleResetFilters} variant="outline" className="w-full sm:w-auto h-11 md:h-10">Reset Filters</Button>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto">
                <Button onClick={handleExportPDF} variant="outline" className="h-11 md:h-10 lg:h-9 text-sm md:text-xs gap-1.5 w-full sm:w-auto px-4">
                  <FileText className="w-4 h-4 text-red-500" /> <span className="inline">Export PDF</span>
                </Button>
                <Button onClick={handleExportCSV} variant="outline" className="h-11 md:h-10 lg:h-9 text-sm md:text-xs gap-1.5 w-full sm:w-auto px-4">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" /> <span className="inline">Export CSV</span>
                </Button>
                <Button onClick={handleExportExcel} variant="outline" className="h-11 md:h-10 lg:h-9 text-sm md:text-xs gap-1.5 w-full sm:w-auto px-4">
                  <Download className="w-4 h-4 text-blue-500" /> <span className="inline">Export Excel</span>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {isLoading ? (
          <div className="p-16 flex flex-col items-center justify-center space-y-4">
            <RefreshCw className="w-8 h-8 text-primary animate-spin" />
            <p className="text-sm text-muted-foreground">Generating live report metrics...</p>
          </div>
        ) : (
          <>
            {/* KPI Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="hover:shadow-sm transition-shadow duration-200">
                <CardContent className="p-4 text-center space-y-1">
                  <div className="flex justify-center mb-1"><TrendingUp className="w-5 h-5 text-emerald-500" /></div>
                  <p className="text-xs font-semibold text-muted-foreground">Total Revenue</p>
                  <p className="text-xl font-bold font-mono">₹{kpis?.totalRevenueMonth.toFixed(2) ?? "0.00"}</p>
                </CardContent>
              </Card>
              <Card className="hover:shadow-sm transition-shadow duration-200">
                <CardContent className="p-4 text-center space-y-1">
                  <div className="flex justify-center mb-1"><Zap className="w-5 h-5 text-amber-500" /></div>
                  <p className="text-xs font-semibold text-muted-foreground">Energy Delivered</p>
                  <p className="text-xl font-bold font-mono">{(kpis?.totalEnergyMonth ?? 0).toFixed(1)} kWh</p>
                </CardContent>
              </Card>
              <Card className="hover:shadow-sm transition-shadow duration-200">
                <CardContent className="p-4 text-center space-y-1">
                  <div className="flex justify-center mb-1"><Activity className="w-5 h-5 text-blue-500" /></div>
                  <p className="text-xs font-semibold text-muted-foreground">Total Sessions</p>
                  <p className="text-xl font-bold font-mono">{kpis?.totalSessionsMonth ?? 0}</p>
                </CardContent>
              </Card>
              <Card className="hover:shadow-sm transition-shadow duration-200">
                <CardContent className="p-4 text-center space-y-1">
                  <div className="flex justify-center mb-1"><MapPin className="w-5 h-5 text-indigo-500" /></div>
                  <p className="text-xs font-semibold text-muted-foreground">Active Stations</p>
                  <p className="text-xl font-bold font-mono">{kpis?.activeStations ?? 0}</p>
                </CardContent>
              </Card>
              <Card className="hover:shadow-sm transition-shadow duration-200">
                <CardContent className="p-4 text-center space-y-1">
                  <div className="flex justify-center mb-1"><ShieldAlert className="w-5 h-5 text-rose-500" /></div>
                  <p className="text-xs font-semibold text-muted-foreground">Fault Count</p>
                  <p className="text-xl font-bold font-mono">{kpis?.totalFaultsMonth ?? 0}</p>
                </CardContent>
              </Card>
              <Card className="hover:shadow-sm transition-shadow duration-200">
                <CardContent className="p-4 text-center space-y-1">
                  <div className="flex justify-center mb-1"><Clock className="w-5 h-5 text-orange-400" /></div>
                  <p className="text-xs font-semibold text-muted-foreground">Downtime Hours</p>
                  <p className="text-xl font-bold font-mono">{(kpis?.downtimeHours ?? 0).toFixed(1)}h</p>
                </CardContent>
              </Card>
              <Card className="hover:shadow-sm transition-shadow duration-200">
                <CardContent className="p-4 text-center space-y-1">
                  <div className="flex justify-center mb-1"><Info className="w-5 h-5 text-sky-500" /></div>
                  <p className="text-xs font-semibold text-muted-foreground">Avg Session Duration</p>
                  <p className="text-xl font-bold font-mono">{(kpis?.avgSessionDuration ?? 0).toFixed(1)}m</p>
                </CardContent>
              </Card>
              <Card className="hover:shadow-sm transition-shadow duration-200">
                <CardContent className="p-4 text-center space-y-1">
                  <div className="flex justify-center mb-1"><Layers className="w-5 h-5 text-pink-500" /></div>
                  <p className="text-xs font-semibold text-muted-foreground">Avg Revenue/Session</p>
                  <p className="text-xl font-bold font-mono">₹{kpis?.avgRevenuePerSession ?? "0.00"}</p>
                </CardContent>
              </Card>
            </div>

            {/* Core Analytics charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Revenue Trends */}
              <Card className="relative overflow-hidden">
                {isDataEmpty && renderEmptyPlaceholder()}
                <CardHeader>
                  <CardTitle className="text-base font-semibold">Revenue Trends (INR)</CardTitle>
                  <CardDescription>Visual trend of charge revenue captured</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="w-full h-[260px] min-w-0 relative">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={charts?.monthlyRevenue || []}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={(v) => `₹${v}`} />
                        <Tooltip contentStyle={chartTooltipStyle} formatter={(v: number) => [`₹${v}`, 'Revenue']} />
                        <Legend />
                        <Line type="monotone" dataKey="revenue" stroke="hsl(var(--success))" strokeWidth={2.5} activeDot={{ r: 6 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Energy Consumption */}
              <Card className="relative overflow-hidden">
                {isDataEmpty && renderEmptyPlaceholder()}
                <CardHeader>
                  <CardTitle className="text-base font-semibold">Energy Consumption (kWh)</CardTitle>
                  <CardDescription>Daily cumulative network consumption</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="w-full h-[260px] min-w-0 relative">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={charts?.dailyEnergy || []}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={(v) => `${v} kWh`} />
                        <Tooltip contentStyle={chartTooltipStyle} formatter={(v: number) => [`${v} kWh`, 'Energy']} />
                        <Legend />
                        <Bar dataKey="energy" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Station Utilization */}
              <Card className="relative overflow-hidden">
                {isDataEmpty && renderEmptyPlaceholder()}
                <CardHeader>
                  <CardTitle className="text-base font-semibold">Station Utilization (%)</CardTitle>
                  <CardDescription>Active charge ratios of stations (Click node to drill down)</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="w-full h-[260px] min-w-0 relative">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart 
                        data={charts?.stationUtilization || []} 
                        layout="vertical"
                        onClick={handleChartClick}
                        className="cursor-pointer"
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={(v) => `${v}%`} />
                        <YAxis type="category" dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} width={90} />
                        <Tooltip contentStyle={chartTooltipStyle} formatter={(v: number) => [`${v}%`, 'Utilization']} />
                        <Bar dataKey="utilization" fill="hsl(var(--info))" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Downtime Trend Analysis */}
              <Card className="relative overflow-hidden">
                {isDataEmpty && renderEmptyPlaceholder()}
                <CardHeader>
                  <CardTitle className="text-base font-semibold">Downtime & Fault Trends</CardTitle>
                  <CardDescription>Hourly / Daily downtime duration tracking</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="w-full h-[260px] min-w-0 relative">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={charts?.monthlyDowntime || []}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={(v) => `${v}h`} />
                        <Tooltip contentStyle={chartTooltipStyle} formatter={(v: number) => [`${v} hours`, 'Downtime']} />
                        <Legend />
                        <Line type="monotone" dataKey="downtime" stroke="hsl(var(--destructive))" strokeWidth={2} dot={{ fill: 'hsl(var(--destructive))' }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Revenue breakdown by variables */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Revenue by Station */}
              <Card className="relative overflow-hidden lg:col-span-2">
                {isDataEmpty && renderEmptyPlaceholder()}
                <CardHeader>
                  <CardTitle className="text-base font-semibold">Revenue contribution by Station (INR)</CardTitle>
                  <CardDescription>Top yielding charging properties</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="w-full h-[260px] min-w-0 relative">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={charts?.revenueByStation || []} onClick={handleChartClick} className="cursor-pointer">
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={10} />
                        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={(v) => `₹${v}`} />
                        <Tooltip contentStyle={chartTooltipStyle} formatter={(v: number) => [`₹${v}`, 'Revenue']} />
                        <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]}>
                          {(charts?.revenueByStation || []).map((entry: any, index: number) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Revenue by Charger Type */}
              <Card className="relative overflow-hidden">
                {isDataEmpty && renderEmptyPlaceholder()}
                <CardHeader>
                  <CardTitle className="text-base font-semibold">Revenue by Charger Type</CardTitle>
                  <CardDescription>Connector metrics split</CardDescription>
                </CardHeader>
                <CardContent className="flex justify-center items-center">
                  <div className="w-full h-[260px] min-w-0 relative">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={charts?.revenueByChargerType || []}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        >
                          {(charts?.revenueByChargerType || []).map((entry: any, index: number) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={chartTooltipStyle} formatter={(v: number) => [`₹${v}`, 'Contribution']} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Peak Hours & Leaders */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Peak Usage Hours */}
              <Card className="relative overflow-hidden">
                {isDataEmpty && renderEmptyPlaceholder()}
                <CardHeader>
                  <CardTitle className="text-base font-semibold">Peak Usage Hours</CardTitle>
                  <CardDescription>Session distribution by hour of day</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="w-full h-[260px] min-w-0 relative">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={charts?.peakUsageHours || []}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="hour" stroke="hsl(var(--muted-foreground))" fontSize={10} />
                        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} allowDecimals={false} />
                        <Tooltip contentStyle={chartTooltipStyle} formatter={(v: number) => [v, 'Sessions']} />
                        <Line type="monotone" dataKey="count" stroke="hsl(var(--warning))" strokeWidth={2} dot={{ r: 3 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Top Performing Stations Leaderboard */}
              <Card className="relative overflow-hidden">
                <CardHeader className="flex flex-row items-center gap-2">
                  <Award className="w-5 h-5 text-amber-500" />
                  <div>
                    <CardTitle className="text-base font-semibold">Top Performing Stations</CardTitle>
                    <CardDescription>Leaders ranked by gross revenue</CardDescription>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {(!charts?.topPerformingStations || charts.topPerformingStations.length === 0) ? (
                      <p className="text-sm text-muted-foreground text-center py-8">No property data available.</p>
                    ) : (
                      charts.topPerformingStations.map((station: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between p-3 rounded-xl border border-black/5 bg-slate-50 dark:bg-slate-900/50 hover:shadow-sm transition-all">
                          <div className="flex items-center gap-3">
                            <span className="font-extrabold text-base text-muted-foreground w-6">#{idx + 1}</span>
                            <div>
                              <h4 className="font-semibold text-sm">{station.name}</h4>
                              <p className="text-xs text-muted-foreground">{station.sessionsCount} Completed Sessions</p>
                            </div>
                          </div>
                          <Badge variant="default" className="font-mono text-sm bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 px-2.5 py-0.5">
                            ₹{station.revenue.toLocaleString()}
                          </Badge>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>

      {/* Drill Down details Modal */}
      <Dialog open={isDrillDownOpen} onOpenChange={setIsDrillDownOpen}>
        <DialogContent className="max-w-md w-full rounded-2xl">
          <DialogHeader>
            <DialogTitle>Drill-Down: Station Insights</DialogTitle>
            <DialogDescription>
              Detailed performance metrics for {drillDownStation?.name}
            </DialogDescription>
          </DialogHeader>

          {drillDownStation && (
            <div className="space-y-4 pt-2">
              <div className="space-y-2.5 bg-muted/30 p-4 rounded-xl border border-muted">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Location:</span>
                  <span className="font-semibold">{drillDownStation.location}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Charger Connector:</span>
                  <span className="font-semibold">{drillDownStation.connectorType || "Type 2"}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Power Output:</span>
                  <span className="font-semibold">{drillDownStation.powerOutput || 22} kW</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Base Price / kWh:</span>
                  <span className="font-semibold">₹{drillDownStation.basePricePerKwh || 0}</span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="border rounded-xl p-3 text-center space-y-1 bg-slate-50 dark:bg-slate-900/50">
                  <p className="text-[10px] text-muted-foreground uppercase font-semibold">Utilization</p>
                  <p className="text-base font-bold text-blue-500">{drillDownStation.utilization}%</p>
                </div>
                <div className="border rounded-xl p-3 text-center space-y-1 bg-slate-50 dark:bg-slate-900/50">
                  <p className="text-[10px] text-muted-foreground uppercase font-semibold">Revenue</p>
                  <p className="text-base font-bold text-emerald-500">₹{drillDownStation.revenue}</p>
                </div>
                <div className="border rounded-xl p-3 text-center space-y-1 bg-slate-50 dark:bg-slate-900/50">
                  <p className="text-[10px] text-muted-foreground uppercase font-semibold">Faults</p>
                  <p className="text-base font-bold text-rose-500">{drillDownStation.faultsCount}</p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
