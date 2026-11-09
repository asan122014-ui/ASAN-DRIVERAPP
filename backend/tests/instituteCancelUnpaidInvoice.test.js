import test from 'node:test';
import assert from 'node:assert/strict';
import {assertInvoiceCanCancel} from '../institute/cancelUnpaidInvoice.js';
const invoice={status:'Pending',razorpayOrderId:'order_demo'};
const snapshot=(status='created',payments=[])=>async()=>({order:{id:'order_demo',status,amount_paid:0},payments});
test('unpaid and failed or abandoned checkouts do not prevent deletion',async()=>{
 await assertInvoiceCanCancel({status:'Pending'});
 await assertInvoiceCanCancel(invoice,{readOrder:snapshot()});
 await assertInvoiceCanCancel(invoice,{readOrder:snapshot('attempted',[{order_id:'order_demo',status:'failed'}])});
 await assertInvoiceCanCancel({...invoice,razorpayOrderLockExpiresAt:new Date('2020-01-01')},{readOrder:snapshot()});
});
test('active checkout creation, authorized and captured payments remain protected',async()=>{
 await assert.rejects(assertInvoiceCanCancel({...invoice,razorpayOrderLockExpiresAt:new Date('2099-01-01')}),{status:409});
 for(const status of ['authorized','captured'])await assert.rejects(assertInvoiceCanCancel(invoice,{readOrder:snapshot('attempted',[{order_id:'order_demo',status}])}),{status:409});
 await assert.rejects(assertInvoiceCanCancel(invoice,{readOrder:snapshot('paid')}),{status:409});
});
test('failed or mismatched verification cannot silently delete an account',async()=>{
 await assert.rejects(assertInvoiceCanCancel(invoice,{readOrder:async()=>{throw new Error('offline');}}),{status:503});
 await assert.rejects(assertInvoiceCanCancel(invoice,{readOrder:async()=>({order:{id:'wrong',status:'created'},payments:[]})}),{status:409});
});
