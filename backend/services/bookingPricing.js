const round = (value) => Math.round(Number(value) * 100) / 100;

export function quoteForDistance(distanceKm, vehicleType = "AUTO", childCount = 1, workingDays = 26) {
  const distance = Number(distanceKm);
  const days = Number(workingDays);
  const children = Number(childCount);
  if (!Number.isFinite(distance) || distance <= 0 || !Number.isInteger(children) || children < 1 || !Number.isInteger(days) || days < 1) throw new Error("Invalid pricing inputs");
  const normalizedVehicle = String(vehicleType).toUpperCase();
  const ratePerKm = normalizedVehicle === "VAN" ? 16 : normalizedVehicle === "AUTO" ? 14 : null;
  if (!ratePerKm) throw new Error("Vehicle type must be AUTO or VAN");
  const distanceCharge = distance * 2 * ratePerKm * days;
  const additionalChildCharge = Math.max(children - 1, 0) * 500;
  const rideSubtotal = distanceCharge + additionalChildCharge;
  const platformFee = rideSubtotal * 0.02;
  const tax = 0;
  const discount = 0;
  const totalMonthly = rideSubtotal + platformFee + tax - discount;
  return { currency: "INR", vehicleType: normalizedVehicle, workingDays: days, childCount: children, ratePerKm, distanceCharge: round(distanceCharge), additionalChildCharge: round(additionalChildCharge), rideSubtotal: round(rideSubtotal), platformFeeRate: 0.02, platformFee: round(platformFee), tax, discount, totalMonthly: round(totalMonthly) };
}
