const mongoose = require('mongoose');

const batchSchema = new mongoose.Schema({
  purchaseId:    String, 
  itemId:        Number, 
  rawMaterialId: { type: mongoose.Schema.Types.ObjectId, ref: 'RawMaterial' },
  material:      String,
  inputWt:       Number, 
  cleanedWt:     Number, 
  wastage:       Number
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
  jobId:          { type: String, required: true, unique: true },
  unitId:         { type: mongoose.Schema.Types.ObjectId, ref: 'Unit', required: true },
  date:           String,
  shift:          { type: String, enum: ['Morning', 'Evening', 'Night'] },
  labourId:       { type: mongoose.Schema.Types.ObjectId, ref: 'Labour' },
  batches:        [batchSchema],
  totalInputWt:   Number, totalCleanedWt: Number, totalWastage: Number,
  wastagePct:     { type: Number, default: 0 }, // Calc %
  cleaningUnitWt: Number, finishedUnits: Number, payPerUnit: Number,
  labourRate:     Number, labourAmt: Number,
  payStatus:      { type: String, enum: ['Unpaid','Partial','Paid'], default: 'Unpaid' },
  paidAmt:        { type: Number, default: 0 },
  outstanding:    { type: Number, default: 0 },
  payLog:         [paySchema],
  remarks:        { type: String, default: '' },
  note:           String,
  createdBy:      { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedBy:      { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('CleaningJob', s);
