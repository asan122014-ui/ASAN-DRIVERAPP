/*
  Calculate distance between two coordinates
  using the Haversine Formula
  Returns distance in kilometers
*/

export const calculateDistance = (lat1, lon1, lat2, lon2) => {

  if (
    lat1 == null ||
    lon1 == null ||
    lat2 == null ||
    lon2 == null
  ) {
    throw new Error("Invalid coordinates provided");
  }

  const toRad = (value) => (value * Math.PI) / 180;

  const R = 6371; // Earth radius in KM

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // distance in KM
};
