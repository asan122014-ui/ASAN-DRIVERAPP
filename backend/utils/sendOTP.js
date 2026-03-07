import twilio from "twilio";
import dotenv from "dotenv";

dotenv.config();

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

/*
  Send OTP to mobile number
*/

export const sendOtp = async (phone, otp) => {

  try {

    if (!phone || !otp) {
      throw new Error("Phone number or OTP missing");
    }

    // normalize phone number
    const formattedPhone = phone.startsWith("+")
      ? phone
      : `+91${phone}`;

    const message = await client.messages.create({
      body: `Your ASAN verification code is ${otp}. Do not share this code.`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: formattedPhone
    });

    console.log("OTP Sent:", message.sid);

    return true;

  } catch (error) {

    console.error("OTP Send Error:", error.message);

    return false;

  }

};
