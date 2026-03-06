import { body, param, validationResult } from "express-validator";

/* ================= START TRIP VALIDATION ================= */

export const validateStartTrip = [

  body("tripType")
    .notEmpty()
    .withMessage("Trip type is required")
    .isIn(["morning", "afternoon"])
    .withMessage("Trip type must be either 'morning' or 'afternoon'")

];


/* ================= END TRIP VALIDATION ================= */

export const validateEndTrip = [

  body("tripId")
    .optional()
    .isMongoId()
    .withMessage("Invalid trip ID")

];


/* ================= TRIP ID PARAM VALIDATION ================= */

export const validateTripId = [

  param("id")
    .isMongoId()
    .withMessage("Invalid trip ID")

];


/* ================= VALIDATION RESULT HANDLER ================= */

export const validateRequest = (req, res, next) => {

  const errors = validationResult(req);

  if (!errors.isEmpty()) {

    return res.status(400).json({
      success: false,
      errors: errors.array()
    });

  }

  next();

};