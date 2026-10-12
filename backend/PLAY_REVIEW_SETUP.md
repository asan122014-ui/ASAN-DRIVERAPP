# Google Play review access

The login feature is disabled by default. Normal drivers still use emailed OTPs.
Both login endpoints retain their existing rate limiters. Registration does not
accept the reusable code. No review code is embedded in the app or source.

1. The admin confirmed the test account email saiakshith1415@gmail.com and phone
   9493680383. Set PLAY_REVIEW_CONVERT_CONFIRMED_TEST_ACCOUNT=true only for that
   confirmed test account. Conversion refuses existing linked families/bookings;
   those must be checked for synthetic data before proceeding. Other existing
   regular accounts are never converted.
2. Set MONGO_URI, PLAY_REVIEW_EMAIL and PLAY_REVIEW_PHONE in the backend environment.
   Run `node scripts/createPlayReviewAccount.js` from the backend directory.
   This creates a new account or safely marks the confirmed unlinked test account.
3. Generate a random six-digit review code privately and store its SHA-256 hex
   digest as PLAY_REVIEW_CODE_SHA256. Do not commit the code or environment file.
4. Set PLAY_REVIEW_DRIVER_ID to the ID printed by the provisioning script, and
   PLAY_REVIEW_ENABLED=true. Deploy/restart the backend with these settings.
5. Populate only synthetic family/booking data through the admin workflow;
   never assign real families, accept real booking requests or set up real payouts
   for this review account. Sample journeys still need to be provisioned and tested.
6. Test Request OTP → enter reusable review code → dashboard on the release app.
   Verify a normal account cannot use that code and verify all review features.
7. Build a signed AAB with versionCode 4 (or higher if already used), using the
   existing upload key. Upload to the internal testing track.

Only after the live test succeeds, give Play Console the email and reusable code
and these instructions: Open Asanrides Captain, select Login, enter the review
email and request a code, then enter the supplied reusable review code. No inbox
access is required. Do not claim sample rides are available until provisioned.

To revoke access, set PLAY_REVIEW_ENABLED=false and restart the backend.
This disables the reusable login code; previously issued JWTs keep their normal
expiry unless the review driver is removed or authentication is separately revoked.
