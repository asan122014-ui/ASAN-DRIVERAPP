import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: true },
  requestId: { type: String, required: true },
  payloadHash: { type: String, required: true },
  title: { type: String, required: true, maxlength: 120 },
  message: { type: String, required: true, maxlength: 2000 },
  recipientType: { type: String, enum: ['parent', 'driver'], required: true },
  scope: { type: String, enum: ['all', 'selected'], required: true },
  recipientCount: { type: Number, required: true },
}, { timestamps: true });
schema.index({ adminId: 1, requestId: 1 }, { unique: true });
schema.index({ createdAt: -1 });
export default mongoose.model('Announcement', schema);
