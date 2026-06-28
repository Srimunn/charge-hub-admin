import express from "express";
import { 
    registerUser, 
    loginUser, 
    verifyOTP, 
    requestPasswordOTP, 
    verifyPasswordOTP, 
    changePassword, 
    updateSessionTimeout, 
    getMe 
} from "../controllers/authController.js";
import { googleAuth, setPin } from "../controllers/googleAuthController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/register", registerUser);
router.post("/login", loginUser);
router.post("/verify-otp", verifyOTP);
router.post("/google", googleAuth);
router.post("/set-pin", protect, setPin);

router.get("/me", protect, getMe);
router.post("/request-password-otp", protect, requestPasswordOTP);
router.post("/verify-password-otp", protect, verifyPasswordOTP);
router.post("/change-password", protect, changePassword);
router.post("/session-timeout", protect, updateSessionTimeout);

export default router;
