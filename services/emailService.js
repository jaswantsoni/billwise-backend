const nodemailer = require('nodemailer');
const emailTemplates = require('./emailTemplates');

const getTransporter = (fromEmail) => {
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtpout.secureserver.net',
    port: parseInt(process.env.EMAIL_PORT || '465'),
    secure: true,
    auth: {
      user: fromEmail,
      pass: process.env.EMAIL_PASSWORD,
    },
  });
};

const emailSenders = {
  support: process.env.EMAIL_SUPPORT || 'support@manavly.com',
  noreply: process.env.EMAIL_NO_REPLY || 'no-reply@manavly.com',
  info: process.env.EMAIL_INFO || 'info@manavly.com',
};

async function sendEmail({ to, subject, html, text, from = emailSenders.support, attachments = [] }) {
  const transporter = getTransporter(from);
  return await transporter.sendMail({
    from: `"${process.env.EMAIL_FROM_NAME || 'Billwise'}" <${from}>`,
    to,
    subject,
    text,
    html,
    attachments,
  });
}

async function sendTemplateEmail(to, template, data) {
  const { subject, html } = await emailTemplates[template](data);
  
  const automatedTemplates = ['welcome', 'emailVerification', 'paymentReminder', 'inventoryUpdate'];
  const from = automatedTemplates.includes(template) 
    ? emailSenders.noreply 
    : emailSenders.support;
  
  return await sendEmail({ to, subject, html, from, attachments: data.attachments });
}

module.exports = {
  sendEmail,
  sendTemplateEmail,
  emailSenders,
};
