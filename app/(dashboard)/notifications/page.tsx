"use client";

import { useEffect, useMemo, useState } from "react";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Bell, Mail, Phone, Send, AlertTriangle, Zap, DollarSign, 
  Settings, CheckCircle, ShieldAlert, Sparkles 
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  getNotifications, getNotificationStats, sendTestNotification, 
  markNotificationsRead, updateNotificationPreferences, API_URL 
} from "@/services/api";
import { getSocket } from "@/lib/socket";

export default function NotificationsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Test form states
  const [testTitle, setTestTitle] = useState("Station Alert");
  const [testMessage, setTestMessage] = useState("Station Downtown Plaza has gone offline.");
  const [testType, setTestType] = useState("fault");
  const [metadataStation, setMetadataStation] = useState("Downtown Plaza Station");

  // Query stats and notifications log
  const { data: notifications = [] } = useQuery<any[]>({
    queryKey: ["notifications"],
    queryFn: getNotifications,
  });

  const { data: stats } = useQuery<any>({
    queryKey: ["notificationStats"],
    queryFn: getNotificationStats,
  });

  // Load preferences from logged-in user profile (or settings)
  const [prefs, setPrefs] = useState({
    emailAlerts: true,
    smsAlerts: false,
    pushAlerts: true,
    faultAlerts: true,
    paymentAlerts: true,
  });

  // Fetch initial preferences on mount
  useEffect(() => {
    const fetchUserPreferences = async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) return;
        const res = await fetch(`${API_URL}/api/auth/me`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        if (res.ok) {
          const user = await res.json();
          if (user.notificationPreferences) {
            setPrefs(user.notificationPreferences);
          }
        }
      } catch (err) {
        console.error("Failed to load user preferences:", err);
      }
    };
    fetchUserPreferences();
  }, []);

  // Socket subscription for real-time notification log updates
  useEffect(() => {
    const socket = getSocket();
    socket.on("new_notification", () => {
      // Invalidate queries so that the stats and logs list update instantly!
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notificationStats"] });
    });

    return () => {
      socket.off("new_notification");
    };
  }, [queryClient]);

  // Mutations
  const updatePrefsMutation = useMutation({
    mutationFn: (updatedPrefs: typeof prefs) => updateNotificationPreferences(updatedPrefs),
    onSuccess: (data) => {
      if (data) setPrefs(data);
      toast({
        title: "Preferences Saved",
        description: "Your notification channel parameters have been updated.",
      });
      queryClient.invalidateQueries({ queryKey: ["notificationStats"] });
    },
    onError: (err: any) => {
      toast({
        title: "Update Failed",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const sendTestMutation = useMutation({
    mutationFn: (payload: any) => sendTestNotification(payload),
    onSuccess: () => {
      toast({
        title: "Notification Dispatched",
        description: "Test alert triggered successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notificationStats"] });
    },
    onError: (err: any) => {
      toast({
        title: "Dispatch Failed",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const readMutation = useMutation({
    mutationFn: (ids?: string[]) => markNotificationsRead(ids),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notificationStats"] });
    },
  });

  // Handlers
  const handleTogglePref = (key: keyof typeof prefs, val: boolean) => {
    const updated = { ...prefs, [key]: val };
    setPrefs(updated);
    updatePrefsMutation.mutate(updated);
  };

  const handleSendTest = (e: React.FormEvent) => {
    e.preventDefault();
    sendTestMutation.mutate({
      title: testTitle,
      message: testMessage,
      type: testType,
      metadata: {
        stationName: metadataStation,
        timestamp: new Date().toISOString(),
      },
    });
  };

  const handleMarkAllRead = () => {
    readMutation.mutate(undefined);
    toast({
      title: "All Marked Read",
      description: "Successfully updated all system notifications to read.",
    });
  };

  // Human-readable formatting helper
  const formatTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleString();
    } catch {
      return isoString;
    }
  };

  return (
    <div className="flex-1 space-y-6 p-6 md:p-8 bg-background/50">
      <DashboardHeader 
        title="Notification System" 
        subtitle="Manage transactional communications, SMS/Email dispatch alerts, and live alerts configuration." 
      />

      {/* Grid statistics rows */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <Card className="border border-border/50 shadow-md">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Alerts</CardTitle>
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500">
              <Bell className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalNotifications || 0}</div>
            <p className="text-[10px] text-muted-foreground mt-1">Logged in Mongoose DB</p>
          </CardContent>
        </Card>

        <Card className="border border-border/50 shadow-md">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Dispatched Today</CardTitle>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500">
              <Send className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-500">{stats?.sentToday || 0}</div>
            <p className="text-[10px] text-muted-foreground mt-1">Active channels broadcast</p>
          </CardContent>
        </Card>

        <Card className="border border-border/50 shadow-md">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">SMS Channels</CardTitle>
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-500">
              <Phone className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.smsStatistics?.total || 0}</div>
            <p className="text-[10px] text-muted-foreground mt-1">MSG91 API Gateway</p>
          </CardContent>
        </Card>

        <Card className="border border-border/50 shadow-md">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Email Channels</CardTitle>
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-500">
              <Mail className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.emailStatistics?.total || 0}</div>
            <p className="text-[10px] text-muted-foreground mt-1">Resend API Gateway</p>
          </CardContent>
        </Card>
      </div>

      {/* Main split block */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left column: Notifications history list (span-2) */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="border border-border/50 shadow-md h-full flex flex-col">
            <CardHeader className="flex flex-row items-center justify-between border-b border-border/50 pb-4">
              <div>
                <CardTitle className="text-base font-bold">System Dispatch Log</CardTitle>
                <CardDescription className="text-xs">Real-time listing of dispatched transactional alerts</CardDescription>
              </div>
              {notifications.some(n => !n.read) && (
                <Button 
                  onClick={handleMarkAllRead} 
                  variant="outline" 
                  size="sm" 
                  className="text-xs rounded-xl font-semibold border-border hover:bg-secondary"
                >
                  Mark All Read
                </Button>
              )}
            </CardHeader>
            <CardContent className="p-0 flex-1 overflow-y-auto max-h-[500px]">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground space-y-2">
                  <Bell className="w-8 h-8 opacity-40 animate-bounce" />
                  <p className="text-sm font-medium">No alerts triggered yet</p>
                  <p className="text-xs max-w-xs text-muted-foreground/60">Configure preferences or run a manual channel test on the right panel.</p>
                </div>
              ) : (
                <div className="divide-y divide-border/40">
                  {notifications.map((notif: any) => {
                    const Icon = 
                      notif.type === 'fault' ? AlertTriangle :
                      notif.type === 'payment' ? DollarSign :
                      (notif.type === 'session_start' || notif.type === 'session_end') ? Zap :
                      notif.type === 'otp' ? Settings : Bell;

                    const bgClass = 
                      notif.type === 'fault' ? 'text-destructive bg-destructive/10' :
                      notif.type === 'payment' ? 'text-emerald-500 bg-emerald-500/10' :
                      (notif.type === 'session_start' || notif.type === 'session_end') ? 'text-amber-500 bg-amber-500/10' :
                      'text-primary bg-primary/10';

                    return (
                      <div 
                        key={notif._id} 
                        onClick={() => !notif.read && readMutation.mutate([notif._id])}
                        className={`flex gap-4 p-4 items-start transition-colors duration-150 cursor-pointer ${
                          !notif.read ? "bg-primary/5 hover:bg-primary/10" : "hover:bg-secondary/40"
                        }`}
                      >
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${bgClass}`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className={`text-xs font-bold text-foreground truncate ${!notif.read ? "text-primary" : ""}`}>
                              {notif.title}
                            </span>
                            <span className="text-[9px] text-muted-foreground/60 shrink-0">
                              {formatTime(notif.createdAt)}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 font-medium leading-relaxed">
                            {notif.message}
                          </p>
                          {notif.metadata && Object.keys(notif.metadata).length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-2">
                              {Object.entries(notif.metadata).map(([k, v]: any) => (
                                <Badge key={k} variant="secondary" className="text-[9px] py-0 px-1.5 border border-border/40 font-mono">
                                  {k}: {String(v)}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                        {!notif.read && (
                          <div className="w-2 h-2 rounded-full bg-primary shrink-0 self-center" />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right column: Settings & Manual triggers */}
        <div className="space-y-6">
          
          {/* Preferences */}
          <Card className="border border-border/50 shadow-md">
            <CardHeader>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Settings className="w-4 h-4 text-primary" /> Settings
              </CardTitle>
              <CardDescription className="text-xs">Select active communication channels for operator updates</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between py-1">
                <div className="space-y-0.5">
                  <Label className="text-xs font-semibold">Email Alerts</Label>
                  <p className="text-[10px] text-muted-foreground">Receive updates via Resend</p>
                </div>
                <Switch 
                  checked={prefs.emailAlerts} 
                  onCheckedChange={(val) => handleTogglePref("emailAlerts", val)} 
                />
              </div>
              <div className="flex items-center justify-between py-1">
                <div className="space-y-0.5">
                  <Label className="text-xs font-semibold">SMS Alerts</Label>
                  <p className="text-[10px] text-muted-foreground">Critical metrics via MSG91</p>
                </div>
                <Switch 
                  checked={prefs.smsAlerts} 
                  onCheckedChange={(val) => handleTogglePref("smsAlerts", val)} 
                />
              </div>
              <div className="flex items-center justify-between py-1">
                <div className="space-y-0.5">
                  <Label className="text-xs font-semibold">Push Notifications</Label>
                  <p className="text-[10px] text-muted-foreground">Firebase device push messages</p>
                </div>
                <Switch 
                  checked={prefs.pushAlerts} 
                  onCheckedChange={(val) => handleTogglePref("pushAlerts", val)} 
                />
              </div>
              <div className="flex items-center justify-between py-1">
                <div className="space-y-0.5">
                  <Label className="text-xs font-semibold">Fault Alerts</Label>
                  <p className="text-[10px] text-muted-foreground">Instant alerts when chargers fail</p>
                </div>
                <Switch 
                  checked={prefs.faultAlerts} 
                  onCheckedChange={(val) => handleTogglePref("faultAlerts", val)} 
                />
              </div>
              <div className="flex items-center justify-between py-1">
                <div className="space-y-0.5">
                  <Label className="text-xs font-semibold">Payment Alerts</Label>
                  <p className="text-[10px] text-muted-foreground">Notify on successful transaction bills</p>
                </div>
                <Switch 
                  checked={prefs.paymentAlerts} 
                  onCheckedChange={(val) => handleTogglePref("paymentAlerts", val)} 
                />
              </div>
            </CardContent>
          </Card>

          {/* Test Trigger form */}
          <Card className="border border-border/50 shadow-md">
            <CardHeader>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-500" /> Dispatch Channel Test
              </CardTitle>
              <CardDescription className="text-xs">Trigger mock alerts to test configured notification flows</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSendTest} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="test-title" className="text-xs font-semibold">Alert Title</Label>
                  <Input 
                    id="test-title"
                    value={testTitle} 
                    onChange={(e) => setTestTitle(e.target.value)} 
                    className="text-xs"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="test-msg" className="text-xs font-semibold">Message</Label>
                  <Input 
                    id="test-msg"
                    value={testMessage} 
                    onChange={(e) => setTestMessage(e.target.value)} 
                    className="text-xs"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Notification Type</Label>
                  <Select value={testType} onValueChange={setTestType}>
                    <SelectTrigger className="text-xs">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fault" className="text-xs">Hardware Fault (High Priority)</SelectItem>
                      <SelectItem value="payment" className="text-xs">Payment Complete</SelectItem>
                      <SelectItem value="session_start" className="text-xs">Charging Session Started</SelectItem>
                      <SelectItem value="session_end" className="text-xs">Charging Session Completed</SelectItem>
                      <SelectItem value="system" className="text-xs">General Alert</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="test-meta" className="text-xs font-semibold">Associated Station (Metadata)</Label>
                  <Input 
                    id="test-meta"
                    value={metadataStation} 
                    onChange={(e) => setMetadataStation(e.target.value)} 
                    className="text-xs"
                  />
                </div>

                <Button 
                  type="submit" 
                  disabled={sendTestMutation.isPending} 
                  className="w-full text-xs font-semibold"
                >
                  {sendTestMutation.isPending ? "Dispatching..." : "Fire Test Notification"}
                </Button>
              </form>
            </CardContent>
          </Card>
          
        </div>
      </div>
    </div>
  );
}
