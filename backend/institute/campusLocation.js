export function validCampusLocation(location) {
  return !!location && typeof location.lat === 'number' && typeof location.lng === 'number' &&
    Number.isFinite(location.lat) && Number.isFinite(location.lng) &&
    Math.abs(location.lat) <= 90 && Math.abs(location.lng) <= 180 &&
    typeof location.address === 'string' && location.address.trim().length > 0 && location.address.length <= 1000;
}
