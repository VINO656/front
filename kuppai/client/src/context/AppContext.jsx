import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import api from '../lib/api';

const Ctx = createContext();
export const useApp = () => useContext(Ctx);

export function AppProvider({ children }) {
  const [user, setUser]           = useState(null);
  const [units, setUnits]         = useState([]);
  const [activeUnitId, setActiveUnitId] = useState(null);
  const [currentPage, setCurrentPage]   = useState('dashboard');
  const [theme, setTheme]               = useState(() => localStorage.getItem('kuppai_theme') || 'light');
  const [toastMsg, setToastMsg]   = useState(null);
  const timerRef = useRef(null);

  useEffect(() => {
    if (theme === 'dark') {
      document.body.classList.add('dark');
    } else {
      document.body.classList.remove('dark');
    }
    localStorage.setItem('kuppai_theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(t => t === 'light' ? 'dark' : 'light');

  const toast = useCallback((msg, type='ok') => {
    setToastMsg({ msg, type });
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setToastMsg(null), 3200);
  }, []);

  const login = async (username, password) => {
    const { data } = await api.post('/auth/login', { username, password });
    localStorage.setItem('kuppai_token', data.token);
    setUser(data.user);
    const { data: us } = await api.get('/units');
    setUnits(us);
    const firstActive = us.find(u => u.status === 'Active') || us[0];
    setActiveUnitId(data.user.unitId || firstActive?._id);
    setCurrentPage(data.user.role === 'Admin' ? 'dashboard' : 'inflow');
    return data.user;
  };

  const register = async (payload) => {
    const { data } = await api.post('/auth/register', payload);
    localStorage.setItem('kuppai_token', data.token);
    setUser(data.user);
    const { data: us } = await api.get('/units');
    setUnits(us);
    const firstActive = us.find(u => u.status === 'Active') || us[0];
    setActiveUnitId(data.user.unitId || firstActive?._id);
    setCurrentPage(data.user.role === 'Admin' ? 'dashboard' : 'inflow');
    return data.user;
  };

  const logout = () => {
    localStorage.removeItem('kuppai_token');
    setUser(null);
    setUnits([]);
    setActiveUnitId(null);
    setCurrentPage('dashboard');
  };

  const refreshUnits = async () => {
    const { data } = await api.get('/units');
    setUnits(data);
    return data;
  };

  const activeUnit = units.find(u => u._id === activeUnitId);
  const isAdmin = user?.role === 'Admin';

  return (
    <Ctx.Provider value={{
      user, units, activeUnitId, setActiveUnitId, activeUnit, isAdmin,
      currentPage, setCurrentPage, toast, toastMsg, theme, toggleTheme,
      login, register, logout, refreshUnits,
    }}>
      {children}
    </Ctx.Provider>
  );
}
