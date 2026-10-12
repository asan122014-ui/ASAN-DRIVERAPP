import "dotenv/config";
import mongoose from "mongoose";
import Driver from "../models/Driver.js";
import Child from "../models/Child.js";

// This deliberately never converts or overwrites an existing normal account.
const email = String(process.env.PLAY_REVIEW_EMAIL || "").trim().toLowerCase();
if (!email || !process.env.MONGO_URI || !process.env.PLAY_REVIEW_PHONE) {
  throw new Error("Set MONGO_URI, PLAY_REVIEW_EMAIL and a dedicated PLAY_REVIEW_PHONE before provisioning.");
}
try {
  await mongoose.connect(process.env.MONGO_URI);
  let driver = await Driver.findByEmail(email);
  if (driver && !driver.isPlayReviewAccount) {
    if (email !== "saiakshith1415@gmail.com" || driver.phone !== "9493680383" ||
        process.env.PLAY_REVIEW_CONVERT_CONFIRMED_TEST_ACCOUNT !== "true") {
      throw new Error("Existing account is not the admin-confirmed test account. No changes were made.");
    }
    const linkedChildren = await Child.countDocuments({ driverId: driver.driverId });
    const bookings = await mongoose.connection.collection("bookings").countDocuments({
      $or: [{ driverId: driver.driverId }, { driverId: driver._id }, { driver: driver._id }, { driver: driver.driverId }],
    });
    if (linkedChildren || bookings) {
      throw new Error("Existing families/bookings are linked to this account. Verify they are synthetic before enabling review access; no changes were made.");
    }
    await Driver.collection.updateOne({ _id: driver._id }, {
      $set: { isPlayReviewAccount: true, status: "approved" },
    });
    driver = await Driver.findById(driver._id);
  }
  if (!driver) {
    const document = "Sample document — Google Play review only";
    driver = await Driver.create({
      name: "Google Play Review Captain", email,
      phone: process.env.PLAY_REVIEW_PHONE,
      address: "Sample review account", vehicleNumber: "REVIEWONLY",
      vehicleType: "Auto", licenseNumber: "REVIEWONLY",
      licenseFront: document, licenseBack: document, rcFront: document,
      rcBack: document, insurance: document, idFront: document, idBack: document,
      driverId: `ASAN-REVIEW-${new mongoose.Types.ObjectId().toString().slice(-6).toUpperCase()}`,
      isPlayReviewAccount: true, status: "approved",
    });
  }
  console.log(`Review account ready. PLAY_REVIEW_DRIVER_ID=${driver._id}`);
} finally {
  await mongoose.disconnect();
}
