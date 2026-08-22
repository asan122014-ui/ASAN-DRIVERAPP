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

/* =========================================================
   CONSTANTS
========================================================= */

const ADMIN_ROLES =
  new Set([
    "superadmin",
    "reviewer",
  ]);

/* =========================================================
   EXPRESS
========================================================= */

const app =
  express();

/* =========================================================
   TRUST PROXY
========================================================= */

const trustProxyHops =
  Number(
    process.env
      .TRUST_PROXY_HOPS ||
      1
  );

app.set(
  "trust proxy",
  trustProxyHops
);

/* =========================================================
   HTTP SERVER
========================================================= */

const server =
  http.createServer(
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
========================================================= */

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
      .filter(
        Boolean
      )
  );

/* =========================================================
   DEVELOPMENT ORIGIN
========================================================= */

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
      new URL(
        origin
      );

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

/* =========================================================
   CORS ORIGIN VALIDATOR
========================================================= */

const corsOriginValidator = (
  origin,
  callback
) => {
  /*
    Native mobile apps,
    Postman,
    curl,
    server-to-server requests

    may not include an Origin header.
  */

  if (
    !origin
  ) {
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
   BODY PARSERS
========================================================= */

app.use(
  express.json({
    limit:
      "10mb",
  })
);

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
   COMPATIBILITY AUTH ROUTES
========================================================= */

/*
  Existing compatibility routes such as:

  POST /api/auth/save-token
  GET  /api/auth/by-id/:driverId
*/

app.use(
  "/api/auth",
  authRoutes
);

/* =========================================================
   DRIVER AUTH
========================================================= */

/*
  POST /api/driver-auth/send-register-otp
  POST /api/driver-auth/verify-register-otp

  POST /api/driver-auth/send-login-otp
  POST /api/driver-auth/verify-login-otp

  GET  /api/driver-auth/me
  POST /api/driver-auth/logout

  JWT:

  {
    id: "<MongoDB Driver _id>",
    tokenType: "driver"
  }
*/

app.use(
  "/api/driver-auth",
  driverAuthRoutes
);

/* =========================================================
   PARENT AUTH
========================================================= */

/*
  Parent JWT:

  {
    id: "<MongoDB Parent _id>",
    tokenType: "parent"
  }
*/

app.use(
  "/api/parent-auth",
  parentAuthRoutes
);

/* =========================================================
   ADMIN AUTH
========================================================= */

/*
  ADMIN LOGIN

  POST /api/admin-auth/login

  BODY:

  {
    "email": "admin@example.com",
    "password": "password"
  }

  ---------------------------------------------------------

  CURRENT ADMIN

  GET /api/admin-auth/me

  Authorization:

  Bearer <admin-token>

  ---------------------------------------------------------

  LOGOUT

  POST /api/admin-auth/logout

  ---------------------------------------------------------

  CREATE ADMIN

  POST /api/admin-auth/create

  Superadmin only.

  ---------------------------------------------------------

  ADMIN JWT:

  {
    id: "<MongoDB Admin _id>",
    tokenType: "admin",
    role: "superadmin" | "reviewer"
  }
*/

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
   ADMIN OPERATIONAL ROUTES
========================================================= */

/*
  Admin Dashboard
  Driver approval
  Driver rejection
  Analytics
  Admin logs
  etc.

  adminRoutes.js should use verifyAdmin.
*/

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
    /* =====================================================
       JWT SECRET
    ===================================================== */

    if (
      !process.env
        .JWT_SECRET
    ) {
      throw new Error(
        "JWT_SECRET is not configured"
      );
    }

    /* =====================================================
       VERIFY JWT
    ===================================================== */

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

    /* =====================================================
       TOKEN TYPE
    ===================================================== */

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

    /* =====================================================
       OBJECT ID
    ===================================================== */

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

    /* =====================================================
       CURRENT DRIVER
    ===================================================== */

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

    /* =====================================================
       APPROVAL
    ===================================================== */

    if (
      driver.status !==
      "approved"
    ) {
      throw new Error(
        "Driver account is not approved"
      );
    }

    /* =====================================================
       PUBLIC DRIVER ID
    ===================================================== */

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

    /* =====================================================
       AUTHENTICATED DRIVER
    ===================================================== */

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
    /* =====================================================
       JWT SECRET
    ===================================================== */

    if (
      !process.env
        .JWT_SECRET
    ) {
      throw new Error(
        "JWT_SECRET is not configured"
      );
    }

    /* =====================================================
       VERIFY JWT
    ===================================================== */

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

    /* =====================================================
       TOKEN STRUCTURE
    ===================================================== */

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

    /* =====================================================
       TOKEN ROLE
    ===================================================== */

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

    /* =====================================================
       OBJECT ID
    ===================================================== */

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

    /* =====================================================
       CURRENT ADMIN
    ===================================================== */

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

    /* =====================================================
       ACTIVE ACCOUNT
    ===================================================== */

    if (
      admin.isActive ===
      false
    ) {
      throw new Error(
        "Admin account is disabled"
      );
    }

    /* =====================================================
       CURRENT ROLE
    ===================================================== */

    if (
      !ADMIN_ROLES.has(
        admin.role
      )
    ) {
      throw new Error(
        "Admin access denied"
      );
    }

    /* =====================================================
       AUTHENTICATED ADMIN
    ===================================================== */

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
    /* =====================================================
       JWT SECRET
    ===================================================== */

    if (
      !process.env
        .JWT_SECRET
    ) {
      throw new Error(
        "JWT_SECRET is not configured"
      );
    }

    /* =====================================================
       VERIFY JWT
    ===================================================== */

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

    /* =====================================================
       TOKEN TYPE
    ===================================================== */

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

    /* =====================================================
       OBJECT ID
    ===================================================== */

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

    /* =====================================================
       CURRENT PARENT
    ===================================================== */

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

    /* =====================================================
       ACTIVE CHECK
    ===================================================== */

    if (
      parent.isActive ===
      false
    ) {
      throw new Error(
        "Parent account is inactive"
      );
    }

    /* =====================================================
       AUTHENTICATED PARENT
    ===================================================== */

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

/*
  Driver:

  {
    id,
    tokenType: "driver"
  }

  Parent:

  {
    id,
    tokenType: "parent"
  }

  Admin:

  {
    id,
    tokenType: "admin",
    role
  }
*/

io.use(
  async (
    socket,
    next
  ) => {
    try {
      /* ===================================================
         TOKEN
      =================================================== */

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

      /* ===================================================
         TOKEN HINT
      =================================================== */

      /*
        jwt.decode is used only to determine
        which verification function should handle
        the token.

        Every handler still uses jwt.verify().
      */

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

      /* ===================================================
         DRIVER
      =================================================== */

      if (
        tokenHint.tokenType ===
        "driver"
      ) {
        user =
          await authenticateDriverSocket(
            token
          );
      }

      /* ===================================================
         PARENT
      =================================================== */

      else if (
        tokenHint.tokenType ===
        "parent"
      ) {
        user =
          await authenticateParentSocket(
            token
          );
      }

      /* ===================================================
         ADMIN
      =================================================== */

      else if (
        tokenHint.tokenType ===
        "admin"
      ) {
        user =
          await authenticateAdminSocket(
            token
          );
      }

      /* ===================================================
         UNKNOWN
      =================================================== */

      else {
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

  (socket) => {
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
              : data
                  ?.driverId;

          const requestedDriverId =
            normalizeDriverId(
              rawDriverId
            );

          if (
            !requestedDriverId
          ) {
            return;
          }

          /* ===============================================
             DRIVER
          =============================================== */

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

          /* ===============================================
             PARENT
          =============================================== */

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
              parentData
                ?.parentId ||
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

          /* ===============================================
             DRIVER → PARENT
          =============================================== */

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

          /* ===============================================
             PARENT → DRIVER
          =============================================== */

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
            latitude <
              -90 ||
            latitude >
              90 ||
            longitude <
              -180 ||
            longitude >
              180
          ) {
            return;
          }

          /* ===============================================
             SPEED
          =============================================== */

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

          /* ===============================================
             HEADING
          =============================================== */

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

          /* ===============================================
             ACCURACY
          =============================================== */

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

          /* ===============================================
             ETA
          =============================================== */

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

          /* ===============================================
             LOAD DRIVER
          =============================================== */

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

          /* ===============================================
             UPDATE LOCATION
          =============================================== */

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

          /* ===============================================
             BROADCAST
          =============================================== */

          const locationPayload =
            {
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

        /* ===============================================
           DRIVER
        =============================================== */

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

        /* ===============================================
           PARENT
        =============================================== */

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
      .status(200)
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
   404
========================================================= */

app.use(
  (
    req,
    res
  ) => {
    return res
      .status(404)
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
            `Server running on port ${PORT}`
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
            "Admin Login: /api/admin-auth/login"
          );

          console.log(
            "Admin Session: /api/admin-auth/me"
          );

          console.log(
            "Admin Logout: /api/admin-auth/logout"
          );

          console.log(
            "Create Admin: /api/admin-auth/create"
          );

          console.log(
            "Driver Register OTP: /api/driver-auth/send-register-otp"
          );

          console.log(
            "Driver Verify Register OTP: /api/driver-auth/verify-register-otp"
          );

          console.log(
            "Driver Login OTP: /api/driver-auth/send-login-otp"
          );

          console.log(
            "Driver Verify Login OTP: /api/driver-auth/verify-login-otp"
          );

          console.log(
            "Driver APIs: /api/driver"
          );

          console.log(
            "Admin APIs: /api/admin"
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
