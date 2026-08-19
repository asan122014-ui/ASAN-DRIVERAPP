import express from "express";
import mongoose from "mongoose";

import Driver from "../models/Driver.js";
import Parent from "../models/Parent.js";
import Trips from "../models/Trips.js";
import Child from "../models/Child.js";

import {
  cloudinary,
  driverUpload,
} from "../config/cloudinary.js";

import verifyDriver from "../middleware/verifyDriver.js";
import verifyAdmin from "../middleware/verifyAdmin.js";
import verifyFirebaseToken from "../middleware/verifyFirebaseToken.js";

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
  if (!driver) {
    return null;
  }

  const data =
    typeof driver.toObject ===
    "function"
      ? driver.toObject()
      : { ...driver };

  delete data.password;

  return data;
};

/* =========================================================
   FIND DRIVER
========================================================= */

const findDriver =
  async (
    identifier
  ) => {
    if (!identifier) {
      return null;
    }

    const value =
      String(
        identifier
      ).trim();

    if (!value) {
      return null;
    }

    const normalizedDriverId =
      normalizeDriverId(
        value
      );

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
   DRIVER OWNERSHIP CHECK
========================================================= */

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

      if (!identifier) {
        return res.status(400).json({
          success: false,
          message:
            "Driver ID is required",
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
        requestedDriverId ===
        authenticatedDriverId;

      if (
        !mongoIdMatch &&
        !customIdMatch
      ) {
        return res.status(403).json({
          success: false,

          message:
            "You cannot access another Driver account",
        });
      }

      return next();
    };
  };

/* =========================================================
   LOAD AUTHENTICATED PARENT
========================================================= */

const requireParentAccount = async (
  req,
  res,
  next
) => {
  try {
    const firebaseUid =
      req.firebaseUser?.uid;

    if (!firebaseUid) {
      return res.status(401).json({
        success: false,
        message:
          "Parent authentication required",
      });
    }

    const parent =
      await Parent.findOne({
        firebaseUid,
      }).select(
        "+firebaseUid"
      );

    if (!parent) {
      return res.status(404).json({
        success: false,
        message:
          "Parent account not found",
      });
    }

    if (
      parent.status ===
      "inactive"
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Parent account is inactive",
      });
    }

    req.parent =
      parent;

    return next();
  } catch (error) {
    console.error(
      "LOAD PARENT ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Parent authentication failed",
    });
  }
};

/* =========================================================
   VERIFY LINKED DRIVER
========================================================= */

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

  if (!linkedDriverId) {
    return res.status(409).json({
      success: false,
      message:
        "No Driver is linked to this Parent account",
    });
  }

  if (
    !requestedDriverId
  ) {
    return res.status(400).json({
      success: false,
      message:
        "Driver ID is required",
    });
  }

  if (
    requestedDriverId !==
    linkedDriverId
  ) {
    return res.status(403).json({
      success: false,

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

      await cloudinary.uploader.destroy(
        file.filename
      );
    } catch (error) {
      console.error(
        "NEW DRIVER PHOTO CLEANUP ERROR:",
        error.message
      );
    }
  };

/* =========================================================
   SAVE DRIVER FCM TOKEN
   DRIVER ONLY
========================================================= */

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

      if (!normalizedToken) {
        return res.status(400).json({
          success: false,
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
        }
      );

      return res.status(200).json({
        success: true,

        message:
          "Token saved successfully",
      });
    } catch (error) {
      console.error(
        "SAVE DRIVER TOKEN ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
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
            "name phone email driverId vehicleNumber vehicleType status profilePhoto"
          )
          .sort({
            name: 1,
          })
          .lean();

      return res.status(200).json({
        success: true,

        count:
          drivers.length,

        data:
          drivers,
      });
    } catch (error) {
      console.error(
        "GET ALL DRIVERS ERROR:",
        error
      );

      return res.status(500).json({
        success: false,

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

      if (!query) {
        return res.status(200).json({
          success: true,
          data: [],
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
              driverId: {
                $regex:
                  safeQuery,

                $options:
                  "i",
              },
            },
          ],
        })
          .select(
            "name phone email driverId vehicleNumber vehicleType status profilePhoto"
          )
          .limit(10)
          .lean();

      return res.status(200).json({
        success: true,
        data:
          drivers,
      });
    } catch (error) {
      console.error(
        "DRIVER SEARCH ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
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

router.get(
  "/location",

  verifyFirebaseToken,
  requireParentAccount,
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
        }).select(
          "driverId isOnline currentStatus lastLocation"
        );

      if (!driver) {
        return res.status(404).json({
          success: false,
          message:
            "Driver not found",
        });
      }

      return res.status(200).json({
        success: true,

        data: {
          driverId:
            driver.driverId,

          isOnline:
            driver.isOnline,

          currentStatus:
            driver.currentStatus,

          lastLocation:
            driver.lastLocation ||
            null,
        },
      });
    } catch (error) {
      console.error(
        "GET DRIVER LOCATION ERROR:",
        error
      );

      return res.status(500).json({
        success: false,

        message:
          "Failed to fetch Driver location",
      });
    }
  }
);

