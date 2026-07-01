const mongoose = require('mongoose');

const txnSchema = new mongoose.Schema({ date:String, desc:String, dr:Number, cr:Number });

const s = new mongoose.Schema({
  unitId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Unit', required: true },
  extOrgId:    { type: mongoose.Schema.Types.ObjectId, ref: 'ExternalOrg', default: null },
  name:        { type: String, required: true },
  contact:     String, phone: String, email: String, address: String,
  gst:         String, bank: String, branch: String, acc: String, ifsc: String,
  materials:   [String],
  outstanding: { type: Number, default: 0 },
  status:      { type: String, enum: ['Active','Inactive'], default: 'Active' },
  txns:        [txnSchema],
  createdBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('Supplier', s);
