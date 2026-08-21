import jwt from "jsonwebtoken";
import mongoose from "mongoose";

import Driver from "../models/Driver.js";

/* =========================================================
   VERIFY DRIVER AUTHENTICATION
========================================================= */

/*
  PURPOSE:

  This middleware verifies:

  1. Authorization Bearer token exists
  2. JWT is valid
  3. tokenType === "driver"
  4. MongoDB Driver _id is valid
  5. Driver account still exists

  IMPORTANT:

  This middleware only verifies authentication.

  It DOES NOT require approval.

  Therefore:

  pending
    → authenticated

  approved
    → authenticated

  rejected
    → authenticated

  Approval-based authorization is handled separately using:

  requireApprovedDriver
*/

const verifyDriver =
  async (
    req,
    res,
    next
  ) => {
    try {
      /* =====================================================
         JWT CONFIGURATION
      ===================================================== */

      if (
        !process.env.JWT_SECRET
      ) {
        console.error(
          "JWT_SECRET is not configured"
        );

        return res
          .status(500)
          .json({
            success: false,

            message:
              "Server authentication configuration error",
          });
      }

      /* =====================================================
         AUTHORIZATION HEADER
      ===================================================== */

      const authHeader =
        req.headers
          .authorization;

      if (
        !authHeader ||
        !authHeader.startsWith(
          "Bearer "
        )
      ) {
        return res
          .status(401)
          .json({
            success: false,

            message:
              "Driver authentication required",
          });
      }

      /* =====================================================
         EXTRACT TOKEN
      ===================================================== */

      const token =
        authHeader
          .slice(7)
          .trim();

      if (
        !token
      ) {
        return res
          .status(401)
          .json({
            success: false,

            message:
              "Driver authentication required",
          });
      }

      /* =====================================================
         VERIFY JWT
      ===================================================== */

      const decoded =
        jwt.verify(
          token,

          process.env.JWT_SECRET,

          {
            algorithms: [
              "HS256",
            ],
          }
        );

      /* =====================================================
         EXPECTED DRIVER JWT
      ===================================================== */

      /*
        Driver JWT is generated after:

        - Driver registration OTP verification
        - Driver login OTP verification

        Structure:

        {
          id: "<MongoDB Driver _id>",
          tokenType: "driver"
        }

        We intentionally do NOT put these inside JWT:

        driverId
        email
        phone
        approval status

        They may change.

        MongoDB _id remains the permanent account identity.
      */

      if (
        !decoded ||
        typeof decoded !==
          "object" ||
        decoded.tokenType !==
          "driver" ||
        !decoded.id
      ) {
        return res
          .status(401)
          .json({
            success: false,

            message:
              "Invalid Driver token",
          });
      }

      /* =====================================================
         VALIDATE MONGODB ID
      ===================================================== */

      const driverMongoId =
        String(
          decoded.id
        ).trim();

      if (
        !mongoose.Types.ObjectId.isValid(
          driverMongoId
        )
      ) {
        return res
          .status(401)
          .json({
            success: false,

            message:
              "Invalid Driver token",
          });
      }

      /* =====================================================
         LOAD CURRENT DRIVER ACCOUNT
      ===================================================== */

      /*
        Always load the Driver from MongoDB.

        This ensures we always use the latest:

        - status
        - driverId
        - email
        - rejectionReason
        - profile information
      */

      const driver =
        await Driver.findById(
          driverMongoId
        );

      if (
        !driver
      ) {
        return res
          .status(401)
          .json({
            success: false,

            message:
              "Driver account not found",
          });
      }

      /* =====================================================
         ATTACH DRIVER
      ===================================================== */

      /*
        Full Mongoose Driver document.

        Controllers can use:

        req.driver._id
        req.driver.email
        req.driver.status
        req.driver.driverId
      */

      req.driver =
        driver;

      /* =====================================================
         ATTACH SAFE AUTH INFORMATION
      ===================================================== */

      req.driverAuth = {
        id:
          String(
            driver._id
          ),

        driverId:
          driver.driverId ||
          null,

        email:
          driver.email,

        status:
          driver.status,

        tokenType:
          "driver",
      };

      /* =====================================================
         CONTINUE
      ===================================================== */

      return next();
    } catch (
      error
    ) {
      /* =====================================================
         EXPIRED TOKEN
      ===================================================== */

      if (
        error?.name ===
        "TokenExpiredError"
      ) {
        return res
          .status(401)
          .json({
            success: false,

            code:
              "DRIVER_SESSION_EXPIRED",

            message:
              "Driver session expired",
          });
      }

      /* =====================================================
         INVALID TOKEN
      ===================================================== */

      if (
        error?.name ===
          "JsonWebTokenError" ||
        error?.name ===
          "NotBeforeError"
      ) {
        return res
          .status(401)
          .json({
            success: false,

            code:
              "INVALID_DRIVER_TOKEN",

            message:
              "Invalid Driver token",
          });
      }

      /* =====================================================
         UNKNOWN AUTH ERROR
      ===================================================== */

      console.error(
        "DRIVER AUTH ERROR:",
        error
      );

      return res
        .status(500)
        .json({
          success: false,

          message:
            "Driver authentication failed",
        });
    }
  };

/* =========================================================
   REQUIRE APPROVED DRIVER
========================================================= */

/*
  Use AFTER verifyDriver.

  Example:

  router.get(
    "/dashboard/:driverId",

    verifyDriver,
    requireApprovedDriver,

    controller
  );

  Authentication:
    verifyDriver

  Authorization:
    requireApprovedDriver
*/

export const requireApprovedDriver =
  (
    req,
    res,
    next
  ) => {
    /* =====================================================
       DRIVER REQUIRED
    ===================================================== */

    if (
      !req.driver
    ) {
      return res
        .status(401)
        .json({
          success: false,

          message:
            "Driver authentication required",
        });
    }

    /* =====================================================
       APPROVED DRIVER
    ===================================================== */

    if (
      req.driver.status ===
      "approved"
    ) {
      /*
        Approved Drivers should have their public
        ASAN Driver ID.

        Example:

        ASAN-AB12CD
      */

      if (
        !req.driver.driverId
      ) {
        return res
          .status(409)
          .json({
            success: false,

            code:
              "DRIVER_ID_MISSING",

            message:
              "Driver ID has not been assigned yet",
          });
      }

      return next();
    }

    /* =====================================================
       PENDING DRIVER
    ===================================================== */

    if (
      req.driver.status ===
      "pending"
    ) {
      return res
        .status(403)
        .json({
          success: false,

          code:
            "DRIVER_PENDING",

          status:
            "pending",

          nextStep:
            "approval-pending",

          message:
            "Your Driver account is awaiting approval",
        });
    }

    /* =====================================================
       REJECTED DRIVER
    ===================================================== */

    if (
      req.driver.status ===
      "rejected"
    ) {
      return res
        .status(403)
        .json({
          success: false,

          code:
            "DRIVER_REJECTED",

          status:
            "rejected",

          nextStep:
            "application-rejected",

          rejectionReason:
            req.driver
              .rejectionReason ||
            null,

          message:
            "Your Driver application was rejected",
        });
    }

    /* =====================================================
       UNKNOWN STATUS
    ===================================================== */

    return res
      .status(403)
      .json({
        success: false,

        code:
          "DRIVER_NOT_APPROVED",

        status:
          req.driver.status ||
          "unknown",

        message:
          "Driver account is not approved",
      });
  };

/* =========================================================
   EXPORT
========================================================= */

export default verifyDriver;
