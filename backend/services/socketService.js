let ioInstance = null;

/* ================= STORAGE ================= */
const frames = {};        // latest frame per driver
const cameraStatus = {};  // live/offline

/* ================= INITIALIZE SOCKET ================= */
export const initSocket = (io) => {
  if (ioInstance) {
    console.warn("Socket already initialized");
    return;
  }

  ioInstance = io;

  io.on("connection", (socket) => {
    console.log("Socket connected:", socket.id);

    /* ===== JOIN DRIVER ROOM ===== */
    socket.on("joinDriverRoom", (driverId) => {
      if (!driverId) {
        console.warn("Missing driverId for socket join");
        return;
      }

      const room = driverId.toString();
      socket.join(room);

      console.log(`Joined room: ${room}`);
    });

    /* ===== DRIVER SENDS CAMERA FRAME ===== */
    socket.on("camera_frame", ({ driverId, frame }) => {
      if (!driverId || !frame) return;

      const room = driverId.toString();

      frames[room] = frame;
      cameraStatus[room] = "live";

      // send to all users in that driver room
      ioInstance.to(room).emit("camera_update", {
        driverId,
        frame,
      });
    });

    /* ===== PARENT REQUEST CURRENT FRAME ===== */
    socket.on("get_camera", (driverId) => {
      if (!driverId) return;

      const room = driverId.toString();

      socket.emit("camera_update", {
        driverId,
        frame: frames[room] || null,
      });
    });

    /* ===== START CAMERA ===== */
    socket.on("start_camera", (driverId) => {
      if (!driverId) return;

      const room = driverId.toString();

      ioInstance.to(room).emit("camera_control", {
        action: "start",
      });

      cameraStatus[room] = "live";

      console.log(`🎥 Camera START for ${room}`);
    });

    /* ===== STOP CAMERA ===== */
    socket.on("stop_camera", (driverId) => {
      if (!driverId) return;

      const room = driverId.toString();

      ioInstance.to(room).emit("camera_control", {
        action: "stop",
      });

      cameraStatus[room] = "offline";

      console.log(`🛑 Camera STOP for ${room}`);
    });

    /* ===== DISCONNECT ===== */
    socket.on("disconnect", () => {
      console.log("Socket disconnected:", socket.id);
    });
  });
};

/* ================= SEND TO ONE DRIVER ================= */
export const sendRealtimeNotification = (driverId, notification) => {
  if (!ioInstance || !driverId) return;

  ioInstance.to(driverId.toString()).emit("newNotification", notification);
};

/* ================= BROADCAST ================= */
export const broadcastMessage = (event, data) => {
  if (!ioInstance) return;

  ioInstance.emit(event, data);
};

/* ================= GET IO ================= */
export const getIO = () => ioInstance;

/* ================= CLEANUP (OPTIONAL) ================= */
setInterval(() => {
  Object.keys(frames).forEach((driverId) => {
    frames[driverId] = null;
  });
}, 60000);
