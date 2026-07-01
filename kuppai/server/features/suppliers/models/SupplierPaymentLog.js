const mongoose = require('mongoose');

const supplierPaymentLogSchema = new mongoose.Schema({
  supplierId:        { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', required: true },
  deliveryId:        { type: mongoose.Schema.Types.ObjectId, ref: 'Purchase' },
  amountPaid:        { type: Number, required: true },
  paymentMode:       { type: String, enum: ['Advance', 'Partial', 'Full'], default: 'Partial' },
  outstandingBefore: { type: Number, default: 0 },
  outstandingAfter:  { type: Number, default: 0 },
  remarks:           { type: String, default: '' },
  editReason:        { type: String, default: '' },
  createdBy:         { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedBy:         { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('SupplierPaymentLog', supplierPaymentLogSchema);
