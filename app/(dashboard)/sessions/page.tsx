"use client";

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardHeader } from '@/components/layout/DashboardHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { StopCircle, PlayCircle, Zap, Battery, Activity, Car, Cable, Settings2, Thermometer, IndianRupee, ShieldAlert } from 'lucide-react';
import { getSessions, getLiveSessions, startSession, stopSession, getStations, simulateFault } from '@/services/api';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export default function SessionsPage() {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const router = useRouter();
  const queryClient = useQueryClient();

  const sessionsQuery = useQuery({ queryKey: ["sessions"], queryFn: getSessions });
  const liveQuery = useQuery({ queryKey: ["liveSessions"], queryFn: getLiveSessions, refetchInterval: 15000 });

  const startMutation = useMutation({
    mutationFn: (stationId: string) => startSession(stationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
      queryClient.invalidateQueries({ queryKey: ["liveSessions"] });
    }
  });

  const stopMutation = useMutation({
    mutationFn: (sessionId: string) => stopSession(sessionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
      queryClient.invalidateQueries({ queryKey: ["liveSessions"] });
    }
  });

  const faultMutation = useMutation({
    mutationFn: ({ stationId, faultCode }: { stationId: string, faultCode: string }) => simulateFault(stationId, faultCode),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
      queryClient.invalidateQueries({ queryKey: ["liveSessions"] });
      queryClient.invalidateQueries({ queryKey: ["faults"] });
      toast({ title: 'Fault Injected', description: `Simulated fault triggered successfully.` });
    },
    onError: (err: any) => {
      toast({ title: 'Fault Injection Failed', description: err.message, variant: 'destructive' });
    }
  });

  const handleStartSession = async () => {
    try {
      setIsLoading(true);
      const stations = await getStations();
      if (!stations || stations.length === 0) {
        toast({ title: "Error", description: "No stations available to start a session", variant: "destructive" });
        return;
      }
      const randomStation = stations[Math.floor(Math.random() * stations.length)];
      await startMutation.mutateAsync(randomStation._id);
      toast({ title: "Start Requested", description: `Remote start requested for ${randomStation.name}` });
    } catch (err: any) {
      toast({ title: "Failed to Start", description: err.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleStopSession = async (sessionId: string) => {
    try {
      await stopMutation.mutateAsync(sessionId);
      toast({ title: 'Stop Requested', description: `Remote stop requested.` });
    } catch (err: any) {
      toast({ title: "Failed to Stop", description: err.message, variant: "destructive" });
    }
  };

  const triggerFault = (stationId: string, faultCode: string) => {
    faultMutation.mutate({ stationId, faultCode });
  };

  const sessions = useMemo(() => (sessionsQuery.data ?? []) as any[], [sessionsQuery.data]);
  const liveSessions = useMemo(() => (liveQuery.data ?? []) as any[], [liveQuery.data]);

  const summary = useMemo(() => {
    const active = sessions.filter((s) => s.status === "active");
    const totalEnergy = sessions.reduce((sum, s) => sum + (s.energyUsed || 0), 0);
    const totalCost = sessions.reduce((sum, s) => sum + (s.cost || 0), 0);
    return { activeCount: active.length, totalEnergy, totalCost };
  }, [sessions]);

  return (
    <div className="flex flex-col min-h-screen">
      <DashboardHeader title="Live Charging Sessions" subtitle="Real-time monitoring of active charging" />
      <div className="flex-1 p-6 space-y-6">
        
        <div className="flex justify-end">
           <Button onClick={handleStartSession} disabled={isLoading} className="w-full sm:w-auto gap-2">
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
                <p className="text-2xl font-bold">{summary.activeCount}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="p-3 rounded-xl bg-primary/10"><Battery className="w-6 h-6 text-primary" /></div>
              <div>
                <p className="text-sm text-muted-foreground">Total Energy</p>
                <p className="text-2xl font-bold">{summary.totalEnergy.toFixed(2)} kWh</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="p-3 rounded-xl bg-info/10"><IndianRupee className="w-6 h-6 text-info" /></div>
              <div>
                <p className="text-sm text-muted-foreground">Total Cost Generated</p>
                <p className="text-2xl font-bold">₹{summary.totalCost.toFixed(2)}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Live Sessions Grid */}
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xl font-bold flex items-center gap-2">
            Active Charging Sessions
            <Badge variant="outline" className="animate-pulse-glow text-success border-success bg-success/10">Live Tracker</Badge>
          </h2>
        </div>

        {liveSessions.length === 0 ? (
           <Card className="border-dashed bg-muted/20">
             <CardContent className="flex flex-col items-center justify-center p-12 text-muted-foreground">
               <Activity className="w-12 h-12 mb-4 opacity-50" />
               <p className="text-lg font-medium">No Active Sessions</p>
               <p className="text-sm text-center max-w-sm mt-2">Currently, there are no live charging sessions. Click &apos;Simulate Start Session&apos; to generate activity.</p>
             </CardContent>
           </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {liveSessions.map((session) => {
              const isFault = session.chargingStatus === "FAULT" || session.sessionStatus === "FAULT_PAUSED";
              return (
              <Card key={session.id} className={`relative overflow-hidden group hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 rounded-2xl bg-card ${isFault ? 'border-destructive/60' : 'border-border/50'}`}>
                
                {/* Live Indicator */}
                <div className="absolute top-0 right-0 p-4 z-10">
                  <div className={`flex items-center gap-2 bg-background/80 backdrop-blur-sm px-3 py-1.5 rounded-full border shadow-sm ${isFault ? 'border-destructive/30 text-destructive' : 'border-success/30 text-success'}`}>
                    <span className="relative flex h-2.5 w-2.5">
                      <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isFault ? 'bg-destructive' : 'bg-success'}`}></span>
                      <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isFault ? 'bg-destructive' : 'bg-success'}`}></span>
                    </span>
                    {isFault && <ShieldAlert className="w-3 h-3 text-destructive animate-pulse" />}
                    <span className="text-[10px] font-bold uppercase tracking-wider">{isFault ? "FAULT" : session.chargingStatus}</span>
                  </div>
                </div>

                {/* Animated Glow Background */}
                <div className={`absolute top-0 left-0 w-full h-1 animate-pulse bg-gradient-to-r ${isFault ? 'from-destructive/50 via-destructive to-destructive/50' : 'from-success/50 via-success to-success/50'}`}></div>
                <div className={`absolute -top-24 -right-24 w-48 h-48 rounded-full blur-3xl opacity-50 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none ${isFault ? 'bg-destructive/10' : 'bg-success/10'}`}></div>
                
                <CardHeader className="pb-2 relative z-10">
                  <CardTitle className="flex items-center gap-2 text-xl font-bold">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Zap className={`w-5 h-5 text-primary ${isFault ? '' : 'animate-pulse'}`} />
                    </div>
                    Station #{session.stationNumber}
                  </CardTitle>
                  <div className="text-sm text-muted-foreground flex items-center gap-1 mt-2 bg-secondary/50 w-fit px-2 py-1 rounded-md">
                    <Car className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium tracking-wide">{session.userVehicleId}</span>
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-6 pt-4 relative z-10">
                  {/* Main Stats Grid */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-secondary/40 p-4 rounded-xl border border-border/50 shadow-inner group-hover:bg-secondary/60 transition-colors">
                      <p className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1 font-medium"><Activity className="w-3.5 h-3.5 text-primary"/> Power Output</p>
                      <p className="text-2xl font-bold font-mono tracking-tight text-foreground">{session.powerOutput.toFixed(1)} <span className="text-sm font-medium text-muted-foreground">kW</span></p>
                    </div>
                    <div className="bg-secondary/40 p-4 rounded-xl border border-border/50 shadow-inner group-hover:bg-secondary/60 transition-colors">
                      <p className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1 font-medium"><Battery className="w-3.5 h-3.5 text-primary"/> Delivered</p>
                      <p className="text-2xl font-bold font-mono tracking-tight text-foreground">{session.energyDelivered.toFixed(2)} <span className="text-sm font-medium text-muted-foreground">kWh</span></p>
                    </div>
                  </div>
                  
                  {/* Progress bar for charging speed */}
                   <div className="space-y-2 bg-background p-3 rounded-xl border shadow-inner">
                      <div className="flex justify-between text-xs font-semibold">
                        <span className="text-muted-foreground uppercase tracking-wider">Charging Speed</span>
                        <span className="text-primary font-bold">{session.chargingSpeed?.toFixed(1) || session.powerOutput?.toFixed(1) || 0} kW</span>
                      </div>
                      <Progress value={Math.min(((session.chargingSpeed || session.powerOutput || 0) / 50) * 100, 100)} className="h-2 rounded-full overflow-hidden bg-secondary shadow-sm [&>div]:bg-gradient-to-r [&>div]:from-primary/90 [&>div]:to-primary transition-all duration-1000" />
                   </div>

                  {/* Smaller Metrics */}
                  <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-sm bg-card rounded-xl border p-4 shadow-sm">
                    <div className="flex justify-between items-center pb-2 border-b border-border/40">
                      <span className="text-muted-foreground flex items-center gap-1.5"><Settings2 className="w-3.5 h-3.5"/> Voltage</span>
                      <span className="font-mono font-medium">{Number(session.voltage || 0).toFixed(1)}V</span>
                    </div>
                    <div className="flex justify-between items-center pb-2 border-b border-border/40">
                      <span className="text-muted-foreground flex items-center gap-1.5"><Activity className="w-3.5 h-3.5"/> Current</span>
                      <span className="font-mono font-medium">{Number(session.current || 0).toFixed(1)}A</span>
                    </div>
                    <div className="flex justify-between items-center pt-1">
                      <span className="text-muted-foreground flex items-center gap-1.5"><Thermometer className="w-3.5 h-3.5"/> Temp</span>
                      <span className={`font-mono font-medium flex items-center gap-1 ${session.temperature > 45 ? 'text-warning' : 'text-success'}`}>
                        {Number(session.temperature || 0).toFixed(1)}°C
                      </span>
                    </div>
                    <div className="flex justify-between items-center pt-1">
                      <span className="text-muted-foreground flex items-center gap-1.5"><Cable className="w-3.5 h-3.5"/> Connector</span>
                      <span className="font-medium text-xs bg-secondary px-2 py-0.5 rounded text-foreground">{session.connectorStatus}</span>
                    </div>
                  </div>

                  {/* Fault Details Block */}
                  {isFault && session.faultType && (
                    <div className="bg-destructive/5 border border-destructive/20 p-4 rounded-xl space-y-2 text-sm animate-in fade-in duration-300">
                      <div className="flex items-center gap-2 text-destructive font-bold">
                        <ShieldAlert className="w-4 h-4 animate-bounce" />
                        <span>FAULT ACTIVE</span>
                      </div>
                      <div className="grid grid-cols-3 gap-y-1.5 text-xs">
                        <span className="text-muted-foreground">Fault Type:</span>
                        <span className="col-span-2 font-semibold text-foreground">{session.faultType}</span>
                        
                        <span className="text-muted-foreground">Message:</span>
                        <span className="col-span-2 font-semibold text-foreground">{session.faultMessage}</span>
                        
                        <span className="text-muted-foreground">Detected:</span>
                        <span className="col-span-2 font-semibold text-foreground">
                          {session.faultTime ? new Date(session.faultTime).toLocaleString() : '—'}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="pt-2 space-y-2">
                     {!isFault && (
                       <Dialog>
                         <DialogTrigger asChild>
                           <Button 
                              variant="outline" 
                              className="w-full gap-2 font-medium border-destructive/30 hover:bg-destructive/10 text-destructive"
                           >
                             <ShieldAlert className="w-4 h-4" /> Simulate Fault
                           </Button>
                         </DialogTrigger>
                         <DialogContent className="max-w-md">
                           <DialogHeader>
                             <DialogTitle>Simulate Fault on Station #{session.stationNumber}</DialogTitle>
                             <DialogDescription>
                               Select a fault type to inject simulated hardware failure. This will stop the active charging session immediately.
                             </DialogDescription>
                           </DialogHeader>
                           <div className="grid grid-cols-2 gap-3 py-4">
                              <Button onClick={() => triggerFault(session.stationId?._id || session.stationId, 'EMERGENCY_STOP')} variant="destructive" className="flex flex-col h-20 justify-center">
                                <StopCircle className="w-6 h-6 mb-1" />
                                <span>Emergency Stop</span>
                              </Button>
                              <Button onClick={() => triggerFault(session.stationId?._id || session.stationId, 'OVER_TEMP')} variant="destructive" className="flex flex-col h-20 justify-center">
                                <Thermometer className="w-6 h-6 mb-1" />
                                <span>Over Temp</span>
                              </Button>
                              <Button onClick={() => triggerFault(session.stationId?._id || session.stationId, 'CONNECTOR_FAILURE')} variant="destructive" className="flex flex-col h-20 justify-center">
                                <Cable className="w-6 h-6 mb-1" />
                                <span>Connector Failure</span>
                              </Button>
                              <Button onClick={() => triggerFault(session.stationId?._id || session.stationId, 'POWER_FAILURE')} variant="destructive" className="flex flex-col h-20 justify-center">
                                <Zap className="w-6 h-6 mb-1" />
                                <span>Power Failure</span>
                              </Button>
                           </div>
                         </DialogContent>
                       </Dialog>
                     )}

                     <Button 
                        variant="destructive" 
                        className="w-full gap-2 font-medium hover:bg-destructive shadow-md hover:shadow-destructive/20 transition-all active:scale-[0.98]" 
                        onClick={() => handleStopSession(session.id)}
                     >
                       <StopCircle className="w-4 h-4" /> Stop Charging Session
                     </Button>
                  </div>
                 </CardContent>
               </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
