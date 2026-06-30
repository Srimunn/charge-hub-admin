"use client";

import { DashboardSidebar } from '@/components/layout/DashboardSidebar';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { signOut } from 'next-auth/react';
import { getMe } from '@/services/api';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [isAuth, setIsAuth] = useState(false);
  const { toast } = useToast();

  // Warning Modal States
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(60);

  // Sync settings once on layout mount
  useEffect(() => {
    const syncSettings = async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) return;
        const res = await getMe();
        if (res.sessionTimeout) {
          localStorage.setItem('sessionTimeout', res.sessionTimeout.toString());
        }
        if (res.name) localStorage.setItem('userName', res.name);
        if (res.email) localStorage.setItem('userEmail', res.email);
        if (res.mobile) localStorage.setItem('userMobile', res.mobile);
      } catch (err) {
        console.error("Failed to sync settings on dashboard bootstrap:", err);
      }
    };
    syncSettings();
  }, []);

  const handleLogout = useCallback(() => {
    signOut({ redirect: false });
    localStorage.clear();
    setIsAuth(false);
    setShowWarningModal(false);
    toast({
      title: "Session Expired",
      description: "Your session has expired. Please log in again.",
      variant: "destructive",
    });
    router.push("/login");
  }, [router, toast]);

  const handleStayLoggedIn = () => {
    localStorage.setItem('lastActivity', Date.now().toString());
    setShowWarningModal(false);
  };

  useEffect(() => {
    const checkAuth = () => {
      const token = localStorage.getItem("token");
      if (!token) {
        setIsAuth(false);
        router.push("/login");
        return false;
      }

      try {
        const payloadPart = token.split(".")[1];
        if (!payloadPart) throw new Error("Invalid JWT");
        const payload = JSON.parse(atob(payloadPart));
        if (payload.exp && payload.exp * 1000 < Date.now()) {
          handleLogout();
          return false;
        }
      } catch (e) {
        handleLogout();
        return false;
      }

      setIsAuth(true);
      return true;
    };

    const updateActivity = () => {
      // Only update activity if we aren't showing the warning modal.
      // If warning modal is open, user needs to click the button to stay logged in.
      if (!showWarningModal) {
        localStorage.setItem('lastActivity', Date.now().toString());
      }
    };

    // Initialize activity timestamp
    localStorage.setItem('lastActivity', Date.now().toString());

    // Listeners for user interaction to reset the inactivity timer
    const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    activityEvents.forEach(event => {
      window.addEventListener(event, updateActivity);
    });

    const isValid = checkAuth();

    // Check timer every 1 second to update warning countdown smoothly
    const interval = setInterval(() => {
      if (!localStorage.getItem("token")) return;
      
      const isAuthValid = checkAuth();
      if (!isAuthValid) return;

      const savedTimeout = localStorage.getItem('sessionTimeout');
      const timeoutMinutes = savedTimeout ? parseInt(savedTimeout, 10) : 30; // default 30 mins
      const timeoutMs = timeoutMinutes * 60 * 1000;
      
      const lastActivity = localStorage.getItem('lastActivity');
      if (lastActivity) {
        const elapsed = Date.now() - parseInt(lastActivity, 10);
        const remaining = timeoutMs - elapsed;

        if (remaining <= 0) {
          console.log(`Session timed out: elapsed ${elapsed}ms (timeout: ${timeoutMs}ms)`);
          handleLogout();
        } else if (remaining <= 60 * 1000) {
          // Warning threshold: 1 min (60s) or less
          setShowWarningModal(true);
          setSecondsLeft(Math.max(0, Math.ceil(remaining / 1000)));
        } else {
          setShowWarningModal(false);
        }
      }
    }, 1000);

    const onAuthExpired = () => {
      handleLogout();
    };

    window.addEventListener("auth-expired", onAuthExpired);

    return () => {
      clearInterval(interval);
      window.removeEventListener("auth-expired", onAuthExpired);
      activityEvents.forEach(event => {
        window.removeEventListener(event, updateActivity);
      });
    };
  }, [router, toast, showWarningModal, handleLogout]);

  if (!isAuth) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[#DADBDF]">
        <div className="animate-pulse text-primary font-medium">Verifying Access...</div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full overflow-hidden p-0 md:p-3" style={{ backgroundColor: '#DADBDF' }}>
      <DashboardSidebar />
      <div className="flex-1 h-full overflow-hidden rounded-none md:rounded-[2.5rem] bg-background shadow-md flex flex-col border border-black/5 ml-0 md:ml-3">
        <main className="flex-1 h-full overflow-auto">
          {children}
        </main>
      </div>

      {/* Warning Overlay Modal */}
      {showWarningModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-md">
          <div className="bg-background border rounded-3xl p-6 shadow-2xl max-w-md w-full mx-4 space-y-5 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-amber-100 rounded-full dark:bg-amber-900/30">
                <AlertTriangle className="w-6 h-6 text-amber-600 dark:text-amber-500 animate-pulse" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-foreground">Inactivity Alert</h3>
                <p className="text-xs text-muted-foreground">Session expiry warning</p>
              </div>
            </div>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Your session will expire in <span className="font-semibold text-foreground text-base bg-amber-50 dark:bg-amber-950/20 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-900/50">{secondsLeft} seconds</span> due to inactivity. Do you want to stay logged in?
            </p>
            <div className="flex gap-3 justify-end pt-2">
              <Button onClick={handleLogout} variant="ghost" className="hover:bg-destructive/10 hover:text-destructive">
                Logout Now
              </Button>
              <Button onClick={handleStayLoggedIn} className="bg-primary hover:bg-primary/90 text-primary-foreground">
                Stay Logged In
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
