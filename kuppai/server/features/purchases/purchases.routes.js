const r = require('express').Router();
const auth = require('../../middleware/auth');
const Purchase = require('./models/Purchase');
const Inventory = require('../inventory/models/Inventory');

r.get('/', auth, async (req, res) => {
  try {
    const q = req.query.unitId ? { unitId: req.query.unitId } : {};
    res.json(await Purchase.find(q).sort({ createdAt: -1 }));
  } catch(e) { res.status(500).json({message:e.message}); }
});

r.post('/', auth, async (req, res) => {
  try {
    const last = await Purchase.findOne().sort({ _id: -1 });
    let num = (await Purchase.countDocuments()) + 1;
    if (last && last.purId) {
      const m = last.purId.match(/\d+$/);
      if (m) num = Math.max(num, parseInt(m[0], 10) + 1);
    }
    const purId = 'PUR-' + String(num).padStart(3, '0');
    const data = { ...req.body, purId, outstanding: req.body.outstanding !== undefined ? req.body.outstanding : req.body.totalAmt };

    // If it's a trading purchase, we don't need cleaning.
    if (data.purchaseType === 'Trading') {
      data.cleanStatus = 'Done'; // No cleaning needed
    }

    const doc = await Purchase.create(data);

    if (data.items && data.items.length > 0) {
      for (let i = 0; i < data.items.length; i++) {
        const item = data.items[i];
        const invCount = await Inventory.countDocuments();
        const batchId = 'BAT-' + String(invCount + 1).padStart(4, '0');
        const isTrading = data.purchaseType === 'Trading';

        await Inventory.create({
          batchId,
          unitId: doc.unitId,
          category: isTrading ? 'finished' : 'raw',
          material: item.material,
          quality: isTrading ? 'Trading' : 'Raw Scrap',
          hsn: item.hsn || '',
          rate: +item.rate || 0,
          gstRate: +(item.gstRate || doc.taxRate || 18),
          taxAmt: Math.round(((+item.netWt || 0) * (+item.rate || 0) * (+item.gstRate || doc.taxRate || 18)) / 100),
          totalAmt: ((+item.netWt || 0) * (+item.rate || 0)) + Math.round(((+item.netWt || 0) * (+item.rate || 0) * (+item.gstRate || doc.taxRate || 18)) / 100),
          sourceRef: doc.purId,
          sourceType: 'Purchase',
          createdDate: doc.date,
          createdWt: item.netWt,
          ledger: [{ date: doc.date, type: 'IN', qty: item.netWt, note: `${data.purchaseType || 'Raw'} Purchase` }]
        });
      }
    }

    res.status(201).json(doc);
  } catch(e) { res.status(400).json({message:e.message}); }
});

r.put('/:id', auth, async (req, res) => {
  try { res.json(await Purchase.findByIdAndUpdate(req.params.id, req.body, {new:true})); } catch(e) { res.status(400).json({message:e.message}); }
});
r.delete('/:id', auth, async (req, res) => {
  try { await Purchase.findByIdAndDelete(req.params.id); res.json({message:'Deleted'}); } catch(e) { res.status(400).json({message:e.message}); }
});
module.exports = r;
