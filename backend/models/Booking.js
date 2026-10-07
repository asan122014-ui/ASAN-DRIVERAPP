import mongoose from "mongoose";

const bookingSchema = new mongoose.Schema({
  parentId: { type: mongoose.Schema.Types.ObjectId, ref: "Parent", required: true, index: true },
  childId: { type: mongoose.Schema.Types.ObjectId, ref: "Child", default: null },
  childIds: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: "Child" }], default: [] },
  child: {
    name: { type: String, required: true, trim: true },
    age: { type: Number, required: true, min: 1, max: 17 },
    school: { type: String, required: true, trim: true },
    grade: { type: String, default: "", trim: true },
  },
  children: {
    type: [{
      name: { type: String, required: true, trim: true },
      age: { type: Number, required: true, min: 1, max: 17 },
      gender: { type: String, default: "", trim: true },
      school: { type: String, required: true, trim: true },
      grade: { type: String, default: "", trim: true },
      section: { type: String, default: "", trim: true },
    }],
    default: [],
  },
  route: {
    pickup: { type: String, required: true, trim: true },
    dropoff: { type: String, required: true, trim: true },
    pickupCoordinates: { lat: Number, lng: Number },
    dropoffCoordinates: { lat: Number, lng: Number },
    distanceKm: { type: Number, required: true, min: 0 },
    durationMinutes: { type: Number, default: 0, min: 0 },
    pickupTime: { type: String, default: "", trim: true },
    schoolPickupTime: { type: String, default: "", trim: true },
  },
  quote: {
    currency: { type: String, default: "INR" },
    vehicleType: { type: String, enum: ["AUTO", "VAN"], default: "AUTO" },
    workingDays: { type: Number, required: true, min: 1 },
    childCount: { type: Number, required: true, min: 1 },
    ratePerKm: { type: Number, required: true, min: 0 },
    dailyDistanceCharge: { type: Number, min: 0 },
    distanceCharge: { type: Number, required: true, min: 0 },
    additionalChildCharge: { type: Number, required: true, min: 0 },
    rideSubtotal: { type: Number, required: true, min: 0 },
    platformFeeRate: { type: Number, default: 0.02, min: 0 },
    platformFee: { type: Number, required: true, min: 0 },
    tax: { type: Number, required: true, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    totalMonthly: { type: Number, required: true, min: 0 },
    expiresAt: { type: Date, required: true },
  },
  driverChoice: { type: String, enum: ["existing", "new"], required: true },
  requestedDriverId: { type: String, default: "", trim: true, uppercase: true },
  driverRequestId: { type: mongoose.Schema.Types.ObjectId, ref: "DriverRequest", default: null },
  assignedDriverId: { type: String, default: "", trim: true, uppercase: true },
  status: { type: String, enum: ["quoted", "awaiting_driver", "driver_searching", "driver_accepted", "awaiting_payment", "active", "cancelled", "expired"], default: "quoted", index: true },
  startDate: { type: Date, default: null },
  paymentId: { type: mongoose.Schema.Types.ObjectId, ref: "BookingPayment", default: null },
  paidAt: { type: Date, default: null },
  serviceStartsAt: { type: Date, default: null },
  serviceEndsAt: { type: Date, default: null },
}, { timestamps: true });

bookingSchema.index({ parentId: 1, createdAt: -1 });

export default mongoose.models.Booking || mongoose.model("Booking", bookingSchema);
