import mongoose from 'mongoose';
import { schoolDriverPrefix } from '../automaticEnrollment.js';

const instituteSchema = new mongoose.Schema(
  {
    managedEnrollmentEnabled: { type: Boolean, default: true },
    driverPrefix: { type: String, uppercase: true, trim: true, unique: true, sparse: true },
    driverSequence: { type: Number, default: 0 },
    pickupMode: { type: String, enum: ['door_to_door', 'route_stops'], default: 'door_to_door' },
    name: {
      type: String,
      required: [true, 'Institute name is required'],
      unique: true,
      trim: true
    },
    code: {
      type: String,
      required: [true, 'Institute access code is required'],
      unique: true,
      uppercase: true,
      trim: true
    },
    adminEmail: {
      type: String,
      required: true,
      lowercase: true,
      trim: true
    },
    location: {
      lat: {
        type: Number,
        default: 12.9716
      },
      lng: {
        type: Number,
        default: 77.6245
      },
      address: {
        type: String,
        default: ''
      }
    }
  },
  {
    timestamps: true
  }
);

instituteSchema.pre('validate', async function () {
  if (!this.isNew) return;
  this.managedEnrollmentEnabled = true;
  if (this.driverPrefix) return;
  for (let attempt = 0; attempt < 64; attempt++) {
    const prefix = schoolDriverPrefix(this.name, attempt);
    if (!await this.constructor.exists({ driverPrefix: prefix })) {
      this.driverPrefix = prefix;
      return;
    }
  }
  throw new Error('Unable to allocate a unique school driver prefix.');
});

const Institute = mongoose.models.InstituteOrganization || mongoose.model('InstituteOrganization', instituteSchema, 'institutes');

export default Institute;
