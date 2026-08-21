import express from "express";
import mongoose from "mongoose";

import Driver from "../models/Driver.js";
import Trips from "../models/Trips.js";
import Child from "../models/Child.js";

import {
  cloudinary,
  driverUpload,
} from "../config/cloudinary.js";

import verifyDriver, {
  requireApprovedDriver,
} from "../middleware/verifyDriver.js";

import verifyParent from "../middleware/verifyParent.js";
import verifyAdmin from "../middleware/verifyAdmin.js";

const router =
  express.Router();

/* =========================================================
   CONSTANTS
========================================================= */

const IST_OFFSET_MS =
  5.5 *
  60 *
  60 *
  1000;

/* =========================================================
   HELPERS
========================================================= */

/* =========================================================
   NORMALIZE DRIVER ID
========================================================= */

const normalizeDriverId = (
  driverId
) => {
  return String(
    driverId || ""
  )
    .trim()
    .toUpperCase();
};

/* =========================================================
   SAFE REGEX
========================================================= */

const escapeRegex = (
  value
) => {
  return String(
    value || ""
  ).replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
  );
};

/* =========================================================
   SAFE DRIVER
========================================================= */

const getSafeDriver = (
  driver
) => {
  if (
    !driver
  ) {
    return null;
  }

  const data =
    typeof driver.toObject ===
    "function"
      ? driver.toObject()
      : {
          ...driver,
        };

  /*
    Password no longer exists in the Driver schema.

    This remains temporarily so legacy MongoDB records
    containing an old password field can never expose it.
  */

  delete data.password;
  delete data.__v;

  return data;
};

/* =========================================================
   FIND DRIVER
========================================================= */

/*
  Supports:

  ASAN custom Driver ID

  OR

  MongoDB _id
*/

const findDriver =
  async (
    identifier
  ) => {
    if (
      !identifier
    ) {
      return null;
    }

    const value =
      String(
        identifier
      ).trim();

    if (
      !value
    ) {
      return null;
    }

    const normalizedDriverId =
      normalizeDriverId(
        value
      );

    /* =====================================================
       CUSTOM DRIVER ID
    ===================================================== */

    const driverByCustomId =
      await Driver.findOne({
        driverId:
          normalizedDriverId,
      });

    if (
      driverByCustomId
    ) {
      return driverByCustomId;
    }

    /* =====================================================
       MONGODB ID
    ===================================================== */

    if (
      mongoose.Types.ObjectId.isValid(
        value
      )
    ) {
      return Driver.findById(
        value
      );
    }

    return null;
  };

/* =========================================================
   IST DAY RANGE
========================================================= */

const getTodayRangeIST =
  () => {
    const now =
      new Date();

    const istNow =
      new Date(
        now.getTime() +
          IST_OFFSET_MS
      );

    const year =
      istNow.getUTCFullYear();

    const month =
      istNow.getUTCMonth();

    const day =
      istNow.getUTCDate();

    const start =
      new Date(
        Date.UTC(
          year,
          month,
          day,
          0,
          0,
          0,
          0
        ) -
          IST_OFFSET_MS
      );

    const end =
      new Date(
        Date.UTC(
          year,
          month,
          day + 1,
          0,
          0,
          0,
          0
        ) -
          IST_OFFSET_MS
      );

    return {
      start,
      end,
    };
  };

/* =========================================================
   CHECK LIVE LOCATION
========================================================= */

const hasValidLiveLocation = (
  lastLocation
) => {
  return (
    Number.isFinite(
      lastLocation?.lat
    ) &&
    Number.isFinite(
      lastLocation?.lng
    )
  );
};

/* =========================================================
   DRIVER OWNERSHIP CHECK
========================================================= */

/*
  Allows route identifier to be either:

  MongoDB _id

  OR

  Custom ASAN Driver ID
*/

