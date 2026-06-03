import express from "express";
import { createFault, getFaults, getFaultById, resolveFault, simulateFault } from "../controllers/faultController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// GET all faults for the user's stations
router.get("/", protect, getFaults);
router.get("/:id", protect, getFaultById);

// CREATE a fault
router.post("/", protect, createFault);

// SIMULATE a fault
router.post("/simulate", protect, simulateFault);

// RESOLVE a fault
router.put("/:id", protect, resolveFault);

export default router;
