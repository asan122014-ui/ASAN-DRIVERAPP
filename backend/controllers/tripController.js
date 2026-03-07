import {
  startTripService,
  endTripService,
  getDriverTripsService,
  getActiveTripService
} from "../services/tripService.js";

export const startTrip = async (req, res) => {
  try {

    const driverId = req.user.id;
    const { tripType } = req.body;

    const trip = await startTripService(driverId, tripType, req.io);

    res.json({
      success: true,
      data: trip
    });

  } catch (error) {

    console.error("Start trip error:", error);

    res.status(500).json({
      success: false,
      message: error.message
    });

  }
};

export const endTrip = async (req, res) => {
  try {

    const driverId = req.Driver.id;

    const trip = await endTripService(driverId, req.io);

    res.json({
      success: true,
      data: trip
    });

  } catch (error) {

    res.status(500).json({
      success: false,
      message: error.message
    });

  }
};

export const getTripHistory = async (req, res) => {

  const trips = await getDriverTripsService(req.Driver.id);

  res.json({
    success: true,
    data: trips
  });

};

export const getActiveTrip = async (req, res) => {

  const trip = await getActiveTripService(req.Driver.id);

  res.json({
    success: true,
    data: trip
  });

};

