"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, Lock, User as UserIcon, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { loginUser, registerUser, setPin, verifyOTP } from '@/services/api';
import Image from 'next/image';
import { signIn, useSession } from 'next-auth/react';

const Login = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [authData, setAuthData] = useState({ name: '', email: '', password: '', mobile: '' });
  const [rememberMe, setRememberMe] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState('login');

  const { data: session, status } = useSession();

  // Profile setup states for Google users
  const [showPinSetup, setShowPinSetup] = useState(false);
  const [setupMobile, setSetupMobile] = useState('');
  const [newPin, setNewPin] = useState('');
  const [isSettingPin, setIsSettingPin] = useState(false);
  const [pendingSession, setPendingSession] = useState<any>(null);

  // Registration OTP states
  const [showRegisterOtp, setShowRegisterOtp] = useState(false);
  const [registerOtp, setRegisterOtp] = useState('');
  const [registeredUser, setRegisteredUser] = useState<any>(null);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [mockOtpToShow, setMockOtpToShow] = useState('');

  // Prefill email if remembered
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedEmail = localStorage.getItem("rememberedEmail");
      if (savedEmail) {
        setAuthData(prev => ({ ...prev, email: savedEmail }));
        setRememberMe(true);
      }
    }
  }, []);

  useEffect(() => {
    if (status === 'authenticated' && session) {
      const backendToken = (session as any).backendToken;
      const backendUser = (session as any).backendUser;
      if (backendToken && backendUser) {
        if (backendUser.hasProfileComplete === false) {
          setPendingSession(session);
          setSetupMobile(backendUser.mobile || '');
          setShowPinSetup(true);
        } else {
          localStorage.setItem("token", backendToken);
          localStorage.setItem("userName", backendUser.name || "");
          localStorage.setItem("userEmail", backendUser.email || "");
          localStorage.setItem("userMobile", backendUser.mobile || "");
          localStorage.setItem("userId", backendUser.id || "");
          localStorage.setItem("sessionTimeout", (backendUser.sessionTimeout || 30).toString());
          
          toast({
            title: 'Google Login Successful',
            description: `Welcome back, ${backendUser.name}`,
          });
          router.push('/dashboard');
        }
      }
    }
  }, [status, session, router, toast]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setAuthData(prev => ({ ...prev, [name]: value }));
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = await loginUser({ email: authData.email, password: authData.password });
      localStorage.setItem("token", res.token);
      localStorage.setItem("userName", res.name);
      localStorage.setItem("userEmail", res.email);
      localStorage.setItem("userMobile", res.mobile);
      if (res._id) localStorage.setItem("userId", res._id);
      localStorage.setItem("sessionTimeout", (res.sessionTimeout || 30).toString());
      
      // Remember me handling
      if (rememberMe) {
        localStorage.setItem("rememberedEmail", authData.email);
      } else {
        localStorage.removeItem("rememberedEmail");
      }
      
      toast({
        title: 'Login Successful',
        description: `Welcome back, ${res.name}`,
      });
      router.push('/dashboard');
    } catch (error: any) {
      toast({
        title: 'Login Failed',
        description: error.message || "Invalid credentials",
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = await registerUser(authData);
      setRegisteredUser({
        email: authData.email,
        name: authData.name,
        mobile: authData.mobile
      });
      setMockOtpToShow(res.otp || "");
      setShowRegisterOtp(true);
      toast({
        title: 'OTP Sent',
        description: res.message || 'Verification OTP has been sent (Mock).',
      });
    } catch (error: any) {
      toast({
        title: 'Registration Failed',
        description: error.message || "Could not register user",
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyRegisterOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!registerOtp || registerOtp.length !== 6 || !/^\d+$/.test(registerOtp)) {
      toast({
        title: "Validation Failed",
        description: "Please enter a valid 6-digit OTP code",
        variant: "destructive",
      });
      return;
    }
    setIsVerifyingOtp(true);
    try {
      const res = await verifyOTP({ email: registeredUser.email, otp: registerOtp });
      localStorage.setItem("token", res.token);
      localStorage.setItem("userName", res.name);
      localStorage.setItem("userEmail", res.email);
      localStorage.setItem("userMobile", res.mobile);
      if (res._id) localStorage.setItem("userId", res._id);
      localStorage.setItem("sessionTimeout", (res.sessionTimeout || 30).toString());
      
      toast({
        title: 'Verification Successful',
        description: `Welcome to EV Charge, ${res.name}!`,
      });
      
      setShowRegisterOtp(false);
      router.push('/dashboard');
    } catch (error: any) {
      toast({
        title: 'Verification Failed',
        description: error.message || 'Incorrect or expired OTP code',
        variant: 'destructive',
      });
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  const handleSetPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!setupMobile || setupMobile.trim().length < 8) {
      toast({
        title: "Invalid Mobile Number",
        description: "Please enter a valid mobile number",
        variant: "destructive",
      });
      return;
    }
    if (!newPin || newPin.length !== 6 || !/^\d+$/.test(newPin)) {
      toast({
        title: "Invalid PIN",
        description: "PIN must be exactly 6 digits",
        variant: "destructive",
      });
      return;
    }
    setIsSettingPin(true);
    try {
      const token = pendingSession.backendToken;
      const user = pendingSession.backendUser;
      
      await setPin(newPin, setupMobile.trim(), token);

      localStorage.setItem("token", token);
      localStorage.setItem("userName", user.name || "");
      localStorage.setItem("userEmail", user.email || "");
      localStorage.setItem("userMobile", setupMobile.trim());
      localStorage.setItem("userId", user.id || "");

      toast({
        title: "Profile Configured Successfully",
        description: `Welcome to EV Charge, ${user.name}! Your phone number and security PIN have been set. You can now login with either Google or your email/phone + PIN.`,
      });

      setShowPinSetup(false);
      router.push('/dashboard');
    } catch (error: any) {
      toast({
        title: "Setup Failed",
        description: error.message || "Could not configure security credentials",
        variant: "destructive",
      });
    } finally {
      setIsSettingPin(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center gradient-primary p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8 animate-fade-in-up">
          <div className="w-20 h-20 rounded-2xl bg-[#DADBDF] shadow-lg mb-4 flex items-center justify-center overflow-hidden shrink-0 relative">
            <img src="/logo.jpeg" alt="EV Charge Logo" className="w-full h-full object-contain mix-blend-multiply brightness-110 contrast-150 saturate-200 transform scale-150 drop-shadow-[0_4px_4px_rgba(0,0,0,0.5)] drop-shadow-[0_0px_12px_rgba(0,100,255,0.6)]" />
          </div>
          <h1 className="text-2xl font-bold text-primary-foreground">EV Charge</h1>
          <p className="text-primary-foreground/70">Autonomous Wireless Charging</p>
        </div>

        <Card className="border-0 shadow-2xl animate-scale-in">
          {showPinSetup ? (
            <CardContent className="pt-6">
              <form onSubmit={handleSetPin} className="space-y-4 py-2">
                <div className="text-center space-y-2 mb-4">
                  <h3 className="text-lg font-bold text-foreground">Complete Your Profile</h3>
                  <p className="text-xs text-muted-foreground">
                    Please provide your mobile number and set a 6-digit security PIN to complete your Google registration. You can use either Google or your PIN to sign in later.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="setup-mobile">Mobile Number</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input 
                      id="setup-mobile" 
                      name="setupMobile" 
                      type="tel" 
                      placeholder="+91 99999 99999" 
                      className="pl-9"
                      required 
                      value={setupMobile}
                      onChange={(e) => setSetupMobile(e.target.value)} 
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="setup-pin">6-Digit PIN</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input 
                      id="setup-pin" 
                      name="newPin" 
                      type="password" 
                      placeholder="123456" 
                      className="pl-9 tracking-widest text-center" 
                      maxLength={6} 
                      pattern="\d{6}" 
                      inputMode="numeric" 
                      required 
                      value={newPin}
                      onChange={(e) => setNewPin(e.target.value)} 
                    />
                  </div>
                </div>
                <Button type="submit" disabled={isSettingPin} className="w-full">
                  {isSettingPin ? "Saving..." : "Save & Continue"}
                </Button>
              </form>
            </CardContent>
          ) : showRegisterOtp ? (
            <CardContent className="pt-6">
              <form onSubmit={handleVerifyRegisterOtp} className="space-y-4 py-2">
                <div className="text-center space-y-2 mb-4">
                  <h3 className="text-lg font-bold text-foreground">Verify OTP Code</h3>
                  <p className="text-xs text-muted-foreground">
                    A 6-digit verification code has been sent to your registered mobile number: <span className="font-semibold">{registeredUser?.mobile}</span>
                  </p>
                  {mockOtpToShow && (
                    <div className="mt-2 text-xs bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-500 p-2 rounded border border-amber-200 dark:border-amber-900/50">
                      Mock OTP: <span className="font-mono font-bold text-sm select-all">{mockOtpToShow}</span>
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="verify-otp-input">6-Digit OTP Code</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input 
                      id="verify-otp-input" 
                      name="registerOtp" 
                      type="text" 
                      placeholder="000000" 
                      className="pl-9 tracking-widest text-center text-lg font-bold animate-pulse-glow" 
                      maxLength={6} 
                      pattern="\d{6}" 
                      inputMode="numeric" 
                      required 
                      value={registerOtp}
                      onChange={(e) => setRegisterOtp(e.target.value.replace(/\D/g, ''))} 
                    />
                  </div>
                </div>
                <Button type="submit" disabled={isVerifyingOtp} className="w-full">
                  {isVerifyingOtp ? "Verifying..." : "Verify & Continue"}
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  className="w-full"
                  onClick={() => setShowRegisterOtp(false)}
                >
                  Cancel
                </Button>
              </form>
            </CardContent>
          ) : (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <CardHeader className="space-y-1 pb-4">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="login">Login</TabsTrigger>
                  <TabsTrigger value="register">Register</TabsTrigger>
                </TabsList>
              </CardHeader>
              <CardContent>
                {/* Google OAuth Sign In */}
                <div className="pb-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full flex items-center justify-center border-muted hover:bg-accent hover:text-accent-foreground py-5 font-semibold"
                    onClick={() => {
                      setIsLoading(true);
                      signIn('google', { callbackUrl: '/dashboard' });
                    }}
                    disabled={isLoading}
                  >
                    <svg className="w-5 h-5 mr-2 shrink-0" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05" />
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335" />
                    </svg>
                    Continue with Google
                  </Button>
                  
                  <div className="relative my-4">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-muted-foreground/20" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-card px-2 text-muted-foreground">Or continue with PIN</span>
                    </div>
                  </div>
                </div>
                <TabsContent value="login">
                  <form onSubmit={handleLogin} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="login-email">Email or Phone Number</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input id="login-email" name="email" type="text" placeholder="email@example.com or +91 99999 99999" className="pl-9" required value={authData.email} onChange={handleInputChange} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="login-password">6-Digit PIN</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input id="login-password" name="password" type="password" placeholder="123456" className="pl-9 tracking-widest text-center" maxLength={6} pattern="\d{6}" inputMode="numeric" required value={authData.password} onChange={handleInputChange} />
                      </div>
                    </div>
                    
                    {/* Remember Me Checkbox */}
                    <div className="flex items-center space-x-2 py-1">
                      <input 
                        type="checkbox" 
                        id="remember-me" 
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary accent-primary cursor-pointer"
                      />
                      <Label htmlFor="remember-me" className="text-xs text-muted-foreground cursor-pointer select-none">
                        Remember my email
                      </Label>
                    </div>

                    <Button type="submit" disabled={isLoading} className="w-full">
                      {isLoading ? "Authenticating..." : "Continue"}
                    </Button>
                  </form>
                </TabsContent>
                <TabsContent value="register">
                  <form onSubmit={handleRegister} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="register-name">Full Name</Label>
                      <div className="relative">
                        <UserIcon className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input id="register-name" name="name" type="text" placeholder="John Doe" className="pl-9" required value={authData.name} onChange={handleInputChange} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="register-mobile">Mobile Number</Label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input id="register-mobile" name="mobile" type="tel" placeholder="+1 (555) 000-0000" className="pl-9" required value={authData.mobile} onChange={handleInputChange} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="register-email">Email</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input id="register-email" name="email" type="email" placeholder="email@example.com" className="pl-9" required value={authData.email} onChange={handleInputChange} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="register-password">6-Digit PIN</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input id="register-password" name="password" type="password" placeholder="123456" className="pl-9 tracking-widest text-center" maxLength={6} pattern="\d{6}" inputMode="numeric" required value={authData.password} onChange={handleInputChange} />
                      </div>
                    </div>
                    <Button type="submit" disabled={isLoading} className="w-full">
                      {isLoading ? "Processing..." : "Create Account"}
                    </Button>
                  </form>
                </TabsContent>
              </CardContent>
            </Tabs>
          )}
        </Card>
        <p className="mt-8 text-center text-xs text-primary-foreground/60">
          © 2024 EV Charge Operator System. All rights reserved.
        </p>
      </div>
    </div>
  );
};

export default Login;
