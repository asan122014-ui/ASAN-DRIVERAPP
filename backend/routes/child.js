import express from "express";
import axios from "axios";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

import Child from "../models/Child.js";
import Trips from "../models/Trips.js";

import {
  sendNotification,
} from "../utils/sendNotification.js";

import verifyDriver from "../middleware/verifyDriver.js";
import verifyParent from "../middleware/verifyParent.js";
import verifyAdmin from "../middleware/verifyAdmin.js";

const router =
  express.Router();

const ADMIN_ROLES =
  new Set([
    "superadmin",
    "reviewer",
  ]);

/* =========================================================
   SAFE NOTIFICATION
========================================================= */

const safeNotify = async (
  req,
  payload
) => {
  try {
    await sendNotification({
      ...payload,

      io:
        req.app.get("io"),
    });
  } catch (error) {
    console.error(
      "CHILD NOTIFICATION ERROR:",
      error.message
    );
  }
};

/* =========================================================
   HELPERS
========================================================= */

const normalizeDriverId = (
  driverId
) =>
  String(
    driverId || ""
  )
    .trim()
    .toUpperCase();

const isValidObjectId = (
  value
) =>
  mongoose.Types.ObjectId.isValid(
    String(
      value || ""
    )
  );

/* =========================================================
   PARENT PARAM OWNERSHIP
========================================================= */

const requireOwnParentParam = (
  req,
  res,
  next
) => {
  const requestedParentId =
    String(
      req.params?.parentId ||
        ""
    );

  const authenticatedParentId =
    String(
      req.parent?._id ||
        ""
    );

  if (
    !requestedParentId ||
    !authenticatedParentId
  ) {
    return res
      .status(400)
      .json({
        success:
          false,

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
        success:
          false,

        message:
          "You cannot access another Parent's children",
      });
  }

  return next();
};

/* =========================================================
   DRIVER PARAM OWNERSHIP
========================================================= */

const requireOwnDriverParam = (
  req,
  res,
  next
) => {
  if (
    normalizeDriverId(
      req.params.driverId
    ) !==
    normalizeDriverId(
      req.driver?.driverId
    )
  ) {
    return res
      .status(403)
      .json({
        success:
          false,

        message:
          "You cannot access another Driver's children",
      });
  }

  return next();
};

/* =========================================================
   DRIVER CHILD OWNERSHIP
========================================================= */

const requireDriverChild = async (
  req,
  res,
  next
) => {
  try {
    const childId =
      req.body?.childId;

    if (
      !isValidObjectId(
        childId
      )
    ) {
      return res
        .status(400)
        .json({
          success:
            false,

          message:
            "Invalid Child ID",
        });
    }

    const child =
      await Child.findOne({
        _id:
          childId,

        driverId:
          normalizeDriverId(
            req.driver.driverId
          ),
      });

    if (!child) {
      return res
        .status(404)
        .json({
          success:
            false,

          message:
            "Child not found",
        });
    }

    req.authorizedChild =
      child;

    return next();
  } catch (error) {
    console.error(
      "DRIVER CHILD AUTH ERROR:",
      error
    );

    return res
      .status(500)
      .json({
        success:
          false,

        message:
          "Child authorization failed",
      });
  }
};

/* =========================================================
   COORDINATES
========================================================= */

const normalizeCoordinates = (
  value,
  name
) => {
  if (
    value === undefined ||
    value === null
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
    throw new Error(
      `${name} must be a valid number`
    );
  }

  return number;
};

const getCoordinatePair = (
  source,
  label
) => {
  if (!source) {
    return {
      lat:
        null,

      lng:
        null,
    };
  }

  const lat =
    normalizeCoordinates(
      source.lat,
      `${label} latitude`
    );

  const lng =
    normalizeCoordinates(
      source.lng,
      `${label} longitude`
    );

  if (
    (lat === null) !==
    (lng === null)
  ) {
    throw new Error(
      `${label} latitude and longitude must be provided together`
    );
  }

  if (
    lat !== null &&
    (
      lat < -90 ||
      lat > 90
    )
  ) {
    throw new Error(
      `${label} latitude must be between -90 and 90`
    );
  }

  if (
    lng !== null &&
    (
      lng < -180 ||
      lng > 180
    )
  ) {
    throw new Error(
      `${label} longitude must be between -180 and 180`
    );
  }

  return {
    lat,
    lng,
  };
};

