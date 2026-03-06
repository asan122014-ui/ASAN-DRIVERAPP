import Driver from "../models/Driver.js";

/*
  Generate a unique driver ID
  Format: DRV-YYYY-XXXX
  Example: DRV-2026-0001
*/

export const generateDriverId = async () => {

  const year = new Date().getFullYear();

  const driverCount = await Driver.countDocuments({}) + 1;

  const sequence = (driverCount + 1).toString().padStart(4, "0");

  const driverId = `DRV-${year}-${sequence}`;

  return driverId;
};