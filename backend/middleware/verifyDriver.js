import jwt from "jsonwebtoken";
import mongoose from "mongoose";

import Driver from "../models/Driver.js";

/* =========================================================
   VERIFY DRIVER AUTHENTICATION
========================================================= */

/*
  PURPOSE:

  This middleware verifies that:

  1. A Bearer token exists
  2. The JWT is valid
  3. tokenType === "driver"
  4. The MongoDB Driver account exists

  IMPORTANT:

  This middleware DOES NOT require the Driver
  to already be approved.

  Therefore:

  pending Driver
      → authenticated

  approved Driver
      → authenticated

  rejected Driver
      → authenticated

  Approval-based access is handled separately by:

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
        !process.env
          .JWT_SECRET
      ) {
        console.error(
          "JWT_SECRET is not configured"
        );

        return res
          .status(500)
          .json({
            success:
              false,

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
            success:
              false,

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
            success:
              false,

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
          process.env
            .JWT_SECRET,
          {
            algorithms: [
              "HS256",
            ],
          }
        );

      /* =====================================================
         TOKEN STRUCTURE
      ===================================================== */

      /*
        Expected Driver JWT:

        {
          id: "<MongoDB Driver _id>",
          tokenType: "driver"
        }

        We intentionally do NOT depend on driverId
        being stored inside the JWT.

        driverId can be assigned/changed later while
        MongoDB _id remains the account identity.
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
            success:
              false,

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
        );

      if (
        !mongoose.Types.ObjectId.isValid(
          driverMongoId
        )
      ) {
        return res
          .status(401)
          .json({
            success:
              false,

            message:
              "Invalid Driver token",
          });
      }

      /* =====================================================
         LOAD CURRENT DRIVER ACCOUNT
      ===================================================== */

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
            success:
              false,

            message:
              "Driver account not found",
          });
      }

      /* =====================================================
         ATTACH AUTHENTICATED DRIVER
      ===================================================== */

      req.driver =
        driver;

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
            success:
              false,

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
            success:
              false,

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
          success:
            false,

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

    ...
  );

  This keeps authentication separate from
  operational authorization.
*/

export const requireApprovedDriver =
  (
    req,
    res,
    next
  ) => {
    if (
      !req.driver
    ) {
      return res
        .status(401)
        .json({
          success:
            false,

          message:
            "Driver authentication required",
        });
    }

    /* =====================================================
       APPROVED
    ===================================================== */

    if (
      req.driver.status ===
      "approved"
    ) {
      /*
        Approved Drivers should normally have their
        public ASAN Driver ID assigned.
      */

      if (
        !req.driver.driverId
      ) {
        return res
          .status(409)
          .json({
            success:
              false,

            message:
              "Driver ID has not been assigned yet",
          });
      }

      return next();
    }

    /* =====================================================
       PENDING
    ===================================================== */

    if (
      req.driver.status ===
      "pending"
    ) {
      return res
        .status(403)
        .json({
          success:
            false,

          code:
            "DRIVER_PENDING",

          status:
            "pending",

          message:
            "Your Driver account is awaiting approval",
        });
    }

    /* =====================================================
       REJECTED
    ===================================================== */

    if (
      req.driver.status ===
      "rejected"
    ) {
      return res
        .status(403)
        .json({
          success:
            false,

          code:
            "DRIVER_REJECTED",

          status:
            "rejected",

          rejectionReason:
            req.driver
              .rejectionReason ||
            null,

          message:
            req.driver
              .rejectionReason
              ? "Your Driver application was rejected"
              : "Your Driver account is not approved",
        });
    }

    /* =====================================================
       UNKNOWN STATUS
    ===================================================== */

    return res
      .status(403)
      .json({
        success:
          false,

        code:
          "DRIVER_NOT_APPROVED",

        message:
          "Driver account is not approved",
      });
  };

/* =========================================================
   EXPORT
========================================================= */

export default verifyDriver;