/* =========================================================
   ROUTE DETAILS
========================================================= */

const calculateRouteDetails = async (
  pickup,
  drop
) => {
  let routeDistance =
    0;

  let estimatedDuration =
    0;

  if (
    pickup.lat === null ||
    pickup.lng === null ||
    drop.lat === null ||
    drop.lng === null
  ) {
    return {
      routeDistance,
      estimatedDuration,
    };
  }

  if (
    !process.env
      .GOOGLE_MAPS_API_KEY
  ) {
    console.warn(
      "GOOGLE_MAPS_API_KEY missing. Route calculation skipped."
    );

    return {
      routeDistance,
      estimatedDuration,
    };
  }

  try {
    const response =
      await axios.get(
        "https://maps.googleapis.com/maps/api/distancematrix/json",

        {
          params: {
            origins:
              `${pickup.lat},${pickup.lng}`,

            destinations:
              `${drop.lat},${drop.lng}`,

            key:
              process.env
                .GOOGLE_MAPS_API_KEY,
          },

          timeout:
            8000,
        }
      );

    const element =
      response.data
        ?.rows?.[0]
        ?.elements?.[0];

    if (
      element?.status !==
      "OK"
    ) {
      return {
        routeDistance,
        estimatedDuration,
      };
    }

    if (
      element.distance
        ?.value !==
      undefined
    ) {
      routeDistance =
        Number(
          (
            element.distance.value /
            1000
          ).toFixed(
            2
          )
        );
    }

    if (
      element.duration
        ?.value !==
      undefined
    ) {
      estimatedDuration =
        Math.ceil(
          element.duration.value /
          60
        );
    }

    return {
      routeDistance,
      estimatedDuration,
    };
  } catch (error) {
    console.error(
      "GOOGLE DISTANCE API ERROR:",
      error.response?.data ||
        error.message
    );

    return {
      routeDistance,
      estimatedDuration,
    };
  }
};

/* =========================================================
   ADD CHILD
   PARENT ONLY
========================================================= */

