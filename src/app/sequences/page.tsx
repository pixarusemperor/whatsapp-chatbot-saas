'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import DashboardLayout from '@/app/components/DashboardLayout';

interface Step {
  id: string;
  step_order: number;
  message_type: string;
  message_body: string;
  delay_seconds: number;
}

interface Sequence {
  id: string;
  name: string;
  description: string;
  created_at: string;
  steps: Step[];
}

export default function SequencesPage() {
  const [sequences, setSequences] = useState<Sequence[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSequences();
  }, []);

  const fetchSequences = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/sequences');
      if (!res.ok) throw new Error('Failed to load sequences');
      const data = await res.json();
      setSequences(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this sequence? This will also delete any active triggers linked to it.')) {
      return;
    }

    try {
      const res = await fetch(`/api/sequences/${id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        throw new Error('Failed to delete sequence');
      }

      setSequences((prev) => prev.filter((seq) => seq.id !== id));
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <DashboardLayout>
      {/* Sleek header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
        <div>
          <h2 style={{ fontSize: '1.65rem', fontWeight: 700, margin: 0 }}>Sequences</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '.95rem', marginTop: 4 }}>Automated multi-step response flows</p>
        </div>
        <Link href="/sequences/new" className="btn-sleek btn-sleek-primary">
          + New Sequence
        </Link>
      </div>

      {error && <div className="alert-danger">{error}</div>}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
          Loading sequences...
        </div>
      ) : sequences.length === 0 ? (
        <div className="card" style={{ padding: '48px', textAlign: 'center' }}>
          <h3 style={{ marginBottom: '8px' }}>No Sequences Yet</h3>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '20px' }}>
            Sequences contain the scheduled WhatsApp messages sent in order when a trigger keyword is matched.
          </p>
          <Link href="/sequences/new" className="btn btn-primary">
            Create Your First Sequence
          </Link>
        </div>
      ) : (
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>Sequence Name</th>
                <th>Description</th>
                <th>Steps</th>
                <th>Created</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sequences.map((seq) => (
                <tr key={seq.id}>
                  <td>
                    <Link href={`/sequences/${seq.id}/edit`} style={{ fontWeight: 600, fontSize: '1rem' }}>
                      {seq.name}
                    </Link>
                  </td>
                  <td style={{ color: 'var(--text-secondary)', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {seq.description || 'No description'}
                  </td>
                  <td>
                    <span className="badge badge-info">{seq.steps?.length || 0} step(s)</span>
                  </td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                    {new Date(seq.created_at).toLocaleDateString()}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                      <Link href={`/sequences/${seq.id}/edit`} className="btn btn-secondary btn-sm">
                        Edit
                      </Link>
                      <button onClick={() => handleDelete(seq.id)} className="btn btn-danger btn-sm">
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </DashboardLayout>
  );
}
