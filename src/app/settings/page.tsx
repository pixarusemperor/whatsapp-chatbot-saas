'use client';

import React, { useState, useEffect } from 'react';
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

export default function SettingsPage() {
  const [pat, setPat] = useState('');
  const [hasPat, setHasPat] = useState(false);
  const [webhookBaseUrl, setWebhookBaseUrl] = useState('');
  const [instances, setInstances] = useState<Instance[]>([]);
  const [instancesLoading, setInstancesLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [webhookLoading, setWebhookLoading] = useState<Record<string, boolean>>({});
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const res = await fetch('/api/config');
      if (!res.ok) throw new Error('Failed to fetch config');
      const data = await res.json();
      
      if (data.has_pat) {
        setPat(data.raw_pat || ''); // Fallback to raw PAT returned
        setHasPat(true);
        // Proactively fetch instances if PAT is available
        fetchInstances();
      }
      setWebhookBaseUrl(data.webhook_base_url || '');
    } catch (err: any) {
      console.error(err);
    }
  };

  const fetchInstances = async () => {
    setInstancesLoading(true);
    try {
      const res = await fetch('/api/instances');
      if (!res.ok) throw new Error('Could not load instances. Check your PAT token.');
      const data = await res.json();
      setInstances(data);
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setInstancesLoading(false);
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveLoading(true);
    setMessage(null);

    try {
      // Auto-detect current host if webhook base URL is empty
      let finalUrl = webhookBaseUrl;
      if (!finalUrl && typeof window !== 'undefined') {
        finalUrl = window.location.origin;
        setWebhookBaseUrl(finalUrl);
      }

      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wassenger_pat: pat,
          webhook_base_url: finalUrl,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to save configuration');
      }

      setMessage({ text: 'Configuration saved successfully!', type: 'success' });
      setHasPat(!!pat);
      fetchInstances();
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setSaveLoading(false);
    }
  };

  const handleRegisterWebhook = async (deviceId: string) => {
    setWebhookLoading((prev) => ({ ...prev, [deviceId]: true }));
    setMessage(null);

    try {
      const res = await fetch('/api/instances/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to register webhook');
      }

      setMessage({ text: `Webhook successfully registered for instance ${deviceId}!`, type: 'success' });
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setWebhookLoading((prev) => ({ ...prev, [deviceId]: false }));
    }
  };

  return (
    <DashboardLayout>
      <div className="container-narrow">
        <div className="page-header">
          <div className="page-title">
            <h2>Settings & Configuration</h2>
            <p>Configure Wassenger credentials and sync incoming webhooks</p>
          </div>
        </div>

        {message && (
          <div className={message.type === 'success' ? 'alert-success' : 'alert-danger'}>
            {message.text}
          </div>
        )}

        {/* Credentials Card */}
        <div className="card">
          <div className="card-header">
            <h3>API Settings</h3>
          </div>
          <form onSubmit={handleSaveConfig}>
            <div className="card-body">
              <div className="form-group">
                <label className="form-label" htmlFor="pat">
                  Wasender Personal Access Token (PAT)
                </label>
                <input
                  id="pat"
                  type="password"
                  required
                  placeholder="Enter Wasender PAT"
                  className="form-control"
                  value={pat}
                  onChange={(e) => setPat(e.target.value)}
                />
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                  Generate a token in your Wasender console under Settings &gt; Personal Access Tokens.
                </span>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="webhook">
                  Webhook Base URL
                </label>
                <input
                  id="webhook"
                  type="url"
                  placeholder="https://your-domain.vercel.app"
                  className="form-control"
                  value={webhookBaseUrl}
                  onChange={(e) => setWebhookBaseUrl(e.target.value)}
                />
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                  The base URL of this deployment. We will suffix this with <code>/api/webhooks/[instance_id]</code>.
                </span>
              </div>
            </div>
            <div className="card-footer">
              <button type="submit" className="btn btn-primary" disabled={saveLoading}>
                {saveLoading ? 'Saving...' : 'Save Configuration'}
              </button>
            </div>
          </form>
        </div>

        {/* Connected Instances Webhook Syncer */}
        <div className="card">
          <div className="card-header">
            <h3>WhatsApp Webhooks Sync</h3>
          </div>
          <div className="card-body">
            {instancesLoading ? (
              <div style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>Loading instances...</div>
            ) : instances.length === 0 ? (
              <div className="empty-state">
                <p>No instances connected or Wasender PAT not set.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {instances.map((inst) => (
                  <div
                    key={inst.id}
                    className="card-body"
                    style={{
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      padding: '16px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      backgroundColor: 'rgba(255,255,255,0.01)',
                      gap: '20px'
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {inst.name || 'WhatsApp Device'}{' '}
                        <span className={`badge ${inst.status === 'connected' ? 'badge-success' : 'badge-secondary'}`}>
                          {inst.status}
                        </span>
                      </h4>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '4px' }}>
                        ID: {inst.id} • Phone: {inst.phone}
                      </p>
                    </div>
                    <div>
                      <button
                        onClick={() => handleRegisterWebhook(inst.id)}
                        disabled={webhookLoading[inst.id]}
                        className="btn btn-secondary btn-sm"
                      >
                        {webhookLoading[inst.id] ? 'Syncing...' : '⚡ Sync Webhook'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
