import React, { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Modal, Drawer } from '../../components/Modal';
import { fmtMon } from '../../utils/fmt';
import api from '../../lib/api';

export default function Profiles({ setActions }) {
  const { activeUnitId, toast } = useApp();
  const [tab, setTab] = useState('suppliers');
  const [suppliers, setSuppliers] = useState([]);
  const [labours, setLabours] = useState([]);
  const [clients, setClients] = useState([]);
  const [modal, setModal] = useState(null);
  const [drawer, setDrawer] = useState(null);
  const [q, setQ] = useState('');

  const load = async () => {
    if (!activeUnitId) return;
    const [s,l,c] = await Promise.all([
      api.get('/suppliers',{params:{unitId:activeUnitId}}),
      api.get('/labours',{params:{unitId:activeUnitId}}),
      api.get('/clients',{params:{unitId:activeUnitId}}),
    ]);
    setSuppliers(s.data); setLabours(l.data); setClients(c.data);
  };

  useEffect(() => { load(); }, [activeUnitId]);

  useEffect(() => {
    const lbls = {suppliers:'Supplier',labours:'Labour',clients:'Client'};
    setActions(
      <button className="btn btn-p" onClick={openAdd}><i className="ti ti-plus"></i>Add {lbls[tab]}</button>
    );
  }, [tab]);

  const openAdd = () => {
    if (tab==='suppliers') setModal({type:'supplier',item:null});
    else if (tab==='labours') setModal({type:'labour',item:null});
    else setModal({type:'client',item:null});
  };

  const saveSup = async (form, id) => {
    if (!form.name) { toast('Name required.','err'); return; }
    if (id) { await api.put('/suppliers/'+id, form); toast('Supplier updated.'); }
    else { await api.post('/suppliers', {...form, unitId:activeUnitId, outstanding:0, txns:[]}); toast('Supplier created.'); }
    load(); setModal(null);
  };

  const saveLab = async (form, id) => {
    if (!form.name) { toast('Name required.','err'); return; }
    const payload = {
      ...form,
      coId: null,
      rate: 0,
    };
    if (id) { await api.put('/labours/'+id, payload); toast('Labour updated.'); }
    else { await api.post('/labours', {...payload, unitId:activeUnitId, rateHistory:[]}); toast('Labour created.'); }
    load(); setModal(null);
  };

  const saveCli = async (form, id) => {
    if (!form.name) { toast('Name required.','err'); return; }
    if (id) { await api.put('/clients/'+id, form); toast('Client updated.'); }
    else { await api.post('/clients', {...form, unitId:activeUnitId, outstanding:0, txns:[]}); toast('Client created.'); }
    load(); setModal(null);
  };

  const totalOut = suppliers.reduce((a,s)=>a+s.outstanding,0) + clients.reduce((a,c)=>a+c.outstanding,0);

  const rows = tab==='suppliers' ? suppliers : tab==='labours' ? labours : clients;
  const filtered = rows.filter(r => r.name?.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="page">
      <div className="kpi-grid">
        <div className="kpi-card"><div className="kpi-label">Suppliers</div><div className="kpi-value">{suppliers.length}</div><div className="kpi-sub">{suppliers.filter(s=>s.status==='Active').length} active</div></div>
        <div className="kpi-card"><div className="kpi-label">Labours</div><div className="kpi-value">{labours.length}</div><div className="kpi-sub">{labours.filter(l=>l.status==='Active').length} active</div></div>
        <div className="kpi-card"><div className="kpi-label">Clients</div><div className="kpi-value">{clients.length}</div><div className="kpi-sub">{clients.filter(c=>c.status==='Active').length} active</div></div>
        <div className="kpi-card"><div className="kpi-label">Total Outstanding</div><div className="kpi-value acc">{fmtMon(totalOut)}</div><div className="kpi-sub">All accounts</div></div>
      </div>

      <div className="tab-bar">
        {['suppliers','labours','clients'].map(t=>(
          <div key={t} className={`tab${tab===t?' active':''}`} onClick={()=>{setTab(t);setQ('');}}>
            {t.charAt(0).toUpperCase()+t.slice(1)}{' '}
            <span className="badge b-p" style={{marginLeft:3}}>{t==='suppliers'?suppliers.length:t==='labours'?labours.length:clients.length}</span>
          </div>
        ))}
      </div>

      <div className="table-card">
        <div className="table-toolbar">
          <h3>{tab.charAt(0).toUpperCase()+tab.slice(1)}</h3>
          <div className="search-box"><i className="ti ti-search"></i><input placeholder="Search…" value={q} onChange={e=>setQ(e.target.value)}/></div>
        </div>
        <div className="tbl-scroll">
          {tab==='suppliers' && <SuppliersTable rows={filtered} onEdit={s=>setModal({type:'supplier',item:s})} onView={s=>setDrawer({type:'supplier',item:s})}/>}
          {tab==='labours'   && <LaboursTable   rows={filtered} onEdit={l=>setModal({type:'labour',item:l})} onView={l=>setDrawer({type:'labour',item:l})}/>}
          {tab==='clients'   && <ClientsTable   rows={filtered} onEdit={c=>setModal({type:'client',item:c})} onView={c=>setDrawer({type:'client',item:c})}/>}
        </div>
      </div>

      {modal?.type==='supplier'&&<SupModal item={modal.item} onClose={()=>setModal(null)} onSave={saveSup}/>}
      {modal?.type==='labour'&&<LabModal item={modal.item} onClose={()=>setModal(null)} onSave={saveLab}/>}
      {modal?.type==='client'&&<CliModal item={modal.item} onClose={()=>setModal(null)} onSave={saveCli}/>}
      {drawer&&<ProfileDrawer item={drawer.item} type={drawer.type} onClose={()=>setDrawer(null)}/>}
    </div>
  );
}

