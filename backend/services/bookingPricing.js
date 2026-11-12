const round = (value) => Math.round(Number(value) * 100) / 100;
export const CURRENT_PRICING_VERSION = '2026-11-v2';

export function roundMonthlyTotal(value) {
  const paise = Math.round(Number(value) * 100);
  if (!Number.isSafeInteger(paise) || paise <= 0) throw new Error('Invalid monthly total');
  if (paise % 1000 === 0 || paise % 10000 === 9900) return paise / 100;
  // Prices ending in zero stay unchanged; otherwise use the next xx99 price.
  return (Math.ceil((paise + 100) / 10000) * 10000 - 100) / 100;
}

export function quoteForDistance(distanceKm, vehicleType = "AUTO", childCount = 1, workingDays = 26, pricingVersion = CURRENT_PRICING_VERSION) {
  const distance = Number(distanceKm);
  const days = Number(workingDays);
  const children = Number(childCount);
  if (!Number.isFinite(distance) || distance <= 0 || !Number.isInteger(children) || children < 1 || !Number.isInteger(days) || days < 1) throw new Error("Invalid pricing inputs");
  const normalizedVehicle = String(vehicleType).toUpperCase();
  if (![CURRENT_PRICING_VERSION, 'legacy'].includes(pricingVersion)) throw new Error('Unknown pricing version');
  const current = pricingVersion === CURRENT_PRICING_VERSION;
  const ratePerKm = normalizedVehicle === "VAN" ? (current ? 18 : 16) : normalizedVehicle === "AUTO" ? (current ? 16 : 14) : null;
  if (!ratePerKm) throw new Error("Vehicle type must be AUTO or VAN");
  const baseDistanceCharge = distance * 2 * ratePerKm * days;
  const additionalChildCharge = Math.max(children - 1, 0) * 500;
  const platformFeeRate = current ? 0.05 : 0.02;
  const baseSubtotal = baseDistanceCharge + additionalChildCharge;
  const tax = 0;
  const discount = 0;
  const totalMonthly = current ? roundMonthlyTotal(baseSubtotal * (1 + platformFeeRate)) : round(baseSubtotal * (1 + platformFeeRate));
  const rideSubtotal = current ? round(totalMonthly / (1 + platformFeeRate)) : round(baseSubtotal);
  // Allocate the final paise to the fee so the displayed components always sum exactly.
  const platformFee = current ? round(totalMonthly - rideSubtotal) : round(baseSubtotal * platformFeeRate);
  const distanceCharge = round(rideSubtotal - additionalChildCharge);
  return { ...(current ? { pricingVersion } : {}), currency: "INR", vehicleType: normalizedVehicle, workingDays: days, childCount: children, ratePerKm, dailyDistanceCharge: round(distanceCharge / days), distanceCharge, additionalChildCharge, rideSubtotal, platformFeeRate, platformFee, tax, discount, totalMonthly };
}
