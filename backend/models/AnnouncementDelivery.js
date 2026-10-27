import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  announcementId: { type: mongoose.Schema.Types.ObjectId, ref: 'Announcement', required: true, index: true },
  recipientId: { type: mongoose.Schema.Types.ObjectId, required: true },
  recipientType: { type: String, enum: ['parent', 'driver'], required: true },
  recipientName: String,
  tokenCount: { type: Number, default: 0 },
  acceptedCount: { type: Number, default: 0 },
  failedCount: { type: Number, default: 0 },
  expiresAt: { type: Date, required: true },
}, { timestamps: true });
schema.index({ announcementId: 1, recipientId: 1 }, { unique: true });
export default mongoose.model('AnnouncementDelivery', schema);
