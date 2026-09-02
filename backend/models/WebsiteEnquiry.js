import mongoose from "mongoose";

const websiteEnquirySchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["parent", "driver"], required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    phone: { type: String, required: true, trim: true, maxlength: 15 },
    area: { type: String, required: true, trim: true, maxlength: 160 },
    school: { type: String, trim: true, maxlength: 160, default: "" },
    pickupLocation: { type: String, trim: true, maxlength: 240, default: "" },
    dropLocation: { type: String, trim: true, maxlength: 240, default: "" },
    preferredTransport: { type: String, enum: ["", "auto", "van", "either"], default: "" },
    vehicleType: { type: String, enum: ["", "auto", "van"], default: "" },
    vehicleNumber: { type: String, trim: true, uppercase: true, maxlength: 20, default: "" },
    experience: { type: String, enum: ["", "0-2", "3-5", "5-10", "10+"], default: "" },
    status: { type: String, enum: ["New", "Contacted", "Closed"], default: "New", index: true },
    source: { type: String, default: "asanrides-website", immutable: true },
  },
  { timestamps: true },
);

websiteEnquirySchema.index({ createdAt: -1 });
websiteEnquirySchema.index({ phone: 1, type: 1, createdAt: -1 });

const WebsiteEnquiry = mongoose.models.WebsiteEnquiry || mongoose.model("WebsiteEnquiry", websiteEnquirySchema);

export default WebsiteEnquiry;
