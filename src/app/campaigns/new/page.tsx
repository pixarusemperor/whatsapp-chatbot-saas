'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import DashboardLayout from '@/app/components/DashboardLayout';

interface Product {
  id: string;
  name: string;
  media_type: string;
  caption: string;
  media_url?: string;
}

interface GroupList {
  id: string;
  name: string;
  itemCount: number;
}

interface Instance {
  id: string;
  name: string;
  phone: string;
  status: string;
  api_key: string;
}

export default function NewCampaignPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Loaded database entities
  const [products, setProducts] = useState<Product[]>([]);
  const [groupLists, setGroupLists] = useState<GroupList[]>([]);
  const [instances, setInstances] = useState<Instance[]>([]);

  // Form State
  const [name, setName] = useState('');
  const [campaignType, setCampaignType] = useState<number>(2); // Default Broadcast (2)
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [selectedGroupListId, setSelectedGroupListId] = useState('');
  const [selectedInstanceId, setSelectedInstanceId] = useState('');
  const [delayMin, setDelayMin] = useState(60);
  const [delayMax, setDelayMax] = useState(300);
  const [waveDelayMin, setWaveDelayMin] = useState(900); // 15 min default
  const [waveDelayMax, setWaveDelayMax] = useState(1800); // 30 min default
  const [schedulingMode, setSchedulingMode] = useState<'automatic' | 'manual'>('automatic');
  const [waveStartTimes, setWaveStartTimes] = useState<string[]>([]);
  const [startType, setStartType] = useState<'immediate' | 'scheduled'>('immediate');
  const [scheduledTime, setScheduledTime] = useState('');
  const [jitter, setJitter] = useState(120);
  const [submitting, setSubmitting] = useState(false);
  const [showTimelinePreview, setShowTimelinePreview] = useState(false);

  // Target Recipients State
  const [recipientMode, setRecipientMode] = useState<'registered' | 'create_list' | 'select_groups' | 'direct_numbers'>('registered');
  const [newListName, setNewListName] = useState('');
  const [newListDescription, setNewListDescription] = useState('');
  const [newListGroupJids, setNewListGroupJids] = useState<string[]>([]);
  const [selectedGroupJids, setSelectedGroupJids] = useState<string[]>([]);
  const [directNumbersText, setDirectNumbersText] = useState('');
  const [instanceGroups, setInstanceGroups] = useState<any[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [groupSearchQuery, setGroupSearchQuery] = useState('');

  // Custom Message state
  const [customMessages, setCustomMessages] = useState<Array<{
    caption: string;
    media_url: string;
    media_type: string;
    mediaSourceType: 'none' | 'library' | 'upload' | 'url';
    selectedMediaId?: string;
    uploading?: boolean;
  }>>([{ caption: '', media_url: '', media_type: 'text', mediaSourceType: 'none' }]);

  useEffect(() => {
    setWaveStartTimes(prev => {
      const next = [...prev];
      if (next.length < customMessages.length) {
        while (next.length < customMessages.length) {
          next.push('');
        }
      } else if (next.length > customMessages.length) {
        next.length = customMessages.length;
      }
      return next;
    });
  }, [customMessages.length]);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        // Load products
        const prodRes = await fetch('/api/products');
        const prodData = await prodRes.json();
        setProducts(prodData);

        // Load group lists
        const listRes = await fetch('/api/group-lists');
        const listData = await listRes.json();
        setGroupLists(listData);

        // Load WhatsApp sessions
        const instRes = await fetch('/api/instances');
        const instData = await instRes.json();
        setInstances(instData);

        if (instData.length > 0) {
          setSelectedInstanceId(instData[0].id);
        }
        if (listData.length > 0) {
          setSelectedGroupListId(listData[0].id);
        }
      } catch (err: any) {
        setError('Failed to load form prerequisites: ' + err.message);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Load groups dynamically when selecting targets (step 4)
  useEffect(() => {
    if (currentStep === 4 && selectedInstanceId) {
      async function loadGroups() {
        try {
          setLoadingGroups(true);
          setError(null);
          const res = await fetch(`/api/groups?instance_id=${selectedInstanceId}`);
          if (!res.ok) {
            throw new Error(await res.text() || 'Failed to load groups');
          }
          const data = await res.json();
          setInstanceGroups(data);
        } catch (err: any) {
          setError('Could not load WhatsApp groups for this session: ' + err.message);
        } finally {
          setLoadingGroups(false);
        }
      }
      loadGroups();
    }
  }, [currentStep, selectedInstanceId]);

  const getTargetCount = () => {
    if (recipientMode === 'registered') {
      return groupLists.find(l => l.id === selectedGroupListId)?.itemCount || 0;
    } else if (recipientMode === 'create_list') {
      return newListGroupJids.length;
    } else if (recipientMode === 'select_groups') {
      return selectedGroupJids.length;
    } else if (recipientMode === 'direct_numbers') {
      return directNumbersText.split(/[\n,;]/).map(n => n.trim()).filter(Boolean).length;
    }
    return 0;
  };

  const formatEstimatedWaveEnd = (waveIndex: number) => {
    const targetCount = getTargetCount();
    const startTimeStr = waveStartTimes[waveIndex];
    if (!startTimeStr) return 'Not set';
    const startTime = new Date(startTimeStr).getTime();
    const maxDurationMs = (targetCount - 1) * delayMax * 1000;
    return new Date(startTime + maxDurationMs).toLocaleTimeString();
  };

  const getSimulatedTimeline = () => {
    const items: Array<{
      wave: number;
      group: string;
      estimatedTime: Date;
      message: string;
      isPause?: boolean;
      pauseDuration?: number;
    }> = [];

    const targetCount = getTargetCount();
    if (targetCount === 0 || customMessages.length === 0) return [];

    let currentTime = startType === 'immediate' ? new Date() : new Date(scheduledTime || Date.now());
    currentTime = new Date(currentTime.getTime() + (jitter / 2) * 1000);

    const avgIntra = (delayMin + delayMax) / 2;
    const avgInter = (waveDelayMin + waveDelayMax) / 2;

    for (let waveIdx = 0; waveIdx < customMessages.length; waveIdx++) {
      const msg = customMessages[waveIdx];
      const captionSnippet = msg.caption.length > 40 ? `${msg.caption.substring(0, 40)}...` : msg.caption;

      if (waveIdx > 0) {
        if (schedulingMode === 'manual' && waveStartTimes[waveIdx]) {
          currentTime = new Date(waveStartTimes[waveIdx]);
        } else {
          items.push({
            wave: waveIdx,
            group: '--- WAVE BREAK ---',
            estimatedTime: new Date(currentTime),
            message: `Pause between wave ${waveIdx} and ${waveIdx + 1}`,
            isPause: true,
            pauseDuration: avgInter
          });
          currentTime = new Date(currentTime.getTime() + avgInter * 1000);
        }
      } else if (schedulingMode === 'manual' && waveStartTimes[0]) {
        currentTime = new Date(waveStartTimes[0]);
      }

      for (let groupIdx = 0; groupIdx < targetCount; groupIdx++) {
        if (groupIdx > 0) {
          currentTime = new Date(currentTime.getTime() + avgIntra * 1000);
        }
        items.push({
          wave: waveIdx + 1,
          group: `Recipient #${groupIdx + 1}`,
          estimatedTime: new Date(currentTime),
          message: captionSnippet
        });
      }
    }
    return items;
  };

  const formatEstimatedDuration = () => {
    const timeline = getSimulatedTimeline();
    if (timeline.length === 0) return '0m';
    const nonPause = timeline.filter(t => !t.isPause);
    if (nonPause.length === 0) return '0m';
    const start = nonPause[0].estimatedTime.getTime();
    const end = nonPause[nonPause.length - 1].estimatedTime.getTime();
    const diffMs = end - start;
    if (diffMs <= 0) return '0m';
    const mins = Math.round(diffMs / 60000);
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    const remMins = mins % 60;
    return `${hrs}h ${remMins}m`;
  };

  // Form validation per wizard step
  const validateStep = () => {
    setError(null);
    if (currentStep === 1) {
      if (!name.trim()) {
        setError('Campaign name is required');
        return false;
      }
    } else if (currentStep === 2) {
      if (customMessages.length === 0) {
        setError('Please add at least one message');
        return false;
      }
      for (let i = 0; i < customMessages.length; i++) {
        const msg = customMessages[i];
        if (!msg.caption.trim()) {
          setError(`Caption is required for Message #${i + 1}`);
          return false;
        }
        if (msg.uploading) {
          setError(`Please wait for Message #${i + 1} media file upload to complete`);
          return false;
        }
      }
    } else if (currentStep === 3) {
      if (!selectedInstanceId) {
        setError('Please select a WhatsApp session');
        return false;
      }
      const inst = instances.find(i => i.id === selectedInstanceId);
      if (inst && inst.status.toLowerCase() !== 'connected' && inst.status.toLowerCase() !== 'ready' && inst.status.toLowerCase() !== 'authenticated') {
        if (!window.confirm('Warning: The selected instance is not currently connected. The campaign can still be created, but events will not send until it is connected. Continue?')) {
          return false;
        }
      }
    } else if (currentStep === 4) {
      if (recipientMode === 'registered') {
        if (!selectedGroupListId) {
          setError('Please select a targeting Group List');
          return false;
        }
      } else if (recipientMode === 'create_list') {
        if (!newListName.trim()) {
          setError('Please enter a name for the new group list');
          return false;
        }
        if (newListGroupJids.length === 0) {
          setError('Please select at least one WhatsApp group to include in the list');
          return false;
        }
      } else if (recipientMode === 'select_groups') {
        if (selectedGroupJids.length === 0) {
          setError('Please select at least one WhatsApp group to target');
          return false;
        }
      } else if (recipientMode === 'direct_numbers') {
        const numbers = directNumbersText.split(/[\n,;]/).map(n => n.trim()).filter(Boolean);
        if (numbers.length === 0) {
          setError('Please enter at least one WhatsApp phone number');
          return false;
        }
      }
    } else if (currentStep === 5) {
      if (delayMin < 5) {
        setError('Minimum delay must be at least 5 seconds');
        return false;
      }
      if (delayMax < delayMin) {
        setError('Maximum delay must be greater than or equal to minimum delay');
        return false;
      }
      if (schedulingMode === 'automatic') {
        if (waveDelayMin < 5) {
          setError('Minimum inter-wave delay must be at least 5 seconds');
          return false;
        }
        if (waveDelayMax < waveDelayMin) {
          setError('Maximum inter-wave delay must be greater than or equal to minimum inter-wave delay');
          return false;
        }
      }
      if (startType === 'scheduled' && !scheduledTime) {
        setError('Please specify a scheduled start time');
        return false;
      }
      if (schedulingMode === 'manual') {
        const targetCount = getTargetCount();
        const maxWaveDurationMs = (targetCount - 1) * delayMax * 1000;
        
        for (let i = 0; i < customMessages.length; i++) {
          if (!waveStartTimes[i]) {
            setError(`Please specify a start time for Wave #${i + 1}`);
            return false;
          }
          const currentStart = new Date(waveStartTimes[i]).getTime();
          
          if (i > 0) {
            const prevStart = new Date(waveStartTimes[i - 1]).getTime();
            if (currentStart < prevStart + maxWaveDurationMs) {
              const prevEndStr = new Date(prevStart + maxWaveDurationMs).toLocaleTimeString();
              setError(`Wave #${i + 1} start time overlaps with Wave #${i}. It must start after ${prevEndStr} (estimated finish of Wave #${i}).`);
              return false;
            }
          }
        }
      }
    }
    return true;
  };

  const updateMessage = (index: number, updates: Partial<typeof customMessages[0]>) => {
    setCustomMessages(prev => prev.map((msg, i) => i === index ? { ...msg, ...updates } : msg));
  };

  const addMessage = () => {
    setCustomMessages(prev => [...prev, { caption: '', media_url: '', media_type: 'text', mediaSourceType: 'none' }]);
  };

  const removeMessage = (index: number) => {
    if (customMessages.length <= 1) return;
    setCustomMessages(prev => prev.filter((_, i) => i !== index));
  };

  const handleMediaSourceChange = (index: number, sourceType: 'none' | 'library' | 'upload' | 'url') => {
    setCustomMessages(prev => prev.map((msg, i) => {
      if (i !== index) return msg;
      
      let media_url = '';
      let media_type = 'text';
      let selectedMediaId = undefined;
      
      if (sourceType === 'library') {
        const libraryMedias = products.filter(p => p.media_url);
        if (libraryMedias.length > 0) {
          media_url = libraryMedias[0].media_url || '';
          media_type = libraryMedias[0].media_type || 'text';
          selectedMediaId = libraryMedias[0].id;
        }
      }
      
      return {
        ...msg,
        mediaSourceType: sourceType,
        media_url,
        media_type,
        selectedMediaId
      };
    }));
  };

  const handleFileUpload = async (index: number, files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    
    setCustomMessages(prev => prev.map((msg, i) => i === index ? { ...msg, uploading: true } : msg));
    
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      
      if (!res.ok) {
        throw new Error(await res.text() || 'Upload failed');
      }
      
      const data = await res.json();
      
      let mediaType = 'document';
      if (data.type.startsWith('image/')) mediaType = 'image';
      else if (data.type.startsWith('video/')) mediaType = 'video';
      else if (data.type.startsWith('audio/')) mediaType = 'audio';
      
      setCustomMessages(prev => prev.map((msg, i) => i === index ? {
        ...msg,
        media_url: data.url,
        media_type: mediaType,
        selectedMediaId: undefined,
        uploading: false
      } : msg));
    } catch (err: any) {
      setError(`File upload failed: ${err.message}`);
      setCustomMessages(prev => prev.map((msg, i) => i === index ? { ...msg, uploading: false } : msg));
    }
  };

  const handleNext = () => {
    if (validateStep()) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handleBack = () => {
    setError(null);
    setCurrentStep(prev => prev - 1);
  };

  const handleSubmit = async (targetStatus: 'draft' | 'scheduled' | 'running') => {
    setError(null);
    setSubmitting(true);

    const selectedInstance = instances.find(i => i.id === selectedInstanceId);
    if (!selectedInstance) {
      setError('Selected WhatsApp session is invalid');
      setSubmitting(false);
      return;
    }

    const payload: any = {
      name,
      campaign_type: campaignType,
      instance_id: selectedInstanceId,
      instance_api_key: selectedInstance.api_key || 'fake-api-key', // fall back if empty
      targeting_mode: recipientMode,
      custom_products: customMessages.map((msg, index) => ({
        name: `Campaign: ${name.substring(0, 20)} (Msg ${index + 1})`,
        caption: msg.caption,
        media_url: msg.media_url || null,
        media_type: msg.media_type || 'text',
      })),
      delay_min_seconds: delayMin,
      delay_max_seconds: delayMax,
      wave_delay_min_seconds: waveDelayMin,
      wave_delay_max_seconds: waveDelayMax,
      scheduling_mode: schedulingMode,
      wave_start_times: schedulingMode === 'manual' ? waveStartTimes.map(t => t ? new Date(t).toISOString() : new Date().toISOString()) : null,
      scheduled_start_at: startType === 'scheduled' && scheduledTime ? new Date(scheduledTime).toISOString() : null,
      start_jitter_seconds: jitter,
      status: targetStatus === 'running' ? 'draft' : targetStatus,
    };

    if (recipientMode === 'registered') {
      payload.group_list_id = selectedGroupListId;
    } else if (recipientMode === 'create_list') {
      payload.new_group_list = {
        name: newListName,
        description: newListDescription,
        group_jids: newListGroupJids,
        groups_metadata: newListGroupJids.map(jid => {
          const gObj = instanceGroups.find(g => g.jid === jid);
          return { jid, name: gObj ? gObj.name : '' };
        })
      };
    } else if (recipientMode === 'select_groups') {
      payload.selected_groups = selectedGroupJids.map(jid => {
        const gObj = instanceGroups.find(g => g.jid === jid);
        return { jid, name: gObj ? gObj.name : '' };
      });
    } else if (recipientMode === 'direct_numbers') {
      payload.direct_numbers = directNumbersText.split(/[\n,;]/).map(n => n.trim()).filter(Boolean);
    }

    try {
      const res = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create campaign');
      }

      const campaign = await res.json();

      if (targetStatus === 'running') {
        const startRes = await fetch(`/api/campaigns/${campaign.id}/control`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'start' }),
        });

        if (!startRes.ok) {
          const startData = await startRes.json();
          throw new Error(startData.error || 'Failed to start campaign immediately');
        }
      }

      router.push(`/campaigns/${campaign.id}`);
    } catch (err: any) {
      setError(err.message || 'An error occurred during submission');
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
          Loading campaign wizard...
        </div>
      </DashboardLayout>
    );
  }

  // Details for Summary step
  const summaryProductNames = customMessages
    .map((msg, i) => {
      const typeStr = msg.media_type !== 'text' ? `with ${msg.media_type}` : 'text-only';
      const capSnippet = msg.caption.length > 30 ? `${msg.caption.substring(0, 30)}...` : msg.caption;
      return `Msg ${i + 1} (${typeStr}): "${capSnippet}"`;
    })
    .join(' | ');
  const summaryGroupListName = 
    recipientMode === 'registered' 
      ? (groupLists.find(l => l.id === selectedGroupListId)?.name || 'Unknown List')
      : recipientMode === 'create_list'
      ? `Create new list: "${newListName}" (${newListGroupJids.length} groups)`
      : recipientMode === 'select_groups'
      ? `Ad-hoc selection (${selectedGroupJids.length} groups)`
      : `Direct numbers (${directNumbersText.split(/[\n,;]/).map(n => n.trim()).filter(Boolean).length} numbers)`;
  const summaryInstanceName = instances.find(i => i.id === selectedInstanceId)?.name || 'Unknown Session';
  const isUploadingAny = customMessages.some(m => m.uploading);

  return (
    <DashboardLayout>
      <div className="page-header">
        <div className="page-title">
          <h2>Create Campaign</h2>
          <p>Setup a new broadcast or bulk distribution campaign in 6 simple steps</p>
        </div>
      </div>

      {/* Wizard Steps indicator */}
      <div className="wizard-steps">
        <div className={`wizard-step ${currentStep === 1 ? 'active' : currentStep > 1 ? 'completed' : ''}`}>
          1. Details
        </div>
        <div className={`wizard-step ${currentStep === 2 ? 'active' : currentStep > 2 ? 'completed' : ''}`}>
          2. Messages
        </div>
        <div className={`wizard-step ${currentStep === 3 ? 'active' : currentStep > 3 ? 'completed' : ''}`}>
          3. WhatsApp Session
        </div>
        <div className={`wizard-step ${currentStep === 4 ? 'active' : currentStep > 4 ? 'completed' : ''}`}>
          4. Target Recipients
        </div>
        <div className={`wizard-step ${currentStep === 5 ? 'active' : currentStep > 5 ? 'completed' : ''}`}>
          5. Delays & Time
        </div>
        <div className={`wizard-step ${currentStep === 6 ? 'active' : ''}`}>
          6. Launch
        </div>
      </div>

      {error && <div className="alert-danger">{error}</div>}

      <div className="card" style={{ padding: '24px' }}>
        {/* STEP 1: Name & Type */}
        {currentStep === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <h3>Step 1: Campaign Details</h3>
            <div className="form-group">
              <label className="form-label">Campaign Name *</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. June Product Launch, Promo Broadcast"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label" style={{ marginBottom: '8px', display: 'block' }}>Campaign Type *</label>
              <div style={{ display: 'flex', gap: '24px' }}>
                <label style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="campaignType"
                    checked={campaignType === 2}
                    onChange={() => {
                      setCampaignType(2);
                      setSelectedProductIds([]); // reset product selection
                      setCustomMessages([{ caption: '', media_url: '', media_type: 'text', mediaSourceType: 'none' }]);
                    }}
                    style={{ marginTop: '4px' }}
                  />
                  <div>
                    <strong>Broadcast Campaign (Type 2)</strong>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      Send exactly <strong>one</strong> product message to all groups in a list. Shuffled group ordering.
                    </div>
                  </div>
                </label>
                <label style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="campaignType"
                    checked={campaignType === 1}
                    onChange={() => {
                      setCampaignType(1);
                      setSelectedProductIds([]); // reset product selection
                      setCustomMessages([{ caption: '', media_url: '', media_type: 'text', mediaSourceType: 'none' }]);
                    }}
                    style={{ marginTop: '4px' }}
                  />
                  <div>
                    <strong>Bulk Product Distribution (Type 1)</strong>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      Distribute <strong>multiple</strong> products across groups with total entropy. Shuffled batches.
                    </div>
                  </div>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: Custom Caption & Media Library Selection */}
        {currentStep === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div>
              <h3>
                {campaignType === 2 
                  ? 'Step 2: Define Message Content (Broadcast)' 
                  : 'Step 2: Define Message Contents (Bulk)'}
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                {campaignType === 2
                  ? 'Enter the custom text caption and select optional media for the broadcast.'
                  : 'Create one or more custom messages to distribute across the target groups.'}
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {customMessages.map((msg, index) => {
                const libraryMedias = products.filter(p => p.media_url);

                return (
                  <div 
                    key={index} 
                    className="card" 
                    style={{ 
                      padding: '20px', 
                      border: '1px solid var(--border-color)', 
                      position: 'relative',
                      backgroundColor: 'rgba(255, 255, 255, 0.01)'
                    }}
                  >
                    {campaignType === 1 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <span style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                          Message #{index + 1}
                        </span>
                        {customMessages.length > 1 && (
                          <button
                            type="button"
                            className="btn btn-secondary"
                            style={{ 
                              padding: '4px 8px', 
                              fontSize: '0.75rem', 
                              borderColor: '#ef4444', 
                              color: '#ef4444' 
                            }}
                            onClick={() => removeMessage(index)}
                          >
                            Remove Message
                          </button>
                        )}
                      </div>
                    )}

                    <div className="form-group" style={{ marginBottom: '16px' }}>
                      <label className="form-label">Custom Caption *</label>
                      <textarea
                        className="form-control"
                        rows={4}
                        placeholder="Type your WhatsApp message caption here... You can use emojis and formatting (*bold*, _italics_)."
                        value={msg.caption}
                        onChange={(e) => updateMessage(index, { caption: e.target.value })}
                        required
                      />
                    </div>

                    <div style={{ marginBottom: '12px' }}>
                      <label className="form-label" style={{ marginBottom: '8px', display: 'block' }}>Media Attachment</label>
                      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
                        {(['none', 'library', 'upload', 'url'] as const).map((tab) => {
                          const isActive = msg.mediaSourceType === tab;
                          const label = 
                            tab === 'none' ? 'Text Only' : 
                            tab === 'library' ? 'Select from Library' : 
                            tab === 'upload' ? 'Upload File' : 'External URL';
                          return (
                            <button
                              key={tab}
                              type="button"
                              className={`btn ${isActive ? 'btn-primary' : 'btn-secondary'}`}
                              style={{ 
                                padding: '6px 12px', 
                                fontSize: '0.8rem',
                                flex: '1 1 0px',
                                minWidth: '130px'
                              }}
                              onClick={() => handleMediaSourceChange(index, tab)}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Tab 1: None */}
                    {msg.mediaSourceType === 'none' && (
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', padding: '12px', borderRadius: '4px', backgroundColor: 'rgba(255,255,255,0.02)' }}>
                        📝 Only text will be sent for this message.
                      </div>
                    )}

                    {/* Tab 2: Select from Library */}
                    {msg.mediaSourceType === 'library' && (
                      <div>
                        {libraryMedias.length === 0 ? (
                          <div style={{ padding: '12px', fontSize: '0.8rem', color: 'var(--text-muted)', border: '1px dashed var(--border-color)', borderRadius: '4px' }}>
                            No products in the library have media attached. Use "Upload File" or "External URL" to attach media instead.
                          </div>
                        ) : (
                          <div className="form-group">
                            <select
                              className="form-control"
                              value={msg.selectedMediaId || ''}
                              onChange={(e) => {
                                const prod = libraryMedias.find(p => p.id === e.target.value);
                                if (prod) {
                                  updateMessage(index, {
                                    selectedMediaId: prod.id,
                                    media_url: prod.media_url || '',
                                    media_type: prod.media_type || 'text'
                                  });
                                }
                              }}
                            >
                              <option value="" disabled>-- Select Media Product --</option>
                              {libraryMedias.map(prod => (
                                <option key={prod.id} value={prod.id}>
                                  {prod.name} ({prod.media_type})
                                </option>
                              ))}
                            </select>
                          </div>
                        )}

                        {msg.media_url && (
                          <div style={{ marginTop: '12px', padding: '12px', border: '1px solid var(--border-color)', borderRadius: '6px', backgroundColor: 'rgba(255,255,255,0.01)' }}>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Library Media Preview ({msg.media_type}):</span>
                            <div style={{ marginTop: '8px' }}>
                              {msg.media_type === 'image' && (
                                <img src={msg.media_url} alt="Library Image Preview" style={{ maxHeight: '120px', borderRadius: '4px', border: '1px solid var(--border-color)' }} />
                              )}
                              {msg.media_type === 'video' && (
                                <video src={msg.media_url} controls style={{ maxHeight: '120px', borderRadius: '4px' }} />
                              )}
                              {msg.media_type !== 'image' && msg.media_type !== 'video' && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}>
                                  <span>📎</span>
                                  <a href={msg.media_url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary-color)', textDecoration: 'underline' }}>
                                    {msg.media_url.split('/').pop() || 'Preview file'}
                                  </a>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Tab 3: Upload File */}
                    {msg.mediaSourceType === 'upload' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div className="form-group">
                          <input
                            type="file"
                            className="form-control"
                            accept="image/*,video/*,audio/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                            onChange={(e) => handleFileUpload(index, e.target.files)}
                            disabled={msg.uploading}
                          />
                        </div>
                        {msg.uploading && (
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                            ⏳ Uploading file to secure bucket...
                          </div>
                        )}
                        {!msg.uploading && msg.media_url && (
                          <div style={{ padding: '12px', border: '1px solid var(--border-color)', borderRadius: '6px', backgroundColor: 'rgba(255,255,255,0.01)' }}>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Uploaded Media Preview ({msg.media_type}):</span>
                            <div style={{ marginTop: '8px' }}>
                              {msg.media_type === 'image' && (
                                <img src={msg.media_url} alt="Uploaded Image Preview" style={{ maxHeight: '120px', borderRadius: '4px', border: '1px solid var(--border-color)' }} />
                              )}
                              {msg.media_type === 'video' && (
                                <video src={msg.media_url} controls style={{ maxHeight: '120px', borderRadius: '4px' }} />
                              )}
                              {msg.media_type !== 'image' && msg.media_type !== 'video' && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}>
                                  <span>📎</span>
                                  <a href={msg.media_url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary-color)', textDecoration: 'underline' }}>
                                    Uploaded File Link
                                  </a>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Tab 4: External URL */}
                    {msg.mediaSourceType === 'url' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                          <div className="form-group" style={{ flex: '2 1 200px' }}>
                            <label className="form-label" style={{ fontSize: '0.75rem' }}>External Media URL</label>
                            <input
                              type="url"
                              className="form-control"
                              placeholder="https://example.com/image.jpg"
                              value={msg.media_url}
                              onChange={(e) => updateMessage(index, { media_url: e.target.value })}
                            />
                          </div>
                          <div className="form-group" style={{ flex: '1 1 100px' }}>
                            <label className="form-label" style={{ fontSize: '0.75rem' }}>Media Type</label>
                            <select
                              className="form-control"
                              value={msg.media_type}
                              onChange={(e) => updateMessage(index, { media_type: e.target.value })}
                            >
                              <option value="image">Image</option>
                              <option value="video">Video</option>
                              <option value="audio">Audio</option>
                              <option value="document">Document</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {campaignType === 1 && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ width: '100%', padding: '10px', borderStyle: 'dashed' }}
                  onClick={addMessage}
                >
                  ➕ Add Another Message
                </button>
              )}
            </div>
          </div>
        )}

        {/* STEP 3: Select WhatsApp Session */}
        {currentStep === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <h3>Step 3: Select WhatsApp Session</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              Select the active WhatsApp session/phone number to send these campaign messages.
            </p>
            {instances.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                No WhatsApp sessions linked. Please configure a session in your settings page first.
              </div>
            ) : (
              <div className="form-group">
                <label className="form-label">WhatsApp Session</label>
                <select
                  className="form-control"
                  value={selectedInstanceId}
                  onChange={(e) => setSelectedInstanceId(e.target.value)}
                  required
                >
                  <option value="" disabled>-- Select WhatsApp Session --</option>
                  {instances.map((inst) => (
                    <option key={inst.id} value={inst.id}>
                      {inst.name} ({inst.phone}) • {inst.status}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}

        {/* STEP 4: Select Target Recipients */}
        {currentStep === 4 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div>
              <h3>Step 4: Select Target Recipients</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                Choose how you want to target recipients for this campaign.
              </p>
            </div>

            {/* Recipient Mode Tabs */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
              {([
                { mode: 'registered', label: 'Registered List' },
                { mode: 'create_list', label: 'Create Inline List' },
                { mode: 'select_groups', label: 'Select Groups' },
                { mode: 'direct_numbers', label: 'Direct Numbers' },
              ] as const).map(({ mode, label }) => {
                const isActive = recipientMode === mode;
                return (
                  <button
                    key={mode}
                    type="button"
                    className={`btn ${isActive ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ padding: '8px 16px', fontSize: '0.8rem', flex: '1 1 0px', minWidth: '140px' }}
                    onClick={() => setRecipientMode(mode)}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            {/* Registered List Selector */}
            {recipientMode === 'registered' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {groupLists.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', border: '1px dashed var(--border-color)', borderRadius: '6px' }}>
                    No registered Group Lists found. <Link href="/campaigns/groups" target="_blank" style={{ color: 'var(--color-primary)', textDecoration: 'underline' }}>Create one here</Link> or use another targeting mode.
                  </div>
                ) : (
                  <div className="form-group">
                    <label className="form-label">Saved Group List</label>
                    <select
                      className="form-control"
                      value={selectedGroupListId}
                      onChange={(e) => setSelectedGroupListId(e.target.value)}
                      required
                    >
                      <option value="" disabled>-- Select Group List --</option>
                      {groupLists.map((list) => (
                        <option key={list.id} value={list.id}>
                          {list.name} ({list.itemCount} groups)
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}

            {/* Create Inline List Form */}
            {recipientMode === 'create_list' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="form-group">
                    <label className="form-label">New List Name *</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. VIP Clients, Broadcast Target"
                      value={newListName}
                      onChange={(e) => setNewListName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Description (Optional)</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. Saved inline during wizard setup"
                      value={newListDescription}
                      onChange={(e) => setNewListDescription(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Select Groups to Add *</label>
                  {loadingGroups ? (
                    <div style={{ padding: '20px', color: 'var(--text-secondary)', textAlign: 'center' }}>
                      Loading WhatsApp groups from session...
                    </div>
                  ) : instanceGroups.length === 0 ? (
                    <div style={{ padding: '20px', color: 'var(--text-muted)', border: '1px dashed var(--border-color)', borderRadius: '6px', textAlign: 'center' }}>
                      No WhatsApp groups found in this session.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {/* Search & Bulk toggles */}
                      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="🔍 Search groups by name..."
                          style={{ flex: 1, padding: '6px 12px', fontSize: '0.85rem' }}
                          value={groupSearchQuery}
                          onChange={(e) => setGroupSearchQuery(e.target.value)}
                        />
                        <button
                          type="button"
                          className="btn btn-secondary"
                          style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                          onClick={() => {
                            const filtered = instanceGroups.filter(g => g.name?.toLowerCase().includes(groupSearchQuery.toLowerCase()));
                            const filteredJids = filtered.map(g => g.jid);
                            setNewListGroupJids(prev => Array.from(new Set([...prev, ...filteredJids])));
                          }}
                        >
                          Select All (Filtered)
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          style={{ padding: '6px 12px', fontSize: '0.8rem', borderColor: '#ef4444', color: '#ef4444' }}
                          onClick={() => {
                            const filtered = instanceGroups.filter(g => g.name?.toLowerCase().includes(groupSearchQuery.toLowerCase()));
                            const filteredJids = filtered.map(g => g.jid);
                            setNewListGroupJids(prev => prev.filter(jid => !filteredJids.includes(jid)));
                          }}
                        >
                          Deselect All (Filtered)
                        </button>
                      </div>

                      <div className="table-responsive" style={{ maxHeight: '250px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '6px' }}>
                        <table className="table">
                          <thead>
                            <tr>
                              <th style={{ width: '40px' }}>Select</th>
                              <th>Group Name</th>
                              <th>JID</th>
                              <th>Participants</th>
                            </tr>
                          </thead>
                          <tbody>
                            {instanceGroups
                              .filter(g => g.name?.toLowerCase().includes(groupSearchQuery.toLowerCase()))
                              .map((group) => {
                                const isChecked = newListGroupJids.includes(group.jid);
                                return (
                                  <tr 
                                    key={group.jid} 
                                    style={{ cursor: 'pointer', backgroundColor: isChecked ? 'rgba(16, 185, 129, 0.03)' : 'transparent' }}
                                    onClick={() => {
                                      if (isChecked) {
                                        setNewListGroupJids(prev => prev.filter(id => id !== group.jid));
                                      } else {
                                        setNewListGroupJids(prev => [...prev, group.jid]);
                                      }
                                    }}
                                  >
                                    <td>
                                      <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={() => {}} // handled by row click
                                        style={{ cursor: 'pointer' }}
                                      />
                                    </td>
                                    <td style={{ fontWeight: 600 }}>{group.name || 'Unnamed Group'}</td>
                                    <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{group.jid}</td>
                                    <td>
                                      <span className="badge badge-secondary">{group.participantCount || 0}</span>
                                    </td>
                                  </tr>
                                );
                              })}
                          </tbody>
                        </table>
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        Selected: <strong>{newListGroupJids.length}</strong> group(s)
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Select Groups Directly */}
            {recipientMode === 'select_groups' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">Select Target Groups *</label>
                  {loadingGroups ? (
                    <div style={{ padding: '20px', color: 'var(--text-secondary)', textAlign: 'center' }}>
                      Loading WhatsApp groups from session...
                    </div>
                  ) : instanceGroups.length === 0 ? (
                    <div style={{ padding: '20px', color: 'var(--text-muted)', border: '1px dashed var(--border-color)', borderRadius: '6px', textAlign: 'center' }}>
                      No WhatsApp groups found in this session.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {/* Search & Bulk toggles */}
                      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="🔍 Search groups by name..."
                          style={{ flex: 1, padding: '6px 12px', fontSize: '0.85rem' }}
                          value={groupSearchQuery}
                          onChange={(e) => setGroupSearchQuery(e.target.value)}
                        />
                        <button
                          type="button"
                          className="btn btn-secondary"
                          style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                          onClick={() => {
                            const filtered = instanceGroups.filter(g => g.name?.toLowerCase().includes(groupSearchQuery.toLowerCase()));
                            const filteredJids = filtered.map(g => g.jid);
                            setSelectedGroupJids(prev => Array.from(new Set([...prev, ...filteredJids])));
                          }}
                        >
                          Select All (Filtered)
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          style={{ padding: '6px 12px', fontSize: '0.8rem', borderColor: '#ef4444', color: '#ef4444' }}
                          onClick={() => {
                            const filtered = instanceGroups.filter(g => g.name?.toLowerCase().includes(groupSearchQuery.toLowerCase()));
                            const filteredJids = filtered.map(g => g.jid);
                            setSelectedGroupJids(prev => prev.filter(jid => !filteredJids.includes(jid)));
                          }}
                        >
                          Deselect All (Filtered)
                        </button>
                      </div>

                      <div className="table-responsive" style={{ maxHeight: '250px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '6px' }}>
                        <table className="table">
                          <thead>
                            <tr>
                              <th style={{ width: '40px' }}>Select</th>
                              <th>Group Name</th>
                              <th>JID</th>
                              <th>Participants</th>
                            </tr>
                          </thead>
                          <tbody>
                            {instanceGroups
                              .filter(g => g.name?.toLowerCase().includes(groupSearchQuery.toLowerCase()))
                              .map((group) => {
                                const isChecked = selectedGroupJids.includes(group.jid);
                                return (
                                  <tr 
                                    key={group.jid} 
                                    style={{ cursor: 'pointer', backgroundColor: isChecked ? 'rgba(16, 185, 129, 0.03)' : 'transparent' }}
                                    onClick={() => {
                                      if (isChecked) {
                                        setSelectedGroupJids(prev => prev.filter(id => id !== group.jid));
                                      } else {
                                        setSelectedGroupJids(prev => [...prev, group.jid]);
                                      }
                                    }}
                                  >
                                    <td>
                                      <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={() => {}} // handled by row click
                                        style={{ cursor: 'pointer' }}
                                      />
                                    </td>
                                    <td style={{ fontWeight: 600 }}>{group.name || 'Unnamed Group'}</td>
                                    <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{group.jid}</td>
                                    <td>
                                      <span className="badge badge-secondary">{group.participantCount || 0}</span>
                                    </td>
                                  </tr>
                                );
                              })}
                          </tbody>
                        </table>
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        Selected: <strong>{selectedGroupJids.length}</strong> group(s)
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Direct Numbers Input */}
            {recipientMode === 'direct_numbers' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">WhatsApp Numbers *</label>
                  <textarea
                    className="form-control"
                    rows={6}
                    placeholder="Enter phone numbers here. E.g.
+1 (555) 123-4567
+44 7123 456789
1234567890

Supported formats: one per line, comma-separated, or semicolon-separated. Non-numeric characters will be stripped automatically."
                    value={directNumbersText}
                    onChange={(e) => setDirectNumbersText(e.target.value)}
                    required
                  />
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                    💡 Tip: Standard individual numbers will be sent directly. Make sure to include international country codes!
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* STEP 5: Delay rules & start time */}
        {currentStep === 5 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <h3>Step 5: Delays & Timing Rules (Anti-Ban)</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              Define randomized delays to prevent spam detection and protect your WhatsApp account.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label">Min Delay (Seconds) *</label>
                <input
                  type="number"
                  className="form-control"
                  value={delayMin}
                  onChange={(e) => setDelayMin(parseInt(e.target.value) || 0)}
                  min="5"
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Max Delay (Seconds) *</label>
                <input
                  type="number"
                  className="form-control"
                  value={delayMax}
                  onChange={(e) => setDelayMax(parseInt(e.target.value) || 0)}
                  min="5"
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" style={{ marginBottom: '8px', display: 'block' }}>Campaign Start Time Mode</label>
              <div style={{ display: 'flex', gap: '16px', marginBottom: '12px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="startType"
                    checked={startType === 'immediate'}
                    onChange={() => setStartType('immediate')}
                  />
                  Start Immediately
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="startType"
                    checked={startType === 'scheduled'}
                    onChange={() => setStartType('scheduled')}
                  />
                  Schedule Start Time
                </label>
              </div>

              {startType === 'scheduled' && (
                <input
                  type="datetime-local"
                  className="form-control"
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                  required={startType === 'scheduled'}
                  style={{ width: '250px' }}
                />
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Start Time Jitter (Seconds)</label>
              <input
                type="number"
                className="form-control"
                value={jitter}
                onChange={(e) => setJitter(parseInt(e.target.value) || 0)}
                style={{ width: '250px' }}
              />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                Applies a random offset of ± {jitter} seconds to the scheduled start time for human-like inconsistency.
              </span>
            </div>

            <div className="form-group" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
              <label className="form-label" style={{ marginBottom: '8px', display: 'block' }}>Wave Scheduling Mode</label>
              <div style={{ display: 'flex', gap: '16px', marginBottom: '12px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="schedulingMode"
                    checked={schedulingMode === 'automatic'}
                    onChange={() => setSchedulingMode('automatic')}
                  />
                  Automatic Wave Delays (Inter-wave pause)
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="schedulingMode"
                    checked={schedulingMode === 'manual'}
                    onChange={() => setSchedulingMode('manual')}
                  />
                  Manual Wave Scheduling (Specify wave times)
                </label>
              </div>
            </div>

            {schedulingMode === 'automatic' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', padding: '16px', border: '1px dashed var(--border-color)', borderRadius: '6px', backgroundColor: 'rgba(255,255,255,0.01)' }}>
                <div className="form-group">
                  <label className="form-label">Min Inter-wave Delay (Seconds) *</label>
                  <input
                    type="number"
                    className="form-control"
                    value={waveDelayMin}
                    onChange={(e) => setWaveDelayMin(parseInt(e.target.value) || 0)}
                    min="5"
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Max Inter-wave Delay (Seconds) *</label>
                  <input
                    type="number"
                    className="form-control"
                    value={waveDelayMax}
                    onChange={(e) => setWaveDelayMax(parseInt(e.target.value) || 0)}
                    min="5"
                    required
                  />
                </div>
                <span style={{ gridColumn: 'span 2', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Interval gap pause delay applied between waves (finished sending Wave N, waiting before starting Wave N+1).
                </span>
              </div>
            )}

            {schedulingMode === 'manual' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '16px', border: '1px dashed var(--border-color)', borderRadius: '6px', backgroundColor: 'rgba(255,255,255,0.01)' }}>
                <h4 style={{ margin: 0 }}>Per-Wave Manual Start Times</h4>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', margin: 0 }}>
                  Define the exact start datetime for each product message wave. The intra-wave limits above will apply between group dispatches.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '8px' }}>
                  {customMessages.map((msg, i) => (
                    <div key={i} className="form-group" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px' }}>
                      <span style={{ minWidth: '80px', fontWeight: 600, fontSize: '0.85rem' }}>Wave #{i + 1}:</span>
                      <input
                        type="datetime-local"
                        className="form-control"
                        value={waveStartTimes[i] || ''}
                        onChange={(e) => setWaveStartTimes(prev => prev.map((t, idx) => idx === i ? e.target.value : t))}
                        required
                        style={{ width: '250px' }}
                      />
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        (Est. finish: {formatEstimatedWaveEnd(i)})
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ marginTop: '12px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}
                onClick={() => setShowTimelinePreview(prev => !prev)}
              >
                {showTimelinePreview ? 'Hide Schedule Simulation ▲' : 'Show Schedule Simulation Preview ▼'}
              </button>

              {showTimelinePreview && (
                <div style={{ marginTop: '12px', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '16px', backgroundColor: 'rgba(255,255,255,0.02)' }}>
                  <h4 style={{ marginTop: 0 }}>Simulated Campaign Timeline (Average Delays)</h4>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginBottom: '12px' }}>
                    Note: Actual sending order of groups is randomized per wave at dispatch time.
                  </p>
                  
                  {getSimulatedTimeline().length === 0 ? (
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textAlign: 'center', padding: '12px' }}>
                      Please select recipients and configure messages to view simulation preview.
                    </div>
                  ) : (
                    <>
                      <div style={{ maxHeight: '250px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '4px' }}>
                        <table style={{ width: '100%', fontSize: '0.8rem', borderCollapse: 'collapse' }}>
                          <thead>
                            <tr style={{ backgroundColor: 'rgba(255,255,255,0.03)', textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>
                              <th style={{ padding: '8px' }}>Wave</th>
                              <th style={{ padding: '8px' }}>Target Group / Pause</th>
                              <th style={{ padding: '8px' }}>Estimated Time</th>
                              <th style={{ padding: '8px' }}>Message Preview</th>
                            </tr>
                          </thead>
                          <tbody>
                            {getSimulatedTimeline().map((item, idx) => (
                              <tr key={idx} style={{ 
                                borderBottom: '1px solid rgba(255,255,255,0.02)',
                                backgroundColor: item.isPause ? 'rgba(255, 193, 7, 0.03)' : 'transparent',
                                color: item.isPause ? '#ffc107' : 'inherit'
                              }}>
                                <td style={{ padding: '8px', fontWeight: 600 }}>{item.isPause ? 'Pause' : item.wave}</td>
                                <td style={{ padding: '8px' }}>{item.group}</td>
                                <td style={{ padding: '8px' }}>{item.estimatedTime.toLocaleString()}</td>
                                <td style={{ padding: '8px', color: 'var(--text-secondary)' }}>{item.message}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div style={{ marginTop: '12px', fontSize: '0.8rem', display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                        <span>Total Messages: <strong>{getSimulatedTimeline().filter(i => !i.isPause).length}</strong></span>
                        <span>Estimated Campaign Run Duration: <strong>{formatEstimatedDuration()}</strong></span>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* STEP 6: Summary & Launch */}
        {currentStep === 6 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <h3>Step 6: Review Summary & Launch</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              Confirm your campaign parameters before scheduling the broadcast events.
            </p>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                padding: '16px',
                borderRadius: '8px',
                backgroundColor: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid var(--border-color)',
              }}
            >
              <div>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Campaign Name:</span>
                <div style={{ fontWeight: 600, fontSize: '1.1rem' }}>{name}</div>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Type:</span>
                <div>
                  <strong>{campaignType === 2 ? 'Broadcast (Type 2)' : 'Bulk Product (Type 1)'}</strong>
                </div>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Products to Send:</span>
                <div>{summaryProductNames}</div>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Targeting Group List:</span>
                <div>{summaryGroupListName}</div>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>WhatsApp Account:</span>
                <div>{summaryInstanceName}</div>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Delay Bounds (Intra-wave):</span>
                <div>
                  Randomized delay between <strong>{delayMin}</strong> and <strong>{delayMax}</strong> seconds
                </div>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Wave Delay Bounds & Mode:</span>
                <div>
                  Scheduling Mode: <strong>{schedulingMode === 'automatic' ? 'Automatic Wave Delays' : 'Manual Wave Scheduling'}</strong>
                  {schedulingMode === 'automatic' && (
                    <span> (Randomized wave pause between <strong>{waveDelayMin}</strong> and <strong>{waveDelayMax}</strong> seconds)</span>
                  )}
                </div>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Start Time:</span>
                <div>
                  {startType === 'immediate'
                    ? 'Start Immediately (with random ± jitter)'
                    : `Scheduled for ${new Date(scheduledTime).toLocaleString()} (with random ± jitter)`}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Navigation Buttons */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginTop: '32px',
            borderTop: '1px solid var(--border-color)',
            paddingTop: '20px',
          }}
        >
          {currentStep > 1 ? (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleBack}
              disabled={submitting}
            >
              Back
            </button>
          ) : (
            <Link href="/campaigns" className="btn btn-secondary">
              Cancel
            </Link>
          )}

          {currentStep < 6 ? (
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleNext}
              disabled={isUploadingAny}
            >
              {isUploadingAny ? 'Uploading...' : 'Next Step'}
            </button>
          ) : (
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => handleSubmit('draft')}
                disabled={submitting || isUploadingAny}
                style={{ border: '1px solid var(--border-color)' }}
              >
                Save as Draft 💾
              </button>
              {startType === 'scheduled' ? (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => handleSubmit('scheduled')}
                  disabled={submitting || isUploadingAny}
                >
                  {submitting ? 'Scheduling...' : 'Schedule Campaign 📅'}
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => handleSubmit('running')}
                  disabled={submitting || isUploadingAny}
                >
                  {submitting ? 'Launching...' : 'Save & Launch Immediately 🚀'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
