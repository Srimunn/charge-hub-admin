import { DashboardHeader } from '@/components/layout/DashboardHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download, FileText, FileSpreadsheet } from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { dailyEnergyData, monthlyRevenueData, stationUtilizationData } from '@/data/mockData';
import { useToast } from '@/hooks/use-toast';

const Reports = () => {
  const { toast } = useToast();

  const handleExport = (type: 'pdf' | 'csv') => {
    toast({
      title: 'Export Started',
      description: `Generating ${type.toUpperCase()} report...`,
    });
    
    setTimeout(() => {
      toast({
        title: 'Export Complete',
        description: `Report has been downloaded as ${type.toUpperCase()}`,
      });
    }, 1500);
  };

  return (
    <div className="flex flex-col min-h-screen">
      <DashboardHeader 
        title="Reports & Analytics" 
        subtitle="Detailed performance insights"
      />
      
      <div className="flex-1 p-6 space-y-6">
        {/* Export Actions */}
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-4 p-4">
            <div>
              <h3 className="font-semibold">Export Reports</h3>
              <p className="text-sm text-muted-foreground">Download data for further analysis</p>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => handleExport('pdf')} variant="outline" className="gap-2">
                <FileText className="w-4 h-4" />
                Export PDF
              </Button>
              <Button onClick={() => handleExport('csv')} variant="outline" className="gap-2">
                <FileSpreadsheet className="w-4 h-4" />
                Export CSV
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Daily Energy Consumption */}
          <Card>
            <CardHeader>
              <CardTitle>Daily Energy Consumption</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={dailyEnergyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(v) => `${v} kWh`} />
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Bar dataKey="energy" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Monthly Revenue */}
          <Card>
            <CardHeader>
              <CardTitle>Monthly Revenue</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={monthlyRevenueData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(v) => `$${v/1000}k`} />
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                    formatter={(value: number) => [`$${value.toLocaleString()}`, 'Revenue']}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="revenue" 
                    stroke="hsl(var(--success))" 
                    strokeWidth={3}
                    dot={{ fill: 'hsl(var(--success))' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Station Utilization */}
        <Card>
          <CardHeader>
            <CardTitle>Station Utilization</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={stationUtilizationData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(v) => `${v}%`} />
                <YAxis type="category" dataKey="station" stroke="hsl(var(--muted-foreground))" fontSize={12} width={80} />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                  formatter={(value: number) => [`${value}%`, 'Utilization']}
                />
                <Bar dataKey="utilization" fill="hsl(var(--info))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-sm text-muted-foreground">Total Energy (Month)</p>
              <p className="text-2xl font-bold mt-1">156,000 kWh</p>
              <Badge variant="outline" className="mt-2 text-success border-success">+12.5%</Badge>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-sm text-muted-foreground">Total Revenue (Month)</p>
              <p className="text-2xl font-bold mt-1">$46,800</p>
              <Badge variant="outline" className="mt-2 text-success border-success">+8.3%</Badge>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-sm text-muted-foreground">Avg Utilization</p>
              <p className="text-2xl font-bold mt-1">67.4%</p>
              <Badge variant="outline" className="mt-2 text-warning border-warning">+2.1%</Badge>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-sm text-muted-foreground">Sessions (Month)</p>
              <p className="text-2xl font-bold mt-1">3,240</p>
              <Badge variant="outline" className="mt-2 text-success border-success">+15.7%</Badge>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Reports;
