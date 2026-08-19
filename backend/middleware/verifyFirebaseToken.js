import { parentAuth } from "../config/firebaseAdmin.js";

/* =========================================================
   VERIFY FIREBASE PARENT TOKEN
========================================================= */

const verifyFirebaseToken = async (
  req,
  res,
  next
) => {
   console.log(
      "🔥 NEW PARENT FIREBASE MIDDLEWARE V2");
  try {
    /* =====================================================
       FIREBASE CONFIGURATION
    ===================================================== */

    if (!parentAuth) {
      console.error(
        "Parent Firebase Auth is not initialized"
      );

      return res.status(500).json({
        success: false,
        message:
          "Parent authentication service unavailable",
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
          "Firebase authentication token missing",
      });
    }

    /* =====================================================
       EXTRACT TOKEN
    ===================================================== */

    const idToken =
      authHeader
        .slice(7)
        .trim();

    if (!idToken) {
      return res.status(401).json({
        success: false,
        message:
          "Firebase authentication token missing",
      });
    }

    /* =====================================================
       VERIFY FIREBASE TOKEN
    ===================================================== */

    /*
      true = also verify whether the Firebase
      refresh-token session was revoked.
    */

    const decodedToken =
      await parentAuth.verifyIdToken(
        idToken,
        true
      );

    /* =====================================================
       FIREBASE UID
    ===================================================== */

    if (!decodedToken?.uid) {
      return res.status(401).json({
        success: false,
        message:
          "Invalid Firebase authentication token",
      });
    }

    /* =====================================================
       PHONE NUMBER
    ===================================================== */

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
       REQUIRE PHONE AUTH PROVIDER
    ===================================================== */

    const signInProvider =
      decodedToken.firebase
        ?.sign_in_provider;

    if (
      signInProvider !==
      "phone"
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Parent login requires phone authentication",
      });
    }

    /* =====================================================
       ATTACH VERIFIED FIREBASE USER
    ===================================================== */

    req.firebaseUser = {
      uid:
        decodedToken.uid,

      phone:
        decodedToken.phone_number,

      phoneNumber:
        decodedToken.phone_number,

      provider:
        signInProvider,

      authTime:
        decodedToken.auth_time,

      issuedAt:
        decodedToken.iat,

      expiresAt:
        decodedToken.exp,
    };

    next();
  } catch (error) {
    console.error(
      "FIREBASE PARENT AUTH ERROR:",
      error.code ||
        error.message
    );

    /* =====================================================
       EXPIRED
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
       REVOKED
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

    return res.status(401).json({
      success: false,
      message:
        "Firebase authentication failed",
    });
  }
};

export default verifyFirebaseToken;
