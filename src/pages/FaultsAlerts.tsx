import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardHeader } from '@/components/layout/DashboardHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  AlertTriangle, CheckCircle, ShieldAlert
} from 'lucide-react';
import { getFaults, resolveFault } from '@/api';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

const FaultsAlerts = () => {
  const [faults, setFaults] = useState<any[]>([]);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    fetchFaults();
    const interval = setInterval(fetchFaults, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchFaults = async () => {
    try {
      const data = await getFaults();
      setFaults(data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleResolve = async (id: string) => {
    try {
      await resolveFault(id);
      toast({ title: 'Fault Resolved', description: `Fault safely marked as resolved in the system.` });
      fetchFaults();
    } catch (err: any) {
      toast({ title: 'Error Resolving', description: err.message, variant: 'destructive' });
    }
  };

  const openCount = faults.filter(f => f.status === 'active').length;
  const highCount = faults.filter(f => f.severity === 'high' && f.status === 'active').length;

  return (
    <div className="flex flex-col min-h-screen">
      <DashboardHeader title="Faults & Alerts" subtitle="Monitor and manage station faults" />
      <div className="flex-1 p-6 space-y-6">
        {/* KPI Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="p-3 rounded-xl bg-destructive/10">
                <ShieldAlert className="w-6 h-6 text-destructive" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active Faults</p>
                <p className="text-2xl font-bold">{openCount}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-4 bg-red-50 dark:bg-red-950/20">
              <div className="p-3 rounded-xl bg-destructive">
                <AlertTriangle className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-destructive font-semibold">Critical (High)</p>
                <p className="text-2xl font-bold text-destructive animate-pulse">{highCount}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="p-3 rounded-xl bg-success/10">
                <CheckCircle className="w-6 h-6 text-success" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Resolved</p>
                <p className="text-2xl font-bold">{faults.filter(f => f.status === 'resolved').length}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle>All Faults</CardTitle>
          </CardHeader>
          <CardContent>
            {faults.length === 0 ? <p className="text-muted-foreground p-4 text-center">No faults detected.</p> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Station</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Message</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Time Detected</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {faults.map(fault => (
                  <TableRow key={fault._id} className={fault.severity === 'high' && fault.status === 'active' ? "bg-destructive/10" : ""}>
                    <TableCell className="font-medium">{fault.stationId?.name || "Unknown"}</TableCell>
                    <TableCell className="capitalize">{fault.type}</TableCell>
                    <TableCell>{fault.message}</TableCell>
                    <TableCell>
                      <Badge className={
                        fault.severity === 'high' ? 'bg-destructive text-destructive-foreground animate-pulse' :
                        fault.severity === 'medium' ? 'bg-warning text-warning-foreground' :
                        'bg-info text-info-foreground'
                      }>
                        {fault.severity}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {format(new Date(fault.createdAt), 'MMM dd, HH:mm')}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={
                        fault.status === 'active' ? 'border-destructive text-destructive' :
                        'border-success text-success'
                      }>
                        {fault.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {fault.status !== 'resolved' && (
                          <Button variant="outline" size="sm" onClick={() => handleResolve(fault._id)}>
                            <CheckCircle className="w-4 h-4 text-success mr-2" /> Resolve
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default FaultsAlerts;
