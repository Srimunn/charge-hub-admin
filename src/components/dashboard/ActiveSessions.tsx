import { Link } from 'react-router-dom';
import { ArrowRight, Zap, Battery } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { mockChargingSessions } from '@/data/mockData';

export function ActiveSessions() {
  const activeSessions = mockChargingSessions.filter(s => s.status === 'active').slice(0, 4);

  return (
    <Card className="premium-card border-0">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div>
          <CardTitle className="text-base font-semibold">Active Sessions</CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">Live charging activity</p>
        </div>
        <Button variant="ghost" size="sm" asChild className="text-xs text-primary hover:text-primary">
          <Link to="/sessions" className="gap-1">
            View All <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {activeSessions.map((session) => (
            <div
              key={session.id}
              className="flex items-center gap-4 p-3.5 rounded-xl bg-secondary/40 hover:bg-secondary/60 transition-colors duration-200"
            >
              <div className="p-2.5 rounded-xl bg-success/10">
                <Zap className="w-4 h-4 text-success" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-sm truncate">{session.vehicleId}</span>
                  <Badge variant="outline" className="text-success border-success/30 bg-success/5 text-[11px]">
                    {session.chargingPower} kW
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Battery className="w-3.5 h-3.5 text-muted-foreground" />
                  <Progress value={session.batterySOC} className="flex-1 h-1.5" />
                  <span className="text-[11px] text-muted-foreground w-10 text-right">
                    {session.batterySOC}%
                  </span>
                </div>
                <div className="flex items-center justify-between mt-2 text-[11px] text-muted-foreground">
                  <span>{session.stationId}</span>
                  <span className="font-medium">₹{session.revenue.toFixed(2)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
