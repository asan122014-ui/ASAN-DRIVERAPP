/* =========================================================
   ENVIRONMENT VARIABLES
========================================================= */

/*
  IMPORTANT:
  Must be loaded before modules that depend on process.env,
  especially Firebase Admin and Cloudinary.
*/

import "dotenv/config";

/* =========================================================
   CORE IMPORTS
========================================================= */

import express from "express";
import http from "http";
import cors from "cors";
import { Server } from "socket.io";
import cron from "node-cron";

/* =========================================================
   DATABASE
========================================================= */

import connectDB from "./config/db.js";

/* =========================================================
   MODELS
========================================================= */

import Driver from "./models/Driver.js";

/* =========================================================
   JOBS
========================================================= */

import cleanupVerificationPhotos from "./jobs/cleanupVerificationPhotos.js";

/* =========================================================
   ROUTES
========================================================= */

/*
  Driver authentication:

  Email + Password
*/

import authRoutes from "./routes/authRoutes.js";

/*
  Parent authentication:

  Firebase Phone OTP
*/

import parentAuthRoutes from "./routes/parentAuthRoutes.js";

import parentRoutes from "./routes/parentRoutes.js";
import driverRoutes from "./routes/driver.js";
import tripRoutes from "./routes/trip.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import studentRoutes from "./routes/student.js";
import adminRoutes from "./routes/adminRoutes.js";
import childRoutes from "./routes/child.js";
import billingRoutes from "./routes/billingRoutes.js";
import invoiceRoutes from "./routes/invoiceRoutes.js";
import driverRequestRoutes from "./routes/driverRequest.js";

/* =========================================================
   INITIALIZE EXPRESS
========================================================= */

const app = express();

/* =========================================================
   HTTP SERVER
========================================================= */

const server = http.createServer(app);

/* =========================================================
   EXPRESS CORS
========================================================= */

/*
  DEVELOPMENT:

  CORS remains open temporarily.

  During the final security phase we will restrict this
  to the Parent app, Driver app and Admin dashboard origins.
*/

app.use(
  cors({
    origin: "*",

    methods: [
      "GET",
      "POST",
      "PUT",
      "PATCH",
      "DELETE",
      "OPTIONS",
    ],

    allowedHeaders: [
      "Content-Type",
      "Authorization",
    ],
  })
);

/* =========================================================
   JSON BODY
========================================================= */

app.use(
  express.json({
    limit: "10mb",
  })
);

/* =========================================================
   URL ENCODED BODY
========================================================= */

app.use(
  express.urlencoded({
    extended: true,
    limit: "10mb",
  })
);

/* =========================================================
   STATIC FILES
========================================================= */

app.use(
  "/uploads",
  express.static("uploads")
);

/* =========================================================
   DRIVER AUTH ROUTES
========================================================= */

/*
  Current Driver authentication:

  POST /api/auth/signup
  POST /api/auth/login

  Driver authentication remains Email + Password
  until the separate Driver auth migration.
*/

app.use(
  "/api/auth",
  authRoutes
);

/* =========================================================
   PARENT FIREBASE AUTH
========================================================= */

/*
  POST /api/parent-auth/login
  POST /api/parent-auth/register

  Firebase handles:

  Send OTP
       ↓
  Verify OTP
       ↓
  Firebase ID Token
       ↓
  Backend verification
*/

app.use(
  "/api/parent-auth",
  parentAuthRoutes
);

/* =========================================================
   PARENT ROUTES
========================================================= */

app.use(
  "/api/parent",
  parentRoutes
);

/* =========================================================
   DRIVER ROUTES
========================================================= */

app.use(
  "/api/driver",
  driverRoutes
);

/* =========================================================
   TRIP ROUTES
========================================================= */

app.use(
  "/api/trip",
  tripRoutes
);

/* =========================================================
   NOTIFICATION ROUTES
========================================================= */

app.use(
  "/api/notifications",
  notificationRoutes
);

/* =========================================================
   STUDENT COMPATIBILITY ROUTES
========================================================= */

/*
  routes/student.js uses the Child model.

  models/Students.js is legacy and should not be used.
*/

app.use(
  "/api/students",
  studentRoutes
);

/* =========================================================
   ADMIN ROUTES
========================================================= */

/*
  Admin authentication:

  Email + Password
       ↓
  JWT
       ↓
  verifyAdmin
*/

app.use(
  "/api/admin",
  adminRoutes
);

