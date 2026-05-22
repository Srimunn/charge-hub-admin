"use client";

import { useParams, useRouter } from "next/navigation";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, CheckCircle } from "lucide-react";
import { getFaultById, resolveFault } from "@/services/api";
import { format } from "date-fns";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

export default function FaultDetailPage() {
  const params = useParams();
  const faultId = params.faultId as string;
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const faultQuery = useQuery({
    queryKey: ["fault", faultId],
    queryFn: () => getFaultById(faultId),
    enabled: Boolean(faultId),
  });

  const resolveMutation = useMutation({
    mutationFn: (id: string) => resolveFault(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["faults"] });
      queryClient.invalidateQueries({ queryKey: ["fault", faultId] });
      toast({ title: "Fault Resolved", description: "Fault marked as resolved." });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err?.message, variant: "destructive" });
    },
  });

  const fault = faultQuery.data as any;

  if (faultQuery.isLoading) {
    return <div className="p-8 text-center text-muted-foreground">Loading fault details…</div>;
  }

  if (faultQuery.isError || !fault) {
    return (
      <div className="flex flex-col min-h-screen">
        <DashboardHeader title="Fault Not Found" />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-xl font-semibold mb-2">Fault not found</h2>
            <Button onClick={() => router.push("/faults")}><ArrowLeft className="w-4 h-4 mr-2" /> Back to Faults</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      <DashboardHeader title="Fault Details" subtitle={fault.stationId?.name || "Unknown Station"} />
      <div className="flex-1 p-6 space-y-6">
        <Button variant="outline" onClick={() => router.push("/faults")} className="gap-2">
          <ArrowLeft className="w-4 h-4" /> Back to Faults
        </Button>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="capitalize">{fault.type}</span>
              <Badge variant="outline" className={fault.status === "active" ? "border-destructive text-destructive" : "border-success text-success"}>
                {fault.status}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-lg bg-secondary/50">
                <p className="text-sm text-muted-foreground">Severity</p>
                <p className="font-medium capitalize">{fault.severity}</p>
              </div>
              <div className="p-4 rounded-lg bg-secondary/50">
                <p className="text-sm text-muted-foreground">Detected</p>
                <p className="font-medium">{fault.createdAt ? format(new Date(fault.createdAt), "MMM dd, HH:mm") : "—"}</p>
              </div>
              <div className="p-4 rounded-lg bg-secondary/50">
                <p className="text-sm text-muted-foreground">Resolved</p>
                <p className="font-medium">{fault.resolvedAt ? format(new Date(fault.resolvedAt), "MMM dd, HH:mm") : "—"}</p>
              </div>
            </div>

            <div className="p-4 rounded-lg border bg-muted/20">
              <p className="text-sm text-muted-foreground mb-1">Message</p>
              <p className="font-medium">{fault.message || "—"}</p>
            </div>

            {fault.status !== "resolved" ? (
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => resolveMutation.mutate(fault._id)}
                disabled={resolveMutation.isPending}
              >
                <CheckCircle className="w-4 h-4 text-success" /> Resolve Fault
              </Button>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

