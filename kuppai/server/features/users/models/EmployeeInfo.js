const mongoose = require('mongoose');

const employeeInfoSchema = new mongoose.Schema({
  empId:             { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  address:           { type: String, default: '' },
  bloodGroup:        { type: String, default: '' },
  emgName:           { type: String, default: '' },
  emgRelation:       { type: String, default: '' },
  emgPhone:          { type: String, default: '' },
  linkedin:          { type: String, default: '' },
  joinedOn:          { type: Date, default: Date.now },
  about:             { type: String, default: '' },
  aadharNumber:      { type: String, default: '' },
  aadharFile:        { type: String, default: '' },
  panNumber:         { type: String, default: '' },
  panFile:           { type: String, default: '' },
  grade10Percent:    { type: String, default: '' },
  grade10MarkSheet:  { type: String, default: '' },
  grade12Percent:    { type: String, default: '' },
  grade12MarkSheet:  { type: String, default: '' },
  bachelorDegree:    { type: String, default: '' },
  bachelorDomain:    { type: String, default: '' },
  bachelorCGPA:      { type: String, default: '' },
  bachelorMarkSheet: { type: String, default: '' },
  masterDegree:      { type: String, default: '' },
  masterDomain:      { type: String, default: '' },
  masterCGPA:        { type: String, default: '' },
  masterMarkSheet:   { type: String, default: '' },
  updatedBy:         { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('EmployeeInfo', employeeInfoSchema);
