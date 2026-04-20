import mongoose from "mongoose";

const stationSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, required: true },
    location: { type: String, required: true },
    status: { type: String, default: "online" },
    ports: { type: Number, default: 1 },
    slots: Number,
    powerOutput: Number,
    image: String,
    basePricePerKwh: { type: Number, default: 0 },
    dynamicPricing: [{
        startTime: String,
        endTime: String,
        pricePerKwh: Number
    }],
    convenienceFee: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now }
});

export default mongoose.model("Station", stationSchema);