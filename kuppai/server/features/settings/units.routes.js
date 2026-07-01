const r = require('express').Router();
const auth = require('../../middleware/auth');
const admin = require('../../middleware/admin');
const Unit = require('./models/Unit');

r.get('/', auth, async (req, res) => {
  try { res.json(await Unit.find()); } catch(e) { res.status(500).json({message:e.message}); }
});
r.post('/', admin, async (req, res) => {
  try { res.status(201).json(await Unit.create(req.body)); } catch(e) { res.status(400).json({message:e.message}); }
});
r.put('/:id', admin, async (req, res) => {
  try { res.json(await Unit.findByIdAndUpdate(req.params.id, req.body, {new:true})); } catch(e) { res.status(400).json({message:e.message}); }
});
module.exports = r;
