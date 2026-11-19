"use client";

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { DashboardHeader } from '@/components/layout/DashboardHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Users, Building2, IndianRupee, ShieldCheck, Search, UserPlus, Ban, CheckCircle2, KeyRound } from 'lucide-react';
import { createUser, getAuditLogs, getUsers, updateUser } from '@/services/api';
import { useToast } from '@/hooks/use-toast';
import { isAdmin } from '@/lib/auth';

type UserRow = {
  _id: string;
  name: string;
  email: string;
  mobile?: string | null;
  role: 'admin' | 'owner' | 'customer';
  status: 'active' | 'blocked';
  createdAt?: string;
  totalSessions?: number;
  totalSpent?: number;
  stationCount?: number;
};

const fmtDate = (d?: string) => (d ? format(new Date(d), 'dd MMM yyyy') : '—');
const inr = (v = 0) => `₹${v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function UsersPage() {
  const admin = isAdmin();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [newUser, setNewUser] = useState({ name: '', email: '', mobile: '', password: '', role: 'owner' as 'owner' | 'admin' });
  const [pinTarget, setPinTarget] = useState<UserRow | null>(null);
  const [newPin, setNewPin] = useState('');

  const usersQuery = useQuery({ queryKey: ['users'], queryFn: () => getUsers() });
  const auditQuery = useQuery({ queryKey: ['auditLogs'], queryFn: getAuditLogs, enabled: admin });

  const users = useMemo(() => (usersQuery.data ?? []) as UserRow[], [usersQuery.data]);
  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => [u.name, u.email, u.mobile, u._id].some((v) => String(v || '').toLowerCase().includes(q)));
  }, [users, searchQuery]);

  const byRole = (role: UserRow['role']) => filtered.filter((u) => u.role === role);
  const customers = byRole('customer');
  const summary = useMemo(() => {
    const c = users.filter((u) => u.role === 'customer');
    return {
      customers: c.length,
      owners: users.filter((u) => u.role === 'owner').length,
      sessions: c.reduce((s, u) => s + (u.totalSessions || 0), 0),
      spent: c.reduce((s, u) => s + (u.totalSpent || 0), 0),
    };
  }, [users]);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['users'] });
    queryClient.invalidateQueries({ queryKey: ['auditLogs'] });
  };

  const createMutation = useMutation({
    mutationFn: () => createUser({
      name: newUser.name.trim(),
      email: newUser.email.trim(),
      mobile: newUser.mobile.trim() || undefined,
      password: newUser.password || undefined,
      role: newUser.role,
    }),
    onSuccess: (u: any) => {
      toast({ title: `${u.role === 'admin' ? 'Admin' : 'Owner'} account created`, description: `${u.email} can now sign in${newUser.password ? ' with the PIN you set' : ' with Google'}.` });
      setAddOpen(false);
      setNewUser({ name: '', email: '', mobile: '', password: '', role: 'owner' });
      refresh();
    },
    onError: (err: any) => toast({ title: 'Could not create account', description: err.message, variant: 'destructive' }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => updateUser(id, data),
    onSuccess: () => refresh(),
    onError: (err: any) => toast({ title: 'Update failed', description: err.message, variant: 'destructive' }),
  });

  const toggleBlock = (u: UserRow) => {
    const status = u.status === 'blocked' ? 'active' : 'blocked';
    updateMutation.mutate(
      { id: u._id, data: { status } },
      { onSuccess: () => toast({ title: status === 'blocked' ? 'User blocked' : 'User unblocked', description: u.email }) }
    );
  };

  const savePin = () => {
    if (!pinTarget || !/^\d{6}$/.test(newPin)) return;
    updateMutation.mutate(
      { id: pinTarget._id, data: { password: newPin } },
      {
        onSuccess: () => {
          toast({ title: 'PIN reset', description: `Share the new PIN with ${pinTarget.name} securely.` });
          setPinTarget(null);
          setNewPin('');
        },
      }
    );
  };

  const UserTable = ({ list, kind }: { list: UserRow[]; kind: 'customer' | 'owner' | 'admin' }) => (
    <div className="overflow-x-auto w-full">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Contact</TableHead>
            <TableHead>Joined</TableHead>
            {kind === 'customer' && <TableHead className="text-center">Sessions</TableHead>}
            {kind === 'customer' && <TableHead className="text-right">Spent</TableHead>}
            {kind === 'owner' && <TableHead className="text-center">Stations</TableHead>}
            <TableHead>Status</TableHead>
            {admin && <TableHead className="text-right">Actions</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {list.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                {kind === 'customer' && !admin ? 'No customers have charged at your stations yet.' : 'No users found.'}
              </TableCell>
            </TableRow>
          ) : (
            list.map((u) => (
              <TableRow key={u._id}>
                <TableCell className="font-semibold">{u.name}</TableCell>
                <TableCell>
                  <div className="text-xs font-mono">{u.email}</div>
                  <div className="text-xs text-muted-foreground font-mono">{u.mobile || '—'}</div>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{fmtDate(u.createdAt)}</TableCell>
                {kind === 'customer' && <TableCell className="text-center font-mono">{u.totalSessions ?? 0}</TableCell>}
                {kind === 'customer' && <TableCell className="text-right font-mono text-success">{inr(u.totalSpent)}</TableCell>}
                {kind === 'owner' && <TableCell className="text-center font-mono">{u.stationCount ?? 0}</TableCell>}
                <TableCell>
                  {u.status === 'blocked'
                    ? <Badge variant="destructive">Blocked</Badge>
                    : <Badge variant="secondary">Active</Badge>}
                </TableCell>
                {admin && (
                  <TableCell className="text-right whitespace-nowrap">
                    <Button variant="ghost" size="sm" onClick={() => { setPinTarget(u); setNewPin(''); }} title="Reset PIN">
                      <KeyRound className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => toggleBlock(u)} title={u.status === 'blocked' ? 'Unblock' : 'Block'}>
                      {u.status === 'blocked' ? <CheckCircle2 className="w-4 h-4 text-success" /> : <Ban className="w-4 h-4 text-destructive" />}
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );

  return (
    <div className="flex flex-col min-h-screen">
      <DashboardHeader
        title={admin ? 'Users & Owners' : 'Customers'}
        subtitle={admin ? 'Manage station owners, admins and customers' : 'Customers who charged at your stations'}
      />

      <div className="flex-1 p-4 md:p-6 space-y-6">
        <div className={`grid grid-cols-1 gap-4 ${admin ? 'sm:grid-cols-4' : 'sm:grid-cols-3'}`}>
          {admin && (
            <Card><CardContent className="flex items-center gap-4 p-4">
              <div className="p-3 rounded-xl bg-primary/10"><Building2 className="w-6 h-6 text-primary" /></div>
              <div><p className="text-sm text-muted-foreground">Station owners</p><p className="text-2xl font-bold">{summary.owners}</p></div>
            </CardContent></Card>
          )}
          <Card><CardContent className="flex items-center gap-4 p-4">
            <div className="p-3 rounded-xl bg-primary/10"><Users className="w-6 h-6 text-primary" /></div>
            <div><p className="text-sm text-muted-foreground">Customers</p><p className="text-2xl font-bold">{summary.customers}</p></div>
          </CardContent></Card>
          <Card><CardContent className="flex items-center gap-4 p-4">
            <div className="p-3 rounded-xl bg-success/10"><ShieldCheck className="w-6 h-6 text-success" /></div>
            <div><p className="text-sm text-muted-foreground">Customer sessions</p><p className="text-2xl font-bold font-mono">{summary.sessions}</p></div>
          </CardContent></Card>
          <Card><CardContent className="flex items-center gap-4 p-4">
            <div className="p-3 rounded-xl bg-info/10"><IndianRupee className="w-6 h-6 text-info" /></div>
            <div><p className="text-sm text-muted-foreground">Customer spend</p><p className="text-2xl font-bold font-mono">{inr(summary.spent)}</p></div>
          </CardContent></Card>
        </div>

        <Card className="border-0 shadow-md">
          <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2">
            <CardTitle className="text-lg font-bold">{admin ? 'Accounts' : 'Your customers'}</CardTitle>
            <div className="flex w-full sm:w-auto gap-2">
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Search name, email, mobile" className="pl-9" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
              </div>
              {admin && (
                <Button onClick={() => setAddOpen(true)} className="gap-2 shrink-0">
                  <UserPlus className="w-4 h-4" /> Add owner
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {usersQuery.isLoading ? (
              <div className="p-8 text-center text-muted-foreground">Loading…</div>
            ) : usersQuery.isError ? (
              <div className="p-8 text-center text-destructive">{(usersQuery.error as Error).message}</div>
            ) : admin ? (
              <Tabs defaultValue="owners">
                <TabsList className="mb-4 flex-wrap h-auto">
                  <TabsTrigger value="owners">Owners ({byRole('owner').length})</TabsTrigger>
                  <TabsTrigger value="customers">Customers ({customers.length})</TabsTrigger>
                  <TabsTrigger value="admins">Admins ({byRole('admin').length})</TabsTrigger>
                  <TabsTrigger value="audit">Activity log</TabsTrigger>
                </TabsList>
                <TabsContent value="owners"><UserTable list={byRole('owner')} kind="owner" /></TabsContent>
                <TabsContent value="customers"><UserTable list={customers} kind="customer" /></TabsContent>
                <TabsContent value="admins"><UserTable list={byRole('admin')} kind="admin" /></TabsContent>
                <TabsContent value="audit">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow><TableHead>Time</TableHead><TableHead>User</TableHead><TableHead>Action</TableHead><TableHead>IP</TableHead></TableRow>
                      </TableHeader>
                      <TableBody>
                        {((auditQuery.data ?? []) as any[]).map((a) => (
                          <TableRow key={a._id}>
                            <TableCell className="text-xs whitespace-nowrap">{a.timestamp ? format(new Date(a.timestamp), 'dd MMM yyyy, HH:mm') : '—'}</TableCell>
                            <TableCell className="text-xs">{users.find((u) => u._id === a.userId)?.email || a.userId}</TableCell>
                            <TableCell className="text-xs">{a.action}</TableCell>
                            <TableCell className="text-xs font-mono">{a.ipAddress}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>
              </Tabs>
            ) : (
              <UserTable list={customers} kind="customer" />
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add an account</DialogTitle>
            <DialogDescription>Owners see only their own stations. Assign stations to an owner from the station form.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label htmlFor="nu-name">Name</Label><Input id="nu-name" value={newUser.name} onChange={(e) => setNewUser({ ...newUser, name: e.target.value })} /></div>
            <div className="space-y-1"><Label htmlFor="nu-email">Email</Label><Input id="nu-email" type="email" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} /></div>
            <div className="space-y-1"><Label htmlFor="nu-mobile">Mobile (optional)</Label><Input id="nu-mobile" type="tel" value={newUser.mobile} onChange={(e) => setNewUser({ ...newUser, mobile: e.target.value })} /></div>
            <div className="space-y-1">
              <Label htmlFor="nu-pin">6-digit PIN (optional)</Label>
              <Input id="nu-pin" type="password" inputMode="numeric" maxLength={6} value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value.replace(/\D/g, '') })} />
              <p className="text-xs text-muted-foreground">Leave empty if they will sign in with Google using this email.</p>
            </div>
            <div className="space-y-1">
              <Label>Role</Label>
              <Select value={newUser.role} onValueChange={(v) => setNewUser({ ...newUser, role: v as 'owner' | 'admin' })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="owner">Station owner</SelectItem>
                  <SelectItem value="admin">Administrator</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending || !newUser.name.trim() || !newUser.email.trim() || (newUser.password !== '' && newUser.password.length !== 6)}
            >
              {createMutation.isPending ? 'Creating…' : 'Create account'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!pinTarget} onOpenChange={(o) => !o && setPinTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Reset PIN</DialogTitle>
            <DialogDescription>Set a new 6-digit PIN for {pinTarget?.name}.</DialogDescription>
          </DialogHeader>
          <Input type="password" inputMode="numeric" maxLength={6} placeholder="••••••" value={newPin} onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setPinTarget(null)}>Cancel</Button>
            <Button onClick={savePin} disabled={newPin.length !== 6 || updateMutation.isPending}>Save PIN</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
