import mongoose from "mongoose";

import Driver from "../models/Driver.js";
import Students from "../models/Students.js";
import Trips from "../models/Trips.js";
import AdminLog from "../models/AdminLog.js";
import RejectedDriver from "../models/RejectedDriver.js";

import {
  sendDriverRejectionEmail,
} from "../services/emailService.js";

/* =========================================================
   HELPERS
========================================================= */

const isValidObjectId = (id) =>
  mongoose.Types.ObjectId.isValid(
    String(id || "")
  );

/* =========================================================
   FORMAT REJECTED DRIVER

   Converts the small RejectedDriver snapshot into a shape
   that the Admin frontend can understand.
========================================================= */

const formatRejectedDriver = (
  rejection
) => {
  if (!rejection) {
    return null;
  }

  const data =
    typeof rejection.toJSON ===
    "function"
      ? rejection.toJSON()
      : { ...rejection };

  return {
    _id:
      data._id,

    name:
      data.name,

    email:
      data.email,

    phone:
      data.phone || "",

    driverId:
      data.originalDriverId ||
      null,

    originalDriverMongoId:
      data.originalDriverMongoId,

    status:
      "rejected",

    rejectionReason:
      data.rejectionReason,

    rejectedAt:
      data.rejectedAt,

    reviewedBy:
      data.reviewedBy ||
      null,

    emailSent:
      Boolean(
        data.emailSent
      ),

    emailSentAt:
      data.emailSentAt ||
      null,

    acknowledged:
      Boolean(
        data.acknowledged
      ),

    acknowledgedAt:
      data.acknowledgedAt ||
      null,

    active:
      Boolean(
        data.active
      ),

    createdAt:
      data.createdAt,

    updatedAt:
      data.updatedAt,

    isRejectedSnapshot:
      true,
  };
};

/* =========================================================
   SAFE ADMIN LOG
========================================================= */

const createAdminLog = async ({
  req,
  action,
  driver = null,
  message,
  metadata = {},
}) => {
  try {
    if (
      !req?.admin?._id
    ) {
      console.warn(
        "AdminLog skipped: authenticated Admin missing"
      );

      return;
    }

    const logData = {
      adminId:
        req.admin._id,

      action,

      message,

      metadata,
    };

    /*
      The Driver still exists when this function is called
      during rejection, so we can preserve its reference.

      After deletion, populate() may return null later.
      Important Driver information is also stored inside
      metadata.
    */

    if (
      driver?._id
    ) {
      logData.driverId =
        driver._id;
    }

    await AdminLog.create(
      logData
    );
  } catch (
    error
  ) {
    console.warn(
      "AdminLog failed:",
      error?.message
    );
  }
};

/* =========================================================
   DASHBOARD STATS
========================================================= */

export const getDashboardStats =
  async (
    req,
    res
  ) => {
    try {
      const [
        activeDriverCount,
        pendingDrivers,
        approvedDrivers,
        rejectedDrivers,
        totalStudents,
        totalTrips,
      ] =
        await Promise.all([
          Driver.countDocuments(),

          Driver.countDocuments({
            status:
              "pending",
          }),

          Driver.countDocuments({
            status:
              "approved",
          }),

          /*
            Rejected Drivers are no longer stored inside the
            Driver collection.

            Only successfully notified rejections count.
          */

          RejectedDriver.countDocuments({
            emailSent:
              true,
          }),

          Students.countDocuments(),

          Trips.countDocuments(),
        ]);

      /*
        Total means total Driver applications accounted for:

        current Driver records
        +
        successfully rejected applications
      */

      const totalDrivers =
        activeDriverCount +
        rejectedDrivers;

      return res
        .status(200)
        .json({
          success:
            true,

          data: {
            totalDrivers,

            pendingDrivers,

            approvedDrivers,

            rejectedDrivers,

            totalStudents,

            totalTrips,
          },
        });
    } catch (
      error
    ) {
      console.error(
        "Dashboard Stats Error:",
        error
      );

      return res
        .status(500)
        .json({
          success:
            false,

          message:
            "Failed to fetch dashboard statistics",
        });
    }
  };

/* =========================================================
   GET ALL DRIVERS
========================================================= */

