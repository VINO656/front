import React, { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Modal, Drawer } from '../../components/Modal';
import { fmtMon, fmtWt, fmtDate, todayISO, nowISO } from '../../utils/fmt';
import api from '../../lib/api';

export default function Cleaning({ setActions }) {
  const { activeUnitId, toast, isAdmin } = useApp();
  const [jobs, setJobs] = useState([]);
  const [labours, setLabours] = useState([]);
  const [rawMaterials, setRawMaterials] = useState([]);
  const [rawInventory, setRawInventory] = useState([]);
  const [cleaningUnitWt, setCleaningUnitWt] = useState(50);
  const [modal, setModal] = useState(null);
  const [drawer, setDrawer] = useState(null);
  const [q, setQ] = useState('');

  const load = async () => {
    if (!activeUnitId) return;
    const [j,l,inv,set] = await Promise.all([
      api.get('/cleaning',{params:{unitId:activeUnitId}}),
      api.get('/labours',{params:{unitId:activeUnitId}}),
      api.get('/inventory',{params:{unitId:activeUnitId,category:'raw',status:'Available'}}),
      api.get('/settings',{params:{unitId:activeUnitId}})
    ]);
    setJobs(j.data); setLabours(l.data);
    setRawInventory(inv.data);
    setRawMaterials([...new Set(inv.data.map(i=>i.material))].filter(Boolean));
    if (set.data && set.data.cleaningUnitWt) setCleaningUnitWt(set.data.cleaningUnitWt);
  };

  useEffect(() => { load(); }, [activeUnitId]);
  useEffect(() => {
    setActions(<button className="btn btn-p" onClick={()=>setModal(true)}><i className="ti ti-plus"></i>New Cleaning Job</button>);
  }, []);

  const save = async (form) => {
    try {
      const { labourId, date, shift, batches, payType, payAmt, payNote, note, _id } = form;
      if (!labourId || !batches?.length || batches.some(b => !b.material)) {
        toast('Labour and material for all batches required.', 'err');
        return;
      }
      if (!_id) {
        for (const b of batches) {
          const avail = rawInventory.filter(x => x.material === b.material).reduce((s, i) => s + (i.createdWt - (i.soldWt||0) - (i.returnedWt||0)), 0);
          if ((+b.inputWt || 0) > avail) {
            toast(`Input weight (${b.inputWt} kg) for ${b.material} exceeds available stock (${avail} kg)!`, 'err');
            return;
          }
        }
      }
      const totalInputWt   = batches.reduce((a,b)=>a+(+b.inputWt||0),0);
      const totalCleanedWt = batches.reduce((a,b)=>a+(+b.cleanedWt||0),0);
      const totalWastage   = batches.reduce((a,b)=>a+(+b.wastage||0),0);
      const labourAmt = totalCleanedWt * (+form.labourRate||0);
      const finishedUnits = Math.floor(totalCleanedWt / (cleaningUnitWt||50));
      const payPerUnit = (+form.labourRate||0) * (cleaningUnitWt||50);
      const paidAmt = +payAmt||0;
      
      if (_id) {
        // For edit, just update without recreating inventory
        const oldJob = jobs.find(x=>x._id===_id) || {};
        const oldPaid = oldJob.paidAmt || 0;
        const payStatus = oldPaid===0 ? 'Unpaid' : oldPaid>=labourAmt ? 'Paid' : 'Partial';
        await api.put('/cleaning/'+_id, {
          date:fmtDate(date), shift, labourId, batches, totalInputWt, totalCleanedWt, totalWastage,
          labourRate:+form.labourRate||0, labourAmt, payStatus, outstanding: labourAmt - oldPaid,
          finishedUnits, payPerUnit, cleaningUnitWt, note
        });
        toast('Cleaning job updated.'); load(); setModal(null);
        return;
      }

      const payStatus = paidAmt===0?'Unpaid':paidAmt>=labourAmt?'Paid':'Partial';
      const payLog = paidAmt>0?[{date:fmtDate(date),type:payType,amt:paidAmt,note:payNote}]:[];
      const { data: createdJob } = await api.post('/cleaning', {
        unitId:activeUnitId, date:fmtDate(date), shift, labourId,
        batches, totalInputWt, totalCleanedWt, totalWastage,
        labourRate:+form.labourRate||0, labourAmt, payStatus, paidAmt, outstanding:labourAmt-paidAmt, payLog,
        finishedUnits, payPerUnit, cleaningUnitWt, note
      });
      // Create cleaned inventory batch
      for (const b of batches) {
        if (!b.material) continue;
        await api.post('/inventory', {
          batchId:`CM-${Date.now()}-${Math.random().toString(36).slice(2,5)}`,
          unitId:activeUnitId, category:'cleaned', material:b.material,
          sourceType:'cleaning', sourceRef: createdJob?.jobId || '', createdDate:fmtDate(date),
          createdWt:+b.cleanedWt, soldWt:0, returnedWt:0,
          ledger:[{date:fmtDate(date),type:'IN',qty:+b.cleanedWt,note:'Cleaned'}],
          status:'Available'
        });
      }
      toast('Cleaning job created.'); load(); setModal(null);
    } catch (e) {
      console.error(e);
      toast(e.response?.data?.message || e.message || 'Error saving job', 'err');
    }
  };

  const deleteJob = async (id) => {
    if (!window.confirm('Delete this cleaning job?')) return;
    await api.delete('/cleaning/'+id);
    toast('Cleaning job deleted.');
    load();
  };

  const addPay = async (job, type, amt, note) => {
    const newPaid = job.paidAmt + (+amt||0);
    const outstanding = job.labourAmt - newPaid;
    const payStatus = newPaid===0?'Unpaid':newPaid>=job.labourAmt?'Paid':'Partial';
    const payLog = [...(job.payLog||[]),{date:fmtDate(nowISO()),type,amt:+amt,note}];
    await api.put('/cleaning/'+job._id, {paidAmt:newPaid, outstanding, payStatus, payLog});
    toast('Payment recorded.'); load(); setDrawer(null);
  };

  const editPay = async (job, index, type, amt, note) => {
    const newLog = [...(job.payLog || [])];
    const oldAmt = newLog[index]?.amt || 0;
    const diff = (+amt || 0) - oldAmt;
    newLog[index] = { ...newLog[index], type, amt: +amt || 0, note };
    
    const newPaid = job.paidAmt + diff;
    const outstanding = job.labourAmt - newPaid;
    const payStatus = newPaid === 0 ? 'Unpaid' : newPaid >= job.labourAmt ? 'Paid' : 'Partial';
    
    await api.put('/cleaning/' + job._id, { paidAmt: newPaid, outstanding, payStatus, payLog: newLog });
    toast('Payment updated.'); load(); setDrawer(null);
  };

  const deletePay = async (job, index) => {
    if (!window.confirm('Delete this payment entry?')) return;
    const newLog = [...(job.payLog || [])];
    const removedAmt = newLog[index]?.amt || 0;
    newLog.splice(index, 1);
    
    const newPaid = job.paidAmt - removedAmt;
    const outstanding = job.labourAmt - newPaid;
    const payStatus = newPaid === 0 ? 'Unpaid' : newPaid >= job.labourAmt ? 'Paid' : 'Partial';
    
    await api.put('/cleaning/' + job._id, { paidAmt: newPaid, outstanding, payStatus, payLog: newLog });
    toast('Payment deleted.'); load(); setDrawer(null);
  };

  const getRunningOutstanding = (labour, currentJob) => {
    const jobList = jobs.filter(j => j.labourId === labour?._id && j.payStatus !== 'Cancelled')
      .sort((a,b) => new Date(a.createdAt||a.date) - new Date(b.createdAt||b.date) || (a.jobId||'').localeCompare(b.jobId||''));
    let runningTotal = 0;
    for (const j of jobList) {
      runningTotal += j.outstanding;
      if (j._id === currentJob._id) break;
    }
    return runningTotal;
  };

  const filtered = jobs.filter(j => {
    const l = labours.find(x => x._id === j.labourId);
    const s = `${j.note||''} ${j.date||''} ${l?.name||''}`.toLowerCase();
    return s.includes(q.toLowerCase());
  });

  return (
    <div className="page">
      <div className="kpi-grid">
        <div className="kpi-card"><div className="kpi-label">Total Jobs</div><div className="kpi-value">{jobs.length}</div></div>
        <div className="kpi-card"><div className="kpi-label">Total Cleaned</div><div className="kpi-value acc">{fmtWt(jobs.reduce((a,j)=>a+j.totalCleanedWt,0))}</div></div>
        <div className="kpi-card"><div className="kpi-label">Labour Cost</div><div className="kpi-value">{fmtMon(jobs.reduce((a,j)=>a+j.labourAmt,0))}</div></div>
        <div className="kpi-card"><div className="kpi-label">Outstanding</div><div className="kpi-value err">{fmtMon(jobs.reduce((a,j)=>a+j.outstanding,0))}</div></div>
      </div>
      <div className="table-card">
        <div className="table-toolbar"><h3>Cleaning Jobs</h3>
          <div className="search-box"><i className="ti ti-search"></i><input placeholder="Search…" value={q} onChange={e=>setQ(e.target.value)}/></div>
        </div>
        <div className="tbl-scroll"><table>
          <thead><tr><th>Notes</th><th>Date</th><th>Shift</th><th>Labour</th><th>Input Wt</th><th>Cleaned Wt</th><th>Labour Amt</th><th>Payment</th><th>Actions</th></tr></thead>
          <tbody>
            {filtered.map(j=>{
              const l = labours.find(x=>x._id===j.labourId);
              return (
                <tr key={j._id}>
                  <td>{j.note || '—'}</td>
                  <td>{j.date}</td>
                  <td>{j.shift||'—'}</td>
                  <td>
                    <div>{l?.name||'—'}</div>
                    {l && <div style={{fontSize:11, color:'var(--err)'}}>Total Out: {fmtMon(getRunningOutstanding(l, j))}</div>}
                  </td>
                  <td className="mono">{fmtWt(j.totalInputWt)}</td>
                  <td className="mono">{fmtWt(j.totalCleanedWt)}</td>
                  <td className="mono" style={{color:'var(--acc)',fontWeight:700}}>{fmtMon(j.labourAmt)}</td>
                  <td><span className={`badge ${j.payStatus==='Paid'?'b-ok':j.payStatus==='Partial'?'b-warn':'b-err'}`}>{j.payStatus}</span></td>
                  <td><div className="act-btns">
                    <button className="icon-btn" onClick={()=>setDrawer(j)}><i className="ti ti-eye"></i></button>
                    {isAdmin && <button className="icon-btn" onClick={()=>setModal(j)}><i className="ti ti-edit"></i></button>}
                    {isAdmin && <button className="icon-btn" onClick={()=>deleteJob(j._id)} style={{color:'var(--err)'}}><i className="ti ti-trash"></i></button>}
                  </div></td>
                </tr>
              );
            })}
            {!filtered.length&&<tr><td colSpan="9" className="empty-row"><i className="ti ti-windmill"></i><p>No cleaning jobs yet</p></td></tr>}
          </tbody>
        </table></div>
      </div>

      {modal&&<CleaningModal job={modal!==true?modal:null} labours={labours} rawMaterials={rawMaterials} onClose={()=>setModal(null)} onSave={save} cleaningUnitWt={cleaningUnitWt}/>}
      {drawer&&<CleaningDrawer job={drawer} labour={labours.find(l=>l._id===drawer.labourId)} onClose={()=>setDrawer(null)} onPay={addPay} onEditPay={editPay} onDeletePay={deletePay}/>}
    </div>
  );
}

