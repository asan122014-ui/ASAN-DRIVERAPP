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
      enum: ["waiting", "in_transit", "completed", "cancelled"],
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

    amount: {
      type: Number,
      default: 0,
    },

    /* ================= PAYMENT ================= */
    paymentReceived: {
      type: Boolean,
      default: false,
    },

    paymentMethod: {
      type: String,
      enum: ["cash", "upi", "card"],
      default: null,
    },

    paymentReceivedAt: {
      type: Date,
      default: null,
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

    /* ================= MORNING DROP VERIFICATION ================= */
    morningDrop: {
      imageUrl: {
        type: String,
        default: null,
      },
      publicId: {
        type: String,
        default: null,
      },
      latitude: {
        type: Number,
        default: null,
      },
      longitude: {
        type: Number,
        default: null,
      },
      address: {
        type: String,
        default: null,
      },
      capturedAt: {
        type: Date,
        default: null,
      },
      expiresAt: {
        type: Date,
        default: null,
      },
      verified: {
        type: Boolean,
        default: false,
      },
      uploadStatus: {
        type: String,
        enum: ["pending", "uploaded", "failed"],
        default: "pending",
      },
      distanceInMeters: {
        type: Number,
        default: null,
      },
      deviceInfo: {
        type: String,
        default: null,
      },
      width: {
        type: Number,
        default: null,
      },
      height: {
        type: Number,
        default: null,
      },
      uploadedAt: {
        type: Date,
        default: null,
      },
    },

    /* ================= AFTERNOON PICKUP VERIFICATION ================= */
    afternoonPickup: {
      imageUrl: {
        type: String,
        default: null,
      },
      publicId: {
        type: String,
        default: null,
      },
      latitude: {
        type: Number,
        default: null,
      },
      longitude: {
        type: Number,
        default: null,
      },
      address: {
        type: String,
        default: null,
      },
      capturedAt: {
        type: Date,
        default: null,
      },
      expiresAt: {
        type: Date,
        default: null,
      },
      verified: {
        type: Boolean,
        default: false,
      },
      uploadStatus: {
        type: String,
        enum: ["pending", "uploaded", "failed"],
        default: "pending",
      },
      distanceInMeters: {
        type: Number,
        default: null,
      },
      deviceInfo: {
        type: String,
        default: null,
      },
      width: {
        type: Number,
        default: null,
      },
      height: {
        type: Number,
        default: null,
      },
      uploadedAt: {
        type: Date,
        default: null,
      },
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

// Indexes for cleanup cron job
tripSchema.index({
  "morningDrop.expiresAt": 1,
});

tripSchema.index({
  "afternoonPickup.expiresAt": 1,
});

/* ================= VIRTUAL: Has Morning Drop Photo ================= */
tripSchema.virtual("hasMorningDropPhoto").get(function () {
  return Boolean(this.morningDrop?.imageUrl);
});

/* ================= VIRTUAL: Has Afternoon Pickup Photo ================= */
tripSchema.virtual("hasAfternoonPickupPhoto").get(function () {
  return Boolean(this.afternoonPickup?.imageUrl);
});

/* ================= VIRTUAL: Morning Drop Maps URL ================= */
tripSchema.virtual("morningDropMapsUrl").get(function () {
  if (
    this.morningDrop?.latitude == null ||
    this.morningDrop?.longitude == null
  ) {
    return null;
  }

  return `https://maps.google.com/?q=${this.morningDrop.latitude},${this.morningDrop.longitude}`;
});

/* ================= VIRTUAL: Afternoon Pickup Maps URL ================= */
tripSchema.virtual("afternoonPickupMapsUrl").get(function () {
  if (
    this.afternoonPickup?.latitude == null ||
    this.afternoonPickup?.longitude == null
  ) {
    return null;
  }

  return `https://maps.google.com/?q=${this.afternoonPickup.latitude},${this.afternoonPickup.longitude}`;
});

/* ================= VIRTUAL: Is Fully Verified ================= */
tripSchema.virtual("isFullyVerified").get(function () {
  const hasMorning = Boolean(this.morningDrop?.imageUrl);
  const hasAfternoon = Boolean(this.afternoonPickup?.imageUrl);
  
  if (this.tripType === "morning") {
    return hasMorning && this.morningDrop.verified === true;
  }
  
  if (this.tripType === "afternoon") {
    return hasAfternoon && this.afternoonPickup.verified === true;
  }
  
  return false;
});

/* ================= VIRTUAL: Verification Status ================= */
tripSchema.virtual("verificationStatus").get(function () {
  if (this.tripType === "morning") {
    if (this.morningDrop && this.morningDrop.imageUrl) {
      return this.morningDrop.verified ? "verified" : "uploaded";
    }
    return "pending";
  }
  
  if (this.tripType === "afternoon") {
    if (this.afternoonPickup && this.afternoonPickup.imageUrl) {
      return this.afternoonPickup.verified ? "verified" : "uploaded";
    }
    return "pending";
  }
  
  return "unknown";
});

/* ================= METHOD: Add Morning Drop Photo ================= */
tripSchema.methods.addMorningDropPhoto = function (
  imageUrl, 
  publicId, 
  latitude, 
  longitude, 
  address, 
  distanceInMeters,
  deviceInfo,
  width,
  height,
  capturedAt
) {
  // Prevent duplicate uploads
  if (this.morningDrop.imageUrl) {
    throw new Error("Morning drop photo already uploaded");
  }

  const expires = new Date();
  expires.setDate(expires.getDate() + 6);

  this.morningDrop = {
    imageUrl,
    publicId,
    latitude,
    longitude,
    address: address || null,
    capturedAt: capturedAt || new Date(),
    expiresAt: expires,
    verified: false,
    uploadStatus: "uploaded",
    distanceInMeters: distanceInMeters || null,
    deviceInfo: deviceInfo || null,
    width: width || null,
    height: height || null,
    uploadedAt: new Date(),
  };
  return this.save();
};

/* ================= METHOD: Add Afternoon Pickup Photo ================= */
tripSchema.methods.addAfternoonPickupPhoto = function (
  imageUrl, 
  publicId, 
  latitude, 
  longitude, 
  address, 
  distanceInMeters,
  deviceInfo,
  width,
  height,
  capturedAt
) {
  // Prevent duplicate uploads
  if (this.afternoonPickup.imageUrl) {
    throw new Error("Afternoon pickup photo already uploaded");
  }

  const expires = new Date();
  expires.setDate(expires.getDate() + 6);

  this.afternoonPickup = {
    imageUrl,
    publicId,
    latitude,
    longitude,
    address: address || null,
    capturedAt: capturedAt || new Date(),
    expiresAt: expires,
    verified: false,
    uploadStatus: "uploaded",
    distanceInMeters: distanceInMeters || null,
    deviceInfo: deviceInfo || null,
    width: width || null,
    height: height || null,
    uploadedAt: new Date(),
  };
  return this.save();
};

/* ================= METHOD: Clear Morning Drop Photo ================= */
tripSchema.methods.clearMorningDropPhoto = function () {
  this.morningDrop = {
    imageUrl: null,
    publicId: null,
    latitude: null,
    longitude: null,
    address: null,
    capturedAt: null,
    expiresAt: null,
    verified: false,
    uploadStatus: "pending",
    distanceInMeters: null,
    deviceInfo: null,
    width: null,
    height: null,
    uploadedAt: null,
  };
  return this.save();
};

/* ================= METHOD: Clear Afternoon Pickup Photo ================= */
tripSchema.methods.clearAfternoonPickupPhoto = function () {
  this.afternoonPickup = {
    imageUrl: null,
    publicId: null,
    latitude: null,
    longitude: null,
    address: null,
    capturedAt: null,
    expiresAt: null,
    verified: false,
    uploadStatus: "pending",
    distanceInMeters: null,
    deviceInfo: null,
    width: null,
    height: null,
    uploadedAt: null,
  };
  return this.save();
};

/* ================= STATIC: Find expired verification photos ================= */
tripSchema.statics.findExpiredVerificationPhotos = function () {
  const now = new Date();

  return this.find({
    $or: [
      {
        "morningDrop.publicId": { $ne: null },
        "morningDrop.expiresAt": { $lte: now },
      },
      {
        "afternoonPickup.publicId": { $ne: null },
        "afternoonPickup.expiresAt": { $lte: now },
      },
    ],
  });
};

/* ================= TO JSON TRANSFORM ================= */
tripSchema.set("toJSON", {
  virtuals: true,
  transform: function (doc, ret) {
    delete ret.__v;
    return ret;
  },
});

const Trip = mongoose.models.Trip || mongoose.model("Trip", tripSchema);

export default Trip;
