import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import api from '../../lib/api';
import { fmtMon, todayISO, fmtDate, fmtWt } from '../../utils/fmt';
import { Modal, Drawer } from '../../components/Modal';

const EMPTY_ITEM = { inventoryId: '', material: '', quality: '', qty: 1, rate: '', gstRate: 18, taxAmt: 0, total: 0 };

export default function Invoices({ setActions }) {
  const { activeUnitId, activeUnit, isAdmin, toast } = useApp();
  const [invoices, setInvoices] = useState([]);
  const [clients, setClients] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [modal, setModal] = useState(null); // null | {} | invoice
  const [drawer, setDrawer] = useState(null); // null | invoice
  const [q, setQ] = useState('');

  const load = async () => {
    if (!activeUnitId) return;
    const [invRes, clRes, stockRes] = await Promise.all([
      api.get('/invoices', { params: { unitId: activeUnitId } }),
      api.get('/clients', { params: { unitId: activeUnitId } }),
      api.get('/inventory', { params: { unitId: activeUnitId, category: 'finished' } })
    ]);
    setInvoices(invRes.data);
    setClients(clRes.data);
    setInventory(stockRes.data.filter(i => i.status !== 'Consumed' && i.status !== 'Sold'));
  };

  useEffect(() => { load(); }, [activeUnitId]);
  
  useEffect(() => {
    setActions(
      <button className="btn btn-p" onClick={() => setModal({})}>
        <i className="ti ti-plus"></i>New Invoice
      </button>
    );
  }, []);

  const save = async (form) => {
    const { _id, clientId, date, dueDate, items, notes, discount } = form;
    if (!clientId || !items.length || !items[0].inventoryId) {
      toast('Client and at least one finished product required.', 'err');
      return;
    }

    const subTotal = items.reduce((a, i) => a + (+i.total || 0), 0);
    const taxAmt = items.reduce((a, i) => a + (+i.taxAmt || 0), 0);
    const disc = +discount || 0;
    const totalAmt = Math.max(0, subTotal + taxAmt - disc);

    if (_id) {
      await api.put('/invoices/' + _id, {
        date: fmtDate(date), dueDate: dueDate ? fmtDate(dueDate) : '',
        clientId, items, subTotal, taxAmt, discount: disc, totalAmt,
        outstanding: totalAmt - (form.paidAmt || 0), notes
      });
      toast('Invoice updated.'); load(); setModal(null);
      return;
    }

    await api.post('/invoices', {
      unitId: activeUnitId, date: fmtDate(date), dueDate: dueDate ? fmtDate(dueDate) : '',
      clientId, items, subTotal, taxAmt, discount: disc, totalAmt,
      paidAmt: 0, outstanding: totalAmt, payStatus: 'Unpaid', notes
    });
    toast('Invoice generated.'); load(); setModal(null);
  };

  const statusAction = async (inv, approvalStatus) => {
    try {
      const res = await api.put(`/invoices/${inv._id}/status`, { approvalStatus });
      toast(`Invoice ${approvalStatus.toLowerCase()}.`, approvalStatus === 'Approved' ? 'ok' : 'err');
      load();
      if (drawer && drawer._id === inv._id) {
        setDrawer(res.data);
      }
    } catch(e) { toast(e.response?.data?.message || 'Error updating status', 'err'); }
  };

  const del = async (id) => {
    if (!confirm('Delete invoice? This will also revert linked Outflow sale.')) return;
    await api.delete('/invoices/' + id);
    toast('Deleted.'); load();
  };

  const filtered = invoices.filter(i => {
    if (!q) return true;
    const query = q.toLowerCase();
    const idStr = i.invoiceId?.toLowerCase() || '';
    const clName = i.clientId?.name?.toLowerCase() || '';
    const noteStr = i.notes?.toLowerCase() || '';
    const stStr = i.approvalStatus?.toLowerCase() || '';
    return idStr.includes(query) || clName.includes(query) || noteStr.includes(query) || stStr.includes(query);
  });

  return (
    <div className="page">
      <div className="kpi-grid">
        <div className="kpi-card"><div className="kpi-label">Total Invoiced</div><div className="kpi-value ok">{fmtMon(invoices.reduce((a, i) => a + (i.totalAmt || 0), 0))}</div><div className="kpi-sub">{invoices.length} invoices</div></div>
        <div className="kpi-card"><div className="kpi-label">Collected</div><div className="kpi-value ok">{fmtMon(invoices.reduce((a, i) => a + (i.paidAmt || 0), 0))}</div></div>
        <div className="kpi-card"><div className="kpi-label">To Be Paid</div><div className="kpi-value err">{fmtMon(invoices.reduce((a, i) => a + (i.outstanding || 0), 0))}</div></div>
        <div className="kpi-card"><div className="kpi-label">Pending Approval</div><div className="kpi-value warn">{invoices.filter(i => i.approvalStatus === 'Pending Approval').length}</div></div>
      </div>

      <div className="table-card">
        <div className="table-toolbar">
          <h3>Invoices Register</h3>
          <div className="search-box">
            <i className="ti ti-search"></i>
            <input placeholder="Search invoice ID, client, status…" value={q} onChange={e => setQ(e.target.value)} />
          </div>
        </div>
        <div className="tbl-scroll">
          <table>
            <thead>
              <tr><th>Invoice ID</th><th>Date</th><th>Client</th><th>To Be Paid</th><th>Total Paid</th><th>Payment</th><th>Approval</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {filtered.map(inv => {
                const cl = inv.clientId;
                return (
                  <tr key={inv._id}>
                    <td className="mono" style={{ fontWeight: 700, color: 'var(--p)' }}>{inv.invoiceId}</td>
                    <td>{inv.date}</td>
                    <td><div>{cl?.name || '—'}</div><div style={{ fontSize: 11, color: 'var(--tx3)' }}>{cl?.phone || cl?.contact || ''}</div></td>
                    <td className="mono" style={{ fontWeight: 700 }}>{fmtMon(inv.totalAmt)}</td>
                    <td className="mono" style={{ color: 'var(--ok)' }}>{fmtMon(inv.paidAmt)}</td>
                    <td><span className={`badge ${inv.payStatus === 'Paid' ? 'b-ok' : inv.payStatus === 'Partial' ? 'b-warn' : 'b-err'}`}>{inv.payStatus}</span></td>
                    <td>
                      <span className={`badge ${inv.approvalStatus === 'Approved' ? 'b-ok' : inv.approvalStatus === 'Pending Approval' ? 'b-warn' : 'b-err'}`}>
                        {inv.approvalStatus}
                      </span>
                    </td>
                    <td>
                      <div className="act-btns">
                        <button className="icon-btn" title="View Details" onClick={() => setDrawer(inv)}><i className="ti ti-eye"></i></button>
                        <button className="icon-btn" style={{color: 'var(--p)'}} title="Print / Export PDF" onClick={() => setDrawer(inv)}><i className="ti ti-printer"></i></button>
                        {isAdmin && inv.approvalStatus === 'Pending Approval' && (
                          <>
                            <button className="icon-btn ok" title="Approve" onClick={() => statusAction(inv, 'Approved')}><i className="ti ti-check"></i></button>
                            <button className="icon-btn danger" title="Reject" onClick={() => statusAction(inv, 'Rejected')}><i className="ti ti-x"></i></button>
                          </>
                        )}
                        {(!(!isAdmin && inv.payStatus === 'Paid')) && (
                          <button className="icon-btn" title="Edit" onClick={() => setModal(inv)}><i className="ti ti-pencil"></i></button>
                        )}
                        {isAdmin && <button className="icon-btn danger" title="Delete" onClick={() => del(inv._id)}><i className="ti ti-trash"></i></button>}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!filtered.length && <tr><td colSpan="8" className="empty-row"><i className="ti ti-file-invoice"></i><p>No invoices found</p></td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {modal !== null && <InvoiceModal invoice={modal._id ? modal : null} clients={clients} inventory={inventory} onClose={() => setModal(null)} onSave={save} />}
      {drawer && <InvoiceDrawer invoice={drawer} invoices={invoices} activeUnit={activeUnit} isAdmin={isAdmin} onClose={() => setDrawer(null)} onStatus={statusAction} />}
    </div>
  );
}

function InvoiceModal({ invoice, clients, inventory, onClose, onSave }) {
  const [date, setDate] = useState(invoice?.date || todayISO());
  const [dueDate, setDueDate] = useState(invoice?.dueDate || '');
  const [clientId, setClientId] = useState(invoice?.clientId?._id || invoice?.clientId || '');
  const [items, setItems] = useState(invoice?.items?.length ? invoice.items : [{ ...EMPTY_ITEM }]);
  const [discount, setDiscount] = useState(invoice?.discount !== undefined && invoice?.discount !== 0 ? invoice.discount : '');
  const [notes, setNotes] = useState(invoice?.notes || '');

  const pickStock = (i, stockId) => {
    const ni = [...items];
    const stock = inventory.find(x => x._id === stockId);
    if (!stock) {
      ni[i] = { ...EMPTY_ITEM };
    } else {
      const availWt = stock.createdWt - stock.soldWt - stock.returnedWt;
      const q = ni[i].qty || 1;
      const r = ni[i].rate || '';
      const base = (+q || 0) * (+r || 0);
      const gstRate = stock.gstRate !== undefined ? stock.gstRate : 18;
      const taxAmt = Math.round((base * gstRate) / 100);
      ni[i] = {
        inventoryId: stock._id,
        material: stock.material,
        quality: stock.quality,
        maxAvail: availWt,
        gstRate,
        qty: q,
        rate: r,
        taxAmt,
        total: base
      };
    }
    setItems(ni);
  };

  const updItem = (i, k, v) => {
    const ni = [...items];
    const updated = { ...ni[i], [k]: v };
    const q = updated.qty || 0;
    const r = updated.rate || 0;
    const base = (+q) * (+r);
    const gstRate = updated.gstRate !== undefined ? updated.gstRate : 18;
    updated.taxAmt = Math.round((base * gstRate) / 100);
    updated.total = base;
    ni[i] = updated;
    setItems(ni);
  };

  const subTotal = items.reduce((a, i) => a + (+i.total || 0), 0);
  const taxAmt = items.reduce((a, i) => a + (+i.taxAmt || 0), 0);
  const disc = +discount || 0;
  const totalAmt = Math.max(0, subTotal + taxAmt - disc);

  return (
    <Modal title={invoice && invoice._id ? `Edit Invoice (${invoice.invoiceId})` : "Create New Invoice"} size="modal-lg" onClose={onClose}
      footer={<><button className="btn btn-s" onClick={onClose}>Cancel</button><button className="btn btn-p" onClick={() => onSave({ _id: invoice?._id, clientId, date, dueDate, items, notes, discount: disc, paidAmt: invoice?.paidAmt })}><i className="ti ti-device-floppy"></i>Save Invoice</button></>}>
      <div className="fr3">
        <div className="fg"><label>Date <span className="req">*</span></label><input type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
        <div className="fg"><label>Due Date</label><input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} /></div>
        <div className="fg"><label>Client <span className="req">*</span></label>
          <select value={clientId} onChange={e => setClientId(e.target.value)}>
            <option value="">Select client…</option>
            {clients.filter(c => c.status === 'Active').map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
          </select>
        </div>
      </div>
      <div className="fg" style={{ marginTop: 12 }}>
        <label>Notes / Terms</label>
        <input placeholder="Enter payment terms or notes…" value={notes} onChange={e => setNotes(e.target.value)} />
      </div>
      <div className="fsec">
        <div className="fsec-title">Finished Goods Billed
          <button className="btn btn-s btn-sm" onClick={() => setItems(p => [...p, { ...EMPTY_ITEM }])}><i className="ti ti-plus"></i>Add Product</button>
        </div>
        {items.map((it, i) => {
          const stock = inventory.find(x => x._id === it.inventoryId);
          const avail = stock ? stock.createdWt - stock.soldWt - stock.returnedWt : (it.maxAvail || 0);
          return (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '3fr 1fr 1fr 1fr 1fr 32px', gap: 10, marginBottom: 10, alignItems: 'end' }}>
              <div className="fg"><label>Finished Product <span className="req">*</span></label>
                <select value={it.inventoryId || ''} onChange={e => pickStock(i, e.target.value)}>
                  <option value="">Select stock batch…</option>
                  {inventory.map(st => {
                    const rem = st.createdWt - st.soldWt - st.returnedWt;
                    return <option key={st._id} value={st._id}>{st.batchId} · {st.material} ({st.quality}) — Avail: {fmtWt(rem)} (GST {st.gstRate || 18}%)</option>;
                  })}
                </select>
              </div>
              <div className="fg"><label>Qty (units/kg)</label><input type="number" step="0.01" value={it.qty} onChange={e => updItem(i, 'qty', e.target.value)} />{stock && <span style={{fontSize:10,color:'var(--tx3)'}}>Max: {fmtWt(avail)}</span>}</div>
              <div className="fg"><label>Rate (₹)</label><input type="number" step="0.01" value={it.rate} onChange={e => updItem(i, 'rate', e.target.value)} /></div>
              <div className="fg"><label>GST ({it.gstRate || 18}%)</label><input disabled value={fmtMon(it.taxAmt || 0)} style={{fontWeight:600,color:'var(--tx3)'}} /></div>
              <div className="fg"><label>Amount</label><input disabled value={fmtMon((it.total || 0) + (it.taxAmt || 0))} style={{ fontWeight: 700 }} /></div>
              <div>{items.length > 1 && <button className="icon-btn err" style={{ marginBottom: 4 }} onClick={() => setItems(p => p.filter((_, idx) => idx !== i))}><i className="ti ti-trash"></i></button>}</div>
            </div>
          );
        })}
      </div>
      <div className="fr2" style={{ marginTop: 16, justifyContent: 'flex-end', background: 'var(--bg2)', padding: 14, borderRadius: 8, border: '1px solid var(--bd)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 260, textAlign: 'right', marginLeft: 'auto' }}>
          <div><span style={{ color: 'var(--tx3)' }}>Subtotal:</span> <strong>{fmtMon(subTotal)}</strong></div>
          <div><span style={{ color: 'var(--tx3)' }}>Total GST:</span> <strong>+{fmtMon(taxAmt)}</strong></div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10 }}>
            <span style={{ color: 'var(--err)', fontWeight: 600 }}>Discount (₹):</span>
            <input type="number" step="0.01" style={{ width: 110, padding: '4px 8px', textAlign: 'right', fontWeight: 600, color: 'var(--err)' }} placeholder="0" value={discount} onChange={e => setDiscount(e.target.value)} />
          </div>
          <div style={{ fontSize: 18, color: 'var(--p)', borderTop: '1px solid var(--bd)', paddingTop: 8, marginTop: 4 }}>
            <span>To Be Paid:</span> <strong>{fmtMon(totalAmt)}</strong>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function InvoiceDrawer({ invoice: inv, invoices = [], activeUnit, isAdmin, onClose, onStatus }) {
  const cl = inv.clientId;
  const clId = cl?._id || cl;
  const prevInvoices = (invoices || []).filter(x => {
    const xClId = x.clientId?._id || x.clientId;
    return String(xClId) === String(clId) && String(x._id) < String(inv._id) && x.payStatus !== 'Cancelled';
  });
  const prevOutstanding = prevInvoices.reduce((a, x) => a + (+x.outstanding || 0), 0);
  const grandTotal = (inv.totalAmt || 0) + prevOutstanding;

  return (
    <Drawer title={`Invoice — ${inv.invoiceId}`} onClose={onClose} size="drawer-lg"
      footer={
        <div style={{ display: 'flex', gap: 10, width: '100%', alignItems: 'center' }}>
          <button className="btn btn-s" onClick={onClose}>Close</button>
          {inv.approvalStatus !== 'Approved' && <span style={{fontSize:12,color:'var(--warn)'}}><i className="ti ti-info-circle"></i> Draft / Unapproved</span>}
          <button className="btn btn-p" style={{ marginLeft: 'auto' }} onClick={() => window.print()}>
            <i className="ti ti-printer"></i>Print / Download PDF
          </button>
        </div>
      }>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .printable-invoice, .printable-invoice * { visibility: visible; }
          .printable-invoice { position: absolute; left: 0; top: 0; width: 100%; padding: 40px; background: white !important; color: black !important; font-family: sans-serif; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="printable-invoice">
        {isAdmin && inv.approvalStatus === 'Pending Approval' && (
          <div className="no-print" style={{ background: 'var(--warn-bg)', border: '1px solid var(--warn)', padding: 12, borderRadius: 8, marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div><strong style={{ color: 'var(--warn)' }}><i className="ti ti-alert-circle"></i> Employee Submission Pending Approval</strong><div style={{ fontSize: 12 }}>Created by {inv.createdBy?.name || 'Employee'}. Review line items before approving.</div></div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-ok btn-sm" onClick={() => onStatus(inv, 'Approved')}><i className="ti ti-check"></i>Approve</button>
              <button className="btn danger btn-sm" onClick={() => onStatus(inv, 'Rejected')}><i className="ti ti-x"></i>Reject</button>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '3px solid #333', paddingBottom: 16, marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 28, fontWeight: 900, letterSpacing: -0.5, color: '#111' }}>{activeUnit?.name || 'Recycle ERP'}</div>
            {activeUnit?.shortAddress && <div style={{ fontSize: 13, color: '#555', marginTop: 4 }}>{activeUnit.shortAddress}</div>}
            {activeUnit?.gst && <div style={{ fontSize: 13, color: '#555' }}>GSTIN: {activeUnit.gst}</div>}
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#444' }}>TAX INVOICE</div>
            <div className="mono" style={{ fontSize: 15, fontWeight: 700, marginTop: 4 }}>{inv.invoiceId}</div>
            <div style={{ fontSize: 13, color: '#666', marginTop: 2 }}>Date: {inv.date}</div>
            {inv.dueDate && <div style={{ fontSize: 13, color: '#666' }}>Due: {inv.dueDate}</div>}
          </div>
        </div>

        <div style={{ marginBottom: 20, background: '#f9f9f9', padding: 14, borderRadius: 6, border: '1px solid #eee' }}>
          <div style={{ fontSize: 11, textTransform: 'uppercase', color: '#888', fontWeight: 700, marginBottom: 4 }}>Billed To:</div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>{cl?.name || 'Customer'}</div>
          {cl?.address && <div style={{ fontSize: 13, maxWidth: 300 }}>{cl.address}</div>}
          {cl?.phone && <div style={{ fontSize: 13 }}>Phone: {cl.phone}</div>}
          {cl?.gst && <div style={{ fontSize: 13 }}>GSTIN: {cl.gst}</div>}
        </div>

        <table className="dtbl" style={{ width: '100%', marginBottom: 20, borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f0f0f0', borderBottom: '2px solid #ccc' }}>
              <th style={{ padding: 8, textAlign: 'left' }}>#</th>
              <th style={{ padding: 8, textAlign: 'left' }}>Finished Goods Product</th>
              <th style={{ padding: 8, textAlign: 'right' }}>Qty</th>
              <th style={{ padding: 8, textAlign: 'right' }}>Rate</th>
              <th style={{ padding: 8, textAlign: 'right' }}>GST %</th>
              <th style={{ padding: 8, textAlign: 'right' }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {inv.items?.map((it, idx) => (
              <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: 8 }}>{idx + 1}</td>
                <td style={{ padding: 8, fontWeight: 600 }}>{it.material} <span style={{fontWeight:400,fontSize:12,color:'#666'}}>({it.quality})</span></td>
                <td style={{ padding: 8, textAlign: 'right' }}>{it.qty}</td>
                <td style={{ padding: 8, textAlign: 'right' }}>{fmtMon(it.rate)}</td>
                <td style={{ padding: 8, textAlign: 'right' }}>{it.gstRate || 18}%</td>
                <td style={{ padding: 8, textAlign: 'right', fontWeight: 700 }}>{fmtMon((it.total || 0) + (it.taxAmt || 0))}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 24 }}>
          <div style={{ minWidth: 240, textAlign: 'right' }}>
            <div style={{ padding: '4px 0' }}>Subtotal: <strong>{fmtMon(inv.subTotal)}</strong></div>
            {inv.taxAmt > 0 && <div style={{ padding: '4px 0' }}>Total GST: <strong>+{fmtMon(inv.taxAmt)}</strong></div>}
            {inv.discount > 0 && <div style={{ padding: '4px 0', color: 'red' }}>Discount: <strong>-{fmtMon(inv.discount)}</strong></div>}
            <div style={{ fontSize: 16, borderTop: '2px solid #333', padding: '6px 0', marginTop: 4 }}>Current Bill Amt: <strong>{fmtMon(inv.totalAmt)}</strong></div>
            <div style={{ color: '#d97706', fontSize: 14, padding: '2px 0' }}>Prev Outstanding: <strong>{fmtMon(prevOutstanding)}</strong></div>
            <div style={{ fontSize: 18, borderTop: '1px dashed #333', padding: '8px 0', fontWeight: 800 }}>Total Amt Payable: <strong>{fmtMon(grandTotal)}</strong></div>
            <div style={{ color: 'green', fontSize: 14 }}>Paid on Bill: <strong>{fmtMon(inv.paidAmt)}</strong></div>
            <div style={{ color: ((inv.outstanding || 0) + prevOutstanding) > 0 ? 'red' : 'green', fontWeight: 700, fontSize: 15 }}>Net Balance Due: <strong>{fmtMon((inv.outstanding || 0) + prevOutstanding)}</strong></div>
          </div>
        </div>

        {inv.notes && <div style={{ fontSize: 12, borderTop: '1px solid #ddd', paddingTop: 10, color: '#555' }}><strong>Terms & Notes:</strong> {inv.notes}</div>}
      </div>

      <div className="no-print" style={{ background: 'var(--bg2)', padding: 14, borderRadius: 8, marginTop: 16, border: '1px solid var(--bd)', display: 'flex', alignItems: 'center', gap: 10 }}>
        <i className="ti ti-package-export" style={{ fontSize: 20, color: 'var(--p)' }}></i>
        <div style={{ fontSize: 13 }}>
          <strong>Transaction Tracking & Partial Payments</strong>
          <div style={{ color: 'var(--tx3)', fontSize: 12 }}>
            Partial payments and transaction history for this client are managed inside the <strong>Outflow (Sales)</strong> module under transaction ID: <strong className="mono" style={{ color: 'var(--p)' }}>{inv.saleRef || 'Pending Admin Approval'}</strong>.
          </div>
        </div>
      </div>
    </Drawer>
  );
}
