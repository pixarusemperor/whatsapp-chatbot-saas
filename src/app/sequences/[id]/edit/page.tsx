'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import DashboardLayout from '@/app/components/DashboardLayout';
import SequenceForm, { FormStep } from '@/app/components/SequenceForm';

export default function EditSequencePage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [initialData, setInitialData] = useState<{
    name: string;
    description: string;
    steps: FormStep[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadSequence() {
      try {
        const res = await fetch(`/api/sequences/${id}`);
        if (!res.ok) {
          throw new Error('Failed to fetch sequence');
        }
        const data = await res.json();
        setInitialData({
          name: data.name || '',
          description: data.description || '',
          steps: data.steps || [],
        });
      } catch (err: any) {
        setError(err.message || 'Failed to load sequence');
      } finally {
        setLoading(false);
      }
    }
    loadSequence();
  }, [id]);

  const handleSave = async (formData: { name: string; description: string; steps: FormStep[] }) => {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/sequences/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || 'Failed to update sequence');
      }

      router.push('/sequences');
      router.refresh();
    } catch (err: any) {
      throw err;
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="container-wide">
        <div className="page-header">
          <div className="page-title">
            <h2>Edit Message Sequence</h2>
            <p>Modify sequence steps and response timing delays</p>
          </div>
        </div>

        {error && <div className="alert-danger">{error}</div>}

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
            Loading sequence data...
          </div>
        ) : initialData ? (
          <SequenceForm initialData={initialData} onSave={handleSave} isSaving={isSaving} />
        ) : (
          <div className="card" style={{ padding: '24px', textAlign: 'center' }}>
            <p style={{ color: 'var(--text-secondary)' }}>Sequence not found.</p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
