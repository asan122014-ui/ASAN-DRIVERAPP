import BillingSettings from "../models/BillingSettings.js";

/* ================= GET BILLING SETTINGS ================= */
export const getBillingSettings = async (req, res) => {
  try {
    let settings = await BillingSettings.findOne();

    // Create default settings if none exist
    if (!settings) {
      settings = await BillingSettings.create({
        ratePerKm: 3,
        platformCommission: 2,
        billingType: "postpaid",
        minimumFare: 50,
        paymentDueDays: 5,
      });
    }

    return res.status(200).json({
      success: true,
      data: settings,
    });
  } catch (error) {
    console.error("Get Billing Settings Error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/* ================= UPDATE BILLING SETTINGS ================= */
export const updateBillingSettings = async (req, res) => {
  try {
    const {
      ratePerKm,
      platformCommission,
      billingType,
      minimumFare,
      paymentDueDays,
    } = req.body;

    let settings = await BillingSettings.findOne();

    if (!settings) {
      settings = new BillingSettings();
    }

    settings.ratePerKm = ratePerKm;
    settings.platformCommission = platformCommission;
    settings.billingType = billingType;
    settings.minimumFare = minimumFare;
    settings.paymentDueDays = paymentDueDays;

    await settings.save();

    return res.status(200).json({
      success: true,
      message: "Billing settings updated successfully",
      data: settings,
    });
  } catch (error) {
    console.error("Update Billing Settings Error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
