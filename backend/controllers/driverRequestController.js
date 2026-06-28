import DriverRequest from "../models/DriverRequest.js";
import Parent from "../models/Parent.js";
import Child from "../models/Child.js";

/* ==================================================
   CREATE DRIVER REQUEST
================================================== */
export const createRequest = async (req, res) => {
  try {
    const { parentId, childId } = req.body;

    if (!parentId) {
      return res.status(400).json({
        success: false,
        message: "Parent ID is required",
      });
    }

    // Prevent duplicate pending requests
    const existingRequest = await DriverRequest.findOne({
      parentId,
      status: "Pending",
    });

    if (existingRequest) {
      return res.status(400).json({
        success: false,
        message: "A pending request already exists.",
      });
    }

    const request = await DriverRequest.create({
      parentId,
      childId,
      status: "Pending",
    });

    // Notify admin dashboard
    const io = req.app.get("io");

    if (io) {
      io.emit("driver_request_created");
    }

    return res.status(201).json({
      success: true,
      message: "Driver request submitted successfully.",
      data: request,
    });

  } catch (error) {
    console.error("Create Driver Request:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/* ==================================================
   GET ALL DRIVER REQUESTS
================================================== */
export const getAllRequests = async (req, res) => {
  try {

    const requests = await DriverRequest.find()
      .populate("parentId", "name email phone")
      .populate("childId", "name")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      data: requests,
    });

  } catch (error) {
    console.error("Get Driver Requests:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/* ==================================================
   ASSIGN DRIVER
================================================== */
export const assignDriver = async (req, res) => {
  try {

    const { driverId } = req.body;

    if (!driverId) {
      return res.status(400).json({
        success: false,
        message: "Driver ID is required",
      });
    }

    const request = await DriverRequest.findById(req.params.id);

    if (!request) {
      return res.status(404).json({
        success: false,
        message: "Driver request not found",
      });
    }

    if (request.status === "Assigned") {
      return res.status(400).json({
        success: false,
        message: "Driver already assigned",
      });
    }

    /* ================= UPDATE REQUEST ================= */

    request.status = "Assigned";
    request.assignedDriverId = driverId;
    request.assignedAt = new Date();

    await request.save();

    /* ================= UPDATE PARENT ================= */

    await Parent.findByIdAndUpdate(
      request.parentId,
      {
        $set: {
          driverId,
        },
      }
    );

    /* ================= UPDATE ALL CHILDREN ================= */

    await Child.updateMany(
      {
        parentId: request.parentId,
      },
      {
        $set: {
          driverId,
        },
      }
    );

    /* ================= SOCKET ================= */

    const io = req.app.get("io");

    if (io) {
      io.emit("driver_request_assigned");
    }

    return res.status(200).json({
      success: true,
      message: "Driver assigned successfully.",
      data: request,
    });

  } catch (error) {
    console.error("Assign Driver:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
