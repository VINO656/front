import React, { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Modal, Drawer } from '../../components/Modal';
import { fmtMon, fmtWt, fmtDate, todayISO } from '../../utils/fmt';
import api from '../../lib/api';

const EMPTY_ITEM = { material:'', hsn:'', grossWt:'', wastage:'', rate:'', gstRate:18, taxAmt:0, netWt:0, total:0 };

export default function Inflow({ setActions }) {
  const { activeUnitId, toast, isAdmin } = useApp();
  const [purchases, setPurchases] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [modal, setModal] = useState(null);
  const [drawer, setDrawer] = useState(null);
  const [q, setQ] = useState('');

  const load = async () => {
    if (!activeUnitId) return;
    const [p,s] = await Promise.all([
      api.get('/purchases',{params:{unitId:activeUnitId}}),
      api.get('/suppliers',{params:{unitId:activeUnitId}})
    ]);
    setPurchases(p.data);
    setSuppliers(s.data);
  };

  useEffect(() => { load(); }, [activeUnitId]);
  useEffect(() => {
    setActions(<button className="btn btn-p" onClick={()=>setModal({purchase:null})}><i className="ti ti-plus"></i>New Purchase</button>);
  }, []);

  const getRunningOutstanding = (supplier, currentPurchase) => {
    const supplierPurchases = purchases.filter(p => p.supplierId === supplier?._id && p.payStatus !== 'Cancelled')
      .sort((a,b) => new Date(a.date) - new Date(b.date) || (a.purId||'').localeCompare(b.purId||''));
    
    let runningTotal = 0;
    for (const p of supplierPurchases) {
      runningTotal += p.outstanding;
      if (p._id === currentPurchase._id) break;
    }
    return runningTotal;
  };

  const save = async (form) => {
    const { supplierId, date, items, payType, payAmt, payNote } = form;
    if (!supplierId||!items.length) { toast('Supplier and at least one item required.','err'); return; }
    const totalGross = items.reduce((a,i)=>a+(+i.grossWt||0),0);
    const totalNet   = items.reduce((a,i)=>a+(+i.netWt||0),0);
    const totalAmt   = items.reduce((a,i)=>a+(+i.total||0),0);
    const paidAmt    = +payAmt||0;
    const isCancelled = payType === 'Order Cancelled';
    const payStatus  = isCancelled ? 'Cancelled' : (paidAmt===0?'Unpaid':paidAmt>=totalAmt?'Paid':'Partial');
    const outstanding = isCancelled ? 0 : totalAmt-paidAmt;
    const payLog = (paidAmt>0 || isCancelled) ? [{date:fmtDate(date),type:payType,amt:paidAmt,note:payNote}] : [];
    
    if (form._id) {
      await api.put('/purchases/'+form._id, {
        date:fmtDate(date), supplierId, purchaseType: form.purchaseType,
        items: items.map((it,idx)=>({...it,id:idx+1})),
        totalGross, totalNet, totalAmt,
        payStatus, paidAmt, outstanding, payLog
      });
      toast('Purchase updated.');
    } else {
      await api.post('/purchases', {
        unitId:activeUnitId, date:fmtDate(date), supplierId, purchaseType: form.purchaseType,
        items: items.map((it,idx)=>({...it,id:idx+1})),
        totalGross, totalNet, totalAmt,
        cleanStatus: form.purchaseType === 'Trading' ? 'Done' : 'Pending',
        payStatus, paidAmt, outstanding, payLog
      });
      toast('Purchase saved.');
    }
    load(); setModal(null);
  };

  const addPay = async (purchase, type, amt, note) => {
    const a = +amt||0;
    if (type !== 'Order Cancelled' && a<=0) { toast('Valid amount required.','err'); return; }
    const isCancelled = type === 'Order Cancelled';
    const paidAmt = isCancelled ? purchase.paidAmt : purchase.paidAmt + a;
    const outstanding = isCancelled ? 0 : Math.max(0, purchase.totalAmt - paidAmt);
    const payStatus = isCancelled ? 'Cancelled' : (paidAmt>=purchase.totalAmt ? 'Paid' : 'Partial');
    const payLog = [...(purchase.payLog||[]), {date:fmtDate(todayISO()),type,amt:isCancelled?0:a,note}];
    const res = await api.put('/purchases/'+purchase._id, { paidAmt, outstanding, payStatus, payLog });
    toast(isCancelled ? 'Order marked as cancelled.' : 'Payment logged.'); load(); setDrawer(res.data);
  };

  const del = async (id) => {
    if (!confirm('Delete purchase?')) return;
    await api.delete('/purchases/'+id);
    toast('Deleted.'); load();
  };

  const filtered = purchases.filter(p => {
    const s = suppliers.find(x=>x._id===p.supplierId);
    return s?.name?.toLowerCase().includes(q.toLowerCase()) || p.purId?.toLowerCase().includes(q.toLowerCase());
  });

  return (
    <div className="page">
      <div className="kpi-grid">
        <div className="kpi-card"><div className="kpi-label">Total Purchased</div><div className="kpi-value ok">{fmtMon(purchases.filter(p=>p.payStatus!=='Cancelled').reduce((a,p)=>a+p.totalAmt,0))}</div><div className="kpi-sub">{purchases.length} bills</div></div>
        <div className="kpi-card"><div className="kpi-label">Paid</div><div className="kpi-value ok">{fmtMon(purchases.filter(p=>p.payStatus!=='Cancelled').reduce((a,p)=>a+p.paidAmt,0))}</div></div>
        <div className="kpi-card"><div className="kpi-label">Outstanding</div><div className="kpi-value err">{fmtMon(purchases.filter(p=>p.payStatus!=='Cancelled').reduce((a,p)=>a+p.outstanding,0))}</div></div>
        <div className="kpi-card"><div className="kpi-label">Pending Clean</div><div className="kpi-value warn">{purchases.filter(p=>p.cleanStatus==='Pending'&&p.payStatus!=='Cancelled').length}</div></div>
      </div>

      <div className="table-card">
        <div className="table-toolbar"><h3>Purchase Register</h3>
          <div className="search-box"><i className="ti ti-search"></i><input placeholder="Search supplier or bill no…" value={q} onChange={e=>setQ(e.target.value)}/></div>
        </div>
        <div className="tbl-scroll"><table>
          <thead><tr><th>Bill ID</th><th>Date</th><th>Supplier</th><th>Type</th><th>Material & HSN</th><th>Rate</th><th>Net Wt</th><th>Amount</th><th>Cleaning</th><th>Payment</th><th>Actions</th></tr></thead>
          <tbody>
            {filtered.map(p=>{
              const s = suppliers.find(x=>x._id===p.supplierId);
              const materials = p.items?.map(it => `${it.material}${it.hsn ? ` (${it.hsn})` : ''}`).join(', ') || '—';
              const rates = p.items?.map(it => fmtMon(it.rate)).join(', ') || '—';
              return (
                <tr key={p._id}>
                  <td className="mono" style={{fontWeight:700,color:'var(--p)'}}>{p.purId}</td>
                  <td>{p.date}</td>
                  <td>
                    <div style={{fontWeight:600}}>{s?.name||'—'}</div>
                    {s && <div style={{fontSize:11, color:'var(--tx3)'}}>Total Bal: {fmtMon(getRunningOutstanding(s, p))}</div>}
                  </td>
                  <td><span className={`badge ${p.purchaseType==='Trading'?'b-ok':'b-blue'}`}>{p.purchaseType||'Raw'}</span></td>
                  <td>{materials}</td>
                  <td className="mono">{rates}</td>
                  <td className="mono" style={{fontWeight:700}}>{fmtWt(p.totalNet)}</td>
                  <td className="mono" style={{color:'var(--ok)',fontWeight:700}}>{fmtMon(p.totalAmt)}</td>
                  <td><span className={`badge ${p.cleanStatus==='Done'?'b-ok':'b-warn'}`}>{p.cleanStatus}</span></td>
                  <td><span className={`badge ${p.payStatus==='Paid'?'b-ok':p.payStatus==='Partial'?'b-warn':p.payStatus==='Cancelled'?'b-gray':'b-err'}`}>{p.payStatus}</span></td>
                  <td><div className="act-btns">
                    <button className="icon-btn" title="View" onClick={()=>setDrawer(p)}><i className="ti ti-eye"></i></button>
                    <button className="icon-btn" title="Edit" onClick={()=>setModal({purchase:p})}><i className="ti ti-pencil"></i></button>
                    {isAdmin && <button className="icon-btn danger" title="Delete" onClick={()=>del(p._id)}><i className="ti ti-trash"></i></button>}
                  </div></td>
                </tr>
              );
            })}
            {!filtered.length&&<tr><td colSpan="11" className="empty-row"><i className="ti ti-package"></i><p>No purchases found</p></td></tr>}
          </tbody>
        </table></div>
      </div>

      {modal!==null&&<PurchaseModal suppliers={suppliers} purchase={modal.purchase} onClose={()=>setModal(null)} onSave={save}/>}
      {drawer&&<PurchaseDrawer purchase={drawer} supplier={suppliers.find(s=>s._id===drawer.supplierId)} onClose={()=>setDrawer(null)} onPay={addPay}/>}
    </div>
  );
}

