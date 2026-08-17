import express from "express";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import verifyAdmin from "../middleware/verifyAdmin.js";

import {
  loginLimiter,
} from "../middleware/rateLimiters.js";

import Admin from "../models/Admin.js";
import Driver from "../models/Driver.js";
import AdminLog from "../models/AdminLog.js";

import verifyAdmin from "../middleware/verifyAdmin.js";

const router = express.Router();

/* =========================================================
   HELPERS
========================================================= */

const isValidObjectId = (value) => {
  return mongoose.Types.ObjectId.isValid(
    String(value || "")
  );
};

/* =========================================================
   ADMIN LOGIN
========================================================= */

/*
  ADMIN AUTHENTICATION:

  Email + Password
        ↓
  bcrypt verification
        ↓
  JWT

  No OTP.
  No Firebase.
  No Twilio.
*/

router.post(
  "/login",

  async (req, res) => {
    try {
      const {
        email,
        password,
      } = req.body || {};

      /* ===================================================
         NORMALIZE EMAIL
      =================================================== */

      const normalizedEmail =
        typeof email === "string"
          ? email.trim().toLowerCase()
          : "";

      /* ===================================================
         REQUIRED FIELDS
      =================================================== */

      if (
        !normalizedEmail ||
        !password
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Email and password are required",
        });
      }

      /* ===================================================
         EMAIL VALIDATION
      =================================================== */

      const emailRegex =
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      if (
        !emailRegex.test(
          normalizedEmail
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Enter a valid email address",
        });
      }

      /* ===================================================
         JWT CONFIGURATION
      =================================================== */

      if (!process.env.JWT_SECRET) {
        console.error(
          "JWT_SECRET is not configured"
        );

        return res.status(500).json({
          success: false,
          message:
            "Server authentication configuration error",
        });
      }

      /* ===================================================
         FIND ADMIN
      =================================================== */

      const admin =
        await Admin.findOne({
          email:
            normalizedEmail,
        }).select(
          "+password"
        );

      /*
        Do not reveal whether the Admin
        email exists.
      */

      if (!admin) {
        return res.status(401).json({
          success: false,
          message:
            "Invalid email or password",
        });
      }

      /* ===================================================
         VERIFY PASSWORD
      =================================================== */

      const isMatch =
        await admin.comparePassword(
          String(password)
        );

      if (!isMatch) {
        return res.status(401).json({
          success: false,
          message:
            "Invalid email or password",
        });
      }

      /* ===================================================
         VALID ROLE
      =================================================== */

      if (
        ![
          "superadmin",
          "reviewer",
        ].includes(
          admin.role
        )
      ) {
        return res.status(403).json({
          success: false,
          message:
            "Admin access denied",
        });
      }

      /* ===================================================
         GENERATE JWT
      =================================================== */

      const token =
        jwt.sign(
          {
            id:
              String(
                admin._id
              ),

            role:
              admin.role,
          },

          process.env.JWT_SECRET,

          {
            expiresIn:
              "7d",

            algorithm:
              "HS256",
          }
        );

      /* ===================================================
         RESPONSE
      =================================================== */

      return res.status(200).json({
        success: true,

        message:
          "Admin login successful",

        token,

        admin: {
          id:
            admin._id,

          email:
            admin.email,

          role:
            admin.role,
        },
      });
    } catch (error) {
      console.error(
        "ADMIN LOGIN ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Login failed",
      });
    }
  }
);

/* =========================================================
   ANALYTICS
========================================================= */

router.get(
  "/analytics",

  verifyAdmin,

  async (req, res) => {
    try {
      const [
        total,
        pending,
        approved,
        rejected,
      ] =
        await Promise.all([
          Driver.countDocuments(),

          Driver.countDocuments({
            status:
              "pending",
          }),

          Driver.countDocuments({
            status:
              "approved",
          }),

          Driver.countDocuments({
            status:
              "rejected",
          }),
        ]);

      return res.status(200).json({
        success: true,

        data: {
          summary: {
            total,
            pending,
            approved,
            rejected,
          },
        },
      });
    } catch (error) {
      console.error(
        "ADMIN ANALYTICS ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Analytics failed",
      });
    }
  }
);

/* =========================================================
   GET ALL DRIVERS
========================================================= */

router.get(
  "/drivers",

  verifyAdmin,

  async (req, res) => {
    try {
      const drivers =
        await Driver.find()
          .select(
            "-password"
          )
          .sort({
            createdAt:
              -1,
          });

      return res.status(200).json({
        success: true,

        count:
          drivers.length,

        data:
          drivers,
      });
    } catch (error) {
      console.error(
        "ADMIN DRIVERS FETCH ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to fetch drivers",
      });
    }
  }
);

