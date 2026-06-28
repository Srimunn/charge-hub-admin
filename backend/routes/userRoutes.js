import express from "express";
import User from "../models/User.js";
import Session from "../models/Session.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// CREATE USER
router.post("/", protect, async (req, res) => {
    try {
        const user = new User({
            ...req.body,
            operatorId: req.user._id || req.user.id
        });
        await user.save();
        res.json(user);
    } catch (err) {
        res.status(500).json(err);
    }
});

// GET ALL USERS
router.get("/", protect, async (req, res) => {
    try {
        const users = await User.find({ operatorId: req.user._id || req.user.id }).lean();
        const usersWithStats = await Promise.all(
            users.map(async (user) => {
                const sessions = await Session.find({ userId: user._id });
                const totalSessions = sessions.length;
                const totalSpent = sessions.reduce((sum, s) => sum + (s.cost || 0), 0);
                return {
                    ...user,
                    id: String(user._id),
                    totalSessions,
                    totalSpent,
                    status: "active", // Required for active/blocked badge in UI
                    type: "individual" // For tab filtering
                };
            })
        );
        res.json(usersWithStats);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;