'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import DashboardLayout from '@/app/components/DashboardLayout';

interface Instance {
  id: string;
  name: string;
  phone: string;
  status: string;
  session: {
    status: string;
  };
}

export default function Dashboard() {
  const [instances, setInstances] = useState<Instance[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    sequences: 0,
    triggers: 0,
    messages: 0,
  });

  useEffect(() => {
    async function loadDashboardData() {
      try {
        // Fetch instances
        const instRes = await fetch('/api/instances');
        if (instRes.ok) {
          const instData = await instRes.json();
          setInstances(instData);
        }

        // Fetch counts from endpoints
        const seqRes = await fetch('/api/sequences');
        const trigRes = await fetch('/api/triggers');
        const msgRes = await fetch('/api/inbox');

        const seqData = seqRes.ok ? await seqRes.json() : [];
        const trigData = trigRes.ok ? await trigRes.json() : [];
        const msgData = msgRes.ok ? await msgRes.json() : [];

        setStats({
          sequences: seqData.length,
          triggers: trigData.length,
          messages: msgData.length,
        });
      } catch (err) {
        console.error('Error loading dashboard data:', err);
      } finally {
        setLoading(false);
      }
    }

    loadDashboardData();
  }, []);

  return (
    <DashboardLayout>
      <div className="page-header">
        <div className="page-title">
          <h2>Dashboard</h2>
          <p>Real-time status of your Wasender workflows and devices</p>
        </div>
        <div>
          <Link href="/sequences/new" className="btn btn-primary">
            + New Sequence
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-label">Active Workflows</span>
          <span className="stat-value">{stats.sequences}</span>
          <span className="stat-subtext">Reusable sequences</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Keyword Triggers</span>
          <span className="stat-value">{stats.triggers}</span>
          <span className="stat-subtext">Active keyword maps</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Inbox Logs</span>
          <span className="stat-value">{stats.messages}</span>
          <span className="stat-subtext">Total tracked chats</span>
        </div>
      </div>

      {/* Instances Section */}
      <h3 style={{ marginBottom: '16px' }}>Connected WhatsApp Devices</h3>
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
          Loading your WhatsApp instances...
        </div>
      ) : instances.length === 0 ? (
        <div className="card" style={{ padding: '32px', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>
            No Wasender instances detected. Please configure your API key.
          </p>
          <Link href="/settings" className="btn btn-secondary">
            Go to Settings
          </Link>
        </div>
      ) : (
        <div className="grid-2">
          {instances.map((inst) => (
            <div key={inst.id} className="card">
              <div className="card-header">
                <div>
                  <h4 style={{ fontSize: '1.2rem' }}>{inst.name || 'WhatsApp Instance'}</h4>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>ID: {inst.id}</span>
                </div>
                <span
                  className={`badge ${
                    inst.status === 'connected' ? 'badge-success' : 'badge-warning'
                  }`}
                >
                  {inst.status === 'connected' ? '● Connected' : '● Disconnected'}
                </span>
              </div>
              <div className="card-body">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Phone Number:</span>
                    <span style={{ fontWeight: 600 }}>{inst.phone || 'N/A'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Wasender Status:</span>
                    <span>{inst.status || 'N/A'}</span>
                  </div>
                </div>
              </div>
              <div className="card-footer">
                <Link href="/triggers" className="btn btn-secondary btn-sm">
                  Manage Triggers
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </DashboardLayout>
  );
}
