const mongoose = require('mongoose');

const historySchema = new mongoose.Schema({
  date: String,
  oldWt: Number,
  newWt: Number,
  updatedBy: String
});

const settingSchema = new mongoose.Schema({
  unitId:         { type: mongoose.Schema.Types.ObjectId, ref: 'Unit' },
  configKey:      { type: String, default: 'KG_PER_UNIT' },
  configValue:    { type: String, default: '50' },
  effectiveFrom:  { type: Date, default: Date.now },
  notes:          { type: String, default: '' },
  cleaningUnitWt: { type: Number, default: 50 },
  history:        [historySchema],
  changedBy:      { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedBy:      { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('Setting', settingSchema);
