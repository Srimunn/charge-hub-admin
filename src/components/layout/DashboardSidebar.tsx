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
  BatteryCharging,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
  { icon: Radio, label: 'Stations', path: '/stations' },
  { icon: Zap, label: 'Live Sessions', path: '/sessions' },
  { icon: AlertTriangle, label: 'Faults & Alerts', path: '/faults' },
  { icon: AlertTriangle, label: 'Safety & Faults', path: '/safety' },
  { icon: DollarSign, label: 'Pricing', path: '/pricing' },
  { icon: BarChart3, label: 'Reports', path: '/reports' },
  { icon: Users, label: 'Users & Fleets', path: '/users' },
  { icon: Settings, label: 'Settings', path: '/settings' },
];

export function DashboardSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();

  const handleLogout = () => {
    // Simulated logout - navigate to login page
    window.location.href = '/';
  };

  return (
    <aside
      className={cn(
        'flex flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border transition-all duration-300 h-screen sticky top-0',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 p-4 border-b border-sidebar-border">
        <div className="flex items-center justify-center w-10 h-10 rounded-lg gradient-primary">
          <BatteryCharging className="w-6 h-6 text-primary-foreground" />
        </div>
        {!collapsed && (
          <div className="flex flex-col">
            <span className="font-bold text-sm">EV Charge</span>
            <span className="text-xs text-sidebar-muted">Operator System</span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 overflow-y-auto">
        <ul className="space-y-1 px-2">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path || 
              (item.path === '/stations' && location.pathname.startsWith('/stations/'));
            
            const linkContent = (
              <NavLink
                to={item.path}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200',
                  'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                  isActive && 'bg-sidebar-accent text-sidebar-primary font-medium'
                )}
              >
                <item.icon className={cn('w-5 h-5 flex-shrink-0', isActive && 'text-sidebar-primary')} />
                {!collapsed && <span className="text-sm">{item.label}</span>}
              </NavLink>
            );

            return (
              <li key={item.path}>
                {collapsed ? (
                  <Tooltip delayDuration={0}>
                    <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                    <TooltipContent side="right" className="bg-card text-card-foreground">
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
      <div className="border-t border-sidebar-border p-2">
        {collapsed ? (
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleLogout}
                className="w-full h-10 text-sidebar-muted hover:text-sidebar-foreground hover:bg-sidebar-accent"
              >
                <LogOut className="w-5 h-5" />
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
            className="w-full justify-start gap-3 text-sidebar-muted hover:text-sidebar-foreground hover:bg-sidebar-accent"
          >
            <LogOut className="w-5 h-5" />
            <span>Logout</span>
          </Button>
        )}
      </div>

      {/* Collapse Toggle */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-20 w-6 h-6 rounded-full bg-card border border-border shadow-md hover:bg-secondary"
      >
        {collapsed ? (
          <ChevronRight className="w-4 h-4" />
        ) : (
          <ChevronLeft className="w-4 h-4" />
        )}
      </Button>
    </aside>
  );
}
