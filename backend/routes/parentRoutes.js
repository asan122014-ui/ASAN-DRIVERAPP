import express from "express";

import Parent from "../models/Parent.js";
import Driver from "../models/Driver.js";
import Child from "../models/Child.js";
import DriverRequest from "../models/DriverRequest.js";
import Trip from "../models/Trips.js";
import Notification from "../models/Notification.js";

const router = express.Router();

/* =========================================================
   GET ALL PARENTS
========================================================= */

/*
  NOTE:

  This endpoint will later be restricted to Admin access.

  For now it is kept unchanged so we do not break
  existing Admin functionality while migrating auth.
*/

router.get("/", async (req, res) => {
  try {
    const parents =
      await Parent.find();

    const result =
      await Promise.all(
        parents.map(
          async (parent) => {
            const children =
              await Child.find({
                parentId:
                  parent._id,
              });

            const driver =
              parent.driverId
                ? await Driver.findOne({
                    driverId:
                      parent.driverId,
                  }).select(
                    "-password"
                  )
                : null;

            return {
              ...parent.toObject(),

              children,

              driver,
            };
          }
        )
      );

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error(
      "GET PARENTS ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to fetch parents",
    });
  }
});

/* =========================================================
   DOWNLOAD PARENT DATA
========================================================= */

