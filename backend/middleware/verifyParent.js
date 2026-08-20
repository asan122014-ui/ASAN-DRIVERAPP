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
       EXTRACT TOKEN
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
       REQUIRE PARENT DATABASE ID
    ===================================================== */

    if (!decoded?.id) {
      return res.status(401).json({
        success: false,
        message:
          "Invalid Parent authentication token",
      });
    }

    /* =====================================================
       FIND CURRENT PARENT
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
       OPTIONAL ACCOUNT STATUS CHECK
    ===================================================== */

    if (
      parent.status &&
      String(parent.status)
        .toLowerCase() ===
        "blocked"
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Parent account is blocked",
      });
    }

    /* =====================================================
       ATTACH AUTHENTICATED PARENT
    ===================================================== */

    req.parent =
      parent;

    req.parentAuth = {
      id:
        String(parent._id),

      parentId:
        parent.parentId || null,

      phone:
        parent.phone ||
        parent.phoneNumber ||
        null,

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
       EXPIRED JWT
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
       INVALID JWT
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
       NOT ACTIVE YET
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
