const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
  id:           Number, 
  rawMaterialId:{ type: mongoose.Schema.Types.ObjectId, ref: 'RawMaterial' },
  material:     String, 
  hsn:          String, 
  grossWt:      Number, 
  wastage:      Number,
  rate:         Number, 
  gstRate:      Number, 
  taxAmt:       Number, 
  netWt:        Number, 
  total:        Number,
  postCleanWt:  { type: Number, default: null }, 
  postCleanAmt: { type: Number, default: null }
});

const paySchema = new mongoose.Schema({ 
  date:              String, 
  type:              String, 
  amt:               Number, 
  paymentMode:       { type: String, enum: ['Advance', 'Partial', 'Full'], default: 'Partial' },
  outstandingBefore: { type: Number, default: 0 },
  outstandingAfter:  { type: Number, default: 0 },
  note:              String,
  editReason:        { type: String, default: '' },
  createdBy:         { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
});

const s = new mongoose.Schema({
  purId:       { type: String, required: true, unique: true },
  unitId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Unit', required: true },
  purchaseType:{ type: String, enum: ['Raw', 'Trading'], default: 'Raw' },
  date:        String,
  supplierId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier' },
  items:       [itemSchema],
  totalGross:  Number, totalNet: Number, totalAmt: Number,
  advancePaid: { type: Number, default: 0 },
  cleanStatus: { type: String, enum: ['Pending','Done'], default: 'Pending' },
  payStatus:   { type: String, enum: ['Unpaid','Partial','Paid','Cancelled'], default: 'Unpaid' },
  paidAmt:     { type: Number, default: 0 },
  outstanding: { type: Number, default: 0 },
  remarks:     { type: String, default: '' },
  payLog:      [paySchema],
  createdBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('Purchase', s);
