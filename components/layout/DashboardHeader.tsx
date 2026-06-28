"use client";
import { Bell, Search, User, Menu, LayoutDashboard, Radio, Zap, AlertTriangle, DollarSign, BarChart3, Users, Settings } from 'lucide-react';
import { useRouter, usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { useEffect, useState } from 'react';
import { signOut } from 'next-auth/react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { getNotifications, markNotificationsRead } from '@/services/api';
import { getSocket } from '@/lib/socket';

interface DashboardHeaderProps {
  title: string;
  subtitle?: string;
  searchQuery?: string;
  onSearchChange?: (val: string) => void;
  searchPlaceholder?: string;
}

export function DashboardHeader({ 
  title, 
  subtitle, 
  searchQuery, 
  onSearchChange, 
  searchPlaceholder 
}: DashboardHeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [userName, setUserName] = useState('Admin');
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchNotifs = async () => {
    try {
      const data = await getNotifications();
      if (Array.isArray(data)) {
        setNotifications(data);
        setUnreadCount(data.filter((n: any) => !n.read).length);
      }
    } catch (err) {
      console.error("Failed to load notifications:", err);
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedName = localStorage.getItem('userName');
      if (storedName) setUserName(storedName);
    }
    
    fetchNotifs();

    const socket = getSocket();
    socket.on("new_notification", (notif: any) => {
      setNotifications(prev => [notif, ...prev.slice(0, 49)]);
      setUnreadCount(prev => prev + 1);
    });

    return () => {
      socket.off("new_notification");
    };
  }, []);

  const handleMarkAllRead = async () => {
    try {
      await markNotificationsRead();
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error(err);
    }
  };

  const handleLogout = () => {
    signOut({ redirect: false });
    localStorage.clear();
    router.push('/login');
  };

  return (
    <header className="flex items-center justify-between px-6 lg:px-8 py-5 bg-card/80 backdrop-blur-md border-b border-border/60 sticky top-0 z-30">
      <div className="flex items-center gap-3">
        {/* Mobile Hamburger Drawer */}
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="md:hidden w-11 h-11 rounded-xl hover:bg-secondary/60 shrink-0">
              <Menu className="w-5 h-5 text-foreground" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-72 bg-[#DADBDF] border-r border-sidebar-border">
            <div className="flex flex-col h-full">
              {/* Logo */}
              <div className="flex items-center gap-3 px-5 py-5 border-b border-sidebar-border bg-[#DADBDF]">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center overflow-hidden shrink-0">
                  <img
                    src="/logo.jpeg"
                    alt="EV Charge Logo"
                    className="w-full h-full object-contain"
                  />
                </div>
                <div className="flex flex-col text-left">
                  <span className="font-bold text-sm text-black tracking-wide">EV Charge</span>
                  <span className="text-[11px] text-gray-500 font-medium">Operator System</span>
                </div>
              </div>

              {/* Navigation list */}
              <nav className="flex-1 py-5 overflow-y-auto">
                <ul className="space-y-0.5 px-3">
                  {[
                    { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
                    { icon: Radio, label: 'Stations', path: '/stations' },
                    { icon: Zap, label: 'Live Sessions', path: '/sessions' },
                    { icon: AlertTriangle, label: 'Faults & Alerts', path: '/faults' },
                    { icon: DollarSign, label: 'Pricing', path: '/pricing' },
                    { icon: DollarSign, label: 'Payments', path: '/payments' },
                    { icon: Bell, label: 'Notifications', path: '/notifications' },
                    { icon: BarChart3, label: 'Reports', path: '/reports' },
                    { icon: Users, label: 'Users & Fleets', path: '/users' },
                    { icon: Settings, label: 'Settings', path: '/settings' },
                  ].map((item) => {
                    const isActive = pathname === item.path ||
                      (item.path === '/stations' && pathname.startsWith('/stations/'));

                    return (
                      <li key={item.path}>
                        <Link
                          href={item.path}
                          onClick={() => setIsOpen(false)}
                          className={cn(
                            'flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group text-black font-medium text-left',
                            'hover:bg-black/5',
                            isActive && 'bg-black/10 shadow-sm'
                          )}
                        >
                          <div className={cn(
                            'flex items-center justify-center w-8 h-8 rounded-lg transition-all duration-200',
                            isActive ? 'text-black' : 'text-gray-600 group-hover:text-black'
                          )}>
                            <item.icon className="w-[18px] h-[18px]" />
                          </div>
                          <span className="text-[13px] transition-colors duration-200">
                            {item.label}
                          </span>
                          {isActive && (
                            <div className="ml-auto w-1.5 h-1.5 rounded-full bg-black" />
                          )}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </nav>
            </div>
          </SheetContent>
        </Sheet>

        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-foreground">{title}</h1>
          {subtitle && (
            <p className="text-xs md:text-sm text-muted-foreground mt-0.5">{subtitle}</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Search */}
        {onSearchChange && (
          <div className="relative hidden md:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={searchPlaceholder || "Search..."}
              className="w-64 pl-9 bg-secondary/60 border-0 rounded-xl text-sm focus-visible:ring-primary/30"
              value={searchQuery || ""}
              onChange={(e) => onSearchChange(e.target.value)}
            />
          </div>
        )}

        {/* Notification Bell Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative w-10 h-10 rounded-xl hover:bg-secondary/60 shrink-0">
              <Bell className="w-5 h-5 text-foreground" />
              {unreadCount > 0 && (
                <Badge variant="destructive" className="absolute -top-1 -right-1 px-1.5 py-0.5 min-w-5 h-5 flex items-center justify-center rounded-full text-[9px] font-bold">
                  {unreadCount}
                </Badge>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80 rounded-2xl p-2 bg-popover border border-border shadow-xl z-50">
            <div className="flex items-center justify-between px-3 py-2 border-b border-border/60">
              <span className="font-semibold text-sm">Notifications</span>
              {unreadCount > 0 && (
                <button 
                  onClick={handleMarkAllRead} 
                  className="text-xs text-primary hover:underline font-medium"
                >
                  Mark all as read
                </button>
              )}
            </div>
            <div className="max-h-80 overflow-y-auto py-1">
              {notifications.length === 0 ? (
                <div className="py-8 text-center text-xs text-muted-foreground">
                  No notifications yet.
                </div>
              ) : (
                notifications.slice(0, 5).map((notif: any) => {
                  const Icon = 
                    notif.type === 'fault' ? AlertTriangle :
                    notif.type === 'payment' ? DollarSign :
                    (notif.type === 'session_start' || notif.type === 'session_end') ? Zap :
                    notif.type === 'otp' ? Settings : Bell;

                  const colorClass = 
                    notif.type === 'fault' ? 'text-destructive bg-destructive/10' :
                    notif.type === 'payment' ? 'text-emerald-500 bg-emerald-500/10' :
                    (notif.type === 'session_start' || notif.type === 'session_end') ? 'text-amber-500 bg-amber-500/10' :
                    'text-primary bg-primary/10';

                  return (
                    <div 
                      key={notif._id} 
                      onClick={async () => {
                        try {
                          await markNotificationsRead([notif._id]);
                          fetchNotifs();
                        } catch (err) {
                          console.error(err);
                        }
                      }}
                      className={cn(
                        "flex gap-3 px-3 py-2.5 rounded-xl cursor-pointer hover:bg-secondary/50 transition-colors",
                        !notif.read && "bg-primary/5 hover:bg-primary/10"
                      )}
                    >
                      <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", colorClass)}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className={cn("text-xs font-semibold text-foreground truncate", !notif.read && "font-bold")}>
                          {notif.title}
                        </span>
                        <span className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">
                          {notif.message}
                        </span>
                        <span className="text-[9px] text-muted-foreground/60 mt-1">
                          {new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            <div className="border-t border-border/60 pt-2 pb-1 text-center">
              <button 
                onClick={() => router.push('/notifications')} 
                className="text-xs text-primary hover:underline font-semibold"
              >
                View all notifications
              </button>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Profile */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="gap-2 rounded-xl hover:bg-secondary/60">
              <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
                <User className="w-4 h-4 text-primary" />
              </div>
              <span className="hidden md:inline font-medium text-sm">{userName}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="rounded-xl">
            <DropdownMenuLabel>My Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => router.push('/settings')}>Profile</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={handleLogout} className="text-destructive font-semibold">Logout</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

