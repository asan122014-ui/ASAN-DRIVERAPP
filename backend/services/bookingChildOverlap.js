const normalized = (value) => String(value || "").normalize("NFKC").trim().replace(/\s+/gu, " ").toLocaleLowerCase("en-IN");

// Booking snapshots use the child's name and school, including legacy single-child bookings.
export function overlappingBookingChildren(children, bookings) {
  const key = (child) => JSON.stringify([normalized(child.name), normalized(child.school)]);
  const booked = new Set(bookings.flatMap((booking) =>
    booking.children?.length ? booking.children : booking.child ? [booking.child] : []
  ).map(key));
  return children.filter((child) => booked.has(key(child)));
}
