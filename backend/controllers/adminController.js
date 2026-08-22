import mongoose from "mongoose";

import Driver from "../models/Driver.js";
import Students from "../models/Students.js";
import Trips from "../models/Trips.js";
import AdminLog from "../models/AdminLog.js";

/* =========================================================
   HELPERS
========================================================= */

const isValidObjectId = (id) =>
  mongoose.Types.ObjectId.isValid(
    String(id || "")
  );

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
    if (!req?.admin?._id) {
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

    if (driver?._id) {
      logData.driverId =
        driver._id;
    }

    await AdminLog.create(
      logData
    );
  } catch (error) {
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
  async (req, res) => {
    try {
      const [
        totalDrivers,
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

          Driver.countDocuments({
            status:
              "rejected",
          }),

          Students.countDocuments(),

          Trips.countDocuments(),
        ]);

      return res.status(200).json({
        success: true,

        data: {
          totalDrivers,
          pendingDrivers,
          approvedDrivers,
          rejectedDrivers,
          totalStudents,
          totalTrips,
        },
      });
    } catch (error) {
      console.error(
        "Dashboard Stats Error:",
        error
      );

      return res.status(500).json({
        success: false,

        message:
          "Failed to fetch dashboard statistics",
      });
    }
  };

/* =========================================================
   GET ALL DRIVERS
========================================================= */

