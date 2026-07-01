const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
  inventoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Inventory' },
  productId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  saleId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Sale' },
  material:    String,
  quality:     String,
  qty:         Number,
  rate:        Number,
  gstRate:     Number,
  taxAmt:      Number,
  total:       Number
});

const paySchema = new mongoose.Schema({
  date:              String,
  type:              String,
  amt:               Number,
  paymentMode:       { type: String, enum: ['Advance', 'Partial', 'Full', 'Excess'], default: 'Partial' },
  outstandingBefore: { type: Number, default: 0 },
  outstandingAfter:  { type: Number, default: 0 },
  note:              String,
  editReason:        { type: String, default: '' },
  createdBy:         { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
});

const s = new mongoose.Schema({
  invoiceNumber:  { type: Number }, // Auto-inc / sequence number
  invoiceId:      { type: String, required: true, unique: true },
  saleRef:        String, // Ref to SALE-xxxx in Outflow
  unitId:         { type: mongoose.Schema.Types.ObjectId, ref: 'Unit', required: true },
  date:           String,
  dueDate:        String,
  clientId:       { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
  items:          [itemSchema],
  subTotal:       Number,
  taxRate:        { type: Number, default: 0 },
  taxAmt:         { type: Number, default: 0 },
  discount:       { type: Number, default: 0 },
  billableAmount: Number, // Total before payments
  advancePaid:    { type: Number, default: 0 },
  totalAmt:       Number, // To be paid
  paidAmt:        { type: Number, default: 0 }, // Total paid
  outstanding:    Number,
  payStatus:      { type: String, enum: ['Unpaid', 'Partial', 'Paid', 'Cancelled'], default: 'Unpaid' },
  approvalStatus: { type: String, enum: ['Pending Approval', 'Approved', 'Rejected'], default: 'Pending Approval' },
  approvedAt:     { type: Date, default: null },
  payLog:         [paySchema],
  remarks:        { type: String, default: '' },
  notes:          String,
  createdBy:      { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvedBy:     { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedBy:      { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('Invoice', s);
