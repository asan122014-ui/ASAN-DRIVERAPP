# Institute integration

Mounted at `/api/institute` on the existing ASAN Render service. Uses the existing Mongoose connection (`MONGO_URI`); no second Mongo connection or HTTP listener is created.

## Storage

- `institutes`: organization registrations
- `institute_users`: existing Institute staff accounts, preserving IDs and password hashes
- `institute_records`: institute-scoped operational data
- `institute_demo_enquiries`: public demo requests

Parents, drivers, children and legacy students remain in their existing canonical collections. Institute rows reference them via `coreLink`, rather than copying authentication, approvals, bookings or payment records. Parent/driver matching requires exact normalized email AND phone. Student matching requires an explicitly linked parent, exact child name and exact institute/school name; ambiguous matches remain unlinked. Canonical contact details are read fresh for linked records. A row without a matching app account remains an Institute-only operational record; it is not an approved app account.

Operational actions (assignment, route stops, telemetry, reminders and emergency records) now save to the shared database with institute scoping and optimistic concurrency in transactions, instead of `data/store.json`.

## Migration

`node institute/migrate.js --source-env PATH --target-env PATH` previews counts and conflicts. Add `--apply` to copy. Source uses MONGODB_URI; target uses MONGO_URI. Secrets are never printed. Copy preserves IDs, refuses mismatching target IDs and never deletes source data. Keep the source database until cutover is verified. Run only once before new writes begin on the target; reruns deliberately reject conflicting edited rows.

## Sessions and permissions

Staff must sign in again after cutover. Signatures are domain-separated from app/admin JWTs, using INSTITUTE_SESSION_SECRET or existing JWT_SECRET. The private organization code is not listed publicly. Institute membership cannot be changed by posting a new name, existing organizations cannot be claimed by another admin signup, and Viewers cannot write via direct API calls.

## Existing prototype limits

The original payment endpoint simulated a successful payment without a gateway. That simulation is not enabled on the shared backend and returns 409, preventing false paid records. The existing ASAN payment routes remain unchanged. Institute reminders and emergency actions save records only; they do not claim to send SMS/WhatsApp or dispatch emergency services. This integration does not implement a new payment checkout or send notifications.

INSTITUTE_APP_URL defaults to https://asan-rides-institute.vercel.app and is used for password-reset links. Existing RESEND_API_KEY and PASSWORD_RESET_FROM_EMAIL can be used by password recovery.
