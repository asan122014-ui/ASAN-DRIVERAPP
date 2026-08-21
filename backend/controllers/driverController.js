import Driver from "../models/Driver.js";
import Trips from "../models/Trips.js";
import Notification from "../models/Notification.js";
import Child from "../models/Child.js";

/* =========================================================
   HELPERS
========================================================= */

/* =========================================================
   NORMALIZE DRIVER ID
========================================================= */

const normalizeDriverId = (
  value
) => {
  return String(
    value || ""
  )
    .trim()
    .toUpperCase();
};

/* =========================================================
   VALIDATE COORDINATES
========================================================= */

const validateCoordinates = (
  latitude,
  longitude
) => {
  const lat =
    Number(
      latitude
    );

  const lng =
    Number(
      longitude
    );

  if (
    !Number.isFinite(
      lat
    ) ||
    !Number.isFinite(
      lng
    )
  ) {
    return {
      valid: false,
    };
  }

  if (
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  ) {
    return {
      valid: false,
    };
  }

  return {
    valid: true,

    latitude:
      lat,

    longitude:
      lng,
  };
};

/* =========================================================
   GET DRIVER PROFILE
========================================================= */

export const getDriverProfile =
  async (
    req,
    res
  ) => {
    try {
      const driverId =
        normalizeDriverId(
          req.params.driverId
        );

      if (
        !driverId
      ) {
        return res
          .status(400)
          .json({
            success:
              false,

            message:
              "Driver ID is required",
          });
      }

      const driver =
        await Driver.findOne({
          driverId,
        }).lean();

      if (
        !driver
      ) {
        return res
          .status(404)
          .json({
            success:
              false,

            message:
              "Driver not found",
          });
      }

      return res.json({
        success:
          true,

        data:
          driver,
      });
    } catch (
      error
    ) {
      console.error(
        "GET DRIVER PROFILE ERROR:",
        error
      );

      return res
        .status(500)
        .json({
          success:
            false,

          message:
            "Failed to fetch driver profile",
        });
    }
  };

/* =========================================================
   DRIVER DASHBOARD
========================================================= */

export const getDriverDashboard =
  async (
    req,
    res
  ) => {
    try {
      const driverId =
        normalizeDriverId(
          req.params.driverId
        );

      if (
        !driverId
      ) {
        return res
          .status(400)
          .json({
            success:
              false,

            message:
              "Driver ID is required",
          });
      }

      const driver =
        await Driver.findOne({
          driverId,
        })
          .select(
            [
              "name",
              "driverId",
              "vehicleNumber",
              "vehicleType",
              "vehicleModel",
              "rating",
              "status",
              "currentStatus",
              "isOnline",
              "profilePhoto",
              "avatar",
            ].join(" ")
          )
          .lean();

      if (
        !driver
      ) {
        return res
          .status(404)
          .json({
            success:
              false,

            message:
              "Driver not found",
          });
      }

      /* =====================================================
         TODAY RANGE
      ===================================================== */

      const todayStart =
        new Date();

      todayStart.setHours(
        0,
        0,
        0,
        0
      );

      const tomorrowStart =
        new Date(
          todayStart
        );

      tomorrowStart.setDate(
        tomorrowStart.getDate() +
          1
      );

      /* =====================================================
         DASHBOARD COUNTS
      ===================================================== */

      const [
        totalTrips,
        todayTrips,
        studentsAssigned,
      ] =
        await Promise.all([
          Trips.countDocuments({
            driverId,
          }),

          Trips.countDocuments({
            driverId,

            createdAt: {
              $gte:
                todayStart,

              $lt:
                tomorrowStart,
            },
          }),

          Child.countDocuments({
            driverId,
          }),
        ]);

      return res.json({
        success:
          true,

        data: {
          driverId:
            driver.driverId,

          name:
            driver.name,

          vehicleNumber:
            driver.vehicleNumber,

          vehicleType:
            driver.vehicleType,

          vehicleModel:
            driver.vehicleModel ||
            "",

          profilePhoto:
            driver.profilePhoto ||
            driver.avatar ||
            "",

          rating:
            driver.rating ||
            0,

          status:
            driver.status,

          currentStatus:
            driver.currentStatus,

          isOnline:
            Boolean(
              driver.isOnline
            ),

          totalTrips,

          todayTrips,

          studentsAssigned,
        },
      });
    } catch (
      error
    ) {
      console.error(
        "GET DRIVER DASHBOARD ERROR:",
        error
      );

      return res
        .status(500)
        .json({
          success:
            false,

          message:
            "Failed to fetch dashboard",
        });
    }
  };

/* =========================================================
   GET ASSIGNED STUDENTS
========================================================= */

export const getAssignedStudents =
  async (
    req,
    res
  ) => {
    try {
      const driverId =
        normalizeDriverId(
          req.params.driverId
        );

      if (
        !driverId
      ) {
        return res
          .status(400)
          .json({
            success:
              false,

            message:
              "Driver ID is required",
          });
      }

      /* =====================================================
         MAKE SURE DRIVER EXISTS
      ===================================================== */

      const driverExists =
        await Driver.exists({
          driverId,
        });

      if (
        !driverExists
      ) {
        return res
          .status(404)
          .json({
            success:
              false,

            message:
              "Driver not found",
          });
      }

      const students =
        await Child.find({
          driverId,
        })
          .sort({
            createdAt:
              1,
          })
          .lean();

      return res.json({
        success:
          true,

        count:
          students.length,

        data:
          students,
      });
    } catch (
      error
    ) {
      console.error(
        "GET ASSIGNED STUDENTS ERROR:",
        error
      );

      return res
        .status(500)
        .json({
          success:
            false,

          message:
            "Failed to fetch assigned students",
        });
    }
  };

