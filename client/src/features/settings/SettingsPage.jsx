import React, { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import api from '../../lib/api';

export default function Settings({ setActions }) {
  const { activeUnitId, activeUnit, toast } = useApp();
  const [cleaningUnitWt, setCleaningUnitWt] = useState('');
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (setActions) setActions(null);
  }, [setActions]);

  useEffect(() => {
    loadSettings();
  }, [activeUnitId]);

  const loadSettings = async () => {
    if (!activeUnitId) return;
    try {
      setLoading(true);
      const res = await api.get('/settings', { params: { unitId: activeUnitId } });
      if (res.data) {
        setCleaningUnitWt(res.data.cleaningUnitWt || 50);
        setHistory(res.data.history || []);
      }
    } catch (e) {
      toast('Failed to load unit settings', 'err');
    } finally { setLoading(false); }
  };

  const saveSettings = async () => {
    if (!activeUnitId) return;
    try {
      setLoading(true);
      const res = await api.put('/settings', { unitId: activeUnitId, cleaningUnitWt: Number(cleaningUnitWt) });
      toast(`Settings saved for ${activeUnit?.name || 'this branch'}`, 'ok');
      if (res.data) {
        setHistory(res.data.history || []);
      }
    } catch (e) {
      toast('Failed to save settings', 'err');
    } finally { setLoading(false); }
  };

  return (
    <div className="page" style={{display:'flex',flexDirection:'column',gap:24,maxWidth:720,margin:'0 auto'}}>
      <div className="table-card" style={{ padding: 24 }}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20,borderBottom:'1px solid var(--bd)',paddingBottom:12}}>
          <h3 style={{ margin: 0 }}>Branch Unit Configuration (BR-01)</h3>
          <span className="badge b-blue" style={{fontSize:13}}>{activeUnit?.name || 'Active Unit'}</span>
        </div>
        
        <div className="fsec">
          <div className="fsec-title">Global Measurement Standard</div>
          <div className="fr1">
            <div className="fg">
              <label>1 Unit Weight Equivalent (kg)</label>
              <input 
                type="number" 
                className="finput"
                value={cleaningUnitWt} 
                onChange={e => setCleaningUnitWt(e.target.value)} 
                disabled={loading}
              />
              <small style={{ color: 'var(--tx3)', marginTop: 6, display: 'block' }}>
                Default is <strong>50 kg</strong>. All weight displays across inventory, purchase, and sales will calculate <code>(weight / {cleaningUnitWt || 50})</code> units.
              </small>
            </div>
          </div>
        </div>

        <div style={{ marginTop: 24, textAlign: 'right' }}>
          <button className="btn btn-primary" onClick={saveSettings} disabled={loading}>
            <i className="ti ti-device-floppy"></i> Update Unit Standard
          </button>
        </div>
      </div>

      <div className="table-card" style={{ padding: 24 }}>
        <h4 style={{ margin: '0 0 16px 0', color: 'var(--tx)' }}>Unit Value Change History</h4>
        {history.length === 0 ? (
          <div style={{color:'var(--tx3)',fontSize:13,textAlign:'center',padding:'20px 0'}}>No unit conversion rate modifications recorded yet.</div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Effective Date</th>
                  <th>Previous Value</th>
                  <th>Revised Value</th>
                  <th>Modified By</th>
                </tr>
              </thead>
              <tbody>
                {[...history].reverse().map((h, i) => (
                  <tr key={i}>
                    <td style={{fontWeight:600}}>{h.date}</td>
                    <td>{h.oldWt} kg</td>
                    <td style={{color:'var(--p)',fontWeight:700}}>{h.newWt} kg</td>
                    <td><span className="badge b-gray">{h.updatedBy || 'Admin'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
