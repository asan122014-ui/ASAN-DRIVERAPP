import { Resend } from "resend";

/* =========================================================
   RESEND CLIENT
========================================================= */

const resendApiKey =
  process.env.RESEND_API_KEY;

if (!resendApiKey) {
  console.warn(
    "RESEND_API_KEY is not configured"
  );
}

const resend =
  new Resend(
    resendApiKey
  );

/* =========================================================
   EMAIL CONFIG
========================================================= */

const FROM_EMAIL =
  process.env.RESEND_FROM_EMAIL ||
  "ASANRIDES onboarding@resend.dev";

/* =========================================================
   HTML ESCAPE

   Prevent Driver-controlled values such as names or
   rejection reasons from injecting HTML into emails.
========================================================= */

const escapeHtml = (
  value
) => {
  return String(
    value ?? ""
  )
    .replace(
      /&/g,
      "&amp;"
    )
    .replace(
      /</g,
      "&lt;"
    )
    .replace(
      />/g,
      "&gt;"
    )
    .replace(
      /"/g,
      "&quot;"
    )
    .replace(
      /'/g,
      "&#039;"
    );
};

/* =========================================================
   SHARED OTP EMAIL TEMPLATE
========================================================= */

const buildOtpEmailTemplate = ({
  otp,
  accountType,
  actionText,
}) => {
  const safeOtp =
    escapeHtml(
      otp
    );

  const safeAccountType =
    escapeHtml(
      accountType
    );

  const safeActionText =
    escapeHtml(
      actionText
    );

  return `
    <!DOCTYPE html>

    <html>
      <head>
        <meta charset="UTF-8" />

        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0"
        />

        <title>
          ASANRIDES OTP
        </title>
      </head>

      <body
        style="
          margin:0;
          padding:0;
          background:#f5f5f5;
          font-family:Arial,Helvetica,sans-serif;
          color:#18181b;
        "
      >
        <table
          width="100%"
          cellpadding="0"
          cellspacing="0"
          role="presentation"
          style="
            width:100%;
            background:#f5f5f5;
            padding:32px 16px;
          "
        >
          <tr>
            <td align="center">

              <table
                width="100%"
                cellpadding="0"
                cellspacing="0"
                role="presentation"
                style="
                  max-width:520px;
                  background:#ffffff;
                  border-radius:18px;
                  overflow:hidden;
                  border:1px solid #e4e4e7;
                "
              >

                <tr>
                  <td
                    style="
                      padding:28px 28px 12px;
                      text-align:center;
                    "
                  >
                    <div
                      style="
                        font-size:24px;
                        font-weight:800;
                        letter-spacing:-0.5px;
                      "
                    >
                      ASAN<span
                        style="
                          color:#f2a900;
                        "
                      >
                        RIDES
                      </span>
                    </div>
                  </td>
                </tr>

                <tr>
                  <td
                    style="
                      padding:12px 28px 28px;
                    "
                  >

                    <h2
                      style="
                        margin:0 0 12px;
                        text-align:center;
                        font-size:22px;
                        line-height:1.3;
                      "
                    >
                      Email Verification
                    </h2>

                    <p
                      style="
                        margin:0;
                        text-align:center;
                        color:#71717a;
                        font-size:14px;
                        line-height:1.6;
                      "
                    >
                      Use the OTP below to
                      ${safeActionText}.
                    </p>

                    <div
                      style="
                        margin:28px 0;
                        padding:18px;
                        text-align:center;
                        background:#fff7db;
                        border:1px solid #fde68a;
                        border-radius:14px;
                      "
                    >

                      <div
                        style="
                          font-size:12px;
                          font-weight:700;
                          color:#a16207;
                          letter-spacing:1px;
                          text-transform:uppercase;
                          margin-bottom:8px;
                        "
                      >
                        Your OTP
                      </div>

                      <div
                        style="
                          font-size:34px;
                          font-weight:800;
                          letter-spacing:8px;
                          color:#18181b;
                        "
                      >
                        ${safeOtp}
                      </div>

                    </div>

                    <p
                      style="
                        margin:0;
                        text-align:center;
                        color:#71717a;
                        font-size:13px;
                        line-height:1.6;
                      "
                    >
                      This OTP expires in
                      <strong>
                        5 minutes
                      </strong>.
                    </p>

                    <p
                      style="
                        margin:14px 0 0;
                        text-align:center;
                        color:#71717a;
                        font-size:12px;
                        line-height:1.6;
                      "
                    >
                      Account type:
                      <strong>
                        ${safeAccountType}
                      </strong>
                    </p>

                    <p
                      style="
                        margin:14px 0 0;
                        text-align:center;
                        color:#a1a1aa;
                        font-size:12px;
                        line-height:1.6;
                      "
                    >
                      If you did not request this OTP,
                      you can safely ignore this email.
                    </p>

                  </td>
                </tr>

              </table>

            </td>
          </tr>
        </table>
      </body>
    </html>
  `;
};

/* =========================================================
   DRIVER REJECTION EMAIL TEMPLATE
========================================================= */

