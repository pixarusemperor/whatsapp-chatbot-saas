'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

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
    { name: 'Dashboard', path: '/', icon: '📊' },
    { name: 'Sequences', path: '/sequences', icon: '🔁' },
    { name: 'Triggers', path: '/triggers', icon: '⚡' },
    { name: 'Inbox', path: '/inbox', icon: '📥' },
    { name: 'Campaigns', path: '/campaigns', icon: '📢' },
    { name: 'Settings', path: '/settings', icon: '⚙️' },
  ];

  if (loading) {
    return (
      <div className="login-container">
        <div style={{ color: 'var(--text-secondary)' }}>Loading WassFlow...</div>
      </div>
    );
  }

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <span>🌊</span>
          <h1>WassFlow</h1>
        </div>

        <nav className="sidebar-menu">
          {navItems.map((item) => {
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
                <span>{item.icon}</span>
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="user-info" title={userEmail || ''}>
            👤 {userEmail}
          </div>
          <button onClick={handleLogout} className="btn btn-secondary btn-sm" style={{ width: '100%' }}>
            Logout
          </button>
        </div>
      </aside>

      {/* Main Panel */}
      <div className="main-wrapper">
        <header className="navbar">
          <div>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              {pathname === '/' ? 'Overview' : pathname.split('/')[1].toUpperCase()}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span className="badge badge-success">● Connected</span>
          </div>
        </header>

        <main className="main-content">
          <div className="container-wide">{children}</div>
        </main>
      </div>
    </div>
  );
}
