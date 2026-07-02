import React from 'react';
import { useApp } from '../context/AppContext';

export default function Toast() {
  const { toastMsg } = useApp();
  if (!toastMsg) return null;
  const icon = toastMsg.type === 'ok' ? 'ti-circle-check' : toastMsg.type === 'err' ? 'ti-alert-circle' : 'ti-alert-triangle';
  return (
    <div id="toast" className={`show t-${toastMsg.type}`}>
      <i className={`ti ${icon}`}></i>
      <span>{toastMsg.msg}</span>
    </div>
  );
}
