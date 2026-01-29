import { useParams, useNavigate } from 'react-router-dom';
import { DashboardHeader } from '@/components/layout/DashboardHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft,
  Radio,
  Thermometer,
  Cpu,
  Disc,
  RefreshCw,
  PowerOff,
  Download,
  CheckCircle,
  AlertTriangle,
  XCircle,
} from 'lucide-react';
import { mockStations } from '@/data/mockData';
import { useToast } from '@/hooks/use-toast';

const StationDetail = () => {
  const { stationId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const station = mockStations.find(s => s.id === stationId);

  if (!station) {
    return (
      <div className="flex flex-col min-h-screen">
        <DashboardHeader title="Station Not Found" />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-xl font-semibold mb-2">Station not found</h2>
            <Button onClick={() => navigate('/stations')}>
              <ArrowLeft className="w-4 h-4 mr-2" /> Back to Stations
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'operational':
        return <CheckCircle className="w-5 h-5 text-success" />;
      case 'degraded':
        return <AlertTriangle className="w-5 h-5 text-warning" />;
      case 'fault':
        return <XCircle className="w-5 h-5 text-destructive" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'operational':
        return 'bg-success/10 text-success border-success/20';
      case 'degraded':
        return 'bg-warning/10 text-warning border-warning/20';
      case 'fault':
        return 'bg-destructive/10 text-destructive border-destructive/20';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const handleRestart = () => {
    toast({
      title: 'Restarting Station',
      description: `Station ${station.id} is being restarted...`,
    });
  };

  const handleDisableCharging = () => {
    toast({
      title: 'Charging Disabled',
      description: `Charging has been disabled on ${station.id}`,
    });
  };

  const handleFirmwareUpdate = () => {
    toast({
      title: 'Firmware Update Started',
      description: `Pushing firmware update to ${station.id}...`,
    });
  };

  return (
    <div className="flex flex-col min-h-screen">
      <DashboardHeader 
        title={station.name} 
        subtitle={station.id}
      />
      
      <div className="flex-1 p-6 space-y-6">
        {/* Back Button */}
        <Button variant="ghost" onClick={() => navigate('/stations')} className="gap-2">
          <ArrowLeft className="w-4 h-4" /> Back to Stations
        </Button>

        {/* Status Overview */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Station Overview</span>
                <Badge className={
                  station.status === 'online' ? 'bg-success text-success-foreground' :
                  station.status === 'offline' ? 'bg-destructive text-destructive-foreground' :
                  'bg-warning text-warning-foreground'
                }>
                  {station.status.toUpperCase()}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-lg bg-secondary/50">
                  <p className="text-sm text-muted-foreground">Location</p>
                  <p className="font-medium truncate">{station.location}</p>
                </div>
                <div className="p-4 rounded-lg bg-secondary/50">
                  <p className="text-sm text-muted-foreground">Firmware</p>
                  <p className="font-medium">v{station.firmwareVersion}</p>
                </div>
                <div className="p-4 rounded-lg bg-secondary/50">
                  <p className="text-sm text-muted-foreground">Total Energy</p>
                  <p className="font-medium">{station.totalEnergy.toLocaleString()} kWh</p>
                </div>
                <div className="p-4 rounded-lg bg-secondary/50">
                  <p className="text-sm text-muted-foreground">Total Revenue</p>
                  <p className="font-medium">${station.totalRevenue.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Temperature */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Thermometer className="w-5 h-5" />
                Temperature
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-center">
                <div className={`text-5xl font-bold ${
                  station.temperature > 50 ? 'text-destructive' :
                  station.temperature > 40 ? 'text-warning' :
                  'text-success'
                }`}>
                  {station.temperature}°C
                </div>
              </div>
              <p className="text-center text-sm text-muted-foreground mt-2">
                {station.temperature > 50 ? 'Critical' :
                 station.temperature > 40 ? 'Elevated' :
                 'Normal'}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Component Status */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Disc className="w-5 h-5" />
                Charging Coil
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`flex items-center gap-3 p-4 rounded-lg border ${getStatusColor(station.coilStatus)}`}>
                {getStatusIcon(station.coilStatus)}
                <span className="font-medium capitalize">{station.coilStatus}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Radio className="w-5 h-5" />
                Sensors
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`flex items-center gap-3 p-4 rounded-lg border ${getStatusColor(station.sensorStatus)}`}>
                {getStatusIcon(station.sensorStatus)}
                <span className="font-medium capitalize">{station.sensorStatus}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Cpu className="w-5 h-5" />
                Power Electronics
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`flex items-center gap-3 p-4 rounded-lg border ${getStatusColor(station.powerElectronicsStatus)}`}>
                {getStatusIcon(station.powerElectronicsStatus)}
                <span className="font-medium capitalize">{station.powerElectronicsStatus}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Controls */}
        <Card>
          <CardHeader>
            <CardTitle>Station Controls</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              <Button onClick={handleRestart} className="gap-2">
                <RefreshCw className="w-4 h-4" />
                Restart Station
              </Button>
              <Button onClick={handleDisableCharging} variant="outline" className="gap-2">
                <PowerOff className="w-4 h-4" />
                Disable Charging
              </Button>
              <Button onClick={handleFirmwareUpdate} variant="secondary" className="gap-2">
                <Download className="w-4 h-4" />
                Push Firmware Update
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default StationDetail;
