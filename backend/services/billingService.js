export const calculateInvoice = ({
  completedDays,
  oneWayDistance,
  ratePerKm,
  platformCommission,
}) => {
  // Daily distance (pickup + drop)
  const dailyDistance = oneWayDistance * 2;

  // Monthly distance
  const totalDistance = dailyDistance * completedDays;

  // Base fare
  const baseAmount = totalDistance * ratePerKm;

  // Platform commission
  const commissionAmount =
    (baseAmount * platformCommission) / 100;

  // Final bill
  const totalAmount = baseAmount + commissionAmount;

  return {
    dailyDistance,
    totalDistance,
    baseAmount,
    platformCommission: commissionAmount,
    totalAmount,
  };
};
