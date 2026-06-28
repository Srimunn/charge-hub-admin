"use client";

import { useState, useEffect } from 'react';
import { DashboardHeader } from '@/components/layout/DashboardHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
  Eye,
  EyeOff,
  Loader2,
  CheckCircle,
  HelpCircle,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { 
  requestPasswordOTP, 
  changePassword as changePasswordApi,
  getMe,
  verifyPasswordOTP,
  updateSessionTimeout
} from '@/services/api';

export default function SettingsPage() {
  const { toast } = useToast();

  const [profile, setProfile] = useState({
    name: 'Amit Desai',
    email: 'amit.desai@chargehub.in',
    phone: '+91 98765 43210',
    role: 'System Administrator',
    maskedEmail: '',
    maskedMobile: '',
  });

  // Direct Change PIN state
  const [currentPIN, setCurrentPIN] = useState('');
  const [newPIN, setNewPIN] = useState('');
  const [confirmPIN, setConfirmPIN] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Forgot PIN Modal state
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);
  const [forgotStep, setForgotStep] = useState(1); // 1: Send OTP, 2: Verify OTP, 3: Set New PIN
  const [forgotOtp, setForgotOtp] = useState('');
  const [forgotNewPin, setForgotNewPin] = useState('');
  const [forgotConfirmPin, setForgotConfirmPin] = useState('');
  const [showForgotNewPin, setShowForgotNewPin] = useState(false);
  const [showForgotConfirmPin, setShowForgotConfirmPin] = useState(false);
  const [forgotSubmitting, setForgotSubmitting] = useState(false);
  const [forgotError, setForgotError] = useState('');

  // Timers for Forgot PIN OTP
  const [resendTimer, setResendTimer] = useState(0);
  const [otpExpiryTimer, setOtpExpiryTimer] = useState(300); // 5 minutes (300s)

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

  // Sync settings on load from backend
  const loadProfile = async () => {
    try {
      const data = await getMe();
      setProfile({
        name: data.name || 'Amit Desai',
        email: data.email || 'amit.desai@chargehub.in',
        phone: data.mobile || '+91 98765 43210',
        role: 'System Administrator',
        maskedEmail: data.maskedEmail || '',
        maskedMobile: data.maskedMobile || '',
      });
      setSecurity(prev => ({
        ...prev,
        sessionTimeout: data.sessionTimeout || 30
      }));
      if (typeof window !== 'undefined') {
        localStorage.setItem('sessionTimeout', (data.sessionTimeout || 30).toString());
      }
    } catch (err: any) {
      console.error("Failed to load user profile:", err);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  // OTP Resend Countdown
  useEffect(() => {
    if (resendTimer > 0) {
      const interval = setInterval(() => {
        setResendTimer(prev => prev - 1);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [resendTimer]);

  // OTP Expiry Countdown
  useEffect(() => {
    if (isForgotModalOpen && forgotStep === 2 && otpExpiryTimer > 0) {
      const interval = setInterval(() => {
        setOtpExpiryTimer(prev => prev - 1);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [isForgotModalOpen, forgotStep, otpExpiryTimer]);

  const handleSaveProfile = () => {
    toast({ title: 'Profile Updated', description: 'Your profile settings have been saved' });
  };

  const handleSaveNotifications = () => {
    toast({ title: 'Notifications Updated', description: 'Your notification preferences have been saved' });
  };

  const handleSaveSecurity = async () => {
    setIsSubmitting(true);
    try {
      await updateSessionTimeout(security.sessionTimeout);
      if (typeof window !== 'undefined') {
        localStorage.setItem('sessionTimeout', security.sessionTimeout.toString());
        localStorage.setItem('lastActivity', Date.now().toString());
      }
      toast({
        title: 'Security Settings Updated',
        description: `Your session timeout has been saved as ${security.sessionTimeout} minutes.`,
      });
    } catch (err: any) {
      toast({
        title: 'Update Failed',
        description: err.message || 'Failed to update session timeout settings',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Direct Change PIN
  const handleUpdatePIN = async () => {
    if (!currentPIN || !newPIN || !confirmPIN) {
      toast({ title: "Validation Failed", description: "Please fill in all PIN fields", variant: "destructive" });
      return;
    }
    if (newPIN.length !== 6 || !/^\d+$/.test(newPIN) || currentPIN.length !== 6 || !/^\d+$/.test(currentPIN)) {
      toast({ title: "Validation Failed", description: "PIN must be exactly 6 digits and numeric", variant: "destructive" });
      return;
    }
    if (newPIN !== confirmPIN) {
      toast({ title: "Validation Failed", description: "New PIN and Confirmation PIN do not match", variant: "destructive" });
      return;
    }
    if (currentPIN === newPIN) {
      toast({ title: "Validation Failed", description: "New PIN cannot be the same as your current PIN", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      await changePasswordApi({ currentPassword: currentPIN, newPassword: newPIN });
      toast({ title: "PIN Updated", description: "Security PIN updated successfully." });
      setCurrentPIN(''); setNewPIN(''); setConfirmPIN('');
    } catch (err: any) {
      toast({ title: "Update Failed", description: err.message || "Failed to update security PIN. Verify your current PIN.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Forgot PIN flow
  const handleOpenForgotPIN = () => {
    setForgotStep(1);
    setForgotOtp('');
    setForgotNewPin('');
    setForgotConfirmPin('');
    setForgotError('');
    setIsForgotModalOpen(true);
  };

  // Step 3: Request OTP
  const handleRequestForgotOTP = async () => {
    setForgotSubmitting(true);
    setForgotError('');
    try {
      const res = await requestPasswordOTP();
      setResendTimer(30); // 30 seconds wait
      setOtpExpiryTimer(300); // 5 minutes expiration
      setForgotStep(2);
      toast({
        title: "OTP Sent",
        description: res.message || "OTP has been sent to your registered mobile and email.",
      });
    } catch (err: any) {
      setForgotError(err.message || "Failed to send OTP.");
    } finally {
      setForgotSubmitting(false);
    }
  };

  // Step 4: Verify OTP
  const handleVerifyForgotOTP = async () => {
    if (!forgotOtp || forgotOtp.length !== 6 || !/^\d+$/.test(forgotOtp)) {
      setForgotError("Please enter a valid 6-digit OTP code.");
      return;
    }
    if (otpExpiryTimer <= 0) {
      setForgotError("OTP has expired. Please request a new one.");
      return;
    }

    setForgotSubmitting(true);
    setForgotError('');
    try {
      await verifyPasswordOTP(forgotOtp);
      setForgotStep(3);
    } catch (err: any) {
      setForgotError(err.message || "Incorrect OTP code.");
    } finally {
      setForgotSubmitting(false);
    }
  };

  // Step 6: Submit New PIN via Forgot Flow
  const handleSubmitForgotPIN = async () => {
    if (!forgotNewPin || !forgotConfirmPin) {
      setForgotError("Please fill in both PIN fields.");
      return;
    }
    if (forgotNewPin.length !== 6 || !/^\d+$/.test(forgotNewPin)) {
      setForgotError("PIN must be exactly 6 digits.");
      return;
    }
    if (forgotNewPin !== forgotConfirmPin) {
      setForgotError("PIN and Confirmation PIN do not match.");
      return;
    }

    setForgotSubmitting(true);
    setForgotError('');
    try {
      await changePasswordApi({ newPassword: forgotNewPin });
      toast({
        title: "Success",
        description: "Security PIN updated successfully.",
      });
      setIsForgotModalOpen(false);
    } catch (err: any) {
      setForgotError(err.message || "Failed to update security PIN.");
    } finally {
      setForgotSubmitting(false);
    }
  };

  // PIN Strength Checker
  const getPinStrength = (pin: string) => {
    if (!pin) return null;
    if (pin.length < 6) return { label: "Too short", color: "text-muted-foreground bg-secondary/50", score: 0 };
    if (!/^\d+$/.test(pin)) return { label: "Must be numeric", color: "text-destructive bg-destructive/10", score: 0 };

    // Repeating digits (e.g. 111111)
    if (/^(\d)\1{5}$/.test(pin)) {
      return { label: "Weak (repetitive)", color: "text-destructive bg-destructive/10", score: 1 };
    }

    // Sequential digits
    const seq = "0123456789";
    const revSeq = "9876543210";
    if (seq.includes(pin) || revSeq.includes(pin)) {
      return { label: "Weak (sequential)", color: "text-destructive bg-destructive/10", score: 1 };
    }

    // Simple patterns (e.g. 121212)
    if (["121212", "123123", "112233", "102030"].includes(pin)) {
      return { label: "Medium (simple pattern)", color: "text-amber-500 bg-amber-500/10", score: 2 };
    }

    return { label: "Strong", color: "text-emerald-500 bg-emerald-500/10", score: 3 };
  };

  const directStrength = getPinStrength(newPIN);
  const forgotStrength = getPinStrength(forgotNewPin);

  return (
    <div className="flex flex-col min-h-screen">
      <DashboardHeader title="Settings" subtitle="Manage your account and preferences" />
      <div className="flex-1 p-4 md:p-6">
        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList className="w-full flex justify-start md:inline-flex md:justify-center overflow-x-auto p-1 bg-muted scrollbar-none whitespace-nowrap snap-x">
            <TabsTrigger value="profile" className="flex-1 md:flex-initial gap-2 snap-align-start min-h-[44px] md:min-h-[36px]"><User className="w-4 h-4" /> Profile</TabsTrigger>
            <TabsTrigger value="notifications" className="flex-1 md:flex-initial gap-2 snap-align-start min-h-[44px] md:min-h-[36px]"><Bell className="w-4 h-4" /> Notifications</TabsTrigger>
            <TabsTrigger value="security" className="flex-1 md:flex-initial gap-2 snap-align-start min-h-[44px] md:min-h-[36px]"><Shield className="w-4 h-4" /> Security</TabsTrigger>
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
                    <Input id="name" value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} className="h-11 md:h-10" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input id="email" type="email" value={profile.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })} className="pl-10 h-11 md:h-10" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input id="phone" value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} className="pl-10 h-11 md:h-10" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="role">Role</Label>
                    <Input id="role" value={profile.role} disabled className="bg-secondary h-11 md:h-10" />
                  </div>
                </div>
                <Button onClick={handleSaveProfile} className="w-full sm:w-auto h-11 md:h-10 gap-2"><Save className="w-4 h-4" /> Save Changes</Button>
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
                    <div className="space-y-0.5"><Label>Email Alerts</Label><p className="text-sm text-muted-foreground">Receive alerts via email</p></div>
                    <Switch checked={notifications.emailAlerts} onCheckedChange={(checked) => setNotifications({ ...notifications, emailAlerts: checked })} />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5"><Label>SMS Alerts</Label><p className="text-sm text-muted-foreground">Receive alerts via SMS</p></div>
                    <Switch checked={notifications.smsAlerts} onCheckedChange={(checked) => setNotifications({ ...notifications, smsAlerts: checked })} />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5"><Label>High Severity Only</Label><p className="text-sm text-muted-foreground">Only send notifications for high severity alerts</p></div>
                    <Switch checked={notifications.highSeverityOnly} onCheckedChange={(checked) => setNotifications({ ...notifications, highSeverityOnly: checked })} />
                  </div>
                </div>
                <Button onClick={handleSaveNotifications} className="w-full sm:w-auto h-11 md:h-10 gap-2"><Save className="w-4 h-4" /> Save Preferences</Button>
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
                      <div className="flex items-center gap-2"><Key className="w-4 h-4" /><Label>Two-Factor Authentication</Label></div>
                      <p className="text-sm text-muted-foreground">Add an extra layer of security to your account</p>
                    </div>
                    <Switch checked={security.twoFactorEnabled} onCheckedChange={(checked) => setSecurity({ ...security, twoFactorEnabled: checked })} />
                  </div>
                  
                  <Separator />

                  {/* PIN Change Section */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Lock className="w-4 h-4" />
                      <Label className="text-base font-semibold">Change Security PIN</Label>
                    </div>
                    <p className="text-xs text-muted-foreground -mt-2">Authentication requires a 6-digit numeric PIN</p>
                    
                    <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
                      <div className="space-y-1 relative">
                        <Label htmlFor="current-pin">Current PIN</Label>
                        <div className="relative">
                          <Input
                            id="current-pin"
                            type={showCurrent ? "text" : "password"}
                            placeholder="6-digit PIN"
                            maxLength={6}
                            value={currentPIN}
                            onChange={(e) => setCurrentPIN(e.target.value.replace(/\D/g, ''))}
                            className="h-11 md:h-10 pr-10 tracking-widest text-center"
                          />
                          <button type="button" onClick={() => setShowCurrent(!showCurrent)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                            {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                        <button type="button" onClick={handleOpenForgotPIN} className="text-xs text-primary hover:underline mt-1 block">Forgot Current PIN?</button>
                      </div>
                      
                      <div className="space-y-1 relative">
                        <Label htmlFor="new-pin">New PIN</Label>
                        <div className="relative">
                          <Input
                            id="new-pin"
                            type={showNew ? "text" : "password"}
                            placeholder="6-digit PIN"
                            maxLength={6}
                            value={newPIN}
                            onChange={(e) => setNewPIN(e.target.value.replace(/\D/g, ''))}
                            className="h-11 md:h-10 pr-10 tracking-widest text-center"
                          />
                          <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                            {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                        {directStrength && (
                          <div className={`text-xs px-2 py-0.5 mt-1 rounded font-medium w-fit ${directStrength.color}`}>
                            {directStrength.label}
                          </div>
                        )}
                      </div>
                      
                      <div className="space-y-1 relative">
                        <Label htmlFor="confirm-pin">Confirm New PIN</Label>
                        <div className="relative">
                          <Input
                            id="confirm-pin"
                            type={showConfirm ? "text" : "password"}
                            placeholder="6-digit PIN"
                            maxLength={6}
                            value={confirmPIN}
                            onChange={(e) => setConfirmPIN(e.target.value.replace(/\D/g, ''))}
                            className="h-11 md:h-10 pr-10 tracking-widest text-center"
                          />
                          <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                            {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 pt-2">
                      <Button onClick={handleUpdatePIN} disabled={isSubmitting} className="w-full sm:w-auto h-11 md:h-10">
                        {isSubmitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Updating...</> : "Update PIN"}
                      </Button>
                      <Button type="button" variant="outline" onClick={handleOpenForgotPIN} className="w-full sm:w-auto h-11 md:h-10">
                        Forgot PIN?
                      </Button>
                    </div>
                  </div>

                  <Separator />

                  {/* Session Timeout */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" />
                      <Label>Session Timeout (minutes)</Label>
                    </div>
                    <Input
                      type="number"
                      value={security.sessionTimeout}
                      onChange={(e) => setSecurity({ ...security, sessionTimeout: parseInt(e.target.value) || 0 })}
                      className="w-full sm:w-32 h-11 md:h-10"
                    />
                    <p className="text-sm text-muted-foreground">Automatically log out after inactivity</p>
                  </div>
                  
                  <Button onClick={handleSaveSecurity} disabled={isSubmitting} className="w-full sm:w-auto h-11 md:h-10 gap-2">
                    {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4" />}
                    Save Security Settings
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Forgot PIN Modal/Dialog */}
      <Dialog open={isForgotModalOpen} onOpenChange={setIsForgotModalOpen}>
        <DialogContent className="max-w-md w-full rounded-2xl">
          <DialogHeader>
            <DialogTitle>Reset Security PIN</DialogTitle>
            <DialogDescription>
              Recover your security PIN via two-factor OTP verification.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            {forgotError && (
              <div className="p-3 text-xs bg-destructive/10 text-destructive rounded-lg border border-destructive/20 flex gap-2 items-center">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{forgotError}</span>
              </div>
            )}

            {/* Step 1: Send OTP */}
            {forgotStep === 1 && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Confirm the registered contacts where we will send your 6-digit OTP verification code:
                </p>
                <div className="space-y-3 bg-muted/30 p-4 rounded-xl border">
                  {profile.maskedEmail && (
                    <div className="flex items-center gap-3">
                      <Mail className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-medium">{profile.maskedEmail}</span>
                    </div>
                  )}
                  {profile.maskedMobile && (
                    <div className="flex items-center gap-3">
                      <Phone className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-medium">{profile.maskedMobile}</span>
                    </div>
                  )}
                </div>
                <Button 
                  onClick={handleRequestForgotOTP} 
                  disabled={forgotSubmitting}
                  className="w-full h-11 md:h-10 flex items-center justify-center gap-2"
                >
                  {forgotSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  Send OTP Code
                </Button>
              </div>
            )}

            {/* Step 2: OTP Verification Screen */}
            {forgotStep === 2 && (
              <div className="space-y-4">
                <div className="text-center space-y-1">
                  <p className="text-sm font-semibold">Enter 6-Digit OTP</p>
                  <p className="text-xs text-muted-foreground">
                    A code has been sent to your registered contacts.
                  </p>
                </div>

                <div className="space-y-2">
                  <Input
                    type="text"
                    placeholder="000000"
                    maxLength={6}
                    value={forgotOtp}
                    onChange={(e) => setForgotOtp(e.target.value.replace(/\D/g, ''))}
                    className="text-2xl font-bold tracking-[0.5em] text-center h-12 uppercase"
                  />
                  
                  <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
                    <span>
                      Expires in: {Math.floor(otpExpiryTimer / 60)}:{(otpExpiryTimer % 60).toString().padStart(2, '0')}
                    </span>
                    {resendTimer > 0 ? (
                      <span>Resend OTP in {resendTimer}s</span>
                    ) : (
                      <button 
                        type="button" 
                        onClick={handleRequestForgotOTP}
                        className="text-primary hover:underline font-semibold"
                        disabled={forgotSubmitting}
                      >
                        Resend OTP
                      </button>
                    )}
                  </div>
                </div>

                <Button 
                  onClick={handleVerifyForgotOTP} 
                  disabled={forgotSubmitting || otpExpiryTimer <= 0}
                  className="w-full h-11 md:h-10 flex items-center justify-center gap-2"
                >
                  {forgotSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  Verify OTP Code
                </Button>
              </div>
            )}

            {/* Step 3: Enter New PIN */}
            {forgotStep === 3 && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  OTP verified successfully! Please enter your new 6-digit numeric security PIN.
                </p>

                <div className="space-y-3">
                  <div className="space-y-1 relative">
                    <Label htmlFor="forgot-new-pin">New PIN</Label>
                    <div className="relative">
                      <Input
                        id="forgot-new-pin"
                        type={showForgotNewPin ? "text" : "password"}
                        placeholder="6-digit PIN"
                        maxLength={6}
                        value={forgotNewPin}
                        onChange={(e) => setForgotNewPin(e.target.value.replace(/\D/g, ''))}
                        className="h-11 md:h-10 pr-10 tracking-widest text-center"
                      />
                      <button 
                        type="button" 
                        onClick={() => setShowForgotNewPin(!showForgotNewPin)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showForgotNewPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {forgotStrength && (
                      <div className={`text-xs px-2 py-0.5 mt-1 rounded font-medium w-fit ${forgotStrength.color}`}>
                        {forgotStrength.label}
                      </div>
                    )}
                  </div>

                  <div className="space-y-1 relative">
                    <Label htmlFor="forgot-confirm-pin">Confirm New PIN</Label>
                    <div className="relative">
                      <Input
                        id="forgot-confirm-pin"
                        type={showForgotConfirmPin ? "text" : "password"}
                        placeholder="6-digit PIN"
                        maxLength={6}
                        value={forgotConfirmPin}
                        onChange={(e) => setForgotConfirmPin(e.target.value.replace(/\D/g, ''))}
                        className="h-11 md:h-10 pr-10 tracking-widest text-center"
                      />
                      <button 
                        type="button" 
                        onClick={() => setShowForgotConfirmPin(!showForgotConfirmPin)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showForgotConfirmPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                <Button 
                  onClick={handleSubmitForgotPIN} 
                  disabled={forgotSubmitting}
                  className="w-full h-11 md:h-10 flex items-center justify-center gap-2"
                >
                  {forgotSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  Update Security PIN
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
