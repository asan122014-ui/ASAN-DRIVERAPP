import { Resend } from "resend";
import dotenv from "dotenv";

dotenv.config();

const resend = new Resend(process.env.RESEND_API_KEY);

export const sendEmail = async (to, subject, html) => {
  try {
    const data = await resend.emails.send({
      from: "ASAN <onboarding@resend.dev>", // later replace with your domain
      to: [to],
      subject,
      html,
    });

    console.log("✅ Email sent:", data);
  } catch (error) {
    console.error("❌ Resend error:", error);
  }
};
