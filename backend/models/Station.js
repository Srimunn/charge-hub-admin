import mongoose from "mongoose";

const stationSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    stationNumber: { type: String, unique: true, required: true },
    name: { type: String, required: true },
    location: { type: String, required: true },
    district: String,
    latitude: Number,
    longitude: Number,
    status: { type: String, default: "online" },
    ports: { type: Number, default: 1 },
    slots: Number,
    powerOutput: Number,
    connectorType: { type: String, default: "Type 2" },
    image: String,
    basePricePerKwh: { type: Number, default: 0 },
    dynamicPricing: [{
        startTime: String,
        endTime: String,
        pricePerKwh: Number
    }],
    convenienceFee: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    
    // Production/Real-time fields
    lastSeen: { type: Date },
    ocppConnected: { type: Boolean, default: false },
    ocpp: {
        vendor: String,
        model: String,
        firmwareVersion: String
    },
    connectors: [{
        connectorId: Number,
        status: String,
        errorCode: String,
        updatedAt: Date
    }],
    faultStatus: { type: String, default: "none" },
    totalEnergyConsumed: { type: Number, default: 0 },
    health: { type: String, default: "NORMAL" },
    lastResolvedAt: { type: Date },
    
    createdAt: { type: Date, default: Date.now }
}, {
    toJSON: {
        virtuals: true,
        transform: (doc, ret) => {
            ret.stationName = ret.name;
            ret.availabilityStatus = ret.status;
            return ret;
        }
    }
});

export default mongoose.model("Station", stationSchema);