/* =========================================================
   UPDATE DRIVER LOCATION
========================================================= */

export const updateDriverLocation =
  async (
    req,
    res
  ) => {
    try {
      const driverId =
        normalizeDriverId(
          req.params.driverId
        );

      const {
        latitude,
        longitude,

        eta,
        speed,
        heading,
        accuracy,
      } =
        req.body;

      if (
        !driverId
      ) {
        return res
          .status(400)
          .json({
            success:
              false,

            message:
              "Driver ID is required",
          });
      }

      /* =====================================================
         VALIDATE LOCATION
      ===================================================== */

      if (
        latitude ===
          undefined ||
        longitude ===
          undefined
      ) {
        return res
          .status(400)
          .json({
            success:
              false,

            message:
              "Latitude and longitude are required",
          });
      }

      const coordinates =
        validateCoordinates(
          latitude,
          longitude
        );

      if (
        !coordinates.valid
      ) {
        return res
          .status(400)
          .json({
            success:
              false,

            message:
              "Invalid latitude or longitude",
          });
      }

      /* =====================================================
         FIND DRIVER
      ===================================================== */

      const driver =
        await Driver.findOne({
          driverId,
        });

      if (
        !driver
      ) {
        return res
          .status(404)
          .json({
            success:
              false,

            message:
              "Driver not found",
          });
      }

      /* =====================================================
         UPDATE LIVE LOCATION
      ===================================================== */

      driver.updateLiveLocation({
        lat:
          coordinates.latitude,

        lng:
          coordinates.longitude,

        eta:
          eta ?? "--",

        speed:
          speed ?? 0,

        heading:
          heading ?? 0,

        accuracy:
          accuracy ?? null,
      });

      /* =====================================================
         MARK DRIVER ONLINE
      ===================================================== */

      driver.isOnline =
        true;

      if (
        driver.currentStatus ===
        "offline"
      ) {
        driver.currentStatus =
          "idle";
      }

      await driver.save();

      return res.json({
        success:
          true,

        message:
          "Driver location updated",

        data: {
          driverId:
            driver.driverId,

          location:
            driver.location,

          lastLocation:
            driver.lastLocation,

          isOnline:
            driver.isOnline,

          currentStatus:
            driver.currentStatus,
        },
      });
    } catch (
      error
    ) {
      console.error(
        "UPDATE DRIVER LOCATION ERROR:",
        error
      );

      return res
        .status(500)
        .json({
          success:
            false,

          message:
            "Failed to update driver location",
        });
    }
  };

/* =========================================================
   GET DRIVER LAST LOCATION
   USED BY PARENT
========================================================= */

export const getDriverLastLocation =
  async (
    req,
    res
  ) => {
    try {
      const driverId =
        normalizeDriverId(
          req.query.driverId
        );

      if (
        !driverId
      ) {
        return res
          .status(400)
          .json({
            success:
              false,

            message:
              "Driver ID is required",
          });
      }

      const driver =
        await Driver.findOne({
          driverId,
        })
          .select(
            [
              "driverId",
              "name",
              "vehicleNumber",
              "vehicleType",
              "lastLocation",
              "isOnline",
              "currentStatus",
            ].join(" ")
          )
          .lean();

      if (
        !driver
      ) {
        return res
          .status(404)
          .json({
            success:
              false,

            message:
              "Driver not found",
          });
      }

      const hasLocation =
        Number.isFinite(
          driver.lastLocation
            ?.lat
        ) &&
        Number.isFinite(
          driver.lastLocation
            ?.lng
        );

      return res.json({
        success:
          true,

        data: {
          driverId:
            driver.driverId,

          name:
            driver.name,

          vehicleNumber:
            driver.vehicleNumber,

          vehicleType:
            driver.vehicleType,

          isOnline:
            Boolean(
              driver.isOnline
            ),

          currentStatus:
            driver.currentStatus,

          lastLocation:
            hasLocation
              ? driver.lastLocation
              : null,
        },
      });
    } catch (
      error
    ) {
      console.error(
        "GET DRIVER LAST LOCATION ERROR:",
        error
      );

      return res
        .status(500)
        .json({
          success:
            false,

          message:
            "Failed to fetch driver location",
        });
    }
  };

/* =========================================================
   GET DRIVER NOTIFICATIONS
========================================================= */

export const getDriverNotifications =
  async (
    req,
    res
  ) => {
    try {
      const driverId =
        normalizeDriverId(
          req.params.driverId
        );

      if (
        !driverId
      ) {
        return res
          .status(400)
          .json({
            success:
              false,

            message:
              "Driver ID is required",
          });
      }

      /* =====================================================
         VERIFY DRIVER
      ===================================================== */

      const driver =
        await Driver.findOne({
          driverId,
        })
          .select(
            "_id driverId"
          )
          .lean();

      if (
        !driver
      ) {
        return res
          .status(404)
          .json({
            success:
              false,

            message:
              "Driver not found",
          });
      }

      /*
        IMPORTANT:

        Your existing code searches:

          Notification.find({
            driver: driverId
          })

        This is retained for compatibility.

        If Notification.driver is actually a MongoDB
        ObjectId reference to Driver, this query should
        instead use:

          driver._id

        We should verify Notification.js before changing it.
      */

      const notifications =
        await Notification.find({
          driver:
            driverId,
        })
          .sort({
            createdAt:
              -1,
          })
          .lean();

      return res.json({
        success:
          true,

        count:
          notifications.length,

        data:
          notifications,
      });
    } catch (
      error
    ) {
      console.error(
        "GET DRIVER NOTIFICATIONS ERROR:",
        error
      );

      return res
        .status(500)
        .json({
          success:
            false,

          message:
            "Failed to fetch notifications",
        });
    }
  };
