// Mock data for EV Charging Station Dashboard

export interface Station {
  id: string;
  name: string;
  location: string;
  status: 'online' | 'offline' | 'maintenance';
  health: number;
  lastUpdate: Date;
  coilStatus: 'operational' | 'degraded' | 'fault';
  sensorStatus: 'operational' | 'degraded' | 'fault';
  powerElectronicsStatus: 'operational' | 'degraded' | 'fault';
  temperature: number;
  firmwareVersion: string;
  totalEnergy: number;
  totalRevenue: number;
}

export interface ChargingSession {
  id: string;
  stationId: string;
  vehicleId: string;
  userId: string;
  batterySOC: number;
  chargingPower: number;
  duration: number;
  revenue: number;
  startTime: Date;
  status: 'active' | 'completed' | 'interrupted';
}

export interface Alert {
  id: string;
  stationId: string;
  type: 'overheating' | 'misalignment' | 'foreign_object' | 'power_fault' | 'communication_loss';
  severity: 'high' | 'medium' | 'low';
  message: string;
  timestamp: Date;
  acknowledged: boolean;
  technicianDispatched: boolean;
}

export interface User {
  id: string;
  name: string;
  email: string;
  type: 'individual' | 'fleet';
  registeredAt: Date;
  totalSessions: number;
  totalSpent: number;
  status: 'active' | 'blocked';
  usageLimit?: number;
}

export interface Tariff {
  id: string;
  name: string;
  pricePerKwh: number;
  pricePerMinute: number;
  peakMultiplier: number;
  offPeakMultiplier: number;
  fleetDiscount: number;
  isActive: boolean;
}

// Generate mock stations
export const mockStations: Station[] = [
  {
    id: 'STN-001',
    name: 'Downtown Plaza Station',
    location: 'Downtown Plaza, Building A',
    status: 'online',
    health: 98,
    lastUpdate: new Date(),
    coilStatus: 'operational',
    sensorStatus: 'operational',
    powerElectronicsStatus: 'operational',
    temperature: 42,
    firmwareVersion: '2.4.1',
    totalEnergy: 15420,
    totalRevenue: 4626,
  },
  {
    id: 'STN-002',
    name: 'Mall Parking Level 2',
    location: 'Central Mall, P2-A15',
    status: 'online',
    health: 95,
    lastUpdate: new Date(),
    coilStatus: 'operational',
    sensorStatus: 'degraded',
    powerElectronicsStatus: 'operational',
    temperature: 38,
    firmwareVersion: '2.4.1',
    totalEnergy: 12300,
    totalRevenue: 3690,
  },
  {
    id: 'STN-003',
    name: 'Airport Terminal 1',
    location: 'International Airport, T1-G3',
    status: 'online',
    health: 100,
    lastUpdate: new Date(),
    coilStatus: 'operational',
    sensorStatus: 'operational',
    powerElectronicsStatus: 'operational',
    temperature: 35,
    firmwareVersion: '2.4.2',
    totalEnergy: 28500,
    totalRevenue: 8550,
  },
  {
    id: 'STN-004',
    name: 'Office Park Station',
    location: 'Tech Park, Building C',
    status: 'maintenance',
    health: 72,
    lastUpdate: new Date(Date.now() - 3600000),
    coilStatus: 'degraded',
    sensorStatus: 'operational',
    powerElectronicsStatus: 'fault',
    temperature: 55,
    firmwareVersion: '2.3.8',
    totalEnergy: 8900,
    totalRevenue: 2670,
  },
  {
    id: 'STN-005',
    name: 'Hospital Visitor Lot',
    location: 'City Hospital, Lot B',
    status: 'online',
    health: 92,
    lastUpdate: new Date(),
    coilStatus: 'operational',
    sensorStatus: 'operational',
    powerElectronicsStatus: 'operational',
    temperature: 40,
    firmwareVersion: '2.4.1',
    totalEnergy: 9800,
    totalRevenue: 2940,
  },
  {
    id: 'STN-006',
    name: 'University Campus',
    location: 'State University, Lot D',
    status: 'offline',
    health: 0,
    lastUpdate: new Date(Date.now() - 7200000),
    coilStatus: 'fault',
    sensorStatus: 'fault',
    powerElectronicsStatus: 'fault',
    temperature: 0,
    firmwareVersion: '2.3.5',
    totalEnergy: 5600,
    totalRevenue: 1680,
  },
  {
    id: 'STN-007',
    name: 'Shopping Center East',
    location: 'East Mall, Level P1',
    status: 'online',
    health: 88,
    lastUpdate: new Date(),
    coilStatus: 'operational',
    sensorStatus: 'operational',
    powerElectronicsStatus: 'degraded',
    temperature: 48,
    firmwareVersion: '2.4.0',
    totalEnergy: 11200,
    totalRevenue: 3360,
  },
  {
    id: 'STN-008',
    name: 'Convention Center',
    location: 'Convention Center, Hall A',
    status: 'online',
    health: 99,
    lastUpdate: new Date(),
    coilStatus: 'operational',
    sensorStatus: 'operational',
    powerElectronicsStatus: 'operational',
    temperature: 36,
    firmwareVersion: '2.4.2',
    totalEnergy: 18700,
    totalRevenue: 5610,
  },
];

