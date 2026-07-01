const router = require('express').Router();
const auth = require('../../middleware/auth');
const admin = require('../../middleware/admin');
const Setting = require('./models/Setting');

router.get('/', auth, async (req, res, next) => {
  try {
    const query = req.query.unitId ? { unitId: req.query.unitId } : {};
    let s = await Setting.findOne(query);
    if (!s) {
      s = await Setting.create(req.query.unitId ? { unitId: req.query.unitId } : {});
    }
    res.json(s);
  } catch (err) { next(err); }
});

router.put('/', admin, async (req, res, next) => {
  try {
    const query = req.body.unitId ? { unitId: req.body.unitId } : {};
    let s = await Setting.findOne(query);
    if (!s) {
      s = await Setting.create(req.body);
    } else {
      if (req.body.cleaningUnitWt && +req.body.cleaningUnitWt !== +s.cleaningUnitWt) {
        s.history = s.history || [];
        s.history.push({
          date: new Date().toISOString().split('T')[0],
          oldWt: s.cleaningUnitWt,
          newWt: +req.body.cleaningUnitWt,
          updatedBy: req.user?.username || 'Admin'
        });
      }
      Object.assign(s, req.body);
      await s.save();
    }
    res.json(s);
  } catch (err) { next(err); }
});

module.exports = router;
