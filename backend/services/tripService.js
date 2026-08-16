import mongoose from "mongoose";

import Trips from "../models/Trips.js";
import Child from "../models/Child.js";
import Driver from "../models/Driver.js";

import {
  sendNotification,
} from "../utils/sendNotification.js";

/* =========================================================
   CONSTANTS
========================================================= */

const TRIP_TYPES = Object.freeze([
  "morning",
  "afternoon",
]);

const PAYMENT_METHODS = Object.freeze([
  "cash",
  "upi",
  "card",
]);

const IST_OFFSET_MINUTES = 330;

/* =========================================================
   EVENTS
========================================================= */

export const EVENTS = Object.freeze({
  TRIP_STARTED: "trip_started",

  TRIP_ENDED: "trip_ended",

  STUDENT_PICKED_UP:
    "student_picked_up",

  STUDENT_DROPPED:
    "student_dropped",

  PAYMENT_RECEIVED:
    "payment_received",

  MORNING_DROP_VERIFIED:
    "morning_drop_verified",

  AFTERNOON_PICKUP_VERIFIED:
    "afternoon_pickup_verified",

  MORNING_DROP_PHOTO_UPLOADED:
    "morning_drop_photo_uploaded",

  AFTERNOON_PICKUP_PHOTO_UPLOADED:
    "afternoon_pickup_photo_uploaded",

  DRIVER_ARRIVED_PICKUP:
    "driver_arrived_pickup",

  APPROACHING_SCHOOL:
    "approaching_school",

  DRIVER_ARRIVED_SCHOOL:
    "driver_arrived_school",

  APPROACHING_HOME:
    "approaching_home",

  TRIP_DELAYED:
    "trip_delayed",

  TRIP_CANCELLED:
    "trip_cancelled",
});

/* =========================================================
   CUSTOM ERRORS
========================================================= */

export class NotFoundError extends Error {
  constructor(message) {
    super(message);

    this.name =
      "NotFoundError";

    this.statusCode = 404;
  }
}

export class ValidationError extends Error {
  constructor(message) {
    super(message);

    this.name =
      "ValidationError";

    this.statusCode = 400;
  }
}

export class ConflictError extends Error {
  constructor(message) {
    super(message);

    this.name =
      "ConflictError";

    this.statusCode = 409;
  }
}

/* =========================================================
   HELPERS
========================================================= */

const normalizeDriverId = (
  driverId
) => {
  if (!driverId) {
    return "";
  }

  return String(driverId)
    .trim()
    .toUpperCase();
};

const normalizeTripType = (
  tripType
) => {
  if (!tripType) {
    return "";
  }

  return String(tripType)
    .trim()
    .toLowerCase();
};

const normalizePaymentMethod = (
  method
) => {
  if (!method) {
    return "";
  }

  return String(method)
    .trim()
    .toLowerCase();
};

/* =========================================================
   IST HELPERS
========================================================= */

const getISTDateParts = (
  date = new Date()
) => {
  const istTime =
    new Date(
      date.getTime() +
        IST_OFFSET_MINUTES *
          60 *
          1000
    );

  return {
    year:
      istTime.getUTCFullYear(),

    month:
      istTime.getUTCMonth() +
      1,

    day:
      istTime.getUTCDate(),

    hour:
      istTime.getUTCHours(),
  };
};

/* =========================================================
   CURRENT IST HOUR
========================================================= */

const getCurrentHourInIST = () => {
  return getISTDateParts()
    .hour;
};

/* =========================================================
   IST DAY RANGE
========================================================= */

/*
  Converts an India calendar date into
  the exact UTC MongoDB query range.

  Example:

  India:
  2026-08-17 00:00

  UTC:
  2026-08-16 18:30
*/

const getISTDayRange = (
  input = new Date()
) => {
  let year;
  let month;
  let day;

  if (
    typeof input === "string"
  ) {
    const match =
      /^(\d{4})-(\d{2})-(\d{2})$/.exec(
        input
      );

    if (!match) {
      throw new ValidationError(
        "Invalid date format. Please use YYYY-MM-DD format."
      );
    }

    year =
      Number(match[1]);

    month =
      Number(match[2]);

    day =
      Number(match[3]);

    const validationDate =
      new Date(
        Date.UTC(
          year,
          month - 1,
          day
        )
      );

    if (
      validationDate.getUTCFullYear() !==
        year ||
      validationDate.getUTCMonth() !==
        month - 1 ||
      validationDate.getUTCDate() !==
        day
    ) {
      throw new ValidationError(
        "Invalid date"
      );
    }
  } else {
    const parts =
      getISTDateParts(
        input
      );

    year =
      parts.year;

    month =
      parts.month;

    day =
      parts.day;
  }

  const utcMidnight =
    Date.UTC(
      year,
      month - 1,
      day,
      0,
      0,
      0,
      0
    );

  const start =
    new Date(
      utcMidnight -
        IST_OFFSET_MINUTES *
          60 *
          1000
    );

  const end =
    new Date(
      start.getTime() +
        24 *
          60 *
          60 *
          1000
    );

  return {
    start,
    end,
  };
};

/* =========================================================
   NOTIFICATION HELPER
========================================================= */

/*
  Notification failures should NOT cause:

  pickup
  drop
  trip start
  trip end
  payment

  to fail after the database has already
  been updated.
*/

