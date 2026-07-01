const NotificationLog = require('../features/settings/models/NotificationLog');

module.exports = {
  sendMail: async ({ to, subject, text, type = 'General' }) => {
    try {
      console.log(`\n📧 [EMAIL DISPATCH] To: ${to || 'N/A'} | Subject: ${subject}`);
      console.log(`Message: ${text}\n`);
      await NotificationLog.create({
        recipient: to || 'sys@kuppai.erp',
        subject,
        message: text,
        type
      });
      return true;
    } catch (err) {
      console.error('Email dispatch error:', err.message);
      return false;
    }
  }
};
