# Admin activity emails and monthly report

Recipients: saiakshith1415@gmail.com and abhilash.kgrc@gmail.com. Uses the existing RESEND_API_KEY and verified notifications@asanrides.com sender.

Business database inserts, relevant updates, replacements and deletions are monitored using an Atlas database change stream. This includes writes from apps, Institute, admin, background jobs and payment callbacks, including committed transactions and bulk imports. Collection coverage is explicit in services/adminActivityPolicy.js. Existing website submission emails remain unchanged. Passwords, OTPs, sessions, tokens, raw documents and signed URLs are never copied. GPS/read receipts/token rotation and page visits are excluded.

Alerts identify entity, action, record ID, time and available safe fields. Actor IDs are present for AdminLog events. Deletes have record IDs only unless an independent admin log identifies the actor/name. Update snapshots reflect the current record when fetched, not guaranteed before/after values. Each changed record can produce an email; a workflow touching several collections can produce several related alerts.

The MongoDB outbox survives restarts, claims jobs with leases, deduplicates change replay, uses Resend idempotency keys and retries transient failures up to ten attempts within 23 hours. Provider acceptance is recorded as sent; this does not prove inbox delivery. Failed jobs remain saved for investigation. Resend limits and quotas still apply. Resume failures are logged and are not silently reset, to avoid hidden monitoring gaps. Atlas must grant database changeStream/read permissions. A replica set is required (Atlas supports it).

The completed month's PDF is queued after 00:05 IST on the first day of the next month. A persisted month cursor catches up after restarts. The initial month is marked with partial monitoring coverage. The report includes business event counts, new retained records per category, regular production booking revenue excluding coupons, coupon activations and current pending items. Revenue is not a financial ledger: refunds, removed payment records, institute invoices and driver payouts are not summed as regular booking income. Pending totals describe report-generation time, not a historical month-end snapshot.

Collections: admin_activity_events (audit summaries), admin_email_outbox (delivery state), admin_email_state (resume/month cursors). These do not contain credentials. Set ADMIN_ACTIVITY_EMAILS_ENABLED=false to disable both new monitoring and report delivery. No parent/driver Android rebuild is required.

Validation: node --test tests/adminActivityEmails.test.js tests/websiteEnquiryEmail.test.js. This uses synthetic data and does not email real recipients. Production acceptance requires observing a real business action in the stream, a queued email, provider acceptance and recipient delivery; a future month boundary cannot be confirmed by local tests alone.
