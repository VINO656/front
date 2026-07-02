import React, { useState, useEffect } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import Toast from './components/Toast';
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import Login from './features/auth/LoginPage';
import Dashboard from './features/dashboard/DashboardPage';
import Units from './features/settings/UnitsPage';
import UserMgmt from './features/users/UserMgmtPage';
import Profiles from './features/profiles/ProfilesPage';
import Inflow from './features/inventory/InflowPage';
import Cleaning from './features/operations/CleaningPage';
import Processing from './features/operations/ProcessingPage';
import Inventory from './features/inventory/InventoryPage';
import Outflow from './features/inventory/OutflowPage';
import Invoices from './features/invoices/InvoicesPage';
import Reports from './features/reports/ReportsPage';
import Placeholder from './components/Placeholder';
import Settings from './features/settings/SettingsPage';

const PH_PAGES = [];

function Shell() {
  const { user, currentPage, setCurrentPage, isAdmin } = useApp();
  const [actions, setActions] = useState(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (user && !isAdmin && ['dashboard', 'units', 'usermgmt', 'reports', 'profiles', 'inventory', 'settings-ph'].includes(currentPage)) {
      setCurrentPage('inflow');
    }
  }, [user, isAdmin, currentPage, setCurrentPage]);

  if (!user) return <Login />;

  const renderPage = () => {
    if (PH_PAGES.includes(currentPage)) return <Placeholder page={currentPage} />;
    switch (currentPage) {
      case 'dashboard':  return <Dashboard  setActions={setActions} />;
      case 'inflow':     return <Inflow     setActions={setActions} />;
      case 'cleaning':   return <Cleaning   setActions={setActions} />;
      case 'processing': return <Processing setActions={setActions} />;
      case 'inventory':  return isAdmin ? <Inventory  setActions={setActions} /> : <Placeholder page="inventory" />;
      case 'outflow':    return <Outflow    setActions={setActions} />;
      case 'invoices':   return <Invoices   setActions={setActions} />;
      case 'reports':    return <Reports    setActions={setActions} />;
      case 'profiles':   return isAdmin ? <Profiles   setActions={setActions} /> : <Placeholder page="profiles" />;
      case 'units':      return isAdmin ? <Units    setActions={setActions} /> : <Placeholder page="units" />;
      case 'usermgmt':   return isAdmin ? <UserMgmt setActions={setActions} /> : <Placeholder page="usermgmt" />;
      case 'settings-ph':return isAdmin ? <Settings setActions={setActions} /> : <Placeholder page="settings" />;
      default:           return <Placeholder page={currentPage} />;
    }
  };

  return (
    <div id="root">
      <div id="app-shell">
        <Sidebar mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />
        {mobileOpen && <div className="sidebar-backdrop" onClick={() => setMobileOpen(false)}></div>}
        <div id="main">
          <Topbar actions={actions} onMenuClick={() => setMobileOpen(true)} />
          <div id="page-area">
            {renderPage()}
          </div>
        </div>
      </div>
      <Toast />
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  );
}
