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
      success: false,

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
      success: false,

      message:
        "Too many signup attempts. Please try again later.",
    },
  });

/* =========================================================
   PARENT AUTH LIMITER
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
      success: false,

      message:
        "Too many authentication requests. Please try again later.",
    },
  });
