const r = require('express').Router();
const auth = require('../../middleware/auth');
const admin = require('../../middleware/admin');
const Model = require('./models/Client');

r.get('/', auth, async (req, res) => {
  try {
    const q = req.query.unitId ? { unitId: req.query.unitId } : {};
    res.json(await Model.find(q));
  } catch(e) { res.status(500).json({message:e.message}); }
});
r.post('/', admin, async (req, res) => {
  try { res.status(201).json(await Model.create(req.body)); } catch(e) { res.status(400).json({message:e.message}); }
});
r.put('/:id', admin, async (req, res) => {
  try { res.json(await Model.findByIdAndUpdate(req.params.id, req.body, {new:true})); } catch(e) { res.status(400).json({message:e.message}); }
});
r.delete('/:id', admin, async (req, res) => {
  try { await Model.findByIdAndDelete(req.params.id); res.json({message:'Deleted'}); } catch(e) { res.status(400).json({message:e.message}); }
});
module.exports = r;
