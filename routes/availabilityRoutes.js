import express from "express";
import {
  getTutorAvailability,
  createAvailability,
} from "../controllers/availabilityController";
const router = express.Router();

router.post("/", createAvailability);
router.get("/:tutorId", getTutorAvailability);

export default router;
