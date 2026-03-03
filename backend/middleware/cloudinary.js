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

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "asan-drivers",
    allowed_formats: ["jpg", "png", "jpeg"],
  },
});

const upload = multer({ storage });

export { cloudinary, upload };