/* =========================================================
   GET DRIVER DETAILS
========================================================= */

router.get(
  "/drivers/:id",

  verifyAdmin,

  async (req, res) => {
    try {
      const {
        id,
      } = req.params;

      /* ===================================================
         VALIDATE DRIVER ID
      =================================================== */

      if (
        !isValidObjectId(
          id
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid Driver ID",
        });
      }

      /* ===================================================
         FIND DRIVER
      =================================================== */

      const driver =
        await Driver.findById(
          id
        ).select(
          "-password"
        );

      if (!driver) {
        return res.status(404).json({
          success: false,
          message:
            "Driver not found",
        });
      }

      return res.status(200).json({
        success: true,
        data:
          driver,
      });
    } catch (error) {
      console.error(
        "ADMIN DRIVER FETCH ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to fetch driver",
      });
    }
  }
);

/* =========================================================
   APPROVE DRIVER
========================================================= */

router.put(
  "/drivers/:id/approve",

  verifyAdmin,

  async (req, res) => {
    try {
      const {
        id,
      } = req.params;

      /* ===================================================
         VALIDATE ID
      =================================================== */

      if (
        !isValidObjectId(
          id
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid Driver ID",
        });
      }

      /* ===================================================
         FIND DRIVER
      =================================================== */

      const driver =
        await Driver.findById(
          id
        );

      if (!driver) {
        return res.status(404).json({
          success: false,
          message:
            "Driver not found",
        });
      }

      /* ===================================================
         ALREADY APPROVED
      =================================================== */

      if (
        driver.status ===
        "approved"
      ) {
        return res.status(200).json({
          success: true,

          message:
            "Driver is already approved",

          data: {
            _id:
              driver._id,

            driverId:
              driver.driverId,

            status:
              driver.status,
          },
        });
      }

      /* ===================================================
         REJECTED APPLICATION
      =================================================== */

      /*
        Rejected → Approved should not happen through
        the normal onboarding review endpoint.

        A future resubmission/review flow can handle it.
      */

      if (
        driver.status ===
        "rejected"
      ) {
        return res.status(409).json({
          success: false,

          message:
            "Rejected Driver application cannot be approved directly",
        });
      }

      /* ===================================================
         EXPECT PENDING APPLICATION
      =================================================== */

      if (
        driver.status !==
        "pending"
      ) {
        return res.status(409).json({
          success: false,

          message:
            "Driver is not awaiting approval",
        });
      }

      /* ===================================================
         APPROVE DRIVER
      =================================================== */

      driver.status =
        "approved";

      driver.rejectionReason =
        null;

      await driver.save();

      /* ===================================================
         ADMIN AUDIT LOG
      =================================================== */

      try {
        await AdminLog.create({
          adminId:
            req.admin.id,

          action:
            "DRIVER_APPROVED",

          driverId:
            driver._id,

          message:
            `Driver ${driver.name} approved`,

          metadata: {
            driverId:
              driver.driverId,

            previousStatus:
              "pending",

            newStatus:
              "approved",
          },
        });
      } catch (logError) {
        console.error(
          "ADMIN APPROVAL LOG ERROR:",
          logError.message
        );
      }

      /* ===================================================
         SOCKET — DRIVER ROOM ONLY
      =================================================== */

      const io =
        req.app.get(
          "io"
        );

      if (io) {
        io.to(
          String(
            driver.driverId
          )
        ).emit(
          "driver_approved",
          {
            driverId:
              driver.driverId,

            driverMongoId:
              String(
                driver._id
              ),

            status:
              driver.status,

            date:
              new Date()
                .toISOString()
                .split(
                  "T"
                )[0],
          }
        );
      }

      return res.status(200).json({
        success: true,

        message:
          "Driver approved successfully",

        data: {
          _id:
            driver._id,

          driverId:
            driver.driverId,

          status:
            driver.status,
        },
      });
    } catch (error) {
      console.error(
        "APPROVE DRIVER ERROR:",
        error
      );

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

      return res.status(500).json({
        success: false,
        message:
          "Approval failed",
      });
    }
  }
);

/* =========================================================
   REJECT DRIVER
========================================================= */

