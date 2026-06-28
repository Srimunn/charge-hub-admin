import { OAuth2Client } from 'google-auth-library';
import User from '../models/User.js';
import { generateToken } from './authController.js';

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export const googleAuth = async (req, res) => {
    try {
        const { idToken } = req.body;
        if (!idToken) {
            return res.status(400).json({ error: "Google ID Token is required" });
        }

        const ticket = await client.verifyIdToken({
            idToken,
            audience: process.env.GOOGLE_CLIENT_ID,
        });
        const payload = ticket.getPayload();
        const { sub: googleId, email, name } = payload;

        if (!email) {
            return res.status(400).json({ error: "Email not provided by Google" });
        }

        // Find or create user
        let user = await User.findOne({ $or: [{ googleId }, { email }] });

        if (!user) {
            // Create new user
            user = new User({
                name,
                email,
                googleId,
                authProvider: 'google',
            });
            await user.save();
        } else {
            // If user exists but googleId is not linked yet (e.g. registered locally first)
            if (!user.googleId) {
                user.googleId = googleId;
                user.authProvider = 'google';
                await user.save();
            }
        }

        const token = generateToken(user._id);
        return res.status(200).json({
            _id: user._id,
            name: user.name,
            email: user.email,
            mobile: user.mobile || null,
            hasPin: !!user.password,
            hasMobile: !!user.mobile,
            hasProfileComplete: !!(user.mobile && user.password),
            token,
        });
    } catch (err) {
        console.error("Google Auth Error:", err);
        return res.status(500).json({ error: err.message });
    }
};

export const setPin = async (req, res) => {
    try {
        const { pin, mobile } = req.body;
        if (!pin) {
            return res.status(400).json({ error: "PIN is required" });
        }

        if (pin.length !== 6 || !/^\d+$/.test(pin)) {
            return res.status(400).json({ error: "PIN must be exactly 6 digits" });
        }

        if (!mobile) {
            return res.status(400).json({ error: "Mobile number is required" });
        }

        const user = await User.findById(req.user._id);
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        // Check if mobile number is already taken by another user
        const mobileExists = await User.findOne({ mobile, _id: { $ne: user._id } });
        if (mobileExists) {
            return res.status(400).json({ error: "Mobile number is already registered by another user" });
        }

        user.password = pin;
        user.mobile = mobile;
        await user.save();

        console.log(`✅ PIN and mobile set successfully for user ${user.email}`);
        return res.status(200).json({ message: "PIN and mobile registered successfully" });
    } catch (err) {
        console.error("Set PIN Error:", err);
        return res.status(500).json({ error: err.message });
    }
};
