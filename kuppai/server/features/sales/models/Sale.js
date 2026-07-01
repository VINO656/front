const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
  inventoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Inventory', required: true },
  productId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  material:    String,
  quality:     String,
  qty:         Number,
  rate:        Number,
  costRate:    { type: Number, default: 0 },
  profit:      { type: Number, default: 0 },
  total:       Number,
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

const returnLogSchema = new mongoose.Schema({
  date:      String,
  wt:        Number,
  isDamaged: Boolean,
  returnId:  { type: mongoose.Schema.Types.ObjectId, ref: 'SalesReturn' },
  note:      String
});

const s = new mongoose.Schema({
  saleId:           { type: String, required: true, unique: true },
  unitId:           { type: mongoose.Schema.Types.ObjectId, ref: 'Unit', required: true },
  date:             String,
  clientId:         { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
  items:            [itemSchema],
  totalQty:         Number,
  netBilledWeightKg:{ type: Number, default: 0 }, // Calc
  discount:         { type: Number, default: 0 },
  totalAmt:         Number,
  payStatus:        { type: String, enum: ['Unpaid','Partial','Paid'], default: 'Unpaid' },
  paidAmt:          { type: Number, default: 0 },
  outstanding:      { type: Number, default: 0 },
  invoiceRef:       String,
  returnedWt:       { type: Number, default: 0 },
  returnLog:        [returnLogSchema],
  payLog:           [paySchema],
  remarks:          { type: String, default: '' },
  note:             String,
  createdBy:        { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedBy:        { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('Sale', s);
