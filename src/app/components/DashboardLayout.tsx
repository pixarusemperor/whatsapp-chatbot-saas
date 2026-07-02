'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { 
  LayoutDashboard, 
  Repeat, 
  Zap, 
  Inbox, 
  Megaphone, 
  Settings, 
  User, 
  LogOut,
  Activity
} from 'lucide-react';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setUserEmail('WatsFlow Owner');
    setLoading(false);
  }, []);

  const handleLogout = () => {
    // Single user mode - no-op
  };

  const navItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Sequences', path: '/sequences', icon: Repeat },
    { name: 'Triggers', path: '/triggers', icon: Zap },
    { name: 'Inbox', path: '/inbox', icon: Inbox },
    { name: 'Campaigns', path: '/campaigns', icon: Megaphone },
    { name: 'Settings', path: '/settings', icon: Settings },
  ];

  if (loading) {
    return (
      <div className="login-container" style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--bg-base)',
        color: 'var(--text-secondary)',
        fontFamily: 'var(--font-family-body)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Activity className="animate-spin text-emerald-400" />
          <span>Loading WassFlow...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #10b981 0%, #3b82f6 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 800,
            color: '#030712',
            fontSize: '1.2rem',
            fontFamily: 'var(--font-family-title)',
            boxShadow: '0 4px 12px rgba(16, 185, 129, 0.2)'
          }}>
            W
          </div>
          <h1>WassFlow</h1>
        </div>

        <nav className="sidebar-menu">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.path === '/'
                ? pathname === '/'
                : pathname.startsWith(item.path);
            return (
              <Link
                key={item.path}
                href={item.path}
                className={`sidebar-link ${isActive ? 'active' : ''}`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-emerald-400' : 'text-zinc-500'}`} style={{ transition: 'color 0.2s' }} />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="user-info" title={userEmail || ''} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <User className="w-4 h-4 text-zinc-500" />
            <span>{userEmail}</span>
          </div>
          <button onClick={handleLogout} className="btn btn-secondary btn-sm" style={{ width: '100%', gap: '8px' }}>
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </aside>

      {/* Main Panel */}
      <div className="main-wrapper">
        {/* Modern Sleek Top Bar - Respond.io inspired */}
        <header className="topbar">
          <div className="topbar-left">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: 28, height: 28, borderRadius: 8,
                background: 'linear-gradient(135deg, #2563eb, #10b981)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'white', fontWeight: 700, fontSize: '14px'
              }}>W</div>
              <span style={{ fontWeight: 600, fontSize: '15px', letterSpacing: '-0.02em' }}>WassFlow</span>
            </div>
            <div style={{ width: 1, height: 20, background: 'var(--border)' }} />
            <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 500 }}>
              {pathname === '/' ? 'Dashboard' : pathname.split('/')[1]?.charAt(0).toUpperCase() + pathname.split('/')[1]?.slice(1) || ''}
            </span>
          </div>

          <div className="topbar-right">
            <input 
              type="text" 
              placeholder="Search automations, contacts..." 
              className="search-input" 
            />
            <button className="btn-sleek btn-sleek-secondary btn-sleek-sm">
              <span>●</span> Connected
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 12, borderLeft: '1px solid var(--border)' }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#334155', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>
                <User size={14} />
              </div>
              <span style={{ fontSize: '13px', fontWeight: 500 }}>{userEmail}</span>
            </div>
          </div>
        </header>

        <main className="main-content">
          <div className="container-wide">{children}</div>
        </main>
      </div>
    </div>
  );
}
