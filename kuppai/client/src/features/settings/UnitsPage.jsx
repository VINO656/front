import React, { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Modal } from '../../components/Modal';
import api from '../../lib/api';

const COLORS = ['#1e3a5f','#0f6e56','#854F0B','#534AB7','#993556','#3B6D11'];

export default function Units({ setActions }) {
  const { activeUnitId, setActiveUnitId, units, refreshUnits, toast, setCurrentPage } = useApp();
  const [counts, setCounts] = useState({});
  const [modal, setModal] = useState(null); // null | {unit}

  useEffect(() => {
    setActions(<button className="btn btn-p" onClick={()=>setModal({unit:null})}><i className="ti ti-plus"></i>New Unit</button>);
    loadCounts();
  }, [units]);

  const loadCounts = async () => {
    const [s,l,c] = await Promise.all([
      api.get('/suppliers'), api.get('/labours'), api.get('/clients')
    ]);
    const cnt = {};
    units.forEach(u => {
      cnt[u._id] = {
        suppliers: s.data.filter(x=>x.unitId===u._id).length,
        labours:   l.data.filter(x=>x.unitId===u._id).length,
        clients:   c.data.filter(x=>x.unitId===u._id).length,
      };
    });
    setCounts(cnt);
  };

  const save = async (form, id) => {
    if (!form.name||!form.code||!form.location) { toast('Fill all required fields.','err'); return; }
    if (id) {
      await api.put('/units/'+id, form);
      toast('Unit updated.');
    } else {
      await api.post('/units', form);
      toast('Unit created.');
    }
    await refreshUnits();
    setModal(null);
  };

  const toggle = async (u) => {
    await api.put('/units/'+u._id, { status: u.status==='Active'?'Inactive':'Active' });
    await refreshUnits();
    toast(`Unit ${u.status==='Active'?'deactivated':'activated'}.`);
  };

  return (
    <div className="page">
      <div className="kpi-grid">
        <div className="kpi-card"><div className="kpi-label">Total Units</div><div className="kpi-value">{units.length}</div></div>
        <div className="kpi-card"><div className="kpi-label">Active</div><div className="kpi-value ok">{units.filter(u=>u.status==='Active').length}</div></div>
      </div>

      <div className="unit-grid">
        {units.map(u => {
          const c = counts[u._id] || {};
          return (
            <div key={u._id} className={`unit-card${u._id===activeUnitId?' current':''}`}>
              <div className="unit-card-top">
                {u.logo ? (
                  <img src={u.logo} alt="" style={{width:32,height:32,borderRadius:6,objectFit:'contain',background:'var(--pm)',padding:2,border:'1px solid var(--bd)'}}/>
                ) : (
                  <div className="unit-card-dot" style={{background:u.color,width:14,height:14}} title="Branch Colour Code"></div>
                )}
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:13,fontWeight:700,color:'var(--tx)',display:'flex',alignItems:'center',gap:6}}>
                    {u.name}
                    {!u.logo && <span style={{width:8,height:8,borderRadius:'50%',background:u.color,display:'inline-block'}} title="Colour Badge"></span>}
                  </div>
                  <div style={{fontSize:10,color:'var(--tx3)',marginTop:1}}>{u.location} · <span className="mono">{u.code}</span></div>
                </div>
                <span className={`badge ${u.status==='Active'?'b-ok':'b-err'}`}>{u.status}</span>
              </div>
              <div className="unit-card-body">
                {u.gst && <div className="unit-stat-row"><span style={{color:'var(--tx3)'}}>GSTIN</span><span className="mono" style={{fontWeight:600,fontSize:10}}>{u.gst}</span></div>}
                {u.bankAcc && <div className="unit-stat-row"><span style={{color:'var(--tx3)'}}>Bank</span><span style={{fontWeight:600}}>{u.bankName || 'Bank'}{u.bankBranch?` · ${u.bankBranch}`:''} ({u.bankAcc.slice(-4)})</span></div>}
                <div className="unit-stat-row"><span style={{color:'var(--tx3)'}}>Suppliers</span><span style={{fontWeight:600}}>{c.suppliers||0}</span></div>
                <div className="unit-stat-row"><span style={{color:'var(--tx3)'}}>Labours</span><span style={{fontWeight:600}}>{c.labours||0}</span></div>
                <div className="unit-stat-row"><span style={{color:'var(--tx3)'}}>Clients</span><span style={{fontWeight:600}}>{c.clients||0}</span></div>
              </div>
              <div className="unit-card-foot">
                <button className="btn btn-p btn-sm" style={{flex:1,justifyContent:'center'}} onClick={()=>{setActiveUnitId(u._id);setCurrentPage('dashboard');}}>
                  <i className="ti ti-eye"></i>Open
                </button>
                <button className="btn btn-s btn-sm" onClick={()=>setModal({unit:u})}><i className="ti ti-edit"></i></button>
                <button className="btn btn-s btn-sm" style={u.status==='Active'?{color:'var(--err)',borderColor:'var(--err)'}:{}} onClick={()=>toggle(u)}>
                  <i className={`ti ti-${u.status==='Active'?'ban':'check'}`}></i>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {modal !== null && <UnitModal unit={modal.unit} onClose={()=>setModal(null)} onSave={save}/>}
    </div>
  );
}

function UnitModal({ unit, onClose, onSave }) {
  const [form, setForm] = useState({
    name:     unit?.name || '',
    code:     unit?.code || '',
    location: unit?.location || '',
    status:   unit?.status || 'Active',
    color:    unit?.color || COLORS[0],
    logo:       unit?.logo || '',
    gst:        unit?.gst || '',
    bankName:   unit?.bankName || '',
    bankBranch: unit?.bankBranch || '',
    bankAcc:    unit?.bankAcc || '',
    ifsc:       unit?.ifsc || '',
  });

  const set = k => e => setForm(f=>({...f,[k]:e.target.value}));

  const handleLogoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => setForm(f => ({ ...f, logo: ev.target.result }));
      reader.readAsDataURL(file);
    }
  };

  return (
    <Modal title={`${unit?'Edit':'New'} Business Unit`} onClose={onClose}
      footer={<><button className="btn btn-s" onClick={onClose}>Cancel</button><button className="btn btn-p" onClick={()=>onSave(form,unit?._id)}><i className="ti ti-device-floppy"></i>Save</button></>}>
      
      <div className="fr2">
        <div className="fg"><label>Unit Name <span className="req">*</span></label><input value={form.name} onChange={set('name')} placeholder="e.g. Salem — Unit A"/></div>
        <div className="fg"><label>Code <span className="req">*</span></label><input value={form.code} onChange={set('code')} placeholder="e.g. KU-SA"/></div>
      </div>

      <div className="fr2">
        <div className="fg"><label>Location <span className="req">*</span></label><input value={form.location} onChange={set('location')} placeholder="City, State"/></div>
        <div className="fg"><label>GSTIN Number</label><input value={form.gst} onChange={set('gst')} placeholder="33ABCDE1234F1Z5"/></div>
      </div>

      <div className="fg">
        <label>Unit Logo (Upload File)</label>
        <div>
          <label className="btn btn-s" style={{cursor:'pointer',height:38,display:'inline-flex',alignItems:'center',gap:8,padding:'0 16px',border:'1px dashed var(--p)'}}>
            <i className="ti ti-upload"></i>{form.logo ? 'Change Image File' : 'Choose Image File to Upload'}
            <input type="file" accept="image/*" onChange={handleLogoChange} style={{display:'none'}}/>
          </label>
        </div>
        {form.logo && <div style={{marginTop:8,display:'flex',alignItems:'center',gap:8,fontSize:11,color:'var(--tx2)'}}>
          <img src={form.logo} alt="Logo preview" style={{height:32,width:32,objectFit:'contain',borderRadius:4,border:'1px solid var(--bd)'}}/>
          <span>Logo attached</span>
          <button className="icon-btn danger" style={{width:20,height:20,fontSize:11}} onClick={() => setForm(f => ({...f, logo:''}))} title="Remove"><i className="ti ti-x"></i></button>
        </div>}
      </div>

      <div style={{fontSize:11,fontWeight:700,color:'var(--tx3)',textTransform:'uppercase',letterSpacing:.5,margin:'16px 0 10px',paddingBottom:6,borderBottom:'1px solid var(--bd)'}}>
        Bank Account Details (For Unit Transactions)
      </div>
      <div className="fr2">
        <div className="fg"><label>Bank Name</label><input value={form.bankName} onChange={set('bankName')} placeholder="e.g. HDFC Bank"/></div>
        <div className="fg"><label>Bank Branch</label><input value={form.bankBranch} onChange={set('bankBranch')} placeholder="e.g. T. Nagar Branch"/></div>
      </div>
      <div className="fr2">
        <div className="fg"><label>Account Number</label><input value={form.bankAcc} onChange={set('bankAcc')} placeholder="501002345678"/></div>
        <div className="fg"><label>IFSC Code</label><input value={form.ifsc} onChange={set('ifsc')} placeholder="HDFC0001234"/></div>
      </div>

      <div className="fr2">
        <div className="fg"><label>Status</label><select value={form.status} onChange={set('status')}><option>Active</option><option>Inactive</option></select></div>
        <div className="fg">
          <label>Colour Tag (Branch Badge)</label>
          <select value={form.color} onChange={set('color')}>
            {COLORS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <div className="hint">Visual tag to identify this branch in top switcher</div>
        </div>
      </div>

    </Modal>
  );
}
