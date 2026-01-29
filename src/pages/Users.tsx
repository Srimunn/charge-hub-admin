import { useState } from 'react';
import { DashboardHeader } from '@/components/layout/DashboardHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { User as UserIcon, Users, Building2, Ban, Edit, DollarSign } from 'lucide-react';
import { mockUsers, User } from '@/data/mockData';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

const UsersPage = () => {
  const [users, setUsers] = useState<User[]>(mockUsers);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [usageLimit, setUsageLimit] = useState('');
  const { toast } = useToast();

  const handleBlockUser = (userId: string) => {
    setUsers(prev =>
      prev.map(user =>
        user.id === userId
          ? { ...user, status: user.status === 'blocked' ? 'active' : 'blocked' }
          : user
      )
    );
    toast({
      title: 'User Status Updated',
      description: `User status has been toggled`,
    });
  };

  const handleSetLimit = () => {
    if (selectedUser && usageLimit) {
      setUsers(prev =>
        prev.map(user =>
          user.id === selectedUser.id
            ? { ...user, usageLimit: parseInt(usageLimit) }
            : user
        )
      );
      toast({
        title: 'Usage Limit Set',
        description: `Usage limit updated to $${usageLimit}`,
      });
      setSelectedUser(null);
      setUsageLimit('');
    }
  };

  const individualUsers = users.filter(u => u.type === 'individual');
  const fleetUsers = users.filter(u => u.type === 'fleet');

  const UserTable = ({ userList }: { userList: User[] }) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead className="hidden md:table-cell">Email</TableHead>
          <TableHead className="hidden sm:table-cell">Sessions</TableHead>
          <TableHead>Spent</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {userList.map((user) => (
          <TableRow key={user.id}>
            <TableCell>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  {user.type === 'fleet' ? (
                    <Building2 className="w-4 h-4 text-primary" />
                  ) : (
                    <UserIcon className="w-4 h-4 text-primary" />
                  )}
                </div>
                <div>
                  <p className="font-medium">{user.name}</p>
                  <p className="text-xs text-muted-foreground md:hidden">{user.email}</p>
                </div>
              </div>
            </TableCell>
            <TableCell className="hidden md:table-cell">{user.email}</TableCell>
            <TableCell className="hidden sm:table-cell">{user.totalSessions}</TableCell>
            <TableCell>
              <div className="flex items-center gap-1">
                <DollarSign className="w-3 h-3 text-muted-foreground" />
                {user.totalSpent.toFixed(2)}
              </div>
            </TableCell>
            <TableCell>
              <Badge className={user.status === 'active' ? 'bg-success text-success-foreground' : 'bg-destructive text-destructive-foreground'}>
                {user.status}
              </Badge>
            </TableCell>
            <TableCell className="text-right">
              <div className="flex justify-end gap-2">
                <Dialog>
                  <DialogTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedUser(user);
                        setUsageLimit(user.usageLimit?.toString() || '');
                      }}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Set Usage Limit</DialogTitle>
                      <DialogDescription>
                        Set a monthly spending limit for {user.name}
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="limit">Monthly Limit ($)</Label>
                        <Input
                          id="limit"
                          type="number"
                          value={usageLimit}
                          onChange={(e) => setUsageLimit(e.target.value)}
                          placeholder="Enter amount"
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button onClick={handleSetLimit}>Save Limit</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleBlockUser(user.id)}
                  className={user.status === 'blocked' ? 'text-success' : 'text-destructive'}
                >
                  <Ban className="w-4 h-4" />
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
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
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="p-3 rounded-xl bg-primary/10">
                <Users className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Users</p>
                <p className="text-2xl font-bold">{users.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="p-3 rounded-xl bg-success/10">
                <UserIcon className="w-6 h-6 text-success" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Individual Users</p>
                <p className="text-2xl font-bold">{individualUsers.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="p-3 rounded-xl bg-info/10">
                <Building2 className="w-6 h-6 text-info" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Fleet Accounts</p>
                <p className="text-2xl font-bold">{fleetUsers.length}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Users Tabs */}
        <Card>
          <CardHeader>
            <CardTitle>All Users</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="all">
              <TabsList>
                <TabsTrigger value="all">All Users</TabsTrigger>
                <TabsTrigger value="individual">Individual</TabsTrigger>
                <TabsTrigger value="fleet">Fleet</TabsTrigger>
              </TabsList>
              <TabsContent value="all" className="mt-4">
                <UserTable userList={users} />
              </TabsContent>
              <TabsContent value="individual" className="mt-4">
                <UserTable userList={individualUsers} />
              </TabsContent>
              <TabsContent value="fleet" className="mt-4">
                <UserTable userList={fleetUsers} />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default UsersPage;
