"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, Lock, User as UserIcon, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { loginUser, registerUser } from '@/services/api';
import Image from 'next/image';

const Login = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [authData, setAuthData] = useState({ name: '', email: '', password: '', mobile: '' });
  const router = useRouter();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState('login');

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
      toast({
        title: 'Registration Successful',
        description: res.message || 'You can now login with your credentials.',
      });
      setActiveTab('login');
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

  return (
    <div className="min-h-screen flex items-center justify-center gradient-primary p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8 animate-fade-in-up">
          <div className="w-20 h-20 rounded-2xl bg-[#DADBDF] shadow-lg mb-4 flex items-center justify-center overflow-hidden shrink-0 relative">
            {/* Using img tag for now to keep it simple with existing assets */}
            <img src="/logo.jpeg" alt="EV Charge Logo" className="w-full h-full object-contain mix-blend-multiply brightness-110 contrast-150 saturate-200 transform scale-150 drop-shadow-[0_4px_4px_rgba(0,0,0,0.5)] drop-shadow-[0_0px_12px_rgba(0,100,255,0.6)]" />
          </div>
          <h1 className="text-2xl font-bold text-primary-foreground">EV Charge</h1>
          <p className="text-primary-foreground/70">Autonomous Wireless Charging</p>
        </div>

        <Card className="border-0 shadow-2xl animate-scale-in">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <CardHeader className="space-y-1 pb-4">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">Login</TabsTrigger>
                <TabsTrigger value="register">Register</TabsTrigger>
              </TabsList>
            </CardHeader>
            <CardContent>
              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input id="login-email" name="email" type="email" placeholder="email@example.com" className="pl-9" required onChange={handleInputChange} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-password">6-Digit PIN</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input id="login-password" name="password" type="password" placeholder="123456" className="pl-9 tracking-widest text-center" maxLength={6} pattern="\d{6}" inputMode="numeric" required onChange={handleInputChange} />
                    </div>
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
                      <Input id="register-name" name="name" type="text" placeholder="John Doe" className="pl-9" required onChange={handleInputChange} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-mobile">Mobile Number</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input id="register-mobile" name="mobile" type="tel" placeholder="+1 (555) 000-0000" className="pl-9" required onChange={handleInputChange} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input id="register-email" name="email" type="email" placeholder="email@example.com" className="pl-9" required onChange={handleInputChange} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-password">6-Digit PIN</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input id="register-password" name="password" type="password" placeholder="123456" className="pl-9 tracking-widest text-center" maxLength={6} pattern="\d{6}" inputMode="numeric" required onChange={handleInputChange} />
                    </div>
                  </div>
                  <Button type="submit" disabled={isLoading} className="w-full">
                    {isLoading ? "Processing..." : "Create Account"}
                  </Button>
                </form>
              </TabsContent>
            </CardContent>
          </Tabs>
        </Card>
        <p className="mt-8 text-center text-xs text-primary-foreground/60">
          © 2024 EV Charge Operator System. All rights reserved.
        </p>
      </div>
    </div>
  );
};

export default Login;
