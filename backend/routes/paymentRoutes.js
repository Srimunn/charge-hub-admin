import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { 
    createOrder, 
    verifyPayment, 
    webhookHandler, 
    getPayments, 
    getPaymentById,
    getPaymentBySessionId
} from "../controllers/paymentController.js";

const router = express.Router();

router.post("/create-order", protect, createOrder);
router.post("/verify", protect, verifyPayment);
router.post("/webhook", webhookHandler); // Webhook does not use standard auth (it uses HMAC)
router.get("/", protect, getPayments);
router.get("/session/:sessionId", protect, getPaymentBySessionId);
router.get("/:id", protect, getPaymentById);

export default router;