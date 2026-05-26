"use client";

import { useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { DashboardHeader } from '@/components/layout/DashboardHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Power, PowerOff, Wrench, Eye, MapPin, Plus, Zap, Edit, Trash2 } from 'lucide-react';

import { useToast } from '@/hooks/use-toast';
import { Progress } from '@/components/ui/progress';
import { getStations, deleteStation, getImageUrl } from '@/services/api';
import { AddStationModal } from '@/components/dashboard/AddStationModal';
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export interface StationData {
  _id: string;
  id?: string;
  stationNumber?: string;
  name: string;
  location: string;
  status: string;
  powerOutput?: number;
  ports?: number;
  health?: number;
  image?: string;
  ocppConnected?: boolean;
  basePricePerKwh?: number;
  dynamicPricing?: {startTime: string, endTime: string, pricePerKwh: number}[];
  convenienceFee?: number;
  tax?: number;
}


export default function StationsPage() {
  const { toast } = useToast();
  const router = useRouter();
  const queryClient = useQueryClient();

  const stationsQuery = useQuery({
    queryKey: ["stations"],
    queryFn: getStations,
    staleTime: 0,
  });

  useQuery({
    queryKey: ["liveTelemetry"],
    queryFn: async () => ({}),
    initialData: {},
    staleTime: Infinity,
  });

  const telemetry = (queryClient.getQueryData(["liveTelemetry"]) || {}) as Record<string, any>;

  const deleteMutation = useMutation({
    mutationFn: deleteStation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stations"] });
      toast({ title: "Success", description: "Station removed successfully" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err?.message || "Failed to remove station", variant: "destructive" });
    },
  });

  const handleDeleteStation = (id: string) => {
    if (!window.confirm("Are you sure you want to remove this station?")) return;
    deleteMutation.mutate(id);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'bg-success text-success-foreground';
      case 'offline': return 'bg-destructive text-destructive-foreground';
      case 'maintenance': return 'bg-warning text-warning-foreground';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getHealthColor = (health: number = 100) => {
    if (health >= 90) return 'bg-success';
    if (health >= 70) return 'bg-warning';
    return 'bg-destructive';
  };

  const getCurrentRate = (station: StationData) => {
    let price = station.basePricePerKwh || 15;
    let isPeak = false;

    if (station.dynamicPricing && station.dynamicPricing.length > 0) {
      const now = new Date();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();
      const currentTimeStr = `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`;

      for (let rule of station.dynamicPricing) {
        if (rule.startTime && rule.endTime && currentTimeStr >= rule.startTime && currentTimeStr <= rule.endTime) {
          price = rule.pricePerKwh;
          isPeak = true;
          break;
        }
      }
    }

    return { price, isPeak };
  };

  const stations = useMemo(() => (stationsQuery.data ?? []) as StationData[], [stationsQuery.data]);

  const counts = useMemo(() => {
    return {
      online: stations.filter((s) => s.status === "online").length,
      offline: stations.filter((s) => s.status === "offline").length,
      maintenance: stations.filter((s) => s.status === "maintenance").length,
    };
  }, [stations]);

  return (
    <div className="flex flex-col min-h-screen">
      <DashboardHeader 
        title="Station Management" 
        subtitle="Monitor and control your charging stations"
      />
      
      <div className="flex-1 p-6 space-y-6">
        <div className="flex justify-end">
          <AddStationModal 
            onStationAdded={() => queryClient.invalidateQueries({ queryKey: ["stations"] })}
            customTrigger={<Button><Plus className="w-4 h-4 mr-2"/> Add Station</Button>}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="p-3 rounded-xl bg-success/10"><Power className="w-6 h-6 text-success" /></div>
              <div><p className="text-sm text-muted-foreground">Online</p><p className="text-2xl font-bold">{counts.online}</p></div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="p-3 rounded-xl bg-destructive/10"><PowerOff className="w-6 h-6 text-destructive" /></div>
              <div><p className="text-sm text-muted-foreground">Offline</p><p className="text-2xl font-bold">{counts.offline}</p></div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="p-3 rounded-xl bg-warning/10"><Wrench className="w-6 h-6 text-warning" /></div>
              <div><p className="text-sm text-muted-foreground">Maintenance</p><p className="text-2xl font-bold">{counts.maintenance}</p></div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle>My Stations</CardTitle></CardHeader>
          <CardContent>
            {stationsQuery.isLoading ? (
              <div className="p-8">
                <div className="h-6 w-48 bg-muted rounded-md animate-pulse mb-3" />
                <div className="h-10 w-full bg-muted rounded-md animate-pulse" />
              </div>
            ) : stations.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">No stations found. Click &quot;Add Station&quot; to create one.</div>
            ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16 hidden sm:table-cell">Image</TableHead>
                  <TableHead>Station No.</TableHead>
                  <TableHead>Station Name</TableHead>
                  <TableHead className="hidden md:table-cell">Location</TableHead>
                  <TableHead className="hidden lg:table-cell">Connectors</TableHead>
                  <TableHead>Power (kW)</TableHead>
                  <TableHead className="hidden lg:table-cell">Live (kW)</TableHead>
                  <TableHead className="hidden lg:table-cell">Temp (°C)</TableHead>
                  <TableHead>Current Rate</TableHead>
                  <TableHead className="hidden md:table-cell">OCPP</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden sm:table-cell">Health</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stations.map((station) => (
                  (() => {
                    const t = telemetry?.[station._id];
                    return (
                  <TableRow key={station._id}>
                    {/* Image Thumbnail */}
                    <TableCell>
                      {station.image ? (
                        <div className="relative w-12 h-12 rounded-xl overflow-hidden shadow-md border-2 border-background group">
                          <img
                            src={getImageUrl(station.image)}
                            alt={station.name}
                            className="w-full h-full object-cover transition-transform group-hover:scale-110"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = "/placeholder.svg";
                            }}
                          />
                        </div>
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center border-2 border-dashed border-primary/20">
                          <Zap className="w-5 h-5 text-primary/60" />
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {station.stationNumber ? (
                        <Badge variant="outline" className="font-mono font-bold">{station.stationNumber}</Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">N/A</span>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{station.name}</TableCell>
                    <TableCell className="hidden md:table-cell">
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <MapPin className="w-4 h-4" />
                        <span className="truncate max-w-[200px]">{station.location}</span>
                      </div>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
                        {station.ports || 1}
                      </Badge>
                    </TableCell>
                    <TableCell>{station.powerOutput || 0} kW</TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <span className="font-mono text-sm">{t?.power ? Number(t.power).toFixed(2) : "—"}</span>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <span className="font-mono text-sm">{t?.temperature ?? "—"}</span>
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const { price, isPeak } = getCurrentRate(station);
                        return (
                          <div className="flex flex-col gap-1 w-max">
                            <span className="font-semibold text-sm">₹{price}/kWh</span>
                            <Badge variant={isPeak ? "destructive" : "secondary"} className={`w-fit text-[10px] px-1.5 py-0.5 h-auto leading-none ${isPeak ? '' : 'bg-primary/10 text-primary border-primary/20'}`}>
                              {isPeak ? "Peak Hours" : "Standard Rate"}
                            </Badge>
                          </div>
                        );
                      })()}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <Badge variant="outline" className={station.ocppConnected ? "border-success text-success" : "border-muted text-muted-foreground"}>
                        {station.ocppConnected ? "Connected" : "Disconnected"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(station.status)}>{station.status}</Badge>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <div className="flex items-center gap-2 w-24">
                        <Progress value={station.health || 100} className={`h-2 ${getHealthColor(station.health)}`} />
                        <span className="text-xs text-muted-foreground w-8">{station.health || 100}%</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon"><MoreHorizontal className="w-4 h-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/stations/${station._id}`} className="flex items-center gap-2">
                              <Eye className="w-4 h-4" /> View Details
                            </Link>
                          </DropdownMenuItem>
                          
                          <AddStationModal 
                            editingStation={station}
                            onStationAdded={() => queryClient.invalidateQueries({ queryKey: ["stations"] })}
                            customTrigger={
                              <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="flex items-center gap-2">
                                <Edit className="w-4 h-4" /> Update
                              </DropdownMenuItem>
                            }
                          />

                          <DropdownMenuItem 
                            className="flex items-center gap-2 text-destructive focus:text-destructive"
                            onClick={() => handleDeleteStation(station._id)}
                          >
                            <Trash2 className="w-4 h-4" /> Remove
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                    );
                  })()
                ))}
              </TableBody>
            </Table>
            )}

          </CardContent>
        </Card>
      </div>
    </div>
  );
}
