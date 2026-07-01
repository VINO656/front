const mongoose = require('mongoose');

const userSessionSchema = new mongoose.Schema({
  sessionId:    { type: String, required: true, unique: true },
  userId:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  activeUnitId: { type: mongoose.Schema.Types.ObjectId, ref: 'Unit', default: null }, // null = All Units view
  lastSeen:     { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('UserSession', userSessionSchema);
