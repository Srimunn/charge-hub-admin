import { Bell, Search, User } from 'lucide-react';
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

interface DashboardHeaderProps {
  title: string;
  subtitle?: string;
}

export function DashboardHeader({ title, subtitle }: DashboardHeaderProps) {
  return (
    <header className="flex items-center justify-between px-6 lg:px-8 py-5 bg-card/80 backdrop-blur-md border-b border-border/60 sticky top-0 z-30">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
        {subtitle && (
          <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>
        )}
      </div>

      <div className="flex items-center gap-3">
        {/* Search */}
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search stations, users..."
            className="w-64 pl-9 bg-secondary/60 border-0 rounded-xl text-sm focus-visible:ring-primary/30"
          />
        </div>

        {/* Notifications */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative rounded-xl hover:bg-secondary/60">
              <Bell className="w-5 h-5 text-muted-foreground" />
              <Badge className="absolute -top-1 -right-1 w-5 h-5 flex items-center justify-center p-0 text-[10px] bg-destructive border-2 border-card">
                3
              </Badge>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80 rounded-xl">
            <DropdownMenuLabel>Notifications</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="flex flex-col items-start gap-1 py-3">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-destructive" />
                <span className="font-medium text-sm">High Temperature Alert</span>
              </div>
              <span className="text-xs text-muted-foreground">STN-004 - 2 minutes ago</span>
            </DropdownMenuItem>
            <DropdownMenuItem className="flex flex-col items-start gap-1 py-3">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-warning" />
                <span className="font-medium text-sm">Misalignment Detected</span>
              </div>
              <span className="text-xs text-muted-foreground">STN-002 - 15 minutes ago</span>
            </DropdownMenuItem>
            <DropdownMenuItem className="flex flex-col items-start gap-1 py-3">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-destructive" />
                <span className="font-medium text-sm">Station Offline</span>
              </div>
              <span className="text-xs text-muted-foreground">STN-006 - 2 hours ago</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="justify-center text-primary font-medium">
              View all notifications
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Profile */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="gap-2 rounded-xl hover:bg-secondary/60">
              <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
                <User className="w-4 h-4 text-primary" />
              </div>
              <span className="hidden md:inline font-medium text-sm">Admin</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="rounded-xl">
            <DropdownMenuLabel>My Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Profile</DropdownMenuItem>
            <DropdownMenuItem>Settings</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive">Logout</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
