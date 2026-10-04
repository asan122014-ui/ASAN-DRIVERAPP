import mongoose from "mongoose";

const bookingSchema = new mongoose.Schema({
  parentId: { type: mongoose.Schema.Types.ObjectId, ref: "Parent", required: true, index: true },
  childId: { type: mongoose.Schema.Types.ObjectId, ref: "Child", default: null },
  child: {
    name: { type: String, required: true, trim: true },
    age: { type: Number, required: true, min: 1, max: 17 },
    school: { type: String, required: true, trim: true },
    grade: { type: String, default: "", trim: true },
  },
  route: {
    pickup: { type: String, required: true, trim: true },
    dropoff: { type: String, required: true, trim: true },
    pickupCoordinates: { lat: Number, lng: Number },
    dropoffCoordinates: { lat: Number, lng: Number },
    distanceKm: { type: Number, required: true, min: 0 },
    durationMinutes: { type: Number, default: 0, min: 0 },
  },
  quote: {
    baseMonthly: { type: Number, required: true, min: 0 },
    distanceCharge: { type: Number, required: true, min: 0 },
    serviceFee: { type: Number, required: true, min: 0 },
    tax: { type: Number, required: true, min: 0 },
    totalMonthly: { type: Number, required: true, min: 0 },
    expiresAt: { type: Date, required: true },
  },
  driverChoice: { type: String, enum: ["existing", "new"], required: true },
  requestedDriverId: { type: String, default: "", trim: true, uppercase: true },
  status: { type: String, enum: ["quoted", "awaiting_driver", "driver_searching", "driver_accepted", "awaiting_payment", "active", "cancelled", "expired"], default: "quoted", index: true },
  startDate: { type: Date, default: null },
}, { timestamps: true });

bookingSchema.index({ parentId: 1, createdAt: -1 });

export default mongoose.models.Booking || mongoose.model("Booking", bookingSchema);
