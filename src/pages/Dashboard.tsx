import { DashboardHeader } from '@/components/layout/DashboardHeader';
import { KPICards } from '@/components/dashboard/KPICards';
import { EnergyUsageChart } from '@/components/dashboard/EnergyUsageChart';
import { RevenuePerStationChart } from '@/components/dashboard/RevenuePerStationChart';
import { RevenueTrendChart } from '@/components/dashboard/RevenueTrendChart';
import { CO2SavingsChart } from '@/components/dashboard/CO2SavingsChart';
import { StationUtilizationChart } from '@/components/dashboard/StationUtilizationChart';
import { FaultTrendChart } from '@/components/dashboard/FaultTrendChart';
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
      
      <div className="flex-1 p-5 lg:p-8 space-y-7">
        {/* KPI Cards — asymmetric priority grid */}
        <KPICards />
        
        {/* EV Insight Banners */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <EVBannerCards />
        </div>
        
        {/* Primary Charts — Revenue Trend (wide) + CO2 Donut */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-8">
            <RevenueTrendChart />
          </div>
          <div className="lg:col-span-4">
            <CO2SavingsChart />
          </div>
        </div>

        {/* Energy + Revenue per Station */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-7">
            <EnergyUsageChart />
          </div>
          <div className="lg:col-span-5">
            <RevenuePerStationChart />
          </div>
        </div>

        {/* Station Utilization + Fault Trend */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-7">
            <StationUtilizationChart />
          </div>
          <div className="lg:col-span-5">
            <FaultTrendChart />
          </div>
        </div>
        
        {/* Activity — sessions wider, alerts narrower */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
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