const notifyDriver = async (
  driverId,
  {
    notificationKey,
    childId = null,
    event,
    payload,
    priority = "medium",
    io,
  }
) => {
  try {
    await sendNotification({
      driverId,

      childId,

      notificationKey,

      priority,

      io,
    });
  } catch (error) {
    console.error(
      "Notification sending failed:",
      error.message
    );
  }

  if (
    io &&
    event
  ) {
    try {
      io.to(
        String(driverId)
      ).emit(
        event,
        payload
      );
    } catch (error) {
      console.error(
        "Socket notification failed:",
        error.message
      );
    }
  }
};

/* =========================================================
   CHECK TRIP STATE
========================================================= */

const ensureTripInTransit = (
  trip
) => {
  if (
    trip.status !==
    "in_transit"
  ) {
    throw new ConflictError(
      "Trip is not currently in transit"
    );
  }
};

/* =========================================================
   PHOTO METADATA
========================================================= */

const normalizeOptionalNumber = (
  value,
  label
) => {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return null;
  }

  const number =
    Number(value);

  if (
    !Number.isFinite(
      number
    )
  ) {
    throw new ValidationError(
      `${label} must be a valid number`
    );
  }

  return number;
};

/* =========================================================
   PHOTO BODY VALIDATION
========================================================= */

const normalizePhotoMetadata = (
  body = {}
) => {
  const latitude =
    normalizeOptionalNumber(
      body.latitude,
      "Latitude"
    );

  const longitude =
    normalizeOptionalNumber(
      body.longitude,
      "Longitude"
    );

  if (
    (latitude === null) !==
    (longitude === null)
  ) {
    throw new ValidationError(
      "Latitude and longitude must be provided together"
    );
  }

  if (
    latitude !== null &&
    (
      latitude < -90 ||
      latitude > 90
    )
  ) {
    throw new ValidationError(
      "Latitude must be between -90 and 90"
    );
  }

  if (
    longitude !== null &&
    (
      longitude < -180 ||
      longitude > 180
    )
  ) {
    throw new ValidationError(
      "Longitude must be between -180 and 180"
    );
  }

  const distanceInMeters =
    normalizeOptionalNumber(
      body.distanceInMeters,
      "Distance"
    );

  const width =
    normalizeOptionalNumber(
      body.width,
      "Width"
    );

  const height =
    normalizeOptionalNumber(
      body.height,
      "Height"
    );

  if (
    distanceInMeters !==
      null &&
    distanceInMeters < 0
  ) {
    throw new ValidationError(
      "Distance cannot be negative"
    );
  }

  if (
    width !== null &&
    width < 0
  ) {
    throw new ValidationError(
      "Width cannot be negative"
    );
  }

  if (
    height !== null &&
    height < 0
  ) {
    throw new ValidationError(
      "Height cannot be negative"
    );
  }

  let capturedAt =
    new Date();

  if (
    body.capturedAt
  ) {
    capturedAt =
      new Date(
        body.capturedAt
      );

    if (
      Number.isNaN(
        capturedAt.getTime()
      )
    ) {
      throw new ValidationError(
        "Invalid capturedAt date"
      );
    }
  }

  return {
    latitude,

    longitude,

    address:
      body.address
        ? String(
            body.address
          ).trim()
        : null,

    distanceInMeters,

    deviceInfo:
      body.deviceInfo
        ? String(
            body.deviceInfo
          ).trim()
        : null,

    width,

    height,

    capturedAt,
  };
};

/* =========================================================
   START TRIP
========================================================= */

