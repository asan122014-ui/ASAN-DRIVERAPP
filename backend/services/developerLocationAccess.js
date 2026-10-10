export function canWaiveLocationCharge(parent) {
  return String(parent?.email || "").trim().toLowerCase() === "bhattagiri.neeharika@gmail.com";
}

export function validLocationAccessCode(parent, code) {
  return canWaiveLocationCharge(parent) && String(code || "").trim() === "Asanrides0";
}
