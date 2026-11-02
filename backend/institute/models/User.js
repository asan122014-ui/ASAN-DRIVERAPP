import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address']
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters']
    },
    role: {
      type: String,
      enum: ['Institute Admin', 'Transport Manager', 'Accounts/Admin Staff', 'Viewer'],
      default: 'Institute Admin'
    },
    instituteName: {
      type: String,
      default: '',
      trim: true
    },
    instituteCode: {
      type: String,
      default: '',
      uppercase: true,
      trim: true
    },
    instituteLocation: {
      lat: { type: Number },
      lng: { type: Number },
      address: { type: String, default: '' }
    },
    lastLogin: {
      type: Date,
      default: Date.now
    },
    passwordResetTokenHash: {
      type: String,
      default: ''
    },
    passwordResetExpiresAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

// Do not return password in JSON queries
userSchema.methods.toJSON = function () {
  const user = this.toObject();
  delete user.password;
  delete user.passwordResetTokenHash;
  delete user.passwordResetExpiresAt;
  return user;
};

const User = mongoose.models.InstituteUser || mongoose.model('InstituteUser', userSchema, 'institute_users');

export default User;
