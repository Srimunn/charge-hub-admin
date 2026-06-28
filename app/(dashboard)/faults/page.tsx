"use client";

import { useMemo } from 'react';
import { DashboardHeader } from '@/components/layout/DashboardHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  AlertTriangle, CheckCircle, ShieldAlert
} from 'lucide-react';
import { getFaults, resolveFault } from '@/services/api';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export default function FaultsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const faultsQuery = useQuery({ queryKey: ["faults"], queryFn: getFaults });
  const faults = useMemo(() => (faultsQuery.data ?? []) as any[], [faultsQuery.data]);

  const resolveMutation = useMutation({
    mutationFn: resolveFault,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["faults"] });
      toast({ title: 'Fault Resolved', description: `Fault safely marked as resolved in the system.` });
    },
    onError: (err: any) => {
      toast({ title: 'Error Resolving', description: err?.message, variant: 'destructive' });
    }
  });

  const handleResolve = (id: string) => resolveMutation.mutate(id);

  const counts = useMemo(() => {
    const openCount = faults.filter((f) => f.status === "active").length;
    const highCount = faults.filter((f) => f.severity === "high" && f.status === "active").length;
    const resolvedCount = faults.filter((f) => f.status === "resolved").length;
    return { openCount, highCount, resolvedCount };
  }, [faults]);

  return (
    <div className="flex flex-col min-h-screen">
      <DashboardHeader title="Faults & Alerts" subtitle="Monitor and manage station faults" />
      <div className="flex-1 p-6 space-y-6">
        {/* KPI Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="p-3 rounded-xl bg-destructive/10">
                <ShieldAlert className="w-6 h-6 text-destructive" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active Faults</p>
                <p className="text-2xl font-bold">{counts.openCount}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-4 bg-red-50 dark:bg-red-950/20">
              <div className="p-3 rounded-xl bg-destructive">
                <AlertTriangle className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-destructive font-semibold">Critical (High)</p>
                <p className="text-2xl font-bold text-destructive animate-pulse">{counts.highCount}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="p-3 rounded-xl bg-success/10">
                <CheckCircle className="w-6 h-6 text-success" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Resolved</p>
                <p className="text-2xl font-bold">{counts.resolvedCount}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle>All Faults</CardTitle>
          </CardHeader>
          <CardContent>
            {faultsQuery.isLoading ? (
              <div className="p-8 text-center text-muted-foreground">Loading faults…</div>
            ) : faults.length === 0 ? <p className="text-muted-foreground p-4 text-center">No faults detected.</p> : (
            <div className="space-y-4">
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto w-full">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Station</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Message</TableHead>
                      <TableHead>Severity</TableHead>
                      <TableHead>Time Detected</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {faults.map(fault => (
                      <TableRow key={fault._id} className={fault.severity === 'high' && fault.status === 'active' ? "bg-destructive/10" : ""}>
                        <TableCell className="font-medium">{fault.stationId?.name || "Unknown"}</TableCell>
                        <TableCell className="capitalize">{fault.type}</TableCell>
                        <TableCell>{fault.message}</TableCell>
                        <TableCell>
                          <Badge className={
                            fault.severity === 'high' ? 'bg-destructive text-destructive-foreground animate-pulse' :
                            fault.severity === 'medium' ? 'bg-warning text-warning-foreground' :
                            'bg-info text-info-foreground'
                          }>
                            {fault.severity}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                          {format(new Date(fault.createdAt), 'MMM dd, HH:mm')}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={
                            fault.status === 'active' ? 'border-destructive text-destructive' :
                            'border-success text-success'
                          }>
                            {fault.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            {fault.status !== 'resolved' && (
                              <Button variant="outline" size="sm" onClick={() => handleResolve(fault._id)}>
                                <CheckCircle className="w-4 h-4 text-success mr-2" /> Resolve
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Cards View */}
              <div className="grid grid-cols-1 gap-4 md:hidden">
                {faults.map(fault => (
                  <div key={fault._id} className={`p-4 bg-secondary/30 rounded-2xl border border-border/40 space-y-4 ${
                    fault.severity === 'high' && fault.status === 'active' ? "border-destructive/40 bg-destructive/5" : ""
                  }`}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex flex-col">
                        <span className="font-bold text-sm text-foreground">{fault.stationId?.name || "Unknown"}</span>
                        <span className="text-[10px] text-muted-foreground font-mono mt-0.5">ID: {fault.stationId?.stationNumber || 'N/A'}</span>
                      </div>
                      <Badge className={
                        fault.severity === 'high' ? 'bg-destructive text-destructive-foreground animate-pulse' :
                        fault.severity === 'medium' ? 'bg-warning text-warning-foreground' :
                        'bg-info text-info-foreground'
                      }>
                        {fault.severity}
                      </Badge>
                    </div>

                    <div className="space-y-2 text-xs bg-background/50 p-3 rounded-xl border border-border/20">
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Type:</span>
                        <span className="font-semibold capitalize text-foreground">{fault.type}</span>
                      </div>
                      <div className="flex justify-between items-start gap-4">
                        <span className="text-muted-foreground shrink-0">Message:</span>
                        <span className="font-medium text-foreground text-right">{fault.message}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Detected:</span>
                        <span className="font-mono text-muted-foreground">{format(new Date(fault.createdAt), 'MMM dd, HH:mm')}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Status:</span>
                        <Badge variant="outline" className={
                          fault.status === 'active' ? 'border-destructive text-destructive' :
                          'border-success text-success'
                        }>
                          {fault.status}
                        </Badge>
                      </div>
                    </div>

                    {fault.status !== 'resolved' && (
                      <div className="pt-1">
                        <Button 
                          variant="outline" 
                          className="w-full h-11 gap-2 font-medium border-success/30 hover:bg-success/10 text-success" 
                          onClick={() => handleResolve(fault._id)}
                        >
                          <CheckCircle className="w-4 h-4 text-success shrink-0" /> Resolve Fault
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
