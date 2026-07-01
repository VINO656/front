const mongoose = require('mongoose');

const srcSchema = new mongoose.Schema({ 
  refId:         String, 
  rawMaterialId: { type: mongoose.Schema.Types.ObjectId, ref: 'RawMaterial' },
  cleaningId:    { type: mongoose.Schema.Types.ObjectId, ref: 'CleaningJob' },
  batchId:       { type: mongoose.Schema.Types.ObjectId, ref: 'Inventory' },
  material:      String, 
  inputWt:       Number 
});

const outSchema = new mongoose.Schema({ 
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  quality:   String, 
  outputWt:  Number, 
  batchId:   String 
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
  jobId:        { type: String, required: true, unique: true },
  unitId:       { type: mongoose.Schema.Types.ObjectId, ref: 'Unit', required: true },
  date:         String,
  labourId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Labour' },
  sourceType:   String,
  sourceBatches:[srcSchema],
  totalInputWt: Number,
  totalWastage: Number,
  finishedUnits:Number,
  cleaningUnitWt:Number,
  payPerUnit:   Number,
  shift:        String,
  meshSize:     String, meshCount: Number,
  outputs:      [outSchema],
  totalOutputWt:Number,
  labourRate:   Number, labourAmt: Number,
  payStatus:    { type: String, enum: ['Unpaid','Partial','Paid'], default: 'Unpaid' },
  paidAmt:      { type: Number, default: 0 },
  outstanding:  { type: Number, default: 0 },
  remarks:      { type: String, default: '' },
  payLog:       [paySchema],
  note:         String,
  createdBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('ProcessingJob', s);
