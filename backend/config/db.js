import mongoose from "mongoose";

/* =========================================================
   CONNECT DATABASE
========================================================= */

const connectDB = async () => {
  try {
    /* =====================================================
       ENV VALIDATION
    ===================================================== */

    if (!process.env.MONGO_URI) {
      throw new Error(
        "MONGO_URI is not configured"
      );
    }

    /* =====================================================
       CONNECT
    ===================================================== */

    const connection =
      await mongoose.connect(
        process.env.MONGO_URI,
        {
          serverSelectionTimeoutMS:
            10000,
        }
      );

    console.log(
      `MongoDB Connected: ${connection.connection.host}`
    );

    return connection;
  } catch (error) {
    console.error(
      "MongoDB Connection Error:",
      error.message
    );

    process.exit(1);
  }
};

/* =========================================================
   CONNECTION EVENTS
========================================================= */

mongoose.connection.on(
  "error",
  (error) => {
    console.error(
      "MongoDB Runtime Error:",
      error.message
    );
  }
);

mongoose.connection.on(
  "disconnected",
  () => {
    console.warn(
      "MongoDB disconnected"
    );
  }
);

export default connectDB;
