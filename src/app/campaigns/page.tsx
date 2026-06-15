'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/app/components/DashboardLayout';

interface Campaign {
  id: string;
  name: string;
  campaign_type: number; // 1 = Bulk, 2 = Broadcast
  group_list_name: string;
  status: string;
  total_events: number;
  completed_events: number;
  failed_events: number;
  created_at: string;
}

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [sortBy, setSortBy] = useState('created');
  const router = useRouter();

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const fetchCampaigns = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/campaigns');
      if (!res.ok) throw new Error('Failed to load campaigns');
      const data = await res.json();
      setCampaigns(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load campaigns');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadgeClass = (s: string) => {
    switch (s.toLowerCase()) {
      case 'running': return 'badge-success';
      case 'completed': return 'badge-success';
      case 'paused': return 'badge-warning';
      case 'cancelled': return 'badge-secondary';
      case 'failed': return 'badge-danger';
      case 'scheduled': return 'badge-info';
      default: return 'badge-secondary';
    }
  };

  return (
    <DashboardLayout>
      <div className="page-header">
        <div className="page-title">
          <h2>WhatsApp Campaigns</h2>
          <p>Manage WhatsApp groups, product catalogs, and scheduled broadcasts</p>
        </div>
        <div>
          <Link href="/campaigns/new" className="btn btn-primary">
            + New Campaign
          </Link>
        </div>
      </div>

      <div className="tab-nav">
        <Link href="/campaigns" className="tab-link active">
          Campaigns
        </Link>
        <Link href="/campaigns/groups" className="tab-link">
          Groups
        </Link>
        <Link href="/campaigns/products" className="tab-link">
          Products
        </Link>
      </div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3>Broadcasting Campaigns</h3>
          <button className="btn btn-secondary btn-sm" onClick={fetchCampaigns} disabled={loading}>
            🔄 Refresh
          </button>
        </div>

        {/* Search & Filter Bar */}
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
            flexWrap: 'wrap',
          }}
        >
          <input
            type="text"
            className="form-control"
            style={{ flex: '1 1 200px', minWidth: '200px', padding: '6px 12px' }}
            placeholder="Search campaigns by name or target list..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Status:</span>
            <select
              className="form-control"
              style={{ width: '130px', padding: '6px 12px' }}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All Statuses</option>
              <option value="draft">Draft</option>
              <option value="scheduled">Scheduled</option>
              <option value="running">Running</option>
              <option value="paused">Paused</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
              <option value="failed">Failed</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Start:</span>
            <input
              type="date"
              className="form-control"
              style={{ width: '135px', padding: '6px 12px' }}
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>End:</span>
            <input
              type="date"
              className="form-control"
              style={{ width: '135px', padding: '6px 12px' }}
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Sort:</span>
            <select
              className="form-control"
              style={{ width: '130px', padding: '6px 12px' }}
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="created">Created Date</option>
              <option value="status">Status</option>
              <option value="progress">Progress</option>
            </select>
          </div>
        </div>

        {error && <div className="alert-danger">{error}</div>}

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
            Loading campaigns...
          </div>
        ) : campaigns.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-secondary)' }}>
            <h3 style={{ marginBottom: '8px' }}>No Campaigns Yet</h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: '20px', fontSize: '0.9rem' }}>
              Create a broadcast or bulk distribution campaign to start sending messages to your group lists.
            </p>
            <Link href="/campaigns/new" className="btn btn-primary">
              Create Your First Campaign
            </Link>
          </div>
        ) : (() => {
          const filteredCampaigns = campaigns.filter(c => {
            const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                  c.group_list_name.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesStatus = statusFilter === 'all' || c.status.toLowerCase() === statusFilter.toLowerCase();
            
            let matchesDate = true;
            if (startDate) {
              const start = new Date(startDate);
              start.setHours(0, 0, 0, 0);
              const created = new Date(c.created_at);
              matchesDate = matchesDate && created >= start;
            }
            if (endDate) {
              const end = new Date(endDate);
              end.setHours(23, 59, 59, 999);
              const created = new Date(c.created_at);
              matchesDate = matchesDate && created <= end;
            }
            
            return matchesSearch && matchesStatus && matchesDate;
          });

          if (filteredCampaigns.length === 0) {
            return (
              <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                No campaigns match the search filters.
              </div>
            );
          }

          const sortedCampaigns = [...filteredCampaigns].sort((a, b) => {
            if (sortBy === 'created') {
              return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
            }
            if (sortBy === 'status') {
              return a.status.localeCompare(b.status);
            }
            if (sortBy === 'progress') {
              const pctA = a.total_events > 0 ? (a.completed_events + a.failed_events) / a.total_events : 0;
              const pctB = b.total_events > 0 ? (b.completed_events + b.failed_events) / b.total_events : 0;
              return pctB - pctA;
            }
            return 0;
          });

          return (
            <div className="table-responsive">
              <table className="table" style={{ cursor: 'pointer' }}>
                <thead>
                  <tr>
                    <th>Campaign Name</th>
                    <th>Type</th>
                    <th>Target List</th>
                    <th>Status</th>
                    <th>Progress</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedCampaigns.map((camp) => {
                    const done = camp.completed_events + camp.failed_events;
                    const total = camp.total_events;
                    const pct = total > 0 ? Math.min(Math.round((done / total) * 100), 100) : 0;
                    return (
                      <tr key={camp.id} onClick={() => router.push(`/campaigns/${camp.id}`)}>
                        <td style={{ fontWeight: 600 }}>{camp.name}</td>
                        <td>
                          <span className={`badge ${camp.campaign_type === 1 ? 'badge-info' : 'badge-primary'}`}>
                            {camp.campaign_type === 1 ? 'Bulk Product' : 'Broadcast'}
                          </span>
                        </td>
                        <td style={{ color: 'var(--text-secondary)' }}>{camp.group_list_name}</td>
                        <td>
                          <span className={`badge ${getStatusBadgeClass(camp.status)}`}>
                            {camp.status.toUpperCase()}
                          </span>
                        </td>
                        <td style={{ width: '200px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div className="progress-bar" style={{ flex: 1, minWidth: '80px', height: '6px' }}>
                              <div className="progress-fill" style={{ width: `${pct}%` }} />
                            </div>
                            <span style={{ fontSize: '0.8rem', fontWeight: 500, minWidth: '60px', textAlign: 'right' }}>
                              {pct}% ({done}/{total})
                            </span>
                          </div>
                        </td>
                        <td style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                          {new Date(camp.created_at).toLocaleDateString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          );
        })()}
      </div>
    </DashboardLayout>
  );
}
