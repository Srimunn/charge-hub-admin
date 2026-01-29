import { useState, useEffect } from 'react';
import { DashboardHeader } from '@/components/layout/DashboardHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { StopCircle, RefreshCw, Zap, Clock, DollarSign, Battery } from 'lucide-react';
import { mockChargingSessions, ChargingSession } from '@/data/mockData';
import { useToast } from '@/hooks/use-toast';

const Sessions = () => {
  const [sessions, setSessions] = useState<ChargingSession[]>(mockChargingSessions);
  const { toast } = useToast();

  // Simulate real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      setSessions(prev =>
        prev.map(session => {
          if (session.status === 'active') {
            const newSOC = Math.min(session.batterySOC + Math.random() * 2, 100);
            const newDuration = session.duration + 1;
            const newRevenue = session.revenue + (session.chargingPower * 0.005);
            return {
              ...session,
              batterySOC: Math.round(newSOC),
              duration: newDuration,
              revenue: Math.round(newRevenue * 100) / 100,
            };
          }
          return session;
        })
      );
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  const handleStopSession = (sessionId: string) => {
    setSessions(prev =>
      prev.map(s =>
        s.id === sessionId ? { ...s, status: 'completed' as const } : s
      )
    );
    toast({
      title: 'Session Stopped',
      description: `Charging session ${sessionId} has been stopped`,
    });
  };

  const handleResetStation = (stationId: string) => {
    toast({
      title: 'Station Reset',
      description: `Station ${stationId} is being reset`,
    });
  };

  const activeSessions = sessions.filter(s => s.status === 'active');
  const totalPower = activeSessions.reduce((sum, s) => sum + s.chargingPower, 0);
  const totalRevenue = sessions.reduce((sum, s) => sum + s.revenue, 0);

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  return (
    <div className="flex flex-col min-h-screen">
      <DashboardHeader 
        title="Live Charging Sessions" 
        subtitle="Real-time monitoring of active charging"
      />
      
      <div className="flex-1 p-6 space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="p-3 rounded-xl bg-success/10">
                <Zap className="w-6 h-6 text-success" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active Sessions</p>
                <p className="text-2xl font-bold">{activeSessions.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="p-3 rounded-xl bg-primary/10">
                <Battery className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Power</p>
                <p className="text-2xl font-bold">{totalPower.toFixed(1)} kW</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="p-3 rounded-xl bg-warning/10">
                <Clock className="w-6 h-6 text-warning" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Avg Duration</p>
                <p className="text-2xl font-bold">
                  {formatDuration(Math.round(activeSessions.reduce((sum, s) => sum + s.duration, 0) / activeSessions.length || 0))}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="p-3 rounded-xl bg-info/10">
                <DollarSign className="w-6 h-6 text-info" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Revenue</p>
                <p className="text-2xl font-bold">${totalRevenue.toFixed(2)}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sessions Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              All Sessions
              <Badge variant="outline" className="animate-pulse-glow text-success border-success">
                Live
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vehicle ID</TableHead>
                  <TableHead className="hidden md:table-cell">User ID</TableHead>
                  <TableHead>Station</TableHead>
                  <TableHead>Battery SOC</TableHead>
                  <TableHead className="hidden sm:table-cell">Power</TableHead>
                  <TableHead className="hidden sm:table-cell">Duration</TableHead>
                  <TableHead>Revenue</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessions.map((session) => (
                  <TableRow key={session.id}>
                    <TableCell className="font-medium">{session.vehicleId}</TableCell>
                    <TableCell className="hidden md:table-cell">{session.userId}</TableCell>
                    <TableCell>{session.stationId}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 w-24">
                        <Progress value={session.batterySOC} className="h-2" />
                        <span className="text-xs text-muted-foreground w-8">
                          {session.batterySOC}%
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">{session.chargingPower} kW</TableCell>
                    <TableCell className="hidden sm:table-cell">{formatDuration(session.duration)}</TableCell>
                    <TableCell>${session.revenue.toFixed(2)}</TableCell>
                    <TableCell>
                      <Badge className={
                        session.status === 'active' ? 'bg-success text-success-foreground' :
                        session.status === 'completed' ? 'bg-info text-info-foreground' :
                        'bg-destructive text-destructive-foreground'
                      }>
                        {session.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleStopSession(session.id)}
                          disabled={session.status !== 'active'}
                        >
                          <StopCircle className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleResetStation(session.stationId)}
                        >
                          <RefreshCw className="w-4 h-4" />
                        </Button>
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

export default Sessions;
