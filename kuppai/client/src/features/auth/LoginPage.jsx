import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';

export default function Login() {
  const { login } = useApp();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState(false);
  const [loading, setLoading] = useState(false);

  const doLogin = async () => {
    setLoading(true); setErr(false);
    try {
      await login(username, password);
    } catch {
      setErr(true);
    } finally { setLoading(false); }
  };

  return (
    <div id="login-screen">
      <div className="login-card">
        <div className="login-brand">
          <div className="brand-icon"><i className="ti ti-recycle"></i></div>
          <h1>Recycle ERP</h1>
          <p>Enterprise ERP System</p>
        </div>

        <div className="fg">
          <label>Username <span className="req">*</span></label>
          <input value={username} onChange={e=>setUsername(e.target.value)} placeholder="Enter username" autoComplete="off" autoFocus/>
        </div>

        <div className="fg">
          <label>Password <span className="req">*</span></label>
          <input type="password" value={password} onChange={e=>setPassword(e.target.value)}
            placeholder="Enter password" onKeyDown={e=>e.key==='Enter' && doLogin()}/>
        </div>

        {err && <div style={{color:'var(--err)',fontSize:11,marginBottom:10,textAlign:'center',background:'var(--errb)',padding:8,borderRadius:'var(--r)',border:'1px solid var(--err)'}}>Invalid username or password.</div>}

        <button className="btn btn-p" style={{width:'100%',justifyContent:'center',height:38,fontSize:13}}
          onClick={doLogin} disabled={loading || !username || !password}>
          <i className="ti ti-login"></i>{loading ? 'Logging in…' : 'Log In'}
        </button>

        <p style={{textAlign:'center',fontSize:10,color:'var(--tx3)',marginTop:14}}>
          Authorized Personnel Only · Contact Admin for Account Access
        </p>
      </div>
    </div>
  );
}
