const r = require('express').Router();
const auth = require('../../middleware/auth');
const Invoice = require('./models/Invoice');
const Client = require('../clients/models/Client');
const Sale = require('../sales/models/Sale');
const Inventory = require('../inventory/models/Inventory');
const Purchase = require('../purchases/models/Purchase');

async function createSaleFromInvoice(inv) {
  if (inv.saleRef) return; // already generated sale
  const last = await Sale.findOne().sort({ _id: -1 });
  let num = (await Sale.countDocuments()) + 1;
  if (last && last.saleId) {
    const m = last.saleId.match(/\d+$/);
    if (m) num = Math.max(num, parseInt(m[0], 10) + 1);
  }
  const saleId = 'SALE-' + String(num).padStart(4, '0');

  let totalQty = 0;
  const processedItems = [];

  for (const it of inv.items) {
    totalQty += (+it.qty || 0);
    let costRate = 0;
    if (it.inventoryId) {
      const stock = await Inventory.findById(it.inventoryId);
      if (stock) {
        if (stock.sourceType === 'Purchase' && stock.sourceRef) {
          const p = await Purchase.findOne({ purId: stock.sourceRef });
          if (p) {
            const pItem = p.items?.find(x => x.material === stock.material);
            if (pItem) costRate = +(pItem.rate || 0);
          }
        }
      }
    }
    processedItems.push({
      inventoryId: it.inventoryId || undefined,
      material: it.material || 'Finished Goods',
      quality: it.quality || 'Standard',
      qty: +it.qty || 0,
      rate: +it.rate || 0,
      costRate,
      profit: ((+it.rate || 0) - costRate) * (+it.qty || 0),
      total: (+it.total || 0) + (+it.taxAmt || 0)
    });
  }

  await Sale.create({
    saleId,
    unitId: inv.unitId,
    date: inv.date,
    clientId: inv.clientId,
    items: processedItems,
    totalQty,
    discount: inv.discount || 0,
    totalAmt: inv.totalAmt,
    payStatus: 'Unpaid',
    paidAmt: 0,
    outstanding: inv.totalAmt,
    invoiceRef: inv.invoiceId,
    note: inv.notes || `Invoiced via ${inv.invoiceId}`
  });

  // Update client ledger
  const client = await Client.findById(inv.clientId);
  if (client) {
    client.outstanding = (client.outstanding || 0) + (inv.totalAmt || 0);
    client.txns.push({
      date: inv.date,
      desc: `Sale (Invoice ${inv.invoiceId})`,
      dr: inv.totalAmt || 0,
      cr: 0
    });
    await client.save();
  }

  inv.saleRef = saleId;
  await inv.save();
}

r.get('/', auth, async (req, res) => {
  try {
    const q = req.query.unitId ? { unitId: req.query.unitId } : {};
    const list = await Invoice.find(q)
      .populate('clientId', 'name contact phone email address gst outstanding')
      .populate('createdBy', 'name initials role')
      .populate('approvedBy', 'name initials role')
      .sort({ createdAt: -1 });
    res.json(list);
  } catch(e) { res.status(500).json({message:e.message}); }
});

r.post('/', auth, async (req, res) => {
  try {
    const last = await Invoice.findOne().sort({ _id: -1 });
    let num = (await Invoice.countDocuments()) + 1;
    if (last && last.invoiceId) {
      const m = last.invoiceId.match(/\d+$/);
      if (m) num = Math.max(num, parseInt(m[0], 10) + 1);
    }
    const invoiceId = 'INV-' + String(num).padStart(3, '0');

    const isAdmin = req.user.role === 'Admin';
    const approvalStatus = isAdmin ? 'Approved' : 'Pending Approval';
    const approvedBy = isAdmin ? req.user.id : undefined;

    const data = {
      ...req.body,
      invoiceId,
      approvalStatus,
      createdBy: req.user.id,
      approvedBy
    };

    const doc = await Invoice.create(data);

    // Immediately reduce inventory stock for all created invoices
    for (const it of doc.items) {
      if (it.inventoryId) {
        const stock = await Inventory.findById(it.inventoryId);
        if (stock) {
          stock.soldWt = (stock.soldWt || 0) + (+it.qty || 0);
          if (stock.soldWt >= stock.createdWt) stock.status = 'Sold';
          else if (stock.soldWt > 0) stock.status = 'Partial';
          stock.ledger.push({ date: doc.date, type: 'OUT', qty: +it.qty || 0, note: `Invoice Sale (${doc.invoiceId})` });
          await stock.save();
        }
      }
    }

    if (isAdmin && data.payStatus !== 'Cancelled') {
      await createSaleFromInvoice(doc);
    }

    res.status(201).json(await Invoice.findById(doc._id).populate('clientId').populate('createdBy').populate('approvedBy'));
  } catch(e) { res.status(400).json({message:e.message}); }
});

