import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { mockAlerts } from '@/data/mockData';
import { formatDistanceToNow } from 'date-fns';

export function RecentAlerts() {
  const recentAlerts = mockAlerts.slice(0, 4);

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

  return (
    <Card className="premium-card border-0">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div>
          <CardTitle className="text-base font-semibold">Recent Alerts</CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">Latest system notifications</p>
        </div>
        <Button variant="ghost" size="sm" asChild className="text-xs text-primary hover:text-primary">
          <Link to="/safety" className="gap-1">
            View All <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {recentAlerts.map((alert) => (
            <div
              key={alert.id}
              className="flex items-start gap-3 p-3.5 rounded-xl bg-secondary/40 hover:bg-secondary/60 transition-colors duration-200"
            >
              <div className={`p-2.5 rounded-xl ${
                alert.severity === 'high' ? 'bg-destructive/10' : 
                alert.severity === 'medium' ? 'bg-warning/10' : 'bg-info/10'
              }`}>
                <AlertTriangle className={`w-4 h-4 ${
                  alert.severity === 'high' ? 'text-destructive' : 
                  alert.severity === 'medium' ? 'text-warning' : 'text-info'
                }`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-sm">{alert.stationId}</span>
                  <Badge className={`${getSeverityColor(alert.severity)} text-[10px] px-1.5 py-0`}>
                    {alert.severity}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground truncate">
                  {alert.message}
                </p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  {formatDistanceToNow(alert.timestamp, { addSuffix: true })}
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