export const startTripService =
  async (
    driverId,
    tripType,
    io
  ) => {
    const session =
      await mongoose.startSession();

    try {
      driverId =
        normalizeDriverId(
          driverId
        );

      tripType =
        normalizeTripType(
          tripType
        );

      if (
        !driverId ||
        !tripType
      ) {
        throw new ValidationError(
          "driverId and tripType are required"
        );
      }

      if (
        !TRIP_TYPES.includes(
          tripType
        )
      ) {
        throw new ValidationError(
          "Invalid trip type. Must be 'morning' or 'afternoon'"
        );
      }

      /* ===================================================
         TIME RULES
      =================================================== */

      const hour =
        getCurrentHourInIST();

      if (
        tripType ===
          "morning" &&
        hour >= 12
      ) {
        throw new ValidationError(
          "Morning trip is no longer available."
        );
      }

      if (
        tripType ===
          "afternoon" &&
        hour < 12
      ) {
        throw new ValidationError(
          "Afternoon trip has not started yet."
        );
      }

      /* ===================================================
         TODAY RANGE — IST
      =================================================== */

      const {
        start: todayStart,

        end: todayEnd,
      } =
        getISTDayRange();

      /* ===================================================
         COMPLETED TODAY CHECK
      =================================================== */

      const alreadyCompleted =
        await Trips.findOne({
          driverId,

          tripType,

          status:
            "completed",

          createdAt: {
            $gte:
              todayStart,

            $lt:
              todayEnd,
          },
        });

      if (
        alreadyCompleted
      ) {
        throw new ConflictError(
          `${tripType} trip already completed today`
        );
      }

      /* ===================================================
         TRANSACTION
      =================================================== */

      session.startTransaction();

      /* ===================================================
         DRIVER
      =================================================== */

      const driver =
        await Driver.findOne({
          driverId,
        }).session(
          session
        );

      if (!driver) {
        throw new NotFoundError(
          "Driver not found"
        );
      }

      /* ===================================================
         CHECK EXISTING ACTIVE TRIP
      =================================================== */

      const existingTrip =
        await Trips.findOne({
          driverId,

          status:
            "in_transit",
        }).session(
          session
        );

      if (
        existingTrip
      ) {
        throw new ConflictError(
          "Driver already has a trip in transit."
        );
      }

      /* ===================================================
         CHILDREN
      =================================================== */

      const children =
        await Child.find({
          driverId,
        })
          .populate(
            "parentId",
            "_id name"
          )
          .session(
            session
          );

      if (
        !children.length
      ) {
        throw new ValidationError(
          "No children assigned to this driver"
        );
      }

      /* ===================================================
         VALID CHILDREN
      =================================================== */

      const validChildren =
        children.filter(
          (child) =>
            Boolean(
              child.parentId
            )
        );

      if (
        !validChildren.length
      ) {
        throw new ValidationError(
          "Assigned children do not have valid Parent accounts"
        );
      }

      /* ===================================================
         RESET CHILD STATUS
      =================================================== */

      await Child.updateMany(
        {
          driverId,
        },

        {
          $set: {
            status:
              "waiting",
          },
        },

        {
          session,
        }
      );

      /* ===================================================
         DRIVER STATUS
      =================================================== */

      driver.currentStatus =
        "on_trip";

      driver.isOnline =
        true;

      await driver.save({
        session,
      });

      /* ===================================================
         CREATE ONE TRIP RECORD PER CHILD
      =================================================== */

      const studentIds =
        validChildren.map(
          (child) =>
            child._id
        );

      const startTime =
        new Date();

      const tripDocs =
        validChildren.map(
          (child) => {
            const morning =
              tripType ===
              "morning";

            return {
              driverId,

              parent:
                child.parentId
                  ._id ||
                child.parentId,

              child:
                child._id,

              tripType,

              status:
                "in_transit",

              students:
                studentIds,

              totalStudents:
                validChildren.length,

              childName:
                child.name,

              route: {
                from:
                  morning
                    ? child.pickupLocation ||
                      "Home"
                    : child.dropoffLocation ||
                      child.school ||
                      "School",

                to:
                  morning
                    ? child.dropoffLocation ||
                      child.school ||
                      "School"
                    : child.pickupLocation ||
                      "Home",
              },

              startTime,
            };
          }
        );

      const createdTrips =
        await Trips.insertMany(
          tripDocs,
          {
            session,
          }
        );

      await session.commitTransaction();

      /* ===================================================
         NOTIFY
      =================================================== */

      const notificationKey =
        tripType ===
        "morning"
          ? "TRIP_STARTED"
          : "RETURN_TRIP_STARTED";

      await notifyDriver(
        driverId,
        {
          notificationKey,

          event:
            EVENTS.TRIP_STARTED,

          payload:
            createdTrips,

          io,
        }
      );

      return createdTrips;
    } catch (error) {
      if (
        session.inTransaction()
      ) {
        await session.abortTransaction();
      }

      console.error(
        "startTripService error:",
        error.message
      );

      throw error;
    } finally {
      session.endSession();
    }
  };

/* =========================================================
   END TRIP
========================================================= */

export const endTripService =
  async (
    driverId,
    io
  ) => {
    try {
      driverId =
        normalizeDriverId(
          driverId
        );

      if (!driverId) {
        throw new ValidationError(
          "Driver ID is required"
        );
      }

      /* ===================================================
         ACTIVE CHILD TRIPS
      =================================================== */

      const trips =
        await Trips.find({
          driverId,

          status:
            "in_transit",
        }).populate(
          "child",
          "name status"
        );

      if (
        !trips.length
      ) {
        throw new NotFoundError(
          "No trip currently in transit"
        );
      }

      /* ===================================================
         DRIVER
      =================================================== */

      const driver =
        await Driver.findOne({
          driverId,
        });

      if (!driver) {
        throw new NotFoundError(
          "Driver not found"
        );
      }

      /* ===================================================
         VALIDATE CHILD TRIPS
      =================================================== */

      for (
        const trip of trips
      ) {
        /*
          Absent children do not require
          pickup/drop/photo validation.
        */

        if (
          trip.child
            ?.status ===
          "absent"
        ) {
          continue;
        }

        if (
          trip.tripType ===
            "morning" &&
          !trip.morningDrop
            ?.imageUrl
        ) {
          throw new ValidationError(
            `Drop photo missing for ${trip.childName}`
          );
        }

        if (
          trip.tripType ===
            "afternoon" &&
          !trip
            .afternoonPickup
            ?.imageUrl
        ) {
          throw new ValidationError(
            `Pickup photo missing for ${trip.childName}`
          );
        }

        if (
          !trip.pickupStatus
        ) {
          throw new ValidationError(
            `${trip.childName} was not picked up`
          );
        }

        if (
          !trip.dropStatus
        ) {
          throw new ValidationError(
            `${trip.childName} was not dropped`
          );
        }
      }

      /* ===================================================
         COMPLETE TRIPS
      =================================================== */

      const endTime =
        new Date();

      for (
        const trip of trips
      ) {
        if (
          !trip.startTime
        ) {
          trip.startTime =
            endTime;
        }

        trip.endTime =
          endTime;

        const durationMs =
          endTime.getTime() -
          new Date(
            trip.startTime
          ).getTime();

        trip.duration =
          Math.max(
            1,

            Math.round(
              durationMs /
                60000
            )
          );

        trip.status =
          "completed";

        await trip.save();
      }

      /* ===================================================
         RESET CHILDREN
      =================================================== */

      await Child.updateMany(
        {
          driverId,
        },

        {
          $set: {
            status:
              "waiting",
          },
        }
      );

      /* ===================================================
         DRIVER IDLE
      =================================================== */

      driver.currentStatus =
        "idle";

      driver.isOnline =
        false;

      await driver.save();

      /* ===================================================
         NOTIFICATION
      =================================================== */

      await notifyDriver(
        driverId,
        {
          notificationKey:
            "TRIP_COMPLETED",

          event:
            EVENTS.TRIP_ENDED,

          payload:
            trips,

          priority:
            "low",

          io,
        }
      );

      return trips;
    } catch (error) {
      console.error(
        "endTripService error:",
        error.message
      );

      throw error;
    }
  };