router.post(
  "/add",

  verifyParent,

  async (
    req,
    res
  ) => {
    try {
      const {
        name,
        age,
        school,
        grade,
        pickupTime,
        dropoffTime,
        eveningPickup,
        eveningDrop,
        pickupLocation,
        dropoffLocation,
        location,
        dropLocationCoords,
        parentId,
      } =
        req.body || {};

      /* ===================================================
         OPTIONAL LEGACY PARENT ID CHECK
      =================================================== */

      if (
        parentId &&
        String(
          parentId
        ) !==
          String(
            req.parent._id
          )
      ) {
        return res
          .status(403)
          .json({
            success:
              false,

            message:
              "You cannot add a Child to another Parent",
          });
      }

      /* ===================================================
         NAME
      =================================================== */

      if (
        !name ||
        !String(
          name
        ).trim()
      ) {
        return res
          .status(400)
          .json({
            success:
              false,

            message:
              "Child name is required",
          });
      }

      /* ===================================================
         AGE
      =================================================== */

      let normalizedAge =
        null;

      if (
        age !== undefined &&
        age !== null &&
        age !== ""
      ) {
        normalizedAge =
          Number(age);

        if (
          !Number.isInteger(
            normalizedAge
          ) ||
          normalizedAge < 1 ||
          normalizedAge > 25
        ) {
          return res
            .status(400)
            .json({
              success:
                false,

              message:
                "Age must be between 1 and 25",
            });
        }
      }

      /* ===================================================
         COORDINATES
      =================================================== */

      let pickup;
      let drop;

      try {
        pickup =
          getCoordinatePair(
            location,
            "Pickup"
          );

        drop =
          getCoordinatePair(
            dropLocationCoords,
            "Drop"
          );
      } catch (error) {
        return res
          .status(400)
          .json({
            success:
              false,

            message:
              error.message,
          });
      }

      const route =
        await calculateRouteDetails(
          pickup,
          drop
        );

      /*
        Driver ID from client is ignored.

        Child inherits the Driver currently linked
        to authenticated Parent.
      */

      const driverId =
        normalizeDriverId(
          req.parent.driverId
        );

      /* ===================================================
         CREATE CHILD
      =================================================== */

      const child =
        await Child.create({
          name:
            String(
              name
            ).trim(),

          age:
            normalizedAge,

          school:
            String(
              school || ""
            ).trim(),

          grade:
            String(
              grade || ""
            ).trim(),

          pickupTime:
            String(
              pickupTime ||
                ""
            ).trim(),

          dropoffTime:
            String(
              dropoffTime ||
                ""
            ).trim(),

          eveningPickup:
            String(
              eveningPickup ||
                ""
            ).trim(),

          eveningDrop:
            String(
              eveningDrop ||
                ""
            ).trim(),

          pickupLocation:
            String(
              pickupLocation ||
                ""
            ).trim(),

          dropoffLocation:
            String(
              dropoffLocation ||
                ""
            ).trim(),

          location: {
            lat:
              pickup.lat,

            lng:
              pickup.lng,
          },

          dropLocationCoords: {
            lat:
              drop.lat,

            lng:
              drop.lng,
          },

          parentId:
            req.parent._id,

          driverId,

          routeDistance:
            route.routeDistance,

          estimatedDuration:
            route.estimatedDuration,

          status:
            "waiting",
        });

      return res
        .status(201)
        .json({
          success:
            true,

          message:
            "Child added successfully",

          data:
            child,
        });
    } catch (error) {
      console.error(
        "ADD CHILD ERROR:",
        error
      );

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
            "Failed to add child",
        });
    }
  }
);

/* =========================================================
   SINGLE CHILD
   PARENT / ASSIGNED DRIVER / ADMIN
========================================================= */

router.get(
  "/single/:id",

  async (
    req,
    res,
    next
  ) => {
    try {
      if (
        !isValidObjectId(
          req.params.id
        )
      ) {
        return res
          .status(400)
          .json({
            success:
              false,

            message:
              "Invalid Child ID",
          });
      }

      const authHeader =
        req.headers.authorization;

      if (
        !authHeader?.startsWith(
          "Bearer "
        )
      ) {
        return res
          .status(401)
          .json({
            success:
              false,

            message:
              "Authentication required",
          });
      }

      const token =
        authHeader
          .slice(7)
          .trim();

      if (!token) {
        return res
          .status(401)
          .json({
            success:
              false,

            message:
              "Authentication required",
          });
      }

      let hint =
        null;

      try {
        hint =
          jwt.decode(
            token
          );
      } catch {
        hint =
          null;
      }

      /* ===================================================
         ADMIN
      =================================================== */

      if (
        hint &&
        typeof hint ===
          "object" &&
        ADMIN_ROLES.has(
          hint.role
        )
      ) {
        return verifyAdmin(
          req,
          res,
          next
        );
      }

      /* ===================================================
         DRIVER
      =================================================== */

      if (
        hint &&
        typeof hint ===
          "object" &&
        hint.tokenType ===
          "driver"
      ) {
        return verifyDriver(
          req,
          res,

          async () => {
            const child =
              await Child.findOne({
                _id:
                  req.params.id,

                driverId:
                  normalizeDriverId(
                    req.driver
                      .driverId
                  ),
              });

            if (!child) {
              return res
                .status(404)
                .json({
                  success:
                    false,

                  message:
                    "Child not found",
                });
            }

            req.authorizedChild =
              child;

            return next();
          }
        );
      }

      /* ===================================================
         PARENT
      =================================================== */

      if (
        hint &&
        typeof hint ===
          "object" &&
        hint.tokenType ===
          "parent"
      ) {
        return verifyParent(
          req,
          res,

          async () => {
            try {
              const child =
                await Child.findOne({
                  _id:
                    req.params.id,

                  parentId:
                    req.parent
                      ._id,
                });

              if (!child) {
                return res
                  .status(404)
                  .json({
                    success:
                      false,

                    message:
                      "Child not found",
                  });
              }

              req.authorizedChild =
                child;

              return next();
            } catch (error) {
              console.error(
                "PARENT CHILD AUTH ERROR:",
                error
              );

              return res
                .status(500)
                .json({
                  success:
                    false,

                  message:
                    "Child authorization failed",
                });
            }
          }
        );
      }

      return res
        .status(401)
        .json({
          success:
            false,

          message:
            "Unsupported authentication token",
        });
    } catch (error) {
      console.error(
        "CHILD READ AUTH ERROR:",
        error
      );

      return res
        .status(401)
        .json({
          success:
            false,

          message:
            "Authentication failed",
        });
    }
  },

  async (
    req,
    res
  ) => {
    try {
      const child =
        req.authorizedChild ||
        await Child.findById(
          req.params.id
        );

      if (!child) {
        return res
          .status(404)
          .json({
            success:
              false,

            message:
              "Child not found",
          });
      }

      return res
        .status(200)
        .json({
          success:
            true,

          data:
            child,
        });
    } catch (error) {
      console.error(
        "GET SINGLE CHILD ERROR:",
        error
      );

      return res
        .status(500)
        .json({
          success:
            false,

          message:
            "Failed to fetch child",
        });
    }
  }
);

