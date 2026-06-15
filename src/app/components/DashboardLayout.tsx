'use client';

import React from 'react';
import Link from 'next/link';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '12px',
        padding: '12px 24px',
        borderBottom: '1px solid var(--border-color, rgba(255,255,255,0.06))',
        marginBottom: '24px'
      }}>
        <Link href="/" style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '0.85rem' }}>
          ← Back to Dashboard
        </Link>
        <Link href="/campaigns" style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '0.85rem' }}>
          📢 Campaigns
        </Link>
      </div>
      <main style={{ flex: 1, padding: '0 24px 24px' }}>
        {children}
      </main>
    </div>
  );
}
