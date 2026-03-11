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
      
      <div className="flex-1 p-6 lg:p-8 space-y-8">
        {/* KPI Cards — asymmetric grid */}
        <KPICards />
        
        {/* EV Insight Banners */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <EVBannerCards />
        </div>
        
        {/* Charts — editorial two-column with unequal widths */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7">
            <EnergyUsageChart />
          </div>
          <div className="lg:col-span-5">
            <RevenuePerStationChart />
          </div>
        </div>
        
        {/* Activity — sessions wider, alerts narrower */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7">
            <ActiveSessions />
          </div>
          <div className="lg:col-span-5">
            <RecentAlerts />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
