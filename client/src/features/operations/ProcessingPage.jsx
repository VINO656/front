import React, { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Modal, Drawer } from '../../components/Modal';
import { fmtMon, fmtWt, fmtDate, nowISO, todayISO } from '../../utils/fmt';
import api from '../../lib/api';

export default function Processing({ setActions }) {
  const { activeUnitId, toast, isAdmin } = useApp();
  const [jobs, setJobs] = useState([]);
  const [labours, setLabours] = useState([]);
  const [rawMaterials, setRawMaterials] = useState([]);
  const [availInventory, setAvailInventory] = useState([]);
  const [cleaningUnitWt, setCleaningUnitWt] = useState(50);
  const [modal, setModal] = useState(null);
  const [drawer, setDrawer] = useState(null);
  const [q, setQ] = useState('');

  const load = async () => {
    if (!activeUnitId) return;
    const [j, l, inv, set] = await Promise.all([
      api.get('/processing', { params: { unitId: activeUnitId } }),
      api.get('/labours', { params: { unitId: activeUnitId } }),
      api.get('/inventory', { params: { unitId: activeUnitId, status: 'Available' } }),
      api.get('/settings', { params: { unitId: activeUnitId } })
    ]);
    setJobs(j.data);
    setLabours(l.data);
    setAvailInventory(inv.data);
    setRawMaterials([...new Set(inv.data.map(i => i.material))].filter(Boolean));
    if (set.data?.cleaningUnitWt) setCleaningUnitWt(set.data.cleaningUnitWt);
  };

  useEffect(() => { load(); }, [activeUnitId]);
  useEffect(() => {
    setActions(<button className="btn btn-p" onClick={() => setModal(true)}><i className="ti ti-plus"></i>New Processing Job</button>);
  }, []);

  const save = async (form) => {
    try {
      const { labourId, date, shift, meshSize, meshCount, sourceBatches, outputs, totalInputWt, totalOutputWt, totalWastage, finishedUnits, payPerUnit, labourRate, payType, payAmt, payNote, note, _id } = form;
      if (!labourId || !sourceBatches?.[0]?.material) {
        toast('Labour and input material required.', 'err');
        return;
      }
      if (!_id) {
        const mat = sourceBatches[0].material;
        const reqWt = +sourceBatches[0].inputWt || 0;
        const avail = availInventory.filter(x => x.material === mat).reduce((s, i) => s + (i.createdWt - (i.soldWt||0) - (i.returnedWt||0)), 0);
        if (reqWt > avail) {
          toast(`Input weight (${reqWt} kg) for ${mat} exceeds available stock (${avail} kg)!`, 'err');
          return;
        }
      }
      
      const actualUnits = finishedUnits !== undefined && finishedUnits !== '' ? +finishedUnits : Math.floor((totalOutputWt||0) / (cleaningUnitWt||50));
      const actualRate  = +payPerUnit || +labourRate || 0;
      const calcLabourAmt = actualUnits * actualRate;
      const paidAmt = payType !== 'None' ? (+payAmt || 0) : 0;

      if (_id) {
        const oldJob = jobs.find(x => x._id === _id) || {};
        const oldPaid = oldJob.paidAmt || 0;
        const payStatus = oldPaid === 0 ? 'Unpaid' : oldPaid >= calcLabourAmt ? 'Paid' : 'Partial';
        await api.put('/processing/' + _id, {
          date: fmtDate(date), shift, labourId, sourceType: 'cleaned', sourceBatches, totalInputWt,
          meshSize, meshCount: +meshCount || 0, outputs, totalOutputWt, totalWastage,
          finishedUnits: actualUnits, cleaningUnitWt: cleaningUnitWt || 50, payPerUnit: actualRate, labourRate: actualRate, labourAmt: calcLabourAmt, payStatus, outstanding: calcLabourAmt - oldPaid, note
        });
        toast('Processing job updated.');
        load();
        setModal(null);
        return;
      }

      const payStatus = paidAmt === 0 ? 'Unpaid' : paidAmt >= calcLabourAmt ? 'Paid' : 'Partial';
      const payLog = paidAmt > 0 ? [{ date: fmtDate(date), type: payType, amt: paidAmt, note: payNote }] : [];
      await api.post('/processing', {
        unitId: activeUnitId, date: fmtDate(date), shift, labourId,
        sourceType: 'cleaned', sourceBatches, totalInputWt,
        meshSize, meshCount: +meshCount || 0, outputs, totalOutputWt, totalWastage,
        finishedUnits: actualUnits, cleaningUnitWt: cleaningUnitWt || 50, payPerUnit: actualRate, labourRate: actualRate, labourAmt: calcLabourAmt, payStatus, paidAmt, outstanding: calcLabourAmt - paidAmt, payLog, note
      });

      // Create finished goods inventory
      for (const o of outputs) {
        if (!+o.outputWt) continue;
        await api.post('/inventory', {
          batchId: `FG-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
          unitId: activeUnitId, category: 'finished', material: sourceBatches[0]?.material || '',
          quality: o.quality, sourceType: 'processing', createdDate: fmtDate(date),
          createdWt: +o.outputWt, soldWt: 0, returnedWt: 0,
          ledger: [{ date: fmtDate(date), type: 'IN', qty: +o.outputWt, note: 'Processed' }],
          status: 'Available'
        });
      }
      toast('Processing job created.');
      load();
      setModal(null);
    } catch (e) {
      console.error(e);
      toast(e.response?.data?.message || e.message || 'Error saving job', 'err');
    }
  };

  const deleteJob = async (id) => {
    if (!window.confirm('Delete this processing job?')) return;
    await api.delete('/processing/' + id);
    toast('Processing job deleted.');
    load();
  };

  const addPay = async (job, type, amt, note) => {
    const newPaid = (job.paidAmt || 0) + (+amt || 0);
    const outstanding = (job.labourAmt || 0) - newPaid;
    const payStatus = newPaid === 0 ? 'Unpaid' : newPaid >= job.labourAmt ? 'Paid' : 'Partial';
    const payLog = [...(job.payLog || []), { date: fmtDate(todayISO()), type, amt: +amt, note }];
    await api.put('/processing/' + job._id, { paidAmt: newPaid, outstanding, payStatus, payLog });
    toast('Payment recorded.'); load(); setDrawer(null);
  };

  const editPay = async (job, idx, newAmt, newType, newNote) => {
    const pl = [...(job.payLog || [])];
    pl[idx] = { ...pl[idx], amt: +newAmt || 0, type: newType, note: newNote };
    const newPaid = pl.reduce((a, b) => a + (+b.amt || 0), 0);
    const outstanding = (job.labourAmt || 0) - newPaid;
    const payStatus = newPaid === 0 ? 'Unpaid' : newPaid >= job.labourAmt ? 'Paid' : 'Partial';
    const updated = await api.put('/processing/' + job._id, { paidAmt: newPaid, outstanding, payStatus, payLog: pl });
    toast('Payment updated.'); load(); setDrawer(updated.data);
  };

  const deletePay = async (job, idx) => {
    if (!window.confirm('Delete this payment entry?')) return;
    const pl = [...(job.payLog || [])];
    pl.splice(idx, 1);
    const newPaid = pl.reduce((a, b) => a + (+b.amt || 0), 0);
    const outstanding = (job.labourAmt || 0) - newPaid;
    const payStatus = newPaid === 0 ? 'Unpaid' : newPaid >= job.labourAmt ? 'Paid' : 'Partial';
    const updated = await api.put('/processing/' + job._id, { paidAmt: newPaid, outstanding, payStatus, payLog: pl });
    toast('Payment deleted.'); load(); setDrawer(updated.data);
  };

  const getRunningOutstanding = (labour, currentJob) => {
    const jobList = jobs.filter(j => j.labourId === labour?._id && j.payStatus !== 'Cancelled')
      .sort((a, b) => new Date(a.createdAt || a.date) - new Date(b.createdAt || b.date) || (a.jobId || '').localeCompare(b.jobId || ''));
    let runningTotal = 0;
    for (const j of jobList) {
      runningTotal += (j.outstanding || 0);
      if (j._id === currentJob._id) break;
    }
    return runningTotal;
  };

  const filtered = jobs.filter(j => {
    if (!q) return true;
    const query = q.toLowerCase();
    const lab = labours.find(l => l._id === j.labourId);
    const labName = lab?.name?.toLowerCase() || '';
    const dateStr = j.date?.toLowerCase() || '';
    const idStr = j.jobId?.toLowerCase() || '';
    const noteStr = j.note?.toLowerCase() || '';
    const shiftStr = j.shift?.toLowerCase() || '';
    const meshStr = `${j.meshSize || ''} ${j.meshCount || ''}`.toLowerCase();
    const matStr = j.sourceBatches?.map(s => s.material).join(' ').toLowerCase() || '';
    const outStr = j.outputs?.map(o => `${o.quality || ''}`).join(' ').toLowerCase() || '';
    return idStr.includes(query) || noteStr.includes(query) || shiftStr.includes(query) || labName.includes(query) || dateStr.includes(query) || meshStr.includes(query) || matStr.includes(query) || outStr.includes(query);
  });

  return (
    <div className="page">
      <div className="kpi-grid">
        <div className="kpi-card"><div className="kpi-label">Total Jobs</div><div className="kpi-value">{jobs.length}</div></div>
        <div className="kpi-card"><div className="kpi-label">Total Output</div><div className="kpi-value acc">{fmtWt(jobs.reduce((a, j) => a + (j.totalOutputWt || 0), 0))}</div></div>
        <div className="kpi-card"><div className="kpi-label">Labour Cost</div><div className="kpi-value">{fmtMon(jobs.reduce((a, j) => a + (j.labourAmt || 0), 0))}</div></div>
        <div className="kpi-card"><div className="kpi-label">Outstanding</div><div className="kpi-value err">{fmtMon(jobs.reduce((a, j) => a + (j.outstanding || 0), 0))}</div></div>
      </div>
      <div className="table-card">
        <div className="table-toolbar"><h3>Processing Jobs</h3>
          <div className="search-box"><i className="ti ti-search"></i><input placeholder="Search notes, labour, material, grade…" value={q} onChange={e => setQ(e.target.value)} /></div>
        </div>
        <div className="tbl-scroll"><table>
          <thead><tr><th>Notes</th><th>Date</th><th>Shift</th><th>Labour</th><th>Input Wt</th><th>Output Wt</th><th>Labour Amt</th><th>Payment</th><th>Actions</th></tr></thead>
          <tbody>
            {filtered.map(j => {
              const l = labours.find(x => x._id === j.labourId);
              return (
                <tr key={j._id}>
                  <td>{j.note || '—'}</td>
                  <td>{j.date}</td>
                  <td>{j.shift || '—'}</td>
                  <td>
                    <div>{l?.name || '—'}</div>
                    {l && <div style={{ fontSize: 11, color: 'var(--err)' }}>Total Out: {fmtMon(getRunningOutstanding(l, j))}</div>}
                  </td>
                  <td className="mono">{fmtWt(j.totalInputWt)}</td>
                  <td className="mono">{fmtWt(j.totalOutputWt)}</td>
                  <td className="mono" style={{ color: 'var(--acc)', fontWeight: 700 }}>{fmtMon(j.labourAmt)}</td>
                  <td><span className={`badge ${j.payStatus === 'Paid' ? 'b-ok' : j.payStatus === 'Partial' ? 'b-warn' : 'b-err'}`}>{j.payStatus}</span></td>
                  <td><div className="act-btns">
                    <button className="icon-btn" title="View" onClick={() => setDrawer(j)}><i className="ti ti-eye"></i></button>
                    <button className="icon-btn" title="Edit" onClick={() => setModal(j)}><i className="ti ti-pencil"></i></button>
                    {isAdmin && <button className="icon-btn err" title="Delete" onClick={() => deleteJob(j._id)}><i className="ti ti-trash"></i></button>}
                  </div></td>
                </tr>
              );
            })}
            {!filtered.length && <tr><td colSpan="9" className="empty-row"><i className="ti ti-settings-2"></i><p>No processing jobs yet</p></td></tr>}
          </tbody>
        </table></div>
      </div>

      {modal && <ProcessingModal job={modal !== true ? modal : null} labours={labours} rawMaterials={rawMaterials} availInventory={availInventory} cleaningUnitWt={cleaningUnitWt} onClose={() => setModal(null)} onSave={save} />}
      {drawer && <ProcessingDrawer job={drawer} labour={labours.find(l => l._id === drawer.labourId)} cleaningUnitWt={cleaningUnitWt} onClose={() => setDrawer(null)} onPay={addPay} onEditPay={editPay} onDeletePay={deletePay} />}
    </div>
  );
}

function ProcessingModal({ job, labours, rawMaterials, availInventory = [], cleaningUnitWt, onClose, onSave }) {
  const [date, setDate] = useState(job?.createdAt ? job.createdAt.slice(0, 16) : nowISO());
  const [shift, setShift] = useState(job?.shift || 'Morning');
  const [labourId, setLabourId] = useState(job?.labourId || '');
  const [meshSize, setMeshSize] = useState(job?.meshSize || '');
  const [meshCount, setMeshCount] = useState(job?.meshCount || '');
  
  const [material, setMaterial] = useState(job?.sourceBatches?.[0]?.material || '');
  const [inputWt, setInputWt] = useState(job?.totalInputWt || '');
  
  const [outputs, setOutputs] = useState(job?.outputs?.length ? job.outputs : [{ quality: 'Grade A', outputWt: '' }]);
  
  const totalIn = +inputWt || 0;
  const totalOut = outputs.reduce((a, o) => a + (+o.outputWt || 0), 0);
  const waste = totalIn - totalOut;

  const lab = labours.find(l => l._id === labourId);
  const calcUnits = Math.floor(totalOut / (cleaningUnitWt || 50));
  
  const [finishedUnits, setFinishedUnits] = useState(job?.finishedUnits !== undefined ? job.finishedUnits : '');
  const [payPerUnit, setPayPerUnit] = useState(job?.payPerUnit !== undefined ? job.payPerUnit : '');

  const actualUnits = finishedUnits !== '' ? +finishedUnits : calcUnits;
  const actualRate = payPerUnit !== '' ? +payPerUnit : (lab?.rate || 0);
  const labourAmt = actualUnits * actualRate;

  const [payType, setPayType] = useState(job ? (job.payLog?.[0]?.type || 'Cash') : 'None');
  const [payAmt, setPayAmt] = useState(job?.paidAmt !== undefined && job?.paidAmt !== 0 ? job.paidAmt : '');
  const [payNote, setPayNote] = useState(job?.payLog?.[0]?.note || '');
  const [note, setNote] = useState(job?.note || '');

  const getAvailWt = (mat) => availInventory.filter(x => x.material === mat).reduce((sum, item) => sum + (item.createdWt - (item.soldWt || 0) - (item.returnedWt || 0)), 0);

  const updOut = (i, k, v) => {
    const no = [...outputs];
    no[i] = { ...no[i], [k]: v };
    setOutputs(no);
  };

  return (
    <Modal title={job ? "Edit Processing Job" : "New Processing Job"} size="modal-lg" onClose={onClose}
      footer={<><button className="btn btn-s" onClick={onClose}>Cancel</button><button className="btn btn-p" onClick={() => onSave({
        _id: job?._id, labourId, date, shift, meshSize, meshCount,
        sourceBatches: [{ material, inputWt: totalIn }],
        outputs: outputs.map(o => ({ quality: o.quality, outputWt: +o.outputWt || 0 })),
        totalInputWt: totalIn, totalOutputWt: totalOut, totalWastage: waste,
        finishedUnits: actualUnits, payPerUnit: actualRate, labourRate: actualRate, labourAmt,
        payType, payAmt, payNote, note
      })}><i className="ti ti-device-floppy"></i>Save Job</button></>}>
      <div className="fr3">
        <div className="fg"><label>Date <span className="req">*</span></label><input type="date" value={date ? date.slice(0, 10) : ''} onChange={e => { const curTime = new Date().toTimeString().slice(0, 8); setDate(`${e.target.value}T${curTime}`); }} /></div>
        <div className="fg"><label>Shift</label><select value={shift} onChange={e => setShift(e.target.value)}><option value="Morning">Morning</option><option value="Evening">Evening</option><option value="Night">Night</option></select></div>
        <div className="fg"><label>Labour <span className="req">*</span></label>
          <select value={labourId} onChange={e => {
            setLabourId(e.target.value);
            const selectedLab = labours.find(x => x._id === e.target.value);
            if (selectedLab && payPerUnit === '') setPayPerUnit(selectedLab.rate || 0);
          }}>
            <option value="">Select labour…</option>
            {labours.filter(l => l.status === 'Active' || l._id === labourId).map(l => <option key={l._id} value={l._id}>{l.name}</option>)}
          </select>
        </div>
      </div>
      <div className="fr2">
        <div className="fg"><label>Mesh Size</label><input value={meshSize} onChange={e => setMeshSize(e.target.value)} placeholder="e.g. 4mm / 16 Mesh" /></div>
        <div className="fg"><label>Mesh Count</label><input type="number" value={meshCount} onChange={e => setMeshCount(e.target.value)} placeholder="0" /></div>
      </div>
      
      <div className="fsec">
        <div className="fsec-title">Input & Output Details</div>
        <div className="fr2" style={{ marginBottom: 12 }}>
          <div className="fg"><label>Source Material {material && <span style={{fontSize: 11, color: 'var(--acc)', fontWeight: 600, marginLeft: 8}}>(Avail: {fmtWt(getAvailWt(material))})</span>}</label>
            <select value={material} onChange={e => setMaterial(e.target.value)}>
              <option value="">Select clean material…</option>
              {rawMaterials.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div className="fg"><label>Total Input Wt (kg) <span className="req">*</span></label><input type="number" step="0.01" value={inputWt} onChange={e => setInputWt(e.target.value)} placeholder="0.00" /></div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <label style={{ margin: 0, fontWeight: 600 }}>Graded Outputs</label>
          <button className="btn btn-s btn-sm" onClick={() => setOutputs(p => [...p, { quality: '', outputWt: '' }])}><i className="ti ti-plus"></i>Add Grade</button>
        </div>
        {outputs.map((o, i) => (
          <div key={i} className="item-line" style={{ padding: '8px 12px', marginBottom: 6 }}>
            <div className="fr2" style={{ gap: 12 }}>
              <div className="fg"><label>Output Grade / Quality</label><input value={o.quality} onChange={e => updOut(i, 'quality', e.target.value)} placeholder="e.g. Grade A / 4mm" /></div>
              <div className="fg" style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                <div style={{ flex: 1 }}><label>Output Wt (kg)</label><input type="number" step="0.01" value={o.outputWt} onChange={e => updOut(i, 'outputWt', e.target.value)} placeholder="0.00" /></div>
                {outputs.length > 1 && <button className="icon-btn err" style={{ marginBottom: 2 }} onClick={() => setOutputs(p => p.filter((_, idx) => idx !== i))}><i className="ti ti-trash"></i></button>}
              </div>
            </div>
          </div>
        ))}
        
        <div className="fr2" style={{ marginTop: 14 }}>
          <div className="fg"><label>Units Created</label><input type="number" value={finishedUnits !== '' ? finishedUnits : calcUnits} onChange={e => setFinishedUnits(e.target.value)} /></div>
          <div className="fg"><label>Pay / Unit (₹)</label><input type="number" step="0.01" value={payPerUnit !== '' ? payPerUnit : (lab?.rate || 0)} onChange={e => setPayPerUnit(e.target.value)} /></div>
        </div>
        
        <div className="calc-box">
          <div className="calc-grid">
            <div><div className="cl">Input Wt</div><div className="cv">{fmtWt(totalIn)}</div></div>
            <div><div className="cl">Output Wt</div><div className="cv">{fmtWt(totalOut)}</div></div>
            <div><div className="cl">Waste</div><div className="cv" style={{ color: waste > 0 ? 'var(--warn)' : 'inherit' }}>{fmtWt(waste)}</div></div>
            <div><div className="cl">Labour Amt</div><div className="cv" style={{ color: 'var(--acc)' }}>{fmtMon(labourAmt)}</div></div>
          </div>
        </div>
      </div>

      {!job && (
        <div className="fsec">
          <div className="fsec-title">Payment</div>
          <div className="pay-type-btns">
            {['None', 'Cash', 'Bank Transfer', 'UPI'].map(t => (
              <button key={t} className={`ptb${payType === t ? ' sel' : ''}`} onClick={() => setPayType(t)}>{t}</button>
            ))}
          </div>
          {payType !== 'None' && (
            <div className="fr2" style={{ marginTop: 10 }}>
              <div className="fg"><label>Amount Paid</label><input type="number" value={payAmt} onChange={e => setPayAmt(e.target.value)} placeholder="0" /></div>
              <div className="fg"><label>Note</label><input value={payNote} onChange={e => setPayNote(e.target.value)} placeholder="Optional" /></div>
            </div>
          )}
        </div>
      )}

      <div className="fg" style={{ marginTop: 12 }}>
        <label>Job Notes</label>
        <input value={note} onChange={e => setNote(e.target.value)} placeholder="Optional processing notes…" />
      </div>
    </Modal>
  );
}

function ProcessingDrawer({ job: j, labour: l, cleaningUnitWt, onClose, onPay, onEditPay, onDeletePay }) {
  const [payType, setPayType] = useState('Cash');
  const [payAmt, setPayAmt] = useState('');
  const [payNote, setPayNote] = useState('');
  
  const [editIdx, setEditIdx] = useState(-1);
  const [eAmt, setEAmt] = useState('');
  const [eType, setEType] = useState('Cash');
  const [eNote, setENote] = useState('');

  const unitBundle = j.cleaningUnitWt || cleaningUnitWt || 50;
  const units = j.finishedUnits !== undefined && j.finishedUnits !== null ? j.finishedUnits : Math.floor((j.totalOutputWt || 0) / unitBundle);
  const waste = j.totalWastage !== undefined ? j.totalWastage : (j.totalInputWt || 0) - (j.totalOutputWt || 0);
  const rate  = j.payPerUnit !== undefined ? j.payPerUnit : (j.labourRate || 0);

  return (
    <Drawer title={`Processing Job — ${j.jobId}`} onClose={onClose}
      footer={<button className="btn btn-s" onClick={onClose}>Close</button>}>
      <div className="d-sec">
        <h4>Job Details & KPI</h4>
        <div className="d-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 14 }}>
          <div className="d-field"><label>Date</label><div className="dv">{j.date}</div></div>
          <div className="d-field"><label>Shift</label><div className="dv">{j.shift || 'Morning'}</div></div>
          <div className="d-field"><label>Labour</label><div className="dv">{l?.name || '—'}</div></div>
        </div>
        <div className="d-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 14 }}>
          <div className="d-field"><label>Mesh Size</label><div className="dv">{j.meshSize || '—'}</div></div>
          <div className="d-field"><label>Mesh Count</label><div className="dv">{j.meshCount || '—'}</div></div>
        </div>
        
        <div className="pay-summary" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, padding: 10, background: 'var(--bg2)', borderRadius: 8, marginBottom: 12 }}>
          <div className="pay-stat"><div className="psl">Input Wt</div><div className="psv mono">{fmtWt(j.totalInputWt)}</div></div>
          <div className="pay-stat"><div className="psl">Output Wt</div><div className="psv mono" style={{ color: 'var(--acc)' }}>{fmtWt(j.totalOutputWt)}</div></div>
          <div className="pay-stat"><div className="psl">Waste Generated</div><div className="psv mono" style={{ color: waste > 0 ? 'var(--warn)' : 'inherit' }}>{fmtWt(waste)}</div></div>
          <div className="pay-stat"><div className="psl">Units Created</div><div className="psv mono">{units}</div></div>
          <div className="pay-stat"><div className="psl">Pay / Unit</div><div className="psv mono">{fmtMon(rate)}</div></div>
          <div className="pay-stat"><div className="psl">Total Labour</div><div className="psv mono" style={{ color: 'var(--acc)' }}>{fmtMon(j.labourAmt)}</div></div>
        </div>

        <div className="pay-summary">
          <div className="pay-stat"><div className="psl">Paid</div><div className="psv" style={{ color: 'var(--ok)' }}>{fmtMon(j.paidAmt)}</div></div>
          <div className="pay-stat"><div className="psl">Outstanding</div><div className="psv" style={{ color: j.outstanding > 0 ? 'var(--err)' : 'var(--ok)' }}>{fmtMon(j.outstanding)}</div></div>
        </div>
      </div>

      <div className="d-sec">
        <h4>Input Material</h4>
        {j.sourceBatches?.map((s, i) => (
          <div key={i} className="rh-row">
            <span style={{ fontWeight: 600 }}>{s.material}</span>
            <span className="mono">{fmtWt(s.inputWt)}</span>
          </div>
        ))}
      </div>

      <div className="d-sec">
        <h4>Outputs (Grades)</h4>
        {j.outputs?.map((o, i) => (
          <div key={i} className="rh-row">
            <span style={{ fontWeight: 600 }}>{o.quality}</span>
            <span className="mono" style={{ color: 'var(--acc)', fontWeight: 700 }}>{fmtWt(o.outputWt)}</span>
          </div>
        ))}
      </div>

      {j.note && (
        <div className="d-sec">
          <h4>Notes</h4>
          <p style={{ fontSize: 13, color: 'var(--tx2)', margin: 0 }}>{j.note}</p>
        </div>
      )}

      {j.payStatus !== 'Cancelled' && (
        <div className="d-sec">
          <h4>Record Payment</h4>
          <div className="pay-type-btns">
            {['Cash', 'Bank Transfer', 'UPI'].map(t => (
              <button key={t} className={`ptb${payType === t ? ' sel' : ''}`} onClick={() => setPayType(t)}>{t}</button>
            ))}
          </div>
          <div className="fr2">
            <div className="fg"><label>Amount</label><input type="number" value={payAmt} onChange={e => setPayAmt(e.target.value)} /></div>
            <div className="fg"><label>Note</label><input value={payNote} onChange={e => setPayNote(e.target.value)} placeholder="Optional" /></div>
          </div>
          <button className="btn btn-ok" onClick={() => onPay(j, payType, payAmt, payNote)}><i className="ti ti-cash"></i>Record Payment</button>
        </div>
      )}

      <div className="d-sec">
        <h4>Payment Log</h4>
        {j.payLog?.map((pl, i) => (
          <div key={i} className="pay-log-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--bd)' }}>
            {editIdx === i ? (
              <div style={{ display: 'flex', gap: 6, flex: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                <select className="input-sm" value={eType} onChange={e => setEType(e.target.value)} style={{ width: 85 }}>
                  <option value="Cash">Cash</option><option value="Bank Transfer">Bank</option><option value="UPI">UPI</option>
                </select>
                <input className="input-sm" type="number" value={eAmt} onChange={e => setEAmt(e.target.value)} style={{ width: 75 }} placeholder="Amt" />
                <input className="input-sm" value={eNote} onChange={e => setENote(e.target.value)} style={{ flex: 1 }} placeholder="Note" />
                <button className="icon-btn ok btn-sm" onClick={() => { onEditPay(j, i, eAmt, eType, eNote); setEditIdx(-1); }}><i className="ti ti-check"></i></button>
                <button className="icon-btn btn-sm" onClick={() => setEditIdx(-1)}><i className="ti ti-x"></i></button>
              </div>
            ) : (
              <>
                <span>{pl.date} · {pl.type}{pl.note ? ' — ' + pl.note : ''}</span>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span className="mono" style={{ color: 'var(--ok)', fontWeight: 700 }}>{fmtMon(pl.amt)}</span>
                  <button className="icon-btn btn-sm" title="Edit" onClick={() => { setEditIdx(i); setEAmt(pl.amt); setEType(pl.type || 'Cash'); setENote(pl.note || ''); }}><i className="ti ti-pencil"></i></button>
                  <button className="icon-btn err btn-sm" title="Delete" onClick={() => onDeletePay(j, i)}><i className="ti ti-trash"></i></button>
                </div>
              </>
            )}
          </div>
        ))}
        {!j.payLog?.length && <div style={{ fontSize: 11, color: 'var(--tx3)' }}>No payments recorded</div>}
      </div>
    </Drawer>
  );
}
