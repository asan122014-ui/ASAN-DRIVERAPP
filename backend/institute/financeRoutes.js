import express from 'express';
import Institute from './models/Institute.js';
import Child from '../models/Child.js';
import Invoice from '../models/Invoice.js';
import { ensureInstituteFeeInvoices } from './fixedFees.js';
const router = express.Router();
router.get('/', async (req, res) => {
  try {
    const institute = await Institute.findOne({ name: req.user.instituteName }).select('_id').lean();
    if (!institute) return res.status(404).json({ message: 'Institute not found.' });
    await ensureInstituteFeeInvoices({ instituteId: institute._id });
    const page = Math.max(1, Math.min(10000, Number.parseInt(req.query.page, 10) || 1));
    const filter = { instituteId: institute._id, billingSource: 'institute_fixed' };
    const rowsFilter = req.query.view === 'receipts' ? { ...filter, status: 'Paid', paymentStatus: 'Success' } : filter;
    const [invoices, total, fees, totals] = await Promise.all([
      Invoice.find(rowsFilter).select('invoiceNumber childId parentId month routeName totalAmount status paymentStatus paymentMethod paidAt dueDate razorpayPaymentId waivedAmount')
        .populate('childId', 'name').populate('parentId', 'name').sort({ createdAt: -1, _id: -1 }).skip((page - 1) * 50).limit(50).lean(),
      Invoice.countDocuments(rowsFilter),
      Child.find({ instituteId: institute._id, accountSource: 'institute' }).select('name parentId monthlyTransportFee assignedRouteName driverId').populate('parentId', 'name').sort({ name: 1 }).lean(),
      Invoice.aggregate([{ $match: filter }, { $group: { _id: null, collected: { $sum: { $cond: [{ $and: [{ $eq: ['$status', 'Paid'] }, { $eq: ['$paymentStatus', 'Success'] }] }, '$totalAmount', 0] } }, outstanding: { $sum: { $cond: [{ $in: ['$status', ['Pending', 'Overdue', 'Processing']] }, '$totalAmount', 0] } }, overdue: { $sum: { $cond: [{ $and: [{ $in: ['$status', ['Pending', 'Overdue', 'Processing']] }, { $lt: ['$dueDate', new Date()] }] }, '$totalAmount', 0] } } } } ]),
    ]);
    res.json({ invoices, fees, summary: totals[0] || { collected: 0, outstanding: 0, overdue: 0 }, total, page, pages: Math.ceil(total / 50) });
  } catch (error) { console.error('Institute finance lookup failed:', error.name); res.status(503).json({ message: 'Unable to load payment records. Please retry.' }); }
});
export default router;
