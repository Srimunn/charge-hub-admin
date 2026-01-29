import { Outlet } from 'react-router-dom';
import { DashboardSidebar } from './DashboardSidebar';

export function DashboardLayout() {
  return (
    <div className="flex min-h-screen w-full bg-background">
      <DashboardSidebar />
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
