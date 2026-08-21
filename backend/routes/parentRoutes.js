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

  delete data.password;
  delete data.firebaseUid;
  delete data.__v;

  return data;
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
      req.parent?._id
        ?.toString();

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
   BUILD PROFILE UPDATES
========================================================= */

const buildParentUpdates =
  async (
    req,
    res
  ) => {
    const updates =
      {};

    /* =====================================================
       NAME
    ===================================================== */

    if (
      req.body?.name !==
      undefined
    ) {
      const name =
        String(
          req.body.name
        ).trim();

      if (!name) {
        res
          .status(400)
          .json({
            success: false,

            message:
              "Name cannot be empty",
          });

        return null;
      }

      updates.name =
        name;
    }

    /* =====================================================
       ADDRESS
    ===================================================== */

    if (
      req.body?.address !==
      undefined
    ) {
      const address =
        String(
          req.body.address
        ).trim();

      if (!address) {
        res
          .status(400)
          .json({
            success: false,

            message:
              "Address cannot be empty",
          });

        return null;
      }

      updates.address =
        address;
    }

    /* =====================================================
       EMAIL
    ===================================================== */

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
        res
          .status(400)
          .json({
            success: false,

            message:
              "Enter a valid email address",
          });

        return null;
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
        res
          .status(409)
          .json({
            success: false,

            message:
              "Email is already registered",
          });

        return null;
      }

      updates.email =
        email;
    }

    /* =====================================================
       LOCATION
    ===================================================== */

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
      res
        .status(400)
        .json({
          success: false,

          message:
            "Latitude and longitude must be provided together",
        });

      return null;
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
        res
          .status(400)
          .json({
            success: false,

            message:
              "Invalid latitude or longitude",
          });

        return null;
      }

      if (
        latitude < -90 ||
        latitude > 90
      ) {
        res
          .status(400)
          .json({
            success: false,

            message:
              "Latitude must be between -90 and 90",
          });

        return null;
      }

      if (
        longitude < -180 ||
        longitude > 180
      ) {
        res
          .status(400)
          .json({
            success: false,

            message:
              "Longitude must be between -180 and 180",
          });

        return null;
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

    /* =====================================================
       NO VALID FIELDS
    ===================================================== */

    if (
      Object.keys(
        updates
      ).length ===
      0
    ) {
      res
        .status(400)
        .json({
          success: false,

          message:
            "No valid profile fields were provided",
        });

      return null;
    }

    return updates;
  };

/* =========================================================
   DELETE PARENT DATA
========================================================= */

const deleteParentData =
  async (
    parentId
  ) => {
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

    await Parent.findByIdAndDelete(
      parentId
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
    } catch (
      error
    ) {
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
            new Date()
              .toISOString(),
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
    } catch (
      error
    ) {
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

      const normalizedDriverId =
        String(
          driverId
        )
          .trim()
          .toUpperCase();

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

      parent.driverId =
        driver.driverId;

      await parent.save();

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
    } catch (
      error
    ) {
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

router.put(
  "/logout",

  verifyParent,

  async (
    req,
    res
  ) => {
    try {
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

      const fcmToken =
        typeof req.body
          ?.fcmToken ===
        "string"
          ? req.body.fcmToken
              .trim()
          : "";

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
    } catch (
      error
    ) {
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

      parent.driverId =
        driver.driverId;

      await parent.save();

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
    } catch (
      error
    ) {
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
   GET CURRENT PARENT
========================================================= */

/*
IMPORTANT:

/me must stay ABOVE /:id.

Otherwise Express interprets:

/parent/me

as:

/parent/:id
id = "me"

and requireOwnParent rejects it.
*/

router.get(
  "/me",

  verifyParent,

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
    } catch (
      error
    ) {
      console.error(
        "GET CURRENT PARENT ERROR:",
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
   UPDATE CURRENT PARENT
========================================================= */

router.put(
  "/me",

  verifyParent,

  async (
    req,
    res
  ) => {
    try {
      const updates =
        await buildParentUpdates(
          req,
          res
        );

      /*
        buildParentUpdates has already
        sent the response if validation
        failed.
      */

      if (!updates) {
        return;
      }

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
    } catch (
      error
    ) {
      console.error(
        "UPDATE CURRENT PARENT ERROR:",
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
   DELETE CURRENT PARENT
========================================================= */

router.delete(
  "/me",

  verifyParent,

  async (
    req,
    res
  ) => {
    try {
      const parentId =
        req.parent._id;

      await deleteParentData(
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
    } catch (
      error
    ) {
      console.error(
        "DELETE CURRENT PARENT ERROR:",
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
   GET SINGLE PARENT — OWN ACCOUNT ONLY
========================================================= */

/*
IMPORTANT:

All dynamic /:id routes must remain BELOW
specific routes such as:

/me
/logout
/link-driver
/assign-driver
/download-data/:parentId
*/

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
    } catch (
      error
    ) {
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
      const updates =
        await buildParentUpdates(
          req,
          res
        );

      if (!updates) {
        return;
      }

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
    } catch (
      error
    ) {
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

      await deleteParentData(
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
    } catch (
      error
    ) {
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
