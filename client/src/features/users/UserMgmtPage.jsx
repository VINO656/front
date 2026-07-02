import React, { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Modal } from '../../components/Modal';
import api from '../../lib/api';

export default function UserMgmt({ setActions }) {
  const { user: me, toast } = useApp();
  const [users, setUsers] = useState([]);
  const [modal, setModal] = useState(null); // {user}
  const [pwModal, setPwModal] = useState(null); // user object for admin reset
  const [myPwModal, setMyPwModal] = useState(false); // boolean for personal pw change
  const [myPw, setMyPw] = useState({cur:'',nw:'',cf:''});
  const [pwStr, setPwStr] = useState(0);
  const [q, setQ] = useState('');

  const load = async () => { const {data} = await api.get('/users'); setUsers(data); };
  
  useEffect(() => {
    setActions(
      <div style={{display:'flex',gap:10}}>
        <button className="btn btn-s" onClick={()=>setMyPwModal(true)}>
          <i className="ti ti-key"></i>Change My Password
        </button>
        <button className="btn btn-p" onClick={()=>setModal({user:null})}>
          <i className="ti ti-plus"></i>New User
        </button>
      </div>
    );
    load();
  }, []);

  const save = async (form, id) => {
    if (!form.name||!form.username) { toast('Name and username required.','err'); return; }
    if (!id && !form.password) { toast('Password required.','err'); return; }
    const ini = form.name.split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2);
    if (id) {
      const upd = {...form, initials:ini};
      if (!upd.password) delete upd.password;
      await api.put('/users/'+id, upd);
      toast('User updated.');
    } else {
      await api.post('/users', {...form, initials:ini});
      toast('User created.');
    }
    load(); setModal(null);
  };

  const resetPw = async (id, np, cf) => {
    if (np.length<8) { toast('Min 8 characters.','err'); return; }
    if (np!==cf) { toast('Passwords do not match.','err'); return; }
    await api.patch('/users/'+id+'/password', {password:np});
    toast('Password reset.'); setPwModal(null);
  };

  const toggle = async (u) => {
    await api.put('/users/'+u._id, {status:u.status==='Active'?'Inactive':'Active'});
    load(); toast(`Account ${u.status==='Active'?'deactivated':'activated'}.`);
  };

  const doMyPw = async () => {
    if (myPw.nw.length < 8) { toast('Min 8 characters required.', 'err'); return; }
    if (myPw.nw !== myPw.cf) { toast('New passwords do not match.', 'err'); return; }
    try {
      await api.post('/auth/change-password', {currentPassword:myPw.cur, newPassword:myPw.nw});
      toast('Your password was changed successfully.', 'ok');
      setMyPw({cur:'',nw:'',cf:''});
      setMyPwModal(false);
    } catch(e) { toast(e.response?.data?.message||'Incorrect current password','err'); }
  };

  const checkPwStr = (pw) => {
    let s=0;
    if(pw.length>=8)s++;if(/[A-Z]/.test(pw))s++;if(/[0-9]/.test(pw))s++;if(/[^A-Za-z0-9]/.test(pw))s++;
    setPwStr(s);
  };

  const filtered = users.filter(u=>u.name?.toLowerCase().includes(q)||u.username?.toLowerCase().includes(q)||u.email?.toLowerCase().includes(q));
  const strCols = ['transparent','var(--err)','var(--warn)','var(--acc)','var(--ok)'];
  const strLbls = ['Enter a new password','Weak','Fair','Good','Strong'];

  return (
    <div className="page">
      <div className="kpi-grid">
        <div className="kpi-card"><div className="kpi-label">Total Users</div><div className="kpi-value">{users.length}</div></div>
        <div className="kpi-card"><div className="kpi-label">Active</div><div className="kpi-value ok">{users.filter(u=>u.status==='Active').length}</div></div>
        <div className="kpi-card"><div className="kpi-label">Admins</div><div className="kpi-value">{users.filter(u=>u.role==='Admin').length}</div></div>
        <div className="kpi-card"><div className="kpi-label">Employees</div><div className="kpi-value">{users.filter(u=>u.role==='Employee').length}</div></div>
      </div>

      <div className="table-card">
        <div className="table-toolbar">
          <h3>Team Accounts Register</h3>
          <div className="search-box"><i className="ti ti-search"></i><input placeholder="Search name, username, email…" value={q} onChange={e=>setQ(e.target.value.toLowerCase())}/></div>
        </div>
        <div className="tbl-scroll"><table>
          <thead><tr><th>#</th><th>Name</th><th>Username</th><th>Email</th><th>Role</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {filtered.map((u,i)=>(
              <tr key={u._id}>
                <td className="mono">{i+1}</td>
                <td style={{fontWeight:600}}>{u.name} {u._id===me?.id && <span className="badge b-blue" style={{fontSize:10,marginLeft:6}}>YOU</span>}</td>
                <td className="mono">@{u.username}</td>
                <td>{u.email || '—'}</td>
                <td><span className={`badge ${u.role==='Admin'?'b-adm':'b-emp'}`}>{u.role}</span></td>
                <td><span className={`badge ${u.status==='Active'?'b-ok':'b-err'}`}>{u.status}</span></td>
                <td><div className="act-btns">
                  <button className="icon-btn" title="Edit User Details" onClick={()=>setModal({user:u})}><i className="ti ti-pencil"></i></button>
                  <button className="icon-btn" title="Admin Force Reset Password" onClick={()=>setPwModal(u)}><i className="ti ti-refresh"></i></button>
                  {u._id!==me?.id&&<button className="icon-btn danger" title={u.status==='Active'?'Deactivate Account':'Activate Account'} onClick={()=>toggle(u)}><i className={`ti ti-${u.status==='Active'?'ban':'check'}`}></i></button>}
                </div></td>
              </tr>
            ))}
            {!filtered.length&&<tr><td colSpan="7" className="empty-row"><p>No users found</p></td></tr>}
          </tbody>
        </table></div>
      </div>

      {modal!==null && <UserModal user={modal.user} onClose={()=>setModal(null)} onSave={save}/>}
      
      {pwModal && (
        <ResetPwModal user={pwModal} onClose={()=>setPwModal(null)} onSave={(np,cf)=>resetPw(pwModal._id,np,cf)}/>
      )}

      {myPwModal && (
        <Modal title="Change My Personal Password" size="modal-sm" onClose={()=>setMyPwModal(false)}
          footer={<><button className="btn btn-s" onClick={()=>setMyPwModal(false)}>Cancel</button><button className="btn btn-p" onClick={doMyPw}><i className="ti ti-check"></i>Update Password</button></>}>
          <div className="fg"><label>Current Password <span className="req">*</span></label><input type="password" value={myPw.cur} onChange={e=>setMyPw(p=>({...p,cur:e.target.value}))} placeholder="Enter current"/></div>
          <div className="fg"><label>New Password <span className="req">*</span></label>
            <input type="password" value={myPw.nw} onChange={e=>{setMyPw(p=>({...p,nw:e.target.value}));checkPwStr(e.target.value);}} placeholder="Min 8 chars"/>
            <div className="pw-bar"><div className="pw-bar-fill" style={{width:['0%','30%','55%','80%','100%'][pwStr],background:strCols[pwStr]}}></div></div>
            <div className="hint">{strLbls[pwStr]}</div>
          </div>
          <div className="fg"><label>Confirm New Password <span className="req">*</span></label><input type="password" value={myPw.cf} onChange={e=>setMyPw(p=>({...p,cf:e.target.value}))} placeholder="Re-enter new"/></div>
        </Modal>
      )}
    </div>
  );
}

