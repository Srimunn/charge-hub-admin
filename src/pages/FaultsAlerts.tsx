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
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  AlertTriangle, Eye, CheckCircle, Wrench, ThermometerSun,
  Target, Search, Wifi, Car, ShieldAlert,
} from 'lucide-react';
import { mockFaults, mockStations, Fault, FaultType } from '@/data/mockData';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

const faultTypeIcons: Record<FaultType, React.ReactNode> = {
  misalignment: <Target className="w-4 h-4" />,
  over_temperature: <ThermometerSun className="w-4 h-4" />,
  foreign_object: <Search className="w-4 h-4" />,
  communication_loss: <Wifi className="w-4 h-4" />,
  collision: <Car className="w-4 h-4" />,
};

const faultTypeLabels: Record<FaultType, string> = {
  misalignment: 'Misalignment',
  over_temperature: 'Over-Temperature',
  foreign_object: 'Foreign Object Detection',
  communication_loss: 'Communication Loss',
  collision: 'Collision',
};

const FaultsAlerts = () => {
  const [faults, setFaults] = useState<Fault[]>(mockFaults);
  const [stationFilter, setStationFilter] = useState<string>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const navigate = useNavigate();
  const { toast } = useToast();

  // Simulate new faults appearing
  useEffect(() => {
    const interval = setInterval(() => {
      // small chance of a new fault
      if (Math.random() < 0.1) {
        const types: FaultType[] = ['misalignment', 'over_temperature', 'foreign_object', 'communication_loss', 'collision'];
        const severities = ['high', 'medium', 'low'] as const;
        const stationIds = mockStations.map(s => s.id);
        const newFault: Fault = {
          id: `FLT-${String(Date.now()).slice(-5)}`,
          stationId: stationIds[Math.floor(Math.random() * stationIds.length)],
          sessionId: Math.random() > 0.5 ? `SES-${String(Math.floor(Math.random() * 100)).padStart(3, '0')}` : null,
          type: types[Math.floor(Math.random() * types.length)],
          severity: severities[Math.floor(Math.random() * severities.length)],
          status: 'open',
          timestamp: new Date(),
          resolvedAt: null,
          description: 'Auto-detected fault from monitoring system',
          sensorValues: {},
          lastKnownState: 'Unknown',
          timeline: [{ time: new Date(), event: 'Fault auto-detected' }],
        };
        setFaults(prev => [newFault, ...prev]);
      }
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleAcknowledge = (id: string) => {
    setFaults(prev => prev.map(f => f.id === id ? { ...f, status: 'acknowledged' as const } : f));
    toast({ title: 'Fault Acknowledged', description: `Fault ${id} has been acknowledged` });
  };

  const handleResolve = (id: string) => {
    setFaults(prev => prev.map(f => f.id === id ? { ...f, status: 'resolved' as const, resolvedAt: new Date() } : f));
    toast({ title: 'Fault Resolved', description: `Fault ${id} marked as resolved` });
  };

  const handleDispatch = (id: string) => {
    toast({ title: 'Technician Dispatched', description: `Maintenance team dispatched for fault ${id}` });
  };

  const filtered = faults.filter(f => {
    if (stationFilter !== 'all' && f.stationId !== stationFilter) return false;
    if (severityFilter !== 'all' && f.severity !== severityFilter) return false;
    if (statusFilter !== 'all' && f.status !== statusFilter) return false;
    return true;
  });

  const openCount = faults.filter(f => f.status === 'open').length;
  const highCount = faults.filter(f => f.severity === 'high' && f.status !== 'resolved').length;

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
                <p className="text-sm text-muted-foreground">Open Faults</p>
                <p className="text-2xl font-bold">{openCount}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="p-3 rounded-xl bg-warning/10">
                <AlertTriangle className="w-6 h-6 text-warning" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Critical (High)</p>
                <p className="text-2xl font-bold">{highCount}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="p-3 rounded-xl bg-success/10">
                <CheckCircle className="w-6 h-6 text-success" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Resolved (Total)</p>
                <p className="text-2xl font-bold">{faults.filter(f => f.status === 'resolved').length}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="flex flex-wrap items-center gap-4 p-4">
            <Select value={stationFilter} onValueChange={setStationFilter}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="All Stations" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Stations</SelectItem>
                {mockStations.map(s => <SelectItem key={s.id} value={s.id}>{s.id} — {s.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={severityFilter} onValueChange={setSeverityFilter}>
              <SelectTrigger className="w-[150px]"><SelectValue placeholder="All Severities" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Severities</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]"><SelectValue placeholder="All Statuses" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="acknowledged">Acknowledged</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle>All Faults</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Station</TableHead>
                  <TableHead className="hidden md:table-cell">Session</TableHead>
                  <TableHead>Fault Type</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead className="hidden sm:table-cell">Time</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(fault => (
                  <TableRow key={fault.id}>
                    <TableCell className="font-medium">{fault.stationId}</TableCell>
                    <TableCell className="hidden md:table-cell">{fault.sessionId || '—'}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {faultTypeIcons[fault.type]}
                        <span className="hidden sm:inline">{faultTypeLabels[fault.type]}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={
                        fault.severity === 'high' ? 'bg-destructive text-destructive-foreground' :
                        fault.severity === 'medium' ? 'bg-warning text-warning-foreground' :
                        'bg-success text-success-foreground'
                      }>
                        {fault.severity}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-muted-foreground text-xs">
                      {format(fault.timestamp, 'MMM dd, HH:mm')}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={
                        fault.status === 'open' ? 'border-destructive text-destructive' :
                        fault.status === 'acknowledged' ? 'border-warning text-warning' :
                        'border-success text-success'
                      }>
                        {fault.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="outline" size="sm" onClick={() => navigate(`/faults/${fault.id}`)}>
                          <Eye className="w-4 h-4" />
                        </Button>
                        {fault.status === 'open' && (
                          <Button variant="outline" size="sm" onClick={() => handleAcknowledge(fault.id)}>
                            <CheckCircle className="w-4 h-4" />
                          </Button>
                        )}
                        {fault.status !== 'resolved' && (
                          <Button variant="outline" size="sm" onClick={() => handleResolve(fault.id)}>
                            <CheckCircle className="w-4 h-4 text-success" />
                          </Button>
                        )}
                        {fault.status !== 'resolved' && (
                          <Button variant="outline" size="sm" onClick={() => handleDispatch(fault.id)}>
                            <Wrench className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default FaultsAlerts;
