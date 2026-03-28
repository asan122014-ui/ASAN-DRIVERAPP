import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export const sendEmail = async (to, subject, html) => {
  try {
    await resend.emails.send({
      from: "ASAN <onboarding@resend.dev>",
      to,
      subject,
      html
    });
  } catch (error) {
    console.error("Email error:", error);
  }
};
