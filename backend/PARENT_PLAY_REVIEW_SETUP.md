# Parent Google Play review login

Normal parent accounts continue using emailed OTPs. Review login is disabled
unless the environment enables it for an explicitly marked, active test account
with matching database ID and email. The reusable code is checked using its
SHA-256 digest; login endpoints retain their existing rate limiter. Registration
does not accept a reusable review code.

The administrator confirmed bhattagiri.neeharika@gmail.com and ALL linked child,
address, booking and payment records are fictional test data. From the backend,
run `node scripts/prepareParentPlayReview.js` to audit that account. Use
`--activate` only after confirmation of fictional records to mark the existing
active test parent. This script does not create an account or alter linked data.

Configure these values on the hosted backend:

- `PLAY_REVIEW_PARENT_ENABLED=true`
- `PLAY_REVIEW_PARENT_EMAIL`: the confirmed test parent email
- `PLAY_REVIEW_PARENT_ID`: the database ID returned by the provisioning script
- `PLAY_REVIEW_PARENT_CODE_SHA256`: SHA-256 hex digest of a random six-digit code

Keep the actual code private and give it to Google Play in App access. Never
commit the code or an environment file. In the parent app, enter the review email,
request a code, then enter the supplied reusable six-digit code. No inbox access
is needed. Check two sign-ins and an incorrect-code rejection on the deployed
release before completing the Play Console declaration.

To disable new review logins, set `PLAY_REVIEW_PARENT_ENABLED=false` and restart.
Previously issued sessions retain their normal expiration.