const buildDriverRejectionEmailTemplate = ({
  name,
  rejectionReason,
}) => {
  const safeName =
    escapeHtml(
      name ||
        "Driver"
    );

  const safeReason =
    escapeHtml(
      rejectionReason
    );

  return `
    <!DOCTYPE html>

    <html>
      <head>
        <meta charset="UTF-8" />

        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0"
        />

        <title>
          ASANRIDES Driver Application Update
        </title>
      </head>

      <body
        style="
          margin:0;
          padding:0;
          background:#f5f5f5;
          font-family:Arial,Helvetica,sans-serif;
          color:#18181b;
        "
      >

        <table
          width="100%"
          cellpadding="0"
          cellspacing="0"
          role="presentation"
          style="
            width:100%;
            background:#f5f5f5;
            padding:32px 16px;
          "
        >

          <tr>
            <td align="center">

              <table
                width="100%"
                cellpadding="0"
                cellspacing="0"
                role="presentation"
                style="
                  max-width:560px;
                  background:#ffffff;
                  border-radius:20px;
                  overflow:hidden;
                  border:1px solid #e4e4e7;
                "
              >

                <!-- BRAND -->

                <tr>
                  <td
                    style="
                      padding:30px 30px 12px;
                      text-align:center;
                    "
                  >

                    <div
                      style="
                        font-size:26px;
                        font-weight:800;
                        letter-spacing:-0.5px;
                      "
                    >
                      ASAN<span
                        style="
                          color:#f2a900;
                        "
                      >
                        RIDES
                      </span>
                    </div>

                    <div
                      style="
                        margin-top:6px;
                        color:#71717a;
                        font-size:12px;
                        font-weight:600;
                        letter-spacing:1px;
                        text-transform:uppercase;
                      "
                    >
                      Driver Verification
                    </div>

                  </td>
                </tr>

                <!-- CONTENT -->

                <tr>
                  <td
                    style="
                      padding:18px 30px 32px;
                    "
                  >

                    <div
                      style="
                        width:58px;
                        height:58px;
                        line-height:58px;
                        margin:0 auto 20px;
                        text-align:center;
                        border-radius:50%;
                        background:#fee2e2;
                        color:#dc2626;
                        font-size:28px;
                        font-weight:800;
                      "
                    >
                      ×
                    </div>

                    <h2
                      style="
                        margin:0;
                        text-align:center;
                        color:#18181b;
                        font-size:23px;
                        line-height:1.35;
                      "
                    >
                      Driver Application Rejected
                    </h2>

                    <p
                      style="
                        margin:20px 0 0;
                        color:#52525b;
                        font-size:14px;
                        line-height:1.7;
                      "
                    >
                      Hello
                      <strong>
                        ${safeName}
                      </strong>,
                    </p>

                    <p
                      style="
                        margin:12px 0 0;
                        color:#52525b;
                        font-size:14px;
                        line-height:1.7;
                      "
                    >
                      Your application to join
                      <strong>
                        ASANRIDES as a Driver
                      </strong>
                      has been reviewed.
                    </p>

                    <p
                      style="
                        margin:12px 0 0;
                        color:#52525b;
                        font-size:14px;
                        line-height:1.7;
                      "
                    >
                      Unfortunately, your current application
                      could not be approved.
                    </p>

                    <!-- REJECTION REASON -->

                    <div
                      style="
                        margin:24px 0;
                        padding:18px;
                        border-radius:14px;
                        background:#fef2f2;
                        border:1px solid #fecaca;
                      "
                    >

                      <div
                        style="
                          margin-bottom:8px;
                          color:#991b1b;
                          font-size:12px;
                          font-weight:800;
                          letter-spacing:0.8px;
                          text-transform:uppercase;
                        "
                      >
                        Rejection Reason
                      </div>

                      <div
                        style="
                          color:#7f1d1d;
                          font-size:14px;
                          line-height:1.7;
                          word-break:break-word;
                        "
                      >
                        ${safeReason}
                      </div>

                    </div>

                    <p
                      style="
                        margin:0;
                        color:#52525b;
                        font-size:14px;
                        line-height:1.7;
                      "
                    >
                      Your current Driver registration will be
                      closed after this review. You may return
                      to ASANRIDES and complete a new
                      registration after correcting the issue
                      mentioned above.
                    </p>

                    <div
                      style="
                        margin-top:26px;
                        padding-top:20px;
                        border-top:1px solid #e4e4e7;
                      "
                    >

                      <p
                        style="
                          margin:0;
                          text-align:center;
                          color:#a1a1aa;
                          font-size:12px;
                          line-height:1.6;
                        "
                      >
                        This is an automated notification from
                        ASANRIDES regarding your Driver
                        verification.
                      </p>

                    </div>

                  </td>
                </tr>

              </table>

            </td>
          </tr>

        </table>

      </body>
    </html>
  `;
};

/* =========================================================
   SHARED OTP SEND FUNCTION
========================================================= */

