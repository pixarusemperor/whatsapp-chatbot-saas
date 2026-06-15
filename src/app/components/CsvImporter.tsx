'use client';

import React, { useState, useRef } from 'react';
import { parseCsvToProducts, ParsedProduct } from '@/lib/csv-parser';

interface CsvImporterProps {
  onImport: (count: number, batchId: string) => void;
  onClose: () => void;
}

export default function CsvImporter({ onImport, onClose }: CsvImporterProps) {
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [previewProducts, setPreviewProducts] = useState<ParsedProduct[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const processFile = async (selectedFile: File) => {
    if (!selectedFile.name.endsWith('.csv')) {
      setError('Please select a valid CSV file (.csv)');
      setFile(null);
      setPreviewProducts([]);
      return;
    }

    setError(null);
    setFile(selectedFile);

    try {
      const text = await selectedFile.text();
      const products = parseCsvToProducts(text);
      if (products.length === 0) {
        setError('No valid products found in this CSV. Make sure headers are name, caption, media_url, media_type.');
      } else {
        setPreviewProducts(products);
      }
    } catch (err: any) {
      setError('Failed to parse CSV file: ' + err.message);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await processFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      await processFile(e.target.files[0]);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const handleUpload = async () => {
    if (!file) return;
    setSubmitting(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/products', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to upload CSV file');
      }

      const result = await res.json();
      onImport(result.count, result.batchId);
    } catch (err: any) {
      setError(err.message || 'An error occurred during import');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="csv-importer-container" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Drop Zone */}
      {!file ? (
        <div
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          onClick={triggerFileInput}
          style={{
            border: dragActive ? '2px dashed var(--color-primary)' : '2px dashed var(--border-color)',
            borderRadius: '8px',
            padding: '40px 20px',
            textAlign: 'center',
            cursor: 'pointer',
            backgroundColor: dragActive ? 'rgba(16, 185, 129, 0.05)' : 'var(--bg-surface)',
            transition: 'all 0.2s ease',
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            style={{ display: 'none' }}
            onChange={handleChange}
          />
          <div style={{ fontSize: '2rem', marginBottom: '12px' }}>📥</div>
          <div style={{ fontWeight: 600, marginBottom: '4px' }}>Drag & Drop your CSV file here</div>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            or click to browse from your computer
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '12px' }}>
            Required headers: <code>name</code>. Optional: <code>caption</code>, <code>media_url</code>, <code>media_type</code>
          </div>
        </div>
      ) : (
        <div className="file-info card" style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 600 }}>📄 {file.name}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Size: {(file.size / 1024).toFixed(2)} KB • Found {previewProducts.length} rows to import
            </div>
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => {
              setFile(null);
              setPreviewProducts([]);
              setError(null);
            }}
            disabled={submitting}
          >
            Change File
          </button>
        </div>
      )}

      {error && (
        <div className="alert-danger" style={{ margin: '0' }}>
          ⚠️ {error}
        </div>
      )}

      {/* Preview Table */}
      {previewProducts.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <h4 style={{ fontSize: '0.95rem' }}>Preview Products (First 5 Rows)</h4>
          <div className="table-responsive" style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '6px' }}>
            <table className="table" style={{ fontSize: '0.85rem' }}>
              <thead>
                <tr>
                  <th>Product Name</th>
                  <th>Type</th>
                  <th>Caption</th>
                  <th>Media URL</th>
                </tr>
              </thead>
              <tbody>
                {previewProducts.slice(0, 5).map((p, idx) => (
                  <tr key={idx}>
                    <td style={{ fontWeight: 500 }}>{p.name}</td>
                    <td>
                      <span className="badge badge-secondary">{p.media_type}</span>
                    </td>
                    <td style={{ color: 'var(--text-secondary)', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p.caption || '—'}
                    </td>
                    <td style={{ color: 'var(--text-muted)', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p.media_url || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={onClose}
          disabled={submitting}
        >
          Cancel
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={handleUpload}
          disabled={!file || submitting || previewProducts.length === 0}
        >
          {submitting ? 'Importing...' : `Import ${previewProducts.length} Products`}
        </button>
      </div>
    </div>
  );
}
