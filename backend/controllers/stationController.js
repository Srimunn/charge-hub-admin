import Station from '../models/Station.js';
import cloudinary from '../config/cloudinary.js';

// Helper: upload buffer to Cloudinary using upload_stream
const uploadToCloudinary = (buffer, filename) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: 'ev-stations',
        public_id: `station_${Date.now()}`,
        resource_type: 'image',
      },
      (error, result) => {
        if (error) {
          console.error('❌ Cloudinary upload error:', error);
          reject(error);
        } else {
          console.log('✅ Image uploaded to Cloudinary:', result.secure_url);
          resolve(result);
        }
      }
    );
    stream.end(buffer);
  });
};

// @desc    Get logged in user stations
// @route   GET /api/stations
// @access  Private
export const getStations = async (req, res) => {
    try {
        const stations = await Station.find({ userId: req.user.id });
        res.status(200).json(stations);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// @desc    Create station with optional Cloudinary image upload
// @route   POST /api/stations
// @access  Private
export const setStation = async (req, res) => {
    try {
        const { name, location, powerOutput, status, ports, basePricePerKwh, dynamicPricing, convenienceFee, tax } = req.body;
        console.log('📦 Incoming station data:', { name, location, powerOutput, ports });
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

        // If a file was uploaded via multer, push it to Cloudinary
        if (req.file) {
            const result = await uploadToCloudinary(req.file.buffer, req.file.originalname);
            imageUrl = result.secure_url;
        }

        const station = new Station({
            name,
            location,
            powerOutput: Number(powerOutput) || 0,
            ports: Number(ports) || 1,
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
    } catch (err) {
        console.error('❌ setStation error:', err.message);
        res.status(500).json({ error: err.message });
    }
};
