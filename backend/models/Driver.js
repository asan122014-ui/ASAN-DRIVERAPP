import mongoose from "mongoose";

const driverSchema = new mongoose.Schema(
{
  name: {
    type: String,
    required: true
  },

  phone: {
    type: String,
    required: true
  },

  email: {
    type: String,
    required: true
  },

  password: {
    type: String,
    required: true
  },

  address: {
    type: String,
    required: true
  },

  vehicleNumber: {
    type: String,
    required: true
  },

  vehicleType: {
    type: String,
    required: true
  },

  licenseNumber: {
    type: String,
    required: true
  },

  // ✅ Driving License
  licenseFront: {
    type: String,
    required: true
  },

  licenseBack: {
    type: String,
    required: true
  },

  // ✅ RC
  rcFront: {
    type: String,
    required: true
  },

  rcBack: {
    type: String,
    required: true
  },

  // ✅ Insurance
  insurance: {
    type: String,
    required: true
  },

  // ✅ ID proof (Aadhaar / Passport / PAN)
  idType: {
    type: String
  },

  idFront: {
    type: String,
    required: true
  },

  idBack: {
    type: String,
    required: true
  },

  // ✅ Unique Driver ID
  driverId: {
    type: String,
    unique: true
  },

  // ✅ Admin approval
  status: {
    type: String,
    enum: ["pending", "approved", "rejected"],
    default: "pending"
  },

  rejectionReason: {
    type: String
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
