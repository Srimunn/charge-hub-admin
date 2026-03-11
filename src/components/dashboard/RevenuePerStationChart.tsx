import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { revenuePerStationData } from '@/data/mockData';

const COLORS = [
  'hsl(207, 78%, 18%)',
  'hsl(207, 64%, 33%)',
  'hsl(207, 78%, 25%)',
  'hsl(207, 64%, 40%)',
  'hsl(142, 76%, 36%)',
  'hsl(207, 78%, 22%)',
  'hsl(207, 64%, 28%)',
  'hsl(142, 76%, 42%)',
];

export function RevenuePerStationChart() {
  return (
    <Card className="animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Revenue per Station</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={revenuePerStationData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              dataKey="name"
              stroke="hsl(var(--muted-foreground))"
              fontSize={12}
            />
            <YAxis
              stroke="hsl(var(--muted-foreground))"
              fontSize={12}
              tickFormatter={(value) => `₹${value}`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '12px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              }}
              labelStyle={{ color: 'hsl(var(--foreground))' }}
              formatter={(value: number) => [`₹${value}`, 'Revenue']}
            />
            <Bar
              dataKey="revenue"
              radius={[8, 8, 0, 0]}
              animationDuration={1200}
              animationEasing="ease-in-out"
            >
              {revenuePerStationData.map((_, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
