const mongoose = require('mongoose');

const invoicePaymentLogSchema = new mongoose.Schema({
  invoiceNumber:     { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice', required: true },
  paidBy:            { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
  amountPaid:        { type: Number, required: true },
  paymentMode:       { type: String, enum: ['Advance', 'Partial', 'Full', 'Excess'], default: 'Partial' },
  outstandingBefore: { type: Number, default: 0 },
  outstandingAfter:  { type: Number, default: 0 },
  remarks:           { type: String, default: '' },
  editReason:        { type: String, default: '' },
  createdBy:         { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedBy:         { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('InvoicePaymentLog', invoicePaymentLogSchema);
