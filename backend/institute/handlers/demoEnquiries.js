import DemoEnquiry from '../models/DemoEnquiry.js';

export function validateDemoEnquiry(body) {
  const fields = [
    ['schoolName', 'School name', 200],
    ['contactName', 'Your name', 120],
    ['email', 'Email address', 254],
    ['phone', 'Phone number', 30],
    ['message', 'Message', 3000]
  ];
  const enquiry = {};
  for (const [key, label, limit] of fields) {
    if (typeof body?.[key] !== 'string' || !body[key].trim()) {
      throw new Error(`${label} is required.`);
    }
    enquiry[key] = body[key].trim();
    if (enquiry[key].length > limit) throw new Error(`${label} must be ${limit} characters or fewer.`);
  }
  enquiry.email = enquiry.email.toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(enquiry.email)) throw new Error('Enter a valid email address.');
  const digits = enquiry.phone.replace(/\D/g, '');
  if (!/^[+\d\s().-]+$/.test(enquiry.phone) || digits.length < 7 || digits.length > 15) {
    throw new Error('Enter a valid phone number.');
  }
  return enquiry;
}

export function createDemoEnquiryHandler(model = DemoEnquiry) {
  return async (req, res) => {
    let enquiry;
    try {
      enquiry = validateDemoEnquiry(req.body);
    } catch (error) {
      return res.status(400).json({ message: error.message });
    }
    try {
      // Send only validated fields to MongoDB; visitors cannot set status/source.
      const saved = await model.create(enquiry);
      return res.status(201).json({
        id: String(saved._id),
        message: 'Your demo request has been received. Our team will contact you shortly.'
      });
    } catch (error) {
      console.error('Unable to save demo enquiry:', error.name);
      return res.status(503).json({ message: 'We could not save your enquiry right now. Please try again shortly.' });
    }
  };
}