export const getDrivers =
  async (
    req,
    res
  ) => {
    try {
      const {
        status,
        search,
      } =
        req.query;

      const normalizedStatus =
        String(
          status || ""
        )
          .trim()
          .toLowerCase();

      const searchTerm =
        String(
          search || ""
        ).trim();

      /* =====================================================
         REJECTED DRIVER LIST

         Rejected Drivers come from RejectedDriver instead of
         Driver because the original Driver record is removed.
      ===================================================== */

      if (
        normalizedStatus ===
        "rejected"
      ) {
        const query = {
          emailSent:
            true,
        };

        if (
          searchTerm
        ) {
          query.$or = [
            {
              name: {
                $regex:
                  searchTerm,

                $options:
                  "i",
              },
            },

            {
              email: {
                $regex:
                  searchTerm,

                $options:
                  "i",
              },
            },

            {
              phone: {
                $regex:
                  searchTerm,

                $options:
                  "i",
              },
            },

            {
              originalDriverId: {
                $regex:
                  searchTerm,

                $options:
                  "i",
              },
            },

            {
              originalDriverMongoId: {
                $regex:
                  searchTerm,

                $options:
                  "i",
              },
            },
          ];
        }

        const rejectedDrivers =
          await RejectedDriver.find(
            query
          )
            .populate(
              "reviewedBy",
              "email role"
            )
            .sort({
              rejectedAt:
                -1,
            });

        const formatted =
          rejectedDrivers.map(
            formatRejectedDriver
          );

        return res
          .status(200)
          .json({
            success:
              true,

            count:
              formatted.length,

            data:
              formatted,
          });
      }

      /* =====================================================
         NORMAL DRIVER LIST
      ===================================================== */

      const query = {};

      if (
        normalizedStatus &&
        [
          "pending",
          "approved",
        ].includes(
          normalizedStatus
        )
      ) {
        query.status =
          normalizedStatus;
      }

      /* =====================================================
         SEARCH
      ===================================================== */

      if (
        searchTerm
      ) {
        query.$or = [
          {
            name: {
              $regex:
                searchTerm,

              $options:
                "i",
            },
          },

          {
            email: {
              $regex:
                searchTerm,

              $options:
                "i",
            },
          },

          {
            phone: {
              $regex:
                searchTerm,

              $options:
                "i",
            },
          },

          {
            driverId: {
              $regex:
                searchTerm,

              $options:
                "i",
            },
          },

          {
            vehicleNumber: {
              $regex:
                searchTerm,

              $options:
                "i",
            },
          },
        ];
      }

      const drivers =
        await Driver.find(
          query
        )
          .populate(
            "reviewedBy",
            "email role"
          )
          .sort({
            createdAt:
              -1,
          });

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
        "Get Drivers Error:",
        error
      );

      return res
        .status(500)
        .json({
          success:
            false,

          message:
            "Failed to fetch drivers",
        });
    }
  };

/* =========================================================
   GET DRIVER BY ID
========================================================= */

export const getDriverById =
  async (
    req,
    res
  ) => {
    try {
      const {
        id,
      } =
        req.params;

      if (
        !isValidObjectId(
          id
        )
      ) {
        return res
          .status(400)
          .json({
            success:
              false,

            message:
              "Invalid Driver ID",
          });
      }

      /* =====================================================
         ACTIVE DRIVER
      ===================================================== */

      const driver =
        await Driver.findById(
          id
        ).populate(
          "reviewedBy",
          "email role"
        );

      if (
        driver
      ) {
        return res
          .status(200)
          .json({
            success:
              true,

            data:
              driver,
          });
      }

      /* =====================================================
         REJECTED SNAPSHOT

         The ID supplied by the rejected list is the
         RejectedDriver MongoDB ID.
      ===================================================== */

      const rejectedDriver =
        await RejectedDriver.findById(
          id
        ).populate(
          "reviewedBy",
          "email role"
        );

      if (
        rejectedDriver
      ) {
        return res
          .status(200)
          .json({
            success:
              true,

            data:
              formatRejectedDriver(
                rejectedDriver
              ),
          });
      }

      return res
        .status(404)
        .json({
          success:
            false,

          message:
            "Driver not found",
        });
    } catch (
      error
    ) {
      console.error(
        "Get Driver Error:",
        error
      );

      return res
        .status(500)
        .json({
          success:
            false,

          message:
            "Failed to fetch driver",
        });
    }
  };