/* =========================================================
   PARENT CHILDREN
========================================================= */

router.get(
  "/parent/:parentId",

  verifyParent,

  requireOwnParentParam,

  async (
    req,
    res
  ) => {
    try {
      const children =
        await Child.find({
          parentId:
            req.parent._id,
        }).sort({
          createdAt:
            1,
        });

      return res
        .status(200)
        .json({
          success:
            true,

          data:
            children,
        });
    } catch (error) {
      console.error(
        "GET PARENT CHILDREN ERROR:",
        error
      );

      return res
        .status(500)
        .json({
          success:
            false,

          message:
            "Failed to fetch children",
        });
    }
  }
);

/* =========================================================
   DRIVER CHILDREN
========================================================= */

router.get(
  "/driver/:driverId",

  verifyDriver,

  requireOwnDriverParam,

  async (
    req,
    res
  ) => {
    try {
      const driverId =
        normalizeDriverId(
          req.driver.driverId
        );

      const [
        children,
        trips,
      ] =
        await Promise.all([
          Child.find({
            driverId,
          }).sort({
            createdAt:
              1,
          }),

          Trips.find({
            driverId,

            status:
              "in_transit",
          }),
        ]);

      const data =
        children.map(
          (
            child
          ) => {
            const trip =
              trips.find(
                (
                  item
                ) =>
                  String(
                    item.child
                  ) ===
                  String(
                    child._id
                  )
              );

            return {
              ...child.toObject(),

              tripId:
                trip?._id ||
                null,
            };
          }
        );

      return res
        .status(200)
        .json({
          success:
            true,

          data,
        });
    } catch (error) {
      console.error(
        "GET DRIVER CHILDREN ERROR:",
        error
      );

      return res
        .status(500)
        .json({
          success:
            false,

          message:
            "Failed to fetch Driver children",
        });
    }
  }
);

/* =========================================================
   UPDATE CHILD
   PARENT ONLY
========================================================= */

