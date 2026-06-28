import express from "express";
import {
  createRequest,
  getAllRequests,
  assignDriver,
} from "../controllers/driverRequestController.js";

const router = express.Router();

router.post("/", createRequest);

router.get("/", getAllRequests);

router.put("/:id/assign", assignDriver);

export default router;
