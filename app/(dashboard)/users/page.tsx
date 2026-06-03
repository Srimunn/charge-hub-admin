"use client";

import { useMemo } from 'react';
import { DashboardHeader } from '@/components/layout/DashboardHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { User as UserIcon, Users, Building2, Calendar, ShieldCheck, DollarSign } from 'lucide-react';
import { getUsers } from '@/services/api';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';

export default function UsersPage() {
  const usersQuery = useQuery({
    queryKey: ["users"],
    queryFn: getUsers,
  });

  const users = useMemo(() => (usersQuery.data ?? []) as any[], [usersQuery.data]);

  const summary = useMemo(() => {
    const total = users.length;
    const totalSpent = users.reduce((sum, u) => sum + (u.totalSpent || 0), 0);
    const totalSessions = users.reduce((sum, u) => sum + (u.totalSessions || 0), 0);
    return { total, totalSpent, totalSessions };
  }, [users]);

  const UserTable = ({ userList }: { userList: any[] }) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Mobile Number</TableHead>
          <TableHead>Registration Date</TableHead>
          <TableHead className="text-center">Total Sessions</TableHead>
          <TableHead className="text-right">Total Amount Spent</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {userList.length === 0 ? (
          <TableRow>
            <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
              No registered users found in the database.
            </TableCell>
          </TableRow>
        ) : (
          userList.map((user) => (
            <TableRow key={user._id || user.id}>
              <TableCell>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <UserIcon className="w-4 h-4 text-primary" />
                  </div>
                  <span className="font-semibold text-foreground">{user.name}</span>
                </div>
              </TableCell>
              <TableCell className="font-mono text-xs">{user.email}</TableCell>
              <TableCell className="font-mono text-xs">{user.mobile || "—"}</TableCell>
              <TableCell className="text-muted-foreground text-xs">
                {user.createdAt ? format(new Date(user.createdAt), 'MMM dd, yyyy') : "—"}
              </TableCell>
              <TableCell className="text-center font-semibold font-mono text-sm">{user.totalSessions ?? 0}</TableCell>
              <TableCell className="text-right font-bold font-mono text-sm text-success">
                ₹{(user.totalSpent ?? 0).toFixed(2)}
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );

  return (
    <div className="flex flex-col min-h-screen">
      <DashboardHeader 
        title="User & Fleet Management" 
        subtitle="Manage registered users and fleet accounts"
      />
      
      <div className="flex-1 p-6 space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="premium-card border-l-4 border-l-primary">
            <CardContent className="flex items-center gap-4 p-4">
              <div className="p-3 rounded-xl bg-primary/10">
                <Users className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Users</p>
                <p className="text-2xl font-bold">{summary.total}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="premium-card border-l-4 border-l-success">
            <CardContent className="flex items-center gap-4 p-4">
              <div className="p-3 rounded-xl bg-success/10">
                <ShieldCheck className="w-6 h-6 text-success" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Sessions</p>
                <p className="text-2xl font-bold font-mono">{summary.totalSessions}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="premium-card border-l-4 border-l-info">
            <CardContent className="flex items-center gap-4 p-4">
              <div className="p-3 rounded-xl bg-info/10">
                <DollarSign className="w-6 h-6 text-info" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Amount Spent</p>
                <p className="text-2xl font-bold font-mono">₹{summary.totalSpent.toFixed(2)}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Users Tabs */}
        <Card className="shadow-md border-0 bg-card">
          <CardHeader>
            <CardTitle className="text-lg font-bold">Registered Database Records</CardTitle>
          </CardHeader>
          <CardContent>
            {usersQuery.isLoading ? (
              <div className="p-8 text-center text-muted-foreground">Loading users...</div>
            ) : (
              <Tabs defaultValue="all">
                <TabsList className="mb-4">
                  <TabsTrigger value="all">All Users ({users.length})</TabsTrigger>
                  <TabsTrigger value="individual">Individual ({users.length})</TabsTrigger>
                  <TabsTrigger value="fleet">Fleet (0)</TabsTrigger>
                </TabsList>
                <TabsContent value="all">
                  <UserTable userList={users} />
                </TabsContent>
                <TabsContent value="individual">
                  <UserTable userList={users} />
                </TabsContent>
                <TabsContent value="fleet">
                  <Card className="border-dashed bg-muted/20 border-border">
                    <CardContent className="flex flex-col items-center justify-center p-12 text-muted-foreground">
                      <Building2 className="w-12 h-12 mb-4 opacity-50 text-primary" />
                      <p className="text-lg font-semibold text-foreground">Fleet Module Coming Soon</p>
                      <p className="text-sm text-center max-w-sm mt-2">
                        We are currently developing our advanced fleet management features. Stay tuned!
                      </p>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
