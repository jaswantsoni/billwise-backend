const fs = require('fs').promises;
const path = require('path');

const renderTemplate = (template, data) => {
  // Handle {{#key}}...{{/key}} blocks for arrays/conditionals
  let result = template.replace(/\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (match, key, content) => {
    if (!data[key]) return '';
    if (Array.isArray(data[key])) {
      return data[key].map(item => {
        return content.replace(/\{\{(\w+)\}\}/g, (m, prop) => item[prop] || '');
      }).join('');
    }
    return content;
  });
  // Handle {{key}} simple replacements
  result = result.replace(/\{\{(\w+)\}\}/g, (match, key) => data[key] || '');
  return result;
};

const loadTemplate = async (templateName) => {
  const templatePath = path.join(__dirname, 'templates', `${templateName}.html`);
  return await fs.readFile(templatePath, 'utf-8');
};

const emailTemplates = {
  welcome: async (data) => ({
    subject: `Welcome to ${data.appName || 'Billwise'}!`,
    html: renderTemplate(await loadTemplate('welcome'), {
      ...data,
      appName: data.appName || 'Billwise',
      dashboardUrl: data.dashboardUrl || process.env.FRONTEND_URL || 'http://localhost:3000',
      year: new Date().getFullYear(),
    }),
  }),

  emailVerification: async (data) => ({
    subject: 'Verify Your Email',
    html: renderTemplate(await loadTemplate('emailVerification'), data),
  }),

  paymentReminder: async (data) => ({
    subject: `Payment Reminder - Invoice ${data.invoiceNumber}`,
    html: renderTemplate(await loadTemplate('paymentReminder'), data),
  }),

  inventoryUpdate: async (data) => ({
    subject: 'Inventory Update Alert',
    html: renderTemplate(await loadTemplate('inventoryUpdate'), data),
  }),

  invoiceShare: async (data) => ({
    subject: `Invoice ${data.invoiceNumber} from ${data.organisationName}`,
    html: renderTemplate(await loadTemplate('invoiceShare'), data),
  }),
};

module.exports = emailTemplates;