r.put('/:id/status', auth, async (req, res) => {
  try {
    if (req.user.role !== 'Admin') return res.status(403).json({message: 'Only Admin can approve or reject invoices'});
    const { approvalStatus } = req.body;
    const inv = await Invoice.findById(req.params.id);
    if (!inv) return res.status(404).json({message: 'Not found'});

    const wasApproved = inv.approvalStatus === 'Approved';
    const wasRejected = inv.approvalStatus === 'Rejected';
    inv.approvalStatus = approvalStatus;
    if (approvalStatus === 'Approved') inv.approvedBy = req.user.id;

    // Restore stock if newly rejected
    if (approvalStatus === 'Rejected' && !wasRejected) {
      for (const it of inv.items) {
        if (it.inventoryId) {
          const stock = await Inventory.findById(it.inventoryId);
          if (stock) {
            stock.soldWt = Math.max(0, (stock.soldWt || 0) - (+it.qty || 0));
            if (stock.soldWt <= 0) stock.status = 'Available';
            else if (stock.soldWt < stock.createdWt) stock.status = 'Partial';
            stock.ledger.push({ date: new Date().toISOString().slice(0, 10), type: 'IN', qty: +it.qty || 0, note: `Restored from rejected Invoice (${inv.invoiceId})` });
            await stock.save();
          }
        }
      }
    }

    await inv.save();

    if (!wasApproved && approvalStatus === 'Approved' && inv.payStatus !== 'Cancelled') {
      await createSaleFromInvoice(inv);
    }

    res.json(await Invoice.findById(inv._id).populate('clientId').populate('createdBy').populate('approvedBy'));
  } catch(e) { res.status(400).json({message:e.message}); }
});

r.put('/:id', auth, async (req, res) => {
  try {
    const old = await Invoice.findById(req.params.id);
    if (!old) return res.status(404).json({ message: 'Not found' });
    if (old.payStatus === 'Paid' && req.user.role !== 'Admin') {
      return res.status(403).json({ message: 'BR-10: Paid invoice cannot be modified without prior Admin approval.' });
    }
    const doc = await Invoice.findByIdAndUpdate(req.params.id, req.body, {new: true})
      .populate('clientId').populate('createdBy').populate('approvedBy');
    res.json(doc);
  } catch(e) { res.status(400).json({message:e.message}); }
});

r.delete('/:id', auth, async (req, res) => {
  try {
    if (req.user.role !== 'Admin') return res.status(403).json({message: 'Only Admin can delete invoices'});
    const inv = await Invoice.findById(req.params.id);
    if (inv) {
      if (inv.approvalStatus !== 'Rejected') {
        for (const it of inv.items) {
          if (it.inventoryId) {
            const stock = await Inventory.findById(it.inventoryId);
            if (stock) {
              stock.soldWt = Math.max(0, (stock.soldWt || 0) - (+it.qty || 0));
              if (stock.soldWt <= 0) stock.status = 'Available';
              else if (stock.soldWt < stock.createdWt) stock.status = 'Partial';
              stock.ledger.push({ date: new Date().toISOString().slice(0, 10), type: 'IN', qty: +it.qty || 0, note: `Restored from deleted Invoice (${inv.invoiceId})` });
              await stock.save();
            }
          }
        }
      }
      if (inv.saleRef) {
        const sale = await Sale.findOneAndDelete({ saleId: inv.saleRef });
        if (sale) {
          const client = await Client.findById(inv.clientId);
          if (client) {
            client.outstanding = (client.outstanding || 0) - (sale.totalAmt || 0);
            await client.save();
          }
        }
      }
      await Invoice.findByIdAndDelete(req.params.id);
    }
    res.json({message: 'Deleted'});
  } catch(e) { res.status(400).json({message:e.message}); }
});

module.exports = r;