export const getDrivers =
  async (req, res) => {
    try {
      const {
        status,
        search,
      } = req.query;

      const query = {};

      /* =====================================================
         STATUS FILTER
      ===================================================== */

      if (
        status &&
        [
          "pending",
          "approved",
          "rejected",
        ].includes(
          String(
            status
          ).toLowerCase()
        )
      ) {
        query.status =
          String(
            status
          ).toLowerCase();
      }

      /* =====================================================
         SEARCH
      ===================================================== */

      if (
        search &&
        String(
          search
        ).trim()
      ) {
        const term =
          String(
            search
          ).trim();

        query.$or = [
          {
            name: {
              $regex:
                term,

              $options:
                "i",
            },
          },

          {
            email: {
              $regex:
                term,

              $options:
                "i",
            },
          },

          {
            phone: {
              $regex:
                term,

              $options:
                "i",
            },
          },

          {
            driverId: {
              $regex:
                term,

              $options:
                "i",
            },
          },

          {
            vehicleNumber: {
              $regex:
                term,

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

      return res.status(200).json({
        success: true,

        count:
          drivers.length,

        data:
          drivers,
      });
    } catch (error) {
      console.error(
        "Get Drivers Error:",
        error
      );

      return res.status(500).json({
        success: false,

        message:
          "Failed to fetch drivers",
      });
    }
  };

/* =========================================================
   GET DRIVER BY ID
========================================================= */

export const getDriverById =
  async (req, res) => {
    try {
      const {
        id,
      } = req.params;

      if (
        !isValidObjectId(
          id
        )
      ) {
        return res.status(400).json({
          success: false,

          message:
            "Invalid Driver ID",
        });
      }

      const driver =
        await Driver.findById(
          id
        ).populate(
          "reviewedBy",
          "email role"
        );

      if (
        !driver
      ) {
        return res.status(404).json({
          success: false,

          message:
            "Driver not found",
        });
      }

      return res.status(200).json({
        success: true,

        data:
          driver,
      });
    } catch (error) {
      console.error(
        "Get Driver Error:",
        error
      );

      return res.status(500).json({
        success: false,

        message:
          "Failed to fetch driver",
      });
    }
  };

/* =========================================================
   APPROVE DRIVER
========================================================= */

export const approveDriver =
  async (req, res) => {
    try {
      const {
        id,
      } = req.params;

      /* =====================================================
         VALIDATE ID
      ===================================================== */

      if (
        !isValidObjectId(
          id
        )
      ) {
        return res.status(400).json({
          success: false,

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
        return res.status(404).json({
          success: false,

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
        return res.status(200).json({
          success: true,

          message:
            "Driver is already approved",

          data:
            driver,
        });
      }

      /* =====================================================
         REJECTED DRIVER
      ===================================================== */

      if (
        driver.status ===
        "rejected"
      ) {
        return res.status(409).json({
          success: false,

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
        return res.status(409).json({
          success: false,

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
                driver.status,

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

      return res.status(200).json({
        success: true,

        message:
          "Driver approved successfully",

        data:
          driver,
      });
    } catch (error) {
      console.error(
        "Approve Driver Error:",
        error
      );

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
          error?.message ||
          "Failed to approve driver",
      });
    }
  };

/* =========================================================
   REJECT DRIVER
========================================================= */

export const rejectDriver =
  async (req, res) => {
    try {
      const {
        id,
      } = req.params;

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
        return res.status(400).json({
          success: false,

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
        return res.status(400).json({
          success: false,

          message:
            "Rejection reason is required",
        });
      }

      if (
        rejectionReason.length <
        5
      ) {
        return res.status(400).json({
          success: false,

          message:
            "Please provide a valid rejection reason",
        });
      }

      if (
        rejectionReason.length >
        500
      ) {
        return res.status(400).json({
          success: false,

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

      if (
        !driver
      ) {
        return res.status(404).json({
          success: false,

          message:
            "Driver not found",
        });
      }

      /* =====================================================
         ALREADY REJECTED
      ===================================================== */

      if (
        driver.status ===
        "rejected"
      ) {
        return res.status(200).json({
          success: true,

          message:
            "Driver is already rejected",

          data:
            driver,
        });
      }

      /* =====================================================
         APPROVED DRIVER
      ===================================================== */

      if (
        driver.status ===
        "approved"
      ) {
        return res.status(409).json({
          success: false,

          message:
            "Approved Driver cannot be rejected through the application review endpoint",
        });
      }

      /* =====================================================
         EXPECT PENDING
      ===================================================== */

      if (
        driver.status !==
        "pending"
      ) {
        return res.status(409).json({
          success: false,

          message:
            "Driver is not awaiting review",
        });
      }

      const previousStatus =
        driver.status;

      const rejectedAt =
        new Date();

      /* =====================================================
         REJECT
      ===================================================== */

      driver.status =
        "rejected";

      driver.rejectionReason =
        rejectionReason;

      driver.rejectedAt =
        rejectedAt;

      driver.approvedAt =
        null;

      driver.reviewedBy =
        req.admin._id;

      driver.isOnline =
        false;

      driver.currentStatus =
        "offline";

      await driver.save();

      /* =====================================================
         AUDIT LOG
      ===================================================== */

      await createAdminLog({
        req,

        action:
          "DRIVER_REJECTED",

        driver,

        message:
          `Driver ${driver.name} rejected: ${rejectionReason}`,

        metadata: {
          driverId:
            driver.driverId,

          previousStatus,

          newStatus:
            "rejected",

          rejectionReason,

          rejectedAt:
            rejectedAt.toISOString(),

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
            "driver_rejected",
            {
              driverId:
                driver.driverId,

              driverMongoId:
                String(
                  driver._id
                ),

              status:
                driver.status,

              reason:
                rejectionReason,

              rejectedAt:
                rejectedAt.toISOString(),
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
              "rejected",

            reason:
              rejectionReason,

            rejectedAt:
              rejectedAt.toISOString(),
          }
        );
      }

      return res.status(200).json({
        success: true,

        message:
          "Driver rejected successfully",

        data:
          driver,
      });
    } catch (error) {
      console.error(
        "Reject Driver Error:",
        error
      );

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
          error?.message ||
          "Failed to reject driver",
      });
    }
  };

/* =========================================================
   GET ADMIN LOGS
========================================================= */

export const getLogs =
  async (req, res) => {
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

      return res.status(200).json({
        success: true,

        count:
          logs.length,

        data:
          logs,
      });
    } catch (error) {
      console.error(
        "Get Admin Logs Error:",
        error
      );

      return res.status(500).json({
        success: false,

        message:
          "Failed to fetch admin logs",
      });
    }
  };

/* =========================================================
   ANALYTICS
========================================================= */

export const getAnalytics =
  async (req, res) => {
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
        total,
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

          Driver.countDocuments({
            status:
              "rejected",
          }),
        ]);

      /* =====================================================
         REGISTRATIONS
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
      ===================================================== */

      const rejections =
        await Driver.aggregate([
          {
            $match: {
              status:
                "rejected",

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

      return res.status(200).json({
        success: true,

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
    } catch (error) {
      console.error(
        "Admin Analytics Error:",
        error
      );

      return res.status(500).json({
        success: false,

        message:
          "Failed to fetch analytics",
      });
    }
  };
