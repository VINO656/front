const mongoose = require('mongoose');
const rateHist = new mongoose.Schema({ date:String, rate:Number, by:String });

const s = new mongoose.Schema({
  unitId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Unit', required: true },
  name:        { type: String, required: true },
  username:    { type: String, default: '' },
  password:    { type: String, default: '' },
  email:       { type: String, default: '' },
  phone:       { type: String, default: '' },
  dob:         { type: String, default: '' },
  address:     { type: String, default: '' },
  state:       { type: String, default: '' },
  city:        { type: String, default: '' },
  pincode:     { type: String, default: '' },
  role:        { type: String, default: 'Employee' },
  manager:     { type: String, default: '' },
  status:      { type: String, enum: ['Active','Inactive'], default: 'Active' },
  bank:        { type: String, default: '' },
  branch:      { type: String, default: '' },
  acc:         { type: String, default: '' },
  ifsc:        { type: String, default: '' },
  rate:        { type: Number, default: 0 },
  outstanding: { type: Number, default: 0 },
  rateHistory: [rateHist],
  createdBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('Labour', s);
