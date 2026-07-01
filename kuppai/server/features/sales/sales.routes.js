const r = require('express').Router();
const auth = require('../../middleware/auth');
const Sale = require('./models/Sale');
const Inventory = require('../inventory/models/Inventory');
const Client = require('../clients/models/Client');
const Purchase = require('../purchases/models/Purchase');

r.get('/', auth, async (req, res) => {
  try {
    const q = req.query.unitId ? { unitId: req.query.unitId } : {};
    res.json(await Sale.find(q).populate('clientId').sort({ createdAt: -1 }));
  } catch(e) { res.status(500).json({message:e.message}); }
});

r.post('/', auth, async (req, res) => {
  try {
    const last = await Sale.findOne().sort({ _id: -1 });
    let num = (await Sale.countDocuments()) + 1;
    if (last && last.saleId) {
      const m = last.saleId.match(/\d+$/);
      if (m) num = Math.max(num, parseInt(m[0], 10) + 1);
    }
    const saleId = 'SALE-' + String(num).padStart(4, '0');

    // Prepare items with costRate and profit
    const processedItems = [];
    let totalProfit = 0;

    // Deduct from Inventory for each item
    for (const item of req.body.items) {
      let costRate = 0;
      if (item.inventoryId) {
        const inv = await Inventory.findById(item.inventoryId);
        if (inv) {
          // If it came from a Purchase, find the cost rate
          if (inv.sourceType === 'Purchase' && inv.sourceRef) {
            const p = await Purchase.findOne({ purId: inv.sourceRef });
            if (p) {
              // Find matching item to get rate. If trading, we can just take the first matching material
              const pItem = p.items.find(x => x.material === inv.material);
              if (pItem) costRate = pItem.rate || 0;
            }
          }

          item.costRate = costRate;
          item.profit = (item.rate - costRate) * item.qty;
          totalProfit += item.profit;

          inv.soldWt += item.qty;
          inv.ledger.push({
            date: req.body.date,
            type: 'OUT',
            qty: item.qty,
            note: `Sale ${saleId}`
          });

          if (inv.soldWt >= inv.createdWt) {
            inv.status = 'Sold';
          } else if (inv.soldWt > 0) {
            inv.status = 'Partial';
          }
          await inv.save();
        }
      }
      processedItems.push(item);
    }

    // Create the Sale document
    const doc = await Sale.create({
      ...req.body,
      saleId,
      items: processedItems,
      outstanding: req.body.outstanding !== undefined ? req.body.outstanding : req.body.totalAmt
    });

    // Update Client's outstanding balance and add a transaction
    const client = await Client.findById(req.body.clientId);
    if (client) {
      const out = req.body.outstanding !== undefined ? req.body.outstanding : req.body.totalAmt;
      client.outstanding += out;
      client.txns.push({
        date: req.body.date,
        desc: `Sale ${saleId}`,
        dr: req.body.totalAmt, // Debit because Client owes us money
        cr: req.body.paidAmt || 0
      });
      await client.save();
    }

    res.status(201).json(doc);
  } catch(e) { res.status(400).json({message:e.message}); }
});

r.post('/return', auth, async (req, res) => {
  try {
    const { saleId, returnWt, isDamaged, date, note } = req.body;
    const sale = await Sale.findById(saleId);
    if (!sale) return res.status(404).json({ message: 'Sale not found' });

    const wt = Number(returnWt);
    if (wt <= 0 || (sale.returnedWt + wt) > sale.totalQty) {
      return res.status(400).json({ message: 'Invalid return quantity exceeding sold amount' });
    }

    const ratePerKg = sale.totalQty > 0 ? (sale.totalAmt / sale.totalQty) : 0;
    const refundAmt = Math.round(wt * ratePerKg);

    const invCount = await Inventory.countDocuments();
    const batchId = 'BAT-' + String(invCount + 1).padStart(4, '0');

    await Inventory.create({
      batchId,
      unitId: sale.unitId,
      category: isDamaged ? 'returned' : 'finished',
      material: sale.items?.[0]?.material || 'Returned Material',
      quality: isDamaged ? 'Damaged Scrap' : 'Client Return Stock',
      rate: ratePerKg,
      totalAmt: refundAmt,
      sourceRef: sale.saleId,
      sourceType: 'SalesReturn',
      createdDate: date || new Date().toISOString().split('T')[0],
      createdWt: wt,
      ledger: [{ date: date || new Date().toISOString().split('T')[0], type: 'IN', qty: wt, note: `Return from ${sale.saleId}` }]
    });

    sale.returnedWt = (sale.returnedWt || 0) + wt;
    sale.returnLog = sale.returnLog || [];
    sale.returnLog.push({ date: date || new Date().toISOString().split('T')[0], wt, isDamaged: !!isDamaged, note });
    sale.outstanding = Math.max(0, sale.outstanding - refundAmt);
    await sale.save();

    const client = await Client.findById(sale.clientId);
    if (client) {
      client.outstanding -= refundAmt;
      client.txns.push({
        date: date || new Date().toISOString().split('T')[0],
        desc: `Sales Return (${sale.saleId})`,
        dr: 0,
        cr: refundAmt
      });
      await client.save();
    }

    res.json({ message: 'Sales return processed successfully', sale });
  } catch(e) { res.status(400).json({ message: e.message }); }
});

r.put('/:id', auth, async (req, res) => {
  try {
    const doc = await Sale.findByIdAndUpdate(req.params.id, req.body, {new: true});
    if (doc && doc.invoiceRef) {
      const Invoice = require('../invoices/models/Invoice');
      await Invoice.findOneAndUpdate({ invoiceId: doc.invoiceRef }, {
        paidAmt: doc.paidAmt,
        outstanding: doc.outstanding,
        payStatus: doc.payStatus,
        payLog: doc.payLog
      });
    }
    res.json(doc);
  } catch(e) { res.status(400).json({message:e.message}); }
});

r.delete('/:id', auth, async (req, res) => {
  try { await Sale.findByIdAndDelete(req.params.id); res.json({message:'Deleted'}); } catch(e) { res.status(400).json({message:e.message}); }
});

module.exports = r;
