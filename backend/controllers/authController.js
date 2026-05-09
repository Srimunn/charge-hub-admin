import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const USERS_FILE = path.join(__dirname, '../data/users.json');

const readMockUsers = () => {
    try {
        if (!fs.existsSync(USERS_FILE)) return [];
        return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    } catch (err) {
        console.error("Error reading mock users:", err);
        return [];
    }
};

const writeMockUsers = (users) => {
    try {
        fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
    } catch (err) {
        console.error("Error writing mock users:", err);
    }
};

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

        if (password.length !== 6 || !/^\d+$/.test(password)) {
            return res.status(400).json({ error: "PIN must be exactly 6 digits" });
        }

        // Check if DB is connected
        const isDbConnected = User.db.readyState === 1;

        if (isDbConnected) {
            const userExists = await User.findOne({ $or: [{ email }, { mobile }] });
            if (userExists) {
                return res.status(400).json({ error: "User already exists with this email or mobile" });
            }

            const user = new User({ name, email, password, mobile });
            await user.save();

            return res.status(201).json({ 
                message: "Registration successful. You can now login.",
                user: { id: user._id, name: user.name, email: user.email, mobile: user.mobile }
            });
        } else {
            // Mock mode registration with file persistence
            const mockUsers = readMockUsers();
            const userExists = mockUsers.find(u => u.email === email || u.mobile === mobile);
            if (userExists) {
                return res.status(400).json({ error: "User already exists in mock mode" });
            }

            const newUser = { _id: Date.now().toString(), name, email, password, mobile };
            mockUsers.push(newUser);
            writeMockUsers(mockUsers);
            console.log(`✅ User registered (MOCK PERSISTENT): ${email}`);

            return res.status(201).json({ 
                message: "Registration successful. You can now login.",
                user: { id: newUser._id, name: newUser.name, email: newUser.email, mobile: newUser.mobile }
            });
        }
    } catch (err) {
        console.error("Register Error:", err);
        res.status(500).json({ error: err.message });
    }
};

export const loginUser = async (req, res) => {
    try {
        const { email, password } = req.body;
        const isDbConnected = User.db.readyState === 1;

        if (isDbConnected) {
            const user = await User.findOne({ email });
            if (user && (await user.comparePassword(password))) {
                return res.status(200).json({
                    _id: user._id, name: user.name, email: user.email, mobile: user.mobile,
                    token: generateToken(user._id),
                });
            }
        } else {
            // Mock mode login with file persistence
            const mockUsers = readMockUsers();
            const user = mockUsers.find(u => u.email === email && u.password === password);
            if (user) {
                return res.status(200).json({
                    _id: user._id, name: user.name, email: user.email, mobile: user.mobile,
                    token: generateToken(user._id),
                });
            }
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
