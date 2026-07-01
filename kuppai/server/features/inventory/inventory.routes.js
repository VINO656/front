const r = require('express').Router();
const auth = require('../../middleware/auth');
const admin = require('../../middleware/admin');
const Inventory = require('./models/Inventory');

r.get('/', auth, async (req, res) => {
  try {
    const q = {};
    if (req.query.unitId)   q.unitId = req.query.unitId;
    if (req.query.category) q.category = req.query.category;
    res.json(await Inventory.find(q).sort({ createdAt: -1 }));
  } catch(e) { res.status(500).json({message:e.message}); }
});
r.post('/', admin, async (req, res) => {
  try { res.status(201).json(await Inventory.create(req.body)); } catch(e) { res.status(400).json({message:e.message}); }
});
r.put('/:id', admin, async (req, res) => {
  try { res.json(await Inventory.findByIdAndUpdate(req.params.id, req.body, {new:true})); } catch(e) { res.status(400).json({message:e.message}); }
});
r.delete('/:id', admin, async (req, res) => {
  try { await Inventory.findByIdAndDelete(req.params.id); res.json({message:'Deleted'}); } catch(e) { res.status(400).json({message:e.message}); }
});
module.exports = r;
