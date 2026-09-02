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
import driverAuthRoutes from "./routes/driverAuthRoutes.js";
import parentAuthRoutes from "./routes/parentAuthRoutes.js";
import adminAuthRoutes from "./routes/adminAuthRoutes.js";

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
import enquiryRoutes from "./routes/enquiryRoutes.js";

/* =========================================================
   CONSTANTS
========================================================= */

const ADMIN_ROLES = new Set([
  "superadmin",
  "reviewer",
]);

/* =========================================================
   EXPRESS APP
========================================================= */

const app = express();

/* =========================================================
   TRUST PROXY
========================================================= */

const trustProxyHops = Number(
  process.env.TRUST_PROXY_HOPS || 1
);

app.set(
  "trust proxy",
  trustProxyHops
);

/* =========================================================
   HTTP SERVER
========================================================= */

const server = http.createServer(
  app
);

/* =========================================================
   DRIVER ID NORMALIZER
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

   ALL ORIGINS ARE ALLOWED

   Works with:

   - localhost
   - Android APK
   - Capacitor
   - capacitor://localhost
   - http://localhost
   - https://localhost
   - Vercel
   - Render
   - Postman
   - Browser applications
========================================================= */

const corsOptions = {
  origin: "*",

  methods: [
    "GET",
    "POST",
    "PUT",
    "PATCH",
    "DELETE",
    "OPTIONS",
    "HEAD",
  ],

  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "Accept",
    "Origin",
    "X-Requested-With",
  ],

  exposedHeaders: [
    "Content-Length",
    "Content-Type",
  ],

  credentials: false,

  optionsSuccessStatus: 204,

  maxAge: 86400,
};

/* =========================================================
   EXPRESS CORS
========================================================= */

app.use(
  cors(corsOptions)
);

/*
  IMPORTANT:

  We intentionally do NOT use:

  app.options("*", ...)

  because some recent Express / path-to-regexp versions
  can throw a PathError for "*".

  app.use(cors(...)) already handles CORS preflight.
*/

/* =========================================================
   BODY PARSERS
========================================================= */

app.use(
  express.json({
    limit: "10mb",
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "10mb",
  })
);

/* =========================================================
   LEGACY LOCAL UPLOADS
========================================================= */

