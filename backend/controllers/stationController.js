import Station from '../models/Station.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const STATIONS_FILE = path.join(__dirname, '../data/stations.json');

const readMockStations = () => {
    try {
        if (!fs.existsSync(STATIONS_FILE)) return [];
        return JSON.parse(fs.readFileSync(STATIONS_FILE, 'utf8'));
    } catch (err) {
        console.error("Error reading mock stations:", err);
        return [];
    }
};

const writeMockStations = (stations) => {
    try {
        fs.writeFileSync(STATIONS_FILE, JSON.stringify(stations, null, 2));
    } catch (err) {
        console.error("Error writing mock stations:", err);
    }
};

// Helper: generate unique 8-digit station number
const generateStationNumber = async (pinPrefix) => {
    let isUnique = false;
    let stationNumber = "";
    
    while (!isUnique) {
        // Generate 5 random digits
        const randomDigits = Math.floor(10000 + Math.random() * 90000).toString();
        stationNumber = `${pinPrefix}${randomDigits}`;
        
        // Check if it exists
        const existingStation = await Station.findOne({ stationNumber });
        if (!existingStation) {
            isUnique = true;
        }
    }
    
    return stationNumber;
};

// @desc    Get all stations
// @route   GET /api/stations
// @access  Public
export const getStations = async (req, res) => {
    try {
        const isDbConnected = Station.db.readyState === 1;
        if (isDbConnected) {
            const stations = await Station.find({});
            res.status(200).json(stations);
        } else {
            // Only return user-added mock stations from file, removed default mock stations
            const mockStationStore = readMockStations();
            console.log(`📡 Serving ${mockStationStore.length} mock stations from file`);
            res.status(200).json(mockStationStore);
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// @desc    Debug: Get all stations stored in mock store
// @route   GET /api/debug/stations
// @access  Public
export const getDebugStations = async (req, res) => {
    try {
        const isDbConnected = Station.db.readyState === 1;
        if (isDbConnected) {
            const dbStations = await Station.find({});
            // If you want to show ONLY DB stations:
            // res.json(dbStations);
            // If you want to show BOTH DB and Mock stations (combined):
            const mockStations = readMockStations();
            const combined = [...dbStations, ...mockStations];
            res.json(combined);
        } else {
            const mockStationStore = readMockStations();
            res.json(mockStationStore);
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// @desc    Create station with optional Cloudinary image upload
// @route   POST /api/stations
// @access  Private
export const setStation = async (req, res) => {
    try {
        const { name, location, powerOutput, status, ports, connectorType, basePricePerKwh, dynamicPricing, convenienceFee, tax, districtPin, latitude, longitude, district } = req.body;
        console.log('📦 Incoming station data:', { name, location, latitude, longitude, powerOutput, ports, districtPin });
        console.log('📷 File received:', req.file ? req.file.originalname : 'none');
        
        const isDbConnected = Station.db.readyState === 1;

        let parsedDynamicPricing = [];
        if (dynamicPricing) {
            try {
                parsedDynamicPricing = JSON.parse(dynamicPricing);
            } catch (error) {
                console.error('❌ Error parsing dynamicPricing:', error);
            }
        }
        
        let convFee = Number(convenienceFee) || 0;
        if (convFee && (convFee < 2 || convFee > 5)) {
            return res.status(400).json({ error: "Convenience fee must be between ₹2 and ₹5" });
        }

        let imageUrl = '';
        if (req.file) {
            // Store relative path to be served statically
            imageUrl = `/uploads/${req.file.filename}`;
            console.log('📷 Image saved locally:', imageUrl);
        }

        const pinPrefix = districtPin || "000";

        if (isDbConnected) {
            const stationNumber = await generateStationNumber(pinPrefix);
            const station = new Station({
                stationNumber,
                name,
                location,
                district,
                latitude: latitude ? Number(latitude) : undefined,
                longitude: longitude ? Number(longitude) : undefined,
                powerOutput: Number(powerOutput) || 0,
                ports: Number(ports) || 1,
                connectorType: connectorType || 'Type 2',
                image: imageUrl,
                status: status || 'online',
                userId: req.user.id,
                basePricePerKwh: Number(basePricePerKwh) || 0,
                dynamicPricing: parsedDynamicPricing,
                convenienceFee: convFee,
                tax: Number(tax) || 0,
            });

            await station.save();
            console.log('✅ Station saved to MongoDB:', station._id);
            res.status(201).json(station);
        } else {
            // Mock mode: Save to file persistence
            const stationNumber = `${pinPrefix}${Math.floor(10000 + Math.random() * 90000)}`;
            const mockStationStore = readMockStations();
            const newStation = {
                _id: Date.now().toString(),
                stationNumber,
                name,
                location,
                powerOutput: Number(powerOutput) || 0,
                ports: Number(ports) || 1,
                image: imageUrl || "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgdmlld0JveD0iMCAwIDUxMiA1MTIiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSI1MTIiIGhlaWdodD0iNTEyIiByeD0iMjU2IiBmaWxsPSJ1cmwoI3BhaW50MF9saW5lYXJfMTI4XzIpIi8+CjxwYXRoIGQ9Ik0zMzYuNSA5NkgxNzUuNUMxNTguMTAxIDk2IDE0NCAxMTAuMTAxIDE0NCAxMjcuNVYzODQuNUMxNDQgNDAxLjg5OSAxNTguMTAxIDQxNiAxNzUuNSA0MTZIMzM2LjVDMzUzLjg5OSA0MTYgMzY4IDQwMS44OTkgMzY4IDM4NC41VjEyNy41QzM2OCAxMTAuMTAxIDM1My44OTkgOTYgMzM2LjUgOTZaIiBmaWxsPSJ3aGl0ZSIvPgo8cGF0aCBkPSJNMjU2IDIzMkwyMjQgMjg4SDI1NkwyMjQgMzQ0TDI4OCAyNTZIMjU2TDI4OCAyMzJMMjU2IDIzMlowIiBmaWxsPSIjMDBBQkZGIi8+CjxwYXRoIGQ9Ik0zODQgMTYwQzQwMi4xMDQgMTYwIDQxNiAxNzQuMjk2IDQxNiAxOTJWMjU2QzQxNiAyODMuNjE0IDQwNC44MDcgMzA4LjYwNyAzODYuNjY3IDMyNi43NzJDMzcwLjE1NCAzNDMuMzA3IDM1My4zMzMgMzUyIDMzNiAzNTJWMzIwQzM0Ny4zMzMgMzIwIDM1OC4xNTQgMzEzLjMwNyAzNjkuNjY3IDI5OS43NzJDMzgwLjgwNyAyODUuNjA3IDM4NCAyNjcuNjE0IDM4NCAyNTZWMzkyQzM4NCAxODUuMjk2IDM3OS4xMDQgMTgwIDM2OCAxODBWMTYwSDM4NFpNMzg0IDE5MkgyODhWMTYwSDM4NFYxOTJaIiBmaWxsPSJ3aGl0ZSIvPgo8ZGVmaW5zPgo8bGluZWFyR3JhZGllbnQgaWQ9InBhaW50MF9saW5lYXJfMTI4XzIiIHgxPSIyNTYiIHkxPSIwIiB4Mj0iMjU2IiB5Mj0iNTEyIiBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+CjxzdG9wIHN0b3AtY29sb3I9IiMwMEQxRkYiLz4KPHN0b3Agb2Zmc2V0PSIxIiBzdG9wLWNvbG9yPSIjMDA2NkZGIi8+CjwvbGluZWFyR3JhZGllbnQ+CjwvZGVmaW5zPgo8L3N2Zz4K",
                status: status || 'online',
                userId: req.user.id,
                basePricePerKwh: Number(basePricePerKwh) || 0,
                dynamicPricing: parsedDynamicPricing,
                convenienceFee: convFee,
                tax: Number(tax) || 0,
                createdAt: new Date()
            };
            mockStationStore.push(newStation);
            writeMockStations(mockStationStore);
            console.log('✅ Station saved to Mock Store (Persistent JSON)');
            res.status(201).json(newStation);
        }
    } catch (err) {
        console.error('❌ setStation error:', err.message);
        res.status(500).json({ error: err.message });
    }
};

// @desc    Update station
// @route   PUT /api/stations/:id
// @access  Private
export const updateStation = async (req, res) => {
    try {
        const { name, location, powerOutput, status, ports, connectorType, basePricePerKwh, dynamicPricing, convenienceFee, tax, latitude, longitude, district } = req.body;
        const station = await Station.findById(req.params.id);

        if (!station) {
            return res.status(404).json({ error: "Station not found" });
        }

        let imageUrl = station.image;

        if (req.file) {
            imageUrl = `/uploads/${req.file.filename}`;
            console.log('📷 Image updated locally:', imageUrl);
        }

        let parsedDynamicPricing = station.dynamicPricing;
        if (dynamicPricing) {
            try {
                parsedDynamicPricing = JSON.parse(dynamicPricing);
            } catch (error) {
                console.error('❌ Error parsing dynamicPricing:', error);
            }
        }

        station.name = name || station.name;
        station.location = location || station.location;
        if (district) station.district = district;
        if (latitude) station.latitude = Number(latitude);
        if (longitude) station.longitude = Number(longitude);
        station.powerOutput = powerOutput ? Number(powerOutput) : station.powerOutput;
        station.status = status || station.status;
        station.ports = ports ? Number(ports) : station.ports;
        station.connectorType = connectorType || station.connectorType;
        station.image = imageUrl;
        station.basePricePerKwh = basePricePerKwh ? Number(basePricePerKwh) : station.basePricePerKwh;
        station.dynamicPricing = parsedDynamicPricing;
        station.convenienceFee = convenienceFee ? Number(convenienceFee) : station.convenienceFee;
        station.tax = tax ? Number(tax) : station.tax;

        const updatedStation = await station.save();
        res.status(200).json(updatedStation);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// @desc    Delete station
// @route   DELETE /api/stations/:id
// @access  Private
export const deleteStation = async (req, res) => {
    try {
        const station = await Station.findById(req.params.id);

        if (!station) {
            return res.status(404).json({ error: "Station not found" });
        }

        await station.deleteOne();

        res.status(200).json({ message: "Station removed" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// @desc    Search stations
// @route   GET /api/stations/search?query=
// @access  Public
export const searchStations = async (req, res) => {
    try {
        const { query } = req.query;
        if (!query) {
            return res.status(400).json({ error: "Search query is required" });
        }
        
        const isDbConnected = Station.db.readyState === 1;
        if (!isDbConnected) {
            // Mock fallback
            const mockStations = readMockStations();
            const lowerQuery = query.toLowerCase();
            const results = mockStations.filter(s => 
                (s.name && s.name.toLowerCase().includes(lowerQuery)) ||
                (s.location && s.location.toLowerCase().includes(lowerQuery)) ||
                (s.district && s.district.toLowerCase().includes(lowerQuery))
            );
            return res.status(200).json(results);
        }

        const regex = new RegExp(query, 'i');
        const stations = await Station.find({
            $or: [
                { name: regex },
                { location: regex },
                { district: regex }
            ]
        });

        res.status(200).json(stations);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
