import express from "express";
import mongoose from "mongoose";

import Child from "../models/Child.js";
import Trip from "../models/Trips.js";

import verifyDriver from "../middleware/verifyDriver.js";

import {
  pickupStudentService,
  dropStudentService,
  endTripService,
} from "../services/tripService.js";

const router = express.Router();

/* =========================================================
   HELPERS
========================================================= */

const normalizeDriverId = (
  driverId
) => {
  return String(
    driverId || ""
  )
    .trim()
    .toUpperCase();
};

/* =========================================================
   SERVICE ERROR RESPONSE
========================================================= */

const handleServiceError = (
  error,
  res,
  fallbackMessage
) => {
  console.error(
    fallbackMessage,
    error
  );

  if (
    error?.statusCode
  ) {
    return res.status(
      error.statusCode
    ).json({
      success: false,

      message:
        error.message,
    });
  }

  if (
    error?.name ===
    "ValidationError"
  ) {
    return res.status(400).json({
      success: false,

      message:
        error.message,
    });
  }

  if (
    error?.name ===
    "CastError"
  ) {
    return res.status(400).json({
      success: false,

      message:
        "Invalid ID",
    });
  }

  return res.status(500).json({
    success: false,

    message:
      fallbackMessage,
  });
};

/* =========================================================
   VERIFY LEGACY DRIVER ID
========================================================= */

/*
  Old frontend code may still send:

  ?driverId=ASAN-XXXXXX

  or:

  {
    "driverId": "ASAN-XXXXXX"
  }

  The value is NOT trusted.

  If it is supplied, it must match the authenticated
  Driver JWT.
*/

const verifyLegacyDriverId = (
  req,
  res,
  next
) => {
  const authenticatedDriverId =
    normalizeDriverId(
      req.driver?.driverId
    );

  if (!authenticatedDriverId) {
    return res.status(401).json({
      success: false,

      message:
        "Driver authentication required",
    });
  }

  const suppliedDriverId =
    normalizeDriverId(
      req.query?.driverId ||
        req.body?.driverId
    );

  if (
    suppliedDriverId &&
    suppliedDriverId !==
      authenticatedDriverId
  ) {
    return res.status(403).json({
      success: false,

      message:
        "You cannot access another Driver's students",
    });
  }

  req.authenticatedDriverId =
    authenticatedDriverId;

  return next();
};

/* =========================================================
   RESOLVE ACTIVE TRIP FOR STUDENT
========================================================= */

/*
  Legacy endpoint identifies the Student:

      /api/students/:id/pickup

  Official trip logic identifies the Trip:

      /api/trip/pickup/:tripId

  This middleware securely converts:

      Child ID
        ↓
      authenticated Driver
        ↓
      active Trip ID
*/

const resolveActiveTripForStudent =
  async (
    req,
    res,
    next
  ) => {
    try {
      const studentId =
        req.params.id;

      if (
        !mongoose.Types.ObjectId.isValid(
          String(
            studentId || ""
          )
        )
      ) {
        return res.status(400).json({
          success: false,

          message:
            "Invalid Student ID",
        });
      }

      /* ===================================================
         VERIFY CHILD ASSIGNMENT
      =================================================== */

      const child =
        await Child.findOne({
          _id:
            studentId,

          driverId:
            req.authenticatedDriverId,
        }).select(
          "_id name driverId status"
        );

      if (!child) {
        return res.status(404).json({
          success: false,

          message:
            "Student not found or not assigned to this Driver",
        });
      }

      /* ===================================================
         FIND ACTIVE TRIP
      =================================================== */

      const trip =
        await Trip.findOne({
          child:
            child._id,

          driverId:
            req.authenticatedDriverId,

          status:
            "in_transit",
        })
          .sort({
            createdAt:
              -1,
          })
          .select(
            "_id child driverId status tripType"
          );

      if (!trip) {
        return res.status(404).json({
          success: false,

          message:
            "No active Trip found for this Student",
        });
      }

      req.legacyStudent =
        child;

      req.legacyTrip =
        trip;

      return next();
    } catch (error) {
      console.error(
        "STUDENT TRIP RESOLUTION ERROR:",
        error
      );

      return res.status(500).json({
        success: false,

        message:
          "Failed to resolve Student Trip",
      });
    }
  };

