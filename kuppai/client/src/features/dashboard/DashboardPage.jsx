import React, { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { fmtMon } from '../../utils/fmt';
import api from '../../lib/api';

export default function Dashboard({ setActions }) {
  const { activeUnitId, setCurrentPage, user, units } = useApp();
  const activeUnit = units?.find(u => u._id === activeUnitId);
  const [data, setData] = useState({ purchases:[], suppliers:[], clients:[], labours:[] });

  useEffect(() => { setActions(null); }, []);

  useEffect(() => {
    if (!activeUnitId) return;
    Promise.all([
      api.get('/purchases', { params: { unitId: activeUnitId } }),
      api.get('/suppliers', { params: { unitId: activeUnitId } }),
      api.get('/clients',   { params: { unitId: activeUnitId } }),
      api.get('/labours',   { params: { unitId: activeUnitId } }),
      api.get('/sales',     { params: { unitId: activeUnitId } }),
    ]).then(([p,s,c,l,sa]) => setData({ purchases:p.data, suppliers:s.data, clients:c.data, labours:l.data, sales:sa.data }));
  }, [activeUnitId]);

  const { purchases, suppliers, clients, labours, sales = [] } = data;
  const totalPurchase  = purchases.reduce((a,p)=>a+p.totalAmt,0);
  const supOutstanding = suppliers.reduce((a,s)=>a+s.outstanding,0) + purchases.filter(p=>p.payStatus !== 'Cancelled').reduce((a,p)=>a+p.outstanding,0);
  const cliOutstanding = clients.reduce((a,c)=>a+c.outstanding,0) + sales.filter(s=>s.payStatus !== 'Cancelled').reduce((a,sa)=>a+sa.outstanding,0);
  
  const getSupOut = (s) => s.outstanding + purchases.filter(p=>p.supplierId===s._id && p.payStatus !== 'Cancelled').reduce((a,p)=>a+p.outstanding,0);
  const getCliOut = (c) => c.outstanding + sales.filter(sa=>sa.clientId===c._id && sa.payStatus !== 'Cancelled').reduce((a,sa)=>a+sa.outstanding,0);
  const pendingClean   = purchases.filter(p=>p.cleanStatus==='Pending').length;
  
  // Calculate Trading Profit from all sales
  let totalTradingProfit = 0;
  sales.forEach(sale => {
    sale.items?.forEach(it => {
      totalTradingProfit += (it.profit || 0);
    });
  });

  const hr = new Date().getHours();
  const timeGreeting = hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="page">
      <div style={{marginBottom:18,display:'flex',alignItems:'center',justifyContent:'space-between',background:'var(--surf)',padding:'16px 22px',borderRadius:'var(--rm)',border:'1px solid var(--bd)',boxShadow:'0 2px 6px rgba(0,0,0,0.03)'}}>
        <div style={{display:'flex',alignItems:'center',gap:14}}>
          {activeUnit?.logo ? (
            <img src={activeUnit.logo} alt="" style={{width:42,height:42,objectFit:'contain',borderRadius:8,border:'1px solid var(--bd)',padding:2,background:'var(--bg)'}}/>
          ) : (
            <div style={{width:42,height:42,borderRadius:8,background:'var(--pm)',color:'var(--p)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:22}}><i className="ti ti-building-factory-2"></i></div>
          )}
          <div>
            <h2 style={{margin:0,fontSize:19,fontWeight:800,color:'var(--tx)'}}>
              {timeGreeting}, {user?.name || user?.username || 'Team Member'}! 👋
            </h2>
            <div style={{fontSize:12,color:'var(--tx2)',marginTop:3}}>Here is the live operations summary for <strong>{activeUnit?.name || 'your business unit'}</strong>.</div>
          </div>
        </div>
        <div style={{fontSize:12,fontWeight:600,color:'var(--tx2)',display:'flex',alignItems:'center',gap:8,background:'var(--bg)',padding:'8px 14px',borderRadius:8,border:'1px solid var(--bd)'}}>
          <i className="ti ti-calendar" style={{color:'var(--p)',fontSize:16}}></i>
          <span>{new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</span>
        </div>
      </div>

      <div className="kpi-grid">
        <div className="kpi-card"><div className="kpi-label">Trading Profit</div><div className="kpi-value ok">{fmtMon(totalTradingProfit)}</div><div className="kpi-sub">from Sales</div></div>
        <div className="kpi-card"><div className="kpi-label">Total Purchases</div><div className="kpi-value acc">{fmtMon(totalPurchase)}</div><div className="kpi-sub">{purchases.length} entries</div></div>
        <div className="kpi-card"><div className="kpi-label">Supplier Outstanding</div><div className={`kpi-value ${supOutstanding>0?'err':'ok'}`}>{fmtMon(supOutstanding)}</div><div className="kpi-sub">{suppliers.length} suppliers</div></div>
        <div className="kpi-card"><div className="kpi-label">Client Receivable</div><div className={`kpi-value ${cliOutstanding>0?'acc':'ok'}`}>{fmtMon(cliOutstanding)}</div><div className="kpi-sub">{clients.length} clients</div></div>
        <div className="kpi-card"><div className="kpi-label">Pending Cleaning</div><div className={`kpi-value ${pendingClean>0?'err':'ok'}`}>{pendingClean}</div><div className="kpi-sub">entries</div></div>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
        <div className="table-card">
          <div className="table-toolbar"><h3>Recent Purchases</h3>
            <button className="btn btn-s btn-sm" onClick={()=>setCurrentPage('inflow')}><i className="ti ti-arrow-right"></i>View All</button>
          </div>
          <div className="tbl-scroll"><table>
            <thead><tr><th>ID</th><th>Supplier</th><th>Amount</th><th>Payment</th></tr></thead>
            <tbody>
              {purchases.slice(0,5).map(p => (
                <tr key={p._id}>
                  <td className="mono">{p.purId}</td>
                  <td>{suppliers.find(s=>s._id===p.supplierId)?.name || '—'}</td>
                  <td className="mono" style={{color:'var(--acc)',fontWeight:700}}>{fmtMon(p.totalAmt)}</td>
                  <td><span className={`badge ${p.payStatus==='Paid'?'b-ok':p.payStatus==='Partial'?'b-warn':'b-err'}`}>{p.payStatus}</span></td>
                </tr>
              ))}
              {!purchases.length && <tr><td colSpan="4" className="empty-row"><p>No purchases yet</p></td></tr>}
            </tbody>
          </table></div>
        </div>

        <div className="table-card">
          <div className="table-toolbar"><h3>Outstanding Balances</h3></div>
          <div style={{padding:'12px 14px'}}>
            <div style={{fontSize:10,fontWeight:700,color:'var(--tx3)',textTransform:'uppercase',letterSpacing:'.5px',marginBottom:8}}>Suppliers</div>
            {suppliers.filter(s=>Math.abs(getSupOut(s))>0.01).map(s=>(
              <div key={s._id} className="out-row">
                <span style={{fontWeight:600}}>{s.name}</span>
                <span className="mono" style={{color:getSupOut(s)>0?'var(--err)':'var(--ok)',fontWeight:700}}>{fmtMon(getSupOut(s))}</span>
              </div>
            ))}
            {!suppliers.filter(s=>Math.abs(getSupOut(s))>0.01).length && <div style={{fontSize:11,color:'var(--tx3)',marginBottom:10}}>All clear ✓</div>}
            <div style={{fontSize:10,fontWeight:700,color:'var(--tx3)',textTransform:'uppercase',letterSpacing:'.5px',marginTop:12,marginBottom:8}}>Clients</div>
            {clients.filter(c=>Math.abs(getCliOut(c))>0.01).map(c=>(
              <div key={c._id} className="out-row">
                <span style={{fontWeight:600}}>{c.name}</span>
                <span className="mono" style={{color:getCliOut(c)>0?'var(--acc)':'var(--ok)',fontWeight:700}}>{fmtMon(getCliOut(c))}</span>
              </div>
            ))}
            {!clients.filter(c=>Math.abs(getCliOut(c))>0.01).length && <div style={{fontSize:11,color:'var(--tx3)'}}>All clear ✓</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
