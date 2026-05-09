import express from "express";
import { startSession, stopSession, getSessions, getLiveSessions } from "../controllers/sessionController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// GET all sessions for the user
router.get("/", protect, getSessions);

// GET live active sessions
router.get("/live", protect, getLiveSessions);

// START a charging session
router.post("/start", protect, startSession);

// STOP a charging session
router.post("/stop/:id", protect, stopSession);

export default router;