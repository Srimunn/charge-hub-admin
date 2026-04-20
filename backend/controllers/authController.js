import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET || 'fallback_secret', { expiresIn: '7d' });
};

// Global mock memory for OTPs (in real prod, use Redis)
const otpStore = new Map();

export const registerUser = async (req, res) => {
    try {
        const { name, email, password, mobile } = req.body;

        if (!name || !email || !password || !mobile) {
            return res.status(400).json({ error: "Please add all fields" });
        }

        const userExists = await User.findOne({ $or: [{ email }, { mobile }] });
        if (userExists) {
            return res.status(400).json({ error: "User already exists with this email or mobile" });
        }

        const user = new User({ name, email, password, mobile });
        await user.save();

        // Simulate sending OTP (Mocked as 123456)
        const otp = "123456";
        otpStore.set(email, { otp, type: "register", userId: user._id });
        console.log(`📱 MOCK SMS -> To ${mobile} [Register]: Your OTP is ${otp}`);

        res.status(200).json({ message: "Registration initiated. OTP sent to mobile", email });
    } catch (err) {
        console.error("Register Error:", err);
        res.status(500).json({ error: err.message });
    }
};

export const loginUser = async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });

        if (user && (await user.comparePassword(password))) {
            // Direct login bypass for PIN
            console.log(`✅ User login authorized for ${email}`);
            res.status(200).json({
                _id: user._id,
                name: user.name,
                email: user.email,
                mobile: user.mobile,
                token: generateToken(user._id),
            });
        } else {
            res.status(400).json({ error: "Invalid credentials" });
        }
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
