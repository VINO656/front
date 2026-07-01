const mongoose = require('mongoose');

const externalOrgSchema = new mongoose.Schema({
  extOrgId:      { type: String, unique: true }, // e.g. EXT-0001
  unitId:        { type: mongoose.Schema.Types.ObjectId, ref: 'Unit', required: true },
  name:          { type: String, required: true },
  contactNumber: { type: String, default: '' },
  email:         { type: String, default: '' },
  address:       { type: String, default: '' },
  bank:          { type: String, default: '' },
  bankAcNo:      { type: String, default: '' },
  bankIfsc:      { type: String, default: '' },
  isClient:      { type: Boolean, default: false },
  isVendor:      { type: Boolean, default: false },
  status:        { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
  createdBy:     { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedBy:     { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('ExternalOrg', externalOrgSchema);
