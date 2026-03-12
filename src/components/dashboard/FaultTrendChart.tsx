import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { AlertTriangle } from 'lucide-react';

const faultTrendData = [
  { week: 'W1', faults: 8 },
  { week: 'W2', faults: 12 },
  { week: 'W3', faults: 6 },
  { week: 'W4', faults: 15 },
  { week: 'W5', faults: 9 },
  { week: 'W6', faults: 4 },
  { week: 'W7', faults: 7 },
  { week: 'W8', faults: 3 },
];

export function FaultTrendChart() {
  return (
    <Card className="premium-card border-0 animate-fade-in-up" style={{ animationDelay: '0.7s' }}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base font-semibold">Fault Trend</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">Weekly fault occurrences</p>
          </div>
          <div className="flex items-center gap-1.5 text-destructive bg-destructive/10 px-2.5 py-1 rounded-lg">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span className="text-xs font-semibold">↓ 57%</span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={faultTrendData}>
            <defs>
              <linearGradient id="faultGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--destructive))" stopOpacity={0.2} />
                <stop offset="100%" stopColor="hsl(var(--destructive))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis dataKey="week" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
            <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} width={30} />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '12px',
                fontSize: '12px',
              }}
            />
            <Line
              type="monotone"
              dataKey="faults"
              stroke="hsl(var(--destructive))"
              strokeWidth={2.5}
              dot={{ r: 4, fill: 'hsl(var(--destructive))', stroke: 'hsl(var(--card))', strokeWidth: 2 }}
              activeDot={{ r: 6, fill: 'hsl(var(--destructive))', stroke: 'white', strokeWidth: 2 }}
              animationDuration={1600}
              animationEasing="ease-in-out"
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
