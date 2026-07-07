import { v2 as cloudinary } from "cloudinary";
import multer from "multer";
import pkg from "multer-storage-cloudinary";
import dotenv from "dotenv";

dotenv.config();

const { CloudinaryStorage } = pkg;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ============================================================
// FILE FILTER - Only allow images
// ============================================================
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(new Error("Only image files are allowed"), false);
  }
};

// ============================================================
// DRIVER PROFILE PHOTO STORAGE
// ============================================================
const driverStorage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => ({
    folder: "asan/drivers",
    resource_type: "image",
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
    public_id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  }),
});

// ============================================================
// STUDENT VERIFICATION PHOTO STORAGE
// ============================================================
const studentVerificationStorage = new CloudinaryStorage({
  cloudinary,
  params: async () => ({
    folder: "asan/student-verification",
    resource_type: "image",
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
    public_id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  }),
});

// ============================================================
// MULTER CONFIGURATIONS
// ============================================================
const driverUpload = multer({
  storage: driverStorage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter,
});

const studentVerificationUpload = multer({
  storage: studentVerificationStorage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter,
});

// ============================================================
// EXPORTS
// ============================================================
export {
  cloudinary,
  driverUpload,
  studentVerificationUpload,
};
