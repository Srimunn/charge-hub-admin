import express from "express";
import { getStations, setStation, updateStation, deleteStation, getDebugStations, searchStations } from "../controllers/stationController.js";
import { protect } from "../middleware/authMiddleware.js";
import upload from "../middleware/uploadMiddleware.js";

const router = express.Router();

// GET all stations | POST create station (with optional image upload)
router.route("/")
  .get(protect, getStations)
  .post(protect, upload.single('image'), setStation);

router.get("/search", searchStations);

// Debug: view mock store
router.get("/debug", getDebugStations);

router.route("/:id")
  .put(protect, upload.single('image'), updateStation)
  .delete(protect, deleteStation);

export default router;