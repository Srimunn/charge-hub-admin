import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: false },
    mobile: { type: String, required: false, unique: true, sparse: true },
    googleId: { type: String, unique: true, sparse: true },
    authProvider: { type: String, enum: ["local", "google"], default: "local" },
    vehicleType: String,
    sessionTimeout: { type: Number, default: 30 },
    operatorId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    fcmToken: { type: String, default: "" },
    notificationPreferences: {
        emailAlerts: { type: Boolean, default: true },
        smsAlerts: { type: Boolean, default: false },
        pushAlerts: { type: Boolean, default: true },
        faultAlerts: { type: Boolean, default: true },
        paymentAlerts: { type: Boolean, default: true }
    },
    createdAt: { type: Date, default: Date.now }
});

// Hash password before saving
userSchema.pre("save", async function() {
    if (!this.password || !this.isModified("password")) return;
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
    if (!this.password) return false;
    return await bcrypt.compare(candidatePassword, this.password);
};

export default mongoose.model("User", userSchema);