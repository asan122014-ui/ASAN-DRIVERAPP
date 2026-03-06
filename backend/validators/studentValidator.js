import { body, param, validationResult } from "express-validator";

/* ================= ADD STUDENT VALIDATION ================= */

export const validateAddStudent = [

  body("name")
    .trim()
    .notEmpty()
    .withMessage("Student name is required")
    .isLength({ min: 3 })
    .withMessage("Name must be at least 3 characters"),

  body("phone")
    .optional()
    .trim()
    .matches(/^[6-9]\d{9}$/)
    .withMessage("Invalid Indian phone number"),

  body("address")
    .notEmpty()
    .withMessage("Address is required"),

  body("driver")
    .optional()
    .isMongoId()
    .withMessage("Invalid driver ID")

];

/* ================= UPDATE STUDENT VALIDATION ================= */

export const validateUpdateStudent = [

  param("id")
    .isMongoId()
    .withMessage("Invalid student ID"),

  body("name")
    .optional()
    .isLength({ min: 3 })
    .withMessage("Name must be at least 3 characters"),

  body("phone")
    .optional()
    .matches(/^[6-9]\d{9}$/)
    .withMessage("Invalid phone number")

];

/* ================= PICKUP/DROP VALIDATION ================= */

export const validateStudentAction = [

  param("id")
    .isMongoId()
    .withMessage("Invalid student ID")

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