export function assertCheckoutCanBeWaived(payment, order, attempts = []) {
  if (!payment) return;
  const fail = (message) => { const error = new Error(message); error.status = 409; throw error; };
  if (payment.provider !== "razorpay" || !payment.orderId?.startsWith("order_")) fail("Checkout is being prepared. Wait a moment and retry the coupon.");
  if (["PAID", "REFUNDING", "REFUNDED", "REFUND_FAILED"].includes(payment.status) || payment.paymentId || payment.paidAt) fail("A payment or refund already exists. Check payment status before using a coupon.");
  if (!order || order.id !== payment.orderId) fail("Unable to verify checkout. Please retry.");
  if (order.status === "paid" || Number(order.amount_paid || 0) > 0 || attempts.some((item) => ["authorized", "captured"].includes(item.status))) fail("Payment is processing or already paid. Check payment status before applying the coupon.");
}
