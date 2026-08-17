/* =========================================================
   ENVIRONMENT VARIABLES
========================================================= */

import "dotenv/config";

/* =========================================================
   CORE IMPORTS
========================================================= */

import express from "express";
import http from "http";
import cors from "cors";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
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
import Parent from "./models/Parent.js";
import Admin from "./models/Admin.js";

/* =========================================================
   FIREBASE
========================================================= */

import {
  parentAuth,
} from "./config/firebaseAdmin.js";

/* =========================================================
   MIDDLEWARE
========================================================= */

import verifyAdmin from "./middleware/verifyAdmin.js";

/* =========================================================
   JOBS
========================================================= */

import cleanupVerificationPhotos from "./jobs/cleanupVerificationPhotos.js";

/* =========================================================
   ROUTES
========================================================= */

import authRoutes from "./routes/authRoutes.js";
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
   CONSTANTS
========================================================= */

const ADMIN_ROLES =
  new Set([
    "superadmin",
    "reviewer",
  ]);

/* =========================================================
   INITIALIZE EXPRESS
========================================================= */

const app =
  express();

/* =========================================================
   HTTP SERVER
========================================================= */

const server =
  http.createServer(
    app
  );

/* =========================================================
   NORMALIZE DRIVER ID
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
   CORS CONFIGURATION
========================================================= */

/*
  Render example:

  ALLOWED_ORIGINS=https://admin.yourdomain.com,https://www.yourdomain.com

  Native Android/iOS requests generally have no browser
  Origin header, so requests without Origin are allowed.

  localhost is automatically allowed outside production.
*/

const ALLOWED_ORIGINS =
  new Set(
    String(
      process.env
        .ALLOWED_ORIGINS ||
        ""
    )
      .split(",")
      .map(
        (origin) =>
          origin.trim()
      )
      .filter(Boolean)
  );

const isDevelopmentOrigin = (
  origin
) => {
  if (
    process.env.NODE_ENV ===
    "production"
  ) {
    return false;
  }

  try {
    const url =
      new URL(origin);

    return (
      url.hostname ===
        "localhost" ||
      url.hostname ===
        "127.0.0.1"
    );
  } catch {
    return false;
  }
};

const corsOriginValidator = (
  origin,
  callback
) => {
  /*
    Native mobile applications, curl,
    Postman and server-to-server requests
    may not include Origin.
  */

  if (!origin) {
    return callback(
      null,
      true
    );
  }

  if (
    ALLOWED_ORIGINS.has(
      origin
    ) ||
    isDevelopmentOrigin(
      origin
    )
  ) {
    return callback(
      null,
      true
    );
  }

  const error =
    new Error(
      "Origin not allowed"
    );

  error.statusCode =
    403;

  return callback(
    error
  );
};

/* =========================================================
   EXPRESS CORS
========================================================= */

app.use(
  cors({
    origin:
      corsOriginValidator,

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

    credentials:
      false,
  })
);

/* =========================================================
   JSON BODY
========================================================= */

app.use(
  express.json({
    limit:
      "10mb",
  })
);

/* =========================================================
   URL ENCODED BODY
========================================================= */

app.use(
  express.urlencoded({
    extended:
      true,

    limit:
      "10mb",
  })
);

/* =========================================================
   LEGACY LOCAL UPLOADS
========================================================= */

/*
  Driver documents and verification photos now use
  Cloudinary.

  Local /uploads should therefore NOT be public
  by default.

  Enable only if some legacy frontend still requires it:

  ENABLE_LOCAL_UPLOADS=true
*/

if (
  process.env
    .ENABLE_LOCAL_UPLOADS ===
  "true"
) {
  app.use(
    "/uploads",
    express.static(
      "uploads"
    )
  );
}

/* =========================================================
   DRIVER AUTH ROUTES
========================================================= */

app.use(
  "/api/auth",
  authRoutes
);

/* =========================================================
   PARENT FIREBASE AUTH
========================================================= */

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

