import { quoteForDistance } from "./bookingPricing.js";

const money = (value) => Math.round(Number(value) * 100) / 100;

export function remainingWorkingDays({ serviceStartsAt, serviceEndsAt, workingDays, now = new Date() }) {
  const totalWorkingDays = Number(workingDays);
  const start = new Date(serviceStartsAt).getTime();
  const end = new Date(serviceEndsAt).getTime();
  const current = new Date(now).getTime();
  if (!Number.isInteger(totalWorkingDays) || totalWorkingDays < 1 || !Number.isFinite(start) || !Number.isFinite(end) || end <= start || !Number.isFinite(current)) {
    throw new Error("A valid active service period is required to price the route change");
  }
  const remainingRatio = Math.max(0, Math.min(1, (end - current) / (end - start)));
  return money(totalWorkingDays * remainingRatio);
}

export function priceLocationChange({ oldDistanceKm, newDistanceKm, vehicleType, childCount, workingDays, currentQuote, serviceStartsAt, serviceEndsAt, now = new Date() }) {
  const previous = currentQuote?.totalMonthly
    ? currentQuote
    : quoteForDistance(oldDistanceKm, vehicleType, childCount, workingDays);
  const next = quoteForDistance(newDistanceKm, vehicleType, childCount, workingDays);
  const addedDistanceKm = Math.max(0, Number(newDistanceKm) - Number(oldDistanceKm));
  const remainingDays = remainingWorkingDays({ serviceStartsAt, serviceEndsAt, workingDays, now });
  const extraDistanceDailyCharge = addedDistanceKm * 2 * previous.ratePerKm;
  const distanceChargeDue = money(extraDistanceDailyCharge * remainingDays);
  const platformFeeDue = money(distanceChargeDue * Number(previous.platformFeeRate ?? 0.02));
  return {
    previous,
    next,
    addedDistanceKm: money(addedDistanceKm),
    remainingServiceDays: remainingDays,
    extraDistanceDailyCharge: money(extraDistanceDailyCharge),
    distanceChargeDue,
    platformFeeDue,
    amountDue: money(distanceChargeDue + platformFeeDue),
    driverAmountDue: distanceChargeDue,
  };
}
