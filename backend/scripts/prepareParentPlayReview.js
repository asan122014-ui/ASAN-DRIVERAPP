import "dotenv/config";
import mongoose from "mongoose";
import Parent from "../models/Parent.js";

// The administrator explicitly confirmed this account and all linked records are fictional.
const email = "bhattagiri.neeharika@gmail.com";
try {
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI is not configured.");
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000 });
  const parent = await Parent.findByEmail(email);
  if (!parent) throw new Error("The specified test parent account does not exist. No changes made.");
  if (!parent.isActive) throw new Error("The specified test parent account is inactive. No changes made.");
  const children = await mongoose.connection.collection("children").countDocuments({ parentId: parent._id });
  const bookings = await mongoose.connection.collection("bookings").countDocuments({ parentId: parent._id });
  if (process.argv.includes("--activate")) {
    await Parent.updateOne({ _id: parent._id, email, isActive: true }, { $set: { isPlayReviewAccount: true } });
  }
  console.log(JSON.stringify({ email, parentId: String(parent._id), children, bookings,
    reviewAccountMarked: process.argv.includes("--activate") || parent.isPlayReviewAccount === true }));
} catch (error) {
  console.error(error.name === "MongooseServerSelectionError" ? "Database connection could not be established." : error.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