const requireOwnDriverIdentifier =
  (
    paramName
  ) => {
    return (
      req,
      res,
      next
    ) => {
      const identifier =
        String(
          req.params?.[
            paramName
          ] || ""
        ).trim();

      if (
        !identifier
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

      if (
        !req.driver?._id
      ) {
        return res
          .status(401)
          .json({
            success:
              false,

            message:
              "Driver authentication required",
          });
      }

      const authenticatedMongoId =
        String(
          req.driver._id
        );

      const authenticatedDriverId =
        normalizeDriverId(
          req.driver.driverId
        );

      const requestedDriverId =
        normalizeDriverId(
          identifier
        );

      const mongoIdMatch =
        mongoose.Types.ObjectId.isValid(
          identifier
        ) &&
        identifier ===
          authenticatedMongoId;

      const customIdMatch =
        Boolean(
          authenticatedDriverId
        ) &&
        requestedDriverId ===
          authenticatedDriverId;

      if (
        !mongoIdMatch &&
        !customIdMatch
      ) {
        return res
          .status(403)
          .json({
            success:
              false,

            message:
              "You cannot access another Driver account",
          });
      }

      return next();
    };
  };

/* =========================================================
   VERIFY LINKED DRIVER
========================================================= */

/*
  Used for Parent → Driver APIs.

  Parent may only access the Driver linked
  to their own Parent account.
*/

const requireLinkedDriver = (
  req,
  res,
  next
) => {
  const requestedDriverId =
    normalizeDriverId(
      req.params?.driverId ||
        req.query?.driverId
    );

  const linkedDriverId =
    normalizeDriverId(
      req.parent?.driverId
    );

  /* =====================================================
     LINK REQUIRED
  ===================================================== */

  if (
    !linkedDriverId
  ) {
    return res
      .status(409)
      .json({
        success:
          false,

        message:
          "No Driver is linked to this Parent account",
      });
  }

  /* =====================================================
     REQUESTED DRIVER REQUIRED
  ===================================================== */

  if (
    !requestedDriverId
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
     OWN LINK ONLY
  ===================================================== */

  if (
    requestedDriverId !==
    linkedDriverId
  ) {
    return res
      .status(403)
      .json({
        success:
          false,

        message:
          "You cannot access another Driver",
      });
  }

  req.linkedDriverId =
    linkedDriverId;

  return next();
};

/* =========================================================
   CLEANUP NEW PROFILE PHOTO
========================================================= */

const cleanupUploadedPhoto =
  async (
    file
  ) => {
    try {
      if (
        !file?.filename
      ) {
        return;
      }

      await cloudinary
        .uploader
        .destroy(
          file.filename
        );
    } catch (
      error
    ) {
      console.error(
        "NEW DRIVER PHOTO CLEANUP ERROR:",
        error.message
      );
    }
  };

/* =========================================================
   SAVE DRIVER FCM TOKEN
   AUTHENTICATED DRIVER
========================================================= */

/*
  Pending, approved and rejected Drivers may save an FCM
  token because approval/rejection notifications may need
  to be delivered to the device.
*/

router.post(
  "/save-token",

  verifyDriver,

  async (
    req,
    res
  ) => {
    try {
      const normalizedToken =
        typeof req.body
          ?.token ===
        "string"
          ? req.body.token.trim()
          : "";

      if (
        !normalizedToken
      ) {
        return res
          .status(400)
          .json({
            success:
              false,

            message:
              "FCM token is required",
          });
      }

      await Driver.findByIdAndUpdate(
        req.driver._id,

        {
          $addToSet: {
            fcmTokens:
              normalizedToken,
          },
        },

        {
          runValidators:
            true,
        }
      );

      return res
        .status(200)
        .json({
          success:
            true,

          message:
            "Token saved successfully",
        });
    } catch (
      error
    ) {
      console.error(
        "SAVE DRIVER TOKEN ERROR:",
        error
      );

      return res
        .status(500)
        .json({
          success:
            false,

          message:
            "Failed to save token",
        });
    }
  }
);

/* =========================================================
   GET ALL DRIVERS
   ADMIN ONLY
========================================================= */

router.get(
  "/",

  verifyAdmin,

  async (
    req,
    res
  ) => {
    try {
      const drivers =
        await Driver.find()
          .select(
            [
              "name",
              "phone",
              "email",
              "driverId",
              "vehicleNumber",
              "vehicleType",
              "status",
              "profilePhoto",
              "isOnline",
              "currentStatus",
            ].join(" ")
          )
          .sort({
            name:
              1,
          })
          .lean();

      return res
        .status(200)
        .json({
          success:
            true,

          count:
            drivers.length,

          data:
            drivers,
        });
    } catch (
      error
    ) {
      console.error(
        "GET ALL DRIVERS ERROR:",
        error
      );

      return res
        .status(500)
        .json({
          success:
            false,

          message:
            "Failed to fetch Drivers",
        });
    }
  }
);

/* =========================================================
   SEARCH DRIVERS
   ADMIN ONLY
========================================================= */

router.get(
  "/search",

  verifyAdmin,

  async (
    req,
    res
  ) => {
    try {
      const query =
        String(
          req.query.query ||
            ""
        ).trim();

      if (
        !query
      ) {
        return res
          .status(200)
          .json({
            success:
              true,

            data:
              [],
          });
      }

      const safeQuery =
        escapeRegex(
          query
        );

      const drivers =
        await Driver.find({
          $or: [
            {
              name: {
                $regex:
                  safeQuery,

                $options:
                  "i",
              },
            },

            {
              phone: {
                $regex:
                  safeQuery,

                $options:
                  "i",
              },
            },

            {
              email: {
                $regex:
                  safeQuery,

                $options:
                  "i",
              },
            },

            {
              driverId: {
                $regex:
                  safeQuery,

                $options:
                  "i",
              },
            },

            {
              vehicleNumber: {
                $regex:
                  safeQuery,

                $options:
                  "i",
              },
            },
          ],
        })
          .select(
            [
              "name",
              "phone",
              "email",
              "driverId",
              "vehicleNumber",
              "vehicleType",
              "status",
              "profilePhoto",
            ].join(" ")
          )
          .limit(
            10
          )
          .lean();

      return res
        .status(200)
        .json({
          success:
            true,

          data:
            drivers,
        });
    } catch (
      error
    ) {
      console.error(
        "DRIVER SEARCH ERROR:",
        error
      );

      return res
        .status(500)
        .json({
          success:
            false,

          message:
            "Search failed",
        });
    }
  }
);

/* =========================================================
   GET LINKED DRIVER LOCATION
   PARENT ONLY
========================================================= */

/*
  GET /api/driver/location?driverId=ASAN-XXXXXX

  Authorization:

  Bearer <ASAN_PARENT_JWT>
*/

router.get(
  "/location",

  verifyParent,

  requireLinkedDriver,

  async (
    req,
    res
  ) => {
    try {
      /*
        Parents can only access an approved Driver.
      */

      const driver =
        await Driver.findOne({
          driverId:
            req.linkedDriverId,

          status:
            "approved",
        })
          .select(
            [
              "driverId",
              "isOnline",
              "currentStatus",
              "lastLocation",
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
              "Approved Driver not found",
          });
      }

      const liveLocationAvailable =
        hasValidLiveLocation(
          driver.lastLocation
        );

      return res
        .status(200)
        .json({
          success:
            true,

          data: {
            driverId:
              driver.driverId,

            isOnline:
              Boolean(
                driver.isOnline
              ),

            currentStatus:
              driver.currentStatus,

            lastLocation:
              liveLocationAvailable
                ? driver.lastLocation
                : null,
          },
        });
    } catch (
      error
    ) {
      console.error(
        "GET DRIVER LOCATION ERROR:",
        error
      );

      return res
        .status(500)
        .json({
          success:
            false,

          message:
            "Failed to fetch Driver location",
        });
    }
  }
);

/* =========================================================
   DRIVER DASHBOARD
   APPROVED DRIVER OWN ACCOUNT ONLY
========================================================= */

/*
  Operational route.

  Authentication:
    verifyDriver

  Approval:
    requireApprovedDriver

  Ownership:
    requireOwnDriverIdentifier
*/

router.get(
  "/dashboard/:driverId",

  verifyDriver,

  requireApprovedDriver,

  requireOwnDriverIdentifier(
    "driverId"
  ),

  async (
    req,
    res
  ) => {
    try {
      const driver =
        req.driver;

      const driverId =
        normalizeDriverId(
          driver.driverId
        );

      /*
        requireApprovedDriver already verifies this,
        but this defensive check is retained.
      */

      if (
        !driverId
      ) {
        return res
          .status(409)
          .json({
            success:
              false,

            message:
              "Driver ID has not been assigned yet",
          });
      }

      const {
        start,
        end,
      } =
        getTodayRangeIST();

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
                start,

              $lt:
                end,
            },
          }),

          Child.countDocuments({
            driverId,
          }),
        ]);

      return res
        .status(200)
        .json({
          success:
            true,

          data: {
            driverId,

            name:
              driver.name,

            profilePhoto:
              driver.profilePhoto ||
              driver.avatar ||
              "",

            vehicleNumber:
              driver.vehicleNumber,

            vehicleType:
              driver.vehicleType,

            vehicleModel:
              driver.vehicleModel ||
              "",

            rating:
              driver.rating ||
              0,

            status:
              driver.status,

            isOnline:
              Boolean(
                driver.isOnline
              ),

            currentStatus:
              driver.currentStatus,

            totalTrips,

            todayTrips,

            studentsAssigned,
          },
        });
    } catch (
      error
    ) {
      console.error(
        "DRIVER DASHBOARD ERROR:",
        error
      );

      return res
        .status(500)
        .json({
          success:
            false,

          message:
            "Failed to load dashboard",
        });
    }
  }
);

