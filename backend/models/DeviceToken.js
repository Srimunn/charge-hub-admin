import mongoose from "mongoose";

const deviceTokenSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    deviceToken: { type: String, required: true, unique: true },
    platform: { type: String, default: "android" },
    appVersion: { type: String, default: "1.0.0" }
}, { 
    collection: "deviceTokens",
    timestamps: true
});

export default mongoose.model("DeviceToken", deviceTokenSchema);
