export const enquiryEmailRecipients = ['saiakshith1415@gmail.com', 'abhilash.kgrc@gmail.com'];
export const enquiryEmailSender = 'ASAN Rides <notifications@asanrides.com>';
const escape = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));

export function websiteEnquiryEmail(enquiry, submittedAt = new Date()) {
  const type = enquiry.type === 'parent' ? 'Parent' : 'Driver';
  const transport = value => ({ auto: 'Auto', van: 'Van', either: 'Auto or van' }[value] || String(value || 'Not provided'));
  const rows = [
    ['Enquiry ID', String(enquiry._id)], ['Submitted', submittedAt.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) + ' IST'],
    ['Name', enquiry.name], ['Phone', enquiry.phone], ['Area', enquiry.area],
    ...(enquiry.type === 'parent' ? [
      ['School', enquiry.school], ['Pickup location', enquiry.pickupLocation], ['Drop-off location', enquiry.dropLocation], ['Preferred transport', transport(enquiry.preferredTransport)],
    ] : [
      ['Vehicle type', transport(enquiry.vehicleType)], ['Vehicle number', enquiry.vehicleNumber], ['Driving experience', `${enquiry.experience} years`],
    ]),
  ];
  return {
    from: enquiryEmailSender, to: [...enquiryEmailRecipients], subject: `New ${type.toLowerCase()} website enquiry | ASAN Rides`,
    text: `New ${type.toLowerCase()} website enquiry\n\n${rows.map(([label, value]) => `${label}: ${value || 'Not provided'}`).join('\n')}\n\nThis enquiry has been saved in ASAN Rides. Contact the person using the phone number above.`,
    html: `<!doctype html><html lang="en"><body style="margin:0;background:#f8f7f3;color:#222;font-family:Arial,sans-serif"><table role="presentation" style="width:100%;max-width:640px;margin:24px auto;background:#fff;border:1px solid #e9e2d4;border-radius:16px"><tr><td style="padding:24px;background:#ffca28"><strong>ASAN RIDES</strong><h1 style="font-size:24px;margin:12px 0 0">New ${type.toLowerCase()} enquiry</h1></td></tr><tr><td style="padding:24px"><p>A new enquiry was submitted through the ASAN Rides website.</p><table style="width:100%;border-collapse:collapse">${rows.map(([label, value]) => `<tr><th scope="row" style="padding:12px 8px;text-align:left;vertical-align:top;border-bottom:1px solid #eee;font-size:13px">${escape(label)}</th><td style="padding:12px 8px;border-bottom:1px solid #eee;font-size:14px;overflow-wrap:anywhere">${escape(value || 'Not provided')}</td></tr>`).join('')}</table><p style="font-size:12px;color:#666;margin-top:24px">This enquiry has been saved in ASAN Rides. Contact the person using the phone number above.</p></td></tr></table></body></html>`,
  };
}

export async function sendWebsiteEnquiryEmail(message, idempotencyKey, { fetchEmail = fetch, apiKey = process.env.RESEND_API_KEY } = {}) {
  if (!apiKey) throw Object.assign(new Error('EMAIL_NOT_CONFIGURED'), { retryable: true });
  const response = await fetchEmail('https://api.resend.com/emails', {
    method: 'POST', signal: AbortSignal.timeout(20000),
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
    body: JSON.stringify(message),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(`EMAIL_HTTP_${response.status}`), { retryable: response.status === 408 || response.status === 429 || response.status >= 500 || (response.status === 409 && result.name === 'concurrent_idempotent_requests') });
  if (!result.id) throw Object.assign(new Error('EMAIL_ACCEPTANCE_NOT_CONFIRMED'), { retryable: true });
  return result.id;
}
