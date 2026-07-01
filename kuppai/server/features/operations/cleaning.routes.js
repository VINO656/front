const r = require('express').Router();
const auth = require('../../middleware/auth');
const CleaningJob = require('./models/CleaningJob');
const Inventory = require('../inventory/models/Inventory');

r.get('/', auth, async (req, res) => {
  try {
    const q = req.query.unitId ? { unitId: req.query.unitId } : {};
    res.json(await CleaningJob.find(q).sort({ createdAt: -1 }));
  } catch(e) { res.status(500).json({message:e.message}); }
});

r.post('/', auth, async (req, res) => {
  try {
    // Validate stock availability
    if (req.body.batches && req.body.batches.length > 0) {
      for (const b of req.body.batches) {
        if (!b.material || !+b.inputWt) continue;
        const stocks = await Inventory.find({
          unitId: req.body.unitId,
          category: 'raw',
          material: b.material,
          status: { $in: ['Available', 'Partial'] }
        });
        const totalAvail = stocks.reduce((acc, s) => acc + (s.createdWt - (s.soldWt || 0) - (s.returnedWt || 0)), 0);
        if (totalAvail < +b.inputWt) {
          return res.status(400).json({ message: `Insufficient raw stock for ${b.material}. Available: ${totalAvail} kg, Requested: ${b.inputWt} kg` });
        }
      }

      // Deduct raw stock
      for (const b of req.body.batches) {
        if (!b.material || !+b.inputWt) continue;
        let rem = +b.inputWt;
        const stocks = await Inventory.find({
          unitId: req.body.unitId,
          category: 'raw',
          material: b.material,
          status: { $in: ['Available', 'Partial'] }
        }).sort({ createdAt: 1 });

        for (const s of stocks) {
          if (rem <= 0) break;
          const avail = s.createdWt - (s.soldWt || 0) - (s.returnedWt || 0);
          if (avail <= 0) continue;
          const deduct = Math.min(avail, rem);
          s.soldWt = (s.soldWt || 0) + deduct;
          rem -= deduct;
          if (s.soldWt >= s.createdWt) s.status = 'Consumed';
          else if (s.soldWt > 0) s.status = 'Partial';
          s.ledger.push({ date: req.body.date || new Date().toISOString().slice(0, 10), type: 'OUT', qty: deduct, note: 'Cleaning Job Input' });
          await s.save();
        }
      }
    }

    const last = await CleaningJob.findOne().sort({ _id: -1 });
    let num = (await CleaningJob.countDocuments()) + 1;
    if (last && last.jobId) {
      const m = last.jobId.match(/\d+$/);
      if (m) num = Math.max(num, parseInt(m[0], 10) + 1);
    }
    const jobId = 'CLN-' + String(num).padStart(3, '0');
    const doc = await CleaningJob.create({ ...req.body, jobId, outstanding: req.body.outstanding !== undefined ? req.body.outstanding : (req.body.labourAmt || 0) });
    res.status(201).json(doc);
  } catch(e) { res.status(400).json({message:e.message}); }
});

r.put('/:id', auth, async (req, res) => {
  try { res.json(await CleaningJob.findByIdAndUpdate(req.params.id, req.body, {new:true})); } catch(e) { res.status(400).json({message:e.message}); }
});

r.delete('/:id', auth, async (req, res) => {
  try {
    const job = await CleaningJob.findById(req.params.id);
    if (job) {
      // Delete cleaned inventory batches produced by this job
      await Inventory.deleteMany({ sourceRef: job.jobId, sourceType: 'cleaning' });

      // Restore raw inventory stock
      if (job.batches && job.batches.length > 0) {
        for (const b of job.batches) {
          if (!b.material || !+b.inputWt) continue;
          let rem = +b.inputWt;
          const stocks = await Inventory.find({
            unitId: job.unitId,
            category: 'raw',
            material: b.material,
            status: { $in: ['Consumed', 'Partial', 'Sold'] }
          }).sort({ createdAt: -1 });

          for (const s of stocks) {
            if (rem <= 0) break;
            const used = s.soldWt || 0;
            if (used <= 0) continue;
            const restore = Math.min(used, rem);
            s.soldWt -= restore;
            rem -= restore;
            if (s.soldWt <= 0) s.status = 'Available';
            else if (s.soldWt < s.createdWt) s.status = 'Partial';
            s.ledger.push({ date: new Date().toISOString().slice(0, 10), type: 'IN', qty: restore, note: `Restored from deleted Cleaning Job (${job.jobId})` });
            await s.save();
          }
        }
      }
      await CleaningJob.findByIdAndDelete(req.params.id);
    }
    res.json({message:'Deleted'});
  } catch(e) { res.status(400).json({message:e.message}); }
});

module.exports = r;
