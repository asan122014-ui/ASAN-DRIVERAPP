import test from "node:test";
import assert from "node:assert/strict";
import axios from "axios";
import { getTrafficRoute } from "../services/googleRouteService.js";

const pickup = { lat: 17.385, lng: 78.4867 };
const dropoff = { lat: 17.44, lng: 78.38 };

test("route estimate uses traffic-aware Google Routes API and parses distance and duration", async () => {
  const originalPost = axios.post;
  const previousKey = process.env.GOOGLE_MAPS_SERVER_KEY;
  process.env.GOOGLE_MAPS_SERVER_KEY = "test-server-key";
  let request;
  axios.post = async (...args) => {
    request = args;
    return { data: { routes: [{ distanceMeters: 12345, duration: "1800s" }] } };
  };
  try {
    const route = await getTrafficRoute(pickup, dropoff);
    assert.deepEqual(route, { distanceMeters: 12345, distanceKm: 12.345, durationMinutes: 30, trafficAware: true });
    assert.equal(request[0], "https://routes.googleapis.com/directions/v2:computeRoutes");
    assert.equal(request[1].routingPreference, "TRAFFIC_AWARE");
    assert.equal(request[2].headers["X-Goog-Api-Key"], "test-server-key");
    assert.equal(request[2].headers["X-Goog-FieldMask"], "routes.distanceMeters,routes.duration");
  } finally {
    axios.post = originalPost;
    if (previousKey === undefined) delete process.env.GOOGLE_MAPS_SERVER_KEY;
    else process.env.GOOGLE_MAPS_SERVER_KEY = previousKey;
  }
});

test("route estimate rejects invalid coordinates before calling Google", async () => {
  const originalPost = axios.post;
  axios.post = async () => assert.fail("Google API should not be called for invalid coordinates");
  try {
    await assert.rejects(getTrafficRoute({ lat: 95, lng: 0 }, dropoff), { code: "INVALID_ROUTE_COORDINATES" });
  } finally {
    axios.post = originalPost;
  }
});

test("route estimate requires a dedicated server key instead of a browser key", async () => {
  const previousServerKey = process.env.GOOGLE_MAPS_SERVER_KEY;
  const previousApiKey = process.env.GOOGLE_MAPS_API_KEY;
  delete process.env.GOOGLE_MAPS_SERVER_KEY;
  process.env.GOOGLE_MAPS_API_KEY = "website-restricted-key";
  try {
    await assert.rejects(getTrafficRoute(pickup, dropoff), {
      code: "MAPS_ROUTE_UNAVAILABLE",
      publicMessage: "A server-restricted Google Maps key is missing. Set GOOGLE_MAPS_SERVER_KEY in Render; the website key cannot be used by the backend.",
    });
  } finally {
    if (previousServerKey === undefined) delete process.env.GOOGLE_MAPS_SERVER_KEY;
    else process.env.GOOGLE_MAPS_SERVER_KEY = previousServerKey;
    if (previousApiKey === undefined) delete process.env.GOOGLE_MAPS_API_KEY;
    else process.env.GOOGLE_MAPS_API_KEY = previousApiKey;
  }
});

test("route estimate explains when Google rejects the server key or API access", async () => {
  const originalPost = axios.post;
  const originalConsoleError = console.error;
  const previousKey = process.env.GOOGLE_MAPS_SERVER_KEY;
  process.env.GOOGLE_MAPS_SERVER_KEY = "test-server-key";
  console.error = () => {};
  axios.post = async () => {
    const error = new Error("Request failed with status code 403");
    error.response = { status: 403, data: { error: { message: "API key not authorized" } } };
    throw error;
  };
  try {
    await assert.rejects(getTrafficRoute(pickup, dropoff), {
      code: "MAPS_ROUTE_UNAVAILABLE",
      publicMessage: "Google Maps denied the route request. Enable Routes API and billing, then allow Routes API for the server key in Render.",
    });
  } finally {
    axios.post = originalPost;
    console.error = originalConsoleError;
    if (previousKey === undefined) delete process.env.GOOGLE_MAPS_SERVER_KEY;
    else process.env.GOOGLE_MAPS_SERVER_KEY = previousKey;
  }
});