/* =========================================================
   DRIVER PROFILE
   AUTHENTICATED DRIVER OWN ACCOUNT
========================================================= */

/*
  This route intentionally does NOT use
  requireApprovedDriver.

  A pending or rejected Driver still needs to view their
  account/profile and application information.
*/

router.get(
  "/profile/:driverId",

  verifyDriver,

  requireOwnDriverIdentifier(
    "driverId"
  ),

  async (
    req,
    res
  ) => {
    try {
      const driver =
        req.driver;

      let todayTrips =
        0;

      /*
        Only approved Drivers should normally have operational
        trip information.

        The count remains zero for pending/rejected accounts.
      */

      if (
        driver.status ===
          "approved" &&
        driver.driverId
      ) {
        const {
          start,
          end,
        } =
          getTodayRangeIST();

        todayTrips =
          await Trips.countDocuments({
            driverId:
              normalizeDriverId(
                driver.driverId
              ),

            createdAt: {
              $gte:
                start,

              $lt:
                end,
            },
          });
      }

      return res
        .status(200)
        .json({
          success:
            true,

          data: {
            ...getSafeDriver(
              driver
            ),

            todayTrips,
          },
        });
    } catch (
      error
    ) {
      console.error(
        "DRIVER PROFILE ERROR:",
        error
      );

      return res
        .status(500)
        .json({
          success:
            false,

          message:
            "Failed to load profile",
        });
    }
  }
);

