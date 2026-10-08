export function splitDriverPayoutAmount(amount) {
  const totalPaise = Math.round(Number(amount) * 100);
  if (!Number.isSafeInteger(totalPaise) || totalPaise < 0) {
    throw new TypeError("Driver payout amount must be a non-negative INR amount");
  }
  const firstPaise = Math.round(totalPaise / 2);
  return [firstPaise / 100, (totalPaise - firstPaise) / 100];
}
