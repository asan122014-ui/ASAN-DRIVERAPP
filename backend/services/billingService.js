/* =========================================================
   BILLING CALCULATION SERVICE
========================================================= */

/*
  Billing formula:

  Daily Distance
  = One Way Distance × 2

  Total Distance
  = Daily Distance × Completed Days

  Raw Base Amount
  = Total Distance × Rate Per Km

  Base Amount
  = max(Raw Base Amount, Minimum Fare)

  Commission Amount
  = Base Amount × Commission %

  Total Amount
  = Base Amount + Commission Amount

  IMPORTANT:

  Minimum fare is applied only when at least
  one service day was completed.

  If completedDays = 0:
  totalAmount = 0
*/

export const calculateInvoice = ({
  completedDays = 0,

  oneWayDistance = 0,

  ratePerKm = 0,

  platformCommission = 0,

  minimumFare = 0,
}) => {
  /* =====================================================
     NORMALIZE VALUES
  ===================================================== */

  const normalizedCompletedDays =
    Number(completedDays);

  const normalizedOneWayDistance =
    Number(oneWayDistance);

  const normalizedRatePerKm =
    Number(ratePerKm);

  const normalizedCommission =
    Number(platformCommission);

  const normalizedMinimumFare =
    Number(minimumFare);

  /* =====================================================
     VALIDATION
  ===================================================== */

  if (
    !Number.isInteger(
      normalizedCompletedDays
    ) ||
    normalizedCompletedDays < 0
  ) {
    throw new Error(
      "Completed days must be a non-negative whole number"
    );
  }

  if (
    !Number.isFinite(
      normalizedOneWayDistance
    ) ||
    normalizedOneWayDistance < 0
  ) {
    throw new Error(
      "One-way distance must be a valid non-negative number"
    );
  }

  if (
    !Number.isFinite(
      normalizedRatePerKm
    ) ||
    normalizedRatePerKm < 0
  ) {
    throw new Error(
      "Rate per km must be a valid non-negative number"
    );
  }

  if (
    !Number.isFinite(
      normalizedCommission
    ) ||
    normalizedCommission < 0 ||
    normalizedCommission > 100
  ) {
    throw new Error(
      "Platform commission must be between 0 and 100"
    );
  }

  if (
    !Number.isFinite(
      normalizedMinimumFare
    ) ||
    normalizedMinimumFare < 0
  ) {
    throw new Error(
      "Minimum fare must be a valid non-negative number"
    );
  }

  /* =====================================================
     NO COMPLETED SERVICE
  ===================================================== */

  /*
    Do not charge minimum fare when there
    was no completed service during the month.
  */

  if (
    normalizedCompletedDays === 0
  ) {
    return {
      completedDays: 0,

      oneWayDistance:
        Number(
          normalizedOneWayDistance.toFixed(
            2
          )
        ),

      dailyDistance: 0,

      totalDistance: 0,

      ratePerKm:
        Number(
          normalizedRatePerKm.toFixed(
            2
          )
        ),

      rawBaseAmount: 0,

      minimumFare:
        Number(
          normalizedMinimumFare.toFixed(
            2
          )
        ),

      minimumFareApplied:
        false,

      baseAmount: 0,

      platformCommissionRate:
        Number(
          normalizedCommission.toFixed(
            2
          )
        ),

      platformCommission: 0,

      totalAmount: 0,
    };
  }

  /* =====================================================
     DAILY DISTANCE
  ===================================================== */

  const dailyDistance =
    Number(
      (
        normalizedOneWayDistance *
        2
      ).toFixed(2)
    );

  /* =====================================================
     TOTAL DISTANCE
  ===================================================== */

  const totalDistance =
    Number(
      (
        dailyDistance *
        normalizedCompletedDays
      ).toFixed(2)
    );

  /* =====================================================
     RAW BASE AMOUNT
  ===================================================== */

  const rawBaseAmount =
    Number(
      (
        totalDistance *
        normalizedRatePerKm
      ).toFixed(2)
    );

  /* =====================================================
     MINIMUM FARE
  ===================================================== */

  const minimumFareApplied =
    rawBaseAmount <
    normalizedMinimumFare;

  const baseAmount =
    Number(
      Math.max(
        rawBaseAmount,
        normalizedMinimumFare
      ).toFixed(2)
    );

  /* =====================================================
     PLATFORM COMMISSION
  ===================================================== */

  /*
    BillingSettings.platformCommission
    = percentage.

    Example:
    2 means 2%.

    Invoice.platformCommission
    = calculated rupee amount.
  */

  const commissionAmount =
    Number(
      (
        (
          baseAmount *
          normalizedCommission
        ) /
        100
      ).toFixed(2)
    );

  /* =====================================================
     FINAL AMOUNT
  ===================================================== */

  const totalAmount =
    Number(
      (
        baseAmount +
        commissionAmount
      ).toFixed(2)
    );

  /* =====================================================
     RESULT
  ===================================================== */

  return {
    completedDays:
      normalizedCompletedDays,

    oneWayDistance:
      Number(
        normalizedOneWayDistance.toFixed(
          2
        )
      ),

    dailyDistance,

    totalDistance,

    ratePerKm:
      Number(
        normalizedRatePerKm.toFixed(
          2
        )
      ),

    rawBaseAmount,

    minimumFare:
      Number(
        normalizedMinimumFare.toFixed(
          2
        )
      ),

    minimumFareApplied,

    baseAmount,

    platformCommissionRate:
      Number(
        normalizedCommission.toFixed(
          2
        )
      ),

    /*
      This is the calculated commission
      amount stored in Invoice.
    */

    platformCommission:
      commissionAmount,

    totalAmount,
  };
};
