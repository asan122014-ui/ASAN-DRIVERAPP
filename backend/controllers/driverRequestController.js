import DriverRequest from "../models/DriverRequest.js";

export const createRequest = async (req, res) => {
  try {
    const { parentId, childId } = req.body;

    const request = await DriverRequest.create({
      parentId,
      childId,
    });

    res.status(201).json({
      success: true,
      message: "Request submitted successfully",
      data: request,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
