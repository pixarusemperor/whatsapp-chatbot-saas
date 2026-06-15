'use client';

import React, { useEffect, useState } from 'react';

interface CampaignProgressProps {
  campaignId: string;
  totalEvents: number;
  completedEvents: number;
  failedEvents: number;
  status: string;
  onRefresh?: () => void;
}

export default function CampaignProgress({
  campaignId,
  totalEvents,
  completedEvents,
  failedEvents,
  status,
  onRefresh,
}: CampaignProgressProps) {
  const [internalStats, setInternalStats] = useState({
    completed: completedEvents,
    failed: failedEvents,
    status: status,
  });

  useEffect(() => {
    setInternalStats({
      completed: completedEvents,
      failed: failedEvents,
      status: status,
    });
  }, [completedEvents, failedEvents, status]);

  useEffect(() => {
    if (internalStats.status !== 'running') return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/campaigns/${campaignId}`);
        if (res.ok) {
          const data = await res.json();
          setInternalStats({
            completed: data.completed_events,
            failed: data.failed_events,
            status: data.status,
          });
          if (onRefresh) {
            onRefresh();
          }
          if (data.status !== 'running') {
            clearInterval(interval);
          }
        }
      } catch (err) {
        console.error('Error polling campaign stats:', err);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [campaignId, internalStats.status, onRefresh]);

  const totalProcessed = internalStats.completed + internalStats.failed;
  const percentage = totalEvents > 0 ? Math.min(Math.round((totalProcessed / totalEvents) * 100), 100) : 0;

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
    <div className="campaign-progress-container" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Status:</span>
          <span className={`badge ${getStatusBadgeClass(internalStats.status)}`}>
            {internalStats.status.toUpperCase()}
          </span>
        </div>
        <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>
          {percentage}% ({totalProcessed}/{totalEvents})
        </span>
      </div>

      <div className="progress-bar">
        <div className="progress-fill" style={{ width: `${percentage}%` }} />
      </div>

      <div style={{ display: 'flex', gap: '16px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
        <span>✅ Sent: <strong>{internalStats.completed}</strong></span>
        <span>❌ Failed: <strong>{internalStats.failed}</strong></span>
        <span>⏳ Remaining: <strong>{Math.max(0, totalEvents - totalProcessed)}</strong></span>
      </div>
    </div>
  );
}
