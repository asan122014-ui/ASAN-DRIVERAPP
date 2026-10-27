import mongoose from "mongoose";

const schema = new mongoose.Schema({
  announcementDeliveryId: { type: mongoose.Schema.Types.ObjectId, ref: 'AnnouncementDelivery', default: null },
  recipientType: { type: String, enum: ["parent", "driver"], required: true },
  tokens: [String],
  notification: { title: String, body: String },
  data: { type: Map, of: String },
  attempts: { type: Number, default: 0 },
  availableAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, default: () => new Date(Date.now() + 86400000) },
}, { timestamps: true });
schema.index({ availableAt: 1 });
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export default mongoose.model("PushDelivery", schema);