function SuppliersTable({ rows, onEdit, onView }) {
  return (
    <table><thead><tr><th>Name</th><th>Contact</th><th>Phone</th><th>Materials</th><th>Outstanding</th><th>Status</th><th>Actions</th></tr></thead>
      <tbody>
        {rows.map(s=>(
          <tr key={s._id}>
            <td style={{fontWeight:600}}>{s.name}</td>
            <td>{s.contact}</td><td>{s.phone}</td>
            <td>{s.materials?.join(', ')}</td>
            <td className="mono" style={{color:s.outstanding>0?'var(--err)':''}}>{fmtMon(s.outstanding)}</td>
            <td><span className={`badge ${s.status==='Active'?'b-ok':'b-err'}`}>{s.status}</span></td>
            <td><div className="act-btns">
              <button className="icon-btn" onClick={()=>onView(s)}><i className="ti ti-eye"></i></button>
              <button className="icon-btn" onClick={()=>onEdit(s)}><i className="ti ti-edit"></i></button>
            </div></td>
          </tr>
        ))}
        {!rows.length&&<tr><td colSpan="7" className="empty-row"><p>No suppliers</p></td></tr>}
      </tbody>
    </table>
  );
}

function LaboursTable({ rows, onEdit, onView }) {
  return (
    <table><thead><tr><th>Name</th><th>Phone</th><th>Location</th><th>Outstanding Wages</th><th>Status</th><th>Actions</th></tr></thead>
      <tbody>
        {rows.map(l=>(
          <tr key={l._id}>
            <td style={{fontWeight:600}}>{l.name}</td>
            <td>{l.phone || '—'}</td>
            <td>{[l.city, l.state].filter(Boolean).join(', ') || '—'}</td>
            <td><span className={`mono ${l.outstanding>0?'err':'ok'}`} style={{fontWeight:700}}>{fmtMon(l.outstanding||0)}</span></td>
            <td><span className={`badge ${l.status==='Active'?'b-ok':'b-err'}`}>{l.status}</span></td>
            <td><div className="act-btns">
              <button className="icon-btn" onClick={()=>onView(l)}><i className="ti ti-eye"></i></button>
              <button className="icon-btn" onClick={()=>onEdit(l)}><i className="ti ti-edit"></i></button>
            </div></td>
          </tr>
        ))}
        {!rows.length&&<tr><td colSpan="6" className="empty-row"><p>No labours</p></td></tr>}
      </tbody>
    </table>
  );
}

