import mongoose from "mongoose";

const payoutProofSchema = new mongoose.Schema({
  publicId: { type: String, required: true, trim: true },
  resourceType: { type: String, default: "image" },
  format: { type: String, default: "jpg" },
}, { _id: false });

const driverPayoutSchema = new mongoose.Schema({
  invoiceId: { type: mongoose.Schema.Types.ObjectId, ref: "Invoice", default: null },
  bookingId: { type: mongoose.Schema.Types.ObjectId, ref: "Booking", default: null },
  locationChangeRequestId: { type: mongoose.Schema.Types.ObjectId, ref: "ChildLocationChangeRequest", default: null },
  driverId: { type: String, required: true, uppercase: true, trim: true },
  installment: { type: String, enum: ["mid_service", "service_complete"], required: true },
  amount: { type: Number, required: true, min: 0 },
  status: { type: String, enum: ["Pending", "Paid"], default: "Pending" },
  paidAt: { type: Date, default: null },
  proof: { type: payoutProofSchema, default: null },
  markedPaidBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", default: null },
}, { timestamps: true });

driverPayoutSchema.index({ invoiceId: 1, installment: 1 }, { unique: true, partialFilterExpression: { invoiceId: { $type: "objectId" } } });
driverPayoutSchema.index({ bookingId: 1, installment: 1 }, { unique: true, partialFilterExpression: { bookingId: { $type: "objectId" } } });
driverPayoutSchema.index({ locationChangeRequestId: 1, installment: 1 }, { unique: true, partialFilterExpression: { locationChangeRequestId: { $type: "objectId" } } });
driverPayoutSchema.index({ driverId: 1, createdAt: -1 });

export default mongoose.models.DriverPayout || mongoose.model("DriverPayout", driverPayoutSchema);
