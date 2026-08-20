/* =========================================================
   PHONE.EMAIL VERIFICATION
========================================================= */

const normalizePhone = (
  countryCode,
  phoneNumber
) => {
  if (
    !phoneNumber
  ) {
    return null;
  }

  const rawPhone =
    String(
      phoneNumber
    )
      .trim()
      .replace(
        /[\s()-]/g,
        ""
      );

  /* =====================================================
     ALREADY E.164
  ===================================================== */

  if (
    /^\+\d{8,15}$/.test(
      rawPhone
    )
  ) {
    return rawPhone;
  }

  const phoneDigits =
    rawPhone.replace(
      /\D/g,
      ""
    );

  let country =
    String(
      countryCode ||
        ""
    )
      .trim()
      .replace(
        /[^\d+]/g,
        ""
      );

  if (
    country &&
    !country.startsWith(
      "+"
    )
  ) {
    country =
      `+${country}`;
  }

  if (
    country &&
    /^\+\d{1,4}$/.test(
      country
    )
  ) {
    return `${country}${phoneDigits}`;
  }

  if (
    phoneDigits.length ===
    10
  ) {
    return `+91${phoneDigits}`;
  }

  if (
    phoneDigits.length ===
      12 &&
    phoneDigits.startsWith(
      "91"
    )
  ) {
    return `+${phoneDigits}`;
  }

  return null;
};

/* =========================================================
   VALIDATE PHONE.EMAIL URL
========================================================= */

const isAllowedPhoneEmailUrl = (
  value
) => {
  try {
    const url =
      new URL(value);

    return (
      url.protocol ===
        "https:" &&
      url.hostname ===
        "user.phone.email"
    );
  } catch {
    return false;
  }
};

/* =========================================================
   VERIFY
========================================================= */

const verifyPhoneEmail =
  async (
    req,
    res,
    next
  ) => {
    try {
      const userJsonUrl =
        String(
          req.body
            ?.userJsonUrl ||
            ""
        ).trim();

      if (!userJsonUrl) {
        return res
          .status(401)
          .json({
            success:
              false,

            message:
              "Phone verification data missing",
          });
      }

      if (
        !isAllowedPhoneEmailUrl(
          userJsonUrl
        )
      ) {
        return res
          .status(400)
          .json({
            success:
              false,

            message:
              "Invalid Phone.Email verification URL",
          });
      }

      /* ===================================================
         TIMEOUT
      =================================================== */

      const controller =
        new AbortController();

      const timeout =
        setTimeout(
          () =>
            controller.abort(),
          10000
        );

      let response;

      try {
        response =
          await fetch(
            userJsonUrl,
            {
              method:
                "GET",

              headers: {
                Accept:
                  "application/json",
              },

              signal:
                controller.signal,
            }
          );
      } finally {
        clearTimeout(
          timeout
        );
      }

      if (
        !response.ok
      ) {
        return res
          .status(401)
          .json({
            success:
              false,

            message:
              "Phone verification failed",
          });
      }

      const data =
        await response.json();

      const phone =
        normalizePhone(
          data
            ?.user_country_code,

          data
            ?.user_phone_number
        );

      if (!phone) {
        return res
          .status(401)
          .json({
            success:
              false,

            message:
              "Verified phone number not found",
          });
      }

      req.verifiedIdentity =
        {
          provider:
            "phone.email",

          phone,
        };

      next();
    } catch (error) {
      console.error(
        "PHONE.EMAIL VERIFICATION ERROR:",
        error
      );

      if (
        error?.name ===
        "AbortError"
      ) {
        return res
          .status(504)
          .json({
            success:
              false,

            message:
              "Phone verification service timed out",
          });
      }

      return res
        .status(401)
        .json({
          success:
            false,

          message:
            "Phone verification failed",
        });
    }
  };

export default verifyPhoneEmail;
