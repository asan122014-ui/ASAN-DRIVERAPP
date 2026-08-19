import admin from "firebase-admin";

/* =========================================================
   DRIVER FIREBASE SERVICE ACCOUNT
========================================================= */

const driverServiceAccount =
  {
    projectId:
      process.env
        .FIREBASE_PROJECT_ID,

    clientEmail:
      process.env
        .FIREBASE_CLIENT_EMAIL,

    privateKey:
      process.env
        .FIREBASE_PRIVATE_KEY
        ? process.env
            .FIREBASE_PRIVATE_KEY
            .replace(
              /\\n/g,
              "\n"
            )
        : undefined,
  };

/* =========================================================
   PARENT FIREBASE SERVICE ACCOUNT
========================================================= */

const parentServiceAccount =
  {
    projectId:
      process.env
        .PARENT_FIREBASE_PROJECT_ID,

    clientEmail:
      process.env
        .PARENT_FIREBASE_CLIENT_EMAIL,

    privateKey:
      process.env
        .PARENT_FIREBASE_PRIVATE_KEY
        ? process.env
            .PARENT_FIREBASE_PRIVATE_KEY
            .replace(
              /\\n/g,
              "\n"
            )
        : undefined,
  };

/* =========================================================
   VALIDATE FIREBASE SERVICE ACCOUNT
========================================================= */

const validateServiceAccount =
  (
    serviceAccount,
    name
  ) => {
    const missing =
      [];

    if (
      !serviceAccount
        .projectId
    ) {
      missing.push(
        "projectId"
      );
    }

    if (
      !serviceAccount
        .clientEmail
    ) {
      missing.push(
        "clientEmail"
      );
    }

    if (
      !serviceAccount
        .privateKey
    ) {
      missing.push(
        "privateKey"
      );
    }

    if (
      missing.length >
      0
    ) {
      throw new Error(
        `${name} Firebase configuration missing: ${missing.join(
          ", "
        )}`
      );
    }
  };

/* =========================================================
   GET OR CREATE FIREBASE APP
========================================================= */

const getOrCreateFirebaseApp =
  (
    name,
    serviceAccount
  ) => {
    const existingApp =
      admin.apps.find(
        (
          app
        ) =>
          app.name ===
          name
      );

    if (
      existingApp
    ) {
      return existingApp;
    }

    validateServiceAccount(
      serviceAccount,
      name
    );

    return admin.initializeApp(
      {
        credential:
          admin.credential.cert(
            serviceAccount
          ),
      },

      name
    );
  };

/* =========================================================
   DRIVER FIREBASE
========================================================= */

let driverApp =
  null;

try {
  driverApp =
    getOrCreateFirebaseApp(
      "driver",
      driverServiceAccount
    );

  console.log(
    "🔥 Driver Firebase Initialized"
  );

  console.log(
    "🔥 Driver Firebase Project:",
    driverServiceAccount
      .projectId
  );
} catch (
  error
) {
  console.error(
    "❌ Driver Firebase Init Error:",
    error.message
  );
}

/* =========================================================
   PARENT FIREBASE
========================================================= */

let parentApp =
  null;

try {
  parentApp =
    getOrCreateFirebaseApp(
      "parent",
      parentServiceAccount
    );

  console.log(
    "🔥 Parent Firebase Initialized"
  );

  /*
    Safe debugging information.
    This DOES NOT expose secrets.
  */

  console.log(
    "🔥 Parent Firebase Project:",
    parentServiceAccount
      .projectId
  );
} catch (
  error
) {
  console.error(
    "❌ Parent Firebase Init Error:",
    error.message
  );
}

/* =========================================================
   FIREBASE MESSAGING
========================================================= */

export const driverMessaging =
  driverApp
    ? admin.messaging(
        driverApp
      )
    : null;

export const parentMessaging =
  parentApp
    ? admin.messaging(
        parentApp
      )
    : null;

/* =========================================================
   FIREBASE AUTH
========================================================= */

/*
  Parent Firebase authentication.

  Used by:

  verifyFirebaseToken.js

  parentAuth.verifyIdToken(...)
*/

export const parentAuth =
  parentApp
    ? admin.auth(
        parentApp
      )
    : null;

/*
  Driver Firebase Auth.

  This does NOT replace your existing
  Driver JWT authentication.
*/

export const driverAuth =
  driverApp
    ? admin.auth(
        driverApp
      )
    : null;

/* =========================================================
   FIREBASE APPS
========================================================= */

export {
  driverApp,
  parentApp,
};

/* =========================================================
   DEFAULT EXPORT
========================================================= */

export default admin;
