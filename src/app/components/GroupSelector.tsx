'use client';

import React, { useState, useEffect } from 'react';

interface Group {
  jid: string;
  name: string;
  participantCount: number;
  role?: 'admin' | 'member';
}

interface GroupSelectorProps {
  selectedJids: string[];
  onChange: (jids: string[]) => void;
}

export default function GroupSelector({ selectedJids, onChange }: GroupSelectorProps) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    async function fetchGroups() {
      try {
        setLoading(true);
        const res = await fetch('/api/groups');
        if (!res.ok) {
          throw new Error('Failed to fetch WhatsApp groups');
        }
        const data = await res.json();
        setGroups(data.data || data);
      } catch (err: any) {
        setError(err.message || 'Error loading groups');
      } finally {
        setLoading(false);
      }
    }
    fetchGroups();
  }, []);

  const handleToggle = (jid: string) => {
    if (selectedJids.includes(jid)) {
      onChange(selectedJids.filter(item => item !== jid));
    } else {
      onChange([...selectedJids, jid]);
    }
  };

  const handleSelectAll = (filteredGroups: Group[]) => {
    const filteredJids = filteredGroups.map(g => g.jid);
    const newSelection = Array.from(new Set([...selectedJids, ...filteredJids]));
    onChange(newSelection);
  };

  const handleDeselectAll = (filteredGroups: Group[]) => {
    const filteredJids = filteredGroups.map(g => g.jid);
    onChange(selectedJids.filter(jid => !filteredJids.includes(jid)));
  };

  const filtered = groups.filter(g =>
    g.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    g.jid.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)' }}>
        Loading WhatsApp groups...
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert-danger" style={{ margin: '10px 0' }}>
        ⚠️ {error}
      </div>
    );
  }

  return (
    <div className="group-selector-container" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ display: 'flex', gap: '8px' }}>
        <input
          type="text"
          placeholder="Search groups by name or JID..."
          className="form-control"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ flex: 1 }}
        />
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => handleSelectAll(filtered)}
        >
          Select All
        </button>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => handleDeselectAll(filtered)}
        >
          Clear
        </button>
      </div>

      <div
        className="groups-scroll-list"
        style={{
          maxHeight: '300px',
          overflowY: 'auto',
          border: '1px solid var(--border-color)',
          borderRadius: '8px',
          backgroundColor: 'var(--bg-surface)',
          padding: '4px',
        }}
      >
        {filtered.length === 0 ? (
          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
            No groups found matching search criteria.
          </div>
        ) : (
          filtered.map((group) => {
            const isSelected = selectedJids.includes(group.jid);
            // Default to 'member' if role not provided, badge display helper
            const isGroupAdmin = group.role === 'admin';
            return (
              <div
                key={group.jid}
                onClick={() => handleToggle(group.jid)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '10px 12px',
                  borderBottom: '1px solid var(--border-color)',
                  cursor: 'pointer',
                  backgroundColor: isSelected ? 'rgba(16, 185, 129, 0.05)' : 'transparent',
                  transition: 'background-color 0.15s ease',
                }}
                className="group-select-item"
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => {}} // Controlled by outer div click
                  style={{ marginRight: '12px', cursor: 'pointer' }}
                />
                <div style={{ flex: 1, minWidth: 0, marginRight: '12px' }}>
                  <div
                    style={{
                      fontWeight: 500,
                      color: isSelected ? 'var(--color-primary)' : 'var(--text-primary)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {group.name || 'Unnamed Group'}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{group.jid}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    👥 {group.participantCount || 0}
                  </span>
                  <span className={`badge ${isGroupAdmin ? 'badge-success' : 'badge-secondary'}`}>
                    {isGroupAdmin ? 'Admin' : 'Member'}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
      <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
        Selected: <strong>{selectedJids.length}</strong> groups
      </div>
    </div>
  );
}
