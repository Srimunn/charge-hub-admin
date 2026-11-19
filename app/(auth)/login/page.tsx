"use client";

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Mail, Lock, Phone, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { loginUser, setPin } from '@/services/api';
import { signIn, signOut, useSession } from 'next-auth/react';
import { isOperatorRole, saveAuth } from '@/lib/auth';

const NOT_OPERATOR_MSG =
  'This portal is for station owners and administrators. Customers should use the EV Charge mobile app.';

const LoginForm = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [authData, setAuthData] = useState({ email: '', password: '' });
  const [rememberMe, setRememberMe] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { data: session, status } = useSession();

  // First Google sign-in of an owner/admin without a PIN yet
  const [showPinSetup, setShowPinSetup] = useState(false);
  const [setupMobile, setSetupMobile] = useState('');
  const [newPin, setNewPin] = useState('');
  const [isSettingPin, setIsSettingPin] = useState(false);
  const [pendingSession, setPendingSession] = useState<any>(null);

  const authError = searchParams?.get('error');

  useEffect(() => {
    const savedEmail = localStorage.getItem("rememberedEmail");
    if (savedEmail) {
      setAuthData(prev => ({ ...prev, email: savedEmail }));
      setRememberMe(true);
    }
  }, []);

  useEffect(() => {
    if (status !== 'authenticated' || !session) return;
    const backendToken = (session as any).backendToken;
    const backendUser = (session as any).backendUser;
    if (!backendToken || !backendUser) return;

    if (!isOperatorRole(backendUser.role)) {
      toast({ title: 'Access denied', description: NOT_OPERATOR_MSG, variant: 'destructive' });
      signOut({ redirect: false });
      return;
    }
    if (backendUser.hasProfileComplete === false) {
      setPendingSession(session);
      setSetupMobile(backendUser.mobile || '');
      setShowPinSetup(true);
      return;
    }
    saveAuth({ token: backendToken, ...backendUser });
    toast({ title: 'Signed in', description: `Welcome back, ${backendUser.name}` });
    router.replace('/dashboard');
  }, [status, session, router, toast]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setAuthData(prev => ({ ...prev, [name]: value }));
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = await loginUser({ email: authData.email.trim(), password: authData.password });
      if (!isOperatorRole(res.role)) throw new Error(NOT_OPERATOR_MSG);
      saveAuth(res);
      if (rememberMe) localStorage.setItem("rememberedEmail", authData.email.trim());
      else localStorage.removeItem("rememberedEmail");
      toast({ title: 'Signed in', description: `Welcome back, ${res.name}` });
      router.replace('/dashboard');
    } catch (error: any) {
      toast({ title: 'Sign-in failed', description: error.message || "Invalid credentials", variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSetPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!setupMobile || setupMobile.trim().length < 8) {
      toast({ title: "Invalid mobile number", description: "Please enter a valid mobile number", variant: "destructive" });
      return;
    }
    if (!/^\d{6}$/.test(newPin)) {
      toast({ title: "Invalid PIN", description: "PIN must be exactly 6 digits", variant: "destructive" });
      return;
    }
    setIsSettingPin(true);
    try {
      const token = pendingSession.backendToken;
      const user = pendingSession.backendUser;
      await setPin(newPin, setupMobile.trim(), token);
      saveAuth({ token, ...user, mobile: setupMobile.trim() });
      toast({ title: "Profile saved", description: "You can now sign in with Google or with your email/phone and PIN." });
      setShowPinSetup(false);
      router.replace('/dashboard');
    } catch (error: any) {
      toast({ title: "Setup failed", description: error.message || "Could not save your PIN", variant: "destructive" });
    } finally {
      setIsSettingPin(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center gradient-primary p-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8 animate-fade-in-up">
          <div className="w-20 h-20 rounded-2xl bg-[#DADBDF] shadow-lg mb-4 flex items-center justify-center overflow-hidden shrink-0 relative">
            <img src="/logo.jpeg" alt="EV Charge Logo" className="w-full h-full object-contain mix-blend-multiply brightness-110 contrast-150 saturate-200 transform scale-150 drop-shadow-[0_4px_4px_rgba(0,0,0,0.5)] drop-shadow-[0_0px_12px_rgba(0,100,255,0.6)]" />
          </div>
          <h1 className="text-2xl font-bold text-primary-foreground">EV Charge Operator</h1>
          <p className="text-primary-foreground/70">Station owner &amp; admin portal</p>
        </div>

        <Card className="border-0 shadow-2xl animate-scale-in">
          {showPinSetup ? (
            <CardContent className="pt-6">
              <form onSubmit={handleSetPin} className="space-y-4 py-2">
                <div className="text-center space-y-2 mb-4">
                  <h3 className="text-lg font-bold text-foreground">Complete your profile</h3>
                  <p className="text-xs text-muted-foreground">
                    Add your mobile number and a 6-digit PIN. You can then sign in with Google or with your PIN.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="setup-mobile">Mobile number</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input id="setup-mobile" type="tel" placeholder="+91 99999 99999" className="pl-9" required value={setupMobile} onChange={(e) => setSetupMobile(e.target.value)} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="setup-pin">6-digit PIN</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input id="setup-pin" type="password" placeholder="••••••" className="pl-9 tracking-widest text-center" maxLength={6} pattern="\d{6}" inputMode="numeric" required value={newPin} onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))} />
                  </div>
                </div>
                <Button type="submit" disabled={isSettingPin} className="w-full">
                  {isSettingPin ? "Saving..." : "Save & continue"}
                </Button>
              </form>
            </CardContent>
          ) : (
            <>
              <CardHeader className="space-y-1 pb-4">
                <h2 className="text-lg font-semibold text-center">Sign in</h2>
                {authError && (
                  <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
                    <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>{authError === 'AccessDenied' ? NOT_OPERATOR_MSG : 'Google sign-in failed. Please try again.'}</span>
                  </div>
                )}
              </CardHeader>
              <CardContent>
                <div className="pb-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full flex items-center justify-center border-muted hover:bg-accent hover:text-accent-foreground py-5 font-semibold"
                    onClick={() => {
                      setIsLoading(true);
                      signIn('google', { callbackUrl: '/login' });
                    }}
                    disabled={isLoading}
                  >
                    <svg className="w-5 h-5 mr-2 shrink-0" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
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
                      <span className="bg-card px-2 text-muted-foreground">Or sign in with PIN</span>
                    </div>
                  </div>
                </div>
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email">Email or phone number</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input id="login-email" name="email" type="text" autoComplete="username" placeholder="you@company.com or 9999999999" className="pl-9" required value={authData.email} onChange={handleInputChange} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-password">6-digit PIN</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input id="login-password" name="password" type="password" autoComplete="current-password" placeholder="••••••" className="pl-9 tracking-widest text-center" maxLength={6} pattern="\d{6}" inputMode="numeric" required value={authData.password} onChange={handleInputChange} />
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 py-1">
                    <input type="checkbox" id="remember-me" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} className="h-4 w-4 rounded border-gray-300 accent-primary cursor-pointer" />
                    <Label htmlFor="remember-me" className="text-xs text-muted-foreground cursor-pointer select-none">Remember my email</Label>
                  </div>
                  <Button type="submit" disabled={isLoading} className="w-full">
                    {isLoading ? "Signing in..." : "Sign in"}
                  </Button>
                  <p className="text-center text-xs text-muted-foreground">
                    Need an owner account? Ask your EV Charge administrator.
                  </p>
                </form>
              </CardContent>
            </>
          )}
        </Card>
        <p className="mt-8 text-center text-xs text-primary-foreground/60">
          © {new Date().getFullYear()} EV Charge Operator System. All rights reserved.
        </p>
      </div>
    </div>
  );
};

export default function Login() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
