import React, { useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';

const NAV_ADMIN = [
  {id:'dashboard', label:'Dashboard', icon:'ti-layout-dashboard'},
  {id:'inflow', label:'Inflow (Purchase)', icon:'ti-package-import'},
  {id:'cleaning', label:'Cleaning Entry', icon:'ti-windmill'},
  {id:'processing', label:'Processing', icon:'ti-settings-2'},
  {id:'outflow', label:'Outflow (Sales)', icon:'ti-package-export'},
  {id:'invoices', label:'Invoice', icon:'ti-file-invoice'},
  {id:'profiles', label:'Profiles', icon:'ti-users'},
  {id:'inventory', label:'Inventory', icon:'ti-stack-2'},
  {id:'units', label:'Business Units', icon:'ti-building-community'},
  {id:'usermgmt', label:'User Management', icon:'ti-user-cog'},
  {id:'reports', label:'Reports', icon:'ti-chart-bar'},
  {id:'settings-ph', label:'Settings', icon:'ti-settings', ph:true},
];
const NAV_EMP = [
  {id:'inflow', label:'Inflow (Purchase)', icon:'ti-package-import'},
  {id:'cleaning', label:'Cleaning Entry', icon:'ti-windmill'},
  {id:'processing', label:'Processing', icon:'ti-settings-2'},
  {id:'outflow', label:'Outflow (Sales)', icon:'ti-package-export'},
  {id:'invoices', label:'Invoice', icon:'ti-file-invoice'},
];

export default function Sidebar({ mobileOpen, setMobileOpen }) {
  const { user, isAdmin, currentPage, setCurrentPage, logout, units, activeUnitId } = useApp();
  const activeUnit = units?.find(u => u._id === activeUnitId);
  const tipRef = useRef(null);

  const nav = isAdmin ? NAV_ADMIN : NAV_EMP;

  useEffect(() => {
    const tip = tipRef.current;
    if (!tip) return;
    const items = document.querySelectorAll('.nav-item[data-tip]');
    const enter = e => {
      tip.textContent = e.currentTarget.dataset.tip;
      tip.style.display = 'block';
      const r = e.currentTarget.getBoundingClientRect();
      tip.style.top  = (r.top + r.height/2 - tip.offsetHeight/2) + 'px';
      tip.style.left = (r.right + 10) + 'px';
    };
    const leave = () => { tip.style.display = 'none'; };
    items.forEach(el => { el.addEventListener('mouseenter', enter); el.addEventListener('mouseleave', leave); });
    return () => items.forEach(el => { el.removeEventListener('mouseenter', enter); el.removeEventListener('mouseleave', leave); });
  });

  return (
    <>
      <div id="sidebar" className={mobileOpen ? 'mobile-open' : ''}>
        <div className="sb-brand" title={activeUnit?.name || 'Recycle ERP'} style={{display:'flex',alignItems:'center',justifyContent:'center',padding:8,position:'relative'}}>
          {activeUnit?.logo ? (
            <img src={activeUnit.logo} alt="Unit Logo" style={{width:32,height:32,objectFit:'contain',borderRadius:6}}/>
          ) : (
            <i className="ti ti-recycle" style={{fontSize:24,color:'var(--acc)'}}></i>
          )}
          {mobileOpen && (
            <i className="ti ti-x mobile-close-btn" onClick={() => setMobileOpen(false)} style={{position:'absolute',right:10,color:'#fff',fontSize:18,cursor:'pointer'}}></i>
          )}
        </div>
        <div className="sb-scroll">
          {nav.map(n => (
            <div key={n.id} className={`nav-item${currentPage===n.id?' active':''}`}
              data-tip={n.label}
              onClick={() => { setCurrentPage(n.id); setMobileOpen?.(false); }}>
              <i className={`ti ${n.icon}`}></i>
            </div>
          ))}
        </div>
        <div className="sb-footer">
          <div className="user-chip">
            <div className="user-av" title={user?.name + ' (' + user?.role + ')'}>{user?.initials}</div>
          </div>
          <i className="ti ti-logout logout-btn" title="Logout" onClick={logout}></i>
        </div>
      </div>
      <div id="nav-tip" ref={tipRef}></div>
    </>
  );
}
