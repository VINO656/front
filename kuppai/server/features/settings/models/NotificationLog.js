const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  recipient: String,
  subject: String,
  message: String,
  type: { type: String, enum: ['Onboarding', 'PasswordChange', 'InvoiceApproval', 'Alert', 'YieldAlert', 'General'], default: 'General' },
  status: { type: String, default: 'Sent' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('NotificationLog', notificationSchema);
