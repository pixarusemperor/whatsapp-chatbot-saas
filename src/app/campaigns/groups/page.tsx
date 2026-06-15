'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import DashboardLayout from '@/app/components/DashboardLayout';
import GroupSelector from '@/app/components/GroupSelector';

interface Group {
  jid: string;
  name: string;
  participantCount: number;
  role?: 'admin' | 'member';
}

interface GroupList {
  id: string;
  name: string;
  description: string;
  created_at: string;
  itemCount: number;
}

export default function GroupsPage() {
  // Groups data
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(true);
  const [groupsError, setGroupsError] = useState<string | null>(null);

  // Group Lists data
  const [groupLists, setGroupLists] = useState<GroupList[]>([]);
  const [listsLoading, setListsLoading] = useState(true);
  const [listsError, setListsError] = useState<string | null>(null);

  // Form / Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editListId, setEditListId] = useState<string | null>(null);
  const [listName, setListName] = useState('');
  const [listDescription, setListDescription] = useState('');
  const [selectedJids, setSelectedJids] = useState<string[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchGroups();
    fetchGroupLists();
  }, []);

  const fetchGroups = async () => {
    setGroupsLoading(true);
    setGroupsError(null);
    try {
      const res = await fetch('/api/groups');
      if (!res.ok) throw new Error('Failed to fetch WhatsApp groups');
      const data = await res.json();
      setGroups(data.data || data);
    } catch (err: any) {
      setGroupsError(err.message || 'Failed to load groups');
    } finally {
      setGroupsLoading(false);
    }
  };

  const fetchGroupLists = async () => {
    setListsLoading(true);
    setListsError(null);
    try {
      const res = await fetch('/api/group-lists');
      if (!res.ok) throw new Error('Failed to fetch group lists');
      const data = await res.json();
      setGroupLists(data);
    } catch (err: any) {
      setListsError(err.message || 'Failed to load group lists');
    } finally {
      setListsLoading(false);
    }
  };

  const openCreateModal = () => {
    setModalMode('create');
    setEditListId(null);
    setListName('');
    setListDescription('');
    setSelectedJids([]);
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEditModal = async (list: GroupList) => {
    setModalMode('edit');
    setEditListId(list.id);
    setListName(list.name);
    setListDescription(list.description || '');
    setFormError(null);
    setIsModalOpen(true);

    try {
      const res = await fetch(`/api/group-lists/${list.id}`);
      if (!res.ok) throw new Error('Failed to load group list details');
      const data = await res.json();
      const jids = data.items.map((item: any) => item.group_jid);
      setSelectedJids(jids);
    } catch (err: any) {
      setFormError(err.message || 'Failed to load items');
    }
  };

  const handleDeleteList = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this group list? Campaigns using it will not be deleted but they cannot be re-run.')) {
      return;
    }

    try {
      const res = await fetch(`/api/group-lists/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete group list');
      setGroupLists((prev) => prev.filter((list) => list.id !== id));
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!listName.trim()) {
      setFormError('Group list name is required');
      return;
    }
    if (selectedJids.length === 0) {
      setFormError('Please select at least one WhatsApp group');
      return;
    }

    setSubmitting(true);
    setFormError(null);

    try {
      const url = modalMode === 'create' ? '/api/group-lists' : `/api/group-lists/${editListId}`;
      const method = modalMode === 'create' ? 'POST' : 'PUT';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: listName,
          description: listDescription,
          groupJids: selectedJids,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to save group list');
      }

      setIsModalOpen(false);
      fetchGroupLists();
    } catch (err: any) {
      setFormError(err.message || 'Failed to save group list');
    } finally {
      setSubmitting(false);
    }
  };

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
        <Link href="/campaigns/groups" className="tab-link active">
          Groups
        </Link>
        <Link href="/campaigns/products" className="tab-link">
          Products
        </Link>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '32px' }}>
        {/* Section 1: Group Lists */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div>
              <h3>Group Lists</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                Create reusable collections of groups for targeting campaigns
              </p>
            </div>
            <button className="btn btn-primary" onClick={openCreateModal}>
              + Create Group List
            </button>
          </div>

          {listsError && <div className="alert-danger">{listsError}</div>}

          {listsLoading ? (
            <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-secondary)' }}>
              Loading lists...
            </div>
          ) : groupLists.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
              No group lists created yet. Click "+ Create Group List" to get started.
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    <th>List Name</th>
                    <th>Description</th>
                    <th>Groups Count</th>
                    <th>Created</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {groupLists.map((list) => (
                    <tr key={list.id}>
                      <td style={{ fontWeight: 600 }}>{list.name}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>{list.description || '—'}</td>
                      <td>
                        <span className="badge badge-info">{list.itemCount} groups</span>
                      </td>
                      <td style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                        {new Date(list.created_at).toLocaleDateString()}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                          <button className="btn btn-secondary btn-sm" onClick={() => openEditModal(list)}>
                            Edit
                          </button>
                          <button className="btn btn-danger btn-sm" onClick={() => handleDeleteList(list.id)}>
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

        {/* Section 2: Read-only WhatsApp Groups Fetched Live */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div>
              <h3>WhatsApp Groups (Live)</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                All active groups found on your connected WhatsApp session
              </p>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={fetchGroups} disabled={groupsLoading}>
              🔄 Refresh List
            </button>
          </div>

          {groupsError && <div className="alert-danger">{groupsError}</div>}

          {groupsLoading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
              Fetching WhatsApp groups from device...
            </div>
          ) : groups.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
              No groups found on this WhatsApp session.
            </div>
          ) : (
            <div className="table-responsive" style={{ maxHeight: '400px', overflowY: 'auto' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Group Name</th>
                    <th>JID (Identifier)</th>
                    <th>Participants</th>
                    <th>My Role</th>
                  </tr>
                </thead>
                <tbody>
                  {groups.map((group) => {
                    const isGroupAdmin = group.role === 'admin';
                    return (
                      <tr key={group.jid}>
                        <td style={{ fontWeight: 500 }}>{group.name || 'Unnamed Group'}</td>
                        <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                          {group.jid}
                        </td>
                        <td>{group.participantCount}</td>
                        <td>
                          <span className={`badge ${isGroupAdmin ? 'badge-success' : 'badge-secondary'}`}>
                            {isGroupAdmin ? 'Admin' : 'Member'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal Dialog */}
      {isModalOpen && (
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
              maxWidth: '600px',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              padding: '24px',
              overflow: 'hidden',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0 }}>
                {modalMode === 'create' ? 'Create Group List' : 'Edit Group List'}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
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

            <form onSubmit={handleFormSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto', flex: 1, paddingRight: '4px' }}>
              <div className="form-group">
                <label className="form-label">List Name *</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Premium Clients, General Groups"
                  value={listName}
                  onChange={(e) => setListName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea
                  className="form-control"
                  placeholder="e.g. Broadcast groups for Cameroon users"
                  value={listDescription}
                  onChange={(e) => setListDescription(e.target.value)}
                  rows={2}
                />
              </div>

              <div className="form-group">
                <label className="form-label" style={{ marginBottom: '8px', display: 'block' }}>
                  Select Groups *
                </label>
                <GroupSelector selectedJids={selectedJids} onChange={setSelectedJids} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsModalOpen(false)}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Saving...' : 'Save Group List'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