app.use(
  "/api/students",
  studentRoutes
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

/*
  Defense in depth:

  Everything mounted under /api/admin/billing
  requires a valid Admin JWT.
*/

app.use(
  "/api/admin/billing",
  verifyAdmin,
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

const io =
  new Server(
    server,
    {
      cors: {
        origin:
          corsOriginValidator,

        methods: [
          "GET",
          "POST",
        ],
      },
    }
  );

app.set(
  "io",
  io
);

/* =========================================================
   SOCKET CONNECTION TRACKING
========================================================= */

/*
  Parent MongoDB ID
        ↓
  Set<socketId>
*/

const parentConnections =
  new Map();

/*
  Custom Driver ID
        ↓
  Set<socketId>
*/

const driverConnections =
  new Map();

/*
  Driver ID
        ↓
  Set<Parent MongoDB ID>
*/

const driverParentsMap =
  new Map();

/* =========================================================
   CONNECTION MAP HELPERS
========================================================= */

const addConnection = (
  map,
  key,
  socketId
) => {
  if (
    !map.has(key)
  ) {
    map.set(
      key,
      new Set()
    );
  }

  map
    .get(key)
    .add(socketId);
};

const removeConnection = (
  map,
  key,
  socketId
) => {
  const sockets =
    map.get(key);

  if (!sockets) {
    return 0;
  }

  sockets.delete(
    socketId
  );

  if (
    sockets.size ===
    0
  ) {
    map.delete(
      key
    );

    return 0;
  }

  return sockets.size;
};

/* =========================================================
   SOCKET AUTHENTICATION — DRIVER
========================================================= */

const authenticateDriverSocket =
  async (
    token
  ) => {
    if (
      !process.env.JWT_SECRET
    ) {
      throw new Error(
        "JWT_SECRET is not configured"
      );
    }

    const decoded =
      jwt.verify(
        token,
        process.env.JWT_SECRET,
        {
          algorithms: [
            "HS256",
          ],
        }
      );

    if (
      !decoded ||
      typeof decoded !==
        "object" ||
      decoded.tokenType !==
        "driver" ||
      !decoded.id ||
      !decoded.driverId
    ) {
      throw new Error(
        "Invalid Driver token"
      );
    }

    if (
      !mongoose.Types.ObjectId.isValid(
        String(
          decoded.id
        )
      )
    ) {
      throw new Error(
        "Invalid Driver token"
      );
    }

    const driver =
      await Driver.findById(
        decoded.id
      ).select(
        "_id driverId email status"
      );

    if (!driver) {
      throw new Error(
        "Driver account not found"
      );
    }

    if (
      driver.status !==
      "approved"
    ) {
      throw new Error(
        "Driver account is not approved"
      );
    }

    const driverId =
      normalizeDriverId(
        driver.driverId
      );

    if (
      driverId !==
      normalizeDriverId(
        decoded.driverId
      )
    ) {
      throw new Error(
        "Invalid Driver token"
      );
    }

    return {
      role:
        "driver",

      id:
        String(
          driver._id
        ),

      driverId,

      email:
        driver.email,
    };
  };

/* =========================================================
   SOCKET AUTHENTICATION — ADMIN
========================================================= */

const authenticateAdminSocket =
  async (
    token
  ) => {
    if (
      !process.env.JWT_SECRET
    ) {
      throw new Error(
        "JWT_SECRET is not configured"
      );
    }

    const decoded =
      jwt.verify(
        token,
        process.env.JWT_SECRET,
        {
          algorithms: [
            "HS256",
          ],
        }
      );

    if (
      !decoded ||
      typeof decoded !==
        "object" ||
      !decoded.id ||
      !decoded.role ||
      !ADMIN_ROLES.has(
        decoded.role
      )
    ) {
      throw new Error(
        "Invalid Admin token"
      );
    }

    if (
      !mongoose.Types.ObjectId.isValid(
        String(
          decoded.id
        )
      )
    ) {
      throw new Error(
        "Invalid Admin token"
      );
    }

    const admin =
      await Admin.findById(
        decoded.id
      ).select(
        "_id email role"
      );

    if (!admin) {
      throw new Error(
        "Admin account not found"
      );
    }

    if (
      !ADMIN_ROLES.has(
        admin.role
      )
    ) {
      throw new Error(
        "Admin access denied"
      );
    }

    return {
      role:
        "admin",

      id:
        String(
          admin._id
        ),

      email:
        admin.email,

      adminRole:
        admin.role,
    };
  };

/* =========================================================
   SOCKET AUTHENTICATION — PARENT
========================================================= */

const authenticateParentSocket =
  async (
    token
  ) => {
    if (!parentAuth) {
      throw new Error(
        "Parent Firebase Auth is unavailable"
      );
    }

    const decoded =
      await parentAuth.verifyIdToken(
        token,
        true
      );

    if (
      !decoded?.uid
    ) {
      throw new Error(
        "Invalid Parent token"
      );
    }

    /*
      Parent authentication is Phone OTP only.
    */

    if (
      decoded.firebase
        ?.sign_in_provider !==
      "phone"
    ) {
      throw new Error(
        "Invalid Parent authentication provider"
      );
    }

    if (
      !decoded.phone_number
    ) {
      throw new Error(
        "Parent phone number is missing"
      );
    }

    const parent =
      await Parent.findOne({
        firebaseUid:
          decoded.uid,
      }).select(
        "+firebaseUid _id driverId status name"
      );

    if (!parent) {
      throw new Error(
        "Parent account not found"
      );
    }

    if (
      parent.status ===
      "inactive"
    ) {
      throw new Error(
        "Parent account is inactive"
      );
    }

    return {
      role:
        "parent",

      id:
        String(
          parent._id
        ),

      parentId:
        String(
          parent._id
        ),

      firebaseUid:
        decoded.uid,

      linkedDriverId:
        normalizeDriverId(
          parent.driverId
        ),
    };
  };

/* =========================================================
   SOCKET AUTHENTICATION
========================================================= */

/*
  Client sends:

  auth: {
    token: "..."
  }

  No client-supplied role is trusted.

  Token hint is decoded ONLY to determine which
  verification method should process the token.

  Actual authentication still uses:

  Driver/Admin → jwt.verify()
  Parent       → Firebase verifyIdToken()
*/

io.use(
  async (
    socket,
    next
  ) => {
    try {
      const token =
        typeof socket
          .handshake
          ?.auth
          ?.token ===
        "string"
          ? socket.handshake.auth.token.trim()
          : "";

      if (!token) {
        return next(
          new Error(
            "Authentication required"
          )
        );
      }

      let tokenHint =
        null;

      try {
        tokenHint =
          jwt.decode(
            token
          );
      } catch {
        tokenHint =
          null;
      }

      let user =
        null;

      /* ===================================================
         DRIVER TOKEN
      =================================================== */

      if (
        tokenHint &&
        typeof tokenHint ===
          "object" &&
        tokenHint.tokenType ===
          "driver"
      ) {
        user =
          await authenticateDriverSocket(
            token
          );
      }

      /* ===================================================
         ADMIN TOKEN
      =================================================== */

      else if (
        tokenHint &&
        typeof tokenHint ===
          "object" &&
        ADMIN_ROLES.has(
          tokenHint.role
        )
      ) {
        user =
          await authenticateAdminSocket(
            token
          );
      }

      /* ===================================================
         PARENT FIREBASE TOKEN
      =================================================== */

      else {
        user =
          await authenticateParentSocket(
            token
          );
      }

      socket.user =
        user;

      socket.data.user =
        user;

      return next();
    } catch (error) {
      console.warn(
        "Socket authentication rejected:",
        error.message
      );

      return next(
        new Error(
          "Authentication failed"
        )
      );
    }
  }
);

/* =========================================================
   VERIFY CURRENT PARENT ↔ DRIVER LINK
========================================================= */

const verifyParentDriverLink =
  async (
    socket,
    requestedDriverId
  ) => {
    if (
      socket.user?.role !==
      "parent"
    ) {
      return null;
    }

    const parent =
      await Parent.findById(
        socket.user.parentId
      ).select(
        "driverId status"
      );

    if (
      !parent ||
      parent.status ===
        "inactive"
    ) {
      return null;
    }

    const linkedDriverId =
      normalizeDriverId(
        parent.driverId
      );

    const driverId =
      normalizeDriverId(
        requestedDriverId
      );

    if (
      !linkedDriverId ||
      !driverId ||
      linkedDriverId !==
        driverId
    ) {
      return null;
    }

    return linkedDriverId;
  };

/* =========================================================
   SOCKET CONNECTION
========================================================= */

io.on(
  "connection",

  (socket) => {
    const user =
      socket.user;

    console.log(
      "✅ Authenticated socket connected:",
      socket.id,
      user.role
    );

    /* =====================================================
       AUTOMATIC USER ROOM
    ===================================================== */

    if (
      user.role ===
      "parent"
    ) {
      const parentId =
        user.parentId;

      socket.join(
        parentId
      );

      addConnection(
        parentConnections,
        parentId,
        socket.id
      );
    }

    if (
      user.role ===
      "driver"
    ) {
      const driverId =
        user.driverId;

      socket.join(
        driverId
      );

      addConnection(
        driverConnections,
        driverId,
        socket.id
      );
    }

    if (
      user.role ===
      "admin"
    ) {
      socket.join(
        "admin"
      );
    }

    /* =====================================================
       JOIN DRIVER ROOM
    ===================================================== */

    socket.on(
      "join_driver_room",

      async (
        data
      ) => {
        try {
          const rawDriverId =
            typeof data ===
            "string"
              ? data
              : data?.driverId;

          const requestedDriverId =
            normalizeDriverId(
              rawDriverId
            );

          if (
            !requestedDriverId
          ) {
            return;
          }

          /* =================================================
             DRIVER
          ================================================= */

          if (
            user.role ===
            "driver"
          ) {
            if (
              requestedDriverId !==
              user.driverId
            ) {
              return;
            }

            socket.join(
              user.driverId
            );

            return;
          }

          /* =================================================
             PARENT
          ================================================= */

          if (
            user.role ===
            "parent"
          ) {
            const authorizedDriverId =
              await verifyParentDriverLink(
                socket,
                requestedDriverId
              );

            if (
              !authorizedDriverId
            ) {
              return;
            }

            socket.join(
              authorizedDriverId
            );

            if (
              !driverParentsMap.has(
                authorizedDriverId
              )
            ) {
              driverParentsMap.set(
                authorizedDriverId,
                new Set()
              );
            }

            driverParentsMap
              .get(
                authorizedDriverId
              )
              .add(
                user.parentId
              );

            return;
          }
        } catch (error) {
          console.error(
            "JOIN DRIVER ROOM ERROR:",
            error.message
          );
        }
      }
    );

    /* =====================================================
       JOIN PARENT ROOM
    ===================================================== */

    const joinParentRoom = (
      parentData
    ) => {
      if (
        user.role !==
        "parent"
      ) {
        return;
      }

      const requestedParentId =
        typeof parentData ===
        "object"
          ? String(
              parentData
                ?.parentId ||
                ""
            )
          : String(
              parentData ||
              ""
            );

      /*
        Parent is automatically joined to their room
        on connection.

        This event remains only for backwards
        compatibility.
      */

      if (
        requestedParentId &&
        requestedParentId !==
          user.parentId
      ) {
        return;
      }

      socket.join(
        user.parentId
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
       START CAMERA
       PARENT → DRIVER
    ===================================================== */

    socket.on(
      "start_camera",

      async (
        data = {}
      ) => {
        try {
          if (
            user.role !==
            "parent"
          ) {
            return;
          }

          const driverId =
            await verifyParentDriverLink(
              socket,
              data.driverId
            );

          if (!driverId) {
            return;
          }

          socket.join(
            driverId
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
              user.parentId
            );

          io.to(
            driverId
          ).emit(
            "parent_joined",
            {
              parentId:
                user.parentId,
            }
          );
        } catch (error) {
          console.error(
            "START CAMERA ERROR:",
            error.message
          );
        }
      }
    );

    /* =====================================================
       WEBRTC OFFER
       DRIVER → PARENT
    ===================================================== */

    socket.on(
      "offer",

      (
        data = {}
      ) => {
        if (
          user.role !==
          "driver"
        ) {
          return;
        }

        const {
          offer,
        } =
          data;

        const parentId =
          String(
            data.parentId ||
              ""
          );

        if (
          !offer ||
          !parentId
        ) {
          return;
        }

        /*
          Driver may send an offer only to a Parent
          that securely joined this Driver session.
        */

        const parentSet =
          driverParentsMap.get(
            user.driverId
          );

        if (
          !parentSet?.has(
            parentId
          )
        ) {
          return;
        }

        io.to(
          parentId
        ).emit(
          "offer",
          {
            offer,

            parentId,

            driverId:
              user.driverId,
          }
        );
      }
    );

    /* =====================================================
       WEBRTC ANSWER
       PARENT → DRIVER
    ===================================================== */

    socket.on(
      "answer",

      async (
        data = {}
      ) => {
        try {
          if (
            user.role !==
            "parent"
          ) {
            return;
          }

          if (!data.answer) {
            return;
          }

          const driverId =
            await verifyParentDriverLink(
              socket,
              data.driverId
            );

          if (!driverId) {
            return;
          }

          socket
            .to(
              driverId
            )
            .emit(
              "answer",
              {
                answer:
                  data.answer,

                parentId:
                  user.parentId,

                driverId,
              }
            );
        } catch (error) {
          console.error(
            "WEBRTC ANSWER ERROR:",
            error.message
          );
        }
      }
    );

    /* =====================================================
       ICE CANDIDATE
    ===================================================== */

    socket.on(
      "ice-candidate",

      async (
        data = {}
      ) => {
        try {
          if (
            !data.candidate
          ) {
            return;
          }

          /* =================================================
             DRIVER → PARENT
          ================================================= */

          if (
            user.role ===
            "driver"
          ) {
            const parentId =
              String(
                data.parentId ||
                  ""
              );

            if (!parentId) {
              return;
            }

            const parentSet =
              driverParentsMap.get(
                user.driverId
              );

            if (
              !parentSet?.has(
                parentId
              )
            ) {
              return;
            }

            io.to(
              parentId
            ).emit(
              "ice-candidate",
              {
                candidate:
                  data.candidate,

                parentId,

                driverId:
                  user.driverId,
              }
            );

            return;
          }

          /* =================================================
             PARENT → DRIVER
          ================================================= */

          if (
            user.role ===
            "parent"
          ) {
            const driverId =
              await verifyParentDriverLink(
                socket,
                data.driverId
              );

            if (!driverId) {
              return;
            }

            socket
              .to(
                driverId
              )
              .emit(
                "ice-candidate",
                {
                  candidate:
                    data.candidate,

                  parentId:
                    user.parentId,

                  driverId,
                }
              );
          }
        } catch (error) {
          console.error(
            "ICE CANDIDATE ERROR:",
            error.message
          );
        }
      }
    );

    /* =====================================================
       DRIVER CAMERA READY
    ===================================================== */

    socket.on(
      "driver_camera_ready",

      () => {
        if (
          user.role !==
          "driver"
        ) {
          return;
        }

        const parentIds =
          Array.from(
            driverParentsMap.get(
              user.driverId
            ) ||
              []
          );

        socket.emit(
          "existing_parents",
          {
            parentIds,
          }
        );
      }
    );

    /* =====================================================
       PARENT LEFT CAMERA
    ===================================================== */

    socket.on(
      "parent_left",

      (
        data = {}
      ) => {
        if (
          user.role !==
          "parent"
        ) {
          return;
        }

        const driverId =
          normalizeDriverId(
            data.driverId
          );

        if (!driverId) {
          return;
        }

        const parentSet =
          driverParentsMap.get(
            driverId
          );

        if (
          !parentSet?.has(
            user.parentId
          )
        ) {
          return;
        }

        parentSet.delete(
          user.parentId
        );

        if (
          parentSet.size ===
          0
        ) {
          driverParentsMap.delete(
            driverId
          );
        }

        socket.leave(
          driverId
        );

        io.to(
          driverId
        ).emit(
          "parent_left",
          {
            parentId:
              user.parentId,
          }
        );
      }
    );

    /* =====================================================
       LIVE DRIVER LOCATION
    ===================================================== */

    socket.on(
      "send_location",

      async (
        data = {}
      ) => {
        try {
          /*
            SECURITY:

            driverId is derived from the authenticated
            Driver JWT.

            Any driverId supplied in data is ignored.
          */

          if (
            user.role !==
            "driver"
          ) {
            return;
          }

          const {
            lat,
            lng,
            eta,
            speed,
            heading,
            accuracy,
          } =
            data;

          if (
            lat ===
              undefined ||
            lng ===
              undefined
          ) {
            return;
          }

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
            return;
          }

          if (
            latitude < -90 ||
            latitude > 90 ||
            longitude <
              -180 ||
            longitude >
              180
          ) {
            return;
          }

          /* =================================================
             SPEED
          ================================================= */

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

          /* =================================================
             HEADING
          ================================================= */

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

          /* =================================================
             ACCURACY
          ================================================= */

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

          /* =================================================
             ETA
          ================================================= */

          const safeEta =
            typeof eta ===
              "string" &&
            eta.trim()
              ? eta
                  .trim()
                  .slice(
                    0,
                    100
                  )
              : "--";

          const updatedAt =
            new Date();

          /* =================================================
             DATABASE
          ================================================= */

          const driver =
            await Driver.findOneAndUpdate(
              {
                driverId:
                  user.driverId,

                status:
                  "approved",
              },

              {
                $set: {
                  /*
                    Current GeoJSON position.
                  */

                  location: {
                    type:
                      "Point",

                    coordinates: [
                      longitude,
                      latitude,
                    ],
                  },

                  /*
                    Detailed latest position.
                  */

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
                new:
                  true,

                runValidators:
                  true,
              }
            );

          if (!driver) {
            return;
          }

          const locationPayload = {
            driverId:
              user.driverId,

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

          /*
            socket.to() excludes the Driver that
            originally sent the GPS update.
          */

          socket
            .to(
              user.driverId
            )
            .emit(
              "live_location",
              locationPayload
            );
        } catch (error) {
          console.error(
            "LIVE LOCATION ERROR:",
            error.message
          );
        }
      }
    );

    /* =====================================================
       LEGACY CAMERA FRAME
    ===================================================== */

    socket.on(
      "camera_frame",

      (
        data = {}
      ) => {
        if (
          user.role !==
          "driver"
        ) {
          return;
        }

        if (!data.frame) {
          return;
        }

        socket
          .to(
            user.driverId
          )
          .emit(
            "camera_update",
            {
              driverId:
                user.driverId,

              frame:
                data.frame,
            }
          );
      }
    );

    /* =====================================================
       DISCONNECT
    ===================================================== */

    socket.on(
      "disconnect",

      () => {
        console.log(
          "❌ Socket disconnected:",
          socket.id,
          user.role
        );

        /* =================================================
           DRIVER
        ================================================= */

        if (
          user.role ===
          "driver"
        ) {
          removeConnection(
            driverConnections,
            user.driverId,
            socket.id
          );

          return;
        }

        /* =================================================
           PARENT
        ================================================= */

        if (
          user.role ===
          "parent"
        ) {
          const remainingConnections =
            removeConnection(
              parentConnections,
              user.parentId,
              socket.id
            );

          /*
            Another device/socket for this same Parent
            is still connected.

            Do not remove the Parent from Driver maps yet.
          */

          if (
            remainingConnections >
            0
          ) {
            return;
          }

          for (
            const [
              driverId,
              parentSet,
            ] of
            driverParentsMap.entries()
          ) {
            if (
              !parentSet.has(
                user.parentId
              )
            ) {
              continue;
            }

            parentSet.delete(
              user.parentId
            );

            if (
              parentSet.size ===
              0
            ) {
              driverParentsMap.delete(
                driverId
              );
            }

            io.to(
              driverId
            ).emit(
              "parent_left",
              {
                parentId:
                  user.parentId,
              }
            );
          }
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

  (
    req,
    res
  ) => {
    return res.status(200).json({
      success:
        true,

      status:
        "OK",

      time:
        new Date(),
    });
  }
);

/* =========================================================
   404
========================================================= */

app.use(
  (
    req,
    res
  ) => {
    return res.status(404).json({
      success:
        false,

      message:
        "Route not found",
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
      "SERVER ERROR:",
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
        success:
          false,

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

    cron.schedule(
      "0 2 * * *",

      async () => {
        try {
          await cleanupVerificationPhotos();

          console.log(
            "✅ Verification photo cleanup completed"
          );
        } catch (error) {
          console.error(
            "Verification photo cleanup failed:",
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
      "⏰ Verification photo cleanup: Daily 2:00 AM IST"
    );

    /* =====================================================
       START SERVER
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
        "DATABASE CONNECTION FAILED:",
        error
      );

      process.exit(
        1
      );
    }
  );