function ClientsTable({ rows, onEdit, onView }) {
  return (
    <table><thead><tr><th>Name</th><th>Contact</th><th>Phone</th><th>Outstanding</th><th>Status</th><th>Actions</th></tr></thead>
      <tbody>
        {rows.map(c=>(
          <tr key={c._id}>
            <td style={{fontWeight:600}}>{c.name}</td>
            <td>{c.contact}</td><td>{c.phone}</td>
            <td className={`mono ${c.outstanding>0?'err':'ok'}`}>{fmtMon(c.outstanding)}</td>
            <td><span className={`badge ${c.status==='Active'?'b-ok':'b-err'}`}>{c.status}</span></td>
            <td><div className="act-btns">
              <button className="icon-btn" onClick={()=>onView(c)}><i className="ti ti-eye"></i></button>
              <button className="icon-btn" onClick={()=>onEdit(c)}><i className="ti ti-edit"></i></button>
            </div></td>
          </tr>
        ))}
        {!rows.length&&<tr><td colSpan="6" className="empty-row"><p>No clients</p></td></tr>}
      </tbody>
    </table>
  );
}

function SupModal({ item:s, onClose, onSave }) {
  const [f,setF] = useState({name:s?.name||'',contact:s?.contact||'',phone:s?.phone||'',email:s?.email||'',address:s?.address||'',gst:s?.gst||'',bank:s?.bank||'',branch:s?.branch||'',acc:s?.acc||'',ifsc:s?.ifsc||'',materials:s?.materials?.join(', ')||'',status:s?.status||'Active'});
  const set = k => e => setF(p=>({...p,[k]:e.target.value}));
  return (
    <Modal title={`${s?'Edit':'New'} Supplier`} onClose={onClose}
      footer={<><button className="btn btn-s" onClick={onClose}>Cancel</button><button className="btn btn-p" onClick={()=>onSave({...f,materials:f.materials.split(',').map(m=>m.trim()).filter(Boolean)},s?._id)}><i className="ti ti-device-floppy"></i>Save</button></>}>
      <div className="fr2">
        <div className="fg"><label>Name <span className="req">*</span></label><input value={f.name} onChange={set('name')}/></div>
        <div className="fg"><label>Contact Person</label><input value={f.contact} onChange={set('contact')}/></div>
      </div>
      <div className="fr2">
        <div className="fg"><label>Phone</label><input value={f.phone} onChange={set('phone')}/></div>
        <div className="fg"><label>Email</label><input value={f.email} onChange={set('email')}/></div>
      </div>
      <div className="fg"><label>Address</label><input value={f.address} onChange={set('address')}/></div>
      <div className="fr2">
        <div className="fg"><label>GST</label><input value={f.gst} onChange={set('gst')}/></div>
        <div className="fg"><label>Status</label><select value={f.status} onChange={set('status')}><option>Active</option><option>Inactive</option></select></div>
      </div>
      <div className="fg"><label>Materials (comma-separated)</label><input value={f.materials} onChange={set('materials')} placeholder="PET Bottles, HDPE Drums"/></div>
      <div className="fr2">
        <div className="fg"><label>Bank Name</label><input value={f.bank} onChange={set('bank')} placeholder="HDFC Bank"/></div>
        <div className="fg"><label>Bank Branch</label><input value={f.branch} onChange={set('branch')} placeholder="T. Nagar Branch"/></div>
      </div>
      <div className="fr2">
        <div className="fg"><label>Account No.</label><input value={f.acc} onChange={set('acc')} placeholder="501002345678"/></div>
        <div className="fg"><label>IFSC Code</label><input value={f.ifsc} onChange={set('ifsc')} placeholder="HDFC0001234"/></div>
      </div>
    </Modal>
  );
}

