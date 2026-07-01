const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  transactionId:   { type: String, unique: true }, // e.g. TXN-10001
  unitId:          { type: mongoose.Schema.Types.ObjectId, ref: 'Unit', required: true },
  transactionDate: { type: Date, default: Date.now },
  transactionType: { 
    type: String, 
    enum: ['Advance', 'Payment for Goods', 'Labour Payment', 'Supplier Payment', 'Client Receipt'], 
    required: true 
  },
  flowType: { 
    type: String, 
    enum: ['Raw Material Inflow', 'Product Outflow', 'Labour Outflow', 'Supplier Outflow', 'Client Inflow'], 
    required: true 
  },
  refModule:       { type: String, required: true }, // e.g. Invoice, Purchase, CleaningJob, ProcessingJob
  refId:           { type: String, required: true },
  amount:          { type: Number, required: true },
  remarks:         { type: String, default: '' },
  createdBy:       { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedBy:       { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('Transaction', transactionSchema);