const sendOtpEmail =
  async ({
    email,
    otp,
    subject,
    accountType,
    actionText,
  }) => {
    /* =====================================================
       VALIDATION
    ===================================================== */

    if (!email) {
      throw new Error(
        "Recipient email is required"
      );
    }

    if (!otp) {
      throw new Error(
        "OTP is required"
      );
    }

    if (!resendApiKey) {
      throw new Error(
        "Resend is not configured"
      );
    }

    /* =====================================================
       SEND THROUGH RESEND
    ===================================================== */

    try {
      const {
        data,
        error,
      } =
        await resend.emails.send({
          from:
            FROM_EMAIL,

          to: [
            email,
          ],

          subject,

          html:
            buildOtpEmailTemplate({
              otp,
              accountType,
              actionText,
            }),
        });

      if (error) {
        console.error(
          "RESEND EMAIL ERROR:",
          error
        );

        throw new Error(
          error.message ||
            "Failed to send OTP email"
        );
      }

      return data;
    } catch (
      error
    ) {
      console.error(
        "SEND OTP EMAIL ERROR:",
        error
      );

      throw error;
    }
  };

/* =========================================================
   SEND PARENT OTP EMAIL
========================================================= */

export const sendParentOtpEmail =
  async ({
    email,
    otp,
    purpose,
  }) => {
    /* =====================================================
       PURPOSE
    ===================================================== */

    if (
      ![
        "login",
        "register",
      ].includes(
        purpose
      )
    ) {
      throw new Error(
        "Invalid Parent OTP purpose"
      );
    }

    const isRegister =
      purpose ===
      "register";

    /* =====================================================
       EMAIL DETAILS
    ===================================================== */

    const subject =
      isRegister
        ? "Verify your ASANRIDES Parent account"
        : "Your ASANRIDES Parent sign-in OTP";

    const actionText =
      isRegister
        ? "complete your Parent account registration"
        : "sign in to your Parent account";

    /* =====================================================
       SEND
    ===================================================== */

    return sendOtpEmail({
      email,
      otp,
      subject,

      accountType:
        "Parent",

      actionText,
    });
  };

/* =========================================================
   SEND DRIVER OTP EMAIL
========================================================= */

export const sendDriverOtpEmail =
  async ({
    email,
    otp,
    purpose,
  }) => {
    /* =====================================================
       PURPOSE
    ===================================================== */

    if (
      ![
        "login",
        "register",
      ].includes(
        purpose
      )
    ) {
      throw new Error(
        "Invalid Driver OTP purpose"
      );
    }

    const isRegister =
      purpose ===
      "register";

    /* =====================================================
       EMAIL DETAILS
    ===================================================== */

    const subject =
      isRegister
        ? "Verify your ASANRIDES Driver account"
        : "Your ASANRIDES Driver sign-in OTP";

    const actionText =
      isRegister
        ? "verify your email and complete your Driver registration"
        : "sign in to your Driver account";

    /* =====================================================
       SEND
    ===================================================== */

    return sendOtpEmail({
      email,
      otp,
      subject,

      accountType:
        "Driver",

      actionText,
    });
  };

/* =========================================================
   SEND DRIVER REJECTION EMAIL
========================================================= */

export const sendDriverRejectionEmail =
  async ({
    email,
    name,
    rejectionReason,
  }) => {
    /* =====================================================
       NORMALIZE
    ===================================================== */

    const normalizedEmail =
      String(
        email ||
          ""
      )
        .trim()
        .toLowerCase();

    const normalizedName =
      String(
        name ||
          "Driver"
      ).trim();

    const normalizedReason =
      String(
        rejectionReason ||
          ""
      ).trim();

    /* =====================================================
       VALIDATION
    ===================================================== */

    if (
      !normalizedEmail
    ) {
      throw new Error(
        "Driver email is required"
      );
    }

    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        normalizedEmail
      )
    ) {
      throw new Error(
        "Driver email is invalid"
      );
    }

    if (
      !normalizedReason
    ) {
      throw new Error(
        "Driver rejection reason is required"
      );
    }

    if (
      normalizedReason.length >
      500
    ) {
      throw new Error(
        "Driver rejection reason must not exceed 500 characters"
      );
    }

    if (
      !resendApiKey
    ) {
      throw new Error(
        "Resend is not configured"
      );
    }

    /* =====================================================
       SEND THROUGH RESEND
    ===================================================== */

    try {
      const {
        data,
        error,
      } =
        await resend.emails.send({
          from:
            FROM_EMAIL,

          to: [
            normalizedEmail,
          ],

          subject:
            "Update on your ASANRIDES Driver application",

          html:
            buildDriverRejectionEmailTemplate({
              name:
                normalizedName,

              rejectionReason:
                normalizedReason,
            }),
        });

      if (
        error
      ) {
        console.error(
          "RESEND DRIVER REJECTION EMAIL ERROR:",
          error
        );

        throw new Error(
          error.message ||
            "Failed to send Driver rejection email"
        );
      }

      console.log(
        `Driver rejection email sent to ${normalizedEmail}`
      );

      return data;
    } catch (
      error
    ) {
      console.error(
        "SEND DRIVER REJECTION EMAIL ERROR:",
        error
      );

      throw error;
    }
  };
