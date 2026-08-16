/* =========================================================
   ENVIRONMENT VARIABLES
========================================================= */

/*
  IMPORTANT:
  Load environment variables before modules that depend
  on process.env, especially Firebase Admin.
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

import authRoutes from "./routes/authRoutes.js";
import otpRoutes from "./routes/otp.js";

/*
  NEW:

  Firebase Phone Authentication routes
  for the Parent application.
*/

import parentAuthRoutes from "./routes/parentAuthRoutes.js";

import parentRoutes from "./routes/parentRoutes.js";
import driverRoutes from "./routes/driver.js";
import tripRoutes from "./routes/trip.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import studentRoutes from "./routes/student.js";
import adminRoutes from "./routes/adminRoutes.js";
import locationRoutes from "./routes/locationRoutes.js";
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
   EXPRESS MIDDLEWARE
========================================================= */

/*
  CORS is currently open to all origins.

  This is okay during development.

  Before production deployment we will restrict this
  to your actual Parent App / Admin / Driver origins.
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

/*
  Parse JSON requests.
*/

app.use(
  express.json({
    limit: "10mb",
  })
);

/*
  Parse URL encoded forms.
*/

app.use(
  express.urlencoded({
    extended: true,
    limit: "10mb",
  })
);

/*
  Serve uploaded files.
*/

app.use(
  "/uploads",
  express.static("uploads")
);

/* =========================================================
   API ROUTES
========================================================= */

/*
  OLD / SHARED AUTH ROUTES

  Keep for now because Driver authentication
  and other existing functionality may depend on them.

  We will clean them later.
*/

app.use(
  "/api/auth",
  authRoutes
);

/*
  Existing Driver OTP routes.

  DO NOT remove yet.
*/

app.use(
  "/api/otp",
  otpRoutes
);

/* =========================================================
   NEW PARENT FIREBASE AUTHENTICATION
========================================================= */

/*
  These are the new Parent OTP authentication routes.

  POST /api/parent-auth/login

  POST /api/parent-auth/register

  Firebase itself handles:
  - Send OTP
  - Verify OTP

  These backend endpoints verify the Firebase ID token.
*/

app.use(
  "/api/parent-auth",
  parentAuthRoutes
);

/* =========================================================
   PARENT ROUTES
========================================================= */

/*
  Existing Parent routes stay active.

  Later we will remove only the OLD:

  POST /register
  POST /login
  POST /check-email
  POST /reset-password

  Other Parent operations will remain.
*/

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
   STUDENT ROUTES
========================================================= */

app.use(
  "/api/students",
  studentRoutes
);

/* =========================================================
   LOCATION ROUTES
========================================================= */

app.use(
  "/api/location",
  locationRoutes
);

/* =========================================================
   ADMIN ROUTES
========================================================= */

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
  Allow controllers/services to access Socket.IO using:

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
  Driver ID
       ↓
  Socket ID
*/

const driverSockets =
  new Map();

