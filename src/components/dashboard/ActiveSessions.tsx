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
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg font-semibold">Active Charging Sessions</CardTitle>
        <Button variant="ghost" size="sm" asChild>
          <Link to="/sessions" className="gap-1">
            View All <ArrowRight className="w-4 h-4" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {activeSessions.map((session) => (
            <div
              key={session.id}
              className="flex items-center gap-4 p-3 rounded-lg bg-secondary/50"
            >
              <div className="p-2 rounded-lg bg-success/10">
                <Zap className="w-4 h-4 text-success" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-sm truncate">{session.vehicleId}</span>
                  <Badge variant="outline" className="text-success border-success">
                    {session.chargingPower} kW
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Battery className="w-4 h-4 text-muted-foreground" />
                  <Progress value={session.batterySOC} className="flex-1 h-2" />
                  <span className="text-xs text-muted-foreground w-10">
                    {session.batterySOC}%
                  </span>
                </div>
                <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                  <span>{session.stationId}</span>
                  <span>${session.revenue.toFixed(2)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