/* =========================================================
   ADMIN BILLING ROUTES
========================================================= */

app.use(
  "/api/admin/billing",
  billingRoutes
);

/* =========================================================
   INVOICE ROUTES
========================================================= */

app.use(
  "/api/invoices",
  invoiceRoutes
);

/* =========================================================
   CHILD ROUTES
========================================================= */

app.use(
  "/api/children",
  childRoutes
);

/* =========================================================
   DRIVER REQUEST ROUTES
========================================================= */

app.use(
  "/api/driver-request",
  driverRequestRoutes
);

/* =========================================================
   SOCKET.IO
========================================================= */

const io = new Server(
  server,
  {
    cors: {
      origin: "*",

      methods: [
        "GET",
        "POST",
      ],
    },
  }
);

/*
  Controllers and services can access Socket.IO using:

  req.app.get("io")
*/

app.set(
  "io",
  io
);

/* =========================================================
   SOCKET MAPS
========================================================= */

/*
  Parent MongoDB ID
       ↓
  Socket ID
*/

const parentSockets =
  new Map();

/*
  Custom Driver ID
       ↓
  Socket ID
*/

const driverSockets =
  new Map();

/*
  Driver ID
       ↓
  Set of connected Parent IDs
*/

const driverParentsMap =
  new Map();

/* =========================================================
   SOCKET CONNECTION
========================================================= */

