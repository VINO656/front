const mongoose = require('mongoose');

const s = new mongoose.Schema({
  name:           { type: String, required: true },
  code:           { type: String, required: true },
  location:       { type: String, required: true },
  email:          { type: String, default: '' },
  address:        { type: String, default: '' },
  phone:          { type: String, default: '' },
  primaryEmail:   { type: String, default: '' },
  primaryPhone:   { type: String, default: '' },
  primaryAddress: { type: String, default: '' },
  logo:           { type: String, default: '' },
  gst:            { type: String, default: '' },
  cin:            { type: String, default: '' },
  bankName:       { type: String, default: '' },
  bankBranch:     { type: String, default: '' },
  bankAcc:        { type: String, default: '' },
  ifsc:           { type: String, default: '' },
  signingAuth:    { type: Boolean, default: false },
  color:          { type: String, default: '#1e3a5f' },
  status:         { type: String, enum: ['Active','Inactive'], default: 'Active' },
  createdBy:      { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedBy:      { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('Unit', s);