function LabModal({ item:l, onClose, onSave }) {
  const [f,setF] = useState({
    name:     l?.name||'',
    username: '',
    password: '',
    email:    l?.email||'',
    phone:    l?.phone||'',
    dob:      l?.dob||'',
    address:  l?.address||'',
    state:    l?.state||'',
    city:     l?.city||'',
    pincode:  l?.pincode||'',
    role:     'Labour',
    manager:  '',
    status:   l?.status||'Active',
    bank:     l?.bank||'',
    branch:   l?.branch||'',
    acc:      l?.acc||'',
    ifsc:     l?.ifsc||''
  });
  const set = k => e => setF(p=>({...p,[k]:e.target.value}));
  return (
    <Modal title={`${l?'Edit':'New'} Labour Profile`} size="modal-m" onClose={onClose}
      footer={<><button className="btn btn-s" onClick={onClose}>Cancel</button><button className="btn btn-p" onClick={()=>onSave(f,l?._id)}><i className="ti ti-device-floppy"></i>Save Details</button></>}>
      
      <div style={{fontSize:11,fontWeight:700,color:'var(--tx3)',textTransform:'uppercase',letterSpacing:.5,marginBottom:10,paddingBottom:6,borderBottom:'1px solid var(--bd)'}}>
        Worker Information
      </div>
      <div className="fr2">
        <div className="fg"><label>Full Name <span className="req">*</span></label><input value={f.name} onChange={set('name')} placeholder="Worker full name" autoFocus/></div>
        <div className="fg"><label>Phone Number</label><input value={f.phone} onChange={set('phone')} placeholder="+91..."/></div>
      </div>
      <div className="fr2">
        <div className="fg"><label>Date of Birth</label><input type="date" value={f.dob} onChange={set('dob')}/></div>
        <div className="fg"><label>Account Status</label><select value={f.status} onChange={set('status')}><option>Active</option><option>Inactive</option></select></div>
      </div>

      <div style={{fontSize:11,fontWeight:700,color:'var(--tx3)',textTransform:'uppercase',letterSpacing:.5,margin:'16px 0 10px',paddingBottom:6,borderBottom:'1px solid var(--bd)'}}>
        Contact & Address
      </div>
      <div className="fg"><label>Email Address</label><input value={f.email} onChange={set('email')} placeholder="optional email"/></div>
      <div className="fg"><label>Address</label><input value={f.address} onChange={set('address')} placeholder="Street address"/></div>
      <div className="fr3">
        <div className="fg"><label>City</label><input value={f.city} onChange={set('city')} placeholder="City"/></div>
        <div className="fg"><label>State</label><input value={f.state} onChange={set('state')} placeholder="State"/></div>
        <div className="fg"><label>Pincode</label><input value={f.pincode} onChange={set('pincode')} placeholder="ZIP / Pin"/></div>
      </div>

      <div style={{fontSize:11,fontWeight:700,color:'var(--tx3)',textTransform:'uppercase',letterSpacing:.5,margin:'16px 0 10px',paddingBottom:6,borderBottom:'1px solid var(--bd)'}}>
        Bank Details (Salary / Account)
      </div>
      <div className="fr2">
        <div className="fg"><label>Bank Name</label><input value={f.bank} onChange={set('bank')} placeholder="HDFC Bank"/></div>
        <div className="fg"><label>Bank Branch</label><input value={f.branch} onChange={set('branch')} placeholder="T. Nagar Branch"/></div>
      </div>
      <div className="fr2">
        <div className="fg"><label>Account No.</label><input value={f.acc} onChange={set('acc')} placeholder="501002345678"/></div>
        <div className="fg"><label>IFSC Code</label><input value={f.ifsc} onChange={set('ifsc')} placeholder="HDFC0001234"/></div>
      </div>

    </Modal>
  );
}

function CliModal({ item:c, onClose, onSave }) {
  const [f,setF] = useState({name:c?.name||'',contact:c?.contact||'',phone:c?.phone||'',email:c?.email||'',address:c?.address||'',gst:c?.gst||'',bank:c?.bank||'',branch:c?.branch||'',acc:c?.acc||'',ifsc:c?.ifsc||'',status:c?.status||'Active'});
  const set = k => e => setF(p=>({...p,[k]:e.target.value}));
  return (
    <Modal title={`${c?'Edit':'New'} Client`} onClose={onClose}
      footer={<><button className="btn btn-s" onClick={onClose}>Cancel</button><button className="btn btn-p" onClick={()=>onSave(f,c?._id)}><i className="ti ti-device-floppy"></i>Save</button></>}>
      <div className="fr2">
        <div className="fg"><label>Name <span className="req">*</span></label><input value={f.name} onChange={set('name')}/></div>
        <div className="fg"><label>Contact Person</label><input value={f.contact} onChange={set('contact')}/></div>
      </div>
      <div className="fr2">
        <div className="fg"><label>Phone</label><input value={f.phone} onChange={set('phone')}/></div>
        <div className="fg"><label>Email</label><input value={f.email} onChange={set('email')}/></div>
      </div>
      <div className="fg"><label>Address</label><input value={f.address} onChange={set('address')}/></div>
      <div className="fr2">
        <div className="fg"><label>GST</label><input value={f.gst} onChange={set('gst')}/></div>
        <div className="fg"><label>Status</label><select value={f.status} onChange={set('status')}><option>Active</option><option>Inactive</option></select></div>
      </div>
      <div className="fr2">
        <div className="fg"><label>Bank Name</label><input value={f.bank} onChange={set('bank')} placeholder="HDFC Bank"/></div>
        <div className="fg"><label>Bank Branch</label><input value={f.branch} onChange={set('branch')} placeholder="T. Nagar Branch"/></div>
      </div>
      <div className="fr2">
        <div className="fg"><label>Account No.</label><input value={f.acc} onChange={set('acc')} placeholder="501002345678"/></div>
        <div className="fg"><label>IFSC Code</label><input value={f.ifsc} onChange={set('ifsc')} placeholder="HDFC0001234"/></div>
      </div>
    </Modal>
  );
}