io.on(
  "connection",
  (socket) => {
    console.log(
      "✅ Socket connected:",
      socket.id
    );

    /* =====================================================
       JOIN DRIVER ROOM
    ===================================================== */

    socket.on(
      "join_driver_room",
      (data) => {
        /*
          Supported:

          join_driver_room(
            "ASAN-123456"
          )

          OR:

          join_driver_room({
            driverId: "ASAN-123456",
            parentId: "..."
          })
        */

        const rawDriverId =
          typeof data ===
          "string"
            ? data
            : data?.driverId;

        const parentId =
          typeof data ===
          "object"
            ? data?.parentId
            : null;

        if (!rawDriverId) {
          return;
        }

        const driverId =
          String(
            rawDriverId
          )
            .trim()
            .toUpperCase();

        if (!driverId) {
          return;
        }

        /* ===============================================
           JOIN ROOM
        =============================================== */

        socket.join(
          driverId
        );

        console.log(
          "🚗 Joined driver room:",
          driverId,
          parentId
            ? `as parent: ${parentId}`
            : ""
        );

        /* ===============================================
           DRIVER CONNECTION
        =============================================== */

        if (!parentId) {
          driverSockets.set(
            driverId,
            socket.id
          );

          console.log(
            "🚗 Driver socket stored:",
            driverId
          );

          return;
        }

        /* ===============================================
           PARENT CONNECTION
        =============================================== */

        const normalizedParentId =
          String(
            parentId
          );

        parentSockets.set(
          normalizedParentId,
          socket.id
        );

        if (
          !driverParentsMap.has(
            driverId
          )
        ) {
          driverParentsMap.set(
            driverId,
            new Set()
          );
        }

        driverParentsMap
          .get(driverId)
          .add(
            normalizedParentId
          );

        console.log(
          "👨‍👩‍👧 Parent stored:",
          normalizedParentId,
          "Driver:",
          driverId
        );
      }
    );

    /* =====================================================
       JOIN PARENT ROOM
    ===================================================== */

    /*
      Both existing aliases remain supported:

      join_parent_room
      join_parent
    */

    const joinParentRoom = (
      parentData
    ) => {
      if (!parentData) {
        return;
      }

      const parentId =
        typeof parentData ===
        "object"
          ? parentData?.parentId
          : parentData;

      if (!parentId) {
        return;
      }

      const normalizedParentId =
        String(
          parentId
        );

      socket.join(
        normalizedParentId
      );

      parentSockets.set(
        normalizedParentId,
        socket.id
      );

      console.log(
        "👨‍👩‍👧 Joined parent room:",
        normalizedParentId
      );
    };

    socket.on(
      "join_parent_room",
      joinParentRoom
    );

    socket.on(
      "join_parent",
      joinParentRoom
    );

    /* =====================================================
       CAMERA REQUEST FROM PARENT
    ===================================================== */

    socket.on(
      "start_camera",
      ({
        driverId:
          rawDriverId,

        parentId,
      }) => {
        if (
          !rawDriverId ||
          !parentId
        ) {
          return;
        }

        const driverId =
          String(
            rawDriverId
          )
            .trim()
            .toUpperCase();

        const normalizedParentId =
          String(
            parentId
          );

        if (
          !driverId ||
          !normalizedParentId
        ) {
          return;
        }

        console.log(
          "📷 Parent requested camera:",
          normalizedParentId,
          "for Driver:",
          driverId
        );

        /* ===============================================
           STORE PARENT SOCKET
        =============================================== */

        parentSockets.set(
          normalizedParentId,
          socket.id
        );

        /* ===============================================
           STORE DRIVER → PARENT
        =============================================== */

        if (
          !driverParentsMap.has(
            driverId
          )
        ) {
          driverParentsMap.set(
            driverId,
            new Set()
          );
        }

        driverParentsMap
          .get(driverId)
          .add(
            normalizedParentId
          );

        /* ===============================================
           NOTIFY DRIVER
        =============================================== */

        io.to(
          driverId
        ).emit(
          "parent_joined",
          {
            parentId:
              normalizedParentId,
          }
        );

        console.log(
          "👨‍👩‍👧 parent_joined emitted:",
          normalizedParentId
        );
      }
    );

    /* =====================================================
       WEBRTC — DRIVER → OFFER
    ===================================================== */

    socket.on(
      "offer",
      ({
        offer,

        driverId:
          rawDriverId,

        parentId,
      }) => {
        const driverId =
          rawDriverId
            ? String(
                rawDriverId
              )
                .trim()
                .toUpperCase()
            : "";

        const normalizedParentId =
          parentId
            ? String(
                parentId
              )
            : "";

        if (
          !offer ||
          !driverId ||
          !normalizedParentId
        ) {
          return;
        }

        console.log(
          "📤 Offer from Driver:",
          driverId,
          "for Parent:",
          normalizedParentId
        );

        const parentSocketId =
          parentSockets.get(
            normalizedParentId
          );

        if (
          !parentSocketId
        ) {
          console.log(
            "⚠️ Parent socket not found:",
            normalizedParentId
          );

          return;
        }

        io.to(
          parentSocketId
        ).emit(
          "offer",
          {
            offer,

            parentId:
              normalizedParentId,

            driverId,
          }
        );

        console.log(
          "📤 Offer sent to Parent:",
          parentSocketId
        );
      }
    );

    /* =====================================================
       WEBRTC — PARENT → ANSWER
    ===================================================== */

    socket.on(
      "answer",
      ({
        answer,

        driverId:
          rawDriverId,

        parentId,
      }) => {
        const driverId =
          rawDriverId
            ? String(
                rawDriverId
              )
                .trim()
                .toUpperCase()
            : "";

        const normalizedParentId =
          parentId
            ? String(
                parentId
              )
            : "";

        if (
          !answer ||
          !driverId
        ) {
          return;
        }

        console.log(
          "📩 Answer from Parent:",
          normalizedParentId,
          "for Driver:",
          driverId
        );

        const driverSocketId =
          driverSockets.get(
            driverId
          );

        if (
          !driverSocketId
        ) {
          console.log(
            "⚠️ Driver socket not found:",
            driverId
          );

          return;
        }

        io.to(
          driverSocketId
        ).emit(
          "answer",
          {
            answer,

            parentId:
              normalizedParentId,

            driverId,
          }
        );

        console.log(
          "📩 Answer sent to Driver:",
          driverSocketId
        );
      }
    );

    /* =====================================================
       WEBRTC — ICE CANDIDATE
    ===================================================== */

    socket.on(
      "ice-candidate",
      ({
        candidate,

        driverId:
          rawDriverId,

        parentId,

        sender,
      }) => {
        if (!candidate) {
          return;
        }

        const driverId =
          rawDriverId
            ? String(
                rawDriverId
              )
                .trim()
                .toUpperCase()
            : "";

        const normalizedParentId =
          parentId
            ? String(
                parentId
              )
            : "";

        /* ===============================================
           DRIVER → PARENT
        =============================================== */

        if (
          sender ===
          "driver"
        ) {
          if (
            !normalizedParentId
          ) {
            return;
          }

          const parentSocketId =
            parentSockets.get(
              normalizedParentId
            );

          if (
            !parentSocketId
          ) {
            console.log(
              "⚠️ Parent socket not found:",
              normalizedParentId
            );

            return;
          }

          io.to(
            parentSocketId
          ).emit(
            "ice-candidate",
            {
              candidate,

              parentId:
                normalizedParentId,

              driverId,
            }
          );

          return;
        }

        /* ===============================================
           PARENT → DRIVER
        =============================================== */

        if (
          sender ===
          "parent"
        ) {
          if (!driverId) {
            return;
          }

          const driverSocketId =
            driverSockets.get(
              driverId
            );

          if (
            !driverSocketId
          ) {
            console.log(
              "⚠️ Driver socket not found:",
              driverId
            );

            return;
          }

          io.to(
            driverSocketId
          ).emit(
            "ice-candidate",
            {
              candidate,

              parentId:
                normalizedParentId,

              driverId,
            }
          );

          return;
        }

        console.log(
          "⚠️ Unknown ICE sender"
        );
      }
    );

    /* =====================================================
       DRIVER CAMERA READY
    ===================================================== */

    socket.on(
      "driver_camera_ready",
      ({
        driverId:
          rawDriverId,
      }) => {
        if (!rawDriverId) {
          return;
        }

        const driverId =
          String(
            rawDriverId
          )
            .trim()
            .toUpperCase();

        if (!driverId) {
          return;
        }

        console.log(
          "📷 Driver camera ready:",
          driverId
        );

        const parentIds =
          driverParentsMap.get(
            driverId
          ) ||
          new Set();

        const parentIdList =
          Array.from(
            parentIds
          );

        if (
          parentIdList.length ===
          0
        ) {
          console.log(
            "ℹ️ No existing Parents for Driver:",
            driverId
          );

          return;
        }

        io.to(
          driverId
        ).emit(
          "existing_parents",
          {
            parentIds:
              parentIdList,
          }
        );
      }
    );

    /* =====================================================
       PARENT LEFT CAMERA
    ===================================================== */

    socket.on(
      "parent_left",
      ({
        driverId:
          rawDriverId,

        parentId,
      }) => {
        if (!parentId) {
          return;
        }

        const normalizedParentId =
          String(
            parentId
          );

        const driverId =
          rawDriverId
            ? String(
                rawDriverId
              )
                .trim()
                .toUpperCase()
            : "";

        console.log(
          "👋 Parent left:",
          normalizedParentId,
          "Driver:",
          driverId
        );

        /* ===============================================
           REMOVE PARENT SOCKET
        =============================================== */

        parentSockets.delete(
          normalizedParentId
        );

        /* ===============================================
           REMOVE DRIVER → PARENT RELATION
        =============================================== */

        if (
          driverId &&
          driverParentsMap.has(
            driverId
          )
        ) {
          const parentSet =
            driverParentsMap.get(
              driverId
            );

          parentSet.delete(
            normalizedParentId
          );

          if (
            parentSet.size ===
            0
          ) {
            driverParentsMap.delete(
              driverId
            );
          }
        }

        if (!driverId) {
          return;
        }

        /* ===============================================
           NOTIFY DRIVER
        =============================================== */

        const driverSocketId =
          driverSockets.get(
            driverId
          );

        if (
          driverSocketId
        ) {
          io.to(
            driverSocketId
          ).emit(
            "parent_left",
            {
              parentId:
                normalizedParentId,
            }
          );

          return;
        }

        /*
          Fallback to Driver room.
        */

        io.to(
          driverId
        ).emit(
          "parent_left",
          {
            parentId:
              normalizedParentId,
          }
        );
      }
    );

    /* =====================================================
       LIVE DRIVER LOCATION
    ===================================================== */

    /*
      Driver emits:

      socket.emit(
        "send_location",
        {
          driverId,
          lat,
          lng,
          eta,
          speed,
          heading,
          accuracy
        }
      );

      Parent listens to:

      live_location
    */

    socket.on(
      "send_location",
      async (data) => {
        try {
          const {
            driverId:
              rawDriverId,

            lat,
            lng,
            eta,
            speed,
            heading,
            accuracy,
          } =
            data || {};

          /* =============================================
             REQUIRED
          ============================================= */

          if (
            !rawDriverId ||
            lat === undefined ||
            lng === undefined
          ) {
            return;
          }

          /* =============================================
             DRIVER ID
          ============================================= */

          const driverId =
            String(
              rawDriverId
            )
              .trim()
              .toUpperCase();

          if (!driverId) {
            return;
          }

          /* =============================================
             COORDINATES
          ============================================= */

          const latitude =
            Number(
              lat
            );

          const longitude =
            Number(
              lng
            );

          if (
            !Number.isFinite(
              latitude
            ) ||
            !Number.isFinite(
              longitude
            )
          ) {
            console.warn(
              "⚠️ Invalid Driver location received"
            );

            return;
          }

          if (
            latitude <
              -90 ||
            latitude >
              90 ||
            longitude <
              -180 ||
            longitude >
              180
          ) {
            console.warn(
              "⚠️ Driver location outside valid range"
            );

            return;
          }

          /* =============================================
             SPEED
          ============================================= */

          const speedNumber =
            Number(
              speed
            );

          const safeSpeed =
            Number.isFinite(
              speedNumber
            ) &&
            speedNumber >=
              0
              ? speedNumber
              : 0;

          /* =============================================
             HEADING
          ============================================= */

          const headingNumber =
            Number(
              heading
            );

          const safeHeading =
            Number.isFinite(
              headingNumber
            ) &&
            headingNumber >=
              0 &&
            headingNumber <=
              360
              ? headingNumber
              : 0;

          /* =============================================
             GPS ACCURACY
          ============================================= */

          const accuracyNumber =
            Number(
              accuracy
            );

          const safeAccuracy =
            Number.isFinite(
              accuracyNumber
            ) &&
            accuracyNumber >=
              0
              ? accuracyNumber
              : null;

          /* =============================================
             ETA
          ============================================= */

          const safeEta =
            typeof eta ===
              "string" &&
            eta.trim()
              ? eta.trim()
              : "--";

          const updatedAt =
            new Date();

          /* =============================================
             UPDATE DRIVER LOCATION
          ============================================= */

          const driver =
            await Driver.findOneAndUpdate(
              {
                driverId,
              },

              {
                $set: {
                  lastLocation: {
                    lat:
                      latitude,

                    lng:
                      longitude,

                    eta:
                      safeEta,

                    speed:
                      safeSpeed,

                    heading:
                      safeHeading,

                    accuracy:
                      safeAccuracy,

                    updatedAt,
                  },
                },
              },

              {
                new: true,

                runValidators:
                  true,
              }
            );

          /* =============================================
             UNKNOWN DRIVER
          ============================================= */

          if (!driver) {
            console.warn(
              "⚠️ Location received for unknown Driver:",
              driverId
            );

            return;
          }

          /* =============================================
             LOCATION PAYLOAD
          ============================================= */

          const locationPayload = {
            driverId,

            lat:
              latitude,

            lng:
              longitude,

            eta:
              safeEta,

            speed:
              safeSpeed,

            heading:
              safeHeading,

            accuracy:
              safeAccuracy,

            updatedAt:
              updatedAt.toISOString(),
          };

          /* =============================================
             BROADCAST LOCATION
          ============================================= */

          io.to(
            driverId
          ).emit(
            "live_location",
            locationPayload
          );

          /*
            Do NOT log every GPS update.

            Frequent GPS logs would flood Render logs.
          */
        } catch (error) {
          console.error(
            "❌ LIVE LOCATION ERROR:",
            error.message
          );
        }
      }
    );

    /* =====================================================
       LEGACY CAMERA FRAME SUPPORT
    ===================================================== */

    /*
      Keep temporarily for compatibility.

      WebRTC is the preferred implementation.
    */

    socket.on(
      "camera_frame",
      (data) => {
        const {
          driverId:
            rawDriverId,

          frame,
        } =
          data || {};

        if (
          !rawDriverId ||
          !frame
        ) {
          return;
        }

        const driverId =
          String(
            rawDriverId
          )
            .trim()
            .toUpperCase();

        if (!driverId) {
          return;
        }

        io.to(
          driverId
        ).emit(
          "camera_update",
          {
            driverId,
            frame,
          }
        );
      }
    );

    /* =====================================================
       SOCKET DISCONNECT
    ===================================================== */

    socket.on(
      "disconnect",
      () => {
        console.log(
          "❌ Socket disconnected:",
          socket.id
        );

        /* ===============================================
           REMOVE DRIVER SOCKET
        =============================================== */

        for (
          const [
            driverId,
            socketId,
          ] of
          driverSockets.entries()
        ) {
          if (
            socketId ===
            socket.id
          ) {
            driverSockets.delete(
              driverId
            );

            console.log(
              "🧹 Removed Driver from socket map:",
              driverId
            );

            break;
          }
        }

        /* ===============================================
           REMOVE PARENT SOCKET
        =============================================== */

        let foundParentId =
          null;

        let foundDriverId =
          null;

        for (
          const [
            parentId,
            socketId,
          ] of
          parentSockets.entries()
        ) {
          if (
            socketId ===
            socket.id
          ) {
            foundParentId =
              parentId;

            parentSockets.delete(
              parentId
            );

            console.log(
              "🧹 Removed Parent from socket map:",
              parentId
            );

            break;
          }
        }

        /* ===============================================
           FIND DRIVER ASSOCIATED WITH PARENT
        =============================================== */

        if (
          foundParentId
        ) {
          for (
            const [
              driverId,
              parentSet,
            ] of
            driverParentsMap.entries()
          ) {
            if (
              parentSet.has(
                foundParentId
              )
            ) {
              foundDriverId =
                driverId;

              parentSet.delete(
                foundParentId
              );

              if (
                parentSet.size ===
                0
              ) {
                driverParentsMap.delete(
                  driverId
                );
              }

              console.log(
                "🧹 Removed Parent from Driver map:",
                driverId
              );

              break;
            }
          }
        }

        /* ===============================================
           NOTIFY DRIVER
        =============================================== */

        if (
          foundParentId &&
          foundDriverId
        ) {
          const driverSocketId =
            driverSockets.get(
              foundDriverId
            );

          if (
            driverSocketId
          ) {
            io.to(
              driverSocketId
            ).emit(
              "parent_left",
              {
                parentId:
                  foundParentId,
              }
            );

            return;
          }

          /*
            Fallback to Driver room.
          */

          io.to(
            foundDriverId
          ).emit(
            "parent_left",
            {
              parentId:
                foundParentId,
            }
          );
        }
      }
    );
  }
);

