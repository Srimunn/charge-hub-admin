import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { logEvent } from './auditLogController.js';
import { sendEmail, sendSMS } from "../services/notificationService.js";

export const generateToken = (id) => {
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

        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

        // Set OTP in otpStore for the verification step
        otpStore.set(email, {
            otp: otpCode,
            userId: user._id,
            type: "register",
            expiresAt: Date.now() + 5 * 60 * 1000,
            attempts: 0
        });

        console.log(`[OTP] Generated registration OTP for ${email}: ${otpCode}`);

        // Dispatch actual Email via Resend
        await sendEmail(
            email,
            "EV Charge - Security Code for Account Registration",
            `Welcome to EV Charge! Your account registration security code is: ${otpCode}. Valid for 5 minutes.`,
            `<div style="font-family: sans-serif; text-align: center; padding: 20px; max-width: 500px; margin: auto; border: 1px solid #eee; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
                <h3 style="color: #0f172a; font-size: 18px; font-weight: bold;">Welcome to EV Charge!</h3>
                <p style="color: #475569; font-size: 14px; margin-top: 10px;">Please use the security code below to complete your operator profile registration:</p>
                <div style="font-size: 32px; font-weight: bold; letter-spacing: 0.2em; margin: 24px 0; color: #3b82f6; background: #eff6ff; padding: 12px; rounded: 8px; border: 1px solid #dbeafe;">${otpCode}</div>
                <p style="color: #94a3b8; font-size: 12px; line-height: 1.5;">This registration security code will expire in 5 minutes. Do not share this OTP with anyone.</p>
             </div>`
        );

        // Dispatch actual SMS via MSG91
        if (mobile) {
            await sendSMS(mobile, `Welcome to EV Charge! Your account registration security OTP is ${otpCode}. Valid for 5 mins.`);
        }

        return res.status(201).json({ 
            message: "Registration successful. An OTP has been sent (Mock).",
            otp: otpCode,
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
        if (!email || !password) {
            return res.status(400).json({ error: "Please enter email/mobile and PIN" });
        }

        const identifier = email.trim();
        const user = await User.findOne({
            $or: [
                { email: identifier.toLowerCase() },
                { mobile: identifier }
            ]
        });

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

export const requestPasswordOTP = async (req, res) => {
    try {
        const email = req.user.email;
        
        // Rate-limiting check: 30 seconds
        const existingSession = otpStore.get(email);
        if (existingSession && existingSession.lastSentAt && (Date.now() - existingSession.lastSentAt) < 30 * 1000) {
            const timeRemaining = Math.ceil((30 * 1000 - (Date.now() - existingSession.lastSentAt)) / 1000);
            return res.status(400).json({ error: `Please wait ${timeRemaining} seconds before requesting a new OTP.` });
        }

        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
        
        otpStore.set(email, {
            otp: otpCode,
            userId: req.user._id,
            type: "change-password",
            expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes expiry
            attempts: 0,
            lastSentAt: Date.now(),
            verified: false
        });

        console.log(`[OTP] Generated password change OTP for ${email}: ${otpCode}`);
        
        // Dispatch actual Email via Resend
        await sendEmail(
            email,
            "EV Charge - Security Code for Password Change",
            `Your password change security code is: ${otpCode}. It will expire in 5 minutes.`,
            `<div style="font-family: sans-serif; text-align: center; padding: 20px; max-width: 500px; margin: auto; border: 1px solid #eee; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
                <h3 style="color: #0f172a;">EV Charge Security Verification</h3>
                <p style="color: #475569; font-size: 14px;">Your password change verification code is:</p>
                <div style="font-size: 32px; font-weight: bold; letter-spacing: 0.15em; margin: 24px 0; color: #ef4444; background: #fef2f2; padding: 12px; rounded: 8px; border: 1px solid #fee2e2;">${otpCode}</div>
                <p style="color: #94a3b8; font-size: 12px; line-height: 1.5;">This code is valid for 5 minutes. If you did not request this password reset, please secure your account immediately.</p>
             </div>`
        );

        // Dispatch actual SMS via MSG91
        if (req.user.mobile) {
            await sendSMS(req.user.mobile, `Your EV Charge password change security OTP is ${otpCode}. Valid for 5 mins.`);
        }
        
        await logEvent(req.user._id, "OTP Sent", req);

        res.status(200).json({ 
            message: "OTP sent successfully to your registered mobile phone and email (Mock: check console or response)",
            otp: otpCode
        });
    } catch (err) {
        console.error("Request Password OTP Error:", err);
        res.status(500).json({ error: err.message });
    }
};

export const verifyPasswordOTP = async (req, res) => {
    try {
        const { otp } = req.body;
        if (!otp) {
            return res.status(400).json({ error: "OTP is required" });
        }

        const email = req.user.email;
        const session = otpStore.get(email);

        if (!session || session.type !== "change-password") {
            return res.status(400).json({ error: "No active OTP request found. Please request a new OTP." });
        }

        if (session.expiresAt < Date.now()) {
            otpStore.delete(email);
            return res.status(400).json({ error: "OTP has expired. Please request a new one." });
        }

        if (session.otp !== otp) {
            session.attempts = (session.attempts || 0) + 1;
            if (session.attempts >= 3) {
                otpStore.delete(email);
                return res.status(400).json({ error: "Too many failed attempts. This OTP has been invalidated. Please request a new one." });
            }
            otpStore.set(email, session);
            const attemptsLeft = 3 - session.attempts;
            return res.status(400).json({ error: `Incorrect OTP code. ${attemptsLeft} attempts remaining.` });
        }

        // OTP verified successfully
        session.verified = true;
        otpStore.set(email, session);

        await logEvent(req.user._id, "OTP Verified", req);

        res.status(200).json({ message: "OTP verified successfully. You can now set your new PIN." });
    } catch (err) {
        console.error("Verify Password OTP Error:", err);
        res.status(500).json({ error: err.message });
    }
};

export const changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!newPassword) {
            return res.status(400).json({ error: "Please enter a new PIN" });
        }
        if (newPassword.length !== 6 || !/^\d+$/.test(newPassword)) {
            return res.status(400).json({ error: "New PIN must be exactly 6 digits and numeric" });
        }

        const user = await User.findById(req.user._id);
        if (!user) return res.status(404).json({ error: "User not found" });

        const email = req.user.email;
        const session = otpStore.get(email);

        // Determine if they are doing Direct Change or Reset via OTP
        if (currentPassword) {
            // Direct Change flow
            if (currentPassword === newPassword) {
                return res.status(400).json({ error: "New PIN cannot be the same as current PIN" });
            }
            const isMatch = await user.comparePassword(currentPassword);
            if (!isMatch) {
                return res.status(400).json({ error: "Current PIN is incorrect" });
            }

            // Update PIN
            user.password = newPassword;
            await user.save();

            await logEvent(user._id, "PIN Changed", req);
        } else {
            // Reset via OTP flow
            if (!session || session.type !== "change-password" || !session.verified) {
                return res.status(400).json({ error: "OTP verification required before resetting PIN." });
            }

            // Update PIN
            user.password = newPassword;
            await user.save();

            // Clear OTP session
            otpStore.delete(email);

            await logEvent(user._id, "PIN Reset via OTP", req);
        }

        console.log(`✅ PIN updated successfully for user ${req.user.email}`);
        res.status(200).json({ message: "Security PIN updated successfully." });
    } catch (err) {
        console.error("Change Password Error:", err);
        res.status(500).json({ error: err.message });
    }
};

