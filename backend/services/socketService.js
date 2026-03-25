let ioInstance = null;

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

      console.log(`Driver ${room} joined room`);
    });

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