/* =========================================================
   APPROVE DRIVER
========================================================= */

export const approveDriver =
  async (
    req,
    res
  ) => {
    try {
      const {
        id,
      } =
        req.params;

      /* =====================================================
         VALIDATE ID
      ===================================================== */

      if (
        !isValidObjectId(
          id
        )
      ) {
        return res
          .status(400)
          .json({
            success:
              false,

            message:
              "Invalid Driver ID",
          });
      }

      /* =====================================================
         FIND DRIVER
      ===================================================== */

      const driver =
        await Driver.findById(
          id
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

      /* =====================================================
         ALREADY APPROVED
      ===================================================== */

      if (
        driver.status ===
        "approved"
      ) {
        return res
          .status(200)
          .json({
            success:
              true,

            message:
              "Driver is already approved",

            data:
              driver,
          });
      }

      /* =====================================================
         LEGACY REJECTED DRIVER
      ===================================================== */

      if (
        driver.status ===
        "rejected"
      ) {
        return res
          .status(409)
          .json({
            success:
              false,

            message:
              "Rejected Driver application cannot be approved directly",
          });
      }

      /* =====================================================
         EXPECT PENDING
      ===================================================== */

      if (
        driver.status !==
        "pending"
      ) {
        return res
          .status(409)
          .json({
            success:
              false,

            message:
              "Driver is not awaiting approval",
          });
      }

      const previousStatus =
        driver.status;

      const approvedAt =
        new Date();

      /* =====================================================
         APPROVE
      ===================================================== */

      driver.status =
        "approved";

      driver.rejectionReason =
        null;

      driver.approvedAt =
        approvedAt;

      driver.rejectedAt =
        null;

      driver.reviewedBy =
        req.admin._id;

      await driver.save();

      /* =====================================================
         AUDIT LOG
      ===================================================== */

      await createAdminLog({
        req,

        action:
          "DRIVER_APPROVED",

        driver,

        message:
          `Driver ${driver.name} approved`,

        metadata: {
          driverId:
            driver.driverId,

          driverMongoId:
            String(
              driver._id
            ),

          name:
            driver.name,

          email:
            driver.email,

          previousStatus,

          newStatus:
            "approved",

          approvedAt:
            approvedAt.toISOString(),

          reviewedBy:
            String(
              req.admin._id
            ),
        },
      });

      /* =====================================================
         SOCKET EVENTS
      ===================================================== */

      const io =
        req.app.get(
          "io"
        );

      if (
        io
      ) {
        if (
          driver.driverId
        ) {
          io.to(
            String(
              driver.driverId
            )
          ).emit(
            "driver_approved",
            {
              driverId:
                driver.driverId,

              driverMongoId:
                String(
                  driver._id
                ),

              status:
                "approved",

              approvedAt:
                approvedAt.toISOString(),
            }
          );
        }

        io.to(
          "admin"
        ).emit(
          "driver_status_changed",
          {
            driverMongoId:
              String(
                driver._id
              ),

            driverId:
              driver.driverId ||
              null,

            status:
              "approved",

            approvedAt:
              approvedAt.toISOString(),
          }
        );
      }

      return res
        .status(200)
        .json({
          success:
            true,

          message:
            "Driver approved successfully",

          data:
            driver,
        });
    } catch (
      error
    ) {
      console.error(
        "Approve Driver Error:",
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
            error?.message ||
            "Failed to approve driver",
        });
    }
  };

/* =========================================================
   REJECT DRIVER
========================================================= */