/* =========================================================
   HEALTH CHECK
========================================================= */

app.get(
  "/api/health",
  (req, res) => {
    return res
      .status(200)
      .json({
        success: true,

        status:
          "OK",

        time:
          new Date(),
      });
  }
);

/* =========================================================
   GLOBAL ERROR HANDLER
========================================================= */

app.use(
  (
    err,
    req,
    res,
    next
  ) => {
    console.error(
      "❌ SERVER ERROR:",
      err
    );

    const statusCode =
      err.statusCode ||
      err.status ||
      500;

    return res
      .status(
        statusCode
      )
      .json({
        success: false,

        message:
          statusCode ===
          500
            ? "Internal server error"
            : err.message ||
              "Request failed",
      });
  }
);

/* =========================================================
   404 HANDLER
========================================================= */

app.use(
  (req, res) => {
    return res
      .status(404)
      .json({
        success: false,

        message:
          "Route not found",
      });
  }
);

/* =========================================================
   SERVER CONFIGURATION
========================================================= */

const PORT =
  process.env.PORT ||
  5000;

/* =========================================================
   START SERVER
========================================================= */

connectDB()
  .then(() => {
    console.log(
      "✅ Database connected successfully"
    );

    /* =====================================================
       VERIFICATION PHOTO CLEANUP
    ===================================================== */

    /*
      Runs every day:

      2:00 AM
      Asia/Kolkata timezone
    */

    cron.schedule(
      "0 2 * * *",

      async () => {
        console.log(
          "🕑 Running scheduled verification photo cleanup..."
        );

        try {
          await cleanupVerificationPhotos();

          console.log(
            "✅ Verification photo cleanup completed successfully"
          );
        } catch (error) {
          console.error(
            "❌ Verification photo cleanup failed:",
            error.message
          );
        }
      },

      {
        timezone:
          "Asia/Kolkata",
      }
    );

    console.log(
      "⏰ Verification photo cleanup scheduled: Daily at 2:00 AM IST"
    );

    /* =====================================================
       START HTTP + SOCKET SERVER
    ===================================================== */

    server.listen(
      PORT,
      () => {
        console.log(
          `🚀 Server running on port ${PORT}`
        );

        console.log(
          "❤️ Health: /api/health"
        );

        console.log(
          "🔥 Parent Firebase Auth: /api/parent-auth"
        );

        console.log(
          "🚗 Driver Auth: /api/auth"
        );

        console.log(
          "🛡️ Admin: /api/admin"
        );
      }
    );
  })
  .catch(
    (error) => {
      console.error(
        "❌ DATABASE CONNECTION FAILED:",
        error
      );

      process.exit(
        1
      );
    }
  );
