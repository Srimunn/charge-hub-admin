import express from "express";
import { getStations, setStation } from "../controllers/stationController.js";
import { protect } from "../middleware/authMiddleware.js";
import upload from "../middleware/uploadMiddleware.js";

const router = express.Router();

// GET all stations | POST create station (with optional image upload)
router.route("/")
  .get(protect, getStations)
  .post(protect, upload.single('image'), setStation);

export default router;