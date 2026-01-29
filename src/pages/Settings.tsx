import { useState } from 'react';
import { DashboardHeader } from '@/components/layout/DashboardHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  User,
  Bell,
  Shield,
  Mail,
  Phone,
  Lock,
  Key,
  AlertTriangle,
  Save,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const Settings = () => {
  const { toast } = useToast();

  const [profile, setProfile] = useState({
    name: 'Admin User',
    email: 'admin@evcharge.com',
    phone: '+1 (555) 123-4567',
    role: 'System Administrator',
  });

  const [notifications, setNotifications] = useState({
    emailAlerts: true,
    smsAlerts: false,
    highSeverityOnly: false,
    dailyDigest: true,
    weeklyReport: true,
  });

  const [security, setSecurity] = useState({
    twoFactorEnabled: false,
    sessionTimeout: 30,
    ipWhitelisting: false,
  });

  const handleSaveProfile = () => {
    toast({
      title: 'Profile Updated',
      description: 'Your profile settings have been saved',
    });
  };

  const handleSaveNotifications = () => {
    toast({
      title: 'Notifications Updated',
      description: 'Your notification preferences have been saved',
    });
  };

  const handleSaveSecurity = () => {
    toast({
      title: 'Security Settings Updated',
      description: 'Your security settings have been saved',
    });
  };

  return (
    <div className="flex flex-col min-h-screen">
      <DashboardHeader 
        title="Settings" 
        subtitle="Manage your account and preferences"
      />
      
      <div className="flex-1 p-6">
        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList>
            <TabsTrigger value="profile" className="gap-2">
              <User className="w-4 h-4" /> Profile
            </TabsTrigger>
            <TabsTrigger value="notifications" className="gap-2">
              <Bell className="w-4 h-4" /> Notifications
            </TabsTrigger>
            <TabsTrigger value="security" className="gap-2">
              <Shield className="w-4 h-4" /> Security
            </TabsTrigger>
          </TabsList>

          {/* Profile Tab */}
          <TabsContent value="profile">
            <Card>
              <CardHeader>
                <CardTitle>Admin Profile</CardTitle>
                <CardDescription>Manage your account information</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center gap-6">
                  <div className="w-20 h-20 rounded-full bg-primary flex items-center justify-center">
                    <User className="w-10 h-10 text-primary-foreground" />
                  </div>
                  <div>
                    <h3 className="font-semibold">{profile.name}</h3>
                    <p className="text-sm text-muted-foreground">{profile.role}</p>
                  </div>
                </div>

                <Separator />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="name">Full Name</Label>
                    <Input
                      id="name"
                      value={profile.name}
                      onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="email"
                        type="email"
                        value={profile.email}
                        onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                        className="pl-10"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="phone"
                        value={profile.phone}
                        onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                        className="pl-10"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="role">Role</Label>
                    <Input id="role" value={profile.role} disabled className="bg-secondary" />
                  </div>
                </div>

                <Button onClick={handleSaveProfile} className="gap-2">
                  <Save className="w-4 h-4" /> Save Changes
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Notifications Tab */}
          <TabsContent value="notifications">
            <Card>
              <CardHeader>
                <CardTitle>Notification Preferences</CardTitle>
                <CardDescription>Choose how you want to receive alerts</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Email Alerts</Label>
                      <p className="text-sm text-muted-foreground">
                        Receive alerts via email
                      </p>
                    </div>
                    <Switch
                      checked={notifications.emailAlerts}
                      onCheckedChange={(checked) =>
                        setNotifications({ ...notifications, emailAlerts: checked })
                      }
                    />
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>SMS Alerts</Label>
                      <p className="text-sm text-muted-foreground">
                        Receive alerts via SMS
                      </p>
                    </div>
                    <Switch
                      checked={notifications.smsAlerts}
                      onCheckedChange={(checked) =>
                        setNotifications({ ...notifications, smsAlerts: checked })
                      }
                    />
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>High Severity Only</Label>
                      <p className="text-sm text-muted-foreground">
                        Only send notifications for high severity alerts
                      </p>
                    </div>
                    <Switch
                      checked={notifications.highSeverityOnly}
                      onCheckedChange={(checked) =>
                        setNotifications({ ...notifications, highSeverityOnly: checked })
                      }
                    />
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Daily Digest</Label>
                      <p className="text-sm text-muted-foreground">
                        Receive a daily summary email
                      </p>
                    </div>
                    <Switch
                      checked={notifications.dailyDigest}
                      onCheckedChange={(checked) =>
                        setNotifications({ ...notifications, dailyDigest: checked })
                      }
                    />
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Weekly Report</Label>
                      <p className="text-sm text-muted-foreground">
                        Receive a weekly analytics report
                      </p>
                    </div>
                    <Switch
                      checked={notifications.weeklyReport}
                      onCheckedChange={(checked) =>
                        setNotifications({ ...notifications, weeklyReport: checked })
                      }
                    />
                  </div>
                </div>

                <Button onClick={handleSaveNotifications} className="gap-2">
                  <Save className="w-4 h-4" /> Save Preferences
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Security Tab */}
          <TabsContent value="security">
            <Card>
              <CardHeader>
                <CardTitle>Security Settings</CardTitle>
                <CardDescription>Manage your account security</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <Key className="w-4 h-4" />
                        <Label>Two-Factor Authentication</Label>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Add an extra layer of security to your account
                      </p>
                    </div>
                    <Switch
                      checked={security.twoFactorEnabled}
                      onCheckedChange={(checked) =>
                        setSecurity({ ...security, twoFactorEnabled: checked })
                      }
                    />
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Lock className="w-4 h-4" />
                      <Label>Change Password</Label>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <Input type="password" placeholder="Current password" />
                      <Input type="password" placeholder="New password" />
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" />
                      <Label>Session Timeout (minutes)</Label>
                    </div>
                    <Input
                      type="number"
                      value={security.sessionTimeout}
                      onChange={(e) =>
                        setSecurity({ ...security, sessionTimeout: parseInt(e.target.value) })
                      }
                      className="w-32"
                    />
                    <p className="text-sm text-muted-foreground">
                      Automatically log out after inactivity
                    </p>
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>IP Whitelisting</Label>
                      <p className="text-sm text-muted-foreground">
                        Restrict access to specific IP addresses
                      </p>
                    </div>
                    <Switch
                      checked={security.ipWhitelisting}
                      onCheckedChange={(checked) =>
                        setSecurity({ ...security, ipWhitelisting: checked })
                      }
                    />
                  </div>
                </div>

                <Button onClick={handleSaveSecurity} className="gap-2">
                  <Save className="w-4 h-4" /> Save Security Settings
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Settings;
