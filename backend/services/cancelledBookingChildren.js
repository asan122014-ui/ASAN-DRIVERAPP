import Booking from "../models/Booking.js";
import Child from "../models/Child.js";

const ongoing = ["quoted", "awaiting_driver", "driver_searching", "driver_accepted", "awaiting_payment", "active"];

export async function removeCancelledBookingChildren(booking) {
  if (booking.status !== "cancelled") return [];
  const ids = [...new Set([booking.childId, ...(booking.childIds || [])].filter(Boolean).map(String))];
  if (!ids.length) return [];
  const otherBookings = await Booking.find({
    _id: { $ne: booking._id }, parentId: booking.parentId, status: { $in: ongoing },
    $or: [{ childId: { $in: ids } }, { childIds: { $in: ids } }],
  }).select("childId childIds").lean();
  const protectedIds = new Set(otherBookings.flatMap((item) => [item.childId, ...(item.childIds || [])]).filter(Boolean).map(String));
  const removable = ids.filter((id) => !protectedIds.has(id));
  if (!removable.length) return [];
  // A paid/activated profile must never be removed by an older cancelled request.
  const filter = { _id: { $in: removable }, parentId: booking.parentId, activeBookingId: null };
  const profiles = await Child.find(filter).select("_id").lean();
  const removedIds = profiles.map((item) => String(item._id));
  if (removedIds.length) await Child.deleteMany({ ...filter, _id: { $in: removedIds } });
  return removedIds;
}
