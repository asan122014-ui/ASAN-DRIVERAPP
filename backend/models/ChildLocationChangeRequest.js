import mongoose from "mongoose";

const schema = new mongoose.Schema({
  parentId: { type: mongoose.Schema.Types.ObjectId, ref: "Parent", required: true, index: true },
  childId: { type: mongoose.Schema.Types.ObjectId, ref: "Child", required: true, index: true },
  parentName: { type: String, default: "" },
  parentPhone: { type: String, default: "" },
  childName: { type: String, default: "" },
  locationType: { type: String, enum: ["home", "school"], required: true },
  reason: { type: String, required: true, trim: true, maxlength: 1000 },
  status: { type: String, enum: ["pending", "approved", "rejected", "awaiting_payment", "completed"], default: "pending", index: true },
  decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", default: null },
  decidedAt: { type: Date, default: null },
  decisionNote: { type: String, default: "" },
  proposedAddress: { type: String, default: "" },
  proposedCoordinates: { lat: Number, lng: Number },
  proposedDurationMinutes: { type: Number, default: 0 },
  oldDistanceKm: { type: Number, default: 0 },
  newDistanceKm: { type: Number, default: 0 },
  addedDistanceKm: { type: Number, default: 0 },
  remainingServiceDays: { type: Number, default: 0 },
  extraDistanceDailyCharge: { type: Number, default: 0 },
  distanceChargeDue: { type: Number, default: 0 },
  platformFeeDue: { type: Number, default: 0 },
  oldMonthlyPrice: { type: Number, default: 0 },
  newMonthlyPrice: { type: Number, default: 0 },
  amountDue: { type: Number, default: 0 },
  driverAmountDue: { type: Number, default: 0 },
  nextQuote: { type: mongoose.Schema.Types.Mixed, default: null },
  bookingId: { type: mongoose.Schema.Types.ObjectId, ref: "Booking", default: null },
  paymentOrderId: { type: String, default: "" },
  paymentId: { type: String, default: "" },
  paidAt: { type: Date, default: null },
  waivedAmount: { type: Number, default: 0 },
  chargeWaivedAt: { type: Date, default: null },
  appliedAt: { type: Date, default: null },
}, { timestamps: true });

schema.index({ childId: 1, locationType: 1, status: 1 });

export default mongoose.models.ChildLocationChangeRequest || mongoose.model("ChildLocationChangeRequest", schema);
