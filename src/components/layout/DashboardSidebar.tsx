import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
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
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import logo from '@/assets/logo.jpeg';

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
  { icon: Radio, label: 'Stations', path: '/stations' },
  { icon: Zap, label: 'Live Sessions', path: '/sessions' },
  { icon: AlertTriangle, label: 'Faults & Alerts', path: '/faults' },
  { icon: Shield, label: 'Safety & Faults', path: '/safety' },
  { icon: DollarSign, label: 'Pricing', path: '/pricing' },
  { icon: BarChart3, label: 'Reports', path: '/reports' },
  { icon: Users, label: 'Users & Fleets', path: '/users' },
  { icon: Settings, label: 'Settings', path: '/settings' },
];

export function DashboardSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();

  const handleLogout = () => {
    window.location.href = '/';
  };

  return (
    <aside
      className={cn(
        'relative flex flex-col border-r border-sidebar-border transition-all duration-300 h-screen sticky top-0',
        collapsed ? 'w-[72px]' : 'w-[260px]'
      )}
      style={{
        background: 'linear-gradient(180deg, hsl(220 10% 12%) 0%, hsl(220 10% 16%) 100%)',
      }}
    >
      {/* Logo */}
      <div className={cn(
        'flex items-center gap-3 border-b border-sidebar-border',
        collapsed ? 'px-3 py-5 justify-center' : 'px-5 py-5'
      )}>
        <img
          src={logo}
          alt="EV Charge Logo"
          className="w-10 h-10 rounded-xl object-cover ring-2 ring-sidebar-accent shadow-lg"
        />
        {!collapsed && (
          <div className="flex flex-col">
            <span className="font-bold text-sm text-sidebar-foreground tracking-wide">EV Charge</span>
            <span className="text-[11px] text-sidebar-muted font-medium">Operator System</span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-5 overflow-y-auto">
        <ul className="space-y-0.5 px-3">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path ||
              (item.path === '/stations' && location.pathname.startsWith('/stations/'));

            const linkContent = (
              <NavLink
                to={item.path}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group',
                  'hover:bg-sidebar-accent/60',
                  isActive
                    ? 'bg-sidebar-accent text-sidebar-primary font-semibold shadow-sm'
                    : 'text-sidebar-muted'
                )}
              >
                <div className={cn(
                  'flex items-center justify-center w-8 h-8 rounded-lg transition-all duration-200',
                  isActive
                    ? 'bg-sidebar-primary/15 text-sidebar-primary'
                    : 'text-sidebar-muted group-hover:text-sidebar-foreground'
                )}>
                  <item.icon className="w-[18px] h-[18px]" />
                </div>
                {!collapsed && (
                  <span className={cn(
                    'text-[13px] transition-colors duration-200',
                    isActive ? 'text-sidebar-accent-foreground' : 'group-hover:text-sidebar-foreground'
                  )}>
                    {item.label}
                  </span>
                )}
                {isActive && !collapsed && (
                  <div className="ml-auto w-1.5 h-1.5 rounded-full bg-sidebar-primary" />
                )}
              </NavLink>
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
      <div className="border-t border-sidebar-border p-3">
        {collapsed ? (
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleLogout}
                className="w-full h-10 text-sidebar-muted hover:text-destructive hover:bg-destructive/10 rounded-xl"
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
            className="w-full justify-start gap-3 text-sidebar-muted hover:text-destructive hover:bg-destructive/10 rounded-xl text-[13px]"
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
        className="absolute -right-3.5 top-20 w-7 h-7 rounded-full bg-card border border-border shadow-md hover:bg-secondary transition-all duration-200"
      >
        {collapsed ? (
          <ChevronRight className="w-3.5 h-3.5" />
        ) : (
          <ChevronLeft className="w-3.5 h-3.5" />
        )}
      </Button>
    </aside>
  );
}
