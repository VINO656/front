const mongoose = require('mongoose');

const rawMaterialSchema = new mongoose.Schema({
  rawMaterialId:   { type: String, unique: true }, // e.g. RM-001
  unitId:          { type: mongoose.Schema.Types.ObjectId, ref: 'Unit', required: true },
  name:            { type: String, required: true },
  unit:            { type: String, default: 'kg' },
  pricePerUnit:    { type: Number, default: 0 },
  stockQuantity:   { type: Number, default: 0 },
  wastageQuantity: { type: Number, default: 0 },
  remarks:         { type: String, default: '' },
  createdBy:       { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedBy:       { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('RawMaterial', rawMaterialSchema);