/*
  Driver ID
       ↓
  Set of Parent IDs
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
          Supports:

          join_driver_room("ASAN-123456")

          OR

          join_driver_room({
            driverId: "ASAN-123456",
            parentId: "..."
          })
        */

        const driverId =
          typeof data === "string"
            ? data
            : data?.driverId;

        const parentId =
          typeof data === "object"
            ? data?.parentId
            : null;

        if (!driverId) {
          return;
        }

        const room =
          String(driverId);

        socket.join(room);

        console.log(
          "🚗 Joined driver room:",
          room,
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
        }

        /* ===============================================
           PARENT CONNECTION
        =============================================== */

        if (parentId) {
          parentSockets.set(
            parentId,
            socket.id
          );

          /*
            Track which Parents are connected
            to this Driver.
          */

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
            .add(parentId);

          console.log(
            "👨‍👩‍👧 Parent stored, waiting for camera request:",
            parentId
          );
        }
      }
    );

    /* =====================================================
       JOIN PARENT ROOM
    ===================================================== */

    /*
      Supporting both event names:

      join_parent_room
      join_parent

      This avoids breaking existing Parent frontend
      screens that may use either event.
    */

    const joinParentRoom = (
      parentId
    ) => {
      if (!parentId) {
        return;
      }

      const id =
        typeof parentId === "object"
          ? parentId?.parentId
          : parentId;

      if (!id) {
        return;
      }

      const room =
        String(id);

      socket.join(room);

      /*
        Save socket mapping as well.
      */

      parentSockets.set(
        String(id),
        socket.id
      );

      console.log(
        "👨‍👩‍👧 Joined parent room:",
        room
      );
    };

    socket.on(
      "join_parent_room",
      joinParentRoom
    );

    /*
      New / currently-used Parent event alias.
    */

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
        driverId,
        parentId,
      }) => {
        if (
          !driverId ||
          !parentId
        ) {
          return;
        }

        const room =
          String(driverId);

        console.log(
          "📷 Parent requested camera:",
          parentId,
          "for driver:",
          driverId
        );

        /* ===============================================
           STORE PARENT SOCKET
        =============================================== */

        parentSockets.set(
          parentId,
          socket.id
        );

        /* ===============================================
           STORE DRIVER → PARENT RELATION
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
          .add(parentId);

        /* ===============================================
           NOTIFY DRIVER
        =============================================== */

        io.to(room).emit(
          "parent_joined",
          {
            parentId,
          }
        );

        console.log(
          "👨‍👩‍👧 Emitted parent_joined to driver for parent:",
          parentId
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
        driverId,
        parentId,
      }) => {
        console.log(
          "📤 Offer from driver:",
          driverId,
          "for parent:",
          parentId
        );

        if (!parentId) {
          console.log(
            "⚠️ No parentId provided in offer, ignoring"
          );

          return;
        }

        const parentSocketId =
          parentSockets.get(
            parentId
          );

        if (!parentSocketId) {
          console.log(
            "⚠️ Parent socket not found for parent:",
            parentId
          );

          return;
        }

        io.to(
          parentSocketId
        ).emit(
          "offer",
          {
            offer,
            parentId,
            driverId,
          }
        );

        console.log(
          "📤 Offer sent to parent socket:",
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
        driverId,
        parentId,
      }) => {
        console.log(
          "📩 Answer from parent:",
          parentId,
          "for driver:",
          driverId
        );

        if (!driverId) {
          return;
        }

        const driverSocketId =
          driverSockets.get(
            driverId
          );

        if (!driverSocketId) {
          console.log(
            "⚠️ Driver socket not found for driver:",
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
            parentId,
            driverId,
          }
        );

        console.log(
          "📩 Answer sent to driver socket:",
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
        driverId,
        parentId,
        sender,
      }) => {
        console.log(
          "📡 ICE candidate from:",
          sender,
          "driver:",
          driverId,
          "parent:",
          parentId
        );

        /* ===============================================
           DRIVER → PARENT
        =============================================== */

        if (
          sender === "driver"
        ) {
          const parentSocketId =
            parentSockets.get(
              parentId
            );

          if (
            !parentSocketId
          ) {
            console.log(
              "⚠️ Parent socket not found for parent:",
              parentId
            );

            return;
          }

          io.to(
            parentSocketId
          ).emit(
            "ice-candidate",
            {
              candidate,
              parentId,
              driverId,
            }
          );

          console.log(
            "📡 ICE candidate sent to parent socket:",
            parentSocketId
          );

          return;
        }

        /* ===============================================
           PARENT → DRIVER
        =============================================== */

        if (
          sender === "parent"
        ) {
          const driverSocketId =
            driverSockets.get(
              driverId
            );

          if (
            !driverSocketId
          ) {
            console.log(
              "⚠️ Driver socket not found for driver:",
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
              parentId,
              driverId,
            }
          );

          console.log(
            "📡 ICE candidate sent to driver socket:",
            driverSocketId
          );

          return;
        }

        console.log(
          "⚠️ Unknown sender in ice-candidate, ignoring"
        );
      }
    );

    /* =====================================================
       DRIVER CAMERA READY
    ===================================================== */

    socket.on(
      "driver_camera_ready",
      ({
        driverId,
      }) => {
        if (!driverId) {
          return;
        }

        console.log(
          "📷 Driver camera ready:",
          driverId
        );

        const room =
          String(driverId);

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
          parentIdList.length >
          0
        ) {
          console.log(
            "👨‍👩‍👧 Sending existing parents to driver:",
            parentIdList
          );

          io.to(room).emit(
            "existing_parents",
            {
              parentIds:
                parentIdList,
            }
          );

          return;
        }

        console.log(
          "ℹ️ No existing parents for driver:",
          driverId
        );
      }
    );

    /* =====================================================
       PARENT LEFT CAMERA
    ===================================================== */

    socket.on(
      "parent_left",
      ({
        driverId,
        parentId,
      }) => {
        if (!parentId) {
          return;
        }

        console.log(
          "👋 Parent left:",
          parentId,
          "from driver:",
          driverId
        );

        /* ===============================================
           REMOVE PARENT SOCKET
        =============================================== */

        parentSockets.delete(
          parentId
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
            parentId
          );

          if (
            parentSet.size === 0
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
              parentId,
            }
          );

          console.log(
            "📤 Emitted parent_left to driver socket:",
            driverSocketId
          );

          return;
        }

        /*
          Fallback:
          broadcast to Driver room.
        */

        io.to(
          String(driverId)
        ).emit(
          "parent_left",
          {
            parentId,
          }
        );
      }
    );

    /* =====================================================
       LIVE DRIVER LOCATION
    ===================================================== */

    socket.on(
      "send_location",
      async (data) => {
        try {
          const {
            driverId,
            lat,
            lng,
            eta,
          } =
            data || {};

          if (
            !driverId ||
            lat === undefined ||
            lng === undefined
          ) {
            return;
          }

          const latitude =
            Number(lat);

          const longitude =
            Number(lng);

          if (
            !Number.isFinite(
              latitude
            ) ||
            !Number.isFinite(
              longitude
            )
          ) {
            console.log(
              "⚠️ Invalid location received:",
              {
                lat,
                lng,
              }
            );

            return;
          }

          const room =
            String(driverId);

          /* =============================================
             STORE LAST LOCATION
          ============================================= */

          await Driver.findOneAndUpdate(
            {
              driverId,
            },
            {
              lastLocation: {
                lat:
                  latitude,

                lng:
                  longitude,

                eta:
                  eta ||
                  "--",

                updatedAt:
                  new Date(),
              },
            }
          );

          /* =============================================
             SEND LOCATION TO CONNECTED PARENTS
          ============================================= */

          io.to(room).emit(
            "live_location",
            {
              lat:
                latitude,

              lng:
                longitude,

              eta:
                eta ||
                "--",
            }
          );

          console.log(
            "📍 Location sent:",
            room
          );
        } catch (error) {
          console.error(
            "❌ Location error:",
            error.message
          );
        }
      }
    );

    /* =====================================================
       OLD CAMERA FRAME SUPPORT
    ===================================================== */

    /*
      Keep temporarily for compatibility.

      WebRTC should eventually replace
      frame-by-frame socket broadcasting.
    */

    socket.on(
      "camera_frame",
      (data) => {
        const {
          driverId,
          frame,
        } =
          data || {};

        if (
          !driverId ||
          !frame
        ) {
          return;
        }

        const room =
          String(driverId);

        io.to(room).emit(
          "camera_update",
          {
            driverId,
            frame,
          }
        );

        console.log(
          "🎥 Frame broadcast:",
          room
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
              "🧹 Removed driver from map:",
              driverId
            );

            break;
          }
        }

        /* ===============================================
           FIND PARENT SOCKET
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
              "🧹 Removed parent from map:",
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
                "🧹 Removed parent from driver map:",
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

            console.log(
              "📤 Emitted parent_left to driver socket:",
              driverSocketId
            );

            return;
          }

          /*
            Fallback.
          */

          io.to(
            String(
              foundDriverId
            )
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
    res.status(200).json({
      success: true,
      status: "OK",
      time: new Date(),
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

    /*
      Avoid sending stack traces
      or internal details to frontend.
    */

    const statusCode =
      err.statusCode ||
      err.status ||
      500;

    return res
      .status(statusCode)
      .json({
        success: false,

        message:
          statusCode === 500
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
   START SERVER AFTER DATABASE CONNECTION
========================================================= */

connectDB()
  .then(() => {
    console.log(
      "✅ Database connected successfully"
    );

    /* =====================================================
       DAILY VERIFICATION PHOTO CLEANUP
    ===================================================== */

    /*
      Runs every day at 2:00 AM
      server-local time.
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
        } catch (
          error
        ) {
          console.error(
            "❌ Verification photo cleanup failed:",
            error.message
          );
        }
      }
    );

    console.log(
      "⏰ Cron job scheduled: Daily at 2:00 AM"
    );

    /* =====================================================
       START HTTP + SOCKET SERVER
    ===================================================== */

    server.listen(
      PORT,
      () => {
        console.log(
          `🚀 Server running on ${PORT}`
        );

        console.log(
          `❤️ Health: /api/health`
        );

        console.log(
          `🔥 Parent Firebase Auth: /api/parent-auth`
        );
      }
    );
  })
  .catch(
    (error) => {
      console.error(
        "❌ DB CONNECTION FAILED:",
        error
      );

      process.exit(1);
    }
  );
