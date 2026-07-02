import React, { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Modal, Drawer } from '../../components/Modal';
import { fmtMon, fmtWt, fmtDate, todayISO } from '../../utils/fmt';
import api from '../../lib/api';

const CAT_LABELS = { raw:'Raw Material', cleaned:'Cleaned Material', finished:'Finished Goods', returned:'Returned Goods' };
const CATS = ['raw','cleaned','finished','returned'];

export default function Inventory({ setActions }) {
  const { activeUnitId, toast, isAdmin } = useApp();
  const [batches, setBatches] = useState([]);
  const [catFilter, setCatFilter] = useState('');
  const [q, setQ] = useState('');
  const [modal, setModal] = useState(null);
  const [ledgerModal, setLedgerModal] = useState(null);
  const [drawer, setDrawer] = useState(null);

  const load = async () => {
    if (!activeUnitId) return;
    const params = { unitId: activeUnitId };
    if (catFilter) params.category = catFilter;
    const { data } = await api.get('/inventory', { params });
    setBatches(data);
  };

  useEffect(() => { load(); }, [activeUnitId, catFilter]);
  useEffect(() => {
    setActions(<button className="btn btn-p" onClick={()=>setModal({batch:null})}><i className="ti ti-plus"></i>New Product Stock</button>);
  }, []);

  const remaining = b => (b.createdWt || 0) - (b.soldWt || 0) + (b.returnedWt || 0);

  const saveBatch = async (form, id) => {
    if (!form.material || !form.createdWt) { toast('Product name and available KG required.', 'err'); return; }
    const wt = +form.createdWt || 0;
    const r = +form.rate || 0;
    const base = wt * r;
    const taxAmt = Math.round((base * (+form.gstRate || 0)) / 100);
    const totalAmt = base + taxAmt;
    const payload = { ...form, taxAmt, totalAmt };

    if (id) {
      await api.put('/inventory/'+id, payload);
      toast('Product updated.');
    } else {
      if (!form.batchId) { toast('Batch ID required.', 'err'); return; }
      await api.post('/inventory', {
        ...payload, unitId: activeUnitId,
        soldWt: 0, returnedWt: 0,
        ledger: [{date: fmtDate(form.createdDate||todayISO()), type: 'IN', qty: wt, note: form.note || 'Initial Stock'}],
        status: 'Available'
      });
      toast('Product batch ' + form.batchId + ' created.');
    }
    load(); setModal(null);
  };

  const addLedger = async (batch, type, qty, date, note) => {
    if (!qty || qty <= 0) { toast('Enter valid quantity.', 'err'); return; }
    if (type === 'OUT' && qty > remaining(batch)) { toast('Cannot remove more than available KG.', 'err'); return; }
    const ledger = [...(batch.ledger || []), {date: fmtDate(date), type, qty, note: note || type}];
    const updates = { ledger };
    if (type === 'IN')  updates.createdWt = (batch.createdWt || 0) + qty;
    if (type === 'OUT') updates.soldWt = (batch.soldWt || 0) + qty;
    const rem = remaining({ ...batch, ...updates });
    updates.status = rem <= 0 ? (batch.category === 'cleaned' ? 'Consumed' : 'Sold') : (batch.soldWt + (type === 'OUT' ? qty : 0)) > 0 ? 'Partial' : 'Available';
    await api.put('/inventory/'+batch._id, updates);
    toast('Ledger entry added.'); load(); setLedgerModal(null);
  };

  const del = async (id) => {
    if (!confirm('Delete this product batch?')) return;
    await api.delete('/inventory/'+id);
    toast('Deleted.'); load();
  };

  const filtered = batches.filter(b => 
    b.material?.toLowerCase().includes(q.toLowerCase()) || 
    b.batchId?.toLowerCase().includes(q.toLowerCase()) ||
    b.hsn?.toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div className="page">
      <div className="kpi-grid">
        {CATS.map(c => (
          <div key={c} className="kpi-card" onClick={() => setCatFilter(catFilter === c ? '' : c)} style={{ cursor: 'pointer', border: catFilter === c ? '2px solid var(--info)' : undefined, background: catFilter === c ? 'var(--pm)' : undefined, transition: 'all 0.15s' }}>
            <div className="kpi-label">{CAT_LABELS[c]}</div>
            <div className="kpi-value">{batches.filter(b=>b.category===c).length}</div>
            <div className="kpi-sub">{fmtWt(batches.filter(b=>b.category===c).reduce((a,b)=>a+remaining(b),0))} avail</div>
          </div>
        ))}
      </div>

      <div className="pay-type-btns" style={{ marginTop: 16, marginBottom: 16, flexWrap: 'wrap' }}>
        <button className={`ptb${catFilter === '' ? ' sel' : ''}`} onClick={() => setCatFilter('')} style={{ height: 38, fontSize: 12 }}>
          <i className="ti ti-layout-grid"></i> All Products ({batches.length})
        </button>
        {CATS.map(c => (
          <button key={c} className={`ptb${catFilter === c ? ' sel' : ''}`} onClick={() => setCatFilter(c)} style={{ height: 38, fontSize: 12 }}>
            {CAT_LABELS[c]} ({batches.filter(b=>b.category===c).length})
          </button>
        ))}
      </div>

      <div className="table-card">
        <div className="table-toolbar">
          <h3>{catFilter ? CAT_LABELS[catFilter] : 'All Inventory'} Register</h3>
          <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
            <div className="search-box"><i className="ti ti-search"></i><input placeholder="Search product, HSN, batch…" value={q} onChange={e=>setQ(e.target.value)}/></div>
          </div>
        </div>
        <div className="tbl-scroll">
          <table>
            <thead>
              <tr><th>Batch ID</th><th>Category</th><th>Product Name</th><th>HSN</th><th>Avail KG</th><th>Price/Unit</th><th>GST %</th><th>Total Price</th><th>Status</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {filtered.map(b => {
                const rem = remaining(b);
                const wt = b.createdWt || 0;
                const r = b.rate || 0;
                const tot = b.totalAmt !== undefined ? b.totalAmt : ((wt * r) * (1 + (b.gstRate||18)/100));
                return (
                  <tr key={b._id}>
                    <td className="mono" style={{fontWeight:700,color:'var(--p)'}}>{b.batchId}</td>
                    <td><span className={`badge cat-${b.category}`}>{CAT_LABELS[b.category]}</span></td>
                    <td style={{fontWeight:600}}>{b.material} <span style={{fontSize:11,color:'var(--tx3)'}}>{b.quality && `(${b.quality})`}</span></td>
                    <td className="mono">{b.hsn || '—'}</td>
                    <td className="mono" style={{fontWeight:700,color:rem>0?'var(--ok)':'var(--tx3)'}}>{fmtWt(rem)}</td>
                    <td className="mono">{b.rate ? fmtMon(b.rate) : '—'}</td>
                    <td>{b.gstRate !== undefined ? `${b.gstRate}%` : '18%'}</td>
                    <td className="mono" style={{fontWeight:700}}>{b.rate ? fmtMon(tot) : '—'}</td>
                    <td><span className={`badge inv-status-${b.status?.toLowerCase()}`}>{b.status}</span></td>
                    <td>
                      <div className="act-btns">
                        <button className="icon-btn" title="View Details" onClick={()=>setDrawer(b)}><i className="ti ti-eye"></i></button>
                        <button className="icon-btn ok" title="Add Ledger Movement" onClick={()=>setLedgerModal(b)}><i className="ti ti-plus"></i></button>
                        <button className="icon-btn" title="Edit" onClick={()=>setModal({batch:b})}><i className="ti ti-pencil"></i></button>
                        {isAdmin && <button className="icon-btn danger" title="Delete" onClick={()=>del(b._id)}><i className="ti ti-trash"></i></button>}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!filtered.length && <tr><td colSpan="10" className="empty-row"><i className="ti ti-package"></i><p>No inventory stock found</p></td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {modal !== null && <BatchModal batch={modal.batch} onClose={()=>setModal(null)} onSave={saveBatch}/>}
      {ledgerModal && <LedgerModal batch={ledgerModal} remaining={remaining(ledgerModal)} onClose={()=>setLedgerModal(null)} onSave={addLedger}/>}
      {drawer && <InventoryDrawer batch={drawer} remaining={remaining(drawer)} onClose={()=>setDrawer(null)}/>}
    </div>
  );
}

function BatchModal({ batch:b, onClose, onSave }) {
  const [f, setF] = useState({
    batchId:     b?.batchId || '',
    category:    b?.category || 'finished',
    material:    b?.material || '', // Product Name
    hsn:         b?.hsn || '', // Product HSN
    description: b?.description || '',
    quality:     b?.quality || 'Standard',
    sourceRef:   b?.sourceRef || '',
    sourceType:  b?.sourceType || 'manual',
    createdDate: b?.createdDate || todayISO(),
    createdWt:   b?.createdWt !== undefined ? b.createdWt : '', // Available KG
    rate:        b?.rate !== undefined ? b.rate : '', // Price per unit
    gstRate:     b?.gstRate !== undefined ? b.gstRate : 18,
    note:        b?.note || ''
  });

  const upd = (k, v) => setF(p => ({ ...p, [k]: v }));

  const wt = +f.createdWt || 0;
  const r = +f.rate || 0;
  const base = wt * r;
  const gstAmt = Math.round((base * (+f.gstRate || 0)) / 100);
  const total = base + gstAmt;

  return (
    <Modal title={`${b ? 'Edit' : 'Add'} Inventory Product Stock`} size="modal-lg" onClose={onClose}
      footer={<><button className="btn btn-s" onClick={onClose}>Cancel</button><button className="btn btn-p" onClick={()=>onSave(f, b?._id)}><i className="ti ti-device-floppy"></i>Save Product</button></>}>
      <div className="fr3">
        {!b && <div className="fg"><label>Batch ID <span className="req">*</span></label><input value={f.batchId} onChange={e=>upd('batchId', e.target.value)} placeholder="e.g. BAT-005"/></div>}
        <div className="fg"><label>Category</label>
          <select value={f.category} onChange={e=>upd('category', e.target.value)}>
            {CATS.map(c=><option key={c} value={c}>{CAT_LABELS[c]}</option>)}
          </select>
        </div>
        <div className="fg"><label>Date Added</label><input type="date" value={f.createdDate} onChange={e=>upd('createdDate', e.target.value)}/></div>
      </div>

      <div className="fr3" style={{marginTop: 12}}>
        <div className="fg"><label>Product Name <span className="req">*</span></label><input value={f.material} onChange={e=>upd('material', e.target.value)} placeholder="e.g. HDPE Granules Grade A"/></div>
        <div className="fg"><label>Product HSN</label><input value={f.hsn} onChange={e=>upd('hsn', e.target.value)} placeholder="HSN / SAC Code"/></div>
        <div className="fg"><label>Quality / Grade</label><input value={f.quality} onChange={e=>upd('quality', e.target.value)} placeholder="e.g. Premium / Standard"/></div>
      </div>

      <div className="fg" style={{marginTop: 12}}>
        <label>Product Description</label>
        <input value={f.description} onChange={e=>upd('description', e.target.value)} placeholder="Optional detailed specification or grade details…"/>
      </div>

      <div className="fr4" style={{marginTop: 16, background: 'var(--bg2)', padding: 14, borderRadius: 8, border: '1px solid var(--bd)'}}>
        <div className="fg"><label>Available KG <span className="req">*</span></label><input type="number" step="0.01" value={f.createdWt} onChange={e=>upd('createdWt', e.target.value)} placeholder="0"/></div>
        <div className="fg"><label>Price per Unit (₹)</label><input type="number" step="0.01" value={f.rate} onChange={e=>upd('rate', e.target.value)} placeholder="0"/></div>
        <div className="fg"><label>GST %</label>
          <select value={f.gstRate} onChange={e=>upd('gstRate', +e.target.value)}>
            <option value="0">0%</option><option value="5">5%</option><option value="12">12%</option><option value="18">18%</option>
          </select>
        </div>
        <div className="fg"><label>GST Amt (₹)</label><input disabled value={fmtMon(gstAmt)} style={{fontWeight: 700, color: 'var(--tx3)'}}/></div>
      </div>

      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, padding: '0 4px'}}>
        <div className="fr2" style={{gap: 10, maxWidth: 300}}>
          <div className="fg"><label>Source Ref</label><input value={f.sourceRef} onChange={e=>upd('sourceRef', e.target.value)} placeholder="PUR-01"/></div>
          <div className="fg"><label>Source Type</label>
            <select value={f.sourceType} onChange={e=>upd('sourceType', e.target.value)}>
              {['manual','purchase','cleaning','processing','return'].map(t=><option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>
        <div style={{textAlign: 'right'}}>
          <div style={{fontSize: 12, color: 'var(--tx3)'}}>Base: {fmtMon(base)} + GST: {fmtMon(gstAmt)}</div>
          <div style={{fontSize: 18, color: 'var(--p)', marginTop: 2}}>Total Price: <strong>{fmtMon(total)}</strong></div>
        </div>
      </div>
    </Modal>
  );
}

function LedgerModal({ batch:b, remaining, onClose, onSave }) {
  const [type, setType] = useState('IN');
  const [qty, setQty] = useState('');
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState('');
  return (
    <Modal title={`Add Ledger Movement — ${b.batchId}`} size="modal-sm" onClose={onClose}
      footer={<><button className="btn btn-s" onClick={onClose}>Cancel</button><button className="btn btn-p" onClick={()=>onSave(b, type, +qty, date, note)}><i className="ti ti-device-floppy"></i>Save Entry</button></>}>
      <div className="warn-note"><i className="ti ti-info-circle note-icon"></i><span>Available KG remaining: <b>{fmtWt(remaining)}</b></span></div>
      <div className="fr2">
        <div className="fg"><label>Movement Type <span className="req">*</span></label>
          <select value={type} onChange={e=>setType(e.target.value)}>
            <option value="IN">IN — Stock Added</option>
            <option value="OUT">OUT — Stock Removed / Sold</option>
            <option value="ADJ">ADJ — Adjustment</option>
          </select>
        </div>
        <div className="fg"><label>Quantity (KG) <span className="req">*</span></label><input type="number" step="0.01" value={qty} onChange={e=>setQty(e.target.value)} placeholder="0"/></div>
      </div>
      <div className="fr2">
        <div className="fg"><label>Date</label><input type="date" value={date} onChange={e=>setDate(e.target.value)}/></div>
        <div className="fg"><label>Note</label><input value={note} onChange={e=>setNote(e.target.value)} placeholder="e.g. Sold to customer"/></div>
      </div>
    </Modal>
  );
}

function InventoryDrawer({ batch:b, remaining, onClose }) {
  const wt = b.createdWt || 0;
  const r = b.rate || 0;
  const base = wt * r;
  const gstAmt = b.taxAmt !== undefined ? b.taxAmt : Math.round((base * (b.gstRate||18))/100);
  const total = b.totalAmt !== undefined ? b.totalAmt : (base + gstAmt);

  return (
    <Drawer title={`Product Details — ${b.batchId}`} onClose={onClose} size="drawer-lg"
      footer={<button className="btn btn-s" onClick={onClose}>Close</button>}>
      <div className="d-sec">
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:16}}>
          <div>
            <h2 style={{margin:0,color:'var(--p)'}}>{b.material}</h2>
            <div style={{color:'var(--tx3)',fontSize:13,marginTop:2}}>{b.description || 'No description provided'}</div>
          </div>
          <span className={`badge cat-${b.category}`} style={{fontSize:12,padding:'6px 12px'}}>{CAT_LABELS[b.category]}</span>
        </div>

        <div className="d-grid">
          <div className="d-field"><label>Product HSN</label><div className="dv mono">{b.hsn || '—'}</div></div>
          <div className="d-field"><label>Quality / Grade</label><div className="dv">{b.quality || '—'}</div></div>
          <div className="d-field"><label>Status</label><div className="dv"><span className={`badge inv-status-${b.status?.toLowerCase()}`}>{b.status}</span></div></div>
          <div className="d-field"><label>Source Ref</label><div className="dv mono">{b.sourceRef || 'Manual'}</div></div>
          <div className="d-field"><label>Date Created</label><div className="dv">{b.createdDate}</div></div>
        </div>

        <div style={{background:'var(--bg2)',padding:16,borderRadius:10,marginTop:16,border:'1px solid var(--bd)'}}>
          <h4 style={{margin:'0 0 12px 0',color:'var(--tx)'}}>Stock & Valuation Summary</h4>
          <div style={{display:'grid',gridTemplateColumns:'repeat(4, 1fr)',gap:12}}>
            <div><div style={{fontSize:11,color:'var(--tx3)'}}>Available KG</div><div style={{fontSize:16,fontWeight:700,color:'var(--ok)'}}>{fmtWt(remaining)}</div></div>
            <div><div style={{fontSize:11,color:'var(--tx3)'}}>Price per Unit</div><div style={{fontSize:16,fontWeight:700}}>{r ? fmtMon(r) : '—'}</div></div>
            <div><div style={{fontSize:11,color:'var(--tx3)'}}>GST ({b.gstRate||18}%)</div><div style={{fontSize:16,fontWeight:700}}>{r ? fmtMon(gstAmt) : '—'}</div></div>
            <div><div style={{fontSize:11,color:'var(--tx3)'}}>Total Price</div><div style={{fontSize:16,fontWeight:700,color:'var(--p)'}}>{r ? fmtMon(total) : '—'}</div></div>
          </div>
        </div>
      </div>

      <div className="d-sec">
        <h4>Stock Ledger Movements</h4>
        {b.ledger?.map((e,i)=>(
          <div key={i} className="ledger-row">
            <div className={`ledger-dot ledger-${e.type?.toLowerCase()}`}></div>
            <span className="mono" style={{fontWeight:700,fontSize:11,minWidth:36}}>{e.type}</span>
            <span style={{color:'var(--tx3)',fontSize:11}}>{e.date}</span>
            <span className="mono" style={{marginLeft:'auto',fontWeight:700,color:e.type==='IN'?'var(--ok)':'var(--err)'}}>{e.type==='IN'?'+':'-'}{fmtWt(e.qty)}</span>
            <span style={{color:'var(--tx3)',fontSize:11,minWidth:120,textAlign:'right'}}>{e.note}</span>
          </div>
        ))}
      </div>
    </Drawer>
  );
}
