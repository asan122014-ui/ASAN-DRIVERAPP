import axios from "axios";

const API = axios.create({
  baseURL: "https://asan-driverapp.onrender.com/api/auth",
});

export const signupDriver = (data) =>
  API.post("/signup", data);

export const loginDriver = (data) =>
  API.post("/login", data);
