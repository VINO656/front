const r = require('express').Router();
const auth = require('../../middleware/auth');
const admin = require('../../middleware/admin');
const Model = require('./models/Labour');
const User = require('../auth/models/User');

r.get('/', auth, async (req, res) => {
  try {
    const q = req.query.unitId ? { unitId: req.query.unitId } : {};
    res.json(await Model.find(q));
  } catch(e) { res.status(500).json({message:e.message}); }
});

r.post('/', admin, async (req, res) => {
  try {
    const data = {...req.body};
    if (data.username && data.password) {
      const cleanUser = String(data.username).trim().toLowerCase();
      const existing = await User.findOne({ username: cleanUser });
      if (!existing && cleanUser) {
        await User.create({
          name: data.name || cleanUser,
          username: cleanUser,
          password: data.password,
          email: data.email || undefined,
          phone: data.phone || undefined,
          dob: data.dob || undefined,
          address: [data.address, data.city, data.state, data.pincode].filter(Boolean).join(', ') || undefined,
          role: ['Admin','Employee'].includes(data.role) ? data.role : 'Employee',
          status: data.status || 'Active',
          initials: (data.name||'LA').split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2) || 'LA',
          bankName: data.bank || undefined,
          bankBranch: data.branch || undefined,
          bankAcc: data.acc || undefined,
          ifsc: data.ifsc || undefined
        });
      }
    }
    res.status(201).json(await Model.create(data));
  } catch(e) { res.status(400).json({message:e.message}); }
});

r.put('/:id', admin, async (req, res) => {
  try {
    const data = {...req.body};
    const old = await Model.findById(req.params.id);
    const updated = await Model.findByIdAndUpdate(req.params.id, data, {new:true});
    if (updated && updated.username) {
      const cleanUser = String(updated.username).trim().toLowerCase();
      let usr = await User.findOne({ username: old?.username?.toLowerCase() || cleanUser });
      if (!usr && cleanUser && req.body.password) {
        usr = await User.create({
          name: updated.name,
          username: cleanUser,
          password: req.body.password,
          email: updated.email || undefined,
          phone: updated.phone || undefined,
          dob: updated.dob || undefined,
          address: [updated.address, updated.city, updated.state, updated.pincode].filter(Boolean).join(', ') || undefined,
          role: ['Admin','Employee'].includes(updated.role) ? updated.role : 'Employee',
          status: updated.status,
          initials: (updated.name||'LA').split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2) || 'LA',
          bankName: updated.bank || undefined,
          bankBranch: updated.branch || undefined,
          bankAcc: updated.acc || undefined,
          ifsc: updated.ifsc || undefined
        });
      } else if (usr) {
        usr.name = updated.name;
        usr.username = cleanUser;
        usr.email = updated.email || undefined;
        usr.phone = updated.phone || undefined;
        usr.dob = updated.dob || undefined;
        usr.address = [updated.address, updated.city, updated.state, updated.pincode].filter(Boolean).join(', ') || undefined;
        usr.role = ['Admin','Employee'].includes(updated.role) ? updated.role : 'Employee';
        usr.status = updated.status;
        usr.bankName = updated.bank || undefined;
        usr.bankBranch = updated.branch || undefined;
        usr.bankAcc = updated.acc || undefined;
        usr.ifsc = updated.ifsc || undefined;
        if (req.body.password) usr.password = req.body.password;
        await usr.save();
      }
    }
    res.json(updated);
  } catch(e) { res.status(400).json({message:e.message}); }
});

r.delete('/:id', admin, async (req, res) => {
  try {
    const old = await Model.findById(req.params.id);
    if (old && old.username) {
      await User.findOneAndDelete({ username: String(old.username).trim().toLowerCase() });
    }
    await Model.findByIdAndDelete(req.params.id);
    res.json({message:'Deleted'});
  } catch(e) { res.status(400).json({message:e.message}); }
});

module.exports = r;
