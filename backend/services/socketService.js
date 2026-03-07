let ioInstance = null;

/* ================= INITIALIZE SOCKET ================= */

export const initSocket = (io) => {

  if (ioInstance) {
    console.warn("Socket already initialized");
    return;
  }

  ioInstance = io;

  io.on("connection", (socket) => {

    console.log("Socket client connected:", socket.id);

    /* Driver joins personal notification room */

    socket.on("joinDriverRoom", (driverId) => {

      if (!driverId) return;

      const room = driverId.toString();

      socket.join(room);

      console.log(`Driver ${room} joined notification room`);

    });

    socket.on("disconnect", () => {

      console.log("Socket client disconnected:", socket.id);

    });

  });

};

/* ================= SEND REALTIME NOTIFICATION ================= */

export const sendRealtimeNotification = (driverId, notification) => {

  if (!ioInstance || !driverId) return;

  const room = driverId.toString();

  ioInstance.to(room).emit("newNotification", notification);

};

/* ================= BROADCAST MESSAGE ================= */

export const broadcastMessage = (event, data) => {

  if (!ioInstance) return;

  ioInstance.emit(event, data);

};

/* ================= GET SOCKET INSTANCE ================= */

export const getIO = () => {
  return ioInstance;
};
