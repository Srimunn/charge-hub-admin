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
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg font-semibold">Recent Alerts</CardTitle>
        <Button variant="ghost" size="sm" asChild>
          <Link to="/safety" className="gap-1">
            View All <ArrowRight className="w-4 h-4" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {recentAlerts.map((alert) => (
            <div
              key={alert.id}
              className="flex items-start gap-3 p-3 rounded-lg bg-secondary/50"
            >
              <div className={`p-2 rounded-lg ${
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
                  <span className="font-medium text-sm">{alert.stationId}</span>
                  <Badge className={getSeverityColor(alert.severity)}>
                    {alert.severity}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground truncate">
                  {alert.message}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
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
