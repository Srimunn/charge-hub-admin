import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import Notification from "../models/Notification.js";
import User from "../models/User.js";
import { sendNotification } from "../services/notificationService.js";

const router = express.Router();

// @desc    Get all notifications for logged-in operator
// @route   GET /api/notifications
// @access  Private
router.get("/", protect, async (req, res) => {
    try {
        const userId = req.user._id || req.user.id;
        const notifications = await Notification.find({ userId })
            .sort({ createdAt: -1 })
            .limit(100);
        res.status(200).json(notifications);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// @desc    Get aggregate statistics of notifications
// @route   GET /api/notifications/stats
// @access  Private
router.get("/stats", protect, async (req, res) => {
    try {
        const userId = req.user._id || req.user.id;
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const totalNotifications = await Notification.countDocuments({ userId });
        const sentToday = await Notification.countDocuments({ 
            userId, 
            createdAt: { $gte: todayStart } 
        });

        // Compute simulated channels logs
        const emailCount = await Notification.countDocuments({ userId, type: { $in: ["session_start", "session_end", "payment", "fault"] } });
        const smsCount = await Notification.countDocuments({ userId, type: "otp" });
        const pushCount = await Notification.countDocuments({ userId, type: { $in: ["fault", "payment", "session_start", "session_end"] } });

        res.status(200).json({
            totalNotifications,
            sentToday,
            failedNotifications: 0, // Mocked 0 failures
            smsStatistics: {
                total: smsCount,
                delivered: smsCount,
                failed: 0
            },
            emailStatistics: {
                total: emailCount,
                sent: emailCount,
                failed: 0
            },
            pushStatistics: {
                total: pushCount,
                sent: pushCount,
                failed: 0
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// @desc    Post / trigger a manual notification test
// @route   POST /api/notifications/send
// @access  Private
router.post("/send", protect, async (req, res) => {
    try {
        const { title, message, type, metadata } = req.body;
        const userId = req.user._id || req.user.id;

        if (!title || !message) {
            return res.status(400).json({ error: "Title and message are required" });
        }

        const result = await sendNotification({
            userId,
            title,
            message,
            type: type || "general",
            metadata: metadata || {}
        });

        if (!result.success) {
            return res.status(500).json({ error: result.error });
        }

        res.status(201).json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// @desc    Mark one or all notifications as read
// @route   PUT /api/notifications/read
// @access  Private
router.put("/read", protect, async (req, res) => {
    try {
        const userId = req.user._id || req.user.id;
        const { notificationIds } = req.body; // Array of IDs, or empty to mark all

        if (notificationIds && Array.isArray(notificationIds) && notificationIds.length > 0) {
            await Notification.updateMany(
                { _id: { $in: notificationIds }, userId },
                { $set: { read: true } }
            );
        } else {
            // Mark all as read
            await Notification.updateMany(
                { userId, read: false },
                { $set: { read: true } }
            );
        }

        res.status(200).json({ success: true, message: "Notifications updated successfully" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// @desc    Update notification preference settings
// @route   PUT /api/notifications/preferences
// @access  Private
router.put("/preferences", protect, async (req, res) => {
    try {
        const userId = req.user._id || req.user.id;
        const { emailAlerts, smsAlerts, pushAlerts, faultAlerts, paymentAlerts } = req.body;

        const updateData = {};
        if (emailAlerts !== undefined) updateData["notificationPreferences.emailAlerts"] = emailAlerts;
        if (smsAlerts !== undefined) updateData["notificationPreferences.smsAlerts"] = smsAlerts;
        if (pushAlerts !== undefined) updateData["notificationPreferences.pushAlerts"] = pushAlerts;
        if (faultAlerts !== undefined) updateData["notificationPreferences.faultAlerts"] = faultAlerts;
        if (paymentAlerts !== undefined) updateData["notificationPreferences.paymentAlerts"] = paymentAlerts;

        const updatedUser = await User.findByIdAndUpdate(
            userId,
            { $set: updateData },
            { new: true }
        ).select("-password");

        res.status(200).json(updatedUser.notificationPreferences);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
