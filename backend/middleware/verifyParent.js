import jwt from "jsonwebtoken";
import Parent from "../models/Parent.js";

/* =========================================================
   VERIFY ASAN PARENT JWT
========================================================= */

const verifyParent = async (
  req,
  res,
  next
) => {
  try {
    /* =====================================================
       AUTHORIZATION HEADER
    ===================================================== */

    const authHeader =
      req.headers.authorization;

    if (
      !authHeader ||
      !authHeader.startsWith("Bearer ")
    ) {
      return res.status(401).json({
        success: false,
        message:
          "Parent authentication token missing",
      });
    }

    /* =====================================================
       TOKEN
    ===================================================== */

    const token =
      authHeader
        .slice(7)
        .trim();

    if (!token) {
      return res.status(401).json({
        success: false,
        message:
          "Parent authentication token missing",
      });
    }

    /* =====================================================
       JWT SECRET
    ===================================================== */

    const jwtSecret =
      process.env.JWT_SECRET;

    if (!jwtSecret) {
      console.error(
        "JWT_SECRET is not configured"
      );

      return res.status(500).json({
        success: false,
        message:
          "Authentication service unavailable",
      });
    }

    /* =====================================================
       VERIFY JWT
    ===================================================== */

    const decoded =
      jwt.verify(
        token,
        jwtSecret,
        {
          algorithms: ["HS256"],
        }
      );

    /* =====================================================
       REQUIRE PARENT TOKEN
    ===================================================== */

    if (
      decoded?.tokenType !==
      "parent"
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Invalid Parent authentication token",
      });
    }

    /* =====================================================
       REQUIRE MONGODB PARENT ID
    ===================================================== */

    if (!decoded?.id) {
      return res.status(401).json({
        success: false,
        message:
          "Invalid Parent authentication token",
      });
    }

    /* =====================================================
       GET CURRENT PARENT FROM MONGODB
    ===================================================== */

    const parent =
      await Parent.findById(
        decoded.id
      );

    if (!parent) {
      return res.status(401).json({
        success: false,
        message:
          "Parent account not found",
      });
    }

    /* =====================================================
       ACTIVE ACCOUNT CHECK
    ===================================================== */

    if (
      parent.isActive ===
      false
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Parent account is disabled",
      });
    }

    /* =====================================================
       ATTACH AUTHENTICATED PARENT
    ===================================================== */

    req.parent =
      parent;

    req.parentAuth = {
      id:
        String(
          parent._id
        ),

      phone:
        parent.phone,

      tokenType:
        "parent",
    };

    next();
  } catch (error) {
    console.error(
      "PARENT JWT AUTH ERROR:",
      error?.name ||
        error?.message
    );

    /* =====================================================
       EXPIRED
    ===================================================== */

    if (
      error.name ===
      "TokenExpiredError"
    ) {
      return res.status(401).json({
        success: false,
        message:
          "Parent session expired",
      });
    }

    /* =====================================================
       INVALID
    ===================================================== */

    if (
      error.name ===
      "JsonWebTokenError"
    ) {
      return res.status(401).json({
        success: false,
        message:
          "Invalid Parent authentication token",
      });
    }

    /* =====================================================
       TOKEN NOT ACTIVE YET
    ===================================================== */

    if (
      error.name ===
      "NotBeforeError"
    ) {
      return res.status(401).json({
        success: false,
        message:
          "Parent authentication token is not active yet",
      });
    }

    return res.status(401).json({
      success: false,
      message:
        "Parent authentication failed",
    });
  }
};

export default verifyParent;