export const updateSessionTimeout = async (req, res) => {
    try {
        const { timeout } = req.body;
        const parsedTimeout = parseInt(timeout, 10);
        if (!timeout || isNaN(parsedTimeout) || parsedTimeout <= 0) {
            return res.status(400).json({ error: "Please provide a valid session timeout in minutes." });
        }

        const user = await User.findById(req.user._id);
        if (!user) return res.status(404).json({ error: "User not found" });

        user.sessionTimeout = parsedTimeout;
        await user.save();

        await logEvent(user._id, "Session Timeout Changed", req);

        res.status(200).json({ 
            message: "Session timeout updated successfully.", 
            sessionTimeout: user.sessionTimeout 
        });
    } catch (err) {
        console.error("Update Session Timeout Error:", err);
        res.status(500).json({ error: err.message });
    }
};

export const getMe = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        if (!user) return res.status(404).json({ error: "User not found" });

        const maskEmail = (email) => {
            if (!email) return "";
            const [name, domain] = email.split("@");
            if (name.length <= 2) return `${name[0]}***@${domain}`;
            return `${name[0]}${"*".repeat(name.length - 2)}${name[name.length - 1]}@${domain}`;
        };

        const maskMobile = (mobile) => {
            if (!mobile) return "";
            const clean = mobile.replace(/\s+/g, "");
            if (clean.length <= 6) return clean;
            return `${clean.substring(0, 3)}XXXXXXX${clean.substring(clean.length - 3)}`;
        };

        res.json({
            _id: user._id,
            name: user.name,
            email: user.email,
            mobile: user.mobile,
            maskedEmail: maskEmail(user.email),
            maskedMobile: maskMobile(user.mobile),
            sessionTimeout: user.sessionTimeout || 30
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};


