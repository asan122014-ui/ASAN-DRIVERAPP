import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
{
  driver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Driver",   // ✅ MUST be Driver
    required: true
  },

  title: {
    type: String,
    required: true
  },

  message: {
    type: String,
    required: true
  },

  read: {
    type: Boolean,
    default: false
  }

},
{ timestamps: true }
);

const Notification = mongoose.model("Notification", notificationSchema);

export default Notification;
