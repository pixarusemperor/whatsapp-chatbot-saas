'use client';

import React, { useEffect, useState } from 'react';
import DashboardLayout from '@/app/components/DashboardLayout';
import { supabase } from '@/lib/supabase';

interface SendJob {
  id: string;
  current_step: number;
  total_steps: number;
  status: 'running' | 'completed' | 'failed';
  error_message?: string;
}

interface Message {
  id: string;
  instance_id: string;
  sender_number: string;
  sender_name: string;
  message_body: string;
  message_type: string;
  matched_keyword: string;
  triggered_sequence_id: string;
  trigger_status: 'none' | 'running' | 'completed' | 'failed';
  raw_payload?: any;
  received_at: string;
  wf_sequences?: {
    name: string;
  };
  wf_send_jobs?: SendJob[];
}

interface Instance {
  id: string;
  name: string;
  phone: string;
}

export default function InboxPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [instances, setInstances] = useState<Instance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedInstance, setSelectedInstance] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedMessagePayload, setSelectedMessagePayload] = useState<any | null>(null);

  // Pagination & Debounce States
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 25;

  const [debouncedSearch, setDebouncedSearch] = useState(searchQuery);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 400);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Dynamically extract all unique instance/session IDs from messages
  const messageInstanceIds = React.useMemo(() => {
    return Array.from(new Set(messages.map((m) => m.instance_id).filter(Boolean)));
  }, [messages]);

  const allFilterSessions = React.useMemo(() => {
    const list = [...instances];
    messageInstanceIds.forEach((id) => {
      if (!list.some((inst) => inst.id === id)) {
        list.push({
          id,
          name: `Session: ${id}`,
          phone: 'Inactive/Mock'
        });
      }
    });
    return list;
  }, [instances, messageInstanceIds]);

  const fetchInbox = async () => {
    try {
      const queryParams = new URLSearchParams({
        page: String(currentPage),
        limit: String(pageSize),
        search: debouncedSearch,
        instance_id: selectedInstance,
        start_date: startDate,
        end_date: endDate
      });
      const res = await fetch(`/api/inbox?${queryParams.toString()}`);
      if (!res.ok) throw new Error('Failed to load inbox logs');
      const data = await res.json();
      setMessages(data.messages || []);
      setTotalCount(data.count || 0);
    } catch (err: any) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchInstances = async () => {
    try {
      const res = await fetch('/api/instances');
      if (res.ok) {
        const data = await res.json();
        setInstances(data);
      }
    } catch (err) {
      console.warn('Failed to load sessions/instances:', err);
    }
  };

  useEffect(() => {
    fetchInstances();

    // Subscribe to real-time updates for public.wf_messages and public.wf_send_jobs
    const channel = supabase
      .channel('inbox-db-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'wf_messages' },
        () => {
          console.log('Realtime database update in wf_messages detected, reloading inbox...');
          fetchInbox();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'wf_send_jobs' },
        () => {
          console.log('Realtime database update in wf_send_jobs detected, reloading inbox...');
          fetchInbox();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Fetch inbox records when search parameters or current page changes
  useEffect(() => {
    fetchInbox();
  }, [debouncedSearch, selectedInstance, startDate, endDate, currentPage]);

  // Reset page to 1 when filters are changed
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, selectedInstance, startDate, endDate]);

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedInstance('');
    setStartDate('');
    setEndDate('');
  };

  // Messages are filtered on the server side
  const filteredMessages = messages;

  // Recursive utility to flatten deeply nested JSON payloads into dot-notated objects
  const flattenObject = (obj: any, prefix = ''): Record<string, string> => {
    let result: Record<string, string> = {};
    
    // Safety check for stringified JSON payloads
    let parsedObj = obj;
    if (typeof obj === 'string') {
      try {
        const parsed = JSON.parse(obj);
        if (parsed && typeof parsed === 'object') {
          parsedObj = parsed;
        }
      } catch (e) {
        // Fall back to treating as a regular string
        result[prefix] = obj;
        return result;
      }
    }

    if (parsedObj === null || parsedObj === undefined) {
      return result;
    }

    if (typeof parsedObj !== 'object') {
      result[prefix] = String(parsedObj);
      return result;
    }

    if (Array.isArray(parsedObj)) {
      result[prefix] = JSON.stringify(parsedObj);
      return result;
    }

    for (const key in parsedObj) {
      if (Object.prototype.hasOwnProperty.call(parsedObj, key)) {
        const value = parsedObj[key];
        const newKey = prefix ? `${prefix}.${key}` : key;
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          result = { ...result, ...flattenObject(value, newKey) };
        } else if (Array.isArray(value)) {
          result[newKey] = JSON.stringify(value);
        } else {
          result[newKey] = value !== null && value !== undefined ? String(value) : '';
        }
      }
    }
    return result;
  };

  const handleExportCSV = async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams({
        export: 'true',
        search: searchQuery,
        instance_id: selectedInstance,
        start_date: startDate,
        end_date: endDate
      });
      const res = await fetch(`/api/inbox?${queryParams.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch inbox records for export');
      const data = await res.json();
      const exportMessages = data.messages || [];

      if (exportMessages.length === 0) {
        alert('No messages found matching current filters to export.');
        return;
      }

      const headersSet = new Set<string>([
        'session_id',
        'session_name',
        'session_phone',
        'sender_number',
        'sender_name',
        'received_at',
        'message_body',
        'message_type',
        'matched_keyword',
        'trigger_status',
        'sequence'
      ]);

      const processedRows = exportMessages.map((msg: any) => {
        const sessionInfo = allFilterSessions.find((inst) => inst.id === msg.instance_id);
        const sessionName = sessionInfo?.name || 'Unknown';
        const sessionPhone = sessionInfo?.phone || 'Unknown';

        const baseData: Record<string, string> = {
          session_id: msg.instance_id,
          session_name: sessionName,
          session_phone: sessionPhone,
          sender_number: msg.sender_number,
          sender_name: msg.sender_name || '',
          received_at: msg.received_at,
          message_body: msg.message_body || '',
          message_type: msg.message_type,
          matched_keyword: msg.matched_keyword || '',
          trigger_status: msg.trigger_status,
          sequence: msg.wf_sequences?.name || ''
        };

        let flattenedPayload: Record<string, string> = {};
        if (msg.raw_payload) {
          flattenedPayload = flattenObject(msg.raw_payload, 'payload');
          Object.keys(flattenedPayload).forEach((k) => headersSet.add(k));
        }

        return { ...baseData, ...flattenedPayload };
      });

      const headers = Array.from(headersSet);

      const csvRows = processedRows.map((row: any) => {
        return headers.map((header) => {
          const rawVal = row[header];
          const val = rawVal !== undefined && rawVal !== null ? String(rawVal) : '';
          if (val.includes(',') || val.includes('"') || val.includes('\n') || val.includes('\r')) {
            return `"${val.replace(/"/g, '""')}"`;
          }
          return val;
        }).join(',');
      });

      const csvContent = [
        headers.join(','),
        ...csvRows
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `watsflow-inbox-export-${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      console.error(err);
      setError('Failed to export: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'running':
        return <span className="badge badge-warning">⏳ Running</span>;
      case 'completed':
        return <span className="badge badge-success">✅ Completed</span>;
      case 'failed':
        return <span className="badge badge-danger">❌ Failed</span>;
      default:
        return <span className="badge badge-secondary">No Match</span>;
    }
  };

  const renderProgressDots = (job?: SendJob) => {
    if (!job) return null;
    const dots = [];
    const total = job.total_steps;
    const current = job.current_step;
    const status = job.status;

    for (let i = 0; i < total; i++) {
      let dotClass = 'job-step-dot';
      if (i < current) {
        dotClass += ' completed';
      } else if (i === current && status === 'running') {
        dotClass += ' active';
      }
      dots.push(
        <div
          key={i}
          className={dotClass}
          title={`Step ${i + 1}: ${i < current ? 'Sent' : i === current && status === 'running' ? 'Sending...' : 'Pending'}`}
        />
      );
    }

    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginRight: '4px' }}>
          Steps ({current}/{total}):
        </span>
        <div className="job-jobs-container" style={{ display: 'flex', gap: '4px' }}>
          {dots}
        </div>
      </div>
    );
  };

  return (
    <DashboardLayout>
      <div className="page-header">
        <div className="page-title">
          <h2>Incoming Chats & Inbox</h2>
          <p>Monitor incoming WhatsApp messages and tracking execution of matched sequences</p>
        </div>
      </div>

      {error && <div className="alert-danger">{error}</div>}

      {/* Realtime Search & Filter Card */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div className="card-body" style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'flex-end' }}>
          <div className="form-group" style={{ flex: '2 1 250px', marginBottom: 0 }}>
            <label className="form-label" style={{ fontSize: '0.85rem' }}>Search phone, name, body or keyword</label>
            <input
              type="text"
              className="form-control"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="form-group" style={{ flex: '1 1 200px', marginBottom: 0 }}>
            <label className="form-label" style={{ fontSize: '0.85rem' }}>WhatsApp Session / Device</label>
            <select
              className="form-control"
              value={selectedInstance}
              onChange={(e) => setSelectedInstance(e.target.value)}
            >
              <option value="">All Sessions/Devices</option>
              {allFilterSessions.map((inst) => (
                <option key={inst.id} value={inst.id}>
                  {inst.name || 'WhatsApp Device'} ({inst.phone})
                </option>
              ))}
            </select>
          </div>
          <div className="form-group" style={{ flex: '1 1 150px', marginBottom: 0 }}>
            <label className="form-label" style={{ fontSize: '0.85rem' }}>Start Date</label>
            <input
              type="date"
              className="form-control"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="form-group" style={{ flex: '1 1 150px', marginBottom: 0 }}>
            <label className="form-label" style={{ fontSize: '0.85rem' }}>End Date</label>
            <input
              type="date"
              className="form-control"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
          <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
            {(searchQuery || selectedInstance || startDate || endDate) && (
              <button onClick={handleResetFilters} className="btn btn-secondary" style={{ padding: '8px 16px' }}>
                Reset
              </button>
            )}
            <button 
              onClick={handleExportCSV} 
              className="btn btn-primary" 
              style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '6px' }}
              disabled={totalCount === 0 || loading}
            >
              {loading ? '⏳ Fetching...' : `📥 Export CSV (${totalCount})`}
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
          Loading chat inbox...
        </div>
      ) : messages.length === 0 ? (
        <div className="card" style={{ padding: '48px', textAlign: 'center' }}>
          <h3>Inbox Empty</h3>
          <p style={{ color: 'var(--text-secondary)', marginTop: '8px' }}>
            Awaiting incoming messages from Wasender. Send a keyword message to test!
          </p>
        </div>
      ) : filteredMessages.length === 0 ? (
        <div className="card" style={{ padding: '48px', textAlign: 'center' }}>
          <h3>No matches found</h3>
          <p style={{ color: 'var(--text-secondary)', marginTop: '8px' }}>
            No messages match your search criteria. Try modifying your filters.
          </p>
        </div>
      ) : (
        <div className="inbox-layout">
          <div className="inbox-list">
            {filteredMessages.map((msg) => {
              const job = msg.wf_send_jobs && msg.wf_send_jobs.length > 0 ? msg.wf_send_jobs[0] : undefined;
              const sessionInfo = allFilterSessions.find((inst) => inst.id === msg.instance_id);
              const sessionName = sessionInfo?.name || 'Unknown';
              const sessionPhone = sessionInfo?.phone || 'Unknown';
              return (
                <div key={msg.id} className="inbox-item">
                  <div className="inbox-meta" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', flexWrap: 'wrap' }}>
                      <div>
                        <span className="inbox-sender">{msg.sender_name}</span>{' '}
                        <span style={{ color: 'var(--text-muted)' }}>({msg.sender_number})</span>
                      </div>
                      <span style={{ fontSize: '0.8rem' }}>
                        {new Date(msg.received_at).toLocaleDateString()} {new Date(msg.received_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    {/* Display session/device metadata details */}
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '2px' }}>
                      <span 
                        style={{ 
                          fontSize: '0.7rem', 
                          background: 'var(--color-bg-light, #1e293b)', 
                          color: 'var(--color-primary, #38bdf8)', 
                          padding: '2px 8px', 
                          borderRadius: '4px',
                          border: '1px solid var(--color-border, #334155)',
                        }}
                      >
                        Device: {sessionName}
                      </span>
                      <span 
                        style={{ 
                          fontSize: '0.7rem', 
                          background: 'var(--color-bg-light, #1e293b)', 
                          color: 'var(--color-primary, #38bdf8)', 
                          padding: '2px 8px', 
                          borderRadius: '4px',
                          border: '1px solid var(--color-border, #334155)',
                        }}
                      >
                        ID: {msg.instance_id}
                      </span>
                      <span 
                        style={{ 
                          fontSize: '0.7rem', 
                          background: 'var(--color-bg-light, #1e293b)', 
                          color: 'var(--color-primary, #38bdf8)', 
                          padding: '2px 8px', 
                          borderRadius: '4px',
                          border: '1px solid var(--color-border, #334155)',
                        }}
                      >
                        Phone: {sessionPhone}
                      </span>
                    </div>
                  </div>

                  <div className="inbox-body">
                    {msg.message_type !== 'text' && (
                      <span style={{ fontSize: '0.85rem', color: 'var(--color-primary)', display: 'block', marginBottom: '4px' }}>
                        📎 Received {msg.message_type} file
                      </span>
                    )}
                    {msg.message_body || <em style={{ color: 'var(--text-muted)' }}>Empty message body</em>}
                  </div>

                  <div className="inbox-status" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Workflow:</span>
                        {msg.triggered_sequence_id ? (
                          <strong style={{ color: '#ffffff', fontSize: '0.9rem' }}>
                            {msg.wf_sequences?.name || 'Loading sequence...'}
                          </strong>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No sequence triggered</span>
                        )}
                        {msg.matched_keyword && (
                          <span className="badge badge-secondary" style={{ fontSize: '0.7rem' }}>
                            Key: "{msg.matched_keyword}"
                          </span>
                        )}
                      </div>
                      {job && renderProgressDots(job)}
                      {job?.error_message && (
                        <div style={{ fontSize: '0.8rem', color: 'var(--color-danger)', marginTop: '4px' }}>
                          Error: {job.error_message}
                        </div>
                      )}
                      {msg.raw_payload && (
                        <button
                          type="button"
                          onClick={() => setSelectedMessagePayload(msg.raw_payload)}
                          style={{
                            alignSelf: 'flex-start',
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--color-primary)',
                            fontSize: '0.8rem',
                            cursor: 'pointer',
                            padding: 0,
                            marginTop: '6px',
                            textDecoration: 'underline'
                          }}
                        >
                          🔍 View Metadata
                        </button>
                      )}
                    </div>

                    <div>{getStatusBadge(msg.trigger_status)}</div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination Controls */}
          {totalCount > pageSize && (
            <div 
              style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                marginTop: '24px', 
                padding: '16px 20px', 
                background: '#0f172a', 
                border: '1px solid #334155', 
                borderRadius: '8px' 
              }}
            >
              <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
                Showing {(currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, totalCount)} of {totalCount} messages
              </span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="btn btn-secondary"
                  style={{ padding: '6px 12px', fontSize: '0.85rem' }}
                >
                  ◀ Previous
                </button>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(Math.ceil(totalCount / pageSize), prev + 1))}
                  disabled={currentPage >= Math.ceil(totalCount / pageSize)}
                  className="btn btn-secondary"
                  style={{ padding: '6px 12px', fontSize: '0.85rem' }}
                >
                  Next ▶
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Raw Payload Inspector Modal */}
      {selectedMessagePayload && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            background: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}
          onClick={() => setSelectedMessagePayload(null)}
        >
          <div 
            style={{
              width: '90%',
              maxWidth: '650px',
              background: '#0f172a',
              border: '1px solid #334155',
              borderRadius: '8px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
              display: 'flex',
              flexDirection: 'column',
              maxHeight: '85vh',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div 
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '16px 20px',
                borderBottom: '1px solid #1e293b'
              }}
            >
              <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#ffffff' }}>WhatsApp Raw Webhook Metadata</h3>
              <button 
                onClick={() => setSelectedMessagePayload(null)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#94a3b8',
                  fontSize: '1.5rem',
                  cursor: 'pointer',
                  lineHeight: 1
                }}
              >
                &times;
              </button>
            </div>
            <div style={{ padding: '20px', overflowY: 'auto' }}>
              <pre 
                style={{
                  margin: 0,
                  padding: '16px',
                  background: '#1e293b',
                  color: '#38bdf8',
                  borderRadius: '6px',
                  fontSize: '0.85rem',
                  overflowX: 'auto',
                  fontFamily: 'monospace',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all'
                }}
              >
                {JSON.stringify(selectedMessagePayload, null, 2)}
              </pre>
            </div>
            <div 
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                padding: '12px 20px',
                borderTop: '1px solid #1e293b'
              }}
            >
              <button 
                onClick={() => setSelectedMessagePayload(null)}
                className="btn btn-secondary"
                style={{ padding: '6px 12px', fontSize: '0.9rem' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

