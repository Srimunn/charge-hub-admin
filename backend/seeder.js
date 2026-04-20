import mongoose from "mongoose";
import dotenv from "dotenv";
import Station from "./models/Station.js";
import Session from "./models/Session.js";
import User from "./models/User.js";
import Fault from "./models/Fault.js";

dotenv.config({ path: "./.env" });

const mockStations = [
  { name: 'Downtown Plaza Station', location: 'Downtown Plaza, Building A', status: 'online', slots: 4, totalEnergy: 15420, revenue: 4626 },
  { name: 'Mall Parking Level 2', location: 'Central Mall', status: 'online', slots: 6, totalEnergy: 12300, revenue: 3690 },
  { name: 'Airport Terminal 1', location: 'Airport T1-G3', status: 'online', slots: 10, totalEnergy: 28500, revenue: 8550 },
  { name: 'Office Park Station', location: 'Tech Park', status: 'maintenance', slots: 2, totalEnergy: 8900, revenue: 2670 },
  { name: 'Hospital Visitor Lot', location: 'City Hospital', status: 'online', slots: 5, totalEnergy: 9800, revenue: 2940 },
  { name: 'University Campus', location: 'State University', status: 'offline', slots: 4, totalEnergy: 5600, revenue: 1680 }
];

const mockUsers = [
  { name: 'John Anderson', email: 'john@email.com', role: 'user' },
  { name: 'Sarah Mitchell', email: 'sarah@email.com', role: 'user' }
];

const mockFaults = [
  { type: 'overheating', description: 'Power electronics temperature exceeds safe threshold', severity: 'high', status: 'open', detectedAt: new Date(Date.now() - 1800000) },
  { type: 'communication_loss', description: 'Station communication lost for over 2 hours', severity: 'high', status: 'resolved', detectedAt: new Date(Date.now() - 7200000) },
  { type: 'misalignment', description: 'Vehicle alignment sensor detecting suboptimal positioning', severity: 'medium', status: 'open', detectedAt: new Date(Date.now() - 900000) }
];

const seedDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB Connected for Seeding.");

    // Clear existing
    await Station.deleteMany();
    await Session.deleteMany();
    await User.deleteMany();
    await Fault.deleteMany();

    // Insert Users
    const createdUsers = await User.insertMany(mockUsers);
    
    // Insert Stations
    const createdStations = await Station.insertMany(mockStations);

    // Insert Sessions
    const mockSessions = [
      { userId: createdUsers[0]._id, stationId: createdStations[0]._id, energyUsed: 45, cost: 12.50, status: 'active', startTime: new Date(Date.now() - 2700000) },
      { userId: createdUsers[1]._id, stationId: createdStations[1]._id, energyUsed: 62, cost: 18.20, status: 'active', startTime: new Date(Date.now() - 3720000) },
      { userId: createdUsers[0]._id, stationId: createdStations[4]._id, energyUsed: 28, cost: 8.40, status: 'completed', startTime: new Date(Date.now() - 86400000), endTime: new Date(Date.now() - 82800000) }
    ];
    await Session.insertMany(mockSessions);

    // Insert Faults (map to station)
    mockFaults[0].stationId = createdStations[3]._id;
    mockFaults[1].stationId = createdStations[5]._id;
    mockFaults[2].stationId = createdStations[1]._id;
    await Fault.insertMany(mockFaults);

    console.log("Database Seeded Successfully!");
    process.exit();
  } catch (error) {
    console.error("Error Seeding Database:", error);
    process.exit(1);
  }
};

seedDB();