/* =========================================================
   GET ACTIVE TRIPS
========================================================= */

export const getActiveTripsService =
  async (
    driverId
  ) => {
    try {
      driverId =
        normalizeDriverId(
          driverId
        );

      if (!driverId) {
        throw new ValidationError(
          "driverId is required"
        );
      }

      return await Trips.find({
        driverId,

        status:
          "in_transit",
      })
        .select(
          "-morningDrop -afternoonPickup"
        )
        .populate(
          "child",
          "name status"
        )
        .populate(
          "parent",
          "name"
        )
        .sort({
          createdAt: -1,
        })
        .lean();
    } catch (error) {
      console.error(
        "getActiveTripsService error:",
        error
      );

      throw error;
    }
  };

/* =========================================================
   GET TRIP BY ID
========================================================= */

/*
  Kept function name for compatibility with
  tripController.js.

  It retrieves ANY Trip by ID, not only
  active trips.
*/

export const getActiveTripService =
  async (
    tripId
  ) => {
    try {
      if (!tripId) {
        throw new ValidationError(
          "tripId is required"
        );
      }

      if (
        !mongoose.Types.ObjectId.isValid(
          tripId
        )
      ) {
        throw new ValidationError(
          "Invalid Trip ID"
        );
      }

      const trip =
        await Trips.findById(
          tripId
        )
          .populate(
            "child",
            "name status pickupLocation dropoffLocation"
          )
          .populate(
            "parent",
            "name phone"
          )
          .lean();

      if (!trip) {
        throw new NotFoundError(
          "Trip not found"
        );
      }

      return trip;
    } catch (error) {
      console.error(
        "getActiveTripService error:",
        error
      );

      throw error;
    }
  };

/* =========================================================
   DRIVER TRIP HISTORY
========================================================= */

export const getDriverTripsService =
  async (
    driverId
  ) => {
    try {
      driverId =
        normalizeDriverId(
          driverId
        );

      if (!driverId) {
        throw new ValidationError(
          "driverId is required"
        );
      }

      return await Trips.find({
        driverId,
      })
        .select(
          "-morningDrop -afternoonPickup"
        )
        .sort({
          createdAt: -1,
        })
        .populate(
          "child",
          "name"
        )
        .populate(
          "parent",
          "name"
        )
        .lean();
    } catch (error) {
      console.error(
        "getDriverTripsService error:",
        error
      );

      throw error;
    }
  };

/* =========================================================
   PARENT TRIP HISTORY
========================================================= */

export const getParentTripsService =
  async (
    parentId
  ) => {
    try {
      if (!parentId) {
        throw new ValidationError(
          "parentId is required"
        );
      }

      if (
        !mongoose.Types.ObjectId.isValid(
          parentId
        )
      ) {
        throw new ValidationError(
          "Invalid Parent ID"
        );
      }

      return await Trips.find({
        parent:
          parentId,
      })
        .sort({
          createdAt: -1,
        })
        .populate(
          "child",
          "name status pickupLocation dropoffLocation school grade"
        )
        .lean();
    } catch (error) {
      console.error(
        "getParentTripsService error:",
        error
      );

      throw error;
    }
  };

/* =========================================================
   TRIP DETAILS BY DATE
========================================================= */

export const getTripDetailsService =
  async (
    driverId,
    tripType,
    date
  ) => {
    try {
      driverId =
        normalizeDriverId(
          driverId
        );

      tripType =
        normalizeTripType(
          tripType
        );

      if (
        !driverId ||
        !tripType
      ) {
        throw new ValidationError(
          "driverId and tripType are required"
        );
      }

      if (
        !TRIP_TYPES.includes(
          tripType
        )
      ) {
        throw new ValidationError(
          "Invalid trip type"
        );
      }

      const {
        start,
        end,
      } =
        getISTDayRange(
          date
        );

      return await Trips.find({
        driverId,

        tripType,

        createdAt: {
          $gte: start,

          $lt: end,
        },
      })
        .select(
          "-morningDrop -afternoonPickup"
        )
        .populate(
          "child",
          "name"
        )
        .sort({
          createdAt: 1,
        })
        .lean();
    } catch (error) {
      console.error(
        "getTripDetailsService error:",
        error
      );

      throw error;
    }
  };

/* =========================================================
   TODAY'S TRIP STATUS
========================================================= */