export const rejectDriver =
  async (
    req,
    res
  ) => {
    try {
      const {
        id,
      } =
        req.params;

      const {
        reason,
      } =
        req.body || {};

      /* =====================================================
         VALIDATE ID
      ===================================================== */

      if (
        !isValidObjectId(
          id
        )
      ) {
        return res
          .status(400)
          .json({
            success:
              false,

            message:
              "Invalid Driver ID",
          });
      }

      /* =====================================================
         REJECTION REASON
      ===================================================== */

      const rejectionReason =
        String(
          reason || ""
        ).trim();

      if (
        !rejectionReason
      ) {
        return res
          .status(400)
          .json({
            success:
              false,

            message:
              "Rejection reason is required",
          });
      }

      if (
        rejectionReason.length <
        5
      ) {
        return res
          .status(400)
          .json({
            success:
              false,

            message:
              "Please provide a valid rejection reason",
          });
      }

      if (
        rejectionReason.length >
        500
      ) {
        return res
          .status(400)
          .json({
            success:
              false,

            message:
              "Rejection reason must not exceed 500 characters",
          });
      }

      /* =====================================================
         FIND DRIVER
      ===================================================== */

      const driver =
        await Driver.findById(
          id
        );

      /* =====================================================
         DRIVER ALREADY REMOVED?

         This can happen if Admin retries a request after the
         email was sent and the Driver was already deleted.
      ===================================================== */

      if (
        !driver
      ) {
        const existingRejection =
          await RejectedDriver.findOne({
            originalDriverMongoId:
              String(
                id
              ),

            emailSent:
              true,
          })
            .sort({
              rejectedAt:
                -1,
            });

        if (
          existingRejection
        ) {
          return res
            .status(200)
            .json({
              success:
                true,

              message:
                "Driver is already rejected",

              data:
                formatRejectedDriver(
                  existingRejection
                ),
            });
        }

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
         APPROVED DRIVER
      ===================================================== */

      if (
        driver.status ===
        "approved"
      ) {
        return res
          .status(409)
          .json({
            success:
              false,

            message:
              "Approved Driver cannot be rejected through the application review endpoint",
          });
      }

      /* =====================================================
         LEGACY REJECTED DRIVER
      ===================================================== */

      if (
        driver.status ===
        "rejected"
      ) {
        return res
          .status(409)
          .json({
            success:
              false,

            message:
              "This Driver is already marked as rejected",
          });
      }

      /* =====================================================
         EXPECT PENDING
      ===================================================== */

      if (
        driver.status !==
        "pending"
      ) {
        return res
          .status(409)
          .json({
            success:
              false,

            message:
              "Driver is not awaiting review",
          });
      }

      const previousStatus =
        driver.status;

      const rejectedAt =
        new Date();

      const originalDriverMongoId =
        String(
          driver._id
        );

      const originalDriverId =
        driver.driverId ||
        null;

      /* =====================================================
         CREATE / REUSE REJECTION SNAPSHOT

         If an earlier rejection attempt created the snapshot
         but email sending failed, reuse the same record.

         This prevents unnecessary duplicate records.
      ===================================================== */

      let rejectionRecord =
        await RejectedDriver.findOne({
          originalDriverMongoId,

          active:
            true,

          acknowledged:
            false,
        }).sort({
          rejectedAt:
            -1,
        });

      if (
        !rejectionRecord
      ) {
        rejectionRecord =
          await RejectedDriver.create({
            name:
              driver.name,

            email:
              driver.email,

            phone:
              driver.phone ||
              "",

            originalDriverMongoId,

            originalDriverId,

            rejectionReason,

            rejectedAt,

            reviewedBy:
              req.admin._id,

            emailSent:
              false,

            emailSentAt:
              null,

            acknowledged:
              false,

            acknowledgedAt:
              null,

            active:
              true,
          });
      } else if (
        !rejectionRecord
          .emailSent
      ) {
        /*
          An earlier attempt failed before the email was sent.

          Allow the Admin's latest rejection reason to replace
          the previous unsent reason.
        */

        rejectionRecord.name =
          driver.name;

        rejectionRecord.email =
          driver.email;

        rejectionRecord.phone =
          driver.phone ||
          "";

        rejectionRecord.originalDriverId =
          originalDriverId;

        rejectionRecord.rejectionReason =
          rejectionReason;

        rejectionRecord.rejectedAt =
          rejectedAt;

        rejectionRecord.reviewedBy =
          req.admin._id;

        await rejectionRecord.save();
      }

      /* =====================================================
         SEND REJECTION EMAIL

         IMPORTANT:

         The original Driver is NOT deleted if this fails.

         If emailSent is already true because a previous
         attempt succeeded but deletion failed, do not send a
         duplicate email.
      ===================================================== */

      if (
        !rejectionRecord
          .emailSent
      ) {
        try {
          await sendDriverRejectionEmail({
            email:
              driver.email,

            name:
              driver.name,

            rejectionReason:
              rejectionRecord
                .rejectionReason,
          });
        } catch (
          emailError
        ) {
          console.error(
            "Driver rejection email failed:",
            emailError
          );

          return res
            .status(502)
            .json({
              success:
                false,

              message:
                "The rejection email could not be sent. The Driver was not removed. Please try again.",

              error:
                emailError?.message ||
                "Email delivery failed",
            });
        }

        /* ===================================================
           MARK EMAIL AS SENT
        =================================================== */

        rejectionRecord.emailSent =
          true;

        rejectionRecord.emailSentAt =
          new Date();

        await rejectionRecord.save();
      }

      /* =====================================================
         AUDIT LOG

         Create before deleting Driver so the Driver reference
         can still be stored.
      ===================================================== */

      await createAdminLog({
        req,

        action:
          "DRIVER_REJECTED",

        driver,

        message:
          `Driver ${driver.name} rejected: ${rejectionRecord.rejectionReason}`,

        metadata: {
          driverId:
            originalDriverId,

          driverMongoId:
            originalDriverMongoId,

          rejectedDriverRecordId:
            String(
              rejectionRecord._id
            ),

          name:
            driver.name,

          email:
            driver.email,

          phone:
            driver.phone ||
            null,

          previousStatus,

          newStatus:
            "rejected",

          rejectionReason:
            rejectionRecord
              .rejectionReason,

          rejectedAt:
            rejectionRecord
              .rejectedAt
              .toISOString(),

          emailSent:
            true,

          emailSentAt:
            rejectionRecord
              .emailSentAt
              ?.toISOString?.() ||
            null,

          reviewedBy:
            String(
              req.admin._id
            ),
        },
      });

      /* =====================================================
         SOCKET EVENTS

         Send before deleting the Driver document so an
         already-connected Driver can immediately display
         the rejection screen.
      ===================================================== */

      const io =
        req.app.get(
          "io"
        );

      if (
        io
      ) {
        const rejectionPayload = {
          driverId:
            originalDriverId,

          driverMongoId:
            originalDriverMongoId,

          rejectionId:
            String(
              rejectionRecord._id
            ),

          status:
            "rejected",

          code:
            "DRIVER_REJECTED",

          reason:
            rejectionRecord
              .rejectionReason,

          rejectionReason:
            rejectionRecord
              .rejectionReason,

          rejectedAt:
            rejectionRecord
              .rejectedAt
              .toISOString(),
        };

        /*
          Existing backend uses public Driver ID as the
          Driver-specific Socket.IO room.
        */

        if (
          originalDriverId
        ) {
          io.to(
            String(
              originalDriverId
            )
          ).emit(
            "driver_rejected",
            rejectionPayload
          );
        }

        /*
          Also emit to a Mongo ID room in case the Socket
          implementation uses it now or in the future.
        */

        io.to(
          `driver:${originalDriverMongoId}`
        ).emit(
          "driver_rejected",
          rejectionPayload
        );

        io.to(
          "admin"
        ).emit(
          "driver_status_changed",
          rejectionPayload
        );
      }

      /* =====================================================
         REMOVE ORIGINAL DRIVER

         This happens ONLY after:

         1. Rejection snapshot exists
         2. Rejection email succeeded
         3. Email status was stored
         4. Audit log attempt completed
         5. Socket event was emitted
      ===================================================== */

      const deleteResult =
        await Driver.deleteOne({
          _id:
            driver._id,

          status:
            "pending",
        });

      if (
        deleteResult.deletedCount !==
        1
      ) {
        /*
          Email was already sent, so do NOT send it again on
          the next retry.

          The RejectedDriver record remains with emailSent=true
          and the next request can retry deletion safely.
        */

        console.error(
          "Driver rejection email was sent, but Driver deletion did not complete:",
          originalDriverMongoId
        );

        return res
          .status(500)
          .json({
            success:
              false,

            message:
              "The rejection email was sent, but the Driver record could not be removed. Please retry the rejection action.",

            emailSent:
              true,

            driverRemoved:
              false,
          });
      }

      /* =====================================================
         SUCCESS RESPONSE

         Do NOT return the old Driver document containing all
         Driver registration/document information.

         Return only the small rejection snapshot.
      ===================================================== */

      return res
        .status(200)
        .json({
          success:
            true,

          message:
            "Driver rejected successfully. The rejection email was sent and the Driver registration was removed.",

          emailSent:
            true,

          driverRemoved:
            true,

          data:
            formatRejectedDriver(
              rejectionRecord
            ),
        });
    } catch (
      error
    ) {
      console.error(
        "Reject Driver Error:",
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
            error?.message ||
            "Failed to reject driver",
        });
    }
  };

