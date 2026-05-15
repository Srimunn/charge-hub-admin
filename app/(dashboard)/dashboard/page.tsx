"use client";

import { useState, useEffect } from 'react';
import { DashboardHeader } from '@/components/layout/DashboardHeader';
import { KPICards } from '@/components/dashboard/KPICards';
import { EnergyUsageChart } from '@/components/dashboard/EnergyUsageChart';
import { RevenuePerStationChart } from '@/components/dashboard/RevenuePerStationChart';
import { RevenueTrendChart } from '@/components/dashboard/RevenueTrendChart';
import { CO2SavingsChart } from '@/components/dashboard/CO2SavingsChart';
import { StationUtilizationChart } from '@/components/dashboard/StationUtilizationChart';
import { FaultTrendChart } from '@/components/dashboard/FaultTrendChart';
import { AddStationModal } from '@/components/dashboard/AddStationModal';
import { getStations, getImageUrl } from '@/services/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { MapPin, Zap } from 'lucide-react';

export default function DashboardPage() {
  const [stations, setStations] = useState<any[]>([]);

  useEffect(() => {
    fetchStations();
  }, []);

  const fetchStations = async () => {
    try {
      const data = await getStations();
      setStations(data);
    } catch (err) {
      console.error("Failed to fetch stations:", err);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'bg-success text-success-foreground';
      case 'offline': return 'bg-destructive text-destructive-foreground';
      case 'maintenance': return 'bg-warning text-warning-foreground';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <div className="flex flex-col min-h-screen">
      <DashboardHeader 
        title="Dashboard" 
        subtitle="Overview of your charging network"
      />
      
      <div className="flex-1 p-5 lg:p-8 space-y-7">
        
        {/* Top Section: KPIs (Left) + Insights (Right) exactly split into halves */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-7">
          {/* Left Column - Vertical KPI Cards (50% Width) */}
          <div className="w-full">
            <KPICards />
          </div>

          {/* Right Column - Insights (50% Width) */}
          <div className="w-full space-y-7">
            <StationUtilizationChart />
            <CO2SavingsChart />
          </div>
        </div>

        {/* Stations Management Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-7">
          {/* Add Station Form */}
          <div className="w-full lg:col-span-1">
            <AddStationModal onStationAdded={fetchStations} />
          </div>

          {/* Stations Table */}
          <div className="w-full lg:col-span-2">
            <Card className="h-full shadow-lg border-0">
              <CardHeader>
                <CardTitle>Recent Stations</CardTitle>
              </CardHeader>
              <CardContent>
                {stations.length === 0 ? (
                  <div className="text-center text-muted-foreground p-8">No stations found. Add one to see it here.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-16"></TableHead>
                          <TableHead>Station No.</TableHead>
                          <TableHead>Station Name</TableHead>
                          <TableHead>Location</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Power</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {stations.slice(0, 5).map((station) => (
                          <TableRow key={station._id}>
                            <TableCell>
                              {station.image ? (
                                <div className="w-10 h-10 rounded-lg overflow-hidden shadow-sm border border-border">
                                  <img
                                    src={getImageUrl(station.image)}
                                    alt={station.name}
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                              ) : (
                                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center border border-dashed border-primary/20">
                                  <Zap className="w-4 h-4 text-primary/60" />
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
                            <TableCell>
                              <div className="flex items-center gap-1 text-muted-foreground">
                                <MapPin className="w-4 h-4" />
                                <span className="truncate max-w-[150px]">{station.location}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge className={getStatusColor(station.status)}>{station.status}</Badge>
                            </TableCell>
                            <TableCell>{station.powerOutput || 0} kW</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Middle Section: Full-width charts */}
        <div className="w-full">
          <EnergyUsageChart />
        </div>
        
        <div className="w-full">
          <RevenuePerStationChart />
        </div>

        {/* Bottom Section: Side-by-side charts */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <RevenueTrendChart />
          <FaultTrendChart />
        </div>

      </div>
    </div>
  );
}
