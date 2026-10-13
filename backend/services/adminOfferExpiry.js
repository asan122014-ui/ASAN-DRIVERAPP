import DriverRequest from "../models/DriverRequest.js";

export const ADMIN_OFFER_DURATION_MS = 60 * 60 * 1000;
export const adminOfferDeadline = (now = new Date()) => new Date(now.getTime() + ADMIN_OFFER_DURATION_MS);
export const delayedOfferUpdate = {
  matchingStatus: "Searching", currentOfferDriverIds: [], offerExpiresAt: null,
  rejectionReason: "The selected driver did not respond within one hour. Please assign another driver.",
};

export async function expireAdminOffers(io) {
  const now = new Date();
  // Apply the same deadline to outstanding offers created before this change.
  await DriverRequest.updateMany({ status: "Pending", requestType: "new_driver", matchingStatus: "Offered", offerExpiresAt: null }, [
    { $set: { offerExpiresAt: { $add: ["$updatedAt", ADMIN_OFFER_DURATION_MS] } } },
  ]);
  const expired = await DriverRequest.find({ status: "Pending", requestType: "new_driver", matchingStatus: "Offered", offerExpiresAt: { $lte: now } }).select("_id bookingId").limit(100);
  for (const request of expired) {
    const result = await DriverRequest.updateOne({ _id: request._id, status: "Pending", matchingStatus: "Offered", offerExpiresAt: { $lte: now } }, [
      { $set: { ...delayedOfferUpdate, delayedDriverIds: { $setUnion: [{ $ifNull: ["$delayedDriverIds", []] }, "$currentOfferDriverIds"] } } },
    ]);
    if (result.modifiedCount) io?.to("admin").emit("booking_matching_exhausted", { requestId: String(request._id), bookingId: String(request.bookingId) });
  }
}
