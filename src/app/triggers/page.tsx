'use client';

import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/app/components/DashboardLayout';
import { Plus } from 'lucide-react';
import { enrichTriggersWithRates } from '@/lib/flows/enrich-triggers';

interface Sequence {
  id: string;
  name: string;
}

interface Instance {
  id: string;
  name: string;
  phone: string;
}

interface Variant {
  id?: string;
  sequence_id: string;
  name: string;
  weight?: number;
}

interface Trigger {
  id: string;
  instance_id: string;
  instance_name: string;
  keyword: string;
  match_type: 'exact' | 'contains';
  sequence_id?: string;
  variants?: Variant[];
  is_active: boolean;
  auto_read?: boolean;
  created_at: string;
  wf_sequences?: {
    name: string;
  };
  trigger_variants?: Variant[];
  rates?: Array<{ variantId: string; rate: number }>;
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
  const [isExperiment, setIsExperiment] = useState(false);
  const [selectedSequence, setSelectedSequence] = useState('');
  const [variants, setVariants] = useState<Variant[]>([]);
  const [newVariantName, setNewVariantName] = useState('');
  const [newVariantSequence, setNewVariantSequence] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [autoRead, setAutoRead] = useState(true);

  const [formLoading, setFormLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Sleek modal
  const [showCreateModal, setShowCreateModal] = useState(false);

  const openCreate = () => {
    setKeyword('');
    setIsExperiment(false);
    setVariants([]);
    setNewVariantName('');
    const firstSeq = sequences[0]?.id || '';
    setSelectedSequence(firstSeq);
    setNewVariantSequence(firstSeq);
    setIsActive(true);
    setAutoRead(true);
    setError(null);
    setSuccess(null);
    setShowCreateModal(true);
  };

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

      let trigData = [];
      if (trigRes.ok) {
        trigData = await trigRes.json();
      }

      // Enrich variant triggers with rates (TDD helper)
      const enriched = await enrichTriggersWithRates(trigData, async (triggerId: string) => {
        const res = await fetch(`/api/variant-stats?trigger_id=${triggerId}`);
        if (res.ok) {
          const json = await res.json();
          return json.data || [];
        }
        return [];
      });
      setTriggers(enriched);

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

    const payload: any = {
      instance_id: selectedInstance,
      instance_name: instanceName,
      keyword,
      match_type: matchType,
      is_active: isActive,
      auto_read: autoRead,
    };

    if (isExperiment && variants.length > 0) {
      payload.variants = variants.map(v => ({
        sequence_id: v.sequence_id,
        name: v.name,
        weight: v.weight || 1,
      }));
    } else {
      payload.sequence_id = selectedSequence;
    }

    try {
      const res = await fetch('/api/triggers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || 'Failed to create trigger');
      }

      setSuccess('Trigger keyword registered successfully!');
      setKeyword('');
      setIsExperiment(false);
      setVariants([]);
      setNewVariantName('');
      setAutoRead(true);
      setShowCreateModal(false);
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
      {/* Sleek modern header like respond.io */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px' }}>
        <div>
          <h2 style={{ fontSize: '1.65rem', fontWeight: 700, letterSpacing: '-0.025em', margin: 0 }}>Automations</h2>
          <p style={{ color: 'var(--text-muted)', margin: '4px 0 0', fontSize: '0.95rem' }}>Keyword triggers &amp; A/B test variants</p>
        </div>
        <button onClick={openCreate} className="btn-sleek btn-sleek-primary">
          <Plus className="w-4 h-4" /> New Automation
        </button>
      </div>

      {/* Sleek automation list - respond.io style */}
      {!loading && triggers.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16, marginTop: 8 }}>
          {triggers.map((trig) => {
            const hasV = !!(trig.trigger_variants && trig.trigger_variants.length);
            return (
              <div key={trig.id} className="automation-card">
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <div>
                    <div className="keyword-badge">"{trig.keyword}"</div>
                    <div style={{ fontSize: '.75rem', color: 'var(--text-muted)', marginTop: 4 }}>{trig.match_type} • {trig.instance_name}</div>
                  </div>
                  <button onClick={() => handleToggleActive(trig)} className="btn-sleek btn-sleek-ghost btn-sleek-sm" style={{ fontSize: '.7rem' }}>
                    {trig.is_active ? 'Active' : 'Paused'}
                  </button>
                </div>

                {hasV ? (
                  <div style={{ marginTop: 12 }}>
                    <div style={{ fontSize: '.78rem', color: 'var(--text-muted)', marginBottom: 4 }}>Variants</div>
                    <div className="variant-pills">
                      {(trig.trigger_variants || []).map((v, i) => {
                        const r = (trig.rates || []).find((x: any) => x.variantId === v.id);
                        return <span key={i} className="variant-pill">{v.name}{r ? ` · ${(r.rate * 100).toFixed(0)}%` : ''}</span>;
                      })}
                    </div>
                  </div>
                ) : (
                  <div style={{ marginTop: 10, fontSize: '.9rem' }}>{trig.wf_sequences?.name || '—'}</div>
                )}

                <div style={{ marginTop: 16, fontSize: '.78rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <button onClick={() => handleToggleAutoRead(trig)} className="btn-sleek btn-sleek-ghost btn-sleek-sm" style={{ fontSize: '.7rem' }}>
                    {trig.auto_read !== false ? 'Auto-read' : 'Manual'}
                  </button>
                  <button onClick={() => handleDeleteTrigger(trig.id)} className="btn-sleek btn-sleek-ghost btn-sleek-sm" style={{ color: '#f87171', fontSize: '.7rem' }}>Delete</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!loading && triggers.length === 0 && (
        <div style={{ textAlign: 'center', padding: '48px 32px', color: 'var(--text-secondary)' }}>
          No automations yet. Click "New Automation" to create your first trigger.
        </div>
      )}



      {/* Sleek Modal */}
      {showCreateModal && (
        <div className="modal-backdrop" onClick={() => setShowCreateModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ fontWeight: 600 }}>New Automation</div>
              <button onClick={() => setShowCreateModal(false)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer' }}>×</button>
            </div>
            <form onSubmit={handleCreateTrigger}>
              <div className="modal-body">
                {error && <div className="alert-danger" style={{ marginBottom: 12 }}>{error}</div>}

                <div style={{ marginBottom: 14 }}>
                  <div className="form-label">Device</div>
                  <select className="input-sleek" value={selectedInstance} onChange={e => setSelectedInstance(e.target.value)} required>
                    {instances.map(i => <option key={i.id} value={i.id}>{i.name} ({i.phone})</option>)}
                  </select>
                </div>

                <div style={{ marginBottom: 14 }}>
                  <div className="form-label">Keyword</div>
                  <input className="input-sleek" value={keyword} onChange={e => setKeyword(e.target.value)} placeholder="e.g. hello" required />
                </div>

                <div style={{ marginBottom: 14 }}>
                  <div className="form-label">Match</div>
                  <select className="input-sleek" value={matchType} onChange={e => setMatchType(e.target.value as any)}>
                    <option value="exact">Exact</option>
                    <option value="contains">Contains</option>
                  </select>
                </div>

                <div style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <div className="form-label" style={{ margin: 0 }}>Mode</div>
                    <label style={{ fontSize: '.85rem' }}><input type="checkbox" checked={isExperiment} onChange={e=>setIsExperiment(e.target.checked)} /> A/B Test</label>
                  </div>
                  {!isExperiment ? (
                    <select className="input-sleek" value={selectedSequence} onChange={e=>setSelectedSequence(e.target.value)}>
                      {sequences.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  ) : (
                    <div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <input className="input-sleek" placeholder="Variant name" value={newVariantName} onChange={e=>setNewVariantName(e.target.value)} style={{ flex: 1 }} />
                        <select className="input-sleek" style={{ width: 120 }} value={newVariantSequence} onChange={e=>setNewVariantSequence(e.target.value)}>
                          {sequences.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                        <button type="button" className="btn-sleek btn-sleek-primary btn-sleek-sm" onClick={() => { if (newVariantName.trim()) { setVariants([...variants, { sequence_id: newVariantSequence, name: newVariantName.trim() }]); setNewVariantName(''); } }}>+</button>
                      </div>
                      {variants.length > 0 && <div className="variant-pills" style={{ marginTop: 6 }}>{variants.map((v,i)=><span key={i} className="variant-pill">{v.name}</span>)}</div>}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 16, fontSize: '.9rem' }}>
                  <label><input type="checkbox" checked={isActive} onChange={e=>setIsActive(e.target.checked)} /> Active</label>
                  <label><input type="checkbox" checked={autoRead} onChange={e=>setAutoRead(e.target.checked)} /> Auto-read</label>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-sleek btn-sleek-secondary" onClick={() => setShowCreateModal(false)}>Cancel</button>
                <button type="submit" disabled={formLoading} className="btn-sleek btn-sleek-primary">{formLoading ? 'Creating…' : 'Create'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
