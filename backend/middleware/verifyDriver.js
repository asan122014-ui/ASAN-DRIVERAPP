import jwt from "jsonwebtoken";
import mongoose from "mongoose";

import Driver from "../models/Driver.js";

/* =========================================================
   VERIFY DRIVER
========================================================= */

const verifyDriver = async (
  req,
  res,
  next
) => {
  try {
    /* =====================================================
       JWT CONFIGURATION
    ===================================================== */

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

    /* =====================================================
       AUTHORIZATION HEADER
    ===================================================== */

    const authHeader =
      req.headers.authorization;

    if (
      !authHeader ||
      !authHeader.startsWith(
        "Bearer "
      )
    ) {
      return res.status(401).json({
        success: false,
        message:
          "Driver authentication required",
      });
    }

    const token =
      authHeader
        .slice(7)
        .trim();

    if (!token) {
      return res.status(401).json({
        success: false,
        message:
          "Driver authentication required",
      });
    }

    /* =====================================================
       VERIFY TOKEN
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
       DRIVER TOKEN TYPE
    ===================================================== */

    if (
      !decoded ||
      typeof decoded !==
        "object" ||
      decoded.tokenType !==
        "driver" ||
      !decoded.id ||
      !decoded.driverId
    ) {
      return res.status(401).json({
        success: false,
        message:
          "Invalid Driver token",
      });
    }

    /* =====================================================
       MONGODB ID
    ===================================================== */

    if (
      !mongoose.Types.ObjectId.isValid(
        String(decoded.id)
      )
    ) {
      return res.status(401).json({
        success: false,
        message:
          "Invalid Driver token",
      });
    }

    /* =====================================================
       CURRENT DRIVER ACCOUNT
    ===================================================== */

    const driver =
      await Driver.findById(
        decoded.id
      );

    if (!driver) {
      return res.status(401).json({
        success: false,
        message:
          "Driver account not found",
      });
    }

    /* =====================================================
       DRIVER ID MATCH
    ===================================================== */

    if (
      String(
        driver.driverId
      ) !==
      String(
        decoded.driverId
      )
    ) {
      return res.status(401).json({
        success: false,
        message:
          "Invalid Driver token",
      });
    }

    /* =====================================================
       APPROVAL
    ===================================================== */

    if (
      driver.status !==
      "approved"
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Driver account is not approved",
      });
    }

    /* =====================================================
       AUTHENTICATED DRIVER
    ===================================================== */

    req.driver = driver;

    req.driverAuth = {
      id:
        String(
          driver._id
        ),

      driverId:
        driver.driverId,

      email:
        driver.email,
    };

    return next();
  } catch (error) {
    if (
      error?.name ===
      "TokenExpiredError"
    ) {
      return res.status(401).json({
        success: false,
        message:
          "Driver session expired",
      });
    }

    if (
      error?.name ===
        "JsonWebTokenError" ||
      error?.name ===
        "NotBeforeError"
    ) {
      return res.status(401).json({
        success: false,
        message:
          "Invalid Driver token",
      });
    }

    console.error(
      "DRIVER AUTH ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Driver authentication failed",
    });
  }
};

export default verifyDriver;