function UserModal({ user:u, onClose, onSave }) {
  const [form, setForm] = useState({
    name:       u?.name||'',
    username:   u?.username||'',
    email:      u?.email||'',
    phone:      u?.phone||'',
    dob:        u?.dob||'',
    address:    u?.address||'',
    role:       u?.role||'Employee',
    status:     u?.status||'Active',
    password:   '',
    bankName:   u?.bankName||'',
    bankBranch: u?.bankBranch||'',
    bankAcc:    u?.bankAcc||'',
    ifsc:       u?.ifsc||''
  });
  const set = k => e => setForm(f=>({...f,[k]:e.target.value}));
  return (
    <Modal title={`${u?'Edit':'New'} Team Account`} size="modal-m" onClose={onClose}
      footer={<><button className="btn btn-s" onClick={onClose}>Cancel</button><button className="btn btn-p" onClick={()=>onSave(form,u?._id)}><i className="ti ti-device-floppy"></i>Save User</button></>}>
      
      <div style={{fontSize:11,fontWeight:700,color:'var(--tx3)',textTransform:'uppercase',letterSpacing:.5,marginBottom:10,paddingBottom:6,borderBottom:'1px solid var(--bd)'}}>
        Main Details (Access & Role)
      </div>
      <div className="fg"><label>Full Name <span className="req">*</span></label><input value={form.name} onChange={set('name')} placeholder="Staff full name" autoFocus/></div>
      <div className="fr2">
        <div className="fg"><label>Username <span className="req">*</span></label><input value={form.username} onChange={set('username')} placeholder="login username"/></div>
        <div className="fg"><label>{u?'New Password (blank to keep)':'Password *'}</label><input type="password" value={form.password} onChange={set('password')} placeholder={u?"Leave blank to keep":"Min 8 characters"}/></div>
      </div>
      <div className="fr2">
        <div className="fg"><label>Role</label><select value={form.role} onChange={set('role')}><option>Admin</option><option>Employee</option></select></div>
        <div className="fg"><label>Account Status</label><select value={form.status} onChange={set('status')}><option>Active</option><option>Inactive</option></select></div>
      </div>

      <div style={{fontSize:11,fontWeight:700,color:'var(--tx3)',textTransform:'uppercase',letterSpacing:.5,margin:'16px 0 10px',paddingBottom:6,borderBottom:'1px solid var(--bd)'}}>
        Contact & Demographics
      </div>
      <div className="fr2">
        <div className="fg"><label>Email Address</label><input value={form.email} onChange={set('email')} placeholder="email@example.com"/></div>
        <div className="fg"><label>Phone Number</label><input value={form.phone} onChange={set('phone')} placeholder="+91..."/></div>
      </div>
      <div className="fr2">
        <div className="fg"><label>Date of Birth</label><input type="date" value={form.dob} onChange={set('dob')}/></div>
        <div className="fg"><label>Address</label><input value={form.address} onChange={set('address')} placeholder="Residential address"/></div>
      </div>

      <div style={{fontSize:11,fontWeight:700,color:'var(--tx3)',textTransform:'uppercase',letterSpacing:.5,margin:'16px 0 10px',paddingBottom:6,borderBottom:'1px solid var(--bd)'}}>
        Bank Details (Salary / Account)
      </div>
      <div className="fr2">
        <div className="fg"><label>Bank Name</label><input value={form.bankName} onChange={set('bankName')} placeholder="e.g. HDFC Bank"/></div>
        <div className="fg"><label>Bank Branch</label><input value={form.bankBranch} onChange={set('bankBranch')} placeholder="e.g. T. Nagar Branch"/></div>
      </div>
      <div className="fr2">
        <div className="fg"><label>Account Number</label><input value={form.bankAcc} onChange={set('bankAcc')} placeholder="Account No"/></div>
        <div className="fg"><label>IFSC Code</label><input value={form.ifsc} onChange={set('ifsc')} placeholder="IFSC Code"/></div>
      </div>

    </Modal>
  );
}

function ResetPwModal({ user:u, onClose, onSave }) {
  const [np, setNp] = useState(''); const [cf, setCf] = useState('');
  return (
    <Modal title={`Force Reset Password — ${u.name}`} size="modal-sm" onClose={onClose}
      footer={<><button className="btn btn-s" onClick={onClose}>Cancel</button><button className="btn btn-p" onClick={()=>onSave(np,cf)}><i className="ti ti-key"></i>Force Reset</button></>}>
      <div style={{fontSize:12,color:'var(--tx3)',marginBottom:12}}>As an Admin, you can instantly assign a new password for <strong>{u.username}</strong> without needing their old password.</div>
      <div className="fg"><label>New Password <span className="req">*</span></label><input type="password" value={np} onChange={e=>setNp(e.target.value)} placeholder="Min 8 characters"/></div>
      <div className="fg"><label>Confirm New Password <span className="req">*</span></label><input type="password" value={cf} onChange={e=>setCf(e.target.value)} placeholder="Re-enter"/></div>
    </Modal>
  );
}
