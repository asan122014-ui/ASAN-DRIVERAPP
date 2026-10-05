# Cashfree phase 3 setup

Use sandbox first. Put these values in Render environment settings, never in Git or frontend configuration:

```
CASHFREE_ENV=sandbox
CASHFREE_APP_ID=<sandbox App ID>
CASHFREE_SECRET_KEY=<sandbox Secret Key>
PARENT_APP_URL=https://parent.asanrides.com
PUBLIC_API_URL=https://asan-driverapp.onrender.com
```

Confirm the actual parent origin before configuring it. No trailing `/api` in PUBLIC_API_URL.

In Cashfree, whitelist the parent website domain and configure payment success, failure and user dropped webhooks to:

`https://asan-driverapp.onrender.com/api/booking-payments/webhook`

The webhook must reach this endpoint without login or redirects. It verifies the raw body HMAC and then fetches the Cashfree order and payment attempts before activation. The return page is `/booking-payment/:bookingId`; refreshing or returning from Cashfree verifies the order on the server.

MongoDB must support transactions (Atlas replica sets do). A verified payment updates the booking, receipt, child linkage and notifications in one transaction. Repeated callbacks do not extend the service or duplicate notifications. Driver acceptance alone no longer links new children to the driver.

Service starts when payment is verified and runs for one calendar month, clamping month-end dates. The preferred start date remains informational for this phase. An expiry worker ends the booking and removes only its child linkage. Three-day reminders and renewal checkout remain a later phase.

Pending payment attempts are checked before a new checkout is offered. Expired/terminated orders receive a new order ID; network retries reuse the same stored order and idempotency key. The accepted price must agree with server calculation (26 working days) or checkout is blocked for review.

Run sandbox acceptance checks before production: successful payment, failed payment, closing checkout, delayed webhook, duplicate webhook, wrong signature, wrong amount/currency, concurrent clicks, return-page refresh, and expiry. Existing phase-2 bookings which already linked a child before payment need review; the new activation rule applies prospectively and does not remove legacy driver relationships.

Production requires approved Cashfree merchant credentials, the whitelisted production domain, and production webhook configuration. Sandbox orders cannot be paid using production configuration; use a new booking when changing environments.

Official references:
- https://www.cashfree.com/docs/payments/online/web/redirect
- https://www.cashfree.com/docs/payments/online/webhooks/signature-verification