// Generate mock charging sessions
export const mockChargingSessions: ChargingSession[] = [
  {
    id: 'SES-001',
    stationId: 'STN-001',
    vehicleId: 'VEH-Tesla-M3-1234',
    userId: 'USR-001',
    batterySOC: 67,
    chargingPower: 11.2,
    duration: 45,
    revenue: 12.50,
    startTime: new Date(Date.now() - 2700000),
    status: 'active',
  },
  {
    id: 'SES-002',
    stationId: 'STN-002',
    vehicleId: 'VEH-BMW-i4-5678',
    userId: 'USR-003',
    batterySOC: 82,
    chargingPower: 7.4,
    duration: 62,
    revenue: 18.20,
    startTime: new Date(Date.now() - 3720000),
    status: 'active',
  },
  {
    id: 'SES-003',
    stationId: 'STN-003',
    vehicleId: 'VEH-Audi-Q4-9012',
    userId: 'USR-005',
    batterySOC: 45,
    chargingPower: 11.0,
    duration: 28,
    revenue: 8.40,
    startTime: new Date(Date.now() - 1680000),
    status: 'active',
  },
  {
    id: 'SES-004',
    stationId: 'STN-005',
    vehicleId: 'VEH-Mercedes-EQS-3456',
    userId: 'USR-008',
    batterySOC: 91,
    chargingPower: 3.2,
    duration: 95,
    revenue: 28.50,
    startTime: new Date(Date.now() - 5700000),
    status: 'active',
  },
  {
    id: 'SES-005',
    stationId: 'STN-007',
    vehicleId: 'VEH-Porsche-Taycan-7890',
    userId: 'USR-012',
    batterySOC: 55,
    chargingPower: 9.8,
    duration: 38,
    revenue: 11.40,
    startTime: new Date(Date.now() - 2280000),
    status: 'active',
  },
  {
    id: 'SES-006',
    stationId: 'STN-008',
    vehicleId: 'VEH-Rivian-R1T-2345',
    userId: 'USR-015',
    batterySOC: 73,
    chargingPower: 10.5,
    duration: 52,
    revenue: 15.60,
    startTime: new Date(Date.now() - 3120000),
    status: 'active',
  },
];

// Generate mock alerts
export const mockAlerts: Alert[] = [
  {
    id: 'ALT-001',
    stationId: 'STN-004',
    type: 'overheating',
    severity: 'high',
    message: 'Power electronics temperature exceeds safe threshold (55°C)',
    timestamp: new Date(Date.now() - 1800000),
    acknowledged: false,
    technicianDispatched: false,
  },
  {
    id: 'ALT-002',
    stationId: 'STN-006',
    type: 'communication_loss',
    severity: 'high',
    message: 'Station communication lost for over 2 hours',
    timestamp: new Date(Date.now() - 7200000),
    acknowledged: true,
    technicianDispatched: true,
  },
  {
    id: 'ALT-003',
    stationId: 'STN-002',
    type: 'misalignment',
    severity: 'medium',
    message: 'Vehicle alignment sensor detecting suboptimal positioning',
    timestamp: new Date(Date.now() - 900000),
    acknowledged: false,
    technicianDispatched: false,
  },
  {
    id: 'ALT-004',
    stationId: 'STN-007',
    type: 'foreign_object',
    severity: 'medium',
    message: 'Foreign object detected on charging pad surface',
    timestamp: new Date(Date.now() - 3600000),
    acknowledged: true,
    technicianDispatched: false,
  },
  {
    id: 'ALT-005',
    stationId: 'STN-004',
    type: 'power_fault',
    severity: 'high',
    message: 'Power electronics module reporting fault code PE-42',
    timestamp: new Date(Date.now() - 1200000),
    acknowledged: false,
    technicianDispatched: false,
  },
];

