import {
  rateLimit,
} from "express-rate-limit";

/* =========================================================
   DRIVER LOGIN LIMITER
========================================================= */

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

    /*
      Successful logins should not consume
      the failed-login allowance.
    */

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
   DRIVER SIGNUP LIMITER
========================================================= */

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
   PARENT OTP SEND LIMITER

   Used for:
   - send-login-otp
   - send-register-otp

   This is intentionally stricter because
   every successful request sends an email.
========================================================= */

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

   Used for:
   - verify-login-otp
   - verify-register-otp

   The OTP document itself already limits
   incorrect OTP attempts, but this also
   protects the endpoint at the HTTP level.
========================================================= */

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
   GENERAL PARENT AUTH LIMITER

   Kept for backward compatibility in case
   another Parent auth route still imports it.

   We can remove this later after a global
   search confirms it is unused.
========================================================= */

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
