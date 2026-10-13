export function assertAdminOfferAllowed(request, booking, driver) {
  const fail = (message, status = 409) => { const error = new Error(message); error.statusCode = status; throw error; };
  if (!request || !booking) fail("Booking request not found", 404);
  if (request.requestType !== "new_driver" || booking.driverChoice !== "new") fail("This request was sent through an ASAN ID and cannot be reassigned by admin");
  if (request.status !== "Pending" || !["driver_searching", "awaiting_driver"].includes(booking.status)) fail("This booking is no longer waiting for a driver");
  if (request.matchingStatus === "Offered") fail("A driver is already reviewing this request");
  if (!driver || driver.status !== "approved") fail("Choose an approved driver", 400);
  if ((request.rejectedDriverIds || []).includes(driver.driverId)) fail("This driver declined the request. Choose another driver", 400);
}
