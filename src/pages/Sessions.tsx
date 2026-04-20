import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardHeader } from '@/components/layout/DashboardHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { StopCircle, PlayCircle, Zap, Clock, IndianRupee, Battery, AlertTriangle } from 'lucide-react';
import { getSessions, startSession, stopSession, getStations } from '@/api';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';

const Sessions = () => {
  const [sessions, setSessions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  // Poll for live session data every 5 seconds
  useEffect(() => {
    fetchSessions(); // initial hit
    const interval = setInterval(fetchSessions, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchSessions = async () => {
    try {
      const data = await getSessions();
      setSessions(data);
    } catch (err) {
      console.error("Failed to fetch sessions", err);
    }
  };

  const handleStartSession = async () => {
    try {
      setIsLoading(true);
      const stations = await getStations();
      if (!stations || stations.length === 0) {
        toast({ title: "Error", description: "No stations available to start a session", variant: "destructive" });
        return;
      }
      const randomStation = stations[Math.floor(Math.random() * stations.length)];
      await startSession(randomStation._id);
      toast({ title: "Session Started", description: `Charging started at ${randomStation.name}` });
      fetchSessions();
    } catch (err: any) {
      toast({ title: "Failed to Start", description: err.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleStopSession = async (sessionId: string) => {
    try {
      await stopSession(sessionId);
      toast({ title: 'Session Stopped', description: `Charging session has been stopped successfully.` });
      fetchSessions();
    } catch (err: any) {
      toast({ title: "Failed to Stop", description: err.message, variant: "destructive" });
    }
  };

  const activeSessions = sessions.filter(s => s.status === 'active');
  const totalPower = activeSessions.reduce((sum, s) => sum + (s.energyUsed || 0), 0);
  const totalCost = sessions.reduce((sum, s) => sum + (s.cost || 0), 0);

  const getStatusBadge = (status: string) => {
    if (status === 'active') return <Badge className="bg-success text-success-foreground">Charging</Badge>;
    return <Badge className="bg-info text-info-foreground">Completed</Badge>;
  };

  return (
    <div className="flex flex-col min-h-screen">
      <DashboardHeader title="Live Charging Sessions" subtitle="Real-time monitoring of active charging" />
      <div className="flex-1 p-6 space-y-6">
        
        <div className="flex justify-end">
           <Button onClick={handleStartSession} disabled={isLoading} className="gap-2">
              <PlayCircle className="w-4 h-4" /> Simulate Start Session
           </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="p-3 rounded-xl bg-success/10"><Zap className="w-6 h-6 text-success" /></div>
              <div>
                <p className="text-sm text-muted-foreground">Active Sessions</p>
                <p className="text-2xl font-bold">{activeSessions.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="p-3 rounded-xl bg-primary/10"><Battery className="w-6 h-6 text-primary" /></div>
              <div>
                <p className="text-sm text-muted-foreground">Total Energy</p>
                <p className="text-2xl font-bold">{totalPower.toFixed(2)} kWh</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="p-3 rounded-xl bg-info/10"><IndianRupee className="w-6 h-6 text-info" /></div>
              <div>
                <p className="text-sm text-muted-foreground">Total Cost Generated</p>
                <p className="text-2xl font-bold">₹{totalCost.toFixed(2)}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sessions Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              All Sessions
              <Badge variant="outline" className="animate-pulse-glow text-success border-success">Live</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Session ID</TableHead>
                  <TableHead>Station</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Energy (Real-time)</TableHead>
                  <TableHead>Cost</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessions.map((session) => (
                  <TableRow key={session._id}>
                    <TableCell className="font-medium text-xs">{session._id}</TableCell>
                    <TableCell>{session.stationId?.name || "Unknown"}</TableCell>
                    <TableCell>
                      {formatDistanceToNow(new Date(session.startTime))} {session.status === 'active' ? "so far" : "total"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 w-32">
                        <Progress value={Math.min((session.energyUsed / 50) * 100, 100)} className="h-2 [&>div]:bg-success transition-all duration-1000 ease-in-out" />
                        <span className="text-xs text-muted-foreground w-12">{session.energyUsed.toFixed(2)} kWh</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Tooltip>
                        <TooltipTrigger className="cursor-help underline decoration-dashed underline-offset-4 decoration-muted-foreground">
                          ₹{session.cost?.toFixed(2) || '0.00'}
                        </TooltipTrigger>
                        <TooltipContent className="bg-card border shadow-xl p-3" side="top">
                          <div className="space-y-1 text-xs">
                            <div className="flex justify-between gap-4"><span>Energy Cost:</span> <span className="font-medium">₹{((session.energyUsed || 0) * (session.appliedPrice || 15)).toFixed(2)}</span></div>
                            <div className="flex justify-between gap-4"><span>Conv. Fee:</span> <span className="font-medium">₹{(session.convenienceFee || 0).toFixed(2)}</span></div>
                            <div className="flex justify-between gap-4"><span>Tax/Surcharges:</span> <span className="font-medium">₹{(session.tax || 0).toFixed(2)}</span></div>
                            <div className="border-t border-border/50 pt-1 mt-1 flex justify-between gap-4 font-bold text-primary"><span>Total:</span> <span>₹{session.cost?.toFixed(2) || '0.00'}</span></div>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TableCell>
                    <TableCell>{getStatusBadge(session.status)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="outline" size="sm" onClick={() => handleStopSession(session._id)} disabled={session.status === 'completed'}>
                          <StopCircle className="w-4 h-4 text-destructive" />
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
