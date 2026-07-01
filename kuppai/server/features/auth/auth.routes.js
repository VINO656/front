const router = require('express').Router();
const jwt = require('jsonwebtoken');
const User = require('./models/User');
const auth = require('../../middleware/auth');
const mailer = require('../../utils/mailer');

const toUserPayload = (user) => ({
  id: user._id,
  name: user.name,
  username: user.username,
  role: user.role,
  unitId: user.unitId,
  initials: user.initials,
  email: user.email,
  status: user.status,
});

const signToken = (user) => jwt.sign(
  { id: user._id, role: user.role, unitId: user.unitId },
  process.env.JWT_SECRET,
  { expiresIn: '12h' }
);

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required' });
    }
    const user = await User.findOne({ username: String(username).trim().toLowerCase(), status: 'Active' });
    if (!user || !(await user.matchPw(password)))
      return res.status(401).json({ message: 'Invalid credentials' });
    const token = signToken(user);
    res.json({ token, user: toUserPayload(user) });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

router.post('/register', (req, res) => {
  res.status(403).json({ message: 'Public self-registration is disabled. Please contact your Admin for account creation.' });
});

router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ user: toUserPayload(user) });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

router.post('/change-password', auth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user.id);
    if (!(await user.matchPw(currentPassword)))
      return res.status(400).json({ message: 'Current password is wrong' });
    user.password = newPassword;
    await user.save();

    if (user.email) {
      await mailer.sendMail({
        to: user.email,
        subject: 'Security Alert: Password Changed',
        text: `Hello ${user.name},\nYour ERP account password was successfully updated on ${new Date().toLocaleString()}.`,
        type: 'PasswordChange'
      });
    }

    res.json({ message: 'Password updated' });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

router.put('/profile', auth, async (req, res) => {
  try {
    const upd = { ...req.body };
    delete upd.password; delete upd.role; delete upd.username; delete upd.status;
    const user = await User.findByIdAndUpdate(req.user.id, upd, { new: true }).select('-password');
    res.json({ user: toUserPayload(user) });
  } catch (e) { res.status(400).json({ message: e.message }); }
});

module.exports = router;