/* =========================================================
   DRIVER TRACKING
   LINKED PARENT ONLY
========================================================= */

/*
  GET /api/driver/tracking?driverId=ASAN-XXXXXX

  Authorization:

  Bearer <ASAN_PARENT_JWT>
*/

router.get(
  "/tracking",

  verifyParent,

  requireLinkedDriver,

  async (
    req,
    res
  ) => {
    try {
      const driver =
        await Driver.findOne({
          driverId:
            req.linkedDriverId,

          status:
            "approved",
        })
          .select(
            [
              "driverId",
              "name",
              "phone",
              "vehicleNumber",
              "vehicleType",
              "isOnline",
              "currentStatus",
              "location",
              "lastLocation",
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
              "Approved Driver not found",
          });
      }

      const liveLocationAvailable =
        hasValidLiveLocation(
          driver.lastLocation
        );

      return res
        .status(200)
        .json({
          success:
            true,

          data: {
            driverId:
              driver.driverId,

            name:
              driver.name,

            phone:
              driver.phone,

            profilePhoto:
              driver.profilePhoto ||
              driver.avatar ||
              "",

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

            location:
              driver.location ||
              null,

            lastLocation:
              liveLocationAvailable
                ? driver.lastLocation
                : null,
          },
        });
    } catch (
      error
    ) {
      console.error(
        "DRIVER TRACKING ERROR:",
        error
      );

      return res
        .status(500)
        .json({
          success:
            false,

          message:
            "Tracking failed",
        });
    }
  }
);

