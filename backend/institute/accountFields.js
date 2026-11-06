import mongoose from 'mongoose';
// Membership is written only by authenticated Institute enrollment services.
export const accountFields = () => ({
  accountSource: { type: String, enum: ['individual', 'institute'], default: 'individual', index: true },
  instituteId: { type: mongoose.Schema.Types.ObjectId, ref: 'InstituteOrganization', default: null, index: true },
  instituteName: { type: String, default: '' },
  instituteReference: { type: String, default: '' },
});