export const getTodayTripStatusService =
  async (
    driverId
  ) => {
    try {
      driverId =
        normalizeDriverId(
          driverId
        );

      if (!driverId) {
        throw new ValidationError(
          "driverId is required"
        );
      }

      const {
        start,
        end,
      } =
        getISTDayRange();

      const trips =
        await Trips.find(
          {
            driverId,

            createdAt: {
              $gte:
                start,

              $lt:
                end,
            },
          },

          "tripType status"
        ).lean();

      let morningTrips = 0;

      let afternoonTrips = 0;

      let morningCompleted =
        true;

      let afternoonCompleted =
        true;

      for (
        const trip of trips
      ) {
        if (
          trip.tripType ===
          "morning"
        ) {
          morningTrips++;

          if (
            trip.status !==
            "completed"
          ) {
            morningCompleted =
              false;
          }
        }

        if (
          trip.tripType ===
          "afternoon"
        ) {
          afternoonTrips++;

          if (
            trip.status !==
            "completed"
          ) {
            afternoonCompleted =
              false;
          }
        }
      }

      morningCompleted =
        morningTrips > 0 &&
        morningCompleted;

      afternoonCompleted =
        afternoonTrips > 0 &&
        afternoonCompleted;

      return {
        morningTrips,

        afternoonTrips,

        morningCompleted,

        afternoonCompleted,
      };
    } catch (error) {
      console.error(
        "getTodayTripStatusService error:",
        error
      );

      throw error;
    }
  };

/* =========================================================
   PICKUP STUDENT
========================================================= */

export const pickupStudentService =
  async (
    tripId,
    io
  ) => {
    const session =
      await mongoose.startSession();

    try {
      if (
        !mongoose.Types.ObjectId.isValid(
          tripId
        )
      ) {
        throw new ValidationError(
          "Invalid Trip ID"
        );
      }

      session.startTransaction();

      const trip =
        await Trips.findById(
          tripId
        )
          .populate(
            "child",
            "name status"
          )
          .populate(
            "parent",
            "name"
          )
          .session(
            session
          );

      if (!trip) {
        throw new NotFoundError(
          "Trip not found"
        );
      }

      ensureTripInTransit(
        trip
      );

      if (!trip.child) {
        throw new NotFoundError(
          "Child not found"
        );
      }

      if (
        trip.child.status ===
        "absent"
      ) {
        throw new ConflictError(
          "Absent student cannot be picked up"
        );
      }

      if (
        trip.pickupStatus
      ) {
        throw new ConflictError(
          "Student already picked up"
        );
      }

      if (
        trip.child.status !==
        "waiting"
      ) {
        throw new ConflictError(
          "Student is not waiting for pickup"
        );
      }

      /* ===================================================
         AFTERNOON PHOTO REQUIRED BEFORE PICKUP
      =================================================== */

      if (
        trip.tripType ===
          "afternoon" &&
        !trip
          .afternoonPickup
          ?.imageUrl
      ) {
        throw new ValidationError(
          "Upload pickup photo before picking up student."
        );
      }

      trip.pickupStatus =
        true;

      trip.pickupTime =
        new Date();

      await trip.save({
        session,
      });

      await Child.findByIdAndUpdate(
        trip.child._id,

        {
          $set: {
            status:
              "onboard",
          },
        },

        {
          session,
          runValidators: true,
        }
      );

      await session.commitTransaction();

      const notificationKey =
        trip.tripType ===
        "morning"
          ? "CHILD_PICKED_UP"
          : "PICKED_UP_FROM_SCHOOL";

      await notifyDriver(
        trip.driverId,
        {
          notificationKey,

          childId:
            trip.child._id,

          event:
            EVENTS
              .STUDENT_PICKED_UP,

          payload:
            trip,

          io,
        }
      );

      return trip;
    } catch (error) {
      if (
        session.inTransaction()
      ) {
        await session.abortTransaction();
      }

      console.error(
        "pickupStudentService:",
        error
      );

      throw error;
    } finally {
      session.endSession();
    }
  };

/* =========================================================
   DROP STUDENT
========================================================= */

export const dropStudentService =
  async (
    tripId,
    io
  ) => {
    const session =
      await mongoose.startSession();

    try {
      if (
        !mongoose.Types.ObjectId.isValid(
          tripId
        )
      ) {
        throw new ValidationError(
          "Invalid Trip ID"
        );
      }

      session.startTransaction();

      const trip =
        await Trips.findById(
          tripId
        )
          .populate(
            "child",
            "name status"
          )
          .populate(
            "parent",
            "name"
          )
          .session(
            session
          );

      if (!trip) {
        throw new NotFoundError(
          "Trip not found"
        );
      }

      ensureTripInTransit(
        trip
      );

      if (!trip.child) {
        throw new NotFoundError(
          "Child not found"
        );
      }

      if (
        trip.child.status ===
        "absent"
      ) {
        throw new ConflictError(
          "Absent student cannot be dropped"
        );
      }

      if (
        trip.dropStatus
      ) {
        throw new ConflictError(
          "Student already dropped"
        );
      }

      /*
        Prevent:

        waiting -> dropped

        Student must first be picked up.
      */

      if (
        !trip.pickupStatus
      ) {
        throw new ValidationError(
          "Student must be picked up before drop"
        );
      }

      if (
        trip.child.status !==
        "onboard"
      ) {
        throw new ConflictError(
          "Student is not onboard"
        );
      }

      /* ===================================================
         MORNING DROP PHOTO REQUIRED
      =================================================== */

      if (
        trip.tripType ===
          "morning" &&
        !trip.morningDrop
          ?.imageUrl
      ) {
        throw new ValidationError(
          "Upload drop photo before completing drop."
        );
      }

      trip.dropStatus =
        true;

      trip.dropTime =
        new Date();

      await trip.save({
        session,
      });

      await Child.findByIdAndUpdate(
        trip.child._id,

        {
          $set: {
            status:
              "dropped",
          },
        },

        {
          session,
          runValidators: true,
        }
      );

      await session.commitTransaction();

      const notificationKey =
        trip.tripType ===
        "morning"
          ? "DROPPED_AT_SCHOOL"
          : "DROPPED_AT_HOME";

      await notifyDriver(
        trip.driverId,
        {
          notificationKey,

          childId:
            trip.child._id,

          event:
            EVENTS
              .STUDENT_DROPPED,

          payload:
            trip,

          io,
        }
      );

      return trip;
    } catch (error) {
      if (
        session.inTransaction()
      ) {
        await session.abortTransaction();
      }

      console.error(
        "dropStudentService:",
        error
      );

      throw error;
    } finally {
      session.endSession();
    }
  };

