import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar.tsx';
import Topbar from './Topbar.tsx';
import { useAuth } from '../../context/AuthContext.tsx';
import AppToaster from '../common/AppToaster.tsx';

const MainLayout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('seller_sidebar_collapsed') === '1';
    } catch {
      return false;
    }
  });
  const { user } = useAuth();

  return (
    <div className="min-h-screen seller-app-bg">
      <AppToaster />
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => {
          setSidebarCollapsed((v) => {
            const next = !v;
            try {
              localStorage.setItem('seller_sidebar_collapsed', next ? '1' : '0');
            } catch {
              // ignore
            }
            return next;
          });
        }}
      />
      
      <div className={sidebarCollapsed ? 'lg:pl-20' : 'lg:pl-64'}>
        <Topbar onMenuClick={() => setSidebarOpen(true)} />
        
        <main className="p-3 lg:p-5">
          <div className="mx-auto w-full max-w-6xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default MainLayout;
