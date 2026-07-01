const mongoose = require('mongoose');

const productMaterialSchema = new mongoose.Schema({
  productId:       { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  rawMaterialId:   { type: mongoose.Schema.Types.ObjectId, ref: 'RawMaterial', required: true },
  quantityUsed:    { type: Number, required: true },
  materialsWasted: { type: Number, default: 0 },
  updatedBy:       { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('ProductMaterial', productMaterialSchema);
