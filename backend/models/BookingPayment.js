import mongoose from "mongoose";

const schema = new mongoose.Schema({
  bookingId: { type: mongoose.Schema.Types.ObjectId, ref: "Booking", required: true, unique: true },
  parentId: { type: mongoose.Schema.Types.ObjectId, ref: "Parent", required: true, index: true },
  orderId: { type: String, required: true, unique: true },
  provider: { type: String, enum: ["cashfree", "razorpay", "coupon"], default: "razorpay" },
  idempotencyKey: { type: String, required: true },
  attempt: { type: Number, default: 1 },
  amount: { type: Number, required: true, min: 0 },
  quoteSnapshot: { type: mongoose.Schema.Types.Mixed, default: null },
  routeSnapshot: { type: mongoose.Schema.Types.Mixed, default: null },
  currency: { type: String, default: "INR" },
  environment: { type: String, enum: ["sandbox", "production"], required: true },
  status: { type: String, enum: ["CREATING", "CREATED", "ACTIVE", "PENDING", "FAILED", "EXPIRED", "TERMINATED", "CANCELLED", "REFUNDING", "REFUNDED", "REFUND_FAILED", "PAID", "WAIVED"], default: "CREATING" },
  paymentId: { type: String, default: "" },
  paidAt: Date,
}, { timestamps: true });
schema.pre("validate", function () {
  if (this.provider !== "coupon" && this.amount < 1) this.invalidate("amount", "Gateway payments must be at least one rupee.");
  if (this.provider === "coupon" && (this.amount !== 0 || this.status !== "WAIVED" || this.paymentId || this.paidAt)) this.invalidate("provider", "Coupon records must be zero-value waivers, without a captured payment.");
});
export default mongoose.models.BookingPayment || mongoose.model("BookingPayment", schema);
