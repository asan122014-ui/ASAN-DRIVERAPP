import mongoose from "mongoose";

const driverSchema = new mongoose.Schema(
  {
    name: String,
    phone: String,
    email: String,
    password: String,
    address: String,

    vehicleNumber: String,
    vehicleType: String,
    licenseNumber: String,

    driverId: {
      type: String,
      unique: true
    },

    rating: {
      type: Number,
      default: 0
    },

    totalTrips: {
      type: Number,
      default: 0
    }
  },
  { timestamps: true }
);

export default mongoose.model("Driver", driverSchema);