import { body, validationResult } from "express-validator";

/* ================= DRIVER REGISTRATION VALIDATION ================= */

export const validateDriverRegistration = [

  body("name")
    .trim()
    .notEmpty()
    .withMessage("Driver name is required")
    .isLength({ min: 3 })
    .withMessage("Name must be at least 3 characters"),

  body("phone")
    .trim()
    .notEmpty()
    .withMessage("Phone number is required")
    .matches(/^[6-9]\d{9}$/)
    .withMessage("Invalid Indian phone number"),

  body("email")
    .trim()
    .optional()
    .isEmail()
    .withMessage("Invalid email address"),

  body("vehicleType")
    .notEmpty()
    .withMessage("Vehicle type is required"),

  body("vehicleNumber")
    .trim()
    .notEmpty()
    .withMessage("Vehicle number is required")
    .matches(/^[A-Z]{2}-\d{2}-[A-Z]{1,2}-\d{4}$/)
    .withMessage("Invalid vehicle registration number"),

  body("licenseNumber")
    .trim()
    .notEmpty()
    .withMessage("Driving license number is required"),

  body("password")
    .notEmpty()
    .withMessage("Password is required")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters")

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