router.put(
  "/:id",

  verifyParent,

  async (
    req,
    res
  ) => {
    try {
      if (
        !isValidObjectId(
          req.params.id
        )
      ) {
        return res
          .status(400)
          .json({
            success:
              false,

            message:
              "Invalid Child ID",
          });
      }

      const child =
        await Child.findOne({
          _id:
            req.params.id,

          parentId:
            req.parent._id,
        });

      if (!child) {
        return res
          .status(404)
          .json({
            success:
              false,

            message:
              "Child not found",
          });
      }

      /*
        driverId is intentionally NOT editable.
      */

      const allowedFields =
        [
          "name",
          "age",
          "school",
          "grade",
          "pickupTime",
          "dropoffTime",
          "eveningPickup",
          "eveningDrop",
          "pickupLocation",
          "dropoffLocation",
        ];

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

        if (
          field ===
          "age"
        ) {
          if (
            req.body.age ===
              "" ||
            req.body.age ===
              null
          ) {
            child.age =
              null;

            continue;
          }

          const age =
            Number(
              req.body.age
            );

          if (
            !Number.isInteger(
              age
            ) ||
            age < 1 ||
            age > 25
          ) {
            return res
              .status(400)
              .json({
                success:
                  false,

                message:
                  "Age must be between 1 and 25",
              });
          }

          child.age =
            age;

          continue;
        }

        const value =
          String(
            req.body[
              field
            ] ?? ""
          ).trim();

        if (
          field ===
            "name" &&
          !value
        ) {
          return res
            .status(400)
            .json({
              success:
                false,

              message:
                "Child name cannot be empty",
            });
        }

        child[field] =
          value;
      }

      let pickup = {
        lat:
          child.location?.lat ??
          null,

        lng:
          child.location?.lng ??
          null,
      };

      let drop = {
        lat:
          child
            .dropLocationCoords
            ?.lat ??
          null,

        lng:
          child
            .dropLocationCoords
            ?.lng ??
          null,
      };

      try {
        if (
          req.body?.location !==
          undefined
        ) {
          pickup =
            getCoordinatePair(
              req.body.location,
              "Pickup"
            );

          child.location = {
            lat:
              pickup.lat,

            lng:
              pickup.lng,
          };
        }

        if (
          req.body
            ?.dropLocationCoords !==
          undefined
        ) {
          drop =
            getCoordinatePair(
              req.body
                .dropLocationCoords,
              "Drop"
            );

          child.dropLocationCoords =
            {
              lat:
                drop.lat,

              lng:
                drop.lng,
            };
        }
      } catch (error) {
        return res
          .status(400)
          .json({
            success:
              false,

            message:
              error.message,
          });
      }

      if (
        req.body?.location !==
          undefined ||
        req.body
          ?.dropLocationCoords !==
          undefined
      ) {
        const route =
          await calculateRouteDetails(
            pickup,
            drop
          );

        child.routeDistance =
          route.routeDistance;

        child.estimatedDuration =
          route.estimatedDuration;
      }

      await child.save();

      return res
        .status(200)
        .json({
          success:
            true,

          message:
            "Child updated successfully",

          data:
            child,
        });
    } catch (error) {
      console.error(
        "UPDATE CHILD ERROR:",
        error
      );

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
            "Failed to update child",
        });
    }
  }
);

/* =========================================================
   DELETE CHILD
   PARENT ONLY
========================================================= */

router.delete(
  "/:id",

  verifyParent,

  async (
    req,
    res
  ) => {
    try {
      if (
        !isValidObjectId(
          req.params.id
        )
      ) {
        return res
          .status(400)
          .json({
            success:
              false,

            message:
              "Invalid Child ID",
          });
      }

      const child =
        await Child.findOne({
          _id:
            req.params.id,

          parentId:
            req.parent._id,
        });

      if (!child) {
        return res
          .status(404)
          .json({
            success:
              false,

            message:
              "Child not found",
          });
      }

      await Trips.deleteMany({
        child:
          child._id,
      });

      await Child.deleteOne({
        _id:
          child._id,
      });

      return res
        .status(200)
        .json({
          success:
            true,

          message:
            "Child deleted successfully",
        });
    } catch (error) {
      console.error(
        "DELETE CHILD ERROR:",
        error
      );

      return res
        .status(500)
        .json({
          success:
            false,

          message:
            "Failed to delete child",
        });
    }
  }
);

/* =========================================================
   PICKUP
   DRIVER ONLY
========================================================= */

