import express from "express";
import { createFault, getFaults, resolveFault } from "../controllers/faultController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// GET all faults for the user's stations
router.get("/", protect, getFaults);

// CREATE a fault
router.post("/", protect, createFault);

// RESOLVE a fault
router.put("/:id", protect, resolveFault);

export default router;