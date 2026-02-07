import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Stations from "./pages/Stations";
import StationDetail from "./pages/StationDetail";
import Sessions from "./pages/Sessions";
import Safety from "./pages/Safety";
import Pricing from "./pages/Pricing";
import Reports from "./pages/Reports";
import UsersPage from "./pages/Users";
import Settings from "./pages/Settings";
import FaultsAlerts from "./pages/FaultsAlerts";
import FaultDetail from "./pages/FaultDetail";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route element={<DashboardLayout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/stations" element={<Stations />} />
            <Route path="/stations/:stationId" element={<StationDetail />} />
            <Route path="/sessions" element={<Sessions />} />
            <Route path="/faults" element={<FaultsAlerts />} />
            <Route path="/faults/:faultId" element={<FaultDetail />} />
            <Route path="/safety" element={<Safety />} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/users" element={<UsersPage />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
