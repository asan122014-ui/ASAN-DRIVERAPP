import mongoose from 'mongoose';

const demoEnquirySchema = new mongoose.Schema({
  schoolName: { type: String, required: true, trim: true, maxlength: 200 },
  contactName: { type: String, required: true, trim: true, maxlength: 120 },
  email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
  phone: { type: String, required: true, trim: true, maxlength: 30 },
  message: { type: String, required: true, trim: true, maxlength: 3000 },
  status: { type: String, enum: ['new', 'contacted', 'closed'], default: 'new' },
  source: { type: String, default: 'institute-landing', immutable: true }
}, { timestamps: true, collection: 'institute_demo_enquiries' });

demoEnquirySchema.index({ createdAt: -1 });

export default mongoose.models.InstituteDemoEnquiry || mongoose.model('InstituteDemoEnquiry', demoEnquirySchema, 'institute_demo_enquiries');
