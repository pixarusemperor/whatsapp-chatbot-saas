'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import DashboardLayout from '@/app/components/DashboardLayout';
import ReadOnlySequenceCanvas from '@/components/flows/ReadOnlySequenceCanvas';
import type { WfStep } from '@/lib/flows/mappers';

export default function VisualSequencePage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const id = params.id;
  const variantName = searchParams.get('variant') || undefined;

  const [sequence, setSequence] = useState<{ name: string; steps: WfStep[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/sequences/${id}`);
        if (!res.ok) throw new Error('Failed to load sequence');
        const data = await res.json();
        setSequence({
          name: data.name || 'Untitled',
          steps: data.steps || data.wf_steps || [],
        });
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    if (id) load();
  }, [id]);

  if (loading) return <DashboardLayout><div className="p-8">Loading visual...</div></DashboardLayout>;
  if (error) return <DashboardLayout><div className="p-8 text-red-600">Error: {error}</div></DashboardLayout>;
  if (!sequence) return null;

  return (
    <DashboardLayout>
      <div className="p-4">
        <h1 className="text-xl font-semibold mb-4">Visual Preview (Read-only)</h1>
        <p className="text-sm text-gray-600 mb-4">
          This is a visual representation using the new typed mapper (Pocock style). 
          {variantName ? ` Showing variant: ${variantName}. ` : ' '}
          The sequence executes through the unified wf_* path with variant support.
        </p>
        <div className="border rounded bg-white" style={{ minHeight: 400 }}>
          <ReadOnlySequenceCanvas 
            steps={sequence.steps} 
            sequenceName={sequence.name} 
            variantName={variantName}
          />
        </div>
        <div className="mt-4">
          <a href={`/sequences/${id}/edit`} className="text-blue-600 hover:underline text-sm">
            ← Back to editor
          </a>
        </div>
      </div>
    </DashboardLayout>
  );
}
