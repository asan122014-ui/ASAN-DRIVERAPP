import {razorpayClient} from '../services/razorpayService.js';
import {enrollmentError} from './enrollmentPolicy.js';

async function readCheckout(orderId) {
  const client=razorpayClient();
  const [order,response]=await Promise.all([client.orders.fetch(orderId),client.orders.fetchPayments(orderId)]);
  return {order,payments:response.items};
}

// An abandoned checkout is not a payment. Only cancel after confirming that
// the gateway has neither received money nor authorized a payment.
export async function assertInvoiceCanCancel(invoice,{now=new Date(),readOrder=readCheckout}={}) {
  if (invoice.razorpayOrderLockExpiresAt && new Date(invoice.razorpayOrderLockExpiresAt)>now) throw enrollmentError('A payment checkout is being prepared. Close checkout and retry deletion in a few minutes.',409);
  if (!invoice.razorpayOrderId) {
    if(invoice.status==='Processing') throw enrollmentError('Payment verification is still processing. Refresh the payment status before deleting.',409);
    return;
  }
  let checkout;
  try {checkout=await readOrder(invoice.razorpayOrderId);} catch {throw enrollmentError('Unable to verify the pending checkout with Razorpay. No account was deleted. Please retry shortly.',503);}
  const {order,payments}=checkout || {};
  if(order?.id!==invoice.razorpayOrderId || !['created','attempted','paid'].includes(order.status) || !Array.isArray(payments) || payments.some(payment=>payment.order_id!==order.id)) throw enrollmentError('The pending checkout could not be verified. No account was deleted. Please contact ASAN support.',409);
  if(order.status==='paid' || Number(order.amount_paid)>0 || payments.some(payment=>['authorized','captured'].includes(payment.status))) throw enrollmentError('Razorpay reports a payment received or still processing. Verify its payment status before deleting this account.',409);
}
