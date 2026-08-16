import BillingSettings from "../models/BillingSettings.js";

/* =========================================================
   CONSTANTS
========================================================= */

const BILLING_TYPES = [
  "postpaid",
  "prepaid",
];

/* =========================================================
   CREATE DEFAULT SETTINGS
========================================================= */

const createDefaultSettings =
  async () => {
    return BillingSettings.create({
      ratePerKm: 3,

      platformCommission: 2,

      billingType: "postpaid",

      minimumFare: 50,

      paymentDueDays: 5,

      isActive: true,
    });
  };

/* =========================================================
   GET BILLING SETTINGS
========================================================= */

export const getBillingSettings =
  async (req, res) => {
    try {
      /*
        Always fetch the latest active
        billing configuration.
      */

      let settings =
        await BillingSettings.getActive();

      /* ===================================================
         CREATE DEFAULT SETTINGS
      =================================================== */

      if (!settings) {
        settings =
          await createDefaultSettings();
      }

      return res.status(200).json({
        success: true,
        data: settings,
      });
    } catch (error) {
      console.error(
        "GET BILLING SETTINGS ERROR:",
        error
      );

      return res.status(500).json({
        success: false,

        message:
          "Failed to fetch billing settings",
      });
    }
  };

/* =========================================================
   UPDATE BILLING SETTINGS
========================================================= */

export const updateBillingSettings =
  async (req, res) => {
    try {
      const {
        ratePerKm,

        platformCommission,

        billingType,

        minimumFare,

        paymentDueDays,
      } = req.body;

      /* ===================================================
         REQUIRE AT LEAST ONE FIELD
      =================================================== */

      const hasUpdate =
        ratePerKm !== undefined ||
        platformCommission !== undefined ||
        billingType !== undefined ||
        minimumFare !== undefined ||
        paymentDueDays !== undefined;

      if (!hasUpdate) {
        return res.status(400).json({
          success: false,

          message:
            "At least one billing setting is required",
        });
      }

      /* ===================================================
         GET ACTIVE SETTINGS
      =================================================== */

      let settings =
        await BillingSettings.getActive();

      /*
        If settings do not exist,
        create a new model with defaults.

        User-provided values will override
        the defaults below.
      */

      if (!settings) {
        settings =
          new BillingSettings({
            isActive: true,
          });
      }

      /* ===================================================
         RATE PER KM
      =================================================== */

      if (
        ratePerKm !==
        undefined
      ) {
        const value =
          Number(ratePerKm);

        if (
          !Number.isFinite(value) ||
          value < 0
        ) {
          return res.status(400).json({
            success: false,

            message:
              "Rate per km must be a valid non-negative number",
          });
        }

        settings.ratePerKm =
          value;
      }

      /* ===================================================
         PLATFORM COMMISSION
      =================================================== */

      /*
        BillingSettings.platformCommission
        represents a percentage.

        Example:

        2 = 2%
        10 = 10%
      */

      if (
        platformCommission !==
        undefined
      ) {
        const value =
          Number(
            platformCommission
          );

        if (
          !Number.isFinite(value) ||
          value < 0 ||
          value > 100
        ) {
          return res.status(400).json({
            success: false,

            message:
              "Platform commission must be between 0 and 100",
          });
        }

        settings.platformCommission =
          value;
      }

      /* ===================================================
         BILLING TYPE
      =================================================== */

      if (
        billingType !==
        undefined
      ) {
        const normalizedBillingType =
          String(
            billingType
          )
            .trim()
            .toLowerCase();

        if (
          !BILLING_TYPES.includes(
            normalizedBillingType
          )
        ) {
          return res.status(400).json({
            success: false,

            message:
              "Billing type must be prepaid or postpaid",
          });
        }

        settings.billingType =
          normalizedBillingType;
      }

      /* ===================================================
         MINIMUM FARE
      =================================================== */

      if (
        minimumFare !==
        undefined
      ) {
        const value =
          Number(
            minimumFare
          );

        if (
          !Number.isFinite(value) ||
          value < 0
        ) {
          return res.status(400).json({
            success: false,

            message:
              "Minimum fare must be a valid non-negative number",
          });
        }

        settings.minimumFare =
          value;
      }

      /* ===================================================
         PAYMENT DUE DAYS
      =================================================== */

      if (
        paymentDueDays !==
        undefined
      ) {
        const value =
          Number(
            paymentDueDays
          );

        if (
          !Number.isInteger(value) ||
          value < 1
        ) {
          return res.status(400).json({
            success: false,

            message:
              "Payment due days must be a positive whole number",
          });
        }

        settings.paymentDueDays =
          value;
      }

      /* ===================================================
         ENSURE ACTIVE
      =================================================== */

      settings.isActive =
        true;

      /* ===================================================
         SAVE
      =================================================== */

      await settings.save();

      /* ===================================================
         DEACTIVATE OLD SETTINGS
      =================================================== */

      /*
        Prevent multiple active billing
        configurations.

        Older settings can remain in MongoDB
        for historical/reference purposes.
      */

      await BillingSettings.updateMany(
        {
          _id: {
            $ne:
              settings._id,
          },

          isActive: true,
        },

        {
          $set: {
            isActive: false,
          },
        }
      );

      return res.status(200).json({
        success: true,

        message:
          "Billing settings updated successfully",

        data: settings,
      });
    } catch (error) {
      console.error(
        "UPDATE BILLING SETTINGS ERROR:",
        error
      );

      if (
        error.name ===
        "ValidationError"
      ) {
        return res.status(400).json({
          success: false,
          message: error.message,
        });
      }

      return res.status(500).json({
        success: false,

        message:
          "Failed to update billing settings",
      });
    }
  };
