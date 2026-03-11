import { DashboardHeader } from '@/components/layout/DashboardHeader';
import { KPICards } from '@/components/dashboard/KPICards';
import { EnergyUsageChart } from '@/components/dashboard/EnergyUsageChart';
import { RevenuePerStationChart } from '@/components/dashboard/RevenuePerStationChart';
import { RecentAlerts } from '@/components/dashboard/RecentAlerts';
import { ActiveSessions } from '@/components/dashboard/ActiveSessions';
import { EVBannerCards } from '@/components/dashboard/EVBannerCards';

const Dashboard = () => {
  return (
    <div className="flex flex-col min-h-screen">
      <DashboardHeader 
        title="Dashboard" 
        subtitle="Overview of your charging network"
      />
      
      <div className="flex-1 p-6 space-y-6">
        <KPICards />
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <EVBannerCards />
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <EnergyUsageChart />
          <RevenuePerStationChart />
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ActiveSessions />
          <RecentAlerts />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