router.get(
  "/download-data/:parentId",
  async (req, res) => {
    try {
      const {
        parentId,
      } = req.params;

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
         CHILDREN
      =================================================== */

      const children =
        await Child.find({
          parentId,
        });

      /* ===================================================
         TRIPS
      =================================================== */

      /*
        Your Trip model currently uses:

        parent: parentId
      */

      const trips =
        await Trip.find({
          parent: parentId,
        })
          .populate(
            "child",
            "name grade school"
          )
          .sort({
            createdAt: -1,
          });

      /* ===================================================
         NOTIFICATIONS
      =================================================== */

      const notifications =
        await Notification.find({
          parentId,
        }).sort({
          createdAt: -1,
        });

      /* ===================================================
         DOWNLOAD DATA
      =================================================== */

      const downloadData = {
        parent:
          parent.toObject(),

        children:
          children.map(
            (child) =>
              child.toObject()
          ),

        trips:
          trips.map(
            (trip) =>
              trip.toObject()
          ),

        notifications:
          notifications.map(
            (notification) =>
              notification.toObject()
          ),

        downloadedAt:
          new Date().toISOString(),
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
   ASSIGN DRIVER
========================================================= */

/*
  This endpoint is kept because it may currently be used
  by Admin/internal flows.

  Parent-facing driver linking is handled separately by:

  POST /api/parent/link-driver
*/

router.put(
  "/assign-driver",
  async (req, res) => {
    try {
      const {
        parentId,
        driverId,
      } = req.body;

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
         VERIFY DRIVER
      =================================================== */

      const driver =
        await Driver.findOne({
          driverId:
            String(
              driverId
            )
              .trim()
              .toUpperCase(),
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

      const updated =
        await Parent.findByIdAndUpdate(
          parentId,
          {
            driverId:
              driver.driverId,
          },
          {
            new: true,
            runValidators: true,
          }
        );

      /* ===================================================
         UPDATE CHILDREN
      =================================================== */

      await Child.updateMany(
        {
          parentId,
        },
        {
          driverId:
            driver.driverId,
        }
      );

      return res
        .status(200)
        .json({
          success: true,

          message:
            "Driver assigned successfully",

          data: updated,
        });
    } catch (error) {
      console.error(
        "ASSIGN DRIVER ERROR:",
        error
      );

      return res
        .status(500)
        .json({
          success: false,

          message:
            "Failed to assign driver",
        });
    }
  }
);

/* =========================================================
   LOGOUT / REMOVE FCM TOKEN
========================================================= */

/*
  Firebase authentication itself is handled client-side.

  Backend logout is used here only to remove the device's
  FCM notification token from the Parent account.
*/

router.put(
  "/logout",
  async (req, res) => {
    try {
      const {
        parentId,
        fcmToken,
      } = req.body;

      if (!parentId) {
        return res
          .status(400)
          .json({
            success: false,

            message:
              "Parent ID is required",
          });
      }

      /*
        If there is no FCM token, there is nothing
        to remove.

        Logout itself can still succeed.
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

      const parent =
        await Parent.findByIdAndUpdate(
          parentId,
          {
            $pull: {
              fcmTokens:
                fcmToken,
            },
          },
          {
            new: true,
          }
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
   LINK DRIVER — PARENT APP
========================================================= */

router.post(
  "/link-driver",
  async (req, res) => {
    try {
      const {
        parentId,
        driverId,
      } = req.body;

      /* ===================================================
         VALIDATION
      =================================================== */

      if (
        !parentId ||
        !driverId
      ) {
        return res
          .status(400)
          .json({
            success: false,

            message:
              "Parent ID and Driver ID are required",
          });
      }

      /* ===================================================
         FIND PARENT
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
         NORMALIZE DRIVER ID
      =================================================== */

      const normalizedDriverId =
        String(driverId)
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

            data: parent,
          });
      }

      /* ===================================================
         LINK DRIVER
      =================================================== */

      parent.driverId =
        driver.driverId;

      await parent.save();

      /* ===================================================
         UPDATE ALL CHILDREN
      =================================================== */

      await Child.updateMany(
        {
          parentId:
            parent._id,
        },
        {
          driverId:
            driver.driverId,
        }
      );

      /* ===================================================
         RETURN UPDATED PARENT
      =================================================== */

      const updatedParent =
        await Parent.findById(
          parent._id
        );

      return res
        .status(200)
        .json({
          success: true,

          message:
            "Driver linked successfully",

          data:
            updatedParent,
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
            "Failed to link driver",
        });
    }
  }
);

/* =========================================================
   GET SINGLE PARENT
========================================================= */

router.get(
  "/:id",
  async (req, res) => {
    try {
      const parent =
        await Parent.findById(
          req.params.id
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

      return res
        .status(200)
        .json({
          success: true,
          data: parent,
        });
    } catch (error) {
      console.error(
        "GET PARENT ERROR:",
        error
      );

      /*
        Invalid MongoDB ObjectId
      */

      if (
        error.name ===
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
            "Failed to fetch parent",
        });
    }
  }
);

/* =========================================================
   UPDATE PARENT
========================================================= */

router.put(
  "/:id",
  async (req, res) => {
    try {
      const updates = {
        ...req.body,
      };

      /* ===================================================
         PROTECTED AUTHENTICATION FIELDS
      =================================================== */

      /*
        These values must NEVER be changed through a
        normal Parent profile-update request.

        phone:
        Must eventually be changed only after another
        Firebase phone verification.

        firebaseUid:
        Must only come from Firebase.

        password:
        Password authentication is deprecated.
      */

      delete updates.firebaseUid;
      delete updates.password;
      delete updates.phone;

      /*
        Mongo internal fields must not be writable.
      */

      delete updates._id;
      delete updates.__v;
      delete updates.createdAt;
      delete updates.updatedAt;

      /* ===================================================
         LOCATION UPDATE
      =================================================== */

      const hasLatitude =
        updates.latitude !==
        undefined;

      const hasLongitude =
        updates.longitude !==
        undefined;

      /*
        Require both coordinates together.
      */

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
            updates.latitude
          );

        const longitude =
          Number(
            updates.longitude
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
          type: "Point",

          coordinates: [
            longitude,
            latitude,
          ],
        };

        delete updates.latitude;
        delete updates.longitude;
      }

      /* ===================================================
         NORMALIZE EMAIL
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
          return res
            .status(400)
            .json({
              success: false,

              message:
                "Enter a valid email address",
            });
        }

        /*
          Prevent email duplication.
        */

        const existingEmail =
          await Parent.findOne({
            email,

            _id: {
              $ne:
                req.params.id,
            },
          });

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
         NORMALIZE TEXT
      =================================================== */

      if (
        typeof updates.name ===
        "string"
      ) {
        updates.name =
          updates.name.trim();
      }

      if (
        typeof updates.address ===
        "string"
      ) {
        updates.address =
          updates.address.trim();
      }

      /* ===================================================
         UPDATE
      =================================================== */

      const updated =
        await Parent.findByIdAndUpdate(
          req.params.id,
          updates,
          {
            new: true,
            runValidators: true,
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

          data: updated,
        });
    } catch (error) {
      console.error(
        "UPDATE PARENT ERROR:",
        error
      );

      if (
        error.name ===
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

      if (
        error.code === 11000
      ) {
        return res
          .status(409)
          .json({
            success: false,

            message:
              "Parent information already exists",
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
   DELETE PARENT
========================================================= */

router.delete(
  "/:id",
  async (req, res) => {
    try {
      const parent =
        await Parent.findById(
          req.params.id
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

      const parentId =
        parent._id;

      /* ===================================================
         DELETE CHILDREN
      =================================================== */

      await Child.deleteMany({
        parentId,
      });

      /* ===================================================
         DELETE TRIPS
      =================================================== */

      await Trip.deleteMany({
        parent: parentId,
      });

      /* ===================================================
         DELETE NOTIFICATIONS
      =================================================== */

      await Notification.deleteMany({
        parentId,
      });

      /* ===================================================
         DELETE DRIVER REQUESTS
      =================================================== */

      await DriverRequest.deleteMany({
        parentId,
      });

      /* ===================================================
         DELETE PARENT
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

      if (
        error.name ===
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
            "Delete failed",
        });
    }
  }
);

/* =========================================================
   EXPORT
========================================================= */

export default router;
