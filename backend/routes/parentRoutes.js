import express from "express";

import Parent from "../models/Parent.js";
import Driver from "../models/Driver.js";
import Child from "../models/Child.js";
import DriverRequest from "../models/DriverRequest.js";
import Trip from "../models/Trips.js";
import Notification from "../models/Notification.js";

import verifyParent from "../middleware/verifyParent.js";
import verifyAdmin from "../middleware/verifyAdmin.js";

const router =
  express.Router();

/* =========================================================
   HELPERS
========================================================= */

/* =========================================================
   SAFE PARENT RESPONSE
========================================================= */

const getSafeParent = (
  parent
) => {
  if (!parent) {
    return null;
  }

  const data =
    typeof parent.toObject ===
    "function"
      ? parent.toObject()
      : { ...parent };

  /*
    firebaseUid is still temporarily present
    in the MongoDB schema during migration.

    Never expose it to clients.
  */

  delete data.password;
  delete data.firebaseUid;
  delete data.__v;

  return data;
};

/* =========================================================
   VERIFY PARENT OWNERSHIP
========================================================= */

/*
  verifyParent already authenticates the ASAN Parent JWT
  and attaches:

  req.parent
  req.parentAuth

  This middleware only checks that a route parameter
  belongs to that authenticated Parent.
*/

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
      String(
        requestedParentId
      ) !==
      String(
        authenticatedParentId
      )
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
   OPTIONAL BODY PARENT ID
========================================================= */

/*
  Some existing frontend requests may still send:

  {
    parentId: "..."
  }

  We do not trust that value.

  If supplied, it must match the Parent identity
  established by the verified ASAN Parent JWT.
*/

const validateBodyParentId = (
  req
) => {
  const suppliedParentId =
    req.body?.parentId;

  if (
    !suppliedParentId
  ) {
    return true;
  }

  return (
    String(
      suppliedParentId
    ) ===
    String(
      req.parent?._id
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

          data:
            result,
        });
    } catch (error) {
      console.error(
        "GET PARENTS ERROR:",
        error
      );

      return res
        .status(500)
        .json({
          success:
            false,

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

  verifyParent,

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
         RELATED DATA
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

      const downloadData =
        {
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
            new Date().toISOString(),
        };

      return res
        .status(200)
        .json({
          success:
            true,

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
          success:
            false,

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
            success:
              false,

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
            success:
              false,

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
            success:
              false,

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
            success:
              false,

            message:
              "Parent not found",
          });
      }

      if (
        parent.isActive ===
        false
      ) {
        return res
          .status(403)
          .json({
            success:
              false,

            message:
              "Parent account is inactive",
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
          success:
            true,

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
            success:
              false,

            message:
              "Invalid Parent ID",
          });
      }

      return res
        .status(500)
        .json({
          success:
            false,

          message:
            "Failed to assign Driver",
        });
    }
  }
);

/* =========================================================
   LOGOUT / REMOVE FCM TOKEN
========================================================= */

/*
  Authentication session is JWT-based.

  The JWT itself is removed client-side.

  Backend logout is used to remove the current
  device's FCM token from the Parent account.
*/

router.put(
  "/logout",

  verifyParent,

  async (
    req,
    res
  ) => {
    try {
      /* ===================================================
         OPTIONAL BODY PARENT OWNERSHIP CHECK
      =================================================== */

      if (
        !validateBodyParentId(
          req
        )
      ) {
        return res
          .status(403)
          .json({
            success:
              false,

            message:
              "You cannot logout another Parent account",
          });
      }

      /* ===================================================
         FCM TOKEN
      =================================================== */

      const fcmToken =
        typeof req.body
          ?.fcmToken ===
        "string"
          ? req.body.fcmToken.trim()
          : "";

      /*
        No FCM token means the session may still
        safely be cleared client-side.
      */

      if (!fcmToken) {
        return res
          .status(200)
          .json({
            success:
              true,

            message:
              "Logout successful",
          });
      }

      /* ===================================================
         REMOVE DEVICE TOKEN
      =================================================== */

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
          success:
            true,

          message:
            "Logout successful",
        });
    } catch (error) {
      console.error(
        "LOGOUT ERROR:",
        error
      );

      return res
        .status(500)
        .json({
          success:
            false,

          message:
            "Logout failed",
        });
    }
  }
);

/* =========================================================
   LINK DRIVER — AUTHENTICATED PARENT
========================================================= */

router.post(
  "/link-driver",

  verifyParent,

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
         OPTIONAL BODY PARENT ID
      =================================================== */

      if (
        !validateBodyParentId(
          req
        )
      ) {
        return res
          .status(403)
          .json({
            success:
              false,

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
            success:
              false,

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
            success:
              false,

            message:
              "Invalid Driver ID",
          });
      }

      /* ===================================================
         APPROVED DRIVER ONLY
      =================================================== */

      if (
        driver.status !==
        "approved"
      ) {
        return res
          .status(400)
          .json({
            success:
              false,

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
        String(
          parent.driverId ||
            ""
        ).toUpperCase() ===
        String(
          driver.driverId
        ).toUpperCase()
      ) {
        return res
          .status(200)
          .json({
            success:
              true,

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
          success:
            true,

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
          success:
            false,

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

  verifyParent,

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
          success:
            true,

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
          success:
            false,

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

  verifyParent,

  requireOwnParent(
    "id"
  ),

  async (
    req,
    res
  ) => {
    try {
      /*
        ALLOWED PROFILE FIELDS:

        - name
        - email
        - address
        - latitude + longitude

        NOT DIRECTLY EDITABLE:

        - phone
        - driverId
        - isActive
        - firebaseUid
        - fcmTokens
        - referralCode
        - referredBy

        Phone change will later have its own
        Phone.Email OTP verification flow.
      */

      const updates =
        {};

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
              success:
                false,

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
              success:
                false,

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
              success:
                false,

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
              success:
                false,

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
            success:
              false,

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
              success:
                false,

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
              success:
                false,

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
              success:
                false,

              message:
                "Longitude must be between -180 and 180",
            });
        }

        updates.homeLocation =
          {
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
            success:
              false,

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
            new:
              true,

            runValidators:
              true,
          }
        );

      if (!updated) {
        return res
          .status(404)
          .json({
            success:
              false,

            message:
              "Parent not found",
          });
      }

      return res
        .status(200)
        .json({
          success:
            true,

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
        const duplicateField =
          Object.keys(
            error.keyPattern ||
              {}
          )[0];

        if (
          duplicateField ===
          "email"
        ) {
          return res
            .status(409)
            .json({
              success:
                false,

              message:
                "Email is already registered",
            });
        }

        return res
          .status(409)
          .json({
            success:
              false,

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
            success:
              false,

            message:
              error.message,
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
   DELETE PARENT — OWN ACCOUNT ONLY
========================================================= */

router.delete(
  "/:id",

  verifyParent,

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
         DELETE RELATED DATA
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
         DELETE PARENT
      =================================================== */

      await Parent.findByIdAndDelete(
        parentId
      );

      return res
        .status(200)
        .json({
          success:
            true,

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
          success:
            false,

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
