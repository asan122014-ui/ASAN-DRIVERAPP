# Razorpay booking payments

The backend uses Razorpay test mode when `RAZORPAY_KEY_ID` starts with `rzp_test_`. Set both values in Render's backend environment settings:

```
RAZORPAY_KEY_ID=<Razorpay Key ID>
RAZORPAY_KEY_SECRET=<Razorpay Key Secret>
```

The Key Secret belongs only on the backend. Locally, `backend/.env` is ignored by Git. The parent app receives the public Key ID from the authenticated order response and opens Razorpay Standard Checkout. The parent pays the full monthly price; the driver notification displays the distance charge only. This integration does not transfer funds to drivers.

The existing authenticated booking endpoints are `POST /api/booking-payments/:id/order`, `POST /api/booking-payments/:id/verify`, and `GET /api/booking-payments/:id/status`. Order creation rejects prices under 100 paise and recalculates the amount from the booking. Verification checks the HMAC signature using the stored order ID, then checks Razorpay's order and captured payment amount before activating the monthly service. A status check can recover after a missed browser callback.

Set Razorpay's payment capture setting to automatic. Test with a fresh booking in test mode: successful payment, invalid signature, failed payment, modal dismissal, delayed capture, page refresh, and a repeated verification. Existing unpaid Cashfree attempts should be reviewed before switching providers. Replace test credentials with live credentials in Render only after the test flow passes.

Official guide: https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/integration-steps/
