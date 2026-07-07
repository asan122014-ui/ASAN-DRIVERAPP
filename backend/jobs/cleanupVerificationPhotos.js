import Trips from "../models/Trips.js";
import { cloudinary } from "../config/cloudinary.js";

const cleanupVerificationPhotos = async () => {
  try {
    console.log("🧹 Running verification photo cleanup...");

    const trips = await Trips.findExpiredVerificationPhotos();

    for (const trip of trips) {
      /* ================= MORNING DROP ================= */
      if (
        trip.morningDrop?.publicId &&
        trip.morningDrop?.expiresAt &&
        trip.morningDrop.expiresAt <= new Date()
      ) {
        try {
          await cloudinary.uploader.destroy(trip.morningDrop.publicId);
          await trip.clearMorningDropPhoto();
          console.log(
            `✅ Deleted morning photo for ${trip.childName}`
          );
        } catch (err) {
          console.error(
            "Morning photo cleanup failed:",
            err.message
          );
        }
      }

      /* ================= AFTERNOON PICKUP ================= */
      if (
        trip.afternoonPickup?.publicId &&
        trip.afternoonPickup?.expiresAt &&
        trip.afternoonPickup.expiresAt <= new Date()
      ) {
        try {
          await cloudinary.uploader.destroy(
            trip.afternoonPickup.publicId
          );
          await trip.clearAfternoonPickupPhoto();
          console.log(
            `✅ Deleted afternoon photo for ${trip.childName}`
          );
        } catch (err) {
          console.error(
            "Afternoon photo cleanup failed:",
            err.message
          );
        }
      }
    }

    console.log("✅ Verification photo cleanup completed");
  } catch (error) {
    console.error(
      "Cleanup job failed:",
      error.message
    );
  }
};

export default cleanupVerificationPhotos;
