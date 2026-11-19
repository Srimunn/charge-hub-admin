import express from "express";
import {
  getStations,
  getStationById,
  setStation,
  updateStation,
  deleteStation,
  searchStations,
  getAllStationsPublic,
  getStationByIdPublic,
} from "../controllers/stationController.js";
import { protect, operatorOnly } from "../middleware/authMiddleware.js";
import upload from "../middleware/uploadMiddleware.js";

const router = express.Router();

// Public (mobile app)
router.get("/public", getAllStationsPublic);
router.get("/public/:id", getStationByIdPublic);
router.get("/search", searchStations);

// Operator dashboard
router.route("/").get(protect, operatorOnly, getStations).post(protect, operatorOnly, upload.single("image"), setStation);
router
  .route("/:id")
  .get(protect, operatorOnly, getStationById)
  .put(protect, operatorOnly, upload.single("image"), updateStation)
  .delete(protect, operatorOnly, deleteStation);

export default router;
