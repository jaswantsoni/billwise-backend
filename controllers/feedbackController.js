const { sendEmail } = require('../services/emailService');

const COMPLAINT_CATEGORIES = [
  'Invoice Generation',
  'PDF Download',
  'Product Management',
  'Customer Management',
  'GST Calculation',
  'Login / Authentication',
  'Billing / Subscription',
  'Performance / Speed',
  'Data Not Saving',
  'Other',
];

exports.submitFeedback = async (req, res) => {
  try {
    const { type, rating, category, section, message, userEmail, userName } = req.body;

    if (!type || !message) {
      return res.status(400).json({ error: 'Type and message are required' });
    }

    const typeLabels = { feedback: '⭐ Feedback', complaint: '🚨 Complaint', suggestion: '💡 Suggestion', bug: '🐛 Bug Report' };
    const typeLabel = typeLabels[type] || type;
    const stars = rating ? '★'.repeat(rating) + '☆'.repeat(5 - rating) : null;

    const subject = `[BillWise ${typeLabel}] ${category || type} — from ${userName || userEmail || 'Anonymous'}`;

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;border:1px solid #e5e7eb;border-radius:8px;">
        <div style="background:#1e293b;color:#fff;padding:16px 20px;border-radius:6px 6px 0 0;margin:-20px -20px 20px;">
          <h2 style="margin:0;font-size:18px;">BillWise — ${typeLabel}</h2>
        </div>

        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <tr><td style="padding:8px 0;color:#6b7280;width:140px;">Type</td><td style="padding:8px 0;font-weight:600;">${typeLabel}</td></tr>
          ${stars ? `<tr><td style="padding:8px 0;color:#6b7280;">Rating</td><td style="padding:8px 0;font-size:18px;color:#f59e0b;">${stars} (${rating}/5)</td></tr>` : ''}
          ${category ? `<tr><td style="padding:8px 0;color:#6b7280;">Category</td><td style="padding:8px 0;">${category}</td></tr>` : ''}
          ${section ? `<tr><td style="padding:8px 0;color:#6b7280;">Section / Page</td><td style="padding:8px 0;">${section}</td></tr>` : ''}
          ${userName ? `<tr><td style="padding:8px 0;color:#6b7280;">User Name</td><td style="padding:8px 0;">${userName}</td></tr>` : ''}
          ${userEmail ? `<tr><td style="padding:8px 0;color:#6b7280;">User Email</td><td style="padding:8px 0;"><a href="mailto:${userEmail}">${userEmail}</a></td></tr>` : ''}
        </table>

        <div style="margin-top:16px;padding:16px;background:#f8fafc;border-radius:6px;border-left:4px solid #2563eb;">
          <p style="margin:0 0 6px;color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Message</p>
          <p style="margin:0;font-size:14px;line-height:1.6;white-space:pre-wrap;">${message}</p>
        </div>

        <p style="margin-top:20px;font-size:11px;color:#9ca3af;text-align:center;">Sent from BillWise app · ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST</p>
      </div>
    `;

    await sendEmail({
      to: 'jaswantsoni1812@gmail.com',
      subject,
      html,
    });

    res.json({ success: true, message: 'Thank you! Your feedback has been submitted.' });
  } catch (err) {
    console.error('[Feedback]', err.message);
    res.status(500).json({ error: 'Failed to send feedback. Please try again.' });
  }
};

exports.getCategories = (req, res) => {
  res.json({ categories: COMPLAINT_CATEGORIES });
};
