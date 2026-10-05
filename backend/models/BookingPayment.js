import mongoose from "mongoose";

const schema = new mongoose.Schema({
  bookingId: { type: mongoose.Schema.Types.ObjectId, ref: "Booking", required: true, unique: true },
  parentId: { type: mongoose.Schema.Types.ObjectId, ref: "Parent", required: true, index: true },
  orderId: { type: String, required: true, unique: true },
  idempotencyKey: { type: String, required: true },
  attempt: { type: Number, default: 1 },
  amount: { type: Number, required: true, min: 1 },
  currency: { type: String, default: "INR" },
  environment: { type: String, enum: ["sandbox", "production"], required: true },
  status: { type: String, enum: ["CREATED", "ACTIVE", "PENDING", "FAILED", "EXPIRED", "TERMINATED", "PAID"], default: "CREATED" },
  paymentId: { type: String, default: "" },
  paidAt: Date,
}, { timestamps: true });
export default mongoose.models.BookingPayment || mongoose.model("BookingPayment", schema);
