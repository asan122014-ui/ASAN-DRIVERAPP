import {
  rateLimit,
} from "express-rate-limit";

/* =========================================================
   AUTH LOGIN LIMITER
========================================================= */

/*
  Protect password-based authentication endpoints.

  10 attempts per 15 minutes per IP.
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

    message: {
      success:
        false,

      message:
        "Too many login attempts. Please try again later.",
    },
  });

/* =========================================================
   SIGNUP LIMITER
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
        "Too many account creation attempts. Please try again later.",
    },
  });

/* =========================================================
   PARENT AUTH LIMITER
========================================================= */

/*
  Firebase handles OTP protection separately.

  This protects our own login/register endpoints from
  excessive backend requests.
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

/* =========================================================
   SENSITIVE WRITE LIMITER
========================================================= */

export const sensitiveActionLimiter =
  rateLimit({
    windowMs:
      15 * 60 * 1000,

    limit:
      60,

    standardHeaders:
      "draft-8",

    legacyHeaders:
      false,

    message: {
      success:
        false,

      message:
        "Too many requests. Please try again later.",
    },
  });
