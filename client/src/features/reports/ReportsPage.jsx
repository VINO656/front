import React, { useEffect, useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { fmtMon, fmtWt, fmtDate } from '../../utils/fmt';
import api from '../../lib/api';

export default function Reports({ setActions }) {
  const { activeUnitId } = useApp();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pnl');
  const [period, setPeriod] = useState('all'); // 'all', 'month', '30days'
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPartyId, setSelectedPartyId] = useState('all');

  const [data, setData] = useState({
    purchases: [],
    sales: [],
    inventory: [],
    suppliers: [],
    clients: [],
    processing: []
  });

  useEffect(() => {
    setActions(
      <button className="btn btn-p btn-sm" onClick={() => window.print()}>
        <i className="ti ti-printer"></i> Print / Export Report
      </button>
    );
    return () => setActions(null);
  }, []);

  useEffect(() => {
    if (!activeUnitId) return;
    setLoading(true);
    Promise.all([
      api.get('/purchases', { params: { unitId: activeUnitId } }),
      api.get('/sales',     { params: { unitId: activeUnitId } }),
      api.get('/inventory', { params: { unitId: activeUnitId } }),
      api.get('/suppliers', { params: { unitId: activeUnitId } }),
      api.get('/clients',   { params: { unitId: activeUnitId } }),
      api.get('/processing',{ params: { unitId: activeUnitId } })
    ]).then(([pur, sal, inv, sup, cli, prc]) => {
      setData({
        purchases: pur.data || [],
        sales: sal.data || [],
        inventory: inv.data || [],
        suppliers: sup.data || [],
        clients: cli.data || [],
        processing: prc.data || []
      });
      setLoading(false);
    }).catch(err => {
      console.error('Error fetching reports data:', err);
      setLoading(false);
    });
  }, [activeUnitId]);

  // Filter records by period
  const filterByDate = (dateStr) => {
    if (period === 'all' || !dateStr) return true;
    const d = new Date(dateStr);
    if (isNaN(d)) return true;
    const now = new Date();
    if (period === 'month') {
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }
    if (period === '30days') {
      const diffTime = Math.abs(now - d);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays <= 30;
    }
    return true;
  };

  const filteredPurchases = useMemo(() => data.purchases.filter(p => filterByDate(p.date || p.createdAt)), [data.purchases, period]);
  const filteredSales = useMemo(() => data.sales.filter(s => filterByDate(s.date || s.createdAt)), [data.sales, period]);

  // Financial KPI Calculations
  const grossRevenue = useMemo(() => filteredSales.reduce((acc, s) => acc + (s.totalAmt || 0), 0), [filteredSales]);
  const grossExpenditure = useMemo(() => filteredPurchases.reduce((acc, p) => acc + (p.totalAmt || 0), 0), [filteredPurchases]);
  
  const netTradingProfit = useMemo(() => {
    let profit = 0;
    filteredSales.forEach(sale => {
      sale.items?.forEach(it => { profit += (it.profit || 0); });
    });
    return profit;
  }, [filteredSales]);

  const profitMarginPercent = useMemo(() => {
    if (!grossRevenue) return '0.0%';
    return ((netTradingProfit / grossRevenue) * 100).toFixed(1) + '%';
  }, [netTradingProfit, grossRevenue]);

  // GST Calculations
  const inputGST = useMemo(() => filteredPurchases.reduce((acc, p) => acc + (p.taxAmt || 0), 0), [filteredPurchases]);
  const outputGST = useMemo(() => filteredSales.reduce((acc, s) => acc + (s.taxAmt || 0), 0), [filteredSales]);
  const netGSTBalance = outputGST - inputGST; // positive = payable, negative = credit

  // Party Statements
  const allParties = useMemo(() => [
    ...data.suppliers.map(s => ({ ...s, partyType: 'Supplier' })),
    ...data.clients.map(c => ({ ...c, partyType: 'Client' }))
  ], [data.suppliers, data.clients]);

  const filteredParties = useMemo(() => {
    let list = allParties;
    if (selectedPartyId !== 'all') {
      list = list.filter(p => p._id === selectedPartyId);
    }
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      list = list.filter(p => p.name?.toLowerCase().includes(q) || p.phone?.includes(q) || p.gstin?.toLowerCase().includes(q));
    }
    return list;
  }, [allParties, selectedPartyId, searchTerm]);

  if (loading) {
    return (
      <div className="page">
        <div className="empty-row" style={{paddingTop: 100}}>
          <i className="ti ti-loader ti-spin"></i>
          <p>Analyzing financial records and inventory ledgers...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header" style={{alignItems: 'center', borderBottom: '1px solid var(--bd)', paddingBottom: 16}}>
        <div>
          <h2 style={{fontSize: 20, color: 'var(--p)'}}>Business Analytics & Reports</h2>
          <p className="sub">Scoped to active business unit • Real-time financial & compliance audits</p>
        </div>

        <div style={{display: 'flex', gap: 6, background: 'var(--pm)', padding: 4, borderRadius: 'var(--rm)', border: '1px solid var(--bds)'}}>
          <button 
            className={`btn btn-sm ${period === 'all' ? 'btn-p' : ''}`} 
            style={{background: period === 'all' ? 'var(--p)' : 'transparent', color: period === 'all' ? '#fff' : 'var(--tx2)'}}
            onClick={() => setPeriod('all')}>All Time</button>
          <button 
            className={`btn btn-sm ${period === 'month' ? 'btn-p' : ''}`} 
            style={{background: period === 'month' ? 'var(--p)' : 'transparent', color: period === 'month' ? '#fff' : 'var(--tx2)'}}
            onClick={() => setPeriod('month')}>This Month</button>
          <button 
            className={`btn btn-sm ${period === '30days' ? 'btn-p' : ''}`} 
            style={{background: period === '30days' ? 'var(--p)' : 'transparent', color: period === '30days' ? '#fff' : 'var(--tx2)'}}
            onClick={() => setPeriod('30days')}>Last 30 Days</button>
        </div>
      </div>

      {/* Top Executive Summary KPIs */}
      <div className="kpi-grid" style={{gridTemplateColumns: 'repeat(5, 1fr)', gap: 14, marginBottom: 24}}>
        <div className="kpi-card" style={{borderLeft: '4px solid var(--info)'}}>
          <div className="kpi-label">Gross Sales Revenue</div>
          <div className="kpi-value" style={{color: 'var(--info)'}}>{fmtMon(grossRevenue)}</div>
          <div className="kpi-sub">{filteredSales.length} outgoing shipments</div>
        </div>

        <div className="kpi-card" style={{borderLeft: '4px solid var(--acc)'}}>
          <div className="kpi-label">Material Expenditure</div>
          <div className="kpi-value acc">{fmtMon(grossExpenditure)}</div>
          <div className="kpi-sub">{filteredPurchases.length} scrap acquisitions</div>
        </div>

        <div className="kpi-card" style={{borderLeft: '4px solid var(--ok)'}}>
          <div className="kpi-label">Net Trading Margin</div>
          <div className="kpi-value ok">{fmtMon(netTradingProfit)}</div>
          <div className="kpi-sub">Calculated trading margin</div>
        </div>

        <div className="kpi-card" style={{borderLeft: '4px solid var(--admt)'}}>
          <div className="kpi-label">Margin Profitability</div>
          <div className="kpi-value" style={{color: 'var(--admt)'}}>{profitMarginPercent}</div>
          <div className="kpi-sub">Margin % on turnover</div>
        </div>

        <div className="kpi-card" style={{borderLeft: `4px solid ${netGSTBalance > 0 ? 'var(--err)' : 'var(--ok)'}`}}>
          <div className="kpi-label">Net GST Liability</div>
          <div className={`kpi-value ${netGSTBalance > 0 ? 'err' : 'ok'}`}>
            {netGSTBalance < 0 ? `+${fmtMon(Math.abs(netGSTBalance))}` : fmtMon(netGSTBalance)}
          </div>
          <div className="kpi-sub">{netGSTBalance > 0 ? 'Tax payable' : 'Input tax credit'}</div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="tab-bar">
        <div className={`tab ${activeTab === 'pnl' ? 'active' : ''}`} onClick={() => setActiveTab('pnl')}>
          <i className="ti ti-trending-up" style={{marginRight: 6}}></i>Profit & Loss (P&L)
        </div>
        <div className={`tab ${activeTab === 'gst' ? 'active' : ''}`} onClick={() => setActiveTab('gst')}>
          <i className="ti ti-receipt-tax" style={{marginRight: 6}}></i>GST & Tax Filing
        </div>
        <div className={`tab ${activeTab === 'inv' ? 'active' : ''}`} onClick={() => setActiveTab('inv')}>
          <i className="ti ti-stack-2" style={{marginRight: 6}}></i>Inventory Valuation
        </div>
        <div className={`tab ${activeTab === 'party' ? 'active' : ''}`} onClick={() => setActiveTab('party')}>
          <i className="ti ti-users" style={{marginRight: 6}}></i>Party Ledgers & Dues
        </div>
        <div className={`tab ${activeTab === 'eff' ? 'active' : ''}`} onClick={() => setActiveTab('eff')}>
          <i className="ti ti-activity" style={{marginRight: 6}}></i>Production Efficiency (BR-09)
        </div>
      </div>

      {/* Tab 1: P&L Statement */}
      {activeTab === 'pnl' && (
        <div>
          <div className="fsec" style={{background: 'var(--sub)', borderLeft: '4px solid var(--ok)', marginBottom: 18}}>
            <h4 style={{fontSize: 13, color: 'var(--tx)', marginBottom: 6}}>Financial Breakdown Statement</h4>
            <p style={{fontSize: 11, color: 'var(--tx2)', lineHeight: 1.5}}>
              Trading profit is calculated by taking the selling price of processed scrap batches minus their acquisition cost.
              Gross Revenue: <b className="mono">{fmtMon(grossRevenue)}</b> • Total Expenditure: <b className="mono">{fmtMon(grossExpenditure)}</b>
            </p>
          </div>

          <div className="table-card">
            <div className="table-toolbar">
              <h3>Sales Transaction Ledger</h3>
              <span className="badge b-ok">{filteredSales.length} Transactions</span>
            </div>
            <div className="tbl-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Invoice ID</th>
                    <th>Date</th>
                    <th>Buyer / Client</th>
                    <th>Items Sold</th>
                    <th>Net Weight</th>
                    <th>Revenue</th>
                    <th>Trading Profit</th>
                    <th>Margin</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSales.map(sale => {
                    const clientName = data.clients.find(c => c._id === sale.clientId)?.name || 'Walk-in Client';
                    const totalProfit = sale.items?.reduce((a, b) => a + (b.profit || 0), 0) || 0;
                    const margin = sale.totalAmt ? ((totalProfit / sale.totalAmt) * 100).toFixed(1) + '%' : '0%';
                    const totalWt = sale.items?.reduce((a, b) => a + (+b.netWt || 0), 0) || 0;

                    return (
                      <tr key={sale._id}>
                        <td className="mono" style={{fontWeight: 700, color: 'var(--p)'}}>{sale.saleId || 'SAL-—'}</td>
                        <td>{fmtDate(sale.date || sale.createdAt)}</td>
                        <td style={{fontWeight: 600}}>{clientName}</td>
                        <td>{sale.items?.map(i => i.material).join(', ') || 'Scrap Material'}</td>
                        <td className="mono">{fmtWt(totalWt)}</td>
                        <td className="mono" style={{fontWeight: 700}}>{fmtMon(sale.totalAmt)}</td>
                        <td className="mono" style={{color: 'var(--ok)', fontWeight: 700}}>+{fmtMon(totalProfit)}</td>
                        <td><span className="badge b-ok">{margin}</span></td>
                      </tr>
                    );
                  })}
                  {!filteredSales.length && (
                    <tr><td colSpan="8" className="empty-row"><p>No sales transactions recorded in this period.</p></td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: GST & Tax Filing Summary */}
      {activeTab === 'gst' && (
        <div>
          <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20}}>
            <div className="table-card" style={{margin: 0, borderTop: '3px solid var(--info)'}}>
              <div className="table-toolbar">
                <h3 style={{color: 'var(--info)'}}><i className="ti ti-arrow-down-left"></i> Input Tax Credit (ITC)</h3>
                <span className="mono" style={{fontSize: 16, fontWeight: 700, color: 'var(--info)'}}>{fmtMon(inputGST)}</span>
              </div>
              <div style={{padding: 16}}>
                <p style={{fontSize: 11, color: 'var(--tx2)', marginBottom: 12}}>
                  Total GST paid on inbound raw material purchases. This amount can be claimed as Input Tax Credit during GSTR-3B filing.
                </p>
                <div style={{display: 'flex', justifyContent: 'space-between', fontSize: 11, padding: '8px 0', borderTop: '1px solid var(--bd)'}}>
                  <span>Taxable Purchase Value:</span>
                  <b className="mono">{fmtMon(grossExpenditure - inputGST)}</b>
                </div>
                <div style={{display: 'flex', justifyContent: 'space-between', fontSize: 11, padding: '8px 0', borderTop: '1px solid var(--bd)'}}>
                  <span>Total Inward Bills:</span>
                  <b>{filteredPurchases.length} Invoices</b>
                </div>
              </div>
            </div>

            <div className="table-card" style={{margin: 0, borderTop: '3px solid var(--err)'}}>
              <div className="table-toolbar">
                <h3 style={{color: 'var(--err)'}}><i className="ti ti-arrow-up-right"></i> Output Tax Liability</h3>
                <span className="mono" style={{fontSize: 16, fontWeight: 700, color: 'var(--err)'}}>{fmtMon(outputGST)}</span>
              </div>
              <div style={{padding: 16}}>
                <p style={{fontSize: 11, color: 'var(--tx2)', marginBottom: 12}}>
                  Total GST collected from buyers on finished scrap sales. This represents your government tax obligation before ITC deductions.
                </p>
                <div style={{display: 'flex', justifyContent: 'space-between', fontSize: 11, padding: '8px 0', borderTop: '1px solid var(--bd)'}}>
                  <span>Taxable Sales Turnover:</span>
                  <b className="mono">{fmtMon(grossRevenue - outputGST)}</b>
                </div>
                <div style={{display: 'flex', justifyContent: 'space-between', fontSize: 11, padding: '8px 0', borderTop: '1px solid var(--bd)'}}>
                  <span>Total Outward Bills:</span>
                  <b>{filteredSales.length} Invoices</b>
                </div>
              </div>
            </div>
          </div>

          <div className="table-card">
            <div className="table-toolbar">
              <h3>Tax Filing Settlement Statement</h3>
              <span className={`badge ${netGSTBalance > 0 ? 'b-err' : 'b-ok'}`}>
                {netGSTBalance > 0 ? 'Net Payable to Govt' : 'Excess Credit Carried Forward'}
              </span>
            </div>
            <div style={{padding: 20}}>
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', maxWidth: 400, margin: '0 auto', fontSize: 13, marginBottom: 10}}>
                <span>Total Output Tax (Collected):</span>
                <b className="mono">{fmtMon(outputGST)}</b>
              </div>
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', maxWidth: 400, margin: '0 auto', fontSize: 13, color: 'var(--info)', marginBottom: 14}}>
                <span>Minus Input Tax Credit (ITC):</span>
                <b className="mono">-{fmtMon(inputGST)}</b>
              </div>
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', maxWidth: 400, margin: '0 auto', padding: '12px 16px', background: netGSTBalance > 0 ? 'var(--errb)' : 'var(--okb)', borderRadius: 'var(--rm)', fontSize: 15, fontWeight: 700, color: netGSTBalance > 0 ? 'var(--err)' : 'var(--ok)'}}>
                <span>{netGSTBalance > 0 ? 'Net Tax Payable:' : 'Net Tax Refund / Credit:'}</span>
                <span className="mono">{fmtMon(Math.abs(netGSTBalance))}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Inventory Valuation & Yield */}
      {activeTab === 'inv' && (
        <div>
          <div className="table-card">
            <div className="table-toolbar">
              <h3>Current Inventory Stock Valuation</h3>
              <span className="badge b-p">{data.inventory.length} Batches in Yard</span>
            </div>
            <div className="tbl-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Batch ID</th>
                    <th>Category</th>
                    <th>Material</th>
                    <th>Quality / Grade</th>
                    <th>Current Weight</th>
                    <th>Unit Rate</th>
                    <th>Est. Valuation</th>
                  </tr>
                </thead>
                <tbody>
                  {data.inventory.map(bat => {
                    const wt = bat.ledger?.reduce((acc, l) => acc + (l.type === 'IN' ? +l.qty : -l.qty), 0) ?? bat.createdWt ?? 0;
                    const val = wt * (bat.rate || 0);

                    return (
                      <tr key={bat._id}>
                        <td className="mono" style={{fontWeight: 700}}>{bat.batchId}</td>
                        <td>
                          <span className={`badge ${bat.category === 'raw' ? 'cat-raw' : bat.category === 'finished' ? 'cat-finished' : 'b-sub'}`}>
                            {bat.category || 'raw'}
                          </span>
                        </td>
                        <td style={{fontWeight: 600}}>{bat.material}</td>
                        <td>{bat.quality || 'Standard'}</td>
                        <td className="mono" style={{fontWeight: 700}}>{fmtWt(wt)}</td>
                        <td className="mono">{fmtMon(bat.rate)}/kg</td>
                        <td className="mono" style={{color: 'var(--acc)', fontWeight: 700}}>{fmtMon(val)}</td>
                      </tr>
                    );
                  })}
                  {!data.inventory.length && (
                    <tr><td colSpan="7" className="empty-row"><p>No stock batches available in inventory.</p></td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Party Ledgers & Dues */}
      {activeTab === 'party' && (
        <div>
          <div style={{display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center'}}>
            <div className="search-box" style={{maxWidth: 280}}>
              <i className="ti ti-search"></i>
              <input 
                type="text" 
                placeholder="Search party name, phone, GSTIN..." 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>

            <select 
              className="sel-filter" 
              style={{height: 32, minWidth: 200}}
              value={selectedPartyId}
              onChange={e => setSelectedPartyId(e.target.value)}
            >
              <option value="all">All Parties (Suppliers & Clients)</option>
              <optgroup label="Suppliers">
                {data.suppliers.map(s => <option key={s._id} value={s._id}>{s.name} (Supplier)</option>)}
              </optgroup>
              <optgroup label="Clients">
                {data.clients.map(c => <option key={c._id} value={c._id}>{c.name} (Client)</option>)}
              </optgroup>
            </select>
          </div>

          <div className="table-card">
            <div className="table-toolbar">
              <h3>Party Account Statements & Dues</h3>
              <span className="badge b-sub">{filteredParties.length} Accounts Shown</span>
            </div>
            <div className="tbl-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Party Name</th>
                    <th>Type</th>
                    <th>Phone</th>
                    <th>GSTIN</th>
                    <th>Opening Balance</th>
                    <th>Current Outstanding</th>
                    <th>Account Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredParties.map(party => {
                    // Calculate outstanding including transactions
                    let transOutstanding = 0;
                    if (party.partyType === 'Supplier') {
                      transOutstanding = data.purchases
                        .filter(p => p.supplierId === party._id && p.payStatus !== 'Cancelled')
                        .reduce((a, b) => a + (b.outstanding || 0), 0);
                    } else {
                      transOutstanding = data.sales
                        .filter(s => s.clientId === party._id && s.payStatus !== 'Cancelled')
                        .reduce((a, b) => a + (b.outstanding || 0), 0);
                    }
                    const totalOut = (party.outstanding || 0) + transOutstanding;

                    return (
                      <tr key={party._id}>
                        <td style={{fontWeight: 700, color: 'var(--tx)'}}>{party.name}</td>
                        <td>
                          <span className={`badge ${party.partyType === 'Supplier' ? 'b-warn' : 'b-info'}`}>
                            {party.partyType}
                          </span>
                        </td>
                        <td className="mono">{party.phone || '—'}</td>
                        <td className="mono" style={{fontSize: 10, color: 'var(--tx2)'}}>{party.gstin || 'Unregistered'}</td>
                        <td className="mono">{fmtMon(party.outstanding)}</td>
                        <td className="mono" style={{fontWeight: 700, color: totalOut > 0 ? (party.partyType === 'Supplier' ? 'var(--err)' : 'var(--acc)') : 'var(--ok)'}}>
                          {fmtMon(totalOut)}
                        </td>
                        <td>
                          <span className={`badge ${Math.abs(totalOut) < 0.01 ? 'b-ok' : 'b-err'}`}>
                            {Math.abs(totalOut) < 0.01 ? 'All Clear ✓' : 'Payment Pending'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {!filteredParties.length && (
                    <tr><td colSpan="7" className="empty-row"><p>No party accounts match your search.</p></td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 5: Production Efficiency Audit (BR-09) */}
      {activeTab === 'eff' && (
        <div>
          <div className="fsec" style={{background: 'var(--sub)', borderLeft: '4px solid var(--info)', marginBottom: 18, display:'flex', justifyContent:'space-between', alignItems:'center'}}>
            <div>
              <h4 style={{fontSize: 13, color: 'var(--tx)', marginBottom: 6}}>Material Conversion Audit & Wastage Thresholds</h4>
              <p style={{fontSize: 11, color: 'var(--tx2)', margin:0}}>
                Audit yield across processing runs. System alerts Admin if wastage exceeds acceptable limits.
              </p>
            </div>
            <button className="btn btn-warn btn-sm" onClick={async () => {
              try {
                const res = await api.post('/processing/efficiency-alert', { unitId: activeUnitId, threshold: 10 });
                alert(res.data.message);
              } catch(e) { alert('Error sending report'); }
            }}><i className="ti ti-mail"></i> Email Alert Report to Admin</button>
          </div>

          <div className="table-card">
            <div className="table-toolbar">
              <h3>Processing Run Efficiency Register</h3>
              <span className="badge b-blue">{data.processing?.length || 0} Runs Audited</span>
            </div>
            <div className="tbl-scroll">
              <table className="table">
                <thead>
                  <tr>
                    <th>Job ID</th>
                    <th>Date</th>
                    <th>Gross Input (kg)</th>
                    <th>Gross Output (kg)</th>
                    <th>Wastage / Scrap (kg)</th>
                    <th>Efficiency Yield %</th>
                    <th>Status Flag</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.processing || []).map(job => {
                    const inp = +(job.totalInputWt || 0);
                    const out = +(job.totalOutputWt || 0);
                    const wst = +(job.totalWastage || 0);
                    const yieldPct = inp > 0 ? ((out / inp) * 100).toFixed(1) : 0;
                    const wstPct = inp > 0 ? ((wst / inp) * 100).toFixed(1) : 0;
                    const isHigh = wstPct >= 10;

                    return (
                      <tr key={job._id}>
                        <td className="mono" style={{fontWeight:700, color:'var(--p)'}}>{job.jobId}</td>
                        <td>{job.date}</td>
                        <td className="mono">{fmtWt(inp)}</td>
                        <td className="mono" style={{color:'var(--ok)', fontWeight:700}}>{fmtWt(out)}</td>
                        <td className="mono" style={{color: isHigh?'var(--err)':'var(--tx)'}}>{fmtWt(wst)} ({wstPct}%)</td>
                        <td className="mono">{yieldPct}%</td>
                        <td>
                          <span className={`badge ${isHigh ? 'b-err' : 'b-ok'}`}>
                            {isHigh ? '⚠️ High Wastage (>10%)' : 'Optimal Yield ✓'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {(!data.processing || !data.processing.length) && (
                    <tr><td colSpan="7" className="empty-row"><p>No processing runs recorded yet.</p></td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
