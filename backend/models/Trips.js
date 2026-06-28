import mongoose from "mongoose";

const tripSchema = new mongoose.Schema(
  {
    /* ================= DRIVER ================= */
    driverId: {
      type: String,
      required: true,
      index: true,
    },

    /* ================= PARENT ================= */
    parent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Parent",
      required: true,
      index: true,
    },

    /* ================= CHILD ================= */
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
      enum: [
        "waiting",
        "in_transit",
        "completed",
        "cancelled",
      ],
      default: "in_transit",
      index: true,
    },

    /* ================= PICKUP ================= */
    pickupStatus: {
      type: Boolean,
      default: false,
    },

    pickupTime: {
      type: Date,
      default: null,
    },

    /* ================= DROP ================= */
    dropStatus: {
      type: Boolean,
      default: false,
    },

    dropTime: {
      type: Date,
      default: null,
    },

    /* ================= DRIVER CHILDREN SNAPSHOT ================= */
    students: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Child",
      },
    ],

    totalStudents: {
      type: Number,
      default: 0,
    },

    /* ================= UI ================= */
    childName: {
      type: String,
      default: "",
    },

    route: {
      from: {
        type: String,
        default: "",
      },

      to: {
        type: String,
        default: "",
      },
    },

    eta: {
      type: String,
      default: "--",
    },

    amount: {
      type: Number,
      default: 0,
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
    },
  },
  {
    timestamps: true,
  }
);

/* ================= INDEXES ================= */

tripSchema.index({
  driverId: 1,
  status: 1,
});

tripSchema.index({
  parent: 1,
  createdAt: -1,
});

tripSchema.index({
  child: 1,
  createdAt: -1,
});

export default mongoose.model("Trips", tripSchema);
