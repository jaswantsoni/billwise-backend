const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

exports.sendCreditNoteEmail = async (creditNote, customer, organisation, userEmail) => {
  const mailOptions = {
    from: `${process.env.EMAIL_FROM_NAME} <${process.env.EMAIL_NO_REPLY}>`,
    to: customer.email,
    cc: userEmail,
    subject: `Credit Note ${creditNote.noteNumber} - ${organisation.name}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1976d2;">Credit Note Issued</h2>
        <p>Dear ${customer.name},</p>
        <p>A credit note has been issued against your invoice.</p>
        
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr style="background-color: #f5f5f5;">
            <td style="padding: 10px; border: 1px solid #ddd;"><strong>Credit Note Number</strong></td>
            <td style="padding: 10px; border: 1px solid #ddd;">${creditNote.noteNumber}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd;"><strong>Date</strong></td>
            <td style="padding: 10px; border: 1px solid #ddd;">${new Date(creditNote.issueDate).toLocaleDateString()}</td>
          </tr>
          <tr style="background-color: #f5f5f5;">
            <td style="padding: 10px; border: 1px solid #ddd;"><strong>Original Invoice</strong></td>
            <td style="padding: 10px; border: 1px solid #ddd;">${creditNote.invoice.invoiceNumber}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd;"><strong>Credit Amount</strong></td>
            <td style="padding: 10px; border: 1px solid #ddd; color: #4caf50; font-weight: bold;">₹${creditNote.totalAmount.toFixed(2)}</td>
          </tr>
          ${creditNote.reason ? `<tr style="background-color: #f5f5f5;">
            <td style="padding: 10px; border: 1px solid #ddd;"><strong>Reason</strong></td>
            <td style="padding: 10px; border: 1px solid #ddd;">${creditNote.reason}</td>
          </tr>` : ''}
        </table>

        <p>This credit amount will be adjusted against your invoice balance.</p>
        
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;">
        <p style="color: #666; font-size: 12px;">
          <strong>${organisation.name}</strong><br>
          ${organisation.address}<br>
          ${organisation.city}, ${organisation.state} - ${organisation.pincode}<br>
          Phone: ${organisation.phone} | Email: ${organisation.email}
        </p>
      </div>
    `
  };

  await transporter.sendMail(mailOptions);
};

exports.sendDebitNoteEmail = async (debitNote, customer, organisation, userEmail) => {
  const mailOptions = {
    from: `${process.env.EMAIL_FROM_NAME} <${process.env.EMAIL_NO_REPLY}>`,
    to: customer.email,
    cc: userEmail,
    subject: `Debit Note ${debitNote.noteNumber} - ${organisation.name}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #f44336;">Debit Note Issued</h2>
        <p>Dear ${customer.name},</p>
        <p>A debit note has been issued against your invoice.</p>
        
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr style="background-color: #f5f5f5;">
            <td style="padding: 10px; border: 1px solid #ddd;"><strong>Debit Note Number</strong></td>
            <td style="padding: 10px; border: 1px solid #ddd;">${debitNote.noteNumber}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd;"><strong>Date</strong></td>
            <td style="padding: 10px; border: 1px solid #ddd;">${new Date(debitNote.issueDate).toLocaleDateString()}</td>
          </tr>
          <tr style="background-color: #f5f5f5;">
            <td style="padding: 10px; border: 1px solid #ddd;"><strong>Original Invoice</strong></td>
            <td style="padding: 10px; border: 1px solid #ddd;">${debitNote.invoice.invoiceNumber}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd;"><strong>Additional Amount</strong></td>
            <td style="padding: 10px; border: 1px solid #ddd; color: #f44336; font-weight: bold;">₹${debitNote.totalAmount.toFixed(2)}</td>
          </tr>
          ${debitNote.reason ? `<tr style="background-color: #f5f5f5;">
            <td style="padding: 10px; border: 1px solid #ddd;"><strong>Reason</strong></td>
            <td style="padding: 10px; border: 1px solid #ddd;">${debitNote.reason}</td>
          </tr>` : ''}
        </table>

        <p>This amount will be added to your invoice balance.</p>
        
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;">
        <p style="color: #666; font-size: 12px;">
          <strong>${organisation.name}</strong><br>
          ${organisation.address}<br>
          ${organisation.city}, ${organisation.state} - ${organisation.pincode}<br>
          Phone: ${organisation.phone} | Email: ${organisation.email}
        </p>
      </div>
    `
  };

  await transporter.sendMail(mailOptions);
};
