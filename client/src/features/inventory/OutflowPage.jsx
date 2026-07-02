import React, { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Modal, Drawer } from '../../components/Modal';
import { fmtMon, fmtWt, fmtDate, todayISO } from '../../utils/fmt';
import api from '../../lib/api';

const EMPTY_ITEM = { inventoryId: '', material: '', qty: 0, rate: 0, total: 0 };

export default function Outflow({ setActions }) {
  const { activeUnitId, toast, isAdmin } = useApp();
  const [sales, setSales] = useState([]);
  const [clients, setClients] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [modal, setModal] = useState(null);
  const [drawer, setDrawer] = useState(null);
  const [q, setQ] = useState('');

  const load = async () => {
    if (!activeUnitId) return;
    const [sa, cl, inv] = await Promise.all([
      api.get('/sales', { params: { unitId: activeUnitId } }),
      api.get('/clients', { params: { unitId: activeUnitId } }),
      api.get('/inventory', { params: { unitId: activeUnitId, category: 'finished' } }) // Only finished goods can be sold
    ]);
    setSales(sa.data);
    setClients(cl.data);
    setInventory(inv.data.filter(i => i.status !== 'Consumed' && i.status !== 'Sold'));
  };

  useEffect(() => { load(); }, [activeUnitId]);
  useEffect(() => {
    setActions(<button className="btn btn-p" onClick={() => setModal({})}><i className="ti ti-plus"></i>New Sale</button>);
  }, []);

  const save = async (form) => {
    const { _id, clientId, date, items, payType, payAmt, payNote, note } = form;
    if (!clientId || !items.length) { toast('Client and at least one item required.', 'err'); return; }
    
    const totalQty = items.reduce((a, i) => a + (+i.qty || 0), 0);
    const totalAmt = items.reduce((a, i) => a + (+i.total || 0), 0);

    if (_id) {
      const oldSale = sales.find(x => x._id === _id) || {};
      const oldPaid = oldSale.paidAmt || 0;
      const outstanding = totalAmt - oldPaid;
      const payStatus = oldPaid === 0 ? 'Unpaid' : oldPaid >= totalAmt ? 'Paid' : 'Partial';
      
      const diffAmt = totalAmt - (oldSale.totalAmt || 0);
      await api.put('/sales/' + _id, {
        date: fmtDate(date), clientId,
        items: items.map((it, idx) => ({ ...it, id: idx + 1 })),
        totalQty, totalAmt, payStatus, outstanding, note
      });
      
      if (diffAmt !== 0) {
        const client = clients.find(c => c._id === (oldSale.clientId?._id || oldSale.clientId));
        if (client) {
          await api.put('/clients/' + client._id, { outstanding: (client.outstanding || 0) + diffAmt });
        }
      }

      toast('Sale updated.'); load(); setModal(null);
      return;
    }

    const paidAmt = payType !== 'None' ? (+payAmt || 0) : 0;
    const outstanding = totalAmt - paidAmt;
    const payStatus = paidAmt === 0 ? 'Unpaid' : paidAmt >= totalAmt ? 'Paid' : 'Partial';
    const payLog = paidAmt > 0 ? [{ date: fmtDate(date), type: payType, amt: paidAmt, note: payNote }] : [];
    
    await api.post('/sales', {
      unitId: activeUnitId, date: fmtDate(date), clientId,
      items: items.map((it, idx) => ({ ...it, id: idx + 1 })),
      totalQty, totalAmt, payStatus, paidAmt, outstanding, payLog, note
    });
    toast('Sale created.'); load(); setModal(null);
  };

  const addPay = async (sale, type, amt, note) => {
    const newPaid = (sale.paidAmt || 0) + (+amt || 0);
    const outstanding = (sale.totalAmt || 0) - newPaid;
    const payStatus = newPaid === 0 ? 'Unpaid' : newPaid >= sale.totalAmt ? 'Paid' : 'Partial';
    const payLog = [...(sale.payLog || []), { date: fmtDate(todayISO()), type, amt: +amt, note }];
    const updated = await api.put('/sales/' + sale._id, { paidAmt: newPaid, outstanding, payStatus, payLog });
    
    const client = clients.find(c => c._id === (sale.clientId?._id || sale.clientId));
    if (client) {
      await api.put('/clients/' + client._id, { outstanding: (client.outstanding || 0) - (+amt || 0) });
    }

    toast('Payment recorded.'); load(); setDrawer(updated.data);
  };

  const editPay = async (sale, idx, newType, newAmt, newNote) => {
    const pl = [...(sale.payLog || [])];
    const oldEntryAmt = +(pl[idx]?.amt || 0);
    pl[idx] = { ...pl[idx], amt: +newAmt || 0, type: newType, note: newNote };
    const newPaid = pl.reduce((a, b) => a + (+b.amt || 0), 0);
    const outstanding = (sale.totalAmt || 0) - newPaid;
    const payStatus = newPaid === 0 ? 'Unpaid' : newPaid >= sale.totalAmt ? 'Paid' : 'Partial';
    const updated = await api.put('/sales/' + sale._id, { paidAmt: newPaid, outstanding, payStatus, payLog: pl });
    
    const client = clients.find(c => c._id === (sale.clientId?._id || sale.clientId));
    if (client) {
      const diff = (+newAmt || 0) - oldEntryAmt;
      await api.put('/clients/' + client._id, { outstanding: (client.outstanding || 0) - diff });
    }

    toast('Payment updated.'); load(); setDrawer(updated.data);
  };

  const deletePay = async (sale, idx) => {
    if (!confirm('Delete this payment entry?')) return;
    const pl = [...(sale.payLog || [])];
    const delAmt = +(pl[idx]?.amt || 0);
    pl.splice(idx, 1);
    const newPaid = pl.reduce((a, b) => a + (+b.amt || 0), 0);
    const outstanding = (sale.totalAmt || 0) - newPaid;
    const payStatus = newPaid === 0 ? 'Unpaid' : newPaid >= sale.totalAmt ? 'Paid' : 'Partial';
    const updated = await api.put('/sales/' + sale._id, { paidAmt: newPaid, outstanding, payStatus, payLog: pl });
    
    const client = clients.find(c => c._id === (sale.clientId?._id || sale.clientId));
    if (client) {
      await api.put('/clients/' + client._id, { outstanding: (client.outstanding || 0) + delAmt });
    }

    toast('Payment deleted.'); load(); setDrawer(updated.data);
  };

  const del = async (id) => {
    if (!confirm('Delete this sale? (Note: Inventory and client balances will not automatically revert)')) return;
    await api.delete('/sales/' + id);
    toast('Deleted.'); load();
  };

  const getRunningOutstanding = (client, currentSale) => {
    const saleList = sales.filter(s => (s.clientId?._id || s.clientId) === client?._id && s.payStatus !== 'Cancelled')
      .sort((a, b) => new Date(a.createdAt || a.date) - new Date(b.createdAt || b.date) || (a.saleId || '').localeCompare(b.saleId || ''));
    let runningTotal = 0;
    for (const s of saleList) {
      runningTotal += (s.outstanding || 0);
      if (s._id === currentSale._id) break;
    }
    return runningTotal;
  };

  const filtered = sales.filter(s => {
    if (!q) return true;
    const query = q.toLowerCase();
    const clientName = s.clientId?.name?.toLowerCase() || '';
    const idStr = s.saleId?.toLowerCase() || '';
    const noteStr = s.note?.toLowerCase() || '';
    const dateStr = s.date?.toLowerCase() || '';
    return idStr.includes(query) || clientName.includes(query) || noteStr.includes(query) || dateStr.includes(query);
  });

  return (
    <div className="page">
      <div className="kpi-grid">
        <div className="kpi-card"><div className="kpi-label">Total Sales</div><div className="kpi-value ok">{fmtMon(sales.reduce((a, s) => a + (s.totalAmt || 0), 0))}</div><div className="kpi-sub">{sales.length} entries</div></div>
        <div className="kpi-card"><div className="kpi-label">Received</div><div className="kpi-value ok">{fmtMon(sales.reduce((a, s) => a + (s.paidAmt || 0), 0))}</div></div>
        <div className="kpi-card"><div className="kpi-label">Outstanding</div><div className="kpi-value err">{fmtMon(sales.reduce((a, s) => a + (s.outstanding || 0), 0))}</div></div>
      </div>

      <div className="table-card">
        <div className="table-toolbar"><h3>Sales Register</h3>
          <div className="search-box"><i className="ti ti-search"></i><input placeholder="Search notes, client, date…" value={q} onChange={e => setQ(e.target.value)} /></div>
        </div>
        <div className="tbl-scroll"><table>
          <thead><tr><th>Notes</th><th>Date</th><th>Client</th><th>Qty</th><th>Amount</th><th>Payment</th><th>Actions</th></tr></thead>
          <tbody>
            {filtered.map(s => {
              const client = s.clientId;
              return (
                <tr key={s._id}>
                  <td>{s.note || '—'}</td>
                  <td>{s.date}</td>
                  <td>
                    <div>{client?.name || '—'}</div>
                    {client && <div style={{ fontSize: 11, color: 'var(--err)' }}>Total Out: {fmtMon(getRunningOutstanding(client, s))}</div>}
                  </td>
                  <td className="mono">{fmtWt(s.totalQty)}</td>
                  <td className="mono" style={{ color: 'var(--ok)', fontWeight: 700 }}>{fmtMon(s.totalAmt)}</td>
                  <td><span className={`badge ${s.payStatus === 'Paid' ? 'b-ok' : s.payStatus === 'Partial' ? 'b-warn' : 'b-err'}`}>{s.payStatus}</span></td>
                  <td><div className="act-btns">
                    <button className="icon-btn" title="View" onClick={() => setDrawer(s)}><i className="ti ti-eye"></i></button>
                    <button className="icon-btn" title="Edit" onClick={() => setModal(s)}><i className="ti ti-pencil"></i></button>
                    {isAdmin && <button className="icon-btn danger" title="Delete" onClick={() => del(s._id)}><i className="ti ti-trash"></i></button>}
                  </div></td>
                </tr>
              );
            })}
            {!filtered.length && <tr><td colSpan="7" className="empty-row"><i className="ti ti-receipt"></i><p>No sales yet</p></td></tr>}
          </tbody>
        </table></div>
      </div>

      {modal !== null && <SaleModal sale={modal._id ? modal : null} clients={clients} inventory={inventory} onClose={() => setModal(null)} onSave={save} />}
      {drawer && <SaleDrawer sale={drawer} onClose={() => setDrawer(null)} onPay={addPay} onEditPay={editPay} onDeletePay={deletePay} onReturn={async (s, wt, dm, nt) => {
        try {
          const res = await api.post('/sales/return', { saleId: s._id, returnWt: wt, isDamaged: dm, note: nt });
          toast('Return processed successfully', 'ok');
          setDrawer(res.data.sale);
          load();
        } catch(err) { toast(err.response?.data?.message || err.message, 'err'); }
      }} />}
    </div>
  );
}

