const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  productId:     { type: String, unique: true }, // e.g. PRD-001
  unitId:        { type: mongoose.Schema.Types.ObjectId, ref: 'Unit', required: true },
  name:          { type: String, required: true },
  description:   { type: String, default: '' },
  unit:          { type: String, default: 'kg' },
  pricePerUnit:  { type: Number, default: 0 },
  meshSize:      { type: String, default: '' },
  meshCount:     { type: Number, default: 0 },
  gstPercentage: { type: Number, default: 18 },
  gstAmount:     { type: Number, default: 0 },
  totalInclGst:  { type: Number, default: 0 },
  hsnCode:       { type: String, default: '' },
  status:        { type: Boolean, default: true }, // true = active
  createdBy:     { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedBy:     { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('Product', productSchema);
