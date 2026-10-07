import { quoteForDistance } from "./bookingPricing.js";

const money = (value) => Math.round(Number(value) * 100) / 100;

export function priceLocationChange({ oldDistanceKm, newDistanceKm, vehicleType, childCount, workingDays, currentQuote }) {
  const previous = currentQuote?.totalMonthly
    ? currentQuote
    : quoteForDistance(oldDistanceKm, vehicleType, childCount, workingDays);
  const next = quoteForDistance(newDistanceKm, vehicleType, childCount, workingDays);
  return {
    previous,
    next,
    amountDue: Math.max(0, money(next.totalMonthly - Number(previous.totalMonthly))),
    driverAmountDue: Math.max(0, money(next.distanceCharge - Number(previous.distanceCharge || 0))),
  };
}
