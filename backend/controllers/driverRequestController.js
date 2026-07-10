import DriverRequest from "../models/DriverRequest.js";
import Parent from "../models/Parent.js";
import Child from "../models/Child.js";
import Driver from "../models/Driver.js";
import { sendNotification } from "../utils/sendNotification.js";

/* ==================================================
   DISTANCE CALCULATOR (HAVERSINE)
================================================== */
const getDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371;

  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
};

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

    // ✅ Send DRIVER_REQUEST_SUBMITTED notification
    await sendNotification({
      parentId,
      childId,
      notificationKey: "DRIVER_REQUEST_SUBMITTED",
    });

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
    console.error(error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/* ==================================================
   GET ALL REQUESTS WITH NEAREST DRIVERS
================================================== */
export const getAllRequests = async (req, res) => {
  try {
    const requests = await DriverRequest.find()
      .populate("parentId")
      .populate("childId", "name")
      .sort({ createdAt: -1 });

    const approvedDrivers = await Driver.find({
      status: "approved",
    });

    const data = [];

    for (const request of requests) {
      // Parent deleted -> remove orphan request
      if (!request.parentId) {
        await DriverRequest.findByIdAndDelete(request._id);
        continue;
      }

      const parent = request.parentId;

      let nearestDrivers = [];

      if (
        parent.homeLocation?.coordinates?.length === 2
      ) {
        const parentLng = parent.homeLocation.coordinates[0];
        const parentLat = parent.homeLocation.coordinates[1];

        nearestDrivers = approvedDrivers
          .filter(
            (driver) =>
              driver.homeLocation?.coordinates?.length === 2
          )
          .map((driver) => {
            const driverLng =
              driver.homeLocation.coordinates[0];
            const driverLat =
              driver.homeLocation.coordinates[1];

            const distance = getDistance(
              parentLat,
              parentLng,
              driverLat,
              driverLng
            );

            return {
              _id: driver._id,
              name: driver.name,
              driverId: driver.driverId,
              phone: driver.phone,
              vehicleNumber: driver.vehicleNumber,
              address: driver.address,
              distance: Number(distance.toFixed(2)),
            };
          })
          .sort((a, b) => a.distance - b.distance)
          .slice(0, 5);
      }

      data.push({
        ...request.toObject(),
        nearestDrivers,
      });
    }

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    console.error(error);

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

    request.status = "Assigned";
    request.assignedDriverId = driverId;
    request.assignedAt = new Date();

    await request.save();

    await Parent.findByIdAndUpdate(request.parentId, {
      driverId,
    });

    await Child.updateMany(
      {
        parentId: request.parentId,
      },
      {
        driverId,
      }
    );

    // ✅ Send DRIVER_REQUEST_ACCEPTED notification
    await sendNotification({
      parentId: request.parentId,
      childId: request.childId,
      driverId,
      notificationKey: "DRIVER_REQUEST_ACCEPTED",
    });

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
    console.error(error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
