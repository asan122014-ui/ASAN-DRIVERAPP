# Combined Cloudinary and Cloudflare R2 storage

Cloudinary continues to store profile photos and serve existing uploads. New driver documents, Institute enrollment documents, trip verification photos and payout proof images use R2 when all four settings below are configured.

## Render environment

- `R2_ACCOUNT_ID`: Cloudflare account ID (32 hexadecimal characters).
- `R2_BUCKET_NAME`: private R2 Standard bucket name.
- `R2_ACCESS_KEY_ID`: S3 access key from an R2 API token.
- `R2_SECRET_ACCESS_KEY`: corresponding secret, entered only in Render's secrets.

The endpoint is generated as `https://<account-id>.r2.cloudflarestorage.com`; region is `auto`. Restrict the token's Object Read & Write permission to this bucket. Do not enable public bucket access. Existing Cloudinary settings are still required.

With no R2 settings, uploads continue using Cloudinary. A partial configuration fails new uploads rather than silently storing documents elsewhere. Invalid credentials also fail the affected upload; profile photos still use Cloudinary when the configuration is complete.

## Stored data and access

MongoDB stores a provider-prefixed reference (`r2://asan/...`) instead of an expiring URL. Authorized API responses resolve file fields to one-hour signed read links without modifying the stored reference. Reload data to renew expired links. Existing route ownership and role checks remain responsible for selecting which records a caller can access; the serializer does not provide an independent file-listing endpoint. Institute document endpoints retain their existing role and institute checks.

R2 uploads are decoded, auto-rotated, resized inside 2400 by 2400 pixels without enlargement, converted to JPEG quality 88, and written without public ACLs. Requests retain the existing 10 MB per-image limits. Files must remain legible after compression.

Failed-upload cleanup and expired verification-photo cleanup dispatch to the correct provider. Payout proof viewing streams from the matching provider. Real-time trip payloads resolve private image links before delivery.

## Rollout verification

Run `node --test tests/r2Storage.test.js tests/instituteEnrollment.test.js tests/instituteTrips.test.js tests/driverPayoutSchedule.test.js`.

After deployment, use a clearly identified test account to upload a non-personal sample document and verification image, open each from its authorized account, and confirm expiry/cleanup. Confirm a profile image still lands in Cloudinary and an existing Cloudinary document still opens. Local tests mock storage requests; they do not prove the production token's permissions.

There is no automatic migration or deletion of existing Cloudinary files. Keep R2 settings available once records contain R2 references. Disabling R2 after rollout prevents those private files being opened until the configuration is restored.