/* =========================================================
   DRIVER DASHBOARD
   DRIVER OWN ACCOUNT ONLY
========================================================= */

router.get(
  "/dashboard/:driverId",

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

      const driverId =
        driver.driverId;

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

      return res.status(200).json({
        success: true,

        data: {
          driverId,

          name:
            driver.name,

          vehicleNumber:
            driver.vehicleNumber,

          vehicleType:
            driver.vehicleType,

          rating:
            driver.rating,

          status:
            driver.status,

          isOnline:
            driver.isOnline,

          currentStatus:
            driver.currentStatus,

          totalTrips,

          todayTrips,

          studentsAssigned,
        },
      });
    } catch (error) {
      console.error(
        "DRIVER DASHBOARD ERROR:",
        error
      );

      return res.status(500).json({
        success: false,

        message:
          "Failed to load dashboard",
      });
    }
  }
);

/* =========================================================
   DRIVER PROFILE
   DRIVER OWN ACCOUNT ONLY
========================================================= */

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

      const {
        start,
        end,
      } =
        getTodayRangeIST();

      const todayTrips =
        await Trips.countDocuments({
          driverId:
            driver.driverId,

          createdAt: {
            $gte:
              start,

            $lt:
              end,
          },
        });

      return res.status(200).json({
        success: true,

        data: {
          ...getSafeDriver(
            driver
          ),

          todayTrips,
        },
      });
    } catch (error) {
      console.error(
        "DRIVER PROFILE ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
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

router.get(
  "/tracking",

  /* =======================================================
     TEMPORARY DEBUG
  ======================================================= */

  (
    req,
    res,
    next
  ) => {
    console.log(
      "🚗 PARENT TRACKING ROUTE V2 REACHED"
    );

    console.log(
      "🔐 Authorization header:",
      req.headers.authorization
        ? "PRESENT"
        : "MISSING"
    );

    console.log(
      "🔎 Requested Driver ID:",
      req.query?.driverId ||
        "MISSING"
    );

    next();
  },

  /* =======================================================
     PARENT FIREBASE AUTH
  ======================================================= */

  verifyFirebaseToken,

  /* =======================================================
     LOAD PARENT
  ======================================================= */

  requireParentAccount,

  /* =======================================================
     VERIFY DRIVER BELONGS TO PARENT
  ======================================================= */

  requireLinkedDriver,

  /* =======================================================
     FETCH SAFE DRIVER TRACKING DATA
  ======================================================= */

  async (
    req,
    res
  ) => {
    try {
      console.log(
        "✅ PARENT AUTHENTICATION PASSED"
      );

      console.log(
        "👤 Parent:",
        String(
          req.parent?._id ||
            ""
        )
      );

      console.log(
        "🚗 Linked Driver:",
        req.linkedDriverId
      );

      const driver =
        await Driver.findOne({
          driverId:
            req.linkedDriverId,

          status:
            "approved",
        }).select(
          "driverId name phone vehicleNumber vehicleType isOnline currentStatus location lastLocation profilePhoto"
        );

      if (!driver) {
        return res
          .status(404)
          .json({
            success:
              false,

            message:
              "Driver not found",
          });
      }

      console.log(
        "✅ DRIVER TRACKING DATA RETURNED:",
        driver.driverId
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
              driver.profilePhoto,

            vehicleNumber:
              driver.vehicleNumber,

            vehicleType:
              driver.vehicleType,

            isOnline:
              driver.isOnline,

            currentStatus:
              driver.currentStatus,

            location:
              driver.location,

            lastLocation:
              driver.lastLocation,
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
   DRIVER OWN ACCOUNT ONLY
========================================================= */

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

          return res.status(403).json({
            success: false,

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

      if (req.file) {
        driver.profilePhoto =
          req.file.path;

        driver.profilePhotoPublicId =
          req.file.filename;
      }

      /* ===================================================
         ALLOWED PROFILE FIELDS
      =================================================== */

      const allowedFields = [
        "name",
        "email",
        "address",
        "vehicleNumber",
        "vehicleType",
        "vehicleModel",
        "licenseNumber",
        "avatar",
      ];

      const updates = {};

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

        updates[field] =
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

        return res.status(400).json({
          success: false,
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

        return res.status(400).json({
          success: false,
          message:
            "Address cannot be empty",
        });
      }

      /* ===================================================
         EMAIL
      =================================================== */

      if (
        updates.email !==
        undefined
      ) {
        const email =
          String(
            updates.email
          )
            .trim()
            .toLowerCase();

        const emailRegex =
          /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (
          !emailRegex.test(
            email
          )
        ) {
          await cleanupUploadedPhoto(
            req.file
          );

          return res.status(400).json({
            success: false,

            message:
              "Enter a valid email address",
          });
        }

        const duplicateEmail =
          await Driver.findOne({
            email,

            _id: {
              $ne:
                driver._id,
            },
          }).select(
            "_id"
          );

        if (
          duplicateEmail
        ) {
          await cleanupUploadedPhoto(
            req.file
          );

          return res.status(409).json({
            success: false,

            message:
              "Email is already registered",
          });
        }

        updates.email =
          email;
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
            .toUpperCase();

        if (
          !updates.vehicleNumber
        ) {
          await cleanupUploadedPhoto(
            req.file
          );

          return res.status(400).json({
            success: false,

            message:
              "Vehicle number cannot be empty",
          });
        }
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

          return res.status(400).json({
            success: false,

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
        driver[field] =
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
        } catch (error) {
          console.error(
            "OLD DRIVER PHOTO DELETE ERROR:",
            error.message
          );
        }
      }

      return res.status(200).json({
        success: true,

        message:
          "Driver updated successfully",

        data:
          getSafeDriver(
            driver
          ),
      });
    } catch (error) {
      /*
        If MongoDB save fails, remove the newly
        uploaded Cloudinary image.
      */

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

      if (
        error?.code ===
        11000
      ) {
        return res.status(409).json({
          success: false,

          message:
            "Driver information already exists",
        });
      }

      if (
        error?.name ===
        "ValidationError"
      ) {
        return res.status(400).json({
          success: false,

          message:
            error.message,
        });
      }

      return res.status(500).json({
        success: false,
        message:
          "Update failed",
      });
    }
  }
);

/* =========================================================
   GET DRIVER BY ID
   ADMIN ONLY
========================================================= */

/*
  Keep LAST because /:id could otherwise
  match named routes.
*/

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

      if (!driver) {
        return res.status(404).json({
          success: false,
          message:
            "Driver not found",
        });
      }

      return res.status(200).json({
        success: true,

        data:
          getSafeDriver(
            driver
          ),
      });
    } catch (error) {
      console.error(
        "GET DRIVER ERROR:",
        error
      );

      return res.status(500).json({
        success: false,

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