function ProfileDrawer({ item, type, onClose }) {
  if (!item) return null;
  return (
    <Drawer title={`${type.charAt(0).toUpperCase()+type.slice(1)} — ${item.name}`} onClose={onClose}>
      <div className="d-sec">
        <h4>Details</h4>
        <div className="d-grid">
          {item.contact&&<div className="d-field"><label>Contact</label><div className="dv">{item.contact}</div></div>}
          {item.role&&<div className="d-field"><label>Role</label><div className="dv"><span className="badge b-emp">{item.role}</span></div></div>}
          {item.username&&<div className="d-field"><label>Username</label><div className="dv mono">@{item.username}</div></div>}
          {item.phone&&<div className="d-field"><label>Phone</label><div className="dv">{item.phone}</div></div>}
          {item.email&&<div className="d-field"><label>Email</label><div className="dv">{item.email}</div></div>}
          {item.dob&&<div className="d-field"><label>Date of Birth</label><div className="dv">{item.dob}</div></div>}
          {item.manager&&<div className="d-field"><label>Manager</label><div className="dv">{item.manager}</div></div>}
          {(item.city||item.state||item.pincode)&&<div className="d-field"><label>Location</label><div className="dv">{[item.city,item.state,item.pincode].filter(Boolean).join(', ')}</div></div>}
          {item.address&&<div className="d-field" style={{gridColumn:'1/-1'}}><label>Address</label><div className="dv">{item.address}</div></div>}
          {item.gst&&<div className="d-field"><label>GST</label><div className="dv mono">{item.gst}</div></div>}
          {item.bank&&<div className="d-field" style={{gridColumn:'1/-1'}}><label>Bank Account</label><div className="dv">{item.bank}{item.branch?` (${item.branch})`:''} · Acc: <span className="mono">{item.acc||'—'}</span> · IFSC: <span className="mono">{item.ifsc||'—'}</span></div></div>}
          {item.materials&&<div className="d-field"><label>Materials</label><div className="dv">{item.materials.join(', ')}</div></div>}
          {item.rate!==undefined&&<div className="d-field"><label>Rate / kg</label><div className="dv acc">{fmtMon(item.rate)}</div></div>}
          {item.outstanding!==undefined&&<div className="d-field"><label>Outstanding</label><div className={`dv ${item.outstanding>0?'err':'ok'}`}>{fmtMon(item.outstanding)}</div></div>}
        </div>
      </div>
      {item.txns?.length>0&&(
        <div className="d-sec">
          <h4>Transaction History</h4>
          {item.txns.map((t,i)=>(
            <div key={i} className="rh-row">
              <span>{t.date} · {t.desc}</span>
              <span className="mono" style={{color:t.dr>0?'var(--ok)':'var(--err)',fontWeight:700}}>
                {t.dr>0?'+'+fmtMon(t.dr):'-'+fmtMon(t.cr)}
              </span>
            </div>
          ))}
        </div>
      )}
      {item.rateHistory?.length>0&&(
        <div className="d-sec">
          <h4>Rate History</h4>
          {item.rateHistory.map((r,i)=>(
            <div key={i} className="rh-row">
              <span>{r.date} · Changed by {r.by}</span>
              <span className="mono" style={{fontWeight:700}}>{fmtMon(r.rate)}/kg</span>
            </div>
          ))}
        </div>
      )}
    </Drawer>
  );
}
