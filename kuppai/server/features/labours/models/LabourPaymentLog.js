const mongoose = require('mongoose');

const labourPaymentLogSchema = new mongoose.Schema({
  labourId:          { type: mongoose.Schema.Types.ObjectId, ref: 'Labour', required: true }, // Direct worker reference
  workId:            { type: mongoose.Schema.Types.ObjectId, ref: 'LabourTransaction' },
  amountPaid:        { type: Number, required: true },
  paymentMode:       { type: String, enum: ['Advance', 'Partial', 'Full'], default: 'Partial' },
  outstandingBefore: { type: Number, default: 0 },
  outstandingAfter:  { type: Number, default: 0 },
  remarks:           { type: String, default: '' },
  editReason:        { type: String, default: '' },
  createdBy:         { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedBy:         { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('LabourPaymentLog', labourPaymentLogSchema);
