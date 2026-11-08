import mongoose from 'mongoose';

const recordSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    module: { type: String, required: true, index: true },
    instituteName: { type: String, default: '', index: true },
    data: { type: mongoose.Schema.Types.Mixed, required: true },
    created: { type: String, required: true },
    coreLink: { type: mongoose.Schema.Types.Mixed, default: null },
    assignmentRevision: { type: Number, default: 0 },
    homePickupOrder: { type: [String], default: undefined },
    homeDropOrder: { type: [String], default: undefined },
    homePickupTimes: { type: mongoose.Schema.Types.Mixed, default: {} },
    homeDropTimes: { type: mongoose.Schema.Types.Mixed, default: {} },
    stops: { type: [mongoose.Schema.Types.Mixed], default: undefined },
    deviated: Boolean, deviationAlert: String
  },
  { timestamps: true, minimize: false }
);

const Record = mongoose.models.InstituteRecord || mongoose.model('InstituteRecord', recordSchema, 'institute_records');

export default Record;
