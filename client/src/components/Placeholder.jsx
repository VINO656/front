import React from 'react';

const LABELS = {
  'outflow-ph':'Outflow — Sales',
  'invoice-ph':'Invoice',
  'reports-ph':'Reports',
  'settings-ph':'Settings',
};

export default function Placeholder({ page }) {
  return (
    <div className="page">
      <div className="ph-placeholder">
        <i className="ti ti-clock-pause"></i>
        <h3 style={{fontSize:15,fontWeight:700,color:'var(--tx2)',marginBottom:6}}>{LABELS[page]||page}</h3>
        <p>This module is coming in the next sprint.<br/>Data will be scoped to the active business unit.</p>
      </div>
    </div>
  );
}
