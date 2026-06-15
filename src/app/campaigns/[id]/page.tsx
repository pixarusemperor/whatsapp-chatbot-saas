'use client';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/app/components/DashboardLayout';
import CampaignProgress from '@/app/components/CampaignProgress';
import CampaignEventLog from '@/app/components/CampaignEventLog';

interface CampaignDetail {
  id: string;
  name: string;
  campaign_type: number;
  instance_id: string;
  group_list_name: string;
  delay_min_seconds: number;
  delay_max_seconds: number;
  scheduled_start_at: string | null;
  start_jitter_seconds: number;
  status: string;
  total_events: number;
  completed_events: number;
  failed_events: number;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function CampaignDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const [campaign, setCampaign] = useState<CampaignDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submittingControl, setSubmittingControl] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    fetchCampaignDetail();
  }, [id]);

  // If running and auto-refresh is enabled, poll every 5s to refresh counters in UI
  useEffect(() => {
    if (!campaign || campaign.status !== 'running' || !autoRefresh) return;

    const interval = setInterval(() => {
      fetchCampaignDetail(true); // silent fetch
    }, 5000);

    return () => clearInterval(interval);
  }, [campaign?.status, autoRefresh]);

  const fetchCampaignDetail = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch(`/api/campaigns/${id}`);
      if (!res.ok) {
        if (res.status === 404) throw new Error('Campaign not found');
        throw new Error('Failed to load campaign');
      }
      const data = await res.json();
      setCampaign(data);
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const handleControlAction = async (action: 'start' | 'pause' | 'resume' | 'cancel') => {
    if (action === 'cancel' && !window.confirm('Are you sure you want to cancel this campaign? Pending events will be cancelled permanently and cannot be run.')) {
      return;
    }

    setSubmittingControl(true);
    setError(null);
    try {
      const res = await fetch(`/api/campaigns/${id}/control`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || `Failed to ${action} campaign`);
      }

      const updated = await res.json();
      setCampaign(updated);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmittingControl(false);
    }
  };

  const handleDeleteCampaign = async () => {
    if (!campaign) return;
    if (!window.confirm('Are you sure you want to delete this campaign? This cannot be undone.')) {
      return;
    }

    setSubmittingControl(true);
    try {
      const res = await fetch(`/api/campaigns/${id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to delete campaign');
      }

      router.push('/campaigns');
    } catch (err: any) {
      alert(err.message);
      setSubmittingControl(false);
    }
  };

  const triggerEngineTick = async () => {
    setError(null);
    try {
      const res = await fetch('/api/campaigns/engine', {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Failed to run engine tick');
      const data = await res.json();
      if (data.processed > 0) {
        alert(`Engine tick ran: processed event ${data.eventId} resulting in status '${data.status}'`);
        fetchCampaignDetail();
      } else {
        alert('Engine tick ran: no pending events scheduled to process at this time.');
      }
    } catch (err: any) {
      alert('Error triggering engine: ' + err.message);
    }
  };

  const handleRerunFailed = async () => {
    if (!campaign) return;
    if (
      !window.confirm(
        'Are you sure you want to reschedule all failed events? This will reset the failure count and schedule them starting from now.'
      )
    ) {
      return;
    }

    setSubmittingControl(true);
    try {
      const res = await fetch(`/api/campaigns/${id}/rerun-failed`, {
        method: 'POST',
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to rerun failed events');
      }
      const data = await res.json();
      setCampaign(data);
      alert('Rescheduled failed events successfully!');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmittingControl(false);
    }
  };

  const getETA = () => {
    if (!campaign) return '—';
    if (campaign.status === 'completed') return 'Completed';
    if (campaign.status === 'cancelled') return 'Cancelled';

    const done = campaign.completed_events + campaign.failed_events;
    const remaining = campaign.total_events - done;
    if (remaining <= 0) return '0s';

    const avgDelay = (campaign.delay_min_seconds + campaign.delay_max_seconds) / 2;
    const totalSeconds = remaining * avgDelay;

    if (totalSeconds < 60) return `${Math.round(totalSeconds)}s`;
    const totalMinutes = totalSeconds / 60;
    if (totalMinutes < 60) return `${Math.round(totalMinutes)}m`;
    const totalHours = totalMinutes / 60;
    if (totalHours < 24) return `${Math.round(totalHours * 10) / 10}h`;
    const totalDays = totalHours / 24;
    return `${Math.round(totalDays * 10) / 10}d`;
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
          Loading campaign details...
        </div>
      </DashboardLayout>
    );
  }

  if (error || !campaign) {
    return (
      <DashboardLayout>
        <div className="alert-danger" style={{ margin: '20px 0' }}>
          ⚠️ {error || 'Campaign not found'}
        </div>
        <Link href="/campaigns" className="btn btn-secondary">
          Back to Campaigns
        </Link>
      </DashboardLayout>
    );
  }

  const doneCount = campaign.completed_events + campaign.failed_events;
  const pendingCount = Math.max(0, campaign.total_events - doneCount);

  return (
    <DashboardLayout>
      <div className="page-header">
        <div className="page-title">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <Link href="/campaigns" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>
              📢 Campaigns
            </Link>
            <span style={{ color: 'var(--text-muted)' }}>/</span>
            <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Detail</span>
          </div>
          <h2>{campaign.name}</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            Target: <strong>{campaign.group_list_name}</strong> • Account: <strong>{campaign.instance_id}</strong>
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Auto Refresh Toggle */}
          {campaign.status === 'running' && (
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: 'var(--text-secondary)', cursor: 'pointer', marginRight: '8px' }}>
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
              />
              Auto-refresh (5s)
            </label>
          )}

          {/* Debug force tick button */}
          {campaign.status === 'running' && (
            <button className="btn btn-secondary btn-sm" onClick={triggerEngineTick} title="For testing: trigger a database engine job tick immediately">
              ⚡ Trigger Tick
            </button>
          )}

          {/* Re-run Failed Events */}
          {campaign.failed_events > 0 && (
            <button
              className="btn btn-warning"
              onClick={handleRerunFailed}
              disabled={submittingControl}
            >
              Re-run Failed Events ({campaign.failed_events}) 🔄
            </button>
          )}

          {/* Action controls */}
          {campaign.status === 'draft' && (
            <button
              className="btn btn-primary"
              onClick={() => handleControlAction('start')}
              disabled={submittingControl}
            >
              Start Campaign 🚀
            </button>
          )}
          {campaign.status === 'running' && (
            <button
              className="btn btn-warning"
              onClick={() => handleControlAction('pause')}
              disabled={submittingControl}
            >
              Pause Campaign ⏸️
            </button>
          )}
          {campaign.status === 'paused' && (
            <button
              className="btn btn-primary"
              onClick={() => handleControlAction('resume')}
              disabled={submittingControl}
            >
              Resume Campaign ▶️
            </button>
          )}
          {['draft', 'running', 'paused', 'scheduled'].includes(campaign.status) && (
            <button
              className="btn btn-danger"
              onClick={() => handleControlAction('cancel')}
              disabled={submittingControl}
            >
              Cancel Campaign 🛑
            </button>
          )}
          {['draft', 'completed', 'cancelled', 'failed'].includes(campaign.status) && (
            <button
              className="btn btn-danger"
              onClick={handleDeleteCampaign}
              disabled={submittingControl}
            >
              Delete
            </button>
          )}
        </div>
      </div>

      {/* Progress Card */}
      <div className="card" style={{ padding: '20px', marginBottom: '24px' }}>
        <CampaignProgress
          campaignId={campaign.id}
          totalEvents={campaign.total_events}
          completedEvents={campaign.completed_events}
          failedEvents={campaign.failed_events}
          status={campaign.status}
          onRefresh={() => fetchCampaignDetail(true)}
        />
      </div>

      {/* Stats Grid */}
      <div
        className="stat-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px',
          marginBottom: '32px',
        }}
      >
        <div className="stat-card">
          <div className="stat-label" style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Total Broadcasts</div>
          <div className="stat-value" style={{ fontSize: '1.8rem', fontWeight: 700, marginTop: '4px' }}>{campaign.total_events}</div>
        </div>
        <div className="stat-card" style={{ borderLeft: '3px solid var(--color-primary)' }}>
          <div className="stat-label" style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Sent successfully</div>
          <div className="stat-value" style={{ fontSize: '1.8rem', fontWeight: 700, marginTop: '4px', color: 'var(--color-primary)' }}>{campaign.completed_events}</div>
        </div>
        <div className="stat-card" style={{ borderLeft: '3px solid var(--color-danger)' }}>
          <div className="stat-label" style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Failed sends</div>
          <div className="stat-value" style={{ fontSize: '1.8rem', fontWeight: 700, marginTop: '4px', color: 'var(--color-danger)' }}>{campaign.failed_events}</div>
        </div>
        <div className="stat-card" style={{ borderLeft: '3px solid var(--text-muted)' }}>
          <div className="stat-label" style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Queue remaining</div>
          <div className="stat-value" style={{ fontSize: '1.8rem', fontWeight: 700, marginTop: '4px', color: 'var(--text-secondary)' }}>{pendingCount}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px', alignItems: 'start' }}>
        {/* Left column: Event Logs */}
        <div className="card" style={{ padding: '24px' }}>
          <CampaignEventLog campaignId={campaign.id} />
        </div>

        {/* Right column: Campaign Rules Details */}
        <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h3>Campaign Configuration</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.9rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Campaign Type:</span>
              <span style={{ fontWeight: 600 }}>{campaign.campaign_type === 1 ? 'Bulk Product' : 'Broadcast'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Delay Range:</span>
              <span style={{ fontWeight: 600 }}>{campaign.delay_min_seconds}s - {campaign.delay_max_seconds}s</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Start Jitter:</span>
              <span style={{ fontWeight: 600 }}>± {campaign.start_jitter_seconds}s</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Created At:</span>
              <span style={{ fontWeight: 600 }}>{new Date(campaign.created_at).toLocaleString()}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Started At:</span>
              <span style={{ fontWeight: 600 }}>{campaign.started_at ? new Date(campaign.started_at).toLocaleString() : '—'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Completed At:</span>
              <span style={{ fontWeight: 600 }}>{campaign.completed_at ? new Date(campaign.completed_at).toLocaleString() : '—'}</span>
            </div>
            {campaign.status === 'running' && (
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px' }}>
                <span style={{ color: 'var(--color-primary)', fontWeight: 600 }}>Est. Time Remaining (ETA):</span>
                <span style={{ fontWeight: 700, color: 'var(--color-primary)' }}>{getETA()}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
