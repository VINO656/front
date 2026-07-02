import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

// Prevent accidental mousewheel scrolling from changing number input values globally
window.addEventListener('wheel', (e) => {
  if (e.target && e.target.tagName === 'INPUT' && e.target.type === 'number') {
    e.target.blur();
  }
}, { passive: true });

createRoot(document.getElementById('root')).render(<App/>);