/* =========================================================
   GET ALL ASSIGNED STUDENTS
   DRIVER ONLY
========================================================= */

/*
  Legacy:

  GET /api/students?driverId=ASAN-XXXXXX

  driverId query remains optional for old frontend
  compatibility.

  Actual identity comes from Driver JWT.
*/

router.get(
  "/",

  verifyDriver,
  verifyLegacyDriverId,

  async (
    req,
    res
  ) => {
    try {
      const students =
        await Child.find({
          driverId:
            req.authenticatedDriverId,
        })
          .sort({
            createdAt:
              1,
          })
          .lean();

      return res.status(200).json({
        success: true,

        data:
          students,
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
  }
);

/* =========================================================
   GET ACTIVE STUDENTS
   DRIVER ONLY
========================================================= */

router.get(
  "/active",

  verifyDriver,
  verifyLegacyDriverId,

  async (
    req,
    res
  ) => {
    try {
      const students =
        await Child.find({
          driverId:
            req.authenticatedDriverId,

          status: {
            $in: [
              "waiting",
              "onboard",
            ],
          },
        })
          .sort({
            createdAt:
              1,
          })
          .lean();

      return res.status(200).json({
        success: true,

        data:
          students,
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
  }
);

/* =========================================================
   PICKUP STUDENT
   DRIVER ONLY
========================================================= */

/*
  Legacy endpoint:

  PUT /api/students/:id/pickup

  We DO NOT directly update Child.status here anymore.

  The official Trip service performs the transition so:

  Trip pickupStatus
  Child status
  notifications
  transactions

  stay synchronized.
*/

router.put(
  "/:id/pickup",

  verifyDriver,
  verifyLegacyDriverId,
  resolveActiveTripForStudent,

  async (
    req,
    res
  ) => {
    try {
      const trip =
        await pickupStudentService(
          req.legacyTrip._id,

          req.app.get(
            "io"
          )
        );

      const student =
        await Child.findById(
          req.legacyStudent._id
        );

      return res.status(200).json({
        success: true,

        message:
          "Student picked up successfully",

        /*
          Keep legacy response key.
        */

        student,

        /*
          Newer clients may also use Trip data.
        */

        trip,
      });
    } catch (error) {
      return handleServiceError(
        error,
        res,
        "Pickup update failed"
      );
    }
  }
);

/* =========================================================
   DROP STUDENT
   DRIVER ONLY
========================================================= */

router.put(
  "/:id/drop",

  verifyDriver,
  verifyLegacyDriverId,
  resolveActiveTripForStudent,

  async (
    req,
    res
  ) => {
    try {
      const trip =
        await dropStudentService(
          req.legacyTrip._id,

          req.app.get(
            "io"
          )
        );

      const student =
        await Child.findById(
          req.legacyStudent._id
        );

      return res.status(200).json({
        success: true,

        message:
          "Student dropped successfully",

        student,

        trip,
      });
    } catch (error) {
      return handleServiceError(
        error,
        res,
        "Drop update failed"
      );
    }
  }
);

/* =========================================================
   END DRIVER TRIP
   DRIVER ONLY
========================================================= */

/*
  Legacy endpoint:

  POST /api/students/end

  Previously this endpoint completed only the newest
  Trip document.

  That is dangerous because one Driver trip contains
  separate Trip documents for multiple children.

  We now delegate to endTripService(), which completes
  the entire Driver trip correctly.
*/

router.post(
  "/end",

  verifyDriver,
  verifyLegacyDriverId,

  async (
    req,
    res
  ) => {
    try {
      const trips =
        await endTripService(
          req.authenticatedDriverId,

          req.app.get(
            "io"
          )
        );

      if (
        !Array.isArray(
          trips
        ) ||
        trips.length ===
          0
      ) {
        return res.status(404).json({
          success: false,

          message:
            "No Trip currently in transit",
        });
      }

      return res.status(200).json({
        success: true,

        message:
          "Trip completed successfully",

        /*
          Keep the old singular key for compatibility.
        */

        trip:
          trips[0],

        /*
          Correct complete result.
        */

        trips,
      });
    } catch (error) {
      return handleServiceError(
        error,
        res,
        "Failed to end Trip"
      );
    }
  }
);

/* =========================================================
   EXPORT
========================================================= */

export default router;
