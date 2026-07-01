const mongoose = require('mongoose');

const salesReturnSchema = new mongoose.Schema({
  returnId:         { type: String, unique: true }, // e.g. RET-001
  saleId:           { type: mongoose.Schema.Types.ObjectId, ref: 'Sale', required: true },
  clientId:         { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
  returnedWeightKg: { type: Number, required: true },
  newBatchId:       { type: mongoose.Schema.Types.ObjectId, ref: 'Inventory' }, // BAT-xxxx created from return
  returnDate:       { type: String, required: true },
  remarks:          { type: String, default: '' },
  createdBy:        { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedBy:        { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('SalesReturn', salesReturnSchema);
