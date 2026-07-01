const mongoose = require('mongoose');

const ledgerSchema = new mongoose.Schema({ 
  date:       String, 
  type:       String, 
  qty:        Number, 
  oldWeightKg:{ type: Number, default: 0 },
  newWeightKg:{ type: Number, default: 0 },
  refId:      { type: String, default: '' },
  changedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  note:       String 
});

const s = new mongoose.Schema({
  batchId:          { type: String, required: true, unique: true },
  unitId:           { type: mongoose.Schema.Types.ObjectId, ref: 'Unit', required: true },
  category:         { type: String, enum: ['raw','cleaned','finished','returned'], required: true },
  rawMaterialId:    { type: mongoose.Schema.Types.ObjectId, ref: 'RawMaterial', default: null },
  productId:        { type: mongoose.Schema.Types.ObjectId, ref: 'Product', default: null },
  material:         String, // Product Name
  quality:          String,
  hsn:              String, // Product HSN
  description:      String, // Description
  rate:             Number, // Price per unit
  gstRate:          { type: Number, default: 18 }, // GST %
  taxAmt:           Number, // GST Amt
  totalAmt:         Number, // Total Price
  sourceRef:        String, sourceType: String,
  createdDate:      String,
  createdWt:        Number, soldWt: { type: Number, default: 0 }, returnedWt: { type: Number, default: 0 },
  weightRemainingKg:{ type: Number, default: 0 },
  isReturnBatch:    { type: Boolean, default: false },
  originalSaleRef:  { type: mongoose.Schema.Types.ObjectId, ref: 'Sale', default: null },
  ledger:           [ledgerSchema],
  status:           { type: String, enum: ['Available','Partial','Sold','Consumed'], default: 'Available' },
  createdBy:        { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedBy:        { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('Inventory', s);