/* =========================================================
   TRIP PROGRESS
========================================================= */

export const getTripProgressService =
  async (
    driverId
  ) => {
    try {
      driverId =
        normalizeDriverId(
          driverId
        );

      if (!driverId) {
        throw new ValidationError(
          "driverId is required"
        );
      }

      const [
        totalStudents,
        pickedStudents,
        droppedStudents,
        absentStudents,
        remainingStudents,
      ] =
        await Promise.all([
          Child.countDocuments({
            driverId,
          }),

          Child.countDocuments({
            driverId,

            status:
              "onboard",
          }),

          Child.countDocuments({
            driverId,

            status:
              "dropped",
          }),

          Child.countDocuments({
            driverId,

            status:
              "absent",
          }),

          Child.countDocuments({
            driverId,

            status: {
              $in: [
                "waiting",
                "onboard",
              ],
            },
          }),
        ]);

      return {
        totalStudents,

        pickedStudents,

        droppedStudents,

        absentStudents,

        remainingStudents,
      };
    } catch (error) {
      console.error(
        "getTripProgressService:",
        error
      );

      throw error;
    }
  };

/* =========================================================
   RECEIVE PAYMENT
========================================================= */

export const receivePaymentService =
  async (
    tripId,
    paymentMethod,
    io
  ) => {
    try {
      if (
        !mongoose.Types.ObjectId.isValid(
          tripId
        )
      ) {
        throw new ValidationError(
          "Invalid Trip ID"
        );
      }

      paymentMethod =
        normalizePaymentMethod(
          paymentMethod
        );

      if (!paymentMethod) {
        throw new ValidationError(
          "Payment method is required"
        );
      }

      if (
        !PAYMENT_METHODS.includes(
          paymentMethod
        )
      ) {
        throw new ValidationError(
          "Invalid payment method. Must be 'cash', 'upi', or 'card'"
        );
      }

      const trip =
        await Trips.findById(
          tripId
        )
          .populate(
            "child",
            "name"
          )
          .populate(
            "parent",
            "name"
          );

      if (!trip) {
        throw new NotFoundError(
          "Trip not found"
        );
      }

      if (
        trip.paymentReceived
      ) {
        throw new ConflictError(
          "Payment already received"
        );
      }

      trip.paymentReceived =
        true;

      trip.paymentMethod =
        paymentMethod;

      trip.paymentReceivedAt =
        new Date();

      await trip.save();

      await notifyDriver(
        trip.driverId,
        {
          notificationKey:
            "PAYMENT_RECEIVED",

          childId:
            trip.child
              ?._id ||
            trip.child,

          event:
            EVENTS
              .PAYMENT_RECEIVED,

          payload:
            trip,

          priority:
            "low",

          io,
        }
      );

      return trip;
    } catch (error) {
      console.error(
        "receivePaymentService:",
        error
      );

      throw error;
    }
  };

/* =========================================================
   VERIFY MORNING DROP PHOTO
========================================================= */

export const verifyMorningDropPhotoService =
  async (
    tripId,
    io
  ) => {
    try {
      if (
        !mongoose.Types.ObjectId.isValid(
          tripId
        )
      ) {
        throw new ValidationError(
          "Invalid Trip ID"
        );
      }

      const trip =
        await Trips.findById(
          tripId
        );

      if (!trip) {
        throw new NotFoundError(
          "Trip not found"
        );
      }

      if (
        trip.tripType !==
        "morning"
      ) {
        throw new ValidationError(
          "This is not a morning trip"
        );
      }

      if (
        !trip.morningDrop
          ?.imageUrl
      ) {
        throw new ValidationError(
          "No morning drop photo to verify"
        );
      }

      if (
        trip.morningDrop
          .verified
      ) {
        throw new ConflictError(
          "Morning drop photo already verified"
        );
      }

      trip.morningDrop
        .verified = true;

      await trip.save();

      await notifyDriver(
        trip.driverId,
        {
          notificationKey:
            "MORNING_DROP_VERIFIED",

          childId:
            trip.child,

          event:
            EVENTS
              .MORNING_DROP_VERIFIED,

          payload:
            trip,

          io,
        }
      );

      return trip;
    } catch (error) {
      console.error(
        "verifyMorningDropPhotoService:",
        error
      );

      throw error;
    }
  };

/* =========================================================
   VERIFY AFTERNOON PICKUP PHOTO
========================================================= */

