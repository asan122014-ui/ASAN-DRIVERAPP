import axios from "axios";

const validCoordinates = (point) => Number.isFinite(point.lat) && Number.isFinite(point.lng);
const validMapPoint = (point) => validCoordinates(point) && Math.abs(point.lat) <= 90 && Math.abs(point.lng) <= 180;

export async function getTrafficRoute(pickup, dropoff) {
  if (!validMapPoint(pickup) || !validMapPoint(dropoff)) {
    const error = new Error("Valid pickup and school map coordinates are required");
    error.code = "INVALID_ROUTE_COORDINATES";
    throw error;
  }
  // This endpoint is called by the backend. Never fall back to GOOGLE_MAPS_API_KEY,
  // which is commonly configured as a browser/referrer-restricted key.
  const key = process.env.GOOGLE_MAPS_SERVER_KEY;
  if (!key) {
    const error = new Error("Server-side Google Maps route calculation is not configured");
    error.code = "MAPS_ROUTE_UNAVAILABLE";
    error.publicMessage = "A server-restricted Google Maps key is missing. Set GOOGLE_MAPS_SERVER_KEY in Render; the website key cannot be used by the backend.";
    throw error;
  }

  let response;
  try {
    response = await axios.post("https://routes.googleapis.com/directions/v2:computeRoutes", {
      origin: { location: { latLng: { latitude: pickup.lat, longitude: pickup.lng } } },
      destination: { location: { latLng: { latitude: dropoff.lat, longitude: dropoff.lng } } },
      travelMode: "DRIVE",
      routingPreference: "TRAFFIC_AWARE",
      computeAlternativeRoutes: false,
      languageCode: "en-US",
      units: "METRIC",
    }, {
      timeout: 10000,
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": "routes.distanceMeters,routes.duration",
      },
    });
  } catch (cause) {
    const googleStatus = cause.response?.status;
    const googleMessage = cause.response?.data?.error?.message;
    console.error("GOOGLE ROUTES API ERROR", JSON.stringify({ status: googleStatus || "network_error", message: googleMessage || cause.message }));
    const error = new Error("Google Maps route lookup failed", { cause });
    error.code = "MAPS_ROUTE_UNAVAILABLE";
    if (googleStatus === 401 || googleStatus === 403) {
      error.publicMessage = "Google Maps denied the route request. Enable Routes API and billing, then allow Routes API for the server key in Render.";
    } else if (googleStatus === 429) {
      error.publicMessage = "Google Maps route quota is exhausted. Check the Routes API quota and billing.";
    }
    throw error;
  }

  const route = response.data?.routes?.[0];
  const distanceMeters = Number(route?.distanceMeters);
  const durationSeconds = Number.parseFloat(route?.duration);
  if (!Number.isFinite(distanceMeters) || distanceMeters <= 0 || !Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    console.error("GOOGLE ROUTES API EMPTY ROUTE", JSON.stringify({ routeCount: response.data?.routes?.length || 0 }));
    const error = new Error("Google Maps returned no drivable route for the selected locations");
    error.code = "MAPS_ROUTE_UNAVAILABLE";
    error.publicMessage = "Google Maps could not find a driving route between these locations. Check the selected map pins.";
    throw error;
  }
  return { distanceMeters, distanceKm: distanceMeters / 1000, durationMinutes: Math.max(1, Math.round(durationSeconds / 60)), trafficAware: true };
}
