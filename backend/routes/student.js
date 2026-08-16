import express from "express";

import Child from "../models/Child.js";
import Trip from "../models/Trips.js";

const router = express.Router();

/* =========================================================
   HELPERS
========================================================= */

const normalizeDriverId = (driverId) => {
  if (!driverId) {
    return "";
  }

  return String(driverId)
    .trim()
    .toUpperCase();
};

/* =========================================================
   GET ALL ASSIGNED STUDENTS
========================================================= */

/*
  Legacy Driver endpoint:

  GET /api/students?driverId=ASAN-XXXXXX

  This route now reads from the Child collection.

  Child is the single source of truth for both
  Parent and Driver applications.
*/

router.get("/", async (req, res) => {
  try {
    const driverId = normalizeDriverId(
      req.query.driverId
    );

    if (!driverId) {
      return res.status(400).json({
        success: false,
        message: "Driver ID is required",
      });
    }

    const students = await Child.find({
      driverId,
    })
      .sort({
        createdAt: 1,
      })
      .lean();

    return res.status(200).json({
      success: true,
      data: students,
    });
  } catch (error) {
    console.error(
      "GET STUDENTS ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to fetch students",
    });
  }
});

/* =========================================================
   GET ACTIVE STUDENTS
========================================================= */

/*
  Active Child statuses for Driver:

  waiting
  onboard

  dropped and absent children are excluded.
*/

router.get("/active", async (req, res) => {
  try {
    const driverId = normalizeDriverId(
      req.query.driverId
    );

    if (!driverId) {
      return res.status(400).json({
        success: false,
        message: "Driver ID is required",
      });
    }

    const students = await Child.find({
      driverId,

      status: {
        $in: [
          "waiting",
          "onboard",
        ],
      },
    })
      .sort({
        createdAt: 1,
      })
      .lean();

    return res.status(200).json({
      success: true,
      data: students,
    });
  } catch (error) {
    console.error(
      "GET ACTIVE STUDENTS ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to fetch active students",
    });
  }
});

/* =========================================================
   PICKUP STUDENT
========================================================= */

/*
  PUT /api/students/:id/pickup

  Body:

  {
    "driverId": "ASAN-XXXXXX"
  }

  waiting -> onboard
*/

router.put("/:id/pickup", async (req, res) => {
  try {
    const driverId = normalizeDriverId(
      req.body.driverId
    );

    if (!driverId) {
      return res.status(400).json({
        success: false,
        message: "Driver ID is required",
      });
    }

    const student =
      await Child.findOneAndUpdate(
        {
          _id: req.params.id,
          driverId,
          status: "waiting",
        },

        {
          $set: {
            status: "onboard",
          },
        },

        {
          new: true,
          runValidators: true,
        }
      );

    if (!student) {
      return res.status(404).json({
        success: false,

        message:
          "Student not found, not assigned to this driver, or already picked up",
      });
    }

    /*
      Keep "student" response key for
      Driver frontend compatibility.
    */

    return res.status(200).json({
      success: true,
      message:
        "Student picked up successfully",
      student,
    });
  } catch (error) {
    console.error(
      "STUDENT PICKUP ERROR:",
      error
    );

    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid Student ID",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Pickup update failed",
    });
  }
});

/* =========================================================
   DROP STUDENT
========================================================= */

/*
  PUT /api/students/:id/drop

  Body:

  {
    "driverId": "ASAN-XXXXXX"
  }

  onboard -> dropped
*/

router.put("/:id/drop", async (req, res) => {
  try {
    const driverId = normalizeDriverId(
      req.body.driverId
    );

    if (!driverId) {
      return res.status(400).json({
        success: false,
        message: "Driver ID is required",
      });
    }

    const student =
      await Child.findOneAndUpdate(
        {
          _id: req.params.id,
          driverId,
          status: "onboard",
        },

        {
          $set: {
            status: "dropped",
          },
        },

        {
          new: true,
          runValidators: true,
        }
      );

    if (!student) {
      return res.status(404).json({
        success: false,

        message:
          "Student not found, not assigned to this driver, or not onboard",
      });
    }

    return res.status(200).json({
      success: true,
      message:
        "Student dropped successfully",
      student,
    });
  } catch (error) {
    console.error(
      "STUDENT DROP ERROR:",
      error
    );

    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid Student ID",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Drop update failed",
    });
  }
});

/* =========================================================
   END DRIVER TRIP
========================================================= */

/*
  POST /api/students/end

  Body:

  {
    "driverId": "ASAN-XXXXXX"
  }

  Trip lifecycle:

  waiting
      ↓
  in_transit
      ↓
  completed

  "active" is NOT a valid Trip status.
*/

router.post("/end", async (req, res) => {
  try {
    const driverId = normalizeDriverId(
      req.body.driverId
    );

    if (!driverId) {
      return res.status(400).json({
        success: false,
        message: "Driver ID is required",
      });
    }

    /* =====================================================
       FIND LATEST IN-TRANSIT TRIP
    ===================================================== */

    const trip = await Trip.findOne({
      driverId,
      status: "in_transit",
    }).sort({
      createdAt: -1,
    });

    if (!trip) {
      return res.status(404).json({
        success: false,
        message:
          "No trip currently in transit",
      });
    }

    /* =====================================================
       COMPLETE TRIP
    ===================================================== */

    const endTime = new Date();

    trip.endTime = endTime;

    if (trip.startTime) {
      trip.duration = Math.max(
        0,
        Math.round(
          (
            endTime.getTime() -
            new Date(
              trip.startTime
            ).getTime()
          ) /
            60000
        )
      );
    } else {
      trip.duration = 0;
    }

    trip.status = "completed";

    await trip.save();

    return res.status(200).json({
      success: true,

      message:
        "Trip completed successfully",

      trip,
    });
  } catch (error) {
    console.error(
      "END TRIP ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to end trip",
    });
  }
});

/* =========================================================
   EXPORT
========================================================= */

export default router;