function PurchaseModal({ suppliers, purchase:p, onClose, onSave }) {
  const [date, setDate] = useState(p?.date || todayISO());
  const [supplierId, setSupplierId] = useState(p?.supplierId || '');
  const [purchaseType, setPurchaseType] = useState(p?.purchaseType || 'Raw');
  const [items, setItems] = useState(p?.items?.length ? p.items : [{...EMPTY_ITEM}]);
  const [payType, setPayType] = useState(p?.payLog?.[0]?.type || 'Advance');
  const [payAmt, setPayAmt] = useState(p?.paidAmt !== undefined && p.paidAmt !== 0 ? p.paidAmt : '');
  const [payNote, setPayNote] = useState(p?.payLog?.[0]?.note || '');

  const updateItem = (i, k, v) => {
    const newItems = [...items];
    const old = newItems[i];
    const updated = { ...old, [k]: v };
    const gross = +updated.grossWt || 0;
    const wast = +updated.wastage || 0;
    const net = Math.max(0, gross - wast);
    const r = +updated.rate || 0;
    const base = net * r;
    const gstRate = updated.gstRate !== undefined ? updated.gstRate : 18;
    const taxAmt = Math.round((base * gstRate) / 100);
    updated.netWt = net;
    updated.taxAmt = taxAmt;
    updated.total = base + taxAmt;
    newItems[i] = updated;
    setItems(newItems);
  };

  const totalAmt = items.reduce((a,i)=>a+(+i.total||0),0);

  return (
    <Modal title={p ? `Edit Purchase (${p.purId})` : "New Purchase Bill"} size="modal-lg" onClose={onClose}
      footer={<><button className="btn btn-s" onClick={onClose}>Cancel</button><button className="btn btn-p" onClick={()=>onSave({_id:p?._id, supplierId,date,purchaseType,items,payType,payAmt,payNote})}><i className="ti ti-device-floppy"></i>Save Purchase</button></>}>
      <div className="fr3">
        <div className="fg"><label>Date <span className="req">*</span></label><input type="date" value={date} onChange={e=>setDate(e.target.value)}/></div>
        <div className="fg"><label>Purchase Type</label>
          <select value={purchaseType} onChange={e=>setPurchaseType(e.target.value)}>
            <option value="Raw">Raw Material (Scrap)</option>
            <option value="Trading">Trading Goods (Ready for resale)</option>
          </select>
        </div>
        <div className="fg"><label>Supplier <span className="req">*</span></label>
          <select value={supplierId} onChange={e=>setSupplierId(e.target.value)}>
            <option value="">Select supplier…</option>
            {suppliers.filter(s=>s.status==='Active').map(s=><option key={s._id} value={s._id}>{s.name}</option>)}
          </select>
        </div>
      </div>
      <div className="fsec">
        <div className="fsec-title">Billed Items breakdown
          <button className="btn btn-s btn-sm" onClick={()=>setItems(p=>[...p,{...EMPTY_ITEM}])}><i className="ti ti-plus"></i>Add Item</button>
        </div>
        {items.map((it,i)=>(
          <div key={i} className="item-line" style={{background:'var(--bg)',padding:14,borderRadius:10,marginBottom:12,border:'1px solid var(--bd)'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
              <span style={{fontWeight:700,color:'var(--p)',fontSize:13}}>Item #{i+1}</span>
              {items.length>1 && <button className="icon-btn danger" onClick={()=>setItems(p=>p.filter((_,j)=>j!==i))}><i className="ti ti-trash"></i></button>}
            </div>
            <div style={{display:'grid',gridTemplateColumns:'2fr 1fr 1fr 1fr',gap:10,marginBottom:10}}>
              <div className="fg"><label>Material Name <span className="req">*</span></label><input value={it.material} onChange={e=>updateItem(i,'material',e.target.value)} placeholder="PET Bottles / HDPE"/></div>
              <div className="fg"><label>HSN Code</label><input value={it.hsn} onChange={e=>updateItem(i,'hsn',e.target.value)} placeholder="HSN/SAC"/></div>
              <div className="fg"><label>Gross Wt (kg)</label><input type="number" step="0.01" value={it.grossWt} onChange={e=>updateItem(i,'grossWt',e.target.value)} placeholder="0"/></div>
              <div className="fg"><label>Wastage (kg)</label><input type="number" step="0.01" value={it.wastage} onChange={e=>updateItem(i,'wastage',e.target.value)} placeholder="0"/></div>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr 1fr 1fr',gap:10,background:'var(--bg2)',padding:10,borderRadius:8}}>
              <div className="fg"><label>Net Wt (kg)</label><input disabled value={fmtWt(it.netWt)} style={{fontWeight:700}}/></div>
              <div className="fg"><label>Rate (₹/kg)</label><input type="number" step="0.01" value={it.rate} onChange={e=>updateItem(i,'rate',e.target.value)} placeholder="0"/></div>
              <div className="fg"><label>GST %</label>
                <select value={it.gstRate !== undefined ? it.gstRate : 18} onChange={e=>updateItem(i,'gstRate',+e.target.value)}>
                  <option value="0">0%</option><option value="5">5%</option><option value="12">12%</option><option value="18">18%</option>
                </select>
              </div>
              <div className="fg"><label>GST Amt</label><input disabled value={fmtMon(it.taxAmt||0)} style={{color:'var(--tx3)'}}/></div>
              <div className="fg"><label>Total Price</label><input disabled value={fmtMon(it.total)} style={{fontWeight:700,color:'var(--p)'}}/></div>
            </div>
          </div>
        ))}
        <div style={{display:'flex',justifyContent:'flex-end',background:'var(--bg2)',padding:12,borderRadius:8,marginTop:6}}>
          <div style={{fontSize:16,color:'var(--p)'}}>Bill Total Payable: <strong>{fmtMon(totalAmt)}</strong></div>
        </div>
      </div>
      <div className="fsec">
        <div className="fsec-title">Initial Payment Record</div>
        <div className="pay-type-btns">
          {['None','Advance','Partial','Full','Order Cancelled'].map(t=>(
            <button key={t} className={`ptb${payType===t?' sel':''}`} onClick={()=>setPayType(t)}>{t}</button>
          ))}
        </div>
        {payType !== 'None' && payType !== 'Order Cancelled' && (
          <div className="fr2" style={{marginTop:10}}>
            <div className="fg"><label>Amount Paid (₹)</label><input type="number" value={payAmt} onChange={e=>setPayAmt(e.target.value)} placeholder="0"/></div>
            <div className="fg"><label>Payment Note</label><input value={payNote} onChange={e=>setPayNote(e.target.value)} placeholder="e.g. Cash advance paid"/></div>
          </div>
        )}
      </div>
    </Modal>
  );
}

function PurchaseDrawer({ purchase:p, supplier:s, onClose, onPay }) {
  const [payType, setPayType] = useState('Cash');
  const [payAmt, setPayAmt] = useState('');
  const [payNote, setPayNote] = useState('');

  return (
    <Drawer title={`Purchase Bill — ${p.purId}`} onClose={onClose} size="drawer-lg"
      footer={<button className="btn btn-s" onClick={onClose}>Close</button>}>
      <div className="d-sec">
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:14}}>
          <div>
            <h3 style={{margin:0,color:'var(--p)'}}>{s?.name || 'Vendor'}</h3>
            <div style={{fontSize:12,color:'var(--tx3)'}}>Date: {p.date}</div>
          </div>
          <span className={`badge ${p.purchaseType==='Trading'?'b-ok':'b-blue'}`}>{p.purchaseType||'Raw'}</span>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(3, 1fr)',gap:10,background:'var(--bg2)',padding:14,borderRadius:8}}>
          <div><div style={{fontSize:11,color:'var(--tx3)'}}>Bill Total</div><div style={{fontSize:16,fontWeight:700}}>{fmtMon(p.totalAmt)}</div></div>
          <div><div style={{fontSize:11,color:'var(--tx3)'}}>Total Paid</div><div style={{fontSize:16,fontWeight:700,color:'var(--ok)'}}>{fmtMon(p.paidAmt)}</div></div>
          <div><div style={{fontSize:11,color:'var(--tx3)'}}>Balance Outstanding</div><div style={{fontSize:16,fontWeight:700,color:p.outstanding>0?'var(--err)':'var(--ok)'}}>{fmtMon(p.outstanding)}</div></div>
        </div>
      </div>

      <div className="d-sec">
        <h4>Items Breakdown</h4>
        {p.items?.map((it,i)=>(
          <div key={i} style={{background:'var(--bg2)',padding:12,borderRadius:8,marginBottom:8,border:'1px solid var(--bd)'}}>
            <div style={{display:'flex',justifyContent:'space-between',fontWeight:600,marginBottom:8}}>
              <span>{it.material} {it.hsn && <span className="mono" style={{fontSize:12,color:'var(--tx3)'}}>· HSN {it.hsn}</span>}</span>
              <span style={{color:'var(--p)'}}>{fmtMon(it.total)}</span>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(5, 1fr)',gap:8,fontSize:12}}>
              <div><span style={{color:'var(--tx3)'}}>Gross:</span> {fmtWt(it.grossWt)}</div>
              <div><span style={{color:'var(--tx3)'}}>Wastage:</span> {fmtWt(it.wastage)}</div>
              <div><span style={{color:'var(--tx3)'}}>Net Wt:</span> <strong>{fmtWt(it.netWt)}</strong></div>
              <div><span style={{color:'var(--tx3)'}}>Rate:</span> {fmtMon(it.rate)}/kg</div>
              <div><span style={{color:'var(--tx3)'}}>GST:</span> {it.gstRate||18}% ({fmtMon(it.taxAmt||0)})</div>
            </div>
          </div>
        ))}
      </div>

      {p.payStatus !== 'Cancelled' && (
        <div className="d-sec">
          <h4>Record Follow-up Payment</h4>
          <div className="pay-type-btns">
            {['Cash','Bank Transfer','UPI','Cheque','Order Cancelled'].map(t=>(
              <button key={t} className={`ptb${payType===t?' sel':''}`} onClick={()=>setPayType(t)}>{t}</button>
            ))}
          </div>
          <div className="fr2" style={{marginTop:10}}>
            <div className="fg"><label>Amount (₹)</label><input type="number" value={payAmt} onChange={e=>setPayAmt(e.target.value)} placeholder="0"/></div>
            <div className="fg"><label>Reference / Note</label><input value={payNote} onChange={e=>setPayNote(e.target.value)} placeholder="Transaction ID / Cash"/></div>
          </div>
          <button className="btn btn-ok" style={{marginTop:12,width:'100%'}} onClick={()=>onPay(p,payType,payAmt,payNote)}><i className="ti ti-cash"></i>Record Payment</button>
        </div>
      )}

      <div className="d-sec">
        <h4>Payment History</h4>
        {p.payLog?.map((pl,i)=>(
          <div key={i} className="pay-log-row" style={{display:'flex',justifyContent:'space-between',padding:'6px 0',borderBottom:'1px solid var(--bd)'}}>
            <span style={{fontSize:12}}>{pl.date} · <strong>{pl.type}</strong> {pl.note ? `(${pl.note})` : ''}</span>
            <span className="mono" style={{color:'var(--ok)',fontWeight:700}}>{fmtMon(pl.amt)}</span>
          </div>
        ))}
        {!p.payLog?.length && <div style={{fontSize:12,color:'var(--tx3)'}}>No payments recorded yet</div>}
      </div>
    </Drawer>
  );
}
