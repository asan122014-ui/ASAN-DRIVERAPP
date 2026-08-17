import mongoose from "mongoose";

/* =========================================================
   LOCATION SCHEMA
========================================================= */

const locationSchema =
  new mongoose.Schema(
    {
      /* =====================================================
         DRIVER MONGO REFERENCE
      ===================================================== */

      driver: {
        type:
          mongoose.Schema.Types.ObjectId,

        ref: "Driver",

        required: true,
      },

      /* =====================================================
         CUSTOM DRIVER ID
      ===================================================== */

      /*
        Example:

        ASAN-9D0A01

        This is useful because most of your Driver APIs
        already use custom driverId values.
      */

      driverId: {
        type: String,
        required: true,
        trim: true,
        uppercase: true,
      },

      /* =====================================================
         TRIP — OPTIONAL
      ===================================================== */

      tripId: {
        type:
          mongoose.Schema.Types.ObjectId,

        ref: "Trip",

        default: null,
      },

      /* =====================================================
         GEO LOCATION
      ===================================================== */

      location: {
        type: {
          type: String,
          enum: ["Point"],
          default: "Point",
          required: true,
        },

        /*
          GeoJSON format:

          [longitude, latitude]
        */

        coordinates: {
          type: [Number],
          required: true,

          validate: {
            validator:
              function (
                coordinates
              ) {
                if (
                  !Array.isArray(
                    coordinates
                  ) ||
                  coordinates.length !==
                    2
                ) {
                  return false;
                }

                const [
                  longitude,
                  latitude,
                ] =
                  coordinates.map(
                    Number
                  );

                return (
                  Number.isFinite(
                    longitude
                  ) &&
                  Number.isFinite(
                    latitude
                  ) &&
                  longitude >=
                    -180 &&
                  longitude <=
                    180 &&
                  latitude >=
                    -90 &&
                  latitude <=
                    90
                );
              },

            message:
              "Location must contain valid [longitude, latitude] coordinates",
          },
        },
      },

      /* =====================================================
         SPEED
      ===================================================== */

      /*
        Keep unit consistent in your socket/frontend.

        Recommended:
        km/h
      */

      speed: {
        type: Number,
        default: 0,
        min: 0,
      },

      /* =====================================================
         HEADING
      ===================================================== */

      /*
        0   = North
        90  = East
        180 = South
        270 = West
      */

      heading: {
        type: Number,
        default: 0,
        min: 0,
        max: 360,
      },

      /* =====================================================
         ACCURACY — OPTIONAL
      ===================================================== */

      accuracy: {
        type: Number,
        default: null,
        min: 0,
      },
    },

    {
      timestamps: true,

      toJSON: {
        virtuals: true,
      },

      toObject: {
        virtuals: true,
      },
    }
  );

/* =========================================================
   INDEXES
========================================================= */

/*
  Geospatial map / nearby-driver queries.
*/

locationSchema.index({
  location: "2dsphere",
});

/*
  Fast custom Driver ID lookup.
*/

locationSchema.index({
  driverId: 1,
  createdAt: -1,
});

/*
  Driver Mongo reference lookup.
*/

locationSchema.index({
  driver: 1,
  createdAt: -1,
});

/*
  Trip tracking history.
*/

locationSchema.index({
  tripId: 1,
  createdAt: -1,
});

/* =========================================================
   STATIC — LATEST LOCATION BY DRIVER ID
========================================================= */

locationSchema.statics.findLatestByDriverId =
  function (driverId) {
    return this.findOne({
      driverId:
        String(driverId)
          .trim()
          .toUpperCase(),
    }).sort({
      createdAt: -1,
    });
  };

/* =========================================================
   STATIC — TRIP LOCATION HISTORY
========================================================= */

locationSchema.statics.findForTrip =
  function (tripId) {
    return this.find({
      tripId,
    }).sort({
      createdAt: 1,
    });
  };

/* =========================================================
   JSON CLEANUP
========================================================= */

locationSchema.set(
  "toJSON",
  {
    virtuals: true,

    transform: function (
      doc,
      ret
    ) {
      delete ret.__v;

      return ret;
    },
  }
);

/* =========================================================
   MODEL
========================================================= */

const Location =
  mongoose.models.Location ||
  mongoose.model(
    "Location",
    locationSchema
  );

export default Location;
