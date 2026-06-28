"use client";
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Radio,
  Zap,
  AlertTriangle,
  DollarSign,
  BarChart3,
  Users,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Shield,
  Bell,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { signOut } from 'next-auth/react';

const navItems = [
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
];

export function DashboardSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setCollapsed(true);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleLogout = () => {
    signOut({ redirect: false });
    localStorage.clear();
    router.push('/login');
  };

  return (
    <aside
      className={cn(
        'hidden md:flex relative flex-col border-r border-sidebar-border transition-all duration-300 h-screen sticky top-0',
        collapsed ? 'w-[72px]' : 'w-[260px]'
      )}
      style={{
        backgroundColor: '#DADBDF',
      }}
    >
      {/* Logo */}
      <div className={cn(
        'flex items-center gap-3 border-b border-sidebar-border',
        collapsed ? 'px-3 py-5 justify-center' : 'px-5 py-5'
      )}>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center overflow-hidden shrink-0">
          <img
            src="/logo.jpeg"
            alt="EV Charge Logo"
            className="w-full h-full object-contain"
          />
        </div>
        {!collapsed && (
          <div className="flex flex-col">
            <span className="font-bold text-sm text-black tracking-wide">EV Charge</span>
            <span className="text-[11px] text-gray-500 font-medium">Operator System</span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-5 overflow-y-auto">
        <ul className="space-y-0.5 px-3">
          {navItems.map((item) => {
            const isActive = pathname === item.path ||
              (item.path === '/stations' && pathname.startsWith('/stations/'));

            const linkContent = (
              <Link
                href={item.path}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group text-black font-medium',
                  'hover:bg-black/5',
                  isActive && 'bg-black/10 shadow-sm'
                )}
              >
                <div className={cn(
                  'flex items-center justify-center w-8 h-8 rounded-lg transition-all duration-200',
                  isActive
                    ? 'text-black'
                    : 'text-gray-600 group-hover:text-black'
                )}>
                  <item.icon className="w-[18px] h-[18px]" />
                </div>
                {!collapsed && (
                  <span className="text-[13px] transition-colors duration-200">
                    {item.label}
                  </span>
                )}
                {isActive && !collapsed && (
                  <div className="ml-auto w-1.5 h-1.5 rounded-full bg-black" />
                )}
              </Link>
            );

            return (
              <li key={item.path}>
                {collapsed ? (
                  <Tooltip delayDuration={0}>
                    <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                    <TooltipContent side="right" className="bg-card text-card-foreground text-xs font-medium">
                      {item.label}
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  linkContent
                )}
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div className="border-t border-black/10 p-3">
        {collapsed ? (
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleLogout}
                className="w-full h-10 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-xl"
              >
                <LogOut className="w-[18px] h-[18px]" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right" className="bg-card text-card-foreground">
              Logout
            </TooltipContent>
          </Tooltip>
        ) : (
          <Button
            variant="ghost"
            onClick={handleLogout}
            className="w-full justify-start gap-3 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-xl text-[13px]"
          >
            <LogOut className="w-[18px] h-[18px]" />
            <span>Logout</span>
          </Button>
        )}
      </div>

      {/* Collapse Toggle */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-4 top-1/2 -translate-y-1/2 z-50 w-8 h-8 rounded-full bg-[#DADBDF] border border-black/10 shadow-md shadow-black/10 hover:bg-black/5 hover:scale-105 transition-all duration-200 flex items-center justify-center p-0"
      >
        <ChevronLeft className={cn("w-4 h-4 text-black transition-transform duration-300", collapsed && "rotate-180")} />
      </Button>
    </aside>
  );
}

