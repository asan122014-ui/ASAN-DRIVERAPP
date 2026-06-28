import DriverRequest from "../models/DriverRequest.js";

export const createRequest = async (req, res) => {
  try {
    const { parentId, childId } = req.body;

    const request = await DriverRequest.create({
      parentId,
      childId,
    });

    res.status(201).json({
      success: true,
      message: "Request submitted successfully",
      data: request,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
export const getAllRequests = async (req, res) => {
  try {
    const requests = await DriverRequest.find()
      .populate("parentId", "name email phone")
      .populate("childId", "name")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: requests,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
import Child from "../models/Child.js";

export const assignDriver = async (req, res) => {
  try {
    const { driverId } = req.body;

    const request = await DriverRequest.findById(req.params.id);

    if (!request) {
      return res.status(404).json({
        success: false,
        message: "Request not found",
      });
    }

    request.assignedDriverId = driverId;
    request.status = "Assigned";

    await request.save();

    await Child.updateMany(
      { parentId: request.parentId },
      { driverId }
    );

    res.status(200).json({
      success: true,
      message: "Driver assigned successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
