'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import DashboardLayout from '@/app/components/DashboardLayout';
import { 
  Plus, 
  GitFork, 
  Zap, 
  MessageSquare, 
  Smartphone, 
  AlertCircle, 
  RefreshCw,
  ArrowRight
} from 'lucide-react';

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
      {/* Sleek Dashboard Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
        <div>
          <h2 style={{ fontSize: '1.65rem', fontWeight: 700, margin: 0, letterSpacing: '-0.02em' }}>Dashboard</h2>
          <p style={{ color: 'var(--text-muted)', marginTop: 4, fontSize: '0.95rem' }}>Overview of your automations and connected devices</p>
        </div>
        <Link href="/sequences/new" className="btn-sleek btn-sleek-primary">
          <Plus className="w-4 h-4" /> New Sequence
        </Link>
      </div>

      {/* Sleek Stats - respond.io style */}
      <div className="stats-grid">
        <div className="modern-card" style={{ padding: '20px 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Active Workflows</span>
            <GitFork className="w-4 h-4" style={{ color: '#3b82f6' }} />
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 700, margin: '6px 0 2px' }}>{stats.sequences}</div>
          <div style={{ fontSize: '.8rem', color: '#4ade80' }}>Reusable automation flows</div>
        </div>
        <div className="modern-card" style={{ padding: '20px 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Keyword Triggers</span>
            <Zap className="w-4 h-4" style={{ color: '#f59e0b' }} />
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 700, margin: '6px 0 2px' }}>{stats.triggers}</div>
          <div style={{ fontSize: '.8rem', color: '#4ade80' }}>Active responders</div>
        </div>
        <div className="modern-card" style={{ padding: '20px 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Inbox Messages</span>
            <MessageSquare className="w-4 h-4" style={{ color: '#10b981' }} />
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 700, margin: '6px 0 2px' }}>{stats.messages}</div>
          <div style={{ fontSize: '.8rem', color: '#4ade80' }}>Tracked conversations</div>
        </div>
      </div>

      {/* Instances Section */}
      <h3 style={{ marginBottom: '20px', fontSize: '1.25rem', fontFamily: 'var(--font-family-title)', fontWeight: 700 }}>
        Connected Devices
      </h3>
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
          <RefreshCw className="animate-spin text-emerald-400" />
          <span>Loading WhatsApp instances...</span>
        </div>
      ) : instances.length === 0 ? (
        <div className="card" style={{ padding: '48px 32px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
          <AlertCircle className="w-10 h-10 text-zinc-500" />
          <div>
            <h4 style={{ fontWeight: 600, fontSize: '1.1rem', marginBottom: '4px' }}>No Connected Instances</h4>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '400px', margin: '0 auto' }}>
              No WatsSender instances detected. Go to Settings to configure your API Credentials.
            </p>
          </div>
          <Link href="/settings" className="btn btn-secondary">
            Configure Settings
          </Link>
        </div>
      ) : (
        <div className="grid-2">
          {instances.map((inst) => (
            <div key={inst.id} className="card">
              <div className="card-header" style={{ padding: '20px 24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ padding: '8px', borderRadius: '10px', backgroundColor: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border-color)', color: 'var(--color-primary)' }}>
                    <Smartphone className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 style={{ fontSize: '1.05rem', fontWeight: 700, fontFamily: 'var(--font-family-title)' }}>
                      {inst.name || 'WhatsApp Instance'}
                    </h4>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>ID: {inst.id}</span>
                  </div>
                </div>
                <span
                  className={`badge ${
                    inst.status === 'connected' ? 'badge-success' : 'badge-warning'
                  }`}
                  style={{ gap: '6px' }}
                >
                  <span style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    backgroundColor: inst.status === 'connected' ? 'var(--color-primary)' : 'var(--color-warning)',
                    display: 'inline-block'
                  }} />
                  {inst.status === 'connected' ? 'Connected' : 'Disconnected'}
                </span>
              </div>
              <div className="card-body" style={{ padding: '20px 24px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Phone Number</span>
                    <span style={{ fontWeight: 600 }}>{inst.phone || 'N/A'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Wasender Status</span>
                    <span style={{ textTransform: 'capitalize', fontWeight: 600 }}>{inst.status || 'N/A'}</span>
                  </div>
                </div>
              </div>
              <div className="card-footer" style={{ padding: '12px 24px' }}>
                <Link href="/triggers" className="btn btn-secondary btn-sm" style={{ gap: '6px' }}>
                  <span>Manage Triggers</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </DashboardLayout>
  );
}