function SaleModal({ sale, clients, inventory, onClose, onSave }) {
  const [date, setDate] = useState(sale?.date ? sale.date : todayISO());
  const [clientId, setClientId] = useState(sale?.clientId?._id || sale?.clientId || '');
  const [items, setItems] = useState(sale?.items?.length ? sale.items : [{ ...EMPTY_ITEM }]);
  const [payType, setPayType] = useState(sale?.payLog?.[0]?.type || 'None');
  const [payAmt, setPayAmt] = useState(sale?.paidAmt !== undefined && sale?.paidAmt !== 0 ? sale.paidAmt : '');
  const [payNote, setPayNote] = useState(sale?.payLog?.[0]?.note || '');
  const [note, setNote] = useState(sale?.note || '');

  const updateItem = (i, k, v) => {
    const newItems = [...items];
    newItems[i] = { ...newItems[i], [k]: v };
    const it = newItems[i];
    
    if (k === 'inventoryId') {
      const inv = inventory.find(x => x._id === v);
      if (inv) {
        it.material = inv.material;
        it.quality = inv.quality || '';
        it.maxQty = inv.createdWt - inv.soldWt; // Available qty
      }
    }
    
    it.total = (+it.qty || 0) * (+it.rate || 0);
    setItems(newItems);
  };

  const totalAmt = items.reduce((a, i) => a + (+i.total || 0), 0);

  return (
    <Modal title={sale && sale._id ? "Edit Sale Entry" : "New Sale Entry"} size="modal-lg" onClose={onClose}
      footer={<><button className="btn btn-s" onClick={onClose}>Cancel</button><button className="btn btn-p" onClick={() => onSave({ _id: sale?._id, clientId, date, items, payType, payAmt, payNote, note })}><i className="ti ti-device-floppy"></i>Save Sale</button></>}>
      <div className="fr2">
        <div className="fg"><label>Date <span className="req">*</span></label><input type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
        <div className="fg"><label>Client <span className="req">*</span></label>
          <select value={clientId} onChange={e => setClientId(e.target.value)}>
            <option value="">Select client…</option>
            {clients.filter(c => c.status === 'Active').map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
          </select>
        </div>
      </div>
      <div className="fg" style={{ marginBottom: 12 }}>
        <label>Sale Notes / Description</label>
        <input value={note} onChange={e => setNote(e.target.value)} placeholder="Optional sale notes…" />
      </div>
      <div className="fsec">
        <div className="fsec-title">Items
          <button className="btn btn-s btn-sm" onClick={() => setItems(p => [...p, { ...EMPTY_ITEM }])}><i className="ti ti-plus"></i>Add Item</button>
        </div>
        {items.map((it, i) => (
          <div key={i} className="item-line">
            <div className="item-line-hdr">
              <span className="item-num">Item {i + 1}</span>
              {items.length > 1 && <i className="ti ti-trash item-del" onClick={() => setItems(p => p.filter((_, j) => j !== i))}></i>}
            </div>
            <div className="fr2">
              <div className="fg"><label>Inventory Batch</label>
                <select value={it.inventoryId} onChange={e => updateItem(i, 'inventoryId', e.target.value)}>
                  <option value="">Select inventory batch…</option>
                  {inventory.map(inv => (
                    <option key={inv._id} value={inv._id}>
                      {inv.batchId} - {inv.material} ({fmtWt(inv.createdWt - inv.soldWt)} avail) {inv.quality === 'Trading' ? '[Trading]' : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="fg"><label>Material Name</label><input value={it.material} readOnly /></div>
            </div>
            <div className="fr3">
              <div className="fg"><label>Qty (Max: {it.maxQty ? fmtWt(it.maxQty) : '-'})</label><input type="number" step="0.01" value={it.qty || ''} onChange={e => updateItem(i, 'qty', e.target.value)} /></div>
              <div className="fg"><label>Rate (₹)</label><input type="number" step="0.01" value={it.rate || ''} onChange={e => updateItem(i, 'rate', e.target.value)} /></div>
              <div className="fg"><label>Total</label><input readOnly value={fmtMon(it.total)} /></div>
            </div>
          </div>
        ))}
        <div className="calc-box">
          <div className="cl">Total Amount</div>
          <div className="cv">{fmtMon(totalAmt)}</div>
        </div>
      </div>
      <div className="fsec">
        <div className="fsec-title">Payment Received Now</div>
        <div className="pay-type-btns">
          {['None', 'Cash', 'Bank Transfer', 'UPI'].map(t => (
            <button key={t} className={`ptb${payType === t ? ' sel' : ''}`} onClick={() => setPayType(t)}>{t}</button>
          ))}
        </div>
        {payType !== 'None' && (
          <div className="fr2">
            <div className="fg"><label>Amount Received</label><input type="number" value={payAmt} onChange={e => setPayAmt(e.target.value)} placeholder="0" /></div>
            <div className="fg"><label>Note</label><input value={payNote} onChange={e => setPayNote(e.target.value)} placeholder="e.g. Adv cash" /></div>
          </div>
        )}
      </div>
    </Modal>
  );
}

function SaleDrawer({ sale: s, onClose, onPay, onEditPay, onDeletePay, onReturn }) {
  const [payType, setPayType] = useState('Cash');
  const [payAmt, setPayAmt] = useState('');
  const [payNote, setPayNote] = useState('');
  const [retWt, setRetWt] = useState('');
  const [retDamaged, setRetDamaged] = useState(false);
  const [retNote, setRetNote] = useState('');
  const [editIndex, setEditIndex] = useState(null);
  const [editType, setEditType] = useState('Cash');
  const [editAmt, setEditAmt] = useState('');
  const [editNote, setEditNote] = useState('');
  const client = s.clientId;

  return (
    <Drawer title={`Sale — ${s.saleId}`} onClose={onClose}
      footer={<button className="btn btn-s" onClick={onClose}>Close</button>}>
      <div className="d-sec">
        <h4>Sale Details</h4>
        <div className="d-grid">
          <div className="d-field"><label>Date</label><div className="dv">{s.date}</div></div>
          <div className="d-field"><label>Client</label><div className="dv">{client?.name || '—'}</div></div>
          <div className="d-field"><label>Total Amount</label><div className="dv ok">{fmtMon(s.totalAmt)}</div></div>
          <div className="d-field"><label>Payment Status</label><div className="dv"><span className={`badge ${s.payStatus === 'Paid' ? 'b-ok' : s.payStatus === 'Partial' ? 'b-warn' : 'b-err'}`}>{s.payStatus}</span></div></div>
        </div>
        {s.note && <div style={{ fontSize: 13, marginTop: 8, padding: '8px 10px', background: 'var(--bg2)', borderRadius: 6 }}><strong>Notes:</strong> {s.note}</div>}
        <div className="pay-summary">
          <div className="pay-stat"><div className="psl">Total Qty</div><div className="psv">{fmtWt(s.totalQty)}</div></div>
          <div className="pay-stat"><div className="psl">Returned</div><div className="psv" style={{color:'var(--warn)'}}>{fmtWt(s.returnedWt || 0)}</div></div>
          <div className="pay-stat"><div className="psl">Net Outstanding</div><div className="psv" style={{ color: s.outstanding > 0 ? 'var(--err)' : 'var(--ok)' }}>{fmtMon(s.outstanding)}</div></div>
        </div>
      </div>

      {s.payStatus !== 'Cancelled' && ((s.returnedWt || 0) < s.totalQty) && (
        <div className="d-sec" style={{border:'1px solid var(--warn-bg)',background:'var(--surf)',padding:12,borderRadius:8}}>
          <h4 style={{color:'var(--warn)',margin:'0 0 10px 0'}}><i className="ti ti-rotate"></i> Process Client Sales Return (BR-11)</h4>
          <div className="fr2" style={{marginBottom:8}}>
            <div className="fg"><label>Return Qty (kg)</label><input type="number" step="0.01" className="finput" value={retWt} onChange={e => setRetWt(e.target.value)} placeholder="0.00"/></div>
            <div className="fg"><label>Reason / Note</label><input className="finput" value={retNote} onChange={e => setRetNote(e.target.value)} placeholder="e.g. Quality issue"/></div>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:12}}>
            <input type="checkbox" id="retD" checked={retDamaged} onChange={e => setRetDamaged(e.target.checked)}/>
            <label htmlFor="retD" style={{fontSize:13,cursor:'pointer'}}>Stock is Damaged (Routing to Wastage/Scrap)</label>
          </div>
          <button className="btn btn-warn btn-sm" onClick={() => {
            if (!retWt || +retWt <= 0) return alert('Enter valid weight');
            onReturn(s, retWt, retDamaged, retNote);
            setRetWt(''); setRetNote(''); setRetDamaged(false);
          }}>Confirm Goods Return & Adjust Outstanding</button>
        </div>
      )}

      {s.returnLog?.length > 0 && (
        <div className="d-sec">
          <h4>Returned Goods History</h4>
          {s.returnLog.map((r, idx) => (
            <div key={idx} style={{fontSize:13,padding:'6px 10px',background:'var(--bg2)',borderRadius:6,marginBottom:6,display:'flex',justifyContent:'space-between'}}>
              <span>{r.date} — {r.isDamaged?'[Damaged]':'[Good Stock]'} {r.note?`(${r.note})`:''}</span>
              <strong style={{color:'var(--warn)'}}>+{fmtWt(r.wt)}</strong>
            </div>
          ))}
        </div>
      )}

      <div className="d-sec">
        <h4>Items</h4>
        <table className="dtbl" style={{ marginTop: 6 }}>
          <thead><tr><th>Material</th><th>Qty</th><th>Rate</th><th>Total</th></tr></thead>
          <tbody>
            {s.items?.map((it, idx) => (
              <tr key={idx}>
                <td>{it.material}</td>
                <td className="mono">{fmtWt(it.qty)}</td>
                <td className="mono">{fmtMon(it.rate)}</td>
                <td className="mono" style={{ fontWeight: 700, color: 'var(--ok)' }}>{fmtMon(it.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {s.payStatus !== 'Cancelled' && (
        <div className="d-sec">
          <h4>Record Payment</h4>
          <div className="pay-type-btns">
            {['Cash', 'Bank Transfer', 'UPI', 'Cheque'].map(t => (
              <button key={t} className={`ptb${payType === t ? ' sel' : ''}`} onClick={() => setPayType(t)}>{t}</button>
            ))}
          </div>
          <div className="fr2">
            <div className="fg"><label>Amount</label><input type="number" value={payAmt} onChange={e => setPayAmt(e.target.value)} placeholder="0" /></div>
            <div className="fg"><label>Note</label><input value={payNote} onChange={e => setPayNote(e.target.value)} /></div>
          </div>
          <button className="btn btn-ok" onClick={() => onPay(s, payType, payAmt, payNote)}><i className="ti ti-cash"></i>Record Payment</button>
        </div>
      )}
      <div className="d-sec">
        <h4>Payment Log</h4>
        {s.payLog?.map((pl, i) => (
          editIndex === i ? (
            <div key={i} style={{ background: 'var(--bg2)', padding: 10, borderRadius: 6, marginBottom: 8, border: '1px solid var(--bd)' }}>
              <div className="pay-type-btns" style={{ marginBottom: 8 }}>
                {['Cash', 'Bank Transfer', 'UPI', 'Cheque'].map(t => (
                  <button key={t} className={`ptb${editType === t ? ' sel' : ''}`} onClick={() => setEditType(t)}>{t}</button>
                ))}
              </div>
              <div className="fr2" style={{ marginBottom: 8 }}>
                <div className="fg"><label>Amount</label><input type="number" value={editAmt} onChange={e => setEditAmt(e.target.value)} /></div>
                <div className="fg"><label>Note</label><input value={editNote} onChange={e => setEditNote(e.target.value)} placeholder="Optional" /></div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-ok btn-sm" onClick={() => { onEditPay(s, i, editType, editAmt, editNote); setEditIndex(null); }}><i className="ti ti-check"></i>Save</button>
                <button className="btn btn-s btn-sm" onClick={() => setEditIndex(null)}>Cancel</button>
              </div>
            </div>
          ) : (
            <div key={i} className="pay-log-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span>{pl.date?.split('T')[0]} · {pl.type}{pl.note ? ' — ' + pl.note : ''}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className="mono" style={{ color: 'var(--ok)', fontWeight: 700 }}>{fmtMon(pl.amt)}</span>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button className="icon-btn" onClick={() => { setEditIndex(i); setEditType(pl.type || 'Cash'); setEditAmt(pl.amt || 0); setEditNote(pl.note || ''); }} style={{ padding: 2, height: 22, width: 22 }} title="Edit Payment"><i className="ti ti-pencil" style={{ fontSize: 14 }}></i></button>
                  <button className="icon-btn" onClick={() => onDeletePay(s, i)} style={{ padding: 2, height: 22, width: 22, color: 'var(--err)' }} title="Delete Payment"><i className="ti ti-trash" style={{ fontSize: 14 }}></i></button>
                </div>
              </div>
            </div>
          )
        ))}
        {!s.payLog?.length && <div style={{ fontSize: 11, color: 'var(--tx3)' }}>No payments recorded</div>}
      </div>
    </Drawer>
  );
}
