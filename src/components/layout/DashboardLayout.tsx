import { Outlet } from 'react-router-dom';
import { DashboardSidebar } from './DashboardSidebar';

export function DashboardLayout() {
  return (
    <div className="flex h-screen w-full overflow-hidden p-3" style={{ backgroundColor: '#DADBDF' }}>
      <DashboardSidebar />
      <div className="flex-1 h-full overflow-hidden rounded-[2.5rem] bg-background shadow-md flex flex-col border border-black/5 ml-3">
        <main className="flex-1 h-full overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
