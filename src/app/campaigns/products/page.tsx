'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import DashboardLayout from '@/app/components/DashboardLayout';
import CsvImporter from '@/app/components/CsvImporter';

interface Product {
  id: string;
  name: string;
  caption: string;
  media_url: string;
  media_type: string;
  created_at: string;
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [mediaTypeFilter, setMediaTypeFilter] = useState('all');

  // Modal states
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  
  // Form states
  const [editProductId, setEditProductId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [caption, setCaption] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaType, setMediaType] = useState('text');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/products');
      if (!res.ok) throw new Error('Failed to load products');
      const data = await res.json();
      setProducts(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    setModalMode('create');
    setEditProductId(null);
    setName('');
    setCaption('');
    setMediaUrl('');
    setMediaType('text');
    setFormError(null);
    setIsProductModalOpen(true);
  };

  const openEditModal = (product: Product) => {
    setModalMode('edit');
    setEditProductId(product.id);
    setName(product.name);
    setCaption(product.caption || '');
    setMediaUrl(product.media_url || '');
    setMediaType(product.media_type || 'text');
    setFormError(null);
    setIsProductModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this product? Campaigns using it might fail to send.')) {
      return;
    }

    try {
      const res = await fetch(`/api/products/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete product');
      setProducts((prev) => prev.filter((p) => p.id !== id));
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setFormError('Product name is required');
      return;
    }

    setSubmitting(true);
    setFormError(null);

    try {
      const url = modalMode === 'create' ? '/api/products' : `/api/products/${editProductId}`;
      const method = modalMode === 'create' ? 'POST' : 'PUT';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          caption,
          media_url: mediaUrl || null,
          media_type: mediaType,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to save product');
      }

      setIsProductModalOpen(false);
      fetchProducts();
    } catch (err: any) {
      setFormError(err.message || 'Failed to save product');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCsvImportSuccess = (count: number) => {
    setIsCsvModalOpen(false);
    fetchProducts();
    alert(`Successfully imported ${count} products!`);
  };

  const filteredProducts = products.filter((p) => {
    if (mediaTypeFilter === 'all') return true;
    return p.media_type === mediaTypeFilter;
  });

  return (
    <DashboardLayout>
      <div className="page-header">
        <div className="page-title">
          <h2>WhatsApp Campaigns</h2>
          <p>Manage WhatsApp groups, product catalogs, and scheduled broadcasts</p>
        </div>
      </div>

      <div className="tab-nav">
        <Link href="/campaigns" className="tab-link">
          Campaigns
        </Link>
        <Link href="/campaigns/groups" className="tab-link">
          Groups
        </Link>
        <Link href="/campaigns/products" className="tab-link active">
          Products
        </Link>
      </div>

      <div className="card">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '16px',
            marginBottom: '20px',
          }}
        >
          <div>
            <h3>Product Library</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              Add individual products or upload catalogs in bulk to use in campaign broadcasts
            </p>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button className="btn btn-secondary" onClick={() => setIsCsvModalOpen(true)}>
              📥 Import CSV
            </button>
            <button className="btn btn-primary" onClick={openCreateModal}>
              + Add Product
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '20px',
            padding: '12px',
            borderRadius: '6px',
            backgroundColor: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid var(--border-color)',
          }}
        >
          <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Filter Type:</span>
          <select
            className="form-control"
            style={{ width: '180px', padding: '6px 12px' }}
            value={mediaTypeFilter}
            onChange={(e) => setMediaTypeFilter(e.target.value)}
          >
            <option value="all">All Media Types</option>
            <option value="text">Text Only</option>
            <option value="image">Image</option>
            <option value="video">Video</option>
            <option value="audio">Audio</option>
            <option value="document">Document</option>
          </select>
        </div>

        {error && <div className="alert-danger">{error}</div>}

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
            Loading products...
          </div>
        ) : filteredProducts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-secondary)' }}>
            {products.length === 0 ? (
              <>
                <h3 style={{ marginBottom: '8px' }}>No Products Yet</h3>
                <p style={{ color: 'var(--text-muted)', marginBottom: '20px', fontSize: '0.9rem' }}>
                  Create or import products to build your campaigns.
                </p>
                <button className="btn btn-primary" onClick={openCreateModal}>
                  Create Your First Product
                </button>
              </>
            ) : (
              <p>No products match the selected media type filter.</p>
            )}
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Product Name</th>
                  <th>Media Type</th>
                  <th>Caption / Message Body</th>
                  <th>Media URL</th>
                  <th>Created</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((product) => (
                  <tr key={product.id}>
                    <td style={{ fontWeight: 600 }}>{product.name}</td>
                    <td>
                      <span className="badge badge-info">{product.media_type}</span>
                    </td>
                    <td
                      style={{
                        color: 'var(--text-secondary)',
                        maxWidth: '250px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                      title={product.caption || ''}
                    >
                      {product.caption || '—'}
                    </td>
                    <td
                      style={{
                        maxWidth: '200px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {product.media_url ? (
                        <a
                          href={product.media_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ fontSize: '0.85rem' }}
                        >
                          🔗 View Link
                        </a>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>—</span>
                      )}
                    </td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                      {new Date(product.created_at).toLocaleDateString()}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => openEditModal(product)}>
                          Edit
                        </button>
                        <button className="btn btn-danger btn-sm" onClick={() => handleDelete(product.id)}>
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
      </div>

      {/* CSV Import Modal */}
      {isCsvModalOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: '550px',
              padding: '24px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0 }}>Import Catalog via CSV</h3>
              <button
                type="button"
                onClick={() => setIsCsvModalOpen(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  fontSize: '1.5rem',
                  cursor: 'pointer',
                }}
              >
                &times;
              </button>
            </div>
            <CsvImporter
              onImport={handleCsvImportSuccess}
              onClose={() => setIsCsvModalOpen(false)}
            />
          </div>
        </div>
      )}

      {/* Product Create/Edit Modal */}
      {isProductModalOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: '500px',
              padding: '24px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0 }}>
                {modalMode === 'create' ? 'Add Product' : 'Edit Product'}
              </h3>
              <button
                type="button"
                onClick={() => setIsProductModalOpen(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  fontSize: '1.5rem',
                  cursor: 'pointer',
                }}
              >
                &times;
              </button>
            </div>

            {formError && <div className="alert-danger">{formError}</div>}

            <form onSubmit={handleFormSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label">Product Name *</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Smart Watch Model X"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Media Type</label>
                <select
                  className="form-control"
                  value={mediaType}
                  onChange={(e) => setMediaType(e.target.value)}
                >
                  <option value="text">Text (No attachment)</option>
                  <option value="image">Image</option>
                  <option value="video">Video</option>
                  <option value="audio">Audio</option>
                  <option value="document">Document</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Caption / Message Body</label>
                <textarea
                  className="form-control"
                  placeholder="Enter the message text to send..."
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  rows={4}
                />
              </div>

              {mediaType !== 'text' && (
                <div className="form-group">
                  <label className="form-label">Media URL *</label>
                  <input
                    type="url"
                    className="form-control"
                    placeholder="https://example.com/file.jpg"
                    value={mediaUrl}
                    onChange={(e) => setMediaUrl(e.target.value)}
                    required={mediaType !== 'text'}
                  />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                    Provide a direct URL to the media file. File storage will not upload files.
                  </span>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsProductModalOpen(false)}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Saving...' : 'Save Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