router.post(
  "/pickup",

  verifyDriver,

  requireDriverChild,

  async (
    req,
    res
  ) => {
    try {
      const child =
        req.authorizedChild;

      if (
        child.status !==
        "waiting"
      ) {
        return res
          .status(409)
          .json({
            success:
              false,

            message:
              "Child is not waiting for pickup",
          });
      }

      child.status =
        "onboard";

      await child.save();

      await safeNotify(
        req,
        {
          driverId:
            child.driverId,

          childId:
            child._id,

          title:
            "Pickup Update",

          message:
            `${child.name} picked up`,

          type:
            "pickup",

          priority:
            "high",
        }
      );

      return res
        .status(200)
        .json({
          success:
            true,

          message:
            "Child picked up successfully",

          data:
            child,
        });
    } catch (error) {
      console.error(
        "PICKUP CHILD ERROR:",
        error
      );

      return res
        .status(500)
        .json({
          success:
            false,

          message:
            "Pickup update failed",
        });
    }
  }
);

/* =========================================================
   DROP
   DRIVER ONLY
========================================================= */

router.post(
  "/drop",

  verifyDriver,

  requireDriverChild,

  async (
    req,
    res
  ) => {
    try {
      const child =
        req.authorizedChild;

      if (
        child.status !==
        "onboard"
      ) {
        return res
          .status(409)
          .json({
            success:
              false,

            message:
              "Child is not onboard",
          });
      }

      child.status =
        "dropped";

      await child.save();

      await safeNotify(
        req,
        {
          driverId:
            child.driverId,

          childId:
            child._id,

          title:
            "Drop Update",

          message:
            `${child.name} dropped`,

          type:
            "drop",

          priority:
            "high",
        }
      );

      return res
        .status(200)
        .json({
          success:
            true,

          message:
            "Child dropped successfully",

          data:
            child,
        });
    } catch (error) {
      console.error(
        "DROP CHILD ERROR:",
        error
      );

      return res
        .status(500)
        .json({
          success:
            false,

          message:
            "Drop update failed",
        });
    }
  }
);

/* =========================================================
   ABSENT
   DRIVER ONLY
========================================================= */

router.post(
  "/absent",

  verifyDriver,

  requireDriverChild,

  async (
    req,
    res
  ) => {
    try {
      const child =
        req.authorizedChild;

      if (
        child.status !==
        "waiting"
      ) {
        return res
          .status(409)
          .json({
            success:
              false,

            message:
              "Only waiting children can be marked absent",
          });
      }

      child.status =
        "absent";

      await child.save();

      await safeNotify(
        req,
        {
          driverId:
            child.driverId,

          childId:
            child._id,

          title:
            "Absent Update",

          message:
            `${child.name} marked absent`,

          type:
            "absent",

          priority:
            "high",
        }
      );

      return res
        .status(200)
        .json({
          success:
            true,

          message:
            "Child marked as absent",

          data:
            child,
        });
    } catch (error) {
      console.error(
        "ABSENT CHILD ERROR:",
        error
      );

      return res
        .status(500)
        .json({
          success:
            false,

          message:
            "Absent update failed",
        });
    }
  }
);

/* =========================================================
   RESET DRIVER CHILD STATUS
========================================================= */

router.post(
  "/reset/:driverId",

  verifyDriver,

  requireOwnDriverParam,

  async (
    req,
    res
  ) => {
    try {
      const result =
        await Child.updateMany(
          {
            driverId:
              normalizeDriverId(
                req.driver
                  .driverId
              ),
          },

          {
            $set: {
              status:
                "waiting",
            },
          }
        );

      return res
        .status(200)
        .json({
          success:
            true,

          message:
            "Child statuses reset successfully",

          modifiedCount:
            result.modifiedCount,
        });
    } catch (error) {
      console.error(
        "RESET CHILD STATUS ERROR:",
        error
      );

      return res
        .status(500)
        .json({
          success:
            false,

          message:
            "Failed to reset child statuses",
        });
    }
  }
);

export default router;
