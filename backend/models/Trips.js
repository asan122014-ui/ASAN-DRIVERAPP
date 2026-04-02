import mongoose from "mongoose";

const tripSchema = new mongoose.Schema(
  {
    /* ================= DRIVER ================= */
    driverId: {
      type: String,
      required: true,
      index: true,
    },

    /* ================= 🔥 PARENT ================= */
    parent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Parent",
      required: true,
      index: true,
    },

    /* ================= 🔥 CHILD ================= */
    child: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Child",
      required: true,
      index: true,
    },

    /* ================= TRIP TYPE ================= */
    tripType: {
      type: String,
      enum: ["morning", "afternoon"],
      required: true,
    },

    /* ================= STATUS ================= */
    status: {
      type: String,
      enum: ["in_transit", "completed"],
      default: "in_transit",
      index: true,
    },

    /* ================= STUDENTS (ALL CHILDREN UNDER DRIVER) ================= */
    students: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Child",
      },
    ],

    totalStudents: {
      type: Number,
      default: 0,
      min: 0,
    },

    /* ================= UI DATA ================= */
    childName: {
      type: String,
      default: "Student",
      trim: true,
    },

    route: {
      from: {
        type: String,
        default: "--",
        trim: true,
      },
      to: {
        type: String,
        default: "--",
        trim: true,
      },
    },

    eta: {
      type: String,
      default: "--",
    },

    /* ================= OPTIONAL ================= */
    amount: {
      type: Number,
      default: 0,
      min: 0,
    },

    /* ================= TIME ================= */
    startTime: {
      type: Date,
      default: Date.now,
    },

    endTime: {
      type: Date,
      default: null,
    },

    duration: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

/* ================= INDEXES ================= */

// 🔥 driver queries
tripSchema.index({ driverId: 1, status: 1 });
tripSchema.index({ driverId: 1, createdAt: -1 });

// 🔥 parent queries (VERY IMPORTANT)
tripSchema.index({ parent: 1, createdAt: -1 });

// 🔥 child queries
tripSchema.index({ child: 1, createdAt: -1 });

/* ================= EXPORT ================= */
const Trips = mongoose.model("Trips", tripSchema);
export default Trips;
