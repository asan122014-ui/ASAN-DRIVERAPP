import mongoose from "mongoose";

const childSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    age: String,
    school: String,

    parentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Parent",
      required: true,
    },

    driverId: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Child", childSchema);