/* =========================================================
   GET ADMIN LOGS
========================================================= */

export const getLogs =
  async (
    req,
    res
  ) => {
    try {
      const logs =
        await AdminLog.find()
          .populate(
            "adminId",
            "email role"
          )
          .populate(
            "driverId",
            "name driverId email status"
          )
          .sort({
            createdAt:
              -1,
          });

      return res
        .status(200)
        .json({
          success:
            true,

          count:
            logs.length,

          data:
            logs,
        });
    } catch (
      error
    ) {
      console.error(
        "Get Admin Logs Error:",
        error
      );

      return res
        .status(500)
        .json({
          success:
            false,

          message:
            "Failed to fetch admin logs",
        });
    }
  };

/* =========================================================
   ANALYTICS
========================================================= */

export const getAnalytics =
  async (
    req,
    res
  ) => {
    try {
      /* =====================================================
         LAST 7 DAYS
      ===================================================== */

      const last7Days =
        new Date();

      last7Days.setHours(
        0,
        0,
        0,
        0
      );

      last7Days.setDate(
        last7Days.getDate() -
          6
      );

      /* =====================================================
         SUMMARY
      ===================================================== */

      const [
        currentDrivers,
        approved,
        pending,
        rejected,
      ] =
        await Promise.all([
          Driver.countDocuments(),

          Driver.countDocuments({
            status:
              "approved",
          }),

          Driver.countDocuments({
            status:
              "pending",
          }),

          RejectedDriver.countDocuments({
            emailSent:
              true,
          }),
        ]);

      const total =
        currentDrivers +
        rejected;

      /* =====================================================
         REGISTRATIONS

         Current Driver registrations are available directly
         in Driver.

         Rejected records intentionally contain only limited
         information, so this chart represents current Driver
         registration records.
      ===================================================== */

      const registrations =
        await Driver.aggregate([
          {
            $match: {
              createdAt: {
                $gte:
                  last7Days,
              },
            },
          },

          {
            $group: {
              _id: {
                $dateToString: {
                  format:
                    "%Y-%m-%d",

                  date:
                    "$createdAt",
                },
              },

              count: {
                $sum:
                  1,
              },
            },
          },

          {
            $sort: {
              _id:
                1,
            },
          },
        ]);

      /* =====================================================
         APPROVALS
      ===================================================== */

      const approvals =
        await Driver.aggregate([
          {
            $match: {
              status:
                "approved",

              approvedAt: {
                $gte:
                  last7Days,
              },
            },
          },

          {
            $group: {
              _id: {
                $dateToString: {
                  format:
                    "%Y-%m-%d",

                  date:
                    "$approvedAt",
                },
              },

              count: {
                $sum:
                  1,
              },
            },
          },

          {
            $sort: {
              _id:
                1,
            },
          },
        ]);

      /* =====================================================
         REJECTIONS

         Rejection history now comes from RejectedDriver.
      ===================================================== */

      const rejections =
        await RejectedDriver.aggregate([
          {
            $match: {
              emailSent:
                true,

              rejectedAt: {
                $gte:
                  last7Days,
              },
            },
          },

          {
            $group: {
              _id: {
                $dateToString: {
                  format:
                    "%Y-%m-%d",

                  date:
                    "$rejectedAt",
                },
              },

              count: {
                $sum:
                  1,
              },
            },
          },

          {
            $sort: {
              _id:
                1,
            },
          },
        ]);

      return res
        .status(200)
        .json({
          success:
            true,

          data: {
            summary: {
              total,

              approved,

              pending,

              rejected,
            },

            registrations,

            approvals,

            rejections,
          },
        });
    } catch (
      error
    ) {
      console.error(
        "Admin Analytics Error:",
        error
      );

      return res
        .status(500)
        .json({
          success:
            false,

          message:
            "Failed to fetch analytics",
        });
    }
  };
