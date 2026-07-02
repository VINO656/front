import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Modal } from './Modal';
import api from '../lib/api';

const PAGE_TITLES = {
  dashboard:'Dashboard', inflow:'Inflow — Purchase Entries', cleaning:'Cleaning Entry',
  processing:'Processing', inventory:'Inventory', profiles:'Profiles — Master Data',
  units:'Business Units', usermgmt:'User Management',
  outflow:'Outflow — Sales', invoices:'Invoices', reports:'Reports — Analytics',
  'reports-ph':'Reports','settings-ph':'Settings',
};

export default function Topbar({ actions, onMenuClick }) {
  const { user, units, activeUnitId, setActiveUnitId, currentPage, setCurrentPage, toast, theme, toggleTheme, isAdmin } = useApp();
  const [open, setOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [pwData, setPwData] = useState({ cur:'', nw:'', cf:'' });
  const [profData, setProfData] = useState({ name: user?.name||'', email: user?.email||'', phone: user?.phone||'' });
  const [loading, setLoading] = useState(false);

  const activeUnit = units.find(u => u._id === activeUnitId);

  useEffect(() => {
    const handler = () => setOpen(false);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  useEffect(() => {
    if (user) {
      setProfData({ name: user.name||'', email: user.email||'', phone: user.phone||'' });
    }
  }, [user]);

  useEffect(() => {
    if (activeUnit) {
      document.title = activeUnit.name;
      if (activeUnit.logo) {
        let link = document.querySelector("link[rel*='icon']");
        if (!link) {
          link = document.createElement('link');
          link.rel = 'shortcut icon';
          document.head.appendChild(link);
        }
        link.href = activeUnit.logo;
      }
    }
  }, [activeUnit, currentPage]);

  const switchUnit = (id) => {
    setActiveUnitId(id);
    setOpen(false);
    const u = units.find(x => x._id === id);
    toast('Switched to ' + u?.name);
  };

  const saveProfile = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      await api.put('/auth/profile', profData);
      toast('Profile details updated');
      setProfileOpen(false);
    } catch(err) {
      toast(err.response?.data?.message || err.message, 'err');
    } finally { setLoading(false); }
  };

  const changePw = async (e) => {
    e.preventDefault();
    if (pwData.nw !== pwData.cf) return toast('New passwords do not match', 'err');
    try {
      setLoading(true);
      await api.post('/auth/change-password', { currentPassword: pwData.cur, newPassword: pwData.nw });
      toast('Password updated successfully');
      setPwData({ cur:'', nw:'', cf:'' });
      setProfileOpen(false);
    } catch(err) {
      toast(err.response?.data?.message || err.message, 'err');
    } finally { setLoading(false); }
  };

  const hr = new Date().getHours();
  const greeting = hr < 12 ? '☀️ Good morning' : hr < 17 ? '🌤️ Good afternoon' : '🌙 Good evening';

  return (
    <>
      <div id="topbar">
        <button className="icon-btn mobile-menu-btn" onClick={onMenuClick} title="Open Menu" style={{width:32,height:32,fontSize:18,border:'1px solid var(--bd)',borderRadius:'var(--r)',background:'var(--surf)',color:'var(--tx)',cursor:'pointer'}}>
          <i className="ti ti-menu-2"></i>
        </button>
        <div className="tb-title" style={{display:'flex',alignItems:'center',gap:10}}>
          {activeUnit?.logo && (
            <img src={activeUnit.logo} alt="" style={{height:30,width:30,objectFit:'contain',borderRadius:6,border:'1px solid var(--bd)',background:'var(--surf)'}}/>
          )}
          <div>
            <div style={{fontSize:17,fontWeight:800,color:'var(--tx)',lineHeight:1.1}}>{activeUnit?.name || 'Recycle ERP'}</div>
            <div style={{fontSize:11,color:'var(--tx2)',fontWeight:500,textTransform:'uppercase',letterSpacing:.5}}>{PAGE_TITLES[currentPage] || currentPage}</div>
          </div>
        </div>
        <div id="topbar-page-actions">{actions}</div>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <div className="tb-greeting" style={{fontSize:13,color:'var(--tx2)',display:'flex',alignItems:'center',gap:6}}>
            <span>{greeting}, <strong style={{color:'var(--tx)'}}>{user?.name?.split(' ')[0] || user?.username || 'Member'}</strong>! 👋</span>
          </div>

          <div className="unit-sw" onClick={e => { e.stopPropagation(); if (isAdmin) setOpen(o => !o); else toast('Unit locked for employee account', 'err'); }} style={{display:'flex',alignItems:'center',gap:8,cursor:isAdmin?'pointer':'default',opacity:isAdmin?1:0.85}}>
            {activeUnit?.logo ? (
              <img src={activeUnit.logo} alt="" style={{width:20,height:20,objectFit:'contain',borderRadius:4}}/>
            ) : (
              <div className="udot" style={{background: activeUnit?.color || 'var(--p)'}}></div>
            )}
            <span className="ulbl">{activeUnit?.name || '—'}</span>
            {isAdmin && <i className="ti ti-chevron-down chev"></i>}
            {isAdmin && (
              <div className={`unit-drop${open?' open':''}`}>
                <div className="ud-head">Switch Business Unit</div>
                {units.map(u => (
                  <div key={u._id} className={`ud-item${u._id===activeUnitId?' sel':''}`}
                    onClick={e => { e.stopPropagation(); switchUnit(u._id); }} style={{display:'flex',alignItems:'center',gap:10}}>
                    {u.logo ? (
                      <img src={u.logo} alt="" style={{width:24,height:24,objectFit:'contain',borderRadius:4,border:'1px solid var(--bd)'}}/>
                    ) : (
                      <div className="ud-cdot" style={{background:u.color}}></div>
                    )}
                    <div style={{flex:1}}><div className="ud-nm">{u.name}</div><div className="ud-loc">{u.location} · {u.code}</div></div>
                    {u._id===activeUnitId && <i className="ti ti-check" style={{color:'var(--p)',fontSize:14}}></i>}
                  </div>
                ))}
                <div className="ud-add" onClick={e => { e.stopPropagation(); setCurrentPage('units'); setOpen(false); }}>
                  <i className="ti ti-plus"></i>New Business Unit
                </div>
              </div>
            )}
          </div>

          <button className="icon-btn" title={`Switch to ${theme==='dark'?'Light':'Dark'} Mode`} onClick={toggleTheme} style={{width:32,height:32,fontSize:18,display:'inline-flex',alignItems:'center',justifyContent:'center',border:'1px solid var(--bd)',borderRadius:'var(--r)',background:'var(--surf)',color:'var(--tx)',cursor:'pointer'}}>
            <i className={`ti ${theme === 'dark' ? 'ti-sun' : 'ti-moon'}`}></i>
          </button>
          <span className={`role-badge ${user?.role==='Admin'?'rb-admin':'rb-emp'}`}>{user?.role}</span>
        </div>
      </div>

      {profileOpen && (
        <Modal title="My Profile & Security Settings" onClose={() => setProfileOpen(false)}>
          <div style={{display:'flex',flexDirection:'column',gap:20}}>
            <form onSubmit={saveProfile} style={{display:'flex',flexDirection:'column',gap:12,paddingBottom:16,borderBottom:'1px solid var(--bd)'}}>
              <h4 style={{margin:0,color:'var(--tx)',fontSize:14}}>Personal Information</h4>
              <div>
                <label className="flabel">Full Name</label>
                <input className="finput" value={profData.name} onChange={e => setProfData(d => ({...d, name: e.target.value}))} required/>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                <div>
                  <label className="flabel">Email Address</label>
                  <input className="finput" type="email" value={profData.email} onChange={e => setProfData(d => ({...d, email: e.target.value}))}/>
                </div>
                <div>
                  <label className="flabel">Phone Number</label>
                  <input className="finput" value={profData.phone} onChange={e => setProfData(d => ({...d, phone: e.target.value}))}/>
                </div>
              </div>
              <button className="btn btn-primary" type="submit" disabled={loading} style={{alignSelf:'flex-start'}}>Save Details</button>
            </form>

            <form onSubmit={changePw} style={{display:'flex',flexDirection:'column',gap:12}}>
              <h4 style={{margin:0,color:'var(--tx)',fontSize:14}}>Change Password</h4>
              <div>
                <label className="flabel">Current Password</label>
                <input className="finput" type="password" value={pwData.cur} onChange={e => setPwData(d => ({...d, cur: e.target.value}))} required/>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                <div>
                  <label className="flabel">New Password</label>
                  <input className="finput" type="password" value={pwData.nw} onChange={e => setPwData(d => ({...d, nw: e.target.value}))} required minLength={4}/>
                </div>
                <div>
                  <label className="flabel">Confirm Password</label>
                  <input className="finput" type="password" value={pwData.cf} onChange={e => setPwData(d => ({...d, cf: e.target.value}))} required minLength={4}/>
                </div>
              </div>
              <button className="btn btn-err" type="submit" disabled={loading} style={{alignSelf:'flex-start'}}>Update Password</button>
            </form>
          </div>
        </Modal>
      )}
    </>
  );
}
