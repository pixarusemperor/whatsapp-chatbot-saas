'use client';

import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/app/components/DashboardLayout';

interface Sequence {
  id: string;
  name: string;
}

interface Instance {
  id: string;
  name: string;
  phone: string;
}

interface Trigger {
  id: string;
  instance_id: string;
  instance_name: string;
  keyword: string;
  match_type: 'exact' | 'contains';
  sequence_id: string;
  is_active: boolean;
  auto_read?: boolean;
  created_at: string;
  wf_sequences?: {
    name: string;
  };
}

export default function TriggersPage() {
  const [triggers, setTriggers] = useState<Trigger[]>([]);
  const [sequences, setSequences] = useState<Sequence[]>([]);
  const [instances, setInstances] = useState<Instance[]>([]);
  const [loading, setLoading] = useState(true);

  // Form State
  const [selectedInstance, setSelectedInstance] = useState('');
  const [keyword, setKeyword] = useState('');
  const [matchType, setMatchType] = useState<'exact' | 'contains'>('exact');
  const [selectedSequence, setSelectedSequence] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [autoRead, setAutoRead] = useState(true);

  const [formLoading, setFormLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    loadPageData();
  }, []);

  const loadPageData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [trigRes, seqRes, instRes] = await Promise.all([
        fetch('/api/triggers'),
        fetch('/api/sequences'),
        fetch('/api/instances'),
      ]);

      if (trigRes.ok) {
        const trigData = await trigRes.json();
        setTriggers(trigData);
      }
      if (seqRes.ok) {
        const seqData = await seqRes.json();
        setSequences(seqData);
        if (seqData.length > 0) setSelectedSequence(seqData[0].id);
      }
      if (instRes.ok) {
        const instData = await instRes.json();
        setInstances(instData);
        if (instData.length > 0) setSelectedInstance(instData[0].id);
      } else {
        setError('Wasender instances could not be loaded. Please configure your PAT in Settings.');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load page data');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTrigger = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setError(null);
    setSuccess(null);

    const instanceName = instances.find((i) => i.id === selectedInstance)?.name || 'WhatsApp Device';

    try {
      const res = await fetch('/api/triggers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instance_id: selectedInstance,
          instance_name: instanceName,
          keyword,
          match_type: matchType,
          sequence_id: selectedSequence,
          is_active: isActive,
          auto_read: autoRead,
        }),
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || 'Failed to create trigger');
      }

      setSuccess('Trigger keyword registered successfully!');
      setKeyword('');
      setAutoRead(true);
      loadPageData(); // Reload list
    } catch (err: any) {
      setError(err.message);
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteTrigger = async (id: string) => {
    if (!window.confirm('Delete this keyword trigger?')) return;

    try {
      const res = await fetch(`/api/triggers/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete trigger');
      setTriggers((prev) => prev.filter((t) => t.id !== id));
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleToggleActive = async (trigger: Trigger) => {
    const nextActive = !trigger.is_active;
    try {
      const res = await fetch(`/api/triggers/${trigger.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: nextActive }),
      });

      if (!res.ok) throw new Error('Failed to update trigger');

      setTriggers((prev) =>
        prev.map((t) => (t.id === trigger.id ? { ...t, is_active: nextActive } : t))
      );
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleToggleAutoRead = async (trigger: Trigger) => {
    const nextAutoRead = trigger.auto_read === false ? true : false;
    try {
      const res = await fetch(`/api/triggers/${trigger.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auto_read: nextAutoRead }),
      });

      if (!res.ok) throw new Error('Failed to update trigger auto-read status');

      setTriggers((prev) =>
        prev.map((t) => (t.id === trigger.id ? { ...t, auto_read: nextAutoRead } : t))
      );
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <DashboardLayout>
      <div className="page-header">
        <div className="page-title">
          <h2>Keyword Triggers</h2>
          <p>Link trigger keywords on specific phone numbers to message sequences</p>
        </div>
      </div>

      <div className="grid-2">
        {/* Trigger Creator Form */}
        <div>
          <div className="card">
            <div className="card-header">
              <h3>Create Trigger Map</h3>
            </div>
            <form onSubmit={handleCreateTrigger}>
              <div className="card-body">
                {error && <div className="alert-danger">{error}</div>}
                {success && <div className="alert-success">{success}</div>}

                <div className="form-group">
                  <label className="form-label">WhatsApp Number / Device</label>
                  {instances.length === 0 ? (
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                      No active instances. Please set up Wasender API token in settings first.
                    </div>
                  ) : (
                    <select
                      className="form-control"
                      value={selectedInstance}
                      onChange={(e) => setSelectedInstance(e.target.value)}
                      disabled={formLoading}
                    >
                      {instances.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.name} ({i.phone})
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label">Keyword / Trigger Phrase</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. promo, start, info"
                    className="form-control"
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    disabled={formLoading}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Matching Condition</label>
                  <select
                    className="form-control"
                    value={matchType}
                    onChange={(e) => setMatchType(e.target.value as any)}
                    disabled={formLoading}
                  >
                    <option value="exact">Exact match (e.g. user sends exactly keyword)</option>
                    <option value="contains">Phrase match / Contains (e.g. message contains keyword)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Trigger Sequence</label>
                  {sequences.length === 0 ? (
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                      No sequences found. Create one first in the Sequences page.
                    </div>
                  ) : (
                    <select
                      className="form-control"
                      value={selectedSequence}
                      onChange={(e) => setSelectedSequence(e.target.value)}
                      disabled={formLoading}
                    >
                      {sequences.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="checkbox"
                    id="is-active"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    disabled={formLoading}
                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                  />
                  <label htmlFor="is-active" style={{ cursor: 'pointer', fontSize: '0.95rem' }}>
                    Trigger is active
                  </label>
                </div>

                <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="checkbox"
                    id="auto-read"
                    checked={autoRead}
                    onChange={(e) => setAutoRead(e.target.checked)}
                    disabled={formLoading}
                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                  />
                  <label htmlFor="auto-read" style={{ cursor: 'pointer', fontSize: '0.95rem' }}>
                    Auto-read message (blue ticks)
                  </label>
                </div>
              </div>
              <div className="card-footer">
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={formLoading || instances.length === 0 || sequences.length === 0}
                >
                  {formLoading ? 'Creating...' : 'Create Trigger'}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Existing Triggers List */}
        <div>
          <div className="card" style={{ minHeight: '300px' }}>
            <div className="card-header">
              <h3>Active Mappings</h3>
            </div>
            <div className="card-body">
              {loading ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
                  Loading trigger maps...
                </div>
              ) : triggers.length === 0 ? (
                <div className="empty-state">
                  <h4>No triggers created</h4>
                  <p style={{ marginTop: '8px' }}>Define triggers on the left to map keys to your sequences.</p>
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Keyword</th>
                        <th>Match</th>
                        <th>Device</th>
                        <th>Sequence</th>
                        <th>Auto-Read</th>
                        <th>Status</th>
                        <th style={{ textAlign: 'right' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {triggers.map((trig) => (
                        <tr key={trig.id}>
                          <td style={{ fontWeight: 'bold', color: 'var(--color-primary)' }}>
                            "{trig.keyword}"
                          </td>
                          <td style={{ fontSize: '0.85rem' }}>
                            <span className={`badge ${trig.match_type === 'contains' ? 'badge-warning' : 'badge-secondary'}`}>
                              {trig.match_type || 'exact'}
                            </span>
                          </td>
                          <td style={{ fontSize: '0.85rem' }}>{trig.instance_name || trig.instance_id}</td>
                          <td style={{ fontSize: '0.9rem' }}>{trig.wf_sequences?.name || 'Deleted Sequence'}</td>
                          <td>
                            <button
                              onClick={() => handleToggleAutoRead(trig)}
                              className={`badge ${trig.auto_read !== false ? 'badge-success' : 'badge-secondary'}`}
                              style={{ border: 'none', cursor: 'pointer' }}
                            >
                              {trig.auto_read !== false ? 'Read (Blue)' : 'Unread (Grey)'}
                            </button>
                          </td>
                          <td>
                            <button
                              onClick={() => handleToggleActive(trig)}
                              className={`badge ${trig.is_active ? 'badge-success' : 'badge-secondary'}`}
                              style={{ border: 'none', cursor: 'pointer' }}
                            >
                              {trig.is_active ? 'Active' : 'Inactive'}
                            </button>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <button
                              onClick={() => handleDeleteTrigger(trig.id)}
                              className="btn btn-danger btn-sm"
                              style={{ padding: '4px 8px' }}
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
