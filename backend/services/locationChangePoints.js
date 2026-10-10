const point = (value) => {
  const address = String(value?.address || "").trim();
  const lat = Number(value?.lat), lng = Number(value?.lng);
  if (!address || address.length > 500 || value?.lat == null || value?.lng == null || !Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180) {
    const error = new Error("Select a valid location on the map.");
    error.status = 400;
    throw error;
  }
  return { address, coordinates: { lat, lng } };
};

export function locationChangePoints(type, body, child) {
  const home = type === "both" ? point(body?.home) : type === "home" ? point(body) : null;
  const school = type === "both" ? point(body?.school) : type === "school" ? point(body) : null;
  if (!home && !school) throw new Error("Invalid location change type.");
  return {
    pickup: home?.coordinates || child.location,
    dropoff: school?.coordinates || child.dropLocationCoords,
    proposedAddress: (home || school).address,
    proposedCoordinates: (home || school).coordinates,
    proposedSchoolAddress: type === "both" ? school.address : "",
    proposedSchoolCoordinates: type === "both" ? school.coordinates : undefined,
  };
}