// Generate mock users
export const mockUsers: User[] = [
  {
    id: 'USR-001',
    name: 'John Anderson',
    email: 'john.anderson@email.com',
    type: 'individual',
    registeredAt: new Date('2024-01-15'),
    totalSessions: 45,
    totalSpent: 234.50,
    status: 'active',
  },
  {
    id: 'USR-002',
    name: 'Metro Fleet Services',
    email: 'admin@metrofleet.com',
    type: 'fleet',
    registeredAt: new Date('2023-08-20'),
    totalSessions: 328,
    totalSpent: 4520.80,
    status: 'active',
    usageLimit: 10000,
  },
  {
    id: 'USR-003',
    name: 'Sarah Mitchell',
    email: 'sarah.m@email.com',
    type: 'individual',
    registeredAt: new Date('2024-03-10'),
    totalSessions: 28,
    totalSpent: 156.20,
    status: 'active',
  },
  {
    id: 'USR-004',
    name: 'Green Taxi Co.',
    email: 'ops@greentaxi.com',
    type: 'fleet',
    registeredAt: new Date('2023-11-05'),
    totalSessions: 892,
    totalSpent: 12450.60,
    status: 'active',
    usageLimit: 25000,
  },
  {
    id: 'USR-005',
    name: 'Michael Chen',
    email: 'mchen@email.com',
    type: 'individual',
    registeredAt: new Date('2024-02-28'),
    totalSessions: 62,
    totalSpent: 385.40,
    status: 'active',
  },
  {
    id: 'USR-006',
    name: 'City Delivery Services',
    email: 'contact@citydelivery.com',
    type: 'fleet',
    registeredAt: new Date('2024-01-02'),
    totalSessions: 156,
    totalSpent: 2340.00,
    status: 'blocked',
    usageLimit: 5000,
  },
];

// Generate mock tariffs
export const mockTariffs: Tariff[] = [
  {
    id: 'TAR-001',
    name: 'Standard Rate',
    pricePerKwh: 0.30,
    pricePerMinute: 0.05,
    peakMultiplier: 1.5,
    offPeakMultiplier: 0.8,
    fleetDiscount: 0,
    isActive: true,
  },
  {
    id: 'TAR-002',
    name: 'Fleet Rate',
    pricePerKwh: 0.25,
    pricePerMinute: 0.04,
    peakMultiplier: 1.3,
    offPeakMultiplier: 0.7,
    fleetDiscount: 15,
    isActive: true,
  },
  {
    id: 'TAR-003',
    name: 'Premium Fast Charge',
    pricePerKwh: 0.45,
    pricePerMinute: 0.08,
    peakMultiplier: 1.2,
    offPeakMultiplier: 1.0,
    fleetDiscount: 10,
    isActive: true,
  },
];

// Energy usage data for charts
export const energyUsageData = [
  { time: '00:00', usage: 45 },
  { time: '02:00', usage: 32 },
  { time: '04:00', usage: 28 },
  { time: '06:00', usage: 65 },
  { time: '08:00', usage: 142 },
  { time: '10:00', usage: 185 },
  { time: '12:00', usage: 168 },
  { time: '14:00', usage: 195 },
  { time: '16:00', usage: 220 },
  { time: '18:00', usage: 245 },
  { time: '20:00', usage: 178 },
  { time: '22:00', usage: 95 },
];

// Revenue per station data
export const revenuePerStationData = mockStations.map(station => ({
  station: station.id,
  name: station.name.split(' ')[0],
  revenue: station.totalRevenue,
}));

// Monthly revenue data
export const monthlyRevenueData = [
  { month: 'Jan', revenue: 18500 },
  { month: 'Feb', revenue: 22300 },
  { month: 'Mar', revenue: 25800 },
  { month: 'Apr', revenue: 28400 },
  { month: 'May', revenue: 31200 },
  { month: 'Jun', revenue: 29800 },
];

// Daily energy consumption data
export const dailyEnergyData = [
  { day: 'Mon', energy: 1850 },
  { day: 'Tue', energy: 2120 },
  { day: 'Wed', energy: 1980 },
  { day: 'Thu', energy: 2340 },
  { day: 'Fri', energy: 2580 },
  { day: 'Sat', energy: 2890 },
  { day: 'Sun', energy: 2450 },
];

// Station utilization data
export const stationUtilizationData = mockStations.map(station => ({
  station: station.id,
  name: station.name.split(' ')[0],
  utilization: Math.floor(Math.random() * 40) + 50,
}));
