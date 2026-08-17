import { v2 as cloudinary } from "cloudinary";
import multer from "multer";
import pkg from "multer-storage-cloudinary";

const { CloudinaryStorage } = pkg;

/* =========================================================
   CLOUDINARY ENV VALIDATION
========================================================= */

const requiredCloudinaryEnv = [
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
];

const missingCloudinaryEnv =
  requiredCloudinaryEnv.filter(
    (key) =>
      !process.env[key]
  );

if (
  missingCloudinaryEnv.length >
  0
) {
  throw new Error(
    `Cloudinary configuration missing: ${missingCloudinaryEnv.join(
      ", "
    )}`
  );
}

/* =========================================================
   CLOUDINARY CONFIGURATION
========================================================= */

cloudinary.config({
  cloud_name:
    process.env
      .CLOUDINARY_CLOUD_NAME,

  api_key:
    process.env
      .CLOUDINARY_API_KEY,

  api_secret:
    process.env
      .CLOUDINARY_API_SECRET,

  secure: true,
});

/* =========================================================
   ALLOWED IMAGE TYPES
========================================================= */

const ALLOWED_IMAGE_TYPES =
  new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
  ]);

/* =========================================================
   FILE FILTER
========================================================= */

const fileFilter = (
  req,
  file,
  cb
) => {
  if (
    !file?.mimetype ||
    !ALLOWED_IMAGE_TYPES.has(
      file.mimetype
        .toLowerCase()
    )
  ) {
    return cb(
      new Error(
        "Only JPG, JPEG, PNG and WEBP image files are allowed"
      ),
      false
    );
  }

  return cb(
    null,
    true
  );
};

/* =========================================================
   GENERATE UNIQUE PUBLIC ID
========================================================= */

const generatePublicId = () => {
  return `${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
};

/* =========================================================
   DRIVER STORAGE
========================================================= */

/*
  Used for:

  - Profile photo
  - Driving licence
  - RC
  - Insurance
  - ID proof

  Current Driver APIs expect image uploads.
*/

const driverStorage =
  new CloudinaryStorage({
    cloudinary,

    params: async () => ({
      folder:
        "asan/drivers",

      resource_type:
        "image",

      allowed_formats: [
        "jpg",
        "jpeg",
        "png",
        "webp",
      ],

      public_id:
        generatePublicId(),
    }),
  });

/* =========================================================
   STUDENT / TRIP VERIFICATION STORAGE
========================================================= */

const studentVerificationStorage =
  new CloudinaryStorage({
    cloudinary,

    params: async () => ({
      folder:
        "asan/student-verification",

      resource_type:
        "image",

      allowed_formats: [
        "jpg",
        "jpeg",
        "png",
        "webp",
      ],

      public_id:
        generatePublicId(),
    }),
  });

/* =========================================================
   DRIVER UPLOAD
========================================================= */

const driverUpload =
  multer({
    storage:
      driverStorage,

    limits: {
      fileSize:
        10 *
        1024 *
        1024,
    },

    fileFilter,
  });

/* =========================================================
   STUDENT VERIFICATION UPLOAD
========================================================= */

const studentVerificationUpload =
  multer({
    storage:
      studentVerificationStorage,

    limits: {
      fileSize:
        10 *
        1024 *
        1024,
    },

    fileFilter,
  });

/* =========================================================
   EXPORTS
========================================================= */

export {
  cloudinary,
  driverUpload,
  studentVerificationUpload,
};
