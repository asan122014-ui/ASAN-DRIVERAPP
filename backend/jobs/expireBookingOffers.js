import DriverRequest from "../models/DriverRequest.js";
import { dispatchNextOfferBatch } from "../services/bookingMatchingService.js";

let timer = null;
let running = false;

export const startBookingOfferExpiryWorker = (io) => {
  if (timer) return;
  timer = setInterval(async () => {
    if (running) return;
    running = true;
    try {
      const expired = await DriverRequest.find({
        status: "Pending",
        matchingStatus: "Offered",
        offerExpiresAt: { $lte: new Date() },
      }).select("_id requestType parentId").limit(50);
      for (const request of expired) {
        try {
          if (request.requestType === "existing_driver") {
            await DriverRequest.updateOne(
              { _id: request._id, status: "Pending", matchingStatus: "Offered", offerExpiresAt: { $lte: new Date() } },
              { $set: { offerExpiresAt: null } }
            );
          } else {
            await dispatchNextOfferBatch({ requestId: request._id, io });
          }
        } catch (error) {
          console.error("BOOKING OFFER EXPIRY ERROR", request._id, error.message);
        }
      }
    } catch (error) {
      console.error("BOOKING OFFER WORKER ERROR", error.message);
    } finally {
      running = false;
    }
  }, 30 * 1000);
  timer.unref?.();
};
