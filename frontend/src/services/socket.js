import { io } from "socket.io-client";

const socket = io("https://asan-driverapp.onrender.com", {
  autoConnect: false,
});

export default socket;
