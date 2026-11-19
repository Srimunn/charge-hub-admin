import express from "express";
import { createFault, getFaults, getFaultById, resolveFault, simulateFault, getAlerts } from "../controllers/faultController.js";
import { protect, operatorOnly } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/alerts", protect, getAlerts);
router.get("/", protect, getFaults);
router.post("/", protect, operatorOnly, createFault);
router.post("/simulate", protect, operatorOnly, simulateFault);
router.get("/:id", protect, getFaultById);
router.put("/:id", protect, operatorOnly, resolveFault);

export default router;
