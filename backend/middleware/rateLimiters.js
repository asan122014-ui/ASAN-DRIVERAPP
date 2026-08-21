import {
  rateLimit,
} from "express-rate-limit";

/* =========================================================
   DRIVER OTP SEND LIMITER
========================================================= */

/*
  Used for:

  POST /api/driver-auth/send-login-otp
  POST /api/driver-auth/send-register-otp

  Every successful request sends an email,
  so this limiter is intentionally stricter.

  The Driver OTP controller also has a
  60-second resend cooldown per email.
*/

export const driverOtpSendLimiter =
  rateLimit({
    windowMs:
      15 * 60 * 1000,

    limit:
      8,

    standardHeaders:
      "draft-8",

    legacyHeaders:
      false,

    message: {
      success:
        false,

      message:
        "Too many Driver OTP requests. Please wait and try again later.",
    },
  });

/* =========================================================
   DRIVER OTP VERIFY LIMITER
========================================================= */

/*
  Used for:

  POST /api/driver-auth/verify-login-otp
  POST /api/driver-auth/verify-register-otp

  The OTP document already limits incorrect OTP
  attempts to 5.

  This limiter provides an additional HTTP-level
  protection against repeated requests.
*/

export const driverOtpVerifyLimiter =
  rateLimit({
    windowMs:
      15 * 60 * 1000,

    limit:
      20,

    standardHeaders:
      "draft-8",

    legacyHeaders:
      false,

    message: {
      success:
        false,

      message:
        "Too many Driver OTP verification attempts. Please try again later.",
    },
  });

/* =========================================================
   PARENT OTP SEND LIMITER
========================================================= */

/*
  Used for:

  POST /api/parent-auth/send-login-otp
  POST /api/parent-auth/send-register-otp

  Every successful request sends an email.
*/

export const parentOtpSendLimiter =
  rateLimit({
    windowMs:
      15 * 60 * 1000,

    limit:
      8,

    standardHeaders:
      "draft-8",

    legacyHeaders:
      false,

    message: {
      success:
        false,

      message:
        "Too many OTP requests. Please wait and try again later.",
    },
  });

/* =========================================================
   PARENT OTP VERIFY LIMITER
========================================================= */

/*
  Used for:

  POST /api/parent-auth/verify-login-otp
  POST /api/parent-auth/verify-register-otp

  Individual OTP documents already limit incorrect
  verification attempts.

  This adds HTTP-level protection.
*/

export const parentOtpVerifyLimiter =
  rateLimit({
    windowMs:
      15 * 60 * 1000,

    limit:
      20,

    standardHeaders:
      "draft-8",

    legacyHeaders:
      false,

    message: {
      success:
        false,

      message:
        "Too many OTP verification attempts. Please try again later.",
    },
  });

/* =========================================================
   GENERAL DRIVER AUTH LIMITER
========================================================= */

/*
  Retained temporarily for backward compatibility.

  If another Driver-related route still imports
  loginLimiter, it will continue working.

  New OTP routes should NOT use this limiter.
*/

export const loginLimiter =
  rateLimit({
    windowMs:
      15 * 60 * 1000,

    limit:
      10,

    standardHeaders:
      "draft-8",

    legacyHeaders:
      false,

    skipSuccessfulRequests:
      true,

    message: {
      success:
        false,

      message:
        "Too many login attempts. Please try again later.",
    },
  });

/* =========================================================
   GENERAL SIGNUP LIMITER
========================================================= */

/*
  Retained temporarily for backward compatibility.

  New Driver OTP registration does NOT need to use
  this limiter directly.
*/

export const signupLimiter =
  rateLimit({
    windowMs:
      60 * 60 * 1000,

    limit:
      10,

    standardHeaders:
      "draft-8",

    legacyHeaders:
      false,

    message: {
      success:
        false,

      message:
        "Too many signup attempts. Please try again later.",
    },
  });

/* =========================================================
   GENERAL PARENT AUTH LIMITER
========================================================= */

/*
  Retained for backward compatibility.

  This can later be removed after confirming
  nothing imports it.
*/

export const parentAuthLimiter =
  rateLimit({
    windowMs:
      15 * 60 * 1000,

    limit:
      30,

    standardHeaders:
      "draft-8",

    legacyHeaders:
      false,

    message: {
      success:
        false,

      message:
        "Too many authentication requests. Please try again later.",
    },
  });
