const mongoose = require('mongoose');

const txnSchema = new mongoose.Schema({ date:String, desc:String, dr:Number, cr:Number });

const s = new mongoose.Schema({
  unitId:             { type: mongoose.Schema.Types.ObjectId, ref: 'Unit', required: true },
  extOrgId:           { type: mongoose.Schema.Types.ObjectId, ref: 'ExternalOrg', default: null },
  name:               { type: String, required: true },
  clientShortAddress: { type: String, default: '' },
  clientAddress1:     { type: String, default: '' },
  clientAddress2:     { type: String, default: '' },
  clientAddress3:     { type: String, default: '' },
  paymentTerms:       { type: String, default: '' },
  contact:            String, phone: String, email: String, address: String,
  gst:                String, bank: String, branch: String, acc: String, ifsc: String,
  outstanding:        { type: Number, default: 0 },
  status:             { type: String, enum: ['Active','Inactive'], default: 'Active' },
  txns:               [txnSchema],
  createdBy:          { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedBy:          { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('Client', s);
