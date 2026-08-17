import express from "express";

import Parent from "../models/Parent.js";
import Driver from "../models/Driver.js";
import Child from "../models/Child.js";
import DriverRequest from "../models/DriverRequest.js";
import Trip from "../models/Trips.js";
import Notification from "../models/Notification.js";

import verifyFirebaseToken from "../middleware/verifyFirebaseToken.js";
import verifyAdmin from "../middleware/verifyAdmin.js";

const router = express.Router();

/* =========================================================
   HELPERS
========================================================= */

/* =========================================================
   SAFE PARENT RESPONSE
========================================================= */

const getSafeParent = (parent) => {
  if (!parent) {
    return null;
  }

  const data =
    typeof parent.toObject === "function"
      ? parent.toObject()
      : { ...parent };

  delete data.password;
  delete data.firebaseUid;
  delete data.__v;

  return data;
};

/* =========================================================
   LOAD AUTHENTICATED PARENT
========================================================= */

/*
  Flow:

  Firebase ID Token
        ↓
  verifyFirebaseToken
        ↓
  req.firebaseUser.uid
        ↓
  Find MongoDB Parent linked to that Firebase UID
*/

const requireParentAccount = async (
  req,
  res,
  next
) => {
  try {
    const firebaseUid =
      req.firebaseUser?.uid;

    if (!firebaseUid) {
      return res
        .status(401)
        .json({
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
      return res
        .status(404)
        .json({
          success: false,
          message:
            "Parent account not found",
        });
    }

    if (
      parent.status ===
      "inactive"
    ) {
      return res
        .status(403)
        .json({
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

    return res
      .status(500)
      .json({
        success: false,
        message:
          "Failed to authenticate Parent",
      });
  }
};

/* =========================================================
   VERIFY PARENT OWNERSHIP
========================================================= */

const requireOwnParent = (
  paramName
) => {
  return (
    req,
    res,
    next
  ) => {
    const requestedParentId =
      req.params?.[
        paramName
      ];

    const authenticatedParentId =
      req.parent?._id?.toString();

    if (
      !requestedParentId ||
      !authenticatedParentId
    ) {
      return res
        .status(400)
        .json({
          success: false,
          message:
            "Parent ID is required",
        });
    }

    if (
      requestedParentId !==
      authenticatedParentId
    ) {
      return res
        .status(403)
        .json({
          success: false,
          message:
            "You cannot access another Parent account",
        });
    }

    return next();
  };
};

/* =========================================================
   CHECK OPTIONAL BODY PARENT ID
========================================================= */

/*
  Existing frontend requests may still send parentId.

  We don't trust it.

  If it is supplied, it must match the authenticated
  Firebase Parent.
*/

const validateBodyParentId = (
  req,
  res
) => {
  const suppliedParentId =
    req.body?.parentId;

  if (!suppliedParentId) {
    return true;
  }

  return (
    String(
      suppliedParentId
    ) ===
    String(
      req.parent._id
    )
  );
};

/* =========================================================
   GET ALL PARENTS — ADMIN ONLY
========================================================= */

router.get(
  "/",

  verifyAdmin,

  async (
    req,
    res
  ) => {
    try {
      const parents =
        await Parent.find();

      const result =
        await Promise.all(
          parents.map(
            async (
              parent
            ) => {
              const [
                children,
                driver,
              ] =
                await Promise.all([
                  Child.find({
                    parentId:
                      parent._id,
                  }),

                  parent.driverId
                    ? Driver.findOne({
                        driverId:
                          parent.driverId,
                      }).select(
                        "driverId name phone email vehicleNumber vehicleType status profilePhoto"
                      )
                    : null,
                ]);

              return {
                ...getSafeParent(
                  parent
                ),

                children,

                driver,
              };
            }
          )
        );

      return res
        .status(200)
        .json({
          success: true,
          data: result,
        });
    } catch (error) {
      console.error(
        "GET PARENTS ERROR:",
        error
      );

      return res
        .status(500)
        .json({
          success: false,
          message:
            "Failed to fetch Parents",
        });
    }
  }
);

/* =========================================================
   DOWNLOAD PARENT DATA — OWN ACCOUNT ONLY
========================================================= */

router.get(
  "/download-data/:parentId",

  verifyFirebaseToken,
  requireParentAccount,
  requireOwnParent(
    "parentId"
  ),

  async (
    req,
    res
  ) => {
    try {
      const parentId =
        req.parent._id;

      /* ===================================================
         LOAD RELATED DATA
      =================================================== */

      const [
        children,
        trips,
        notifications,
      ] =
        await Promise.all([
          Child.find({
            parentId,
          }),

          Trip.find({
            parent:
              parentId,
          })
            .populate(
              "child",
              "name grade school"
            )
            .sort({
              createdAt:
                -1,
            }),

          Notification.find({
            parent:
              parentId,
          }).sort({
            createdAt:
              -1,
          }),
        ]);

      /* ===================================================
         DOWNLOAD DATA
      =================================================== */

      const downloadData = {
        parent:
          getSafeParent(
            req.parent
          ),

        children:
          children.map(
            (
              child
            ) =>
              child.toObject()
          ),

        trips:
          trips.map(
            (
              trip
            ) =>
              trip.toObject()
          ),

        notifications:
          notifications.map(
            (
              notification
            ) =>
              notification.toObject()
          ),

        downloadedAt:
          new Date()
            .toISOString(),
      };

      return res
        .status(200)
        .json({
          success: true,

          message:
            "Data downloaded successfully",

          data:
            downloadData,
        });
    } catch (error) {
      console.error(
        "DOWNLOAD DATA ERROR:",
        error
      );

      return res
        .status(500)
        .json({
          success: false,

          message:
            "Failed to download data",
        });
    }
  }
);

/* =========================================================
   ASSIGN DRIVER — ADMIN ONLY
========================================================= */

router.put(
  "/assign-driver",

  verifyAdmin,

  async (
    req,
    res
  ) => {
    try {
      const {
        parentId,
        driverId,
      } =
        req.body || {};

      if (
        !parentId ||
        !driverId
      ) {
        return res
          .status(400)
          .json({
            success: false,

            message:
              "parentId and driverId are required",
          });
      }

      /* ===================================================
         NORMALIZE DRIVER ID
      =================================================== */

      const normalizedDriverId =
        String(
          driverId
        )
          .trim()
          .toUpperCase();

      /* ===================================================
         VERIFY DRIVER
      =================================================== */

      const driver =
        await Driver.findOne({
          driverId:
            normalizedDriverId,
        });

      if (!driver) {
        return res
          .status(404)
          .json({
            success: false,
            message:
              "Driver not found",
          });
      }

      if (
        driver.status !==
        "approved"
      ) {
        return res
          .status(400)
          .json({
            success: false,

            message:
              "Only approved Drivers can be assigned",
          });
      }

      /* ===================================================
         VERIFY PARENT
      =================================================== */

      const parent =
        await Parent.findById(
          parentId
        );

      if (!parent) {
        return res
          .status(404)
          .json({
            success: false,
            message:
              "Parent not found",
          });
      }

      /* ===================================================
         UPDATE PARENT
      =================================================== */

      parent.driverId =
        driver.driverId;

      await parent.save();

      /* ===================================================
         UPDATE CHILDREN
      =================================================== */

      await Child.updateMany(
        {
          parentId:
            parent._id,
        },

        {
          $set: {
            driverId:
              driver.driverId,
          },
        }
      );

      return res
        .status(200)
        .json({
          success: true,

          message:
            "Driver assigned successfully",

          data:
            getSafeParent(
              parent
            ),
        });
    } catch (error) {
      console.error(
        "ASSIGN DRIVER ERROR:",
        error
      );

      if (
        error?.name ===
        "CastError"
      ) {
        return res
          .status(400)
          .json({
            success: false,
            message:
              "Invalid Parent ID",
          });
      }

      return res
        .status(500)
        .json({
          success: false,

          message:
            "Failed to assign Driver",
        });
    }
  }
);

/* =========================================================
   LOGOUT / REMOVE FCM TOKEN
========================================================= */

router.put(
  "/logout",

  verifyFirebaseToken,
  requireParentAccount,

  async (
    req,
    res
  ) => {
    try {
      if (
        !validateBodyParentId(
          req,
          res
        )
      ) {
        return res
          .status(403)
          .json({
            success: false,

            message:
              "You cannot logout another Parent account",
          });
      }

      const fcmToken =
        typeof req.body
          ?.fcmToken ===
        "string"
          ? req.body.fcmToken.trim()
          : "";

      /*
        Firebase logout itself happens client-side.

        No FCM token means there is nothing
        else to remove from MongoDB.
      */

      if (!fcmToken) {
        return res
          .status(200)
          .json({
            success: true,

            message:
              "Logout successful",
          });
      }

      await Parent.findByIdAndUpdate(
        req.parent._id,

        {
          $pull: {
            fcmTokens:
              fcmToken,
          },
        }
      );

      return res
        .status(200)
        .json({
          success: true,

          message:
            "FCM token removed successfully",
        });
    } catch (error) {
      console.error(
        "LOGOUT ERROR:",
        error
      );

      return res
        .status(500)
        .json({
          success: false,

          message:
            "Logout failed",
        });
    }
  }
);

/* =========================================================
   LINK DRIVER — AUTHENTICATED PARENT ONLY
========================================================= */

router.post(
  "/link-driver",

  verifyFirebaseToken,
  requireParentAccount,

  async (
    req,
    res
  ) => {
    try {
      const {
        driverId,
      } =
        req.body || {};

      /* ===================================================
         VERIFY OPTIONAL BODY PARENT ID
      =================================================== */

      if (
        !validateBodyParentId(
          req,
          res
        )
      ) {
        return res
          .status(403)
          .json({
            success: false,

            message:
              "You cannot link a Driver to another Parent account",
          });
      }

      /* ===================================================
         DRIVER ID
      =================================================== */

      if (!driverId) {
        return res
          .status(400)
          .json({
            success: false,

            message:
              "Driver ID is required",
          });
      }

      const normalizedDriverId =
        String(
          driverId
        )
          .trim()
          .toUpperCase();

      /* ===================================================
         FIND DRIVER
      =================================================== */

      const driver =
        await Driver.findOne({
          driverId:
            normalizedDriverId,
        });

      if (!driver) {
        return res
          .status(404)
          .json({
            success: false,

            message:
              "Invalid Driver ID",
          });
      }

      /* ===================================================
         DRIVER MUST BE APPROVED
      =================================================== */

      if (
        driver.status !==
        "approved"
      ) {
        return res
          .status(400)
          .json({
            success: false,

            message:
              "Driver is not approved",
          });
      }

      const parent =
        req.parent;

      /* ===================================================
         ALREADY LINKED
      =================================================== */

      if (
        parent.driverId ===
        driver.driverId
      ) {
        return res
          .status(200)
          .json({
            success: true,

            message:
              "Driver already linked",

            data:
              getSafeParent(
                parent
              ),
          });
      }

      /* ===================================================
         LINK DRIVER
      =================================================== */

      parent.driverId =
        driver.driverId;

      await parent.save();

      /* ===================================================
         UPDATE CHILDREN
      =================================================== */

      await Child.updateMany(
        {
          parentId:
            parent._id,
        },

        {
          $set: {
            driverId:
              driver.driverId,
          },
        }
      );

      return res
        .status(200)
        .json({
          success: true,

          message:
            "Driver linked successfully",

          data:
            getSafeParent(
              parent
            ),
        });
    } catch (error) {
      console.error(
        "LINK DRIVER ERROR:",
        error
      );

      return res
        .status(500)
        .json({
          success: false,

          message:
            "Failed to link Driver",
        });
    }
  }
);

/* =========================================================
   GET SINGLE PARENT — OWN ACCOUNT ONLY
========================================================= */

router.get(
  "/:id",

  verifyFirebaseToken,
  requireParentAccount,
  requireOwnParent(
    "id"
  ),

  async (
    req,
    res
  ) => {
    try {
      return res
        .status(200)
        .json({
          success: true,

          data:
            getSafeParent(
              req.parent
            ),
        });
    } catch (error) {
      console.error(
        "GET PARENT ERROR:",
        error
      );

      return res
        .status(500)
        .json({
          success: false,

          message:
            "Failed to fetch Parent",
        });
    }
  }
);

/* =========================================================
   UPDATE PARENT — OWN ACCOUNT ONLY
========================================================= */

router.put(
  "/:id",

  verifyFirebaseToken,
  requireParentAccount,
  requireOwnParent(
    "id"
  ),

  async (
    req,
    res
  ) => {
    try {
      /*
        IMPORTANT:

        Use an allow-list rather than copying the
        whole request body.

        Parent is allowed to edit only:

        - name
        - email
        - address
        - latitude + longitude

        Cannot directly modify:

        - firebaseUid
        - phone
        - driverId
        - status
        - fcmTokens
        - referral fields
        - database fields
      */

      const updates = {};

      /* ===================================================
         NAME
      =================================================== */

      if (
        req.body?.name !==
        undefined
      ) {
        const name =
          String(
            req.body.name
          ).trim();

        if (!name) {
          return res
            .status(400)
            .json({
              success: false,

              message:
                "Name cannot be empty",
            });
        }

        updates.name =
          name;
      }

      /* ===================================================
         ADDRESS
      =================================================== */

      if (
        req.body?.address !==
        undefined
      ) {
        const address =
          String(
            req.body.address
          ).trim();

        if (!address) {
          return res
            .status(400)
            .json({
              success: false,

              message:
                "Address cannot be empty",
            });
        }

        updates.address =
          address;
      }

      /* ===================================================
         EMAIL
      =================================================== */

      if (
        req.body?.email !==
        undefined
      ) {
        const email =
          String(
            req.body.email
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
          return res
            .status(400)
            .json({
              success: false,

              message:
                "Enter a valid email address",
            });
        }

        const existingEmail =
          await Parent.findOne({
            email,

            _id: {
              $ne:
                req.parent._id,
            },
          }).select(
            "_id"
          );

        if (
          existingEmail
        ) {
          return res
            .status(409)
            .json({
              success: false,

              message:
                "Email is already registered",
            });
        }

        updates.email =
          email;
      }

      /* ===================================================
         LOCATION
      =================================================== */

      const hasLatitude =
        req.body
          ?.latitude !==
        undefined;

      const hasLongitude =
        req.body
          ?.longitude !==
        undefined;

      if (
        hasLatitude !==
        hasLongitude
      ) {
        return res
          .status(400)
          .json({
            success: false,

            message:
              "Latitude and longitude must be provided together",
          });
      }

      if (
        hasLatitude &&
        hasLongitude
      ) {
        const latitude =
          Number(
            req.body.latitude
          );

        const longitude =
          Number(
            req.body.longitude
          );

        if (
          !Number.isFinite(
            latitude
          ) ||
          !Number.isFinite(
            longitude
          )
        ) {
          return res
            .status(400)
            .json({
              success: false,

              message:
                "Invalid latitude or longitude",
            });
        }

        if (
          latitude < -90 ||
          latitude > 90
        ) {
          return res
            .status(400)
            .json({
              success: false,

              message:
                "Latitude must be between -90 and 90",
            });
        }

        if (
          longitude < -180 ||
          longitude > 180
        ) {
          return res
            .status(400)
            .json({
              success: false,

              message:
                "Longitude must be between -180 and 180",
            });
        }

        updates.homeLocation = {
          type:
            "Point",

          coordinates: [
            longitude,
            latitude,
          ],
        };
      }

      /* ===================================================
         NO EDITABLE FIELDS
      =================================================== */

      if (
        Object.keys(
          updates
        ).length ===
        0
      ) {
        return res
          .status(400)
          .json({
            success: false,

            message:
              "No valid profile fields were provided",
          });
      }

      /* ===================================================
         UPDATE
      =================================================== */

      const updated =
        await Parent.findByIdAndUpdate(
          req.parent._id,

          {
            $set:
              updates,
          },

          {
            new: true,
            runValidators:
              true,
          }
        );

      if (!updated) {
        return res
          .status(404)
          .json({
            success: false,

            message:
              "Parent not found",
          });
      }

      return res
        .status(200)
        .json({
          success: true,

          message:
            "Parent updated successfully",

          data:
            getSafeParent(
              updated
            ),
        });
    } catch (error) {
      console.error(
        "UPDATE PARENT ERROR:",
        error
      );

      if (
        error?.code ===
        11000
      ) {
        return res
          .status(409)
          .json({
            success: false,

            message:
              "Parent information already exists",
          });
      }

      if (
        error?.name ===
        "ValidationError"
      ) {
        return res
          .status(400)
          .json({
            success: false,
            message:
              error.message,
          });
      }

      return res
        .status(500)
        .json({
          success: false,
          message:
            "Update failed",
        });
    }
  }
);

/* =========================================================
   DELETE PARENT — OWN ACCOUNT ONLY
========================================================= */

router.delete(
  "/:id",

  verifyFirebaseToken,
  requireParentAccount,
  requireOwnParent(
    "id"
  ),

  async (
    req,
    res
  ) => {
    try {
      const parentId =
        req.parent._id;

      /* ===================================================
         DELETE RELATED RECORDS
      =================================================== */

      await Promise.all([
        Child.deleteMany({
          parentId,
        }),

        Trip.deleteMany({
          parent:
            parentId,
        }),

        Notification.deleteMany({
          parent:
            parentId,
        }),

        DriverRequest.deleteMany({
          parentId,
        }),
      ]);

      /* ===================================================
         DELETE PARENT DOCUMENT
      =================================================== */

      await Parent.findByIdAndDelete(
        parentId
      );

      return res
        .status(200)
        .json({
          success: true,

          message:
            "Parent and related records deleted successfully",
        });
    } catch (error) {
      console.error(
        "DELETE PARENT ERROR:",
        error
      );

      return res
        .status(500)
        .json({
          success: false,

          message:
            "Delete failed",
        });
    }
  }
);

/* =========================================================
   EXPORT
========================================================= */

export default router;
