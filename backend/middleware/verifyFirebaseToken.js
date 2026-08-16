import { parentAuth } from "../config/firebaseAdmin.js";

/* =========================================================
   VERIFY FIREBASE PARENT TOKEN
========================================================= */

const verifyFirebaseToken = async (
  req,
  res,
  next
) => {
  try {
    /* =====================================================
       CHECK FIREBASE CONFIGURATION
    ===================================================== */

    if (!parentAuth) {
      console.error(
        "❌ Parent Firebase Auth is not initialized"
      );

      return res.status(500).json({
        success: false,
        message:
          "Parent authentication service unavailable",
      });
    }

    /* =====================================================
       GET AUTH HEADER
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
          "Firebase authentication token missing",
      });
    }

    /* =====================================================
       EXTRACT TOKEN
    ===================================================== */

    const idToken =
      authHeader
        .split(" ")[1]
        ?.trim();

    if (!idToken) {
      return res.status(401).json({
        success: false,
        message:
          "Firebase authentication token missing",
      });
    }

    /* =====================================================
       VERIFY FIREBASE ID TOKEN
    ===================================================== */

    const decodedToken =
      await parentAuth.verifyIdToken(
        idToken
      );

    /* =====================================================
       REQUIRE FIREBASE UID
    ===================================================== */

    if (!decodedToken?.uid) {
      return res.status(401).json({
        success: false,
        message:
          "Invalid Firebase authentication token",
      });
    }

    /* =====================================================
       REQUIRE PHONE NUMBER
    ===================================================== */

    /*
      Parent authentication is based on Firebase
      Phone Authentication.

      Firebase should provide a verified phone number
      after successful OTP verification.
    */

    if (
      !decodedToken.phone_number
    ) {
      return res.status(401).json({
        success: false,
        message:
          "Verified phone number not found",
      });
    }

    /* =====================================================
       ATTACH FIREBASE USER TO REQUEST
    ===================================================== */

    req.firebaseUser = {
      uid:
        decodedToken.uid,

      phone:
        decodedToken.phone_number,

      phoneNumber:
        decodedToken.phone_number,

      provider:
        decodedToken.firebase
          ?.sign_in_provider ||
        "phone",

      authTime:
        decodedToken.auth_time,

      issuedAt:
        decodedToken.iat,

      expiresAt:
        decodedToken.exp,
    };

    /* =====================================================
       CONTINUE
    ===================================================== */

    next();
  } catch (error) {
    console.error(
      "❌ Firebase Auth Error:",
      error.code ||
        error.message
    );

    /* =====================================================
       EXPIRED TOKEN
    ===================================================== */

    if (
      error.code ===
      "auth/id-token-expired"
    ) {
      return res.status(401).json({
        success: false,
        message:
          "Firebase authentication token expired",
      });
    }

    /* =====================================================
       REVOKED TOKEN
    ===================================================== */

    if (
      error.code ===
      "auth/id-token-revoked"
    ) {
      return res.status(401).json({
        success: false,
        message:
          "Firebase authentication token revoked",
      });
    }

    /* =====================================================
       INVALID TOKEN
    ===================================================== */

    if (
      error.code ===
        "auth/argument-error" ||
      error.code ===
        "auth/invalid-id-token"
    ) {
      return res.status(401).json({
        success: false,
        message:
          "Invalid Firebase authentication token",
      });
    }

    /* =====================================================
       GENERAL AUTH FAILURE
    ===================================================== */

    return res.status(401).json({
      success: false,
      message:
        "Firebase authentication failed",
    });
  }
};

export default verifyFirebaseToken;
