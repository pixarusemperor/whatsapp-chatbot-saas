'use client';

import React, { useState, useEffect, useCallback } from 'react';

interface CampaignEvent {
  id: string;
  group_name: string;
  group_jid: string;
  product_name: string;
  scheduled_at: string;
  actual_sent_at: string | null;
  status: string;
  api_status_code: number | null;
  error_message: string | null;
  api_response: string | null;
}

interface CampaignEventLogProps {
  campaignId: string;
}

export default function CampaignEventLog({ campaignId }: CampaignEventLogProps) {
  const [events, setEvents] = useState<CampaignEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const [limit] = useState(10); // Display 10 per page in UI log
  const [total, setTotal] = useState(0);
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      let url = `/api/campaigns/${campaignId}/events?status=${statusFilter}&page=${page}&limit=${limit}`;
      if (searchTerm) {
        url += `&search=${encodeURIComponent(searchTerm)}`;
      }
      if (startDate) {
        url += `&startDate=${encodeURIComponent(new Date(startDate).toISOString())}`;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        url += `&endDate=${encodeURIComponent(end.toISOString())}`;
      }
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to load campaign events');
      const data = await res.json();
      setEvents(data.events);
      setTotal(data.total);
    } catch (err: any) {
      setError(err.message || 'Failed to load events');
    } finally {
      setLoading(false);
    }
  }, [campaignId, statusFilter, page, limit, searchTerm, startDate, endDate]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const handleFilterChange = (newStatus: string) => {
    setStatusFilter(newStatus);
    setPage(1); // Reset to first page
  };

  const getEventBadgeClass = (s: string) => {
    switch (s.toLowerCase()) {
      case 'sent': return 'badge-success';
      case 'failed': return 'badge-danger';
      case 'sending': return 'badge-info';
      case 'pending': return 'badge-secondary';
      case 'cancelled': return 'badge-secondary';
      default: return 'badge-secondary';
    }
  };

  const totalPages = Math.ceil(total / limit);

  const formatApiResponse = (res: string | null) => {
    if (!res) return '—';
    try {
      return JSON.stringify(JSON.parse(res), null, 2);
    } catch {
      return res;
    }
  };

  return (
    <div className="campaign-event-log-container" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3>Broadcast Logs</h3>
          <button className="btn btn-secondary btn-sm" onClick={fetchEvents} disabled={loading}>
            🔄 Refresh
          </button>
        </div>
        
        {/* Filters Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            flexWrap: 'wrap',
            padding: '10px',
            backgroundColor: 'rgba(255, 255, 255, 0.01)',
            borderRadius: '4px',
            border: '1px solid var(--border-color)',
          }}
        >
          <input
            type="text"
            className="form-control"
            style={{ flex: '1 1 180px', minWidth: '150px', padding: '4px 8px', fontSize: '0.85rem' }}
            placeholder="Search group..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(1);
            }}
          />
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Status:</span>
            <select
              className="form-control"
              style={{ width: '110px', padding: '4px 8px', fontSize: '0.85rem' }}
              value={statusFilter}
              onChange={(e) => handleFilterChange(e.target.value)}
            >
              <option value="all">All</option>
              <option value="pending">Pending</option>
              <option value="sending">Sending</option>
              <option value="sent">Sent</option>
              <option value="failed">Failed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Start:</span>
            <input
              type="date"
              className="form-control"
              style={{ width: '120px', padding: '4px 8px', fontSize: '0.85rem' }}
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPage(1);
              }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>End:</span>
            <input
              type="date"
              className="form-control"
              style={{ width: '120px', padding: '4px 8px', fontSize: '0.85rem' }}
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPage(1);
              }}
            />
          </div>
        </div>
      </div>

      {error && <div className="alert-danger">{error}</div>}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-secondary)' }}>
          Loading event logs...
        </div>
      ) : events.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
          No send events found matching the filter.
        </div>
      ) : (
        <>
          <div className="table-responsive">
            <table className="table" style={{ fontSize: '0.9rem' }}>
              <thead>
                <tr>
                  <th style={{ width: '40px' }}>#</th>
                  <th>Target Group</th>
                  <th>Product</th>
                  <th>Scheduled At</th>
                  <th>Sent At</th>
                  <th>Status</th>
                  <th>HTTP Code</th>
                  <th>Error Message</th>
                  <th style={{ width: '50px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event, index) => {
                  const displayIndex = (page - 1) * limit + index + 1;
                  const isExpanded = expandedEventId === event.id;
                  return (
                    <React.Fragment key={event.id}>
                      <tr 
                        onClick={() => setExpandedEventId(isExpanded ? null : event.id)}
                        style={{ cursor: 'pointer', transition: 'background 0.2s' }}
                      >
                        <td style={{ color: 'var(--text-muted)' }}>{displayIndex}</td>
                        <td>
                          <div style={{ fontWeight: 500 }}>{event.group_name || 'Unnamed Group'}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{event.group_jid}</div>
                        </td>
                        <td>{event.product_name}</td>
                        <td style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                          {new Date(event.scheduled_at).toLocaleString()}
                        </td>
                        <td style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                          {event.actual_sent_at ? new Date(event.actual_sent_at).toLocaleString() : '—'}
                        </td>
                        <td>
                          <span className={`badge ${getEventBadgeClass(event.status)}`}>
                            {event.status}
                          </span>
                        </td>
                        <td style={{ fontFamily: 'monospace', textAlign: 'center' }}>
                          {event.api_status_code !== null ? event.api_status_code : '—'}
                        </td>
                        <td style={{ color: 'var(--color-danger)', fontSize: '0.8rem', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={event.error_message || ''}>
                          {event.error_message || '—'}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <button 
                            className="btn btn-secondary btn-sm" 
                            style={{ padding: '2px 6px', fontSize: '0.75rem' }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedEventId(isExpanded ? null : event.id);
                            }}
                          >
                            {isExpanded ? 'Hide' : 'Show'}
                          </button>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr style={{ backgroundColor: 'rgba(255, 255, 255, 0.015)' }}>
                          <td colSpan={9} style={{ padding: '16px 24px', borderTop: 'none' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', borderLeft: '3px solid var(--color-primary)', paddingLeft: '16px' }}>
                              <div>
                                <h5 style={{ margin: '0 0 6px 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>API Payload & Response</h5>
                                <pre style={{ margin: 0, padding: '10px', background: 'rgba(0, 0, 0, 0.3)', borderRadius: '4px', whiteSpace: 'pre-wrap', fontSize: '0.8rem', fontFamily: 'monospace', color: '#e5e7eb', border: '1px solid rgba(255,255,255,0.05)' }}>
                                  {formatApiResponse(event.api_response)}
                                </pre>
                              </div>
                              {event.error_message && (
                                <div>
                                  <h5 style={{ margin: '0 0 4px 0', fontSize: '0.85rem', color: 'var(--color-danger)' }}>Full Error Message</h5>
                                  <div style={{ color: 'var(--color-danger)', fontSize: '0.85rem', fontFamily: 'monospace', padding: '8px', background: 'rgba(220, 38, 38, 0.05)', borderRadius: '4px', border: '1px solid rgba(220,38,38,0.1)' }}>
                                    {event.error_message}
                                  </div>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '16px', marginTop: '12px' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Page <strong>{page}</strong> of <strong>{totalPages}</strong> (Total: {total})
              </span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  Previous
                </button>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
