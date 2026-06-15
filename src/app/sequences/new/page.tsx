'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/app/components/DashboardLayout';
import SequenceForm, { FormStep } from '@/app/components/SequenceForm';

export default function NewSequencePage() {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async (formData: { name: string; description: string; steps: FormStep[] }) => {
    setIsSaving(true);
    try {
      const res = await fetch('/api/sequences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || 'Failed to create sequence');
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
            <h2>Create New Sequence</h2>
            <p>Define a set of automated WhatsApp replies with timing delays</p>
          </div>
        </div>

        <SequenceForm onSave={handleSave} isSaving={isSaving} />
      </div>
    </DashboardLayout>
  );
}
