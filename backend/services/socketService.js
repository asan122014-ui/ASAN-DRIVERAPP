let ioInstance = null;

/* ================= INITIALIZE SOCKET ================= */

export const initSocket = (io) => {
  ioInstance = io;

  io.on("connection", (socket) => {

    console.log("Client connected:", socket.id);

    /* Driver joins personal room */

    socket.on("joinDriverRoom", (driverId) => {
      socket.join(driverId);
      console.log(`Driver ${driverId} joined room`);
    });

    socket.on("disconnect", () => {
      console.log("Client disconnected:", socket.id);
    });

  });
};

/* ================= SEND REALTIME NOTIFICATION ================= */

export const sendRealtimeNotification = (driverId, notification) => {

  if (!ioInstance) return;

  ioInstance.to(driverId.toString()).emit("newNotification", notification);

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