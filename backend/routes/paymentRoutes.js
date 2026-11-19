import express from "express";
import { protect, operatorOnly } from "../middleware/authMiddleware.js";
import {
  createOrder,
  verifyPayment,
  webhookHandler,
  getPayments,
  getPaymentById,
  getPaymentBySessionId,
  retryRefund,
} from "../controllers/paymentController.js";

const router = express.Router();

router.post("/create-order", protect, createOrder);
router.post("/verify", protect, verifyPayment);
router.post("/webhook", webhookHandler); // Razorpay → server; authenticated by HMAC over the raw body
router.get("/", protect, getPayments);
router.get("/session/:sessionId", protect, getPaymentBySessionId);
router.post("/:id/retry-refund", protect, operatorOnly, retryRefund);
router.get("/:id", protect, getPaymentById);

export default router;
