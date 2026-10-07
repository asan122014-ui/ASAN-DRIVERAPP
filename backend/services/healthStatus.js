export function getHealthStatus(databaseReadyState) {
  const databaseReady = databaseReadyState === 1;

  return {
    httpStatus: databaseReady ? 200 : 503,
    body: {
      success: databaseReady,
      status: databaseReady ? "OK" : "DEGRADED",
      database: databaseReady ? "connected" : "disconnected",
      time: new Date(),
    },
  };
}
