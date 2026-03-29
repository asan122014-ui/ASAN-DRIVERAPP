/* ================= SOCKET ================= */
const io = new Server(server, {
  cors: {
    origin: "*", // ✅ allow all
    methods: ["GET", "POST"],
    credentials: true
  }
});

app.set("io", io);

/* ================= MIDDLEWARE ================= */
app.use(
  cors({
    origin: "*", // ✅ allow all origins
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true
  })
);
