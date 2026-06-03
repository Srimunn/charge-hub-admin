import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const generateToken = (id) => {
    if (!process.env.JWT_SECRET) {
        throw new Error('JWT_SECRET is not set in environment variables');
    }
    return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '7d' });
};

// Global mock memory for OTPs (in real prod, use Redis)
const otpStore = new Map();

export const registerUser = async (req, res) => {
    try {
        console.log('📥 INBOUND REQUEST: POST /auth/register', { ...req.body, password: '***' });
        const { name, email, password, mobile } = req.body;

        if (!name || !email || !password || !mobile) {
            return res.status(400).json({ error: "Please add all fields" });
        }

        if (password.length !== 6 || !/^\d+$/.test(password)) {
            return res.status(400).json({ error: "PIN must be exactly 6 digits" });
        }

        const userExists = await User.findOne({ $or: [{ email }, { mobile }] });
        if (userExists) {
            return res.status(400).json({ error: "User already exists with this email or mobile" });
        }

        const user = new User({ name, email, password, mobile });
        await user.save();

        // Set mock OTP in otpStore for the verification step
        otpStore.set(email, {
            otp: "123456",
            userId: user._id,
            type: "register"
        });

        return res.status(201).json({ 
            message: "Registration successful. You can now login.",
            user: { id: user._id, name: user.name, email: user.email, mobile: user.mobile }
        });
    } catch (err) {
        console.error("Register Error:", err);
        res.status(500).json({ error: err.message });
    }
};

export const loginUser = async (req, res) => {
    try {
        console.log('📥 INBOUND REQUEST: POST /auth/login', { email: req.body.email, password: '***' });
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        if (user && (await user.comparePassword(password))) {
            const generatedToken = generateToken(user._id);
            console.log('🔐 Generated JWT token:', generatedToken);
            return res.status(200).json({
                _id: user._id, name: user.name, email: user.email, mobile: user.mobile,
                token: generatedToken,
            });
        }
        res.status(400).json({ error: "Invalid credentials" });
    } catch (err) {
        console.error("Login Error:", err);
        res.status(500).json({ error: err.message });
    }
};

export const verifyOTP = async (req, res) => {
    try {
        const { email, otp } = req.body;

        if (!email || !otp) return res.status(400).json({ error: "Email and OTP required" });

        const session = otpStore.get(email);
        if (!session) return res.status(400).json({ error: "OTP session expired or invalid" });

        if (session.otp !== otp) {
            return res.status(400).json({ error: "Incorrect OTP" });
        }

        // Successfully matched OTP
        const user = await User.findById(session.userId);
        if (!user) return res.status(404).json({ error: "User not found" });

        // Grant completely authorized JSON Response
        otpStore.delete(email); // Clean up used OTP
        
        console.log(`✅ User ${session.type} verified successfully`);
        res.json({
            _id: user._id,
            name: user.name,
            email: user.email,
            mobile: user.mobile,
            token: generateToken(user._id),
        });

    } catch (err) {
        console.error("OTP Verify Error:", err);
        res.status(500).json({ error: err.message });
    }
}