export const verifyAfternoonPickupPhotoService =
  async (
    tripId,
    io
  ) => {
    try {
      if (
        !mongoose.Types.ObjectId.isValid(
          tripId
        )
      ) {
        throw new ValidationError(
          "Invalid Trip ID"
        );
      }

      const trip =
        await Trips.findById(
          tripId
        );

      if (!trip) {
        throw new NotFoundError(
          "Trip not found"
        );
      }

      if (
        trip.tripType !==
        "afternoon"
      ) {
        throw new ValidationError(
          "This is not an afternoon trip"
        );
      }

      if (
        !trip
          .afternoonPickup
          ?.imageUrl
      ) {
        throw new ValidationError(
          "No afternoon pickup photo to verify"
        );
      }

      if (
        trip
          .afternoonPickup
          .verified
      ) {
        throw new ConflictError(
          "Afternoon pickup photo already verified"
        );
      }

      trip
        .afternoonPickup
        .verified = true;

      await trip.save();

      await notifyDriver(
        trip.driverId,
        {
          notificationKey:
            "AFTERNOON_PICKUP_VERIFIED",

          childId:
            trip.child,

          event:
            EVENTS
              .AFTERNOON_PICKUP_VERIFIED,

          payload:
            trip,

          io,
        }
      );

      return trip;
    } catch (error) {
      console.error(
        "verifyAfternoonPickupPhotoService:",
        error
      );

      throw error;
    }
  };

/* =========================================================
   UPLOAD MORNING DROP PHOTO
========================================================= */

export const uploadMorningDropPhotoService =
  async (
    tripId,
    file,
    body,
    io
  ) => {
    try {
      if (
        !tripId ||
        !file
      ) {
        throw new ValidationError(
          "tripId and file are required"
        );
      }

      if (
        !mongoose.Types.ObjectId.isValid(
          tripId
        )
      ) {
        throw new ValidationError(
          "Invalid Trip ID"
        );
      }

      const trip =
        await Trips.findById(
          tripId
        );

      if (!trip) {
        throw new NotFoundError(
          "Trip not found"
        );
      }

      ensureTripInTransit(
        trip
      );

      if (
        trip.tripType !==
        "morning"
      ) {
        throw new ValidationError(
          "This is not a morning trip."
        );
      }

      if (
        trip.morningDrop
          ?.imageUrl
      ) {
        throw new ConflictError(
          "Morning drop photo already uploaded"
        );
      }

      const metadata =
        normalizePhotoMetadata(
          body
        );

      await trip.addMorningDropPhoto(
        file.secure_url ||
          file.path ||
          file.url,

        file.public_id ||
          file.filename ||
          null,

        metadata.latitude,

        metadata.longitude,

        metadata.address,

        metadata.distanceInMeters,

        metadata.deviceInfo,

        metadata.width,

        metadata.height,

        metadata.capturedAt
      );

      await notifyDriver(
        trip.driverId,
        {
          notificationKey:
            "MORNING_DROP_PHOTO_UPLOADED",

          childId:
            trip.child,

          event:
            EVENTS
              .MORNING_DROP_PHOTO_UPLOADED,

          payload:
            trip,

          io,
        }
      );

      return trip;
    } catch (error) {
      console.error(
        "uploadMorningDropPhotoService error:",
        error.message
      );

      throw error;
    }
  };

/* =========================================================
   UPLOAD AFTERNOON PICKUP PHOTO
========================================================= */

export const uploadAfternoonPickupPhotoService =
  async (
    tripId,
    file,
    body,
    io
  ) => {
    try {
      if (
        !tripId ||
        !file
      ) {
        throw new ValidationError(
          "tripId and file are required"
        );
      }

      if (
        !mongoose.Types.ObjectId.isValid(
          tripId
        )
      ) {
        throw new ValidationError(
          "Invalid Trip ID"
        );
      }

      const trip =
        await Trips.findById(
          tripId
        );

      if (!trip) {
        throw new NotFoundError(
          "Trip not found"
        );
      }

      ensureTripInTransit(
        trip
      );

      if (
        trip.tripType !==
        "afternoon"
      ) {
        throw new ValidationError(
          "This is not an afternoon trip."
        );
      }

      if (
        trip
          .afternoonPickup
          ?.imageUrl
      ) {
        throw new ConflictError(
          "Afternoon pickup photo already uploaded"
        );
      }

      const metadata =
        normalizePhotoMetadata(
          body
        );

      await trip.addAfternoonPickupPhoto(
        file.secure_url ||
          file.path ||
          file.url,

        file.public_id ||
          file.filename ||
          null,

        metadata.latitude,

        metadata.longitude,

        metadata.address,

        metadata.distanceInMeters,

        metadata.deviceInfo,

        metadata.width,

        metadata.height,

        metadata.capturedAt
      );

      await notifyDriver(
        trip.driverId,
        {
          notificationKey:
            "AFTERNOON_PICKUP_PHOTO_UPLOADED",

          childId:
            trip.child,

          event:
            EVENTS
              .AFTERNOON_PICKUP_PHOTO_UPLOADED,

          payload:
            trip,

          io,
        }
      );

      return trip;
    } catch (error) {
      console.error(
        "uploadAfternoonPickupPhotoService error:",
        error.message
      );

      throw error;
    }
  };

/* =========================================================
   DRIVER ARRIVED PICKUP
========================================================= */

export const driverArrivedPickupService =
  async (
    tripId,
    io
  ) => {
    try {
      const trip =
        await Trips.findById(
          tripId
        );

      if (!trip) {
        throw new NotFoundError(
          "Trip not found"
        );
      }

      ensureTripInTransit(
        trip
      );

      await notifyDriver(
        trip.driverId,
        {
          notificationKey:
            "DRIVER_ARRIVED_PICKUP",

          childId:
            trip.child,

          event:
            EVENTS
              .DRIVER_ARRIVED_PICKUP,

          payload:
            trip,

          io,
        }
      );

      return trip;
    } catch (error) {
      console.error(
        "driverArrivedPickupService:",
        error
      );

      throw error;
    }
  };

