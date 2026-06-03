import Station from '../models/Station.js';

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
        const stations = await Station.find({ userId: req.user.id }).sort({ createdAt: -1 });
        res.status(200).json(stations);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// @desc    Get all stations (public for mobile app)
// @route   GET /api/stations/public
// @access  Public
export const getAllStationsPublic = async (req, res) => {
    try {
        const stations = await Station.find({}).sort({ createdAt: -1 });
        res.status(200).json(stations);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

export const getStationById = async (req, res) => {
    try {
        const station = await Station.findOne({ _id: req.params.id, userId: req.user.id });
        if (!station) return res.status(404).json({ error: "Station not found" });
        res.status(200).json(station);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

export const getStationByIdPublic = async (req, res) => {
    try {
        const station = await Station.findById(req.params.id);
        if (!station) return res.status(404).json({ error: "Station not found" });
        res.status(200).json(station);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// @desc    Debug: Get all stations stored in mock store
// @route   GET /api/debug/stations
// @access  Public
export const getDebugStations = async (req, res) => {
    try {
        const stations = await Station.find({}).sort({ createdAt: -1 });
        res.json(stations);
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
            status: status || 'offline',
            userId: req.user.id,
            basePricePerKwh: Number(basePricePerKwh) || 0,
            dynamicPricing: parsedDynamicPricing,
            convenienceFee: convFee,
            tax: Number(tax) || 0,
        });

        await station.save();
        res.status(201).json(station);
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
