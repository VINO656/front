const mongoose = require('mongoose');

const labourTransactionSchema = new mongoose.Schema({
  labourTransactionId: { type: String, unique: true },
  unitId:              { type: mongoose.Schema.Types.ObjectId, ref: 'Unit', required: true },
  labourId:            { type: mongoose.Schema.Types.ObjectId, ref: 'Labour', required: true }, // Direct worker reference
  jobType:             { type: String, enum: ['Cleaning', 'Processing'], required: true },
  refJobId:            { type: String, required: true }, // Points to CleaningJob or ProcessingJob
  kilosProcessed:      { type: Number, default: 0 },
  finishedUnits:       { type: Number, default: 0 },
  materialsWasted:     { type: Number, default: 0 },
  payRate:             { type: Number, default: 0 },
  amountPayable:       { type: Number, default: 0 },
  advance:             { type: Number, default: 0 },
  amountPaid:          { type: Number, default: 0 },
  paymentStatus:       { type: String, enum: ['Pending', 'Partial', 'Paid'], default: 'Pending' },
  workDate:            { type: String, required: true },
  shift:               { type: String, enum: ['Morning', 'Evening', 'Night'] },
  remarks:             { type: String, default: '' },
  updatedBy:           { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('LabourTransaction', labourTransactionSchema);