/* =========================================================
   UPDATE DRIVER PROFILE
   AUTHENTICATED DRIVER OWN ACCOUNT
========================================================= */

/*
  This route intentionally does NOT use
  requireApprovedDriver.

  Pending/rejected Drivers may need to correct profile
  information.

  Email cannot be edited here because email is the OTP
  authentication identity.

  A future Driver email-change endpoint should verify
  the new email through OTP before changing it.
*/

router.put(
  "/update",

  verifyDriver,

  driverUpload.single(
    "profilePhoto"
  ),

  async (
    req,
    res
  ) => {
    let newPhotoSaved =
      false;

    try {
      const driver =
        req.driver;

      /* ===================================================
         OPTIONAL BODY DRIVER ID CHECK
      =================================================== */

      if (
        req.body?.driverId
      ) {
        const suppliedDriverId =
          normalizeDriverId(
            req.body.driverId
          );

        if (
          suppliedDriverId !==
          normalizeDriverId(
            driver.driverId
          )
        ) {
          await cleanupUploadedPhoto(
            req.file
          );

          return res
            .status(403)
            .json({
              success:
                false,

              message:
                "You cannot update another Driver account",
            });
        }
      }

      /* ===================================================
         PROFILE PHOTO
      =================================================== */

      const oldPhotoPublicId =
        driver
          .profilePhotoPublicId ||
        null;

      if (
        req.file
      ) {
        driver.profilePhoto =
          req.file.path;

        driver.profilePhotoPublicId =
          req.file.filename;
      }

      /* ===================================================
         ALLOWED PROFILE FIELDS
      =================================================== */

      const allowedFields =
        [
          "name",
          "address",
          "vehicleNumber",
          "vehicleType",
          "vehicleModel",
          "licenseNumber",
          "avatar",
        ];

      const updates =
        {};

      for (
        const field of
        allowedFields
      ) {
        if (
          req.body?.[
            field
          ] ===
          undefined
        ) {
          continue;
        }

        updates[
          field
        ] =
          typeof req.body[
            field
          ] ===
          "string"
            ? req.body[
                field
              ].trim()
            : req.body[
                field
              ];
      }

      /* ===================================================
         NAME
      =================================================== */

      if (
        updates.name !==
          undefined &&
        !updates.name
      ) {
        await cleanupUploadedPhoto(
          req.file
        );

        return res
          .status(400)
          .json({
            success:
              false,

            message:
              "Name cannot be empty",
          });
      }

      /* ===================================================
         ADDRESS
      =================================================== */

      if (
        updates.address !==
          undefined &&
        !updates.address
      ) {
        await cleanupUploadedPhoto(
          req.file
        );

        return res
          .status(400)
          .json({
            success:
              false,

            message:
              "Address cannot be empty",
          });
      }

      /* ===================================================
         VEHICLE NUMBER
      =================================================== */

      if (
        updates.vehicleNumber !==
        undefined
      ) {
        updates.vehicleNumber =
          String(
            updates.vehicleNumber
          )
            .trim()
            .toUpperCase()
            .replace(
              /\s+/g,
              ""
            );

        if (
          !updates.vehicleNumber
        ) {
          await cleanupUploadedPhoto(
            req.file
          );

          return res
            .status(400)
            .json({
              success:
                false,

              message:
                "Vehicle number cannot be empty",
            });
        }
      }

      /* ===================================================
         VEHICLE TYPE
      =================================================== */

      if (
        updates.vehicleType !==
          undefined &&
        !updates.vehicleType
      ) {
        await cleanupUploadedPhoto(
          req.file
        );

        return res
          .status(400)
          .json({
            success:
              false,

            message:
              "Vehicle type cannot be empty",
          });
      }

      /* ===================================================
         LICENSE NUMBER
      =================================================== */

      if (
        updates.licenseNumber !==
        undefined
      ) {
        updates.licenseNumber =
          String(
            updates.licenseNumber
          )
            .trim()
            .toUpperCase();

        if (
          !updates.licenseNumber
        ) {
          await cleanupUploadedPhoto(
            req.file
          );

          return res
            .status(400)
            .json({
              success:
                false,

              message:
                "License number cannot be empty",
            });
        }
      }

      /* ===================================================
         APPLY UPDATES
      =================================================== */

      for (
        const [
          field,
          value,
        ] of
        Object.entries(
          updates
        )
      ) {
        driver[
          field
        ] =
          value;
      }

      /* ===================================================
         SAVE
      =================================================== */

      await driver.save();

      newPhotoSaved =
        true;

      /* ===================================================
         DELETE OLD PHOTO AFTER SAVE
      =================================================== */

      if (
        req.file &&
        oldPhotoPublicId &&
        oldPhotoPublicId !==
          driver
            .profilePhotoPublicId
      ) {
        try {
          await cloudinary
            .uploader
            .destroy(
              oldPhotoPublicId
            );
        } catch (
          error
        ) {
          console.error(
            "OLD DRIVER PHOTO DELETE ERROR:",
            error.message
          );
        }
      }

      return res
        .status(200)
        .json({
          success:
            true,

          message:
            "Driver updated successfully",

          data:
            getSafeDriver(
              driver
            ),
        });
    } catch (
      error
    ) {
      if (
        req.file &&
        !newPhotoSaved
      ) {
        await cleanupUploadedPhoto(
          req.file
        );
      }

      console.error(
        "DRIVER UPDATE ERROR:",
        error
      );

      /* ===================================================
         DUPLICATE VALUE
      =================================================== */

      if (
        error?.code ===
        11000
      ) {
        return res
          .status(409)
          .json({
            success:
              false,

            message:
              "Driver information already exists",
          });
      }

      /* ===================================================
         MONGOOSE VALIDATION
      =================================================== */

      if (
        error?.name ===
        "ValidationError"
      ) {
        const validationMessage =
          Object.values(
            error.errors ||
              {}
          )?.[0]
            ?.message ||
          error.message;

        return res
          .status(400)
          .json({
            success:
              false,

            message:
              validationMessage,
          });
      }

      return res
        .status(500)
        .json({
          success:
            false,

          message:
            "Update failed",
        });
    }
  }
);

/* =========================================================
   GET DRIVER BY ID
   ADMIN ONLY

   IMPORTANT:
   KEEP THIS ROUTE LAST.

   "/:id" could otherwise catch named routes.
========================================================= */

router.get(
  "/:id",

  verifyAdmin,

  async (
    req,
    res
  ) => {
    try {
      const driver =
        await findDriver(
          req.params.id
        );

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

      return res
        .status(200)
        .json({
          success:
            true,

          data:
            getSafeDriver(
              driver
            ),
        });
    } catch (
      error
    ) {
      console.error(
        "GET DRIVER ERROR:",
        error
      );

      return res
        .status(500)
        .json({
          success:
            false,

          message:
            "Failed to fetch Driver",
        });
    }
  }
);

/* =========================================================
   EXPORT
========================================================= */

export default router;
