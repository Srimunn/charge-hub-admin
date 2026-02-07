import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DashboardHeader } from '@/components/layout/DashboardHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft, RefreshCw, Lock, CheckCircle, Wrench,
  ThermometerSun, Target, Search, Wifi, Car, Clock,
} from 'lucide-react';
import { mockFaults, Fault, FaultType } from '@/data/mockData';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

const faultTypeLabels: Record<FaultType, string> = {
  misalignment: 'Misalignment',
  over_temperature: 'Over-Temperature',
  foreign_object: 'Foreign Object Detection',
  communication_loss: 'Communication Loss',
  collision: 'Collision',
};

const faultTypeIcons: Record<FaultType, React.ReactNode> = {
  misalignment: <Target className="w-5 h-5" />,
  over_temperature: <ThermometerSun className="w-5 h-5" />,
  foreign_object: <Search className="w-5 h-5" />,
  communication_loss: <Wifi className="w-5 h-5" />,
  collision: <Car className="w-5 h-5" />,
};

const FaultDetail = () => {
  const { faultId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [fault, setFault] = useState<Fault | undefined>(mockFaults.find(f => f.id === faultId));

  if (!fault) {
    return (
      <div className="flex flex-col min-h-screen">
        <DashboardHeader title="Fault Not Found" />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-xl font-semibold mb-2">Fault not found</h2>
            <Button onClick={() => navigate('/faults')}><ArrowLeft className="w-4 h-4 mr-2" /> Back to Faults</Button>
          </div>
        </div>
      </div>
    );
  }

  const handleRetry = () => {
    toast({ title: 'Retrying Session', description: `Attempting to resume session for fault ${fault.id}` });
  };

  const handleLockStation = () => {
    toast({ title: 'Station Locked', description: `Station ${fault.stationId} has been locked for inspection` });
  };

  const handleResolve = () => {
    setFault({ ...fault, status: 'resolved', resolvedAt: new Date() });
    toast({ title: 'Fault Resolved', description: `Fault ${fault.id} marked as resolved` });
  };

  const handleCreateTicket = () => {
    toast({ title: 'Ticket Created', description: `Maintenance ticket created for fault ${fault.id}` });
  };

  const isRecoverable = fault.severity !== 'high' && fault.type !== 'collision';

  return (
    <div className="flex flex-col min-h-screen">
      <DashboardHeader title={`Fault ${fault.id}`} subtitle={faultTypeLabels[fault.type]} />
      <div className="flex-1 p-6 space-y-6">
        <Button variant="ghost" onClick={() => navigate('/faults')} className="gap-2">
          <ArrowLeft className="w-4 h-4" /> Back to Faults
        </Button>

        {/* Summary Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {faultTypeIcons[fault.type]}
              Fault Summary
              <Badge className={
                fault.severity === 'high' ? 'bg-destructive text-destructive-foreground' :
                fault.severity === 'medium' ? 'bg-warning text-warning-foreground' :
                'bg-success text-success-foreground'
              }>
                {fault.severity}
              </Badge>
              <Badge variant="outline" className={
                fault.status === 'open' ? 'border-destructive text-destructive' :
                fault.status === 'acknowledged' ? 'border-warning text-warning' :
                'border-success text-success'
              }>
                {fault.status}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-lg bg-secondary/50">
                <p className="text-sm text-muted-foreground">Type</p>
                <p className="font-medium">{faultTypeLabels[fault.type]}</p>
              </div>
              <div className="p-4 rounded-lg bg-secondary/50">
                <p className="text-sm text-muted-foreground">Station</p>
                <p className="font-medium">{fault.stationId}</p>
              </div>
              <div className="p-4 rounded-lg bg-secondary/50">
                <p className="text-sm text-muted-foreground">Session</p>
                <p className="font-medium">{fault.sessionId || 'N/A'}</p>
              </div>
              <div className="p-4 rounded-lg bg-secondary/50">
                <p className="text-sm text-muted-foreground">Occurred</p>
                <p className="font-medium">{format(fault.timestamp, 'MMM dd, HH:mm:ss')}</p>
              </div>
            </div>
            <p className="mt-4 text-muted-foreground">{fault.description}</p>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Technical Details */}
          <Card>
            <CardHeader><CardTitle>Technical Details</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">Sensor Values</p>
                <div className="space-y-2">
                  {Object.entries(fault.sensorValues).map(([key, value]) => (
                    <div key={key} className="flex justify-between items-center p-3 rounded-lg bg-secondary/50">
                      <span className="text-sm">{key}</span>
                      <span className="font-mono text-sm font-medium">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Last Known State</p>
                <p className="text-sm p-3 rounded-lg bg-secondary/50">{fault.lastKnownState}</p>
              </div>
            </CardContent>
          </Card>

          {/* Timeline */}
          <Card>
            <CardHeader><CardTitle>Event Timeline</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-4">
                {fault.timeline.map((event, i) => (
                  <div key={i} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="w-3 h-3 rounded-full bg-primary mt-1" />
                      {i < fault.timeline.length - 1 && <div className="w-0.5 flex-1 bg-border" />}
                    </div>
                    <div className="pb-4">
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {format(event.time, 'HH:mm:ss')}
                      </p>
                      <p className="text-sm">{event.event}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Actions */}
        <Card>
          <CardHeader><CardTitle>Actions</CardTitle></CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              {isRecoverable && fault.sessionId && fault.status !== 'resolved' && (
                <Button onClick={handleRetry} className="gap-2">
                  <RefreshCw className="w-4 h-4" /> Retry Session
                </Button>
              )}
              {fault.severity === 'high' && fault.status !== 'resolved' && (
                <Button onClick={handleLockStation} variant="destructive" className="gap-2">
                  <Lock className="w-4 h-4" /> Stop & Lock Station
                </Button>
              )}
              {fault.status !== 'resolved' && (
                <Button onClick={handleResolve} variant="outline" className="gap-2 text-success border-success hover:bg-success/10">
                  <CheckCircle className="w-4 h-4" /> Mark as Resolved
                </Button>
              )}
              <Button onClick={handleCreateTicket} variant="secondary" className="gap-2">
                <Wrench className="w-4 h-4" /> Create Maintenance Ticket
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default FaultDetail;