/* =========================================================
   APPROACHING SCHOOL
========================================================= */

export const approachingSchoolService =
  async (
    tripId,
    io
  ) => {
    try {
      const trip =
        await Trips.findById(
          tripId
        );

      if (!trip) {
        throw new NotFoundError(
          "Trip not found"
        );
      }

      ensureTripInTransit(
        trip
      );

      await notifyDriver(
        trip.driverId,
        {
          notificationKey:
            "APPROACHING_SCHOOL",

          childId:
            trip.child,

          event:
            EVENTS
              .APPROACHING_SCHOOL,

          payload:
            trip,

          io,
        }
      );

      return trip;
    } catch (error) {
      console.error(
        "approachingSchoolService:",
        error
      );

      throw error;
    }
  };

/* =========================================================
   DRIVER ARRIVED SCHOOL
========================================================= */

export const driverArrivedSchoolService =
  async (
    tripId,
    io
  ) => {
    try {
      const trip =
        await Trips.findById(
          tripId
        );

      if (!trip) {
        throw new NotFoundError(
          "Trip not found"
        );
      }

      ensureTripInTransit(
        trip
      );

      await notifyDriver(
        trip.driverId,
        {
          notificationKey:
            "DRIVER_ARRIVED_SCHOOL",

          childId:
            trip.child,

          event:
            EVENTS
              .DRIVER_ARRIVED_SCHOOL,

          payload:
            trip,

          io,
        }
      );

      return trip;
    } catch (error) {
      console.error(
        "driverArrivedSchoolService:",
        error
      );

      throw error;
    }
  };

/* =========================================================
   APPROACHING HOME
========================================================= */

export const approachingHomeService =
  async (
    tripId,
    io
  ) => {
    try {
      const trip =
        await Trips.findById(
          tripId
        );

      if (!trip) {
        throw new NotFoundError(
          "Trip not found"
        );
      }

      ensureTripInTransit(
        trip
      );

      await notifyDriver(
        trip.driverId,
        {
          notificationKey:
            "APPROACHING_HOME",

          childId:
            trip.child,

          event:
            EVENTS
              .APPROACHING_HOME,

          payload:
            trip,

          io,
        }
      );

      return trip;
    } catch (error) {
      console.error(
        "approachingHomeService:",
        error
      );

      throw error;
    }
  };

/* =========================================================
   TRIP DELAYED
========================================================= */

export const tripDelayedService =
  async (
    tripId,
    io
  ) => {
    try {
      const trip =
        await Trips.findById(
          tripId
        );

      if (!trip) {
        throw new NotFoundError(
          "Trip not found"
        );
      }

      ensureTripInTransit(
        trip
      );

      await notifyDriver(
        trip.driverId,
        {
          notificationKey:
            "TRIP_DELAYED",

          childId:
            trip.child,

          event:
            EVENTS
              .TRIP_DELAYED,

          payload:
            trip,

          io,
        }
      );

      return trip;
    } catch (error) {
      console.error(
        "tripDelayedService:",
        error
      );

      throw error;
    }
  };

/* =========================================================
   CANCEL TRIP
========================================================= */

export const tripCancelledService =
  async (
    tripId,
    io
  ) => {
    try {
      if (
        !mongoose.Types.ObjectId.isValid(
          tripId
        )
      ) {
        throw new ValidationError(
          "Invalid Trip ID"
        );
      }

      const trip =
        await Trips.findById(
          tripId
        );

      if (!trip) {
        throw new NotFoundError(
          "Trip not found"
        );
      }

      if (
        trip.status ===
        "completed"
      ) {
        throw new ConflictError(
          "Completed trip cannot be cancelled"
        );
      }

      if (
        trip.status ===
        "cancelled"
      ) {
        throw new ConflictError(
          "Trip already cancelled"
        );
      }

      const now =
        new Date();

      trip.status =
        "cancelled";

      trip.endTime =
        now;

      if (
        trip.startTime
      ) {
        trip.duration =
          Math.max(
            0,

            Math.round(
              (
                now.getTime() -
                new Date(
                  trip.startTime
                ).getTime()
              ) /
                60000
            )
          );
      }

      await trip.save();

      /* ===================================================
         RESET CHILD
      =================================================== */

      if (
        trip.child
      ) {
        await Child.findByIdAndUpdate(
          trip.child,

          {
            $set: {
              status:
                "waiting",
            },
          }
        );
      }

      /* ===================================================
         DRIVER STATUS IF NO OTHER ACTIVE TRIPS
      =================================================== */

      const remaining =
        await Trips.exists({
          driverId:
            trip.driverId,

          status:
            "in_transit",
        });

      if (!remaining) {
        await Driver.findOneAndUpdate(
          {
            driverId:
              trip.driverId,
          },

          {
            $set: {
              currentStatus:
                "idle",

              isOnline:
                false,
            },
          }
        );
      }

      /* ===================================================
         NOTIFY
      =================================================== */

      await notifyDriver(
        trip.driverId,
        {
          notificationKey:
            "TRIP_CANCELLED",

          childId:
            trip.child,

          event:
            EVENTS
              .TRIP_CANCELLED,

          payload:
            trip,

          io,
        }
      );

      return trip;
    } catch (error) {
      console.error(
        "tripCancelledService:",
        error
      );

      throw error;
    }
  };
