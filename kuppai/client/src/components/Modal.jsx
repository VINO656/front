import React from 'react';

export function Modal({ title, size='', onClose, children, footer }) {
  return (
    <div className="overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${size}`}>
        <div className="modal-hdr">
          <h3>{title}</h3>
          <span className="modal-close" onClick={onClose}><i className="ti ti-x"></i></span>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}

export function Drawer({ title, onClose, children, footer }) {
  return (
    <div className="drawer-wrap" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="drawer">
        <div className="drawer-hdr">
          <h3>{title}</h3>
          <span className="modal-close" onClick={onClose}><i className="ti ti-x"></i></span>
        </div>
        <div className="drawer-body">{children}</div>
        {footer && <div className="drawer-footer">{footer}</div>}
      </div>
    </div>
  );
}
