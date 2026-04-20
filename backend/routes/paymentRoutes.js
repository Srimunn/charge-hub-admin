import express from "express";
import Payment from "../models/Payment.js";

const router = express.Router();

// CREATE PAYMENT
router.post("/", async (req, res) => {
    try {
        const payment = new Payment(req.body);
        await payment.save();
        res.json(payment);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET PAYMENTS
router.get("/", async (req, res) => {
    try {
        const payments = await Payment.find().populate("userId sessionId");
        res.json(payments);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;