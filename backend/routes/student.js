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

  Internally this now reads from Child collection.
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
      message:
        "Failed to fetch students",
    });
  }
});

/* =========================================================
   GET ACTIVE STUDENTS
========================================================= */

/*
  Active students are:

  waiting
  onboard

  dropped and absent students are excluded.
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
  Legacy Driver endpoint:

  PUT /api/students/:id/pickup

  Body:
  {
    "driverId": "ASAN-XXXXXX"
  }

  Updates the SAME Child document used by Parent app.
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
      Keep response key as "student"
      so existing Driver frontend does not break.
    */

    return res.status(200).json({
      success: true,
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
        message:
          "Invalid Student ID",
      });
    }

    return res.status(500).json({
      success: false,
      message:
        "Pickup update failed",
    });
  }
});

/* =========================================================
   DROP STUDENT
========================================================= */

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
        message:
          "Invalid Student ID",
      });
    }

    return res.status(500).json({
      success: false,
      message:
        "Drop update failed",
    });
  }
});

/* =========================================================
   END TRIP
========================================================= */

/*
  IMPORTANT:

  We are intentionally keeping your existing Trip logic
  for now.

  We need to inspect models/Trips.js before changing
  "active", "in_transit", "completed", etc.
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

    const trip = await Trip.findOne({
      driverId,
      status: "active",
    }).sort({
      createdAt: -1,
    });

    if (!trip) {
      return res.status(404).json({
        success: false,
        message: "No active trip",
      });
    }

    trip.endTime = new Date();

    if (trip.startTime) {
      trip.duration = Math.max(
        0,
        Math.round(
          (trip.endTime -
            trip.startTime) /
            60000
        )
      );
    }

    trip.status = "completed";

    await trip.save();

    return res.status(200).json({
      success: true,
      trip,
    });
  } catch (error) {
    console.error(
      "END TRIP ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to end trip",
    });
  }
});

/* =========================================================
   EXPORT
========================================================= */

export default router;
