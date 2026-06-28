/* ==================================================
   BILLING CALCULATION SERVICE
================================================== */

export const calculateInvoice = ({
  completedDays = 0,
  oneWayDistance = 0,
  ratePerKm = 0,
  platformCommission = 0,
}) => {
  /* ================= DAILY DISTANCE ================= */

  const dailyDistance = Number(
    (oneWayDistance * 2).toFixed(2)
  );

  /* ================= TOTAL DISTANCE ================= */

  const totalDistance = Number(
    (dailyDistance * completedDays).toFixed(2)
  );

  /* ================= BASE AMOUNT ================= */

  const baseAmount = Number(
    (totalDistance * ratePerKm).toFixed(2)
  );

  /* ================= PLATFORM COMMISSION ================= */

  const commissionAmount = Number(
    ((baseAmount * platformCommission) / 100).toFixed(2)
  );

  /* ================= FINAL AMOUNT ================= */

  const totalAmount = Number(
    (baseAmount + commissionAmount).toFixed(2)
  );

  return {
    completedDays,
    dailyDistance,
    totalDistance,
    ratePerKm: Number(ratePerKm.toFixed(2)),
    baseAmount,
    platformCommission: commissionAmount,
    totalAmount,
  };
};
