const r = require('express').Router();
const admin = require('../../middleware/admin');
const User = require('../auth/models/User');
const mailer = require('../../utils/mailer');

r.get('/', admin, async (req, res) => {
  try { res.json(await User.find().populate('unitId').select('-password')); } catch(e) { res.status(500).json({message:e.message}); }
});

r.post('/', admin, async (req, res) => {
  try {
    const doc = await User.create(req.body);
    if (doc.email) {
      await mailer.sendMail({
        to: doc.email,
        subject: 'Welcome to Recycle ERP - Account Created',
        text: `Hello ${doc.name},\nYour account (${doc.username}) has been created by Admin. Role: ${doc.role}.`,
        type: 'Onboarding'
      });
    }
    res.status(201).json(doc);
  } catch(e) { res.status(400).json({message:e.message}); }
});

r.put('/:id', admin, async (req, res) => {
  try {
    const upd = {...req.body};
    if (!upd.password) delete upd.password;
    const u = await User.findByIdAndUpdate(req.params.id, upd, {new:true}).select('-password');
    res.json(u);
  } catch(e) { res.status(400).json({message:e.message}); }
});

r.patch('/:id/password', admin, async (req, res) => {
  try {
    const u = await User.findById(req.params.id);
    u.password = req.body.password;
    await u.save();
    if (u.email) {
      await mailer.sendMail({
        to: u.email,
        subject: 'Password Reset by Admin',
        text: `Hello ${u.name},\nYour password was reset by Admin on ${new Date().toLocaleString()}.`,
        type: 'PasswordChange'
      });
    }
    res.json({message:'Password reset'});
  } catch(e) { res.status(400).json({message:e.message}); }
});

module.exports = r;
