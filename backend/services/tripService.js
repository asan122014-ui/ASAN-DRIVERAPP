/* ================= NOTIFICATION HELPER ================= */
const notifyDriver = async (
  driverId,
  {
    notificationKey,
    childId = null,
    event,
    payload,
    priority = "medium",
    io,
  }
) => {
  await sendNotification({
    driverId,
    childId,
    notificationKey,
    priority,
    io,
  });

  // Only emit the custom event with payload
  if (io) {
    io.to(String(driverId)).emit(event, payload);
  }
};