if (
  process.env.ENABLE_LOCAL_UPLOADS ===
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
   COMPATIBILITY AUTH ROUTES
========================================================= */

app.use(
  "/api/auth",
  authRoutes
);

/* =========================================================
   DRIVER AUTH
========================================================= */

app.use(
  "/api/driver-auth",
  driverAuthRoutes
);

/* =========================================================
   PARENT AUTH
========================================================= */

app.use(
  "/api/parent-auth",
  parentAuthRoutes
);

/* =========================================================
   ADMIN AUTH
========================================================= */

app.use(
  "/api/admin-auth",
  adminAuthRoutes
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
   NOTIFICATIONS
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
   ADMIN ROUTES
========================================================= */

app.use(
  "/api/admin",
  adminRoutes
);

/* =========================================================
   ADMIN BILLING
========================================================= */

app.use(
  "/api/admin/billing",

  verifyAdmin,

  billingRoutes
);

/* =========================================================
   INVOICES
========================================================= */

app.use(
  "/api/invoices",
  invoiceRoutes
);

/* =========================================================
   PUBLIC WEBSITE ENQUIRIES
========================================================= */

app.use(
  "/api/enquiries",
  enquiryRoutes
);

/* =========================================================
   CHILDREN
========================================================= */

app.use(
  "/api/children",
  childRoutes
);

/* =========================================================
   DRIVER REQUESTS
========================================================= */

app.use(
  "/api/driver-request",
  driverRequestRoutes
);

/* =========================================================
   SOCKET.IO

   IMPORTANT:
   Socket.IO has its own separate CORS configuration.

   All origins are allowed here too.
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

      allowedHeaders: [
        "Content-Type",
        "Authorization",
        "Accept",
        "Origin",
      ],

      credentials: false,
    },

    transports: [
      "websocket",
      "polling",
    ],
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
  Driver public ID
      ↓
  Set<socketId>
*/

const driverConnections =
  new Map();

/*
  Driver public ID
      ↓
  Set<Parent MongoDB ID>
*/

const driverParentsMap =
  new Map();

/* =========================================================
   ADD CONNECTION
========================================================= */

const addConnection = (
  map,
  key,
  socketId
) => {
  if (
    !key
  ) {
    return;
  }

  if (
    !map.has(
      key
    )
  ) {
    map.set(
      key,
      new Set()
    );
  }

  map
    .get(
      key
    )
    .add(
      socketId
    );
};

/* =========================================================
   REMOVE CONNECTION
========================================================= */

const removeConnection = (
  map,
  key,
  socketId
) => {
  if (
    !key
  ) {
    return 0;
  }

  const sockets =
    map.get(
      key
    );

  if (
    !sockets
  ) {
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
   DRIVER SOCKET AUTH
========================================================= */

const authenticateDriverSocket =
  async (
    token
  ) => {
    if (
      !process.env
        .JWT_SECRET
    ) {
      throw new Error(
        "JWT_SECRET is not configured"
      );
    }

    const decoded =
      jwt.verify(
        token,

        process.env
          .JWT_SECRET,

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
      !decoded.id
    ) {
      throw new Error(
        "Invalid Driver token"
      );
    }

    const driverMongoId =
      String(
        decoded.id
      ).trim();

    if (
      !mongoose.Types.ObjectId.isValid(
        driverMongoId
      )
    ) {
      throw new Error(
        "Invalid Driver token"
      );
    }

    const driver =
      await Driver.findById(
        driverMongoId
      ).select(
        [
          "_id",
          "driverId",
          "email",
          "status",
          "isOnline",
          "currentStatus",
        ].join(" ")
      );

    if (
      !driver
    ) {
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
      !driverId
    ) {
      throw new Error(
        "Driver ID has not been assigned"
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
   ADMIN SOCKET AUTH
========================================================= */

const authenticateAdminSocket =
  async (
    token
  ) => {
    if (
      !process.env
        .JWT_SECRET
    ) {
      throw new Error(
        "JWT_SECRET is not configured"
      );
    }

    const decoded =
      jwt.verify(
        token,

        process.env
          .JWT_SECRET,

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
        "admin" ||
      !decoded.id
    ) {
      throw new Error(
        "Invalid Admin token"
      );
    }

    if (
      decoded.role &&
      !ADMIN_ROLES.has(
        decoded.role
      )
    ) {
      throw new Error(
        "Invalid Admin role"
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
        "_id email role isActive"
      );

    if (
      !admin
    ) {
      throw new Error(
        "Admin account not found"
      );
    }

    if (
      admin.isActive ===
      false
    ) {
      throw new Error(
        "Admin account is disabled"
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
   PARENT SOCKET AUTH
========================================================= */

const authenticateParentSocket =
  async (
    token
  ) => {
    if (
      !process.env
        .JWT_SECRET
    ) {
      throw new Error(
        "JWT_SECRET is not configured"
      );
    }

    const decoded =
      jwt.verify(
        token,

        process.env
          .JWT_SECRET,

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
        "parent" ||
      !decoded.id
    ) {
      throw new Error(
        "Invalid Parent token"
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
        "Invalid Parent token"
      );
    }

    const parent =
      await Parent.findById(
        decoded.id
      ).select(
        [
          "_id",
          "driverId",
          "isActive",
          "name",
          "phone",
        ].join(" ")
      );

    if (
      !parent
    ) {
      throw new Error(
        "Parent account not found"
      );
    }

    if (
      parent.isActive ===
      false
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

      linkedDriverId:
        normalizeDriverId(
          parent.driverId
        ),
    };
  };

/* =========================================================
   SOCKET AUTHENTICATION
========================================================= */

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
          ? socket
              .handshake
              .auth
              .token
              .trim()
          : "";

      if (
        !token
      ) {
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

      if (
        !tokenHint ||
        typeof tokenHint !==
          "object"
      ) {
        throw new Error(
          "Invalid authentication token"
        );
      }

      let user =
        null;

      if (
        tokenHint.tokenType ===
        "driver"
      ) {
        user =
          await authenticateDriverSocket(
            token
          );
      } else if (
        tokenHint.tokenType ===
        "parent"
      ) {
        user =
          await authenticateParentSocket(
            token
          );
      } else if (
        tokenHint.tokenType ===
        "admin"
      ) {
        user =
          await authenticateAdminSocket(
            token
          );
      } else {
        throw new Error(
          "Unsupported authentication token"
        );
      }

      socket.user =
        user;

      socket.data.user =
        user;

      return next();
    } catch (
      error
    ) {
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
   VERIFY PARENT ↔ DRIVER LINK
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
        "driverId isActive"
      );

    if (
      !parent ||
      parent.isActive ===
        false
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

    const driverExists =
      await Driver.exists({
        driverId:
          linkedDriverId,

        status:
          "approved",
      });

    if (
      !driverExists
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

  (
    socket
  ) => {
    const user =
      socket.user;

    console.log(
      "Authenticated socket connected:",
      socket.id,
      user.role
    );

    /* =====================================================
       AUTOMATIC PARENT ROOM
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

    /* =====================================================
       AUTOMATIC DRIVER ROOM
    ===================================================== */

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

    /* =====================================================
       AUTOMATIC ADMIN ROOM
    ===================================================== */

    if (
      user.role ===
      "admin"
    ) {
      socket.join(
        "admin"
      );

      socket.join(
        `admin:${user.id}`
      );

      socket.join(
        `admin-role:${user.adminRole}`
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
        } catch (
          error
        ) {
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
              parentData?.parentId ||
                ""
            )
          : String(
              parentData ||
                ""
            );

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
       PARENT -> DRIVER
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

          if (
            !driverId
          ) {
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
            .get(
              driverId
            )
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
        } catch (
          error
        ) {
          console.error(
            "START CAMERA ERROR:",
            error.message
          );
        }
      }
    );

    /* =====================================================
       WEBRTC OFFER
       DRIVER -> PARENT
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
        } = data;

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
       PARENT -> DRIVER
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

          if (
            !data.answer
          ) {
            return;
          }

          const driverId =
            await verifyParentDriverLink(
              socket,
              data.driverId
            );

          if (
            !driverId
          ) {
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
        } catch (
          error
        ) {
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

          /* DRIVER -> PARENT */

          if (
            user.role ===
            "driver"
          ) {
            const parentId =
              String(
                data.parentId ||
                  ""
              );

            if (
              !parentId
            ) {
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

          /* PARENT -> DRIVER */

          if (
            user.role ===
            "parent"
          ) {
            const driverId =
              await verifyParentDriverLink(
                socket,
                data.driverId
              );

            if (
              !driverId
            ) {
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
        } catch (
          error
        ) {
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
            ) || []
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

        if (
          !driverId
        ) {
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
          } = data;

          if (
            lat === undefined ||
            lng === undefined
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
            longitude < -180 ||
            longitude > 180
          ) {
            return;
          }

          /* SPEED */

          const speedNumber =
            Number(
              speed
            );

          const safeSpeed =
            Number.isFinite(
              speedNumber
            ) &&
            speedNumber >= 0
              ? speedNumber
              : 0;

          /* HEADING */

          const headingNumber =
            Number(
              heading
            );

          const safeHeading =
            Number.isFinite(
              headingNumber
            ) &&
            headingNumber >= 0 &&
            headingNumber <= 360
              ? headingNumber
              : 0;

          /* ACCURACY */

          const accuracyNumber =
            Number(
              accuracy
            );

          const safeAccuracy =
            Number.isFinite(
              accuracyNumber
            ) &&
            accuracyNumber >= 0
              ? accuracyNumber
              : null;

          /* ETA */

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

          /* LOAD DRIVER */

          const driver =
            await Driver.findOne({
              driverId:
                user.driverId,

              status:
                "approved",
            });

          if (
            !driver
          ) {
            return;
          }

          /* UPDATE LOCATION */

          driver.updateLiveLocation({
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
          });

          driver.isOnline =
            true;

          if (
            driver.currentStatus ===
            "offline"
          ) {
            driver.currentStatus =
              "idle";
          }

          await driver.save();

          /* BROADCAST */

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
              driver
                .lastLocation
                ?.updatedAt
                ?.toISOString?.() ||
              updatedAt.toISOString(),
          };

          socket
            .to(
              user.driverId
            )
            .emit(
              "live_location",
              locationPayload
            );
        } catch (
          error
        ) {
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

        if (
          !data.frame
        ) {
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

      async () => {
        console.log(
          "Socket disconnected:",
          socket.id,
          user.role
        );

        /* DRIVER */

        if (
          user.role ===
          "driver"
        ) {
          const remainingConnections =
            removeConnection(
              driverConnections,
              user.driverId,
              socket.id
            );

          if (
            remainingConnections ===
            0
          ) {
            try {
              await Driver.findByIdAndUpdate(
                user.id,

                {
                  $set: {
                    isOnline:
                      false,

                    currentStatus:
                      "offline",
                  },
                }
              );
            } catch (
              error
            ) {
              console.error(
                "DRIVER OFFLINE UPDATE ERROR:",
                error.message
              );
            }
          }

          return;
        }

        /* PARENT */

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
    return res
      .status(
        200
      )
      .json({
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
   ROOT CHECK
========================================================= */

app.get(
  "/",

  (
    req,
    res
  ) => {
    return res
      .status(
        200
      )
      .json({
        success:
          true,

        message:
          "ASAN Backend API is running",

        health:
          "/api/health",
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
    return res
      .status(
        404
      )
      .json({
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
   SERVER CONFIG
========================================================= */

const PORT =
  process.env.PORT ||
  5000;

/* =========================================================
   START SERVER
========================================================= */

connectDB()
  .then(
    () => {
      console.log(
        "Database connected successfully"
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
              "Verification photo cleanup completed"
            );
          } catch (
            error
          ) {
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
        "Verification photo cleanup: Daily 2:00 AM IST"
      );

      /* =====================================================
         LISTEN
      ===================================================== */

      server.listen(
        PORT,

        () => {
          console.log(
            "========================================="
          );

          console.log(
            `ASAN Backend running on port ${PORT}`
          );

          console.log(
            "========================================="
          );

          console.log(
            "CORS: ALL ORIGINS ALLOWED"
          );

          console.log(
            "Socket.IO CORS: ALL ORIGINS ALLOWED"
          );

          console.log(
            "========================================="
          );

          console.log(
            "Health: /api/health"
          );

          console.log(
            "Parent Auth: /api/parent-auth"
          );

          console.log(
            "Driver Auth: /api/driver-auth"
          );

          console.log(
            "Admin Auth: /api/admin-auth"
          );

          console.log(
            "Driver APIs: /api/driver"
          );

          console.log(
            "Parent APIs: /api/parent"
          );

          console.log(
            "Trip APIs: /api/trip"
          );

          console.log(
            "Admin APIs: /api/admin"
          );

          console.log(
            "========================================="
          );
        }
      );
    }
  )
  .catch(
    (
      error
    ) => {
      console.error(
        "DATABASE CONNECTION FAILED:",
        error
      );

      process.exit(
        1
      );
    }
  );
