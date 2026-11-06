import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  instituteId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, required: true },
  publicId: { type: String, required: true },
  format: String,
  field: { type: String, required: true },
  originalName: String,
}, { timestamps: true });
export default mongoose.models.InstituteEnrollmentAsset || mongoose.model('InstituteEnrollmentAsset', schema);