router.put(
  "/drivers/:id/reject",

  verifyAdmin,

  async (req, res) => {
    try {
      const {
        id,
      } = req.params;

      const {
        reason,
      } =
        req.body || {};

      /* ===================================================
         VALIDATE ID
      =================================================== */

      if (
        !isValidObjectId(
          id
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid Driver ID",
        });
      }

      /* ===================================================
         REJECTION REASON
      =================================================== */

      const rejectionReason =
        typeof reason ===
        "string"
          ? reason.trim()
          : "";

      if (
        !rejectionReason
      ) {
        return res.status(400).json({
          success: false,

          message:
            "Rejection reason is required",
        });
      }

      if (
        rejectionReason.length >
        500
      ) {
        return res.status(400).json({
          success: false,

          message:
            "Rejection reason must not exceed 500 characters",
        });
      }

      /* ===================================================
         FIND DRIVER
      =================================================== */

      const driver =
        await Driver.findById(
          id
        );

      if (!driver) {
        return res.status(404).json({
          success: false,
          message:
            "Driver not found",
        });
      }

      /* ===================================================
         ALREADY REJECTED
      =================================================== */

      if (
        driver.status ===
        "rejected"
      ) {
        return res.status(200).json({
          success: true,

          message:
            "Driver is already rejected",

          data: {
            _id:
              driver._id,

            driverId:
              driver.driverId,

            status:
              driver.status,

            rejectionReason:
              driver.rejectionReason,
          },
        });
      }

      /* ===================================================
         APPROVED DRIVER
      =================================================== */

      /*
        Approval review and account suspension are
        different operations.

        Do not use application rejection to disable an
        already-approved Driver.
      */

      if (
        driver.status ===
        "approved"
      ) {
        return res.status(409).json({
          success: false,

          message:
            "Approved Driver cannot be rejected through the application review endpoint",
        });
      }

      /* ===================================================
         EXPECT PENDING APPLICATION
      =================================================== */

      if (
        driver.status !==
        "pending"
      ) {
        return res.status(409).json({
          success: false,

          message:
            "Driver is not awaiting review",
        });
      }

      /* ===================================================
         REJECT DRIVER
      =================================================== */

      driver.status =
        "rejected";

      driver.rejectionReason =
        rejectionReason;

      driver.isOnline =
        false;

      driver.currentStatus =
        "offline";

      await driver.save();

      /* ===================================================
         ADMIN AUDIT LOG
      =================================================== */

      try {
        await AdminLog.create({
          adminId:
            req.admin.id,

          action:
            "DRIVER_REJECTED",

          driverId:
            driver._id,

          message:
            `Driver ${driver.name} rejected: ${rejectionReason}`,

          metadata: {
            driverId:
              driver.driverId,

            rejectionReason,

            previousStatus:
              "pending",

            newStatus:
              "rejected",
          },
        });
      } catch (logError) {
        console.error(
          "ADMIN REJECTION LOG ERROR:",
          logError.message
        );
      }

      /* ===================================================
         SOCKET — DRIVER ROOM ONLY
      =================================================== */

      const io =
        req.app.get(
          "io"
        );

      if (io) {
        io.to(
          String(
            driver.driverId
          )
        ).emit(
          "driver_rejected",
          {
            driverId:
              driver.driverId,

            driverMongoId:
              String(
                driver._id
              ),

            status:
              driver.status,

            reason:
              rejectionReason,
          }
        );
      }

      return res.status(200).json({
        success: true,

        message:
          "Driver rejected successfully",

        data: {
          _id:
            driver._id,

          driverId:
            driver.driverId,

          status:
            driver.status,

          rejectionReason:
            driver.rejectionReason,
        },
      });
    } catch (error) {
      console.error(
        "REJECT DRIVER ERROR:",
        error
      );

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

      return res.status(500).json({
        success: false,
        message:
          "Rejection failed",
      });
    }
  }
);

/* =========================================================
   ADMIN LOGS
========================================================= */

router.get(
  "/logs",

  verifyAdmin,

  async (req, res) => {
    try {
      const logs =
        await AdminLog.find()
          .populate(
            "adminId",
            "email role"
          )
          .populate(
            "driverId",
            "name driverId"
          )
          .sort({
            createdAt:
              -1,
          });

      return res.status(200).json({
        success: true,

        count:
          logs.length,

        data:
          logs,
      });
    } catch (error) {
      console.error(
        "ADMIN LOGS ERROR:",
        error
      );

      return res.status(500).json({
        success: false,

        message:
          "Failed to fetch logs",
      });
    }
  }
);

/* =========================================================
   EXPORT
========================================================= */

export default router;
