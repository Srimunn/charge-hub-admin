import { useState } from 'react';
import { DashboardHeader } from '@/components/layout/DashboardHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertTriangle,
  Thermometer,
  Target,
  Box,
  Zap,
  Wifi,
  Check,
  Truck,
  AlertCircle,
} from 'lucide-react';
import { mockAlerts, Alert } from '@/data/mockData';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';

const Safety = () => {
  const [alerts, setAlerts] = useState<Alert[]>(mockAlerts);
  const { toast } = useToast();

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'overheating':
        return <Thermometer className="w-4 h-4" />;
      case 'misalignment':
        return <Target className="w-4 h-4" />;
      case 'foreign_object':
        return <Box className="w-4 h-4" />;
      case 'power_fault':
        return <Zap className="w-4 h-4" />;
      case 'communication_loss':
        return <Wifi className="w-4 h-4" />;
      default:
        return <AlertTriangle className="w-4 h-4" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high':
        return 'bg-destructive text-destructive-foreground';
      case 'medium':
        return 'bg-warning text-warning-foreground';
      case 'low':
        return 'bg-info text-info-foreground';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const handleAcknowledge = (alertId: string) => {
    setAlerts(prev =>
      prev.map(alert =>
        alert.id === alertId ? { ...alert, acknowledged: true } : alert
      )
    );
    toast({
      title: 'Alert Acknowledged',
      description: `Alert ${alertId} has been acknowledged`,
    });
  };

  const handleDispatchTechnician = (alertId: string) => {
    setAlerts(prev =>
      prev.map(alert =>
        alert.id === alertId ? { ...alert, technicianDispatched: true } : alert
      )
    );
    toast({
      title: 'Technician Dispatched',
      description: 'A technician has been dispatched to the station',
    });
  };

  const highAlerts = alerts.filter(a => a.severity === 'high' && !a.acknowledged).length;
  const mediumAlerts = alerts.filter(a => a.severity === 'medium' && !a.acknowledged).length;
  const lowAlerts = alerts.filter(a => a.severity === 'low' && !a.acknowledged).length;

  return (
    <div className="flex flex-col min-h-screen">
      <DashboardHeader 
        title="Safety & Fault Monitoring" 
        subtitle="Monitor alerts and system faults"
      />
      
      <div className="flex-1 p-6 space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className={highAlerts > 0 ? 'border-destructive/50' : ''}>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="p-3 rounded-xl bg-destructive/10">
                <AlertCircle className="w-6 h-6 text-destructive" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">High Severity</p>
                <p className="text-2xl font-bold text-destructive">{highAlerts}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="p-3 rounded-xl bg-warning/10">
                <AlertTriangle className="w-6 h-6 text-warning" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Medium Severity</p>
                <p className="text-2xl font-bold text-warning">{mediumAlerts}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="p-3 rounded-xl bg-info/10">
                <AlertTriangle className="w-6 h-6 text-info" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Low Severity</p>
                <p className="text-2xl font-bold text-info">{lowAlerts}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Alerts Table */}
        <Card>
          <CardHeader>
            <CardTitle>All Alerts</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Station</TableHead>
                  <TableHead className="hidden md:table-cell">Message</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead className="hidden sm:table-cell">Time</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {alerts.map((alert) => (
                  <TableRow key={alert.id} className={!alert.acknowledged ? 'bg-secondary/30' : ''}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getAlertIcon(alert.type)}
                        <span className="capitalize hidden sm:inline">
                          {alert.type.replace('_', ' ')}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{alert.stationId}</TableCell>
                    <TableCell className="hidden md:table-cell max-w-xs truncate">
                      {alert.message}
                    </TableCell>
                    <TableCell>
                      <Badge className={getSeverityColor(alert.severity)}>
                        {alert.severity}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-muted-foreground text-sm">
                      {formatDistanceToNow(alert.timestamp, { addSuffix: true })}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {alert.acknowledged && (
                          <Badge variant="outline" className="text-success border-success text-xs">
                            Ack
                          </Badge>
                        )}
                        {alert.technicianDispatched && (
                          <Badge variant="outline" className="text-primary border-primary text-xs">
                            Tech
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleAcknowledge(alert.id)}
                          disabled={alert.acknowledged}
                        >
                          <Check className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDispatchTechnician(alert.id)}
                          disabled={alert.technicianDispatched}
                        >
                          <Truck className="w-4 h-4" />
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

export default Safety;
