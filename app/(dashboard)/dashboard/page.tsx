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

  const renderStatusPill = (status: string) => {
    const s = String(status || '').toLowerCase();
    let badgeClass = 'bg-slate-100 text-slate-700 border-slate-300/60';
    let dotClass = 'bg-slate-400';
    let label = status;

    switch (s) {
      case 'online':
      case 'available':
        badgeClass = 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300/60';
        dotClass = 'bg-emerald-500';
        label = 'Available';
        break;
      case 'charging':
        badgeClass = 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border-blue-300/60';
        dotClass = 'bg-blue-500 animate-pulse';
        label = 'Charging';
        break;
      case 'faulted':
      case 'fault':
        badgeClass = 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border-rose-300/60 animate-pulse';
        dotClass = 'bg-rose-500';
        label = 'Fault';
        break;
      case 'offline':
        badgeClass = 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-300/60';
        dotClass = 'bg-slate-400';
        label = 'Offline';
        break;
      case 'maintenance':
        badgeClass = 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-300/60';
        dotClass = 'bg-amber-500';
        label = 'Maintenance';
        break;
    }

    return (
      <Badge className={`rounded-full px-3 py-1 text-xs font-bold border shadow-xs inline-flex items-center gap-1.5 ${badgeClass}`}>
        <span className={`w-2 h-2 rounded-full ${dotClass}`} />
        {label}
      </Badge>
    );
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#F5F8FC] dark:bg-slate-950/60">
      <DashboardHeader 
        title="Dashboard" 
        subtitle="Overview of your charging network"
      />
      
      <div className="flex-1 p-5 lg:p-8 space-y-7">
        
        {/* Top Section: KPIs (Left) + Insights (Right) exactly split into halves */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-7">
          {/* Left Column - Vertical KPI Cards (50% Width) */}
          <div className="w-full min-w-0">
            <KPICards />
          </div>

          {/* Right Column - Insights (50% Width) */}
          <div className="w-full space-y-7 min-w-0">
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
            <Card className="h-full shadow-sm hover:shadow-md transition-all duration-200 border-y-0 border-r-0 border-l-[6px] border-sky-500 bg-white dark:bg-slate-900 rounded-2xl overflow-hidden">
              <CardHeader className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                <CardTitle className="text-base font-bold text-slate-900 dark:text-slate-100">Recent Stations</CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                {stations.length === 0 ? (
                  <div className="text-center text-muted-foreground p-8">No stations found. Add one to see it here.</div>
                ) : (
                  <div className="space-y-4">
                    {/* Desktop Table View */}
                    <div className="hidden md:block overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-b border-slate-200/80 dark:border-slate-800 hover:bg-transparent">
                            <TableHead className="w-16 font-bold text-slate-700 dark:text-slate-300"></TableHead>
                            <TableHead className="font-bold text-slate-700 dark:text-slate-300">Station No.</TableHead>
                            <TableHead className="font-bold text-slate-700 dark:text-slate-300">Station Name</TableHead>
                            <TableHead className="font-bold text-slate-700 dark:text-slate-300">Location</TableHead>
                            <TableHead className="font-bold text-slate-700 dark:text-slate-300">Status</TableHead>
                            <TableHead className="font-bold text-slate-700 dark:text-slate-300">Power</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {stations.slice(0, 5).map((station) => (
                            <TableRow key={station._id} className="even:bg-sky-50/40 dark:even:bg-slate-800/30 hover:bg-sky-100/50 dark:hover:bg-slate-800/80 transition-colors duration-150 border-b border-slate-100 dark:border-slate-800/60">
                              <TableCell>
                                {station.image ? (
                                  <div className="w-10 h-10 rounded-xl overflow-hidden shadow-sm border border-slate-200 dark:border-slate-700">
                                    <img
                                      src={getImageUrl(station.image)}
                                      alt={station.name}
                                      className="w-full h-full object-cover"
                                    />
                                  </div>
                                ) : (
                                  <div className="w-10 h-10 rounded-xl bg-sky-100 dark:bg-sky-950 flex items-center justify-center border border-sky-200 dark:border-sky-800">
                                    <Zap className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                                  </div>
                                )}
                              </TableCell>
                              <TableCell>
                                {station.stationNumber ? (
                                  <Badge variant="outline" className="font-mono font-bold border-sky-300 dark:border-sky-800 bg-sky-50/80 dark:bg-sky-950/40 text-sky-800 dark:text-sky-300">{station.stationNumber}</Badge>
                                ) : (
                                  <span className="text-muted-foreground text-xs">N/A</span>
                                )}
                              </TableCell>
                              <TableCell className="font-bold text-slate-800 dark:text-slate-200">{station.name}</TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                                  <MapPin className="w-3.5 h-3.5 text-sky-600" />
                                  <span className="truncate max-w-[150px] font-medium text-xs">{station.location}</span>
                                </div>
                              </TableCell>
                              <TableCell>
                                {renderStatusPill(station.status)}
                              </TableCell>
                              <TableCell className="font-bold text-slate-700 dark:text-slate-300">{station.powerOutput || 0} kW</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    {/* Mobile Cards View */}
                    <div className="grid grid-cols-1 gap-3 md:hidden">
                      {stations.slice(0, 5).map((station) => (
                        <div key={station._id} className="p-4 bg-gradient-to-br from-white to-sky-50/30 dark:from-slate-900 dark:to-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-3">
                          <div className="flex items-center gap-3">
                            {station.image ? (
                              <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 border border-slate-200 dark:border-slate-700">
                                <img
                                  src={getImageUrl(station.image)}
                                  alt={station.name}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            ) : (
                              <div className="w-12 h-12 rounded-xl bg-sky-100 dark:bg-sky-950 flex items-center justify-center border border-sky-200 dark:border-sky-800 shrink-0">
                                <Zap className="w-5 h-5 text-sky-600 dark:text-sky-400" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-bold text-sm text-foreground truncate">{station.name}</span>
                                {renderStatusPill(station.status)}
                              </div>
                              <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
                                <MapPin className="w-3.5 h-3.5 text-sky-600" />
                                <span className="truncate">{station.location}</span>
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-200/60 dark:border-slate-800">
                            <div>
                              <span className="text-muted-foreground">Station No:</span>{" "}
                              <Badge variant="outline" className="font-mono font-bold text-[10px] ml-1">{station.stationNumber || 'N/A'}</Badge>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Power:</span>{" "}
                              <span className="font-semibold text-foreground">{station.powerOutput || 0} kW</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Middle Section: Full-width charts */}
        <div className="w-full min-w-0">
          <EnergyUsageChart />
        </div>
        
        <div className="w-full min-w-0">
          <RevenuePerStationChart />
        </div>

        {/* Bottom Section: Side-by-side charts */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="w-full min-w-0">
            <RevenueTrendChart />
          </div>
          <div className="w-full min-w-0">
            <FaultTrendChart />
          </div>
        </div>

      </div>
    </div>
  );
}
