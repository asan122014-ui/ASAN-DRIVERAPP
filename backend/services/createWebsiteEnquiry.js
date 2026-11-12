import WebsiteEnquiry from '../models/WebsiteEnquiry.js';
import { websiteEnquiryEmail } from './websiteEnquiryEmail.js';
import { wakeWebsiteEnquiryEmailWorker } from '../jobs/deliverWebsiteEnquiryEmails.js';

export async function createWebsiteEnquiry(payload, Model = WebsiteEnquiry, wake = wakeWebsiteEnquiryEmailWorker) {
  const enquiry = new Model(payload);
  const now = new Date();
  enquiry.emailNotification = {
    status: 'pending', availableAt: now, deadlineAt: new Date(now.getTime() + 12 * 60 * 60 * 1000),
    message: websiteEnquiryEmail(enquiry, now),
  };
  // One durable write saves both the enquiry and its pending notification.
  await enquiry.save();
  try { wake(); } catch { /* The polling worker will pick up the saved notification. */ }
  return enquiry;
}
