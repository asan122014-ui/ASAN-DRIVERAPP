export const normalizeCredential = (value) => String(value || "").replace(/[\s-]/g, "").toUpperCase();
export const validOtp = (value) => /^\d{6}$/.test(String(value || ""));
export function registrationErrors(values) {
  const errors = {};
  const name = String(values.name || "").trim();
  if (!name) errors.name = "Enter your full name.";
  else if (name.length < 2 || name.length > 100 || !/^[\p{L}\p{M}][\p{L}\p{M} '\u2019.-]*$/u.test(name)) errors.name = "Enter a name using letters and spaces, without numbers.";
  if (!/^[6-9]\d{9}$/.test(String(values.phone || ""))) errors.phone = "Enter a valid 10-digit Indian mobile number.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(values.email || "").trim()) || String(values.email || "").length > 254) errors.email = "Enter a valid email address, such as captain@example.com.";
  const license = normalizeCredential(values.licenseNumber);
  if (!/^(?=.*[A-Z])(?=.*\d)[A-Z0-9]{8,20}$/.test(license)) errors.licenseNumber = "Enter a license number with letters and numbers (8–20 characters).";
  const vehicle = normalizeCredential(values.vehicleNumber);
  if (!/^(?:[A-Z]{2}\d{1,2}[A-Z]{0,3}\d{4}|\d{2}BH\d{4}[A-Z]{1,2})$/.test(vehicle)) errors.vehicleNumber = "Enter a valid vehicle number, such as TS09AB1234.";
  if (!["auto", "van"].includes(String(values.vehicleType || "").trim().toLowerCase())) errors.vehicleType = "Select Auto or Van.";
  const model = String(values.vehicleModel || "").trim();
  if (model && (model.length > 100 || !/^[\p{L}\p{M}\d][\p{L}\p{M}\d .()/'-]*$/u.test(model))) errors.vehicleModel = "Enter a vehicle model using letters or numbers (maximum 100 characters).";
  return errors;
}
export function uploadError(file) {
  if (!file) return "Upload this required image.";
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) return "Use a JPG, PNG or WEBP image.";
  if (!file.size) return "This image is empty. Choose another image.";
  if (file.size > 10 * 1024 * 1024) return "Choose an image of 10 MB or less.";
  return "";
}
