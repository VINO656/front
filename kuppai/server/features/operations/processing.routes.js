const r = require('express').Router();
const auth = require('../../middleware/auth');
const ProcessingJob = require('./models/ProcessingJob');
const Inventory = require('../inventory/models/Inventory');
const mailer = require('../../utils/mailer');

r.get('/', auth, async (req, res) => {
  try {
    const q = req.query.unitId ? { unitId: req.query.unitId } : {};
    res.json(await ProcessingJob.find(q).sort({ createdAt: -1 }));
  } catch(e) { res.status(500).json({message:e.message}); }
});

r.post('/', auth, async (req, res) => {
  try {
    // Validate stock availability
    if (req.body.sourceBatches && req.body.sourceBatches.length > 0) {
      for (const b of req.body.sourceBatches) {
        if (!b.material || !+b.inputWt) continue;
        const stocks = await Inventory.find({
          unitId: req.body.unitId,
          material: b.material,
          status: { $in: ['Available', 'Partial'] }
        });
        const totalAvail = stocks.reduce((acc, s) => acc + (s.createdWt - (s.soldWt || 0) - (s.returnedWt || 0)), 0);
        if (totalAvail < +b.inputWt) {
          return res.status(400).json({ message: `Insufficient stock for ${b.material}. Available: ${totalAvail} kg, Requested: ${b.inputWt} kg` });
        }
      }

      // Deduct source stock
      for (const b of req.body.sourceBatches) {
        if (!b.material || !+b.inputWt) continue;
        let rem = +b.inputWt;
        const stocks = await Inventory.find({
          unitId: req.body.unitId,
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
          s.ledger.push({ date: req.body.date || new Date().toISOString().slice(0, 10), type: 'OUT', qty: deduct, note: 'Processing Job Source' });
          await s.save();
        }
      }
    }

    const last = await ProcessingJob.findOne().sort({ _id: -1 });
    let num = (await ProcessingJob.countDocuments()) + 1;
    if (last && last.jobId) {
      const m = last.jobId.match(/\d+$/);
      if (m) num = Math.max(num, parseInt(m[0], 10) + 1);
    }
    const jobId = 'PRC-' + String(num).padStart(3, '0');
    const doc = await ProcessingJob.create({ ...req.body, jobId, outstanding: req.body.outstanding !== undefined ? req.body.outstanding : (req.body.labourAmt || 0) });

    for (let i = 0; i < doc.outputs.length; i++) {
      const out = doc.outputs[i];
      if (+out.outputWt > 0) {
        const invCount = await Inventory.countDocuments();
        const batchId = 'BAT-' + String(invCount + 1).padStart(4, '0');
        out.batchId = batchId;
        await Inventory.create({
          batchId,
          unitId: doc.unitId,
          category: 'finished',
          material: doc.sourceBatches?.[0]?.material || 'Processed Goods',
          quality: out.quality || 'Standard',
          hsn: out.hsn || '',
          rate: +out.rate || 0,
          gstRate: +(out.gstRate || 18),
          taxAmt: Math.round(((+out.outputWt || 0) * (+out.rate || 0) * (+out.gstRate || 18)) / 100),
          totalAmt: ((+out.outputWt || 0) * (+out.rate || 0)) + Math.round(((+out.outputWt || 0) * (+out.rate || 0) * (+out.gstRate || 18)) / 100),
          sourceRef: doc.jobId,
          sourceType: 'Processing',
          createdDate: doc.date,
          createdWt: out.outputWt,
          soldWt: 0,
          returnedWt: 0,
          ledger: [{ date: doc.date, type: 'IN', qty: out.outputWt, note: 'Processing Output (' + jobId + ')' }]
        });
      }
    }
    await doc.save();
    res.status(201).json(doc);
  } catch(e) { res.status(400).json({message:e.message}); }
});

r.put('/:id', auth, async (req, res) => {
  try {
    const oldJob = await ProcessingJob.findById(req.params.id);
    if (!oldJob) return res.status(404).json({message: 'Not found'});

    await Inventory.deleteMany({ sourceRef: oldJob.jobId, sourceType: 'Processing' });
    const doc = await ProcessingJob.findByIdAndUpdate(req.params.id, req.body, {new: true});

    for (let i = 0; i < doc.outputs.length; i++) {
      const out = doc.outputs[i];
      if (+out.outputWt > 0) {
        const invCount = await Inventory.countDocuments();
        const batchId = 'BAT-' + String(invCount + 1).padStart(4, '0');
        out.batchId = batchId;
        await Inventory.create({
          batchId,
          unitId: doc.unitId,
          category: 'finished',
          material: doc.sourceBatches?.[0]?.material || 'Processed Goods',
          quality: out.quality || 'Standard',
          hsn: out.hsn || '',
          rate: +out.rate || 0,
          gstRate: +(out.gstRate || 18),
          taxAmt: Math.round(((+out.outputWt || 0) * (+out.rate || 0) * (+out.gstRate || 18)) / 100),
          totalAmt: ((+out.outputWt || 0) * (+out.rate || 0)) + Math.round(((+out.outputWt || 0) * (+out.rate || 0) * (+out.gstRate || 18)) / 100),
          sourceRef: doc.jobId,
          sourceType: 'Processing',
          createdDate: doc.date,
          createdWt: out.outputWt,
          soldWt: 0,
          returnedWt: 0,
          ledger: [{ date: doc.date, type: 'IN', qty: out.outputWt, note: 'Processing Output (' + doc.jobId + ')' }]
        });
      }
    }
    await doc.save();
    res.json(doc);
  } catch(e) { res.status(400).json({message:e.message}); }
});

r.delete('/:id', auth, async (req, res) => {
  try {
    const job = await ProcessingJob.findById(req.params.id);
    if (job) {
      await Inventory.deleteMany({ sourceRef: job.jobId, sourceType: 'Processing' });
      if (job.sourceBatches && job.sourceBatches.length > 0) {
        for (const b of job.sourceBatches) {
          if (!b.material || !+b.inputWt) continue;
          let rem = +b.inputWt;
          const stocks = await Inventory.find({
            unitId: job.unitId,
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
            s.ledger.push({ date: new Date().toISOString().slice(0, 10), type: 'IN', qty: restore, note: `Restored from deleted Processing Job (${job.jobId})` });
            await s.save();
          }
        }
      }
      await ProcessingJob.findByIdAndDelete(req.params.id);
    }
    res.json({message:'Deleted'});
  } catch(e) { res.status(400).json({message:e.message}); }
});

r.post('/efficiency-alert', auth, async (req, res) => {
  try {
    const { unitId, threshold = 10 } = req.body;
    const q = unitId ? { unitId } : {};
    const jobs = await ProcessingJob.find(q);
    const highWastage = jobs.filter(j => j.totalInputWt > 0 && ((j.totalWastage / j.totalInputWt) * 100) >= threshold);

    const count = highWastage.length;
    const details = highWastage.map(j => `${j.jobId} (${j.date}): Input ${j.totalInputWt}kg, Wastage ${j.totalWastage}kg (${((j.totalWastage/j.totalInputWt)*100).toFixed(1)}%)`).join('\n');

    await mailer.sendMail({
      to: req.user?.email || 'admin@kuppai.erp',
      subject: `⚠️ Production Efficiency Alert: ${count} Jobs Exceeded ${threshold}% Wastage`,
      text: `Production Yield Audit Report\nThreshold: ${threshold}% Wastage\n\nHigh Wastage Batches:\n${details || 'None detected.'}\n\nPlease inspect machinery mesh calibration and raw material sorting quality.`,
      type: 'General'
    });

    res.json({ message: `Efficiency report dispatched to Admin. ${count} batches flagged above ${threshold}% wastage threshold.`, flaggedCount: count });
  } catch(e) { res.status(400).json({message:e.message}); }
});

module.exports = r;
