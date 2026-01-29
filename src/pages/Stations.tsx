import { useState } from 'react';
import { Link } from 'react-router-dom';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Power, PowerOff, Wrench, Eye, MapPin } from 'lucide-react';
import { mockStations, Station } from '@/data/mockData';
import { useToast } from '@/hooks/use-toast';
import { Progress } from '@/components/ui/progress';

const Stations = () => {
  const [stations, setStations] = useState<Station[]>(mockStations);
  const { toast } = useToast();

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online':
        return 'bg-success text-success-foreground';
      case 'offline':
        return 'bg-destructive text-destructive-foreground';
      case 'maintenance':
        return 'bg-warning text-warning-foreground';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const getHealthColor = (health: number) => {
    if (health >= 90) return 'bg-success';
    if (health >= 70) return 'bg-warning';
    return 'bg-destructive';
  };

  const handleAction = (stationId: string, action: string) => {
    setStations(prev =>
      prev.map(station => {
        if (station.id === stationId) {
          switch (action) {
            case 'enable':
              return { ...station, status: 'online' as const };
            case 'disable':
              return { ...station, status: 'offline' as const };
            case 'maintenance':
              return { ...station, status: 'maintenance' as const };
            default:
              return station;
          }
        }
        return station;
      })
    );

    toast({
      title: 'Station Updated',
      description: `Station ${stationId} has been set to ${action}`,
    });
  };

  const onlineCount = stations.filter(s => s.status === 'online').length;
  const offlineCount = stations.filter(s => s.status === 'offline').length;
  const maintenanceCount = stations.filter(s => s.status === 'maintenance').length;

  return (
    <div className="flex flex-col min-h-screen">
      <DashboardHeader 
        title="Station Management" 
        subtitle="Monitor and control your charging stations"
      />
      
      <div className="flex-1 p-6 space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="p-3 rounded-xl bg-success/10">
                <Power className="w-6 h-6 text-success" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Online</p>
                <p className="text-2xl font-bold">{onlineCount}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="p-3 rounded-xl bg-destructive/10">
                <PowerOff className="w-6 h-6 text-destructive" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Offline</p>
                <p className="text-2xl font-bold">{offlineCount}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="p-3 rounded-xl bg-warning/10">
                <Wrench className="w-6 h-6 text-warning" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Maintenance</p>
                <p className="text-2xl font-bold">{maintenanceCount}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Stations Table */}
        <Card>
          <CardHeader>
            <CardTitle>All Stations</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Station ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead className="hidden md:table-cell">Location</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden sm:table-cell">Health</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stations.map((station) => (
                  <TableRow key={station.id}>
                    <TableCell className="font-medium">{station.id}</TableCell>
                    <TableCell>{station.name}</TableCell>
                    <TableCell className="hidden md:table-cell">
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <MapPin className="w-4 h-4" />
                        <span className="truncate max-w-[200px]">{station.location}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(station.status)}>
                        {station.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <div className="flex items-center gap-2 w-24">
                        <Progress 
                          value={station.health} 
                          className={`h-2 ${getHealthColor(station.health)}`}
                        />
                        <span className="text-xs text-muted-foreground w-8">
                          {station.health}%
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link to={`/stations/${station.id}`} className="flex items-center gap-2">
                              <Eye className="w-4 h-4" /> View Details
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleAction(station.id, 'enable')}
                            disabled={station.status === 'online'}
                          >
                            <Power className="w-4 h-4 mr-2" /> Enable
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleAction(station.id, 'disable')}
                            disabled={station.status === 'offline'}
                          >
                            <PowerOff className="w-4 h-4 mr-2" /> Disable
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleAction(station.id, 'maintenance')}
                            disabled={station.status === 'maintenance'}
                          >
                            <Wrench className="w-4 h-4 mr-2" /> Set Maintenance
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
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

export default Stations;