function CleaningModal({ job, labours, rawMaterials, rawInventory = [], onClose, onSave, cleaningUnitWt }) {
  const [date, setDate] = useState(job?.createdAt ? job.createdAt.slice(0, 16) : nowISO());
  const [shift, setShift] = useState(job?.shift||'Morning');
  const [labourId, setLabourId] = useState(job?.labourId||'');
  const [labourRate, setLabourRate] = useState(job?.labourRate||'');
  const [batches, setBatches] = useState(job?.batches?.length?job.batches:[{material:'',inputWt:0,cleanedWt:0,wastage:0}]);
  const [payType, setPayType] = useState(job?.payLog?.[0]?.type || 'Cash');
  const [payAmt, setPayAmt] = useState(job?.paidAmt !== undefined && job.paidAmt !== 0 ? job.paidAmt : '');
  const [payNote, setPayNote] = useState(job?.payLog?.[0]?.note || '');
  const [note, setNote] = useState(job?.note || '');

  const lab = labours.find(l=>l._id===labourId);
  const totalCleaned = batches.reduce((a,b)=>a+(+b.cleanedWt||0),0);
  const labourAmt = totalCleaned * (+labourRate||0);

  const getAvailWt = (mat) => rawInventory.filter(x => x.material === mat).reduce((sum, item) => sum + (item.createdWt - (item.soldWt || 0) - (item.returnedWt || 0)), 0);

  const updBatch = (i,k,v) => {
    const nb = [...batches];
    nb[i]={...nb[i],[k]:v};
    if(k==='inputWt'||k==='cleanedWt') nb[i].wastage=(+nb[i].inputWt||0)-(+nb[i].cleanedWt||0);
    setBatches(nb);
  };

  return (
    <Modal title={job ? "Edit Cleaning Job" : "New Cleaning Job"} size="modal-lg" onClose={onClose}
      footer={<><button className="btn btn-s" onClick={onClose}>Cancel</button><button className="btn btn-p" onClick={()=>onSave({_id:job?._id,labourId,date,shift,labourRate,batches,payType,payAmt,payNote,note})}><i className="ti ti-device-floppy"></i>Save Job</button></>}>
      <div className="fr3">
        <div className="fg"><label>Date <span className="req">*</span></label><input type="date" value={date ? date.slice(0, 10) : ''} onChange={e => { const curTime = new Date().toTimeString().slice(0, 8); setDate(`${e.target.value}T${curTime}`); }}/></div>
        <div className="fg"><label>Shift</label><select value={shift} onChange={e=>setShift(e.target.value)}><option value="Morning">Morning</option><option value="Evening">Evening</option><option value="Night">Night</option></select></div>
        <div className="fg"><label>Labour <span className="req">*</span></label>
          <select value={labourId} onChange={e=>{
            setLabourId(e.target.value);
            setLabourRate('');
          }}>
            <option value="">Select labour…</option>
            {labours.filter(l=>l.status==='Active').map(l=><option key={l._id} value={l._id}>{l.name}</option>)}
          </select>
        </div>
        <div className="fg"><label>Rate (₹/kg)</label><input type="number" step="0.01" value={labourRate} onChange={e=>setLabourRate(e.target.value)}/></div>
      </div>
      <div className="fg" style={{marginTop: 12}}>
        <label>Notes</label>
        <input placeholder="Enter notes or description…" value={note} onChange={e=>setNote(e.target.value)}/>
      </div>
      <div className="fsec">
        <div className="fsec-title">Batches
          <button className="btn btn-s btn-sm" onClick={()=>setBatches(p=>[...p,{material:'',inputWt:0,cleanedWt:0,wastage:0}])}><i className="ti ti-plus"></i>Add</button>
        </div>
        {batches.map((b,i)=>(
          <div key={i} className="item-line">
            <div className="item-line-hdr">
              <span className="item-num">Batch {i+1}</span>
              {batches.length>1&&<i className="ti ti-trash item-del" onClick={()=>setBatches(p=>p.filter((_,j)=>j!==i))}></i>}
            </div>
            <div className="fr1">
              <div className="fg"><label>Material {b.material && <span style={{fontSize: 11, color: 'var(--acc)', fontWeight: 600, marginLeft: 8}}>(Avail: {fmtWt(getAvailWt(b.material))})</span>}</label>
                <select value={b.material} onChange={e=>updBatch(i,'material',e.target.value)}>
                  <option value="">Select material…</option>
                  {rawMaterials.map(m=><option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            </div>
            <div className="fr3">
              <div className="fg"><label>Input Wt (kg)</label><input type="number" step="0.01" value={b.inputWt||''} onChange={e=>updBatch(i,'inputWt',e.target.value)}/></div>
              <div className="fg"><label>Cleaned Wt (kg)</label><input type="number" step="0.01" value={b.cleanedWt||''} onChange={e=>updBatch(i,'cleanedWt',e.target.value)}/></div>
              <div className="fg"><label>Wastage (kg)</label><input readOnly value={fmtWt(b.wastage||0)}/></div>
            </div>
          </div>
        ))}
        <div className="calc-box">
          <div className="calc-grid">
            <div><div className="cl">Cleaned Wt</div><div className="cv">{fmtWt(totalCleaned)}</div></div>
            <div><div className="cl">Finished Units</div><div className="cv">{Math.floor(totalCleaned / cleaningUnitWt)}</div></div>
            <div><div className="cl">Labour Amount</div><div className="cv">{fmtMon(labourAmt)}</div></div>
          </div>
        </div>
      </div>
      {!job && (
      <div className="fsec">
        <div className="fsec-title">Payment</div>
        <div className="pay-type-btns">
          {['None','Cash','Bank Transfer','UPI'].map(t=>(
            <button key={t} className={`ptb${payType===t?' sel':''}`} onClick={()=>setPayType(t)}>{t}</button>
          ))}
        </div>
        {payType!=='None'&&(
          <div className="fr2">
            <div className="fg"><label>Amount Paid</label><input type="number" value={payAmt} onChange={e=>setPayAmt(e.target.value)}/></div>
            <div className="fg"><label>Note</label><input value={payNote} onChange={e=>setPayNote(e.target.value)}/></div>
          </div>
        )}
      </div>
      )}
    </Modal>
  );
}

function CleaningDrawer({ job:j, labour:l, cleaningUnitWt, onClose, onPay, onEditPay, onDeletePay }) {
  const [payType, setPayType] = useState('Cash');
  const [payAmt, setPayAmt] = useState('');
  const [payNote, setPayNote] = useState('');
  
  const [editIndex, setEditIndex] = useState(null);
  const [editType, setEditType] = useState('Cash');
  const [editAmt, setEditAmt] = useState('');
  const [editNote, setEditNote] = useState('');

  const unitBundle = j.cleaningUnitWt || cleaningUnitWt || 50;
  const units = j.finishedUnits !== undefined && j.finishedUnits !== null ? j.finishedUnits : Math.floor((j.totalCleanedWt||0) / unitBundle);
  const waste = j.totalWastage !== undefined ? j.totalWastage : (j.totalInputWt||0) - (j.totalCleanedWt||0);
  const rate  = j.payPerUnit !== undefined ? j.payPerUnit : ((j.labourRate||0) * unitBundle);

  return (
    <Drawer title={`Cleaning Job${j.note ? ' — ' + j.note : ''}`} onClose={onClose}
      footer={<button className="btn btn-s" onClick={onClose}>Close</button>}>
      <div className="d-sec">
        <h4>Job Details & KPI</h4>
        <div className="d-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 14 }}>
          <div className="d-field"><label>Date</label><div className="dv">{j.date}</div></div>
          <div className="d-field"><label>Shift</label><div className="dv">{j.shift||'—'}</div></div>
          <div className="d-field"><label>Labour</label><div className="dv">{l?.name||'—'}</div></div>
        </div>

        <div className="pay-summary" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, padding: 10, background: 'var(--bg2)', borderRadius: 8, marginBottom: 12 }}>
          <div className="pay-stat"><div className="psl">Input Wt</div><div className="psv mono">{fmtWt(j.totalInputWt)}</div></div>
          <div className="pay-stat"><div className="psl">Cleaned Wt</div><div className="psv mono" style={{ color: 'var(--acc)' }}>{fmtWt(j.totalCleanedWt)}</div></div>
          <div className="pay-stat"><div className="psl">Waste Generated</div><div className="psv mono" style={{ color: waste > 0 ? 'var(--warn)' : 'inherit' }}>{fmtWt(waste)}</div></div>
          <div className="pay-stat"><div className="psl">Units Created</div><div className="psv mono">{units}</div></div>
          <div className="pay-stat"><div className="psl">Pay / Unit</div><div className="psv mono">{fmtMon(rate)}</div></div>
          <div className="pay-stat"><div className="psl">Total Labour</div><div className="psv mono" style={{ color: 'var(--acc)' }}>{fmtMon(j.labourAmt)}</div></div>
        </div>

        <div className="pay-summary">
          <div className="pay-stat"><div className="psl">Paid</div><div className="psv" style={{color:'var(--ok)'}}>{fmtMon(j.paidAmt)}</div></div>
          <div className="pay-stat"><div className="psl">Outstanding</div><div className="psv" style={{color:j.outstanding>0?'var(--err)':'var(--ok)'}}>{fmtMon(j.outstanding)}</div></div>
        </div>
      </div>
      <div className="d-sec">
        <h4>Batches</h4>
        {j.batches?.map((b,i)=>(
          <div key={i} className="item-line" style={{marginBottom:8}}>
            <div style={{fontWeight:600,marginBottom:6}}>{b.material}</div>
            <div className="wt-trio">
              <div className="wt-col"><span className="wl">Input</span><span className="wv">{fmtWt(b.inputWt)}</span></div>
              <div className="wt-col"><span className="wl">Cleaned</span><span className="wv">{fmtWt(b.cleanedWt)}</span></div>
              <div className="wt-col"><span className="wl">Wastage</span><span className="wv" style={{color:'var(--err)'}}>{fmtWt(b.wastage)}</span></div>
            </div>
          </div>
        ))}
      </div>
      {j.payStatus !== 'Cancelled' && (
        <div className="d-sec">
          <h4>Record Payment</h4>
          <div className="pay-type-btns">
            {['Cash','Bank Transfer','UPI'].map(t=>(
              <button key={t} className={`ptb${payType===t?' sel':''}`} onClick={()=>setPayType(t)}>{t}</button>
            ))}
          </div>
          <div className="fr2">
            <div className="fg"><label>Amount</label><input type="number" value={payAmt} onChange={e=>setPayAmt(e.target.value)}/></div>
            <div className="fg"><label>Note</label><input value={payNote} onChange={e=>setPayNote(e.target.value)}/></div>
          </div>
          <button className="btn btn-ok" onClick={()=>onPay(j,payType,payAmt,payNote)}><i className="ti ti-cash"></i>Record Payment</button>
        </div>
      )}
      <div className="d-sec">
        <h4>Payment Log</h4>
        {j.payLog?.map((pl,i)=>(
          editIndex === i ? (
            <div key={i} style={{background:'var(--bg2)',padding:10,borderRadius:6,marginBottom:8,border:'1px solid var(--bd)'}}>
              <div className="pay-type-btns" style={{marginBottom:8}}>
                {['Cash','Bank Transfer','UPI'].map(t=>(
                  <button key={t} className={`ptb${editType===t?' sel':''}`} onClick={()=>setEditType(t)}>{t}</button>
                ))}
              </div>
              <div className="fr2" style={{marginBottom:8}}>
                <div className="fg"><label>Amount</label><input type="number" value={editAmt} onChange={e=>setEditAmt(e.target.value)}/></div>
                <div className="fg"><label>Note</label><input value={editNote} onChange={e=>setEditNote(e.target.value)}/></div>
              </div>
              <div style={{display:'flex',gap:8}}>
                <button className="btn btn-ok btn-sm" onClick={() => onEditPay(j, i, editType, editAmt, editNote)}><i className="ti ti-check"></i>Save</button>
                <button className="btn btn-s btn-sm" onClick={() => setEditIndex(null)}>Cancel</button>
              </div>
            </div>
          ) : (
            <div key={i} className="pay-log-row" style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div>
                <span>{pl.date?.split('T')[0]} · {pl.type}{pl.note?' — '+pl.note:''}</span>
              </div>
              <div style={{display:'flex',alignItems:'center',gap:10}}>
                <span className="mono" style={{color:'var(--ok)',fontWeight:700}}>{fmtMon(pl.amt)}</span>
                <div style={{display:'flex',gap:4}}>
                  <button className="icon-btn" onClick={() => {setEditIndex(i); setEditType(pl.type||'Cash'); setEditAmt(pl.amt||0); setEditNote(pl.note||'');}} style={{padding:2,height:22,width:22}} title="Edit Payment"><i className="ti ti-edit" style={{fontSize:14}}></i></button>
                  <button className="icon-btn" onClick={() => onDeletePay(j, i)} style={{padding:2,height:22,width:22,color:'var(--err)'}} title="Delete Payment"><i className="ti ti-trash" style={{fontSize:14}}></i></button>
                </div>
              </div>
            </div>
          )
        ))}
        {!j.payLog?.length&&<div style={{fontSize:11,color:'var(--tx3)'}}>No payments recorded</div>}
      </div>
    </Drawer>
  );
}
