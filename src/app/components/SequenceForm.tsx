'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

export interface FormStep {
  message_type: 'text' | 'image' | 'video' | 'document' | 'audio';
  message_body?: string;
  media_url?: string;
  media_filename?: string;
  caption?: string;
  delay_seconds: number;
  delay_min_seconds: number;
  delay_max_seconds: number;
}

interface SequenceFormProps {
  initialData?: {
    name: string;
    description: string;
    steps: FormStep[];
  };
  onSave: (data: { name: string; description: string; steps: FormStep[] }) => Promise<void>;
  isSaving: boolean;
}

export default function SequenceForm({ initialData, onSave, isSaving }: SequenceFormProps) {
  const router = useRouter();
  const [name, setName] = useState(initialData?.name || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [steps, setSteps] = useState<FormStep[]>(initialData?.steps || []);
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAddStep = () => {
    setSteps((prev) => [
      ...prev,
      {
        message_type: 'text',
        message_body: '',
        media_url: '',
        media_filename: '',
        caption: '',
        delay_seconds: 0,
        delay_min_seconds: 0,
        delay_max_seconds: 0,
      },
    ]);
  };

  const handleRemoveStep = (index: number) => {
    setSteps((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    setSteps((prev) => {
      const next = [...prev];
      const temp = next[index];
      next[index] = next[index - 1];
      next[index - 1] = temp;
      return next;
    });
  };

  const handleMoveDown = (index: number) => {
    if (index === steps.length - 1) return;
    setSteps((prev) => {
      const next = [...prev];
      const temp = next[index];
      next[index] = next[index + 1];
      next[index + 1] = temp;
      return next;
    });
  };

  const handleUpdateStep = (index: number, field: keyof FormStep, value: any) => {
    setSteps((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleFileChange = async (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingIndex(index);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        throw new Error('Upload failed');
      }

      const data = await res.json();
      handleUpdateStep(index, 'media_url', data.url);
      handleUpdateStep(index, 'media_filename', data.filename);
    } catch (err: any) {
      setError(`Upload failed for step ${index + 1}: ${err.message}`);
    } finally {
      setUploadingIndex(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Sequence name is required.');
      return;
    }

    if (steps.length === 0) {
      setError('Add at least one step to save the sequence.');
      return;
    }

    // Validate steps
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      if (step.message_type === 'text' && !step.message_body?.trim()) {
        setError(`Step ${i + 1} has an empty message body.`);
        return;
      }
      if (step.message_type !== 'text' && !step.media_url) {
        setError(`Step ${i + 1} requires a media file to be uploaded.`);
        return;
      }
    }

    try {
      await onSave({ name, description, steps });
    } catch (err: any) {
      setError(err.message || 'Failed to save sequence');
    }
  };

  const delayOptions = [
    { label: 'Instant (0s)', value: 0 },
    { label: '10 seconds', value: 10 },
    { label: '30 seconds', value: 30 },
    { label: '1 minute', value: 60 },
    { label: '2 minutes', value: 120 },
    { label: '5 minutes', value: 300 },
    { label: '15 minutes', value: 900 },
    { label: '30 minutes', value: 1800 },
    { label: '1 hour', value: 3600 },
    { label: '2 hours', value: 7200 },
    { label: '24 hours', value: 86400 },
  ];

  return (
    <form onSubmit={handleSubmit}>
      {error && <div className="alert-danger">{error}</div>}

      <div className="card">
        <div className="card-header">
          <h3>Sequence Information</h3>
        </div>
        <div className="card-body">
          <div className="form-group">
            <label className="form-label" htmlFor="seq-name">Sequence Name</label>
            <input
              id="seq-name"
              type="text"
              required
              placeholder="e.g. Onboarding Sequence, Promo Sequence"
              className="form-control"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="seq-desc">Description</label>
            <textarea
              id="seq-desc"
              placeholder="Explain what this sequence does..."
              className="form-control"
              style={{ minHeight: '60px' }}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3>Sequence Steps ({steps.length})</h3>
        <button type="button" onClick={handleAddStep} className="btn btn-secondary btn-sm">
          + Add Step
        </button>
      </div>

      {steps.length === 0 ? (
        <div className="card" style={{ padding: '32px', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-secondary)' }}>No steps added yet. Click "+ Add Step" to begin.</p>
        </div>
      ) : (
        <div>
          {steps.map((step, idx) => (
            <div key={idx} className="builder-step">
              <div className="builder-step-header">
                <span className="builder-step-num">Step {idx + 1}</span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => handleMoveUp(idx)}
                    disabled={idx === 0}
                    className="btn btn-secondary btn-sm"
                    style={{ padding: '4px 8px' }}
                    title="Move Up"
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMoveDown(idx)}
                    disabled={idx === steps.length - 1}
                    className="btn btn-secondary btn-sm"
                    style={{ padding: '4px 8px' }}
                    title="Move Down"
                  >
                    ▼
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemoveStep(idx)}
                    className="btn btn-danger btn-sm"
                    style={{ padding: '4px 8px' }}
                  >
                    Delete
                  </button>
                </div>
              </div>

              <div className="grid-2" style={{ marginBottom: '12px' }}>
                <div className="form-group">
                  <label className="form-label">Message Type</label>
                  <select
                    className="form-control"
                    value={step.message_type}
                    onChange={(e) => handleUpdateStep(idx, 'message_type', e.target.value)}
                  >
                    <option value="text">Text Message</option>
                    <option value="image">📷 Image</option>
                    <option value="video">🎥 Video</option>
                    <option value="audio">🎵 Audio</option>
                    <option value="document">📄 Document / PDF</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Delay Range (Min to Max seconds)</label>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input
                      type="number"
                      min="0"
                      placeholder="Min delay"
                      className="form-control"
                      value={step.delay_min_seconds ?? 0}
                      onChange={(e) => handleUpdateStep(idx, 'delay_min_seconds', parseInt(e.target.value) || 0)}
                      style={{ width: '45%' }}
                    />
                    <span>to</span>
                    <input
                      type="number"
                      min="0"
                      placeholder="Max delay"
                      className="form-control"
                      value={step.delay_max_seconds ?? 0}
                      onChange={(e) => handleUpdateStep(idx, 'delay_max_seconds', parseInt(e.target.value) || 0)}
                      style={{ width: '45%' }}
                    />
                  </div>
                </div>
              </div>

              {step.message_type === 'text' ? (
                <div className="form-group">
                  <label className="form-label">Message Content</label>
                  <textarea
                    required
                    placeholder="Enter your message here..."
                    className="form-control"
                    value={step.message_body || ''}
                    onChange={(e) => handleUpdateStep(idx, 'message_body', e.target.value)}
                  />
                </div>
              ) : (
                <div>
                  <div className="form-group">
                    <label className="form-label">Upload File</label>
                    <div className="upload-zone" style={{ position: 'relative' }}>
                      <input
                        type="file"
                        className="form-control"
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: '100%',
                          height: '100%',
                          opacity: 0,
                          cursor: 'pointer',
                        }}
                        onChange={(e) => handleFileChange(idx, e)}
                        disabled={uploadingIndex === idx}
                      />
                      <div className="upload-text">
                        {uploadingIndex === idx ? (
                          <span>Uploading file...</span>
                        ) : step.media_filename ? (
                          <span>📄 {step.media_filename} (Click to replace)</span>
                        ) : (
                          <span>📁 Click or drag file here to upload</span>
                        )}
                      </div>
                    </div>
                    {step.media_url && (
                      <div className="upload-preview">
                        <span>Public Link:</span>
                        <a href={step.media_url} target="_blank" rel="noreferrer" style={{ wordBreak: 'break-all' }}>
                          {step.media_url}
                        </a>
                      </div>
                    )}
                  </div>

                  <div className="form-group">
                    <label className="form-label">Caption (Optional)</label>
                    <input
                      type="text"
                      placeholder="Add caption to media..."
                      className="form-control"
                      value={step.caption || ''}
                      onChange={(e) => handleUpdateStep(idx, 'caption', e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
        <button type="button" onClick={() => router.push('/sequences')} className="btn btn-secondary">
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={isSaving || uploadingIndex !== null}>
          {isSaving ? 'Saving...' : 'Save Sequence'}
        </button>
      </div>
    </form>
  );
}
