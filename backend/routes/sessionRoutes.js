import express from "express";
import { startSession, stopSession, getSessions, getLiveSessions } from "../controllers/sessionController.js";
import { protect, operatorOnly } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/", protect, getSessions); // customer: own sessions; operator: sessions at their stations
router.get("/live", protect, operatorOnly, getLiveSessions);
router.post("/start", protect, startSession); // customer needs a paid order; operator = test start
router.post("/stop/:id", protect, stopSession);

export default router;
