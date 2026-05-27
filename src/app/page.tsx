'use client';

import React, { useState } from 'react';
import { DashboardProvider, useDashboard, WhatsAppSession, Group, GroupMember, Message, AutomationWorkflow, AutomationAction } from '@/context/dashboard-context';
import DashboardSidebar from '@/components/dashboard-sidebar';
import ActivityChart from '@/components/charts/activity-chart';
import DragDropUploader from '@/components/ui/drag-drop-uploader';
import { 
  Users, 
  MessageSquare, 
  Plus, 
  RefreshCw, 
  Key, 
  Download, 
  Trash2, 
  Clock, 
  Eye, 
  Image as ImageIcon, 
  FileText, 
  Send,
  Zap,
  Info,
  CheckCircle,
  Play,
  Loader2
} from 'lucide-react';
import * as XLSX from 'xlsx';

// ----------------------------------------------------------------------------
// MAIN DASHBOARD INNER COMPONENT
// ----------------------------------------------------------------------------
function DashboardContent() {
  const [activeTab, setActiveTab] = useState<string>('overview');
  const {
    tenantId,
    isMockMode,
    sessions,
    groups,
    groupMembers,
    messages,
    workflows,
    isLoading,
    activeSessionId,
    setActiveSessionId,
    createSession,
    connectSession,
    syncGroups,
    addWorkflow,
    deleteWorkflow,
    toggleWorkflow,
    triggerIncomingDemoMessage,
    signIn,
    signUp,
    logOut
  } = useDashboard();

  // Auth Form State
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);
  const [isSignUpMode, setIsSignUpMode] = useState<boolean>(false);
  const [authEmail, setAuthEmail] = useState<string>('');
  const [authPassword, setAuthPassword] = useState<string>('');
  const [authName, setAuthName] = useState<string>('');
  const [authLoading, setAuthLoading] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const handleLogout = async () => {
    try {
      await logOut();
      alert('Switched back to Local Simulation Mode.');
    } catch (err: any) {
      alert(`Logout failed: ${err.message}`);
    }
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError(null);
    try {
      if (isSignUpMode) {
        await signUp(authEmail, authPassword, authName);
        alert('Account created! Welcome to WatsFlow.');
      } else {
        await signIn(authEmail, authPassword);
        alert('Connected to your real Supabase database successfully!');
      }
      setShowAuthModal(false);
      setAuthEmail('');
      setAuthPassword('');
      setAuthName('');
    } catch (err: any) {
      setAuthError(err.message || 'Authentication failed');
    } finally {
      setAuthLoading(false);
    }
  };

  // Active Session Details
  const activeSession = sessions.find(s => s.id === activeSessionId) || sessions[0] || null;

  // Overview Stats
  const totalSessions = sessions.length;
  const activeGroups = groups.length;
  const totalWorkflows = workflows.length;
  const totalMessages = messages.length;

  // Sync state helpers
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [qrCode, setQrCode] = useState<string | null>(null);

  // New Session Form State
  const [newSessionName, setNewSessionName] = useState<string>('');
  const [newSessionPhone, setNewSessionPhone] = useState<string>('');
  const [showAddSessionModal, setShowAddSessionModal] = useState<boolean>(false);

  // New Workflow Form State
  const [newWfName, setNewWfName] = useState<string>('');
  const [newWfKeyword, setNewWfKeyword] = useState<string>('');
  const [newActionType, setNewActionType] = useState<'send_text' | 'send_image' | 'send_document'>('send_text');
  const [newActionBody, setNewActionBody] = useState<string>('');
  const [newActionDelay, setNewActionDelay] = useState<number>(1);
  const [uploadedUrl, setUploadedUrl] = useState<string>('');
  const [uploadedFileName, setUploadedFileName] = useState<string>('');

  // Group Details Modal State
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);

  // Simulator Message Input State
  const [demoInput, setDemoInput] = useState<string>('');
  const [demoSenderPhone, setDemoSenderPhone] = useState<string>('+19876543');

  // Trigger manual sync
  const handleSyncGroups = async () => {
    if (!activeSession) return;
    setIsSyncing(true);
    try {
      await syncGroups(activeSession.id);
      alert('Group members synchronized successfully!');
    } catch (err: any) {
      alert(`Sync failed: ${err.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  // Trigger manual connect
  const handleConnectSession = async (id: string) => {
    setIsConnecting(true);
    setQrCode(null);
    try {
      const res = await connectSession(id);
      if (res.qrCode) {
        setQrCode(res.qrCode);
      }
    } catch (err: any) {
      alert(`Connection failed: ${err.message}`);
    } finally {
      setIsConnecting(false);
    }
  };

  // Handle Add Session Submission
  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSessionName || !newSessionPhone) return;
    try {
      await createSession(newSessionName, newSessionPhone);
      setNewSessionName('');
      setNewSessionPhone('');
      setShowAddSessionModal(false);
    } catch (err: any) {
      alert(`Failed to create session: ${err.message}`);
    }
  };

  // Handle Add Workflow Automation
  const handleAddWorkflow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWfName || !newWfKeyword) return;

    try {
      const action = {
        action_type: newActionType,
        message_body: newActionBody,
        media_url: uploadedUrl || undefined,
        delay_seconds: newActionDelay,
        action_order: 1
      };

      await addWorkflow(newWfName, newWfKeyword, [action]);
      
      // Reset form
      setNewWfName('');
      setNewWfKeyword('');
      setNewActionBody('');
      setNewActionDelay(1);
      setUploadedUrl('');
      setUploadedFileName('');
      alert('Workflow automation created successfully!');
    } catch (err: any) {
      alert(`Failed to save automation: ${err.message}`);
    }
  };

  // TRIGGER CSV EXPORT
  const exportToCSV = (group: Group, members: GroupMember[]) => {
    const headers = ['Phone Number', 'Member JID', 'Role', 'Joined At'];
    const rows = members.map(m => [
      m.phone_number,
      m.member_jid,
      m.role,
      new Date(m.joined_at).toLocaleString()
    ]);
    
    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `group_members_${group.name.replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // TRIGGER XLSX EXPORT (SheetJS)
  const exportToXLSX = (group: Group, members: GroupMember[]) => {
    const data = members.map(m => ({
      'Phone Number': m.phone_number,
      'Member JID': m.member_jid,
      'Role': m.role,
      'Joined At': new Date(m.joined_at).toLocaleString()
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Group Members");
    XLSX.writeFile(workbook, `group_members_${group.name.replace(/\s+/g, '_')}.xlsx`);
  };

  // Handle Demo Chat Send Trigger
  const handleSendDemoMessage = () => {
    if (!demoInput) return;
    triggerIncomingDemoMessage(demoInput, demoSenderPhone);
    setDemoInput('');
  };

  if (isLoading) {
    return (
      <div className="flex h-screen bg-zinc-950 items-center justify-center text-white">
        <div className="flex flex-col items-center space-y-4">
          <RefreshCw className="w-10 h-10 text-emerald-400 animate-spin" />
          <p className="text-sm font-medium text-zinc-400">Loading WatsFlow Dashboard state...</p>
        </div>
      </div>
    );
  }

  // Get active session message list
  const activeSessionMessages = messages.slice(-50); // limit to last 50 for rendering performance

  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-100 overflow-hidden font-sans">
      {/* Sidebar Component */}
      <DashboardSidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        isMockMode={isMockMode} 
        onAuthClick={() => setShowAuthModal(true)}
        onLogout={handleLogout}
      />

      {/* Main Layout Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto bg-zinc-950 p-8">
        {/* Header */}
        <header className="flex justify-between items-center mb-8 pb-5 border-b border-zinc-900">
          <div>
            <h2 className="text-2xl font-bold text-white tracking-tight">
              {activeTab === 'overview' && 'Dashboard Overview'}
              {activeTab === 'sessions' && 'WhatsApp Sessions'}
              {activeTab === 'groups' && 'WhatsApp Groups & Members'}
              {activeTab === 'automations' && 'Chatbot Workflows'}
              {activeTab === 'analytics' && 'Activity Rate & Progression Analytics'}
            </h2>
            <p className="text-zinc-500 text-xs mt-1">
              {activeTab === 'overview' && 'Live logs, automation statistics, and sandbox simulator.'}
              {activeTab === 'sessions' && 'Connect and initialize WhatsApp accounts using WatsSender sessions.'}
              {activeTab === 'groups' && 'Manage synchronized groups, display member lists, and export spreadsheets.'}
              {activeTab === 'automations' && 'Create keyword-based triggers with media attachments and typing delays.'}
              {activeTab === 'analytics' && 'Progression rates and participant join/leave activity charts.'}
            </p>
          </div>

          {/* Session Picker */}
          {sessions.length > 0 && (
            <div className="flex items-center space-x-3">
              <span className="text-xs text-zinc-500 font-semibold">Active Session:</span>
              <select
                value={activeSessionId || ''}
                onChange={(e) => setActiveSessionId(e.target.value)}
                className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2 text-xs font-semibold text-white focus:outline-none focus:border-emerald-500 transition-colors"
              >
                {sessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.phone_number})
                  </option>
                ))}
              </select>
            </div>
          )}
        </header>

        {/* ------------------------------------------------------------------
            TAB: OVERVIEW
            ------------------------------------------------------------------ */}
        {activeTab === 'overview' && (
          <div className="space-y-8">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { name: 'Connected Session slots', value: totalSessions, icon: Key, color: 'from-blue-500 to-indigo-600' },
                { name: 'Monitored Groups', value: activeGroups, icon: Users, color: 'from-emerald-500 to-teal-600' },
                { name: 'Keyword Workflows', value: totalWorkflows, icon: Zap, color: 'from-amber-500 to-orange-600' },
                { name: 'Logged Messages', value: totalMessages, icon: MessageSquare, color: 'from-purple-500 to-pink-600' }
              ].map((stat, i) => {
                const Icon = stat.icon;
                return (
                  <div key={i} className="bg-zinc-900 border border-zinc-800/80 rounded-2xl p-6 relative overflow-hidden shadow-xl group hover:border-zinc-700/60 transition-all duration-200">
                    <div className="flex justify-between items-center relative z-10">
                      <div>
                        <p className="text-xs text-zinc-500 font-semibold uppercase tracking-wider">{stat.name}</p>
                        <h4 className="text-3xl font-extrabold text-white mt-2 leading-none">{stat.value}</h4>
                      </div>
                      <div className={`w-10 h-10 rounded-xl bg-gradient-to-tr ${stat.color} flex items-center justify-center text-white shadow-lg`}>
                        <Icon className="w-5 h-5" />
                      </div>
                    </div>
                    {/* Background glow animation */}
                    <div className="absolute -bottom-8 -right-8 w-24 h-24 bg-zinc-800/10 rounded-full blur-2xl group-hover:bg-zinc-800/20 transition-all duration-300" />
                  </div>
                );
              })}
            </div>

            {/* Sandbox Simulator and Message Stream Logs */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
              {/* Message Streams Logs (2/3 width) */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl xl:col-span-2 flex flex-col h-[500px]">
                <div className="flex justify-between items-center mb-4 pb-3 border-b border-zinc-800/60">
                  <div>
                    <h3 className="text-white font-bold text-lg">Live Message Stream</h3>
                    <p className="text-xs text-zinc-500">Real-time incoming and outgoing WhatsApp messages logged to Supabase</p>
                  </div>
                  <span className="text-[10px] text-zinc-400 font-medium bg-zinc-800 px-2 py-0.5 rounded-md border border-zinc-800">
                    Auto Scroll ON
                  </span>
                </div>

                <div className="flex-1 overflow-y-auto space-y-3.5 pr-2">
                  {activeSessionMessages.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-zinc-600 text-xs">
                      No logged messages yet. Use the Simulator on the right to send test messages.
                    </div>
                  ) : (
                    activeSessionMessages.map((msg) => {
                      const isIncoming = msg.direction === 'incoming';
                      return (
                        <div key={msg.id} className={`flex ${isIncoming ? 'justify-start' : 'justify-end'}`}>
                          <div className={`max-w-md rounded-2xl px-4.5 py-3 shadow-md ${
                            isIncoming 
                              ? 'bg-zinc-800 text-zinc-200 border border-zinc-800' 
                              : 'bg-emerald-600 text-white font-medium border border-emerald-500/20'
                          }`}>
                            <div className="flex items-center justify-between space-x-4 mb-1 text-[10px] opacity-60">
                              <span className="font-semibold">{isIncoming ? msg.sender_jid.split('@')[0] : 'Chatbot System'}</span>
                              <span className="flex items-center space-x-1">
                                <Clock className="w-2.5 h-2.5" />
                                <span>{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                              </span>
                            </div>
                            <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.message_body}</p>
                            {msg.media_url && (
                              <div className="mt-2 pt-2 border-t border-zinc-800/40">
                                <a href={msg.media_url} target="_blank" rel="noopener noreferrer" className="flex items-center space-x-1.5 text-xs text-emerald-400 hover:text-emerald-300 font-semibold underline">
                                  {msg.message_type === 'image' ? <ImageIcon className="w-3.5 h-3.5" /> : <FileText className="w-3.5 h-3.5" />}
                                  <span>Download Attachment</span>
                                </a>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Chatbot Sandbox Simulator (1/3 width) */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl flex flex-col h-[500px]">
                <div className="mb-4 pb-3 border-b border-zinc-800/60">
                  <h3 className="text-white font-bold text-lg flex items-center space-x-2">
                    <Play className="w-4 h-4 text-emerald-400 fill-emerald-400" />
                    <span>Chatbot Sandbox Simulator</span>
                  </h3>
                  <p className="text-xs text-zinc-500">Test how your chatbot reacts to keywords or prompts</p>
                </div>

                <div className="flex-1 flex flex-col space-y-4">
                  {/* Simulation Context Warning */}
                  <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-3.5 flex items-start space-x-3">
                    <Info className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <p className="text-[11px] text-zinc-400 leading-relaxed">
                      Entering text here simulates an **incoming** message from a customer. 
                      If it matches an automation keyword, it will fire your action sequence. 
                      Otherwise, it falls back to the context-aware AI.
                    </p>
                  </div>

                  {/* Simulator Controls */}
                  <div className="space-y-3.5">
                    <div>
                      <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block mb-1">Simulated Sender JID</label>
                      <input 
                        type="text" 
                        value={demoSenderPhone}
                        onChange={(e) => setDemoSenderPhone(e.target.value)}
                        placeholder="e.g. +19876543"
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>

                    <div className="flex-1">
                      <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block mb-1">Simulated Message Body</label>
                      <textarea 
                        value={demoInput}
                        onChange={(e) => setDemoInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSendDemoMessage();
                          }
                        }}
                        placeholder="Type 'hello', 'price', or any question..."
                        className="w-full h-32 bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-xs text-white focus:outline-none focus:border-emerald-500 resize-none"
                      />
                    </div>
                  </div>

                  <div className="pt-2">
                    <button
                      onClick={handleSendDemoMessage}
                      disabled={!demoInput}
                      className="w-full flex items-center justify-center space-x-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 disabled:opacity-50 disabled:pointer-events-none text-white text-xs font-bold py-3 rounded-xl transition-all duration-300 shadow-md shadow-emerald-500/10"
                    >
                      <Send className="w-4 h-4" />
                      <span>Send Sandbox Message</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------
            TAB: SESSIONS
            ------------------------------------------------------------------ */}
        {activeTab === 'sessions' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-white font-bold text-lg">Connected Session Slots</h3>
              <button
                onClick={() => setShowAddSessionModal(true)}
                className="flex items-center space-x-2 bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all duration-200"
              >
                <Plus className="w-4 h-4" />
                <span>Create New Session</span>
              </button>
            </div>

            {/* Sessions Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {sessions.map((session) => {
                const isSessionActive = session.id === activeSessionId;
                return (
                  <div 
                    key={session.id} 
                    className={`bg-zinc-900 border rounded-2xl p-6 shadow-xl transition-all duration-200 relative ${
                      isSessionActive ? 'border-emerald-500/40' : 'border-zinc-800'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h4 className="text-white font-bold text-base leading-tight">{session.name}</h4>
                        <p className="text-xs text-zinc-500 mt-0.5">{session.phone_number}</p>
                      </div>
                      <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold border ${
                        session.status === 'connected'
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          : session.status === 'need_scan'
                            ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                            : 'bg-zinc-800 text-zinc-400 border-zinc-800'
                      }`}>
                        {session.status.toUpperCase()}
                      </span>
                    </div>

                    <div className="pt-4 border-t border-zinc-800/60 flex items-center justify-between">
                      <span className="text-[10px] text-zinc-500">
                        Created: {new Date(session.created_at).toLocaleDateString()}
                      </span>

                      <div className="flex space-x-2">
                        {session.status === 'need_scan' && (
                          <button
                            onClick={() => handleConnectSession(session.id)}
                            className="bg-emerald-500 hover:bg-emerald-400 text-white text-[11px] font-bold px-3 py-1.5 rounded-lg transition-colors"
                          >
                            Scan QR Code
                          </button>
                        )}
                        <button
                          onClick={() => setActiveSessionId(session.id)}
                          className={`text-[11px] font-bold px-3 py-1.5 rounded-lg transition-colors ${
                            isSessionActive 
                              ? 'bg-zinc-800 text-zinc-400 pointer-events-none'
                              : 'bg-zinc-800 text-white hover:bg-zinc-700'
                          }`}
                        >
                          Select Session
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* QR Connection Screen Panel */}
            {isConnecting && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 flex flex-col items-center justify-center text-center shadow-xl">
                <Loader2 className="w-10 h-10 text-emerald-400 animate-spin mb-4" />
                <p className="text-sm font-bold text-white">Initializing WatsSender Session Connection...</p>
                <p className="text-xs text-zinc-500 mt-1 max-w-xs">Connecting to WhatsApp Web backend servers. Please wait.</p>
              </div>
            )}

            {qrCode && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 max-w-md mx-auto flex flex-col items-center text-center shadow-xl">
                <div className="mb-4">
                  <h4 className="text-white font-bold text-base">Scan with WhatsApp</h4>
                  <p className="text-xs text-zinc-500 mt-1">Open WhatsApp &gt; Linked Devices &gt; Link a Device</p>
                </div>

                {/* QR Code Graphic Box */}
                <div className="w-56 h-56 bg-white p-4 rounded-xl flex items-center justify-center shadow-inner mb-4 relative">
                  {/* Since QR rendering requires a package, we mock a visual representation containing the scanned code */}
                  <div className="w-full h-full border-4 border-dashed border-zinc-300 flex flex-col items-center justify-center p-2 text-center text-[10px] text-zinc-600 font-bold select-none leading-relaxed">
                    <span className="text-base mb-1">🔗 QR Code</span>
                    <span className="font-mono bg-zinc-100 p-1.5 rounded text-[8px] truncate max-w-full">{qrCode}</span>
                  </div>
                </div>

                <div className="bg-zinc-950 border border-zinc-800 px-4 py-3.5 rounded-xl flex items-start space-x-3 text-left">
                  <Info className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <p className="text-[10px] text-zinc-500 leading-relaxed">
                    This QR code string is generated directly by WatsSender. Scan it on your mobile device. Status updates will automatically reflect on this dashboard once scanned.
                  </p>
                </div>
              </div>
            )}

            {/* Modal: Add Session */}
            {showAddSessionModal && (
              <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md p-6 shadow-2xl">
                  <div className="flex justify-between items-center mb-6 pb-3 border-b border-zinc-800">
                    <h3 className="text-white font-bold text-lg">Create WhatsApp Session</h3>
                    <button 
                      onClick={() => setShowAddSessionModal(false)}
                      className="text-zinc-500 hover:text-white text-xs font-bold"
                    >
                      Close
                    </button>
                  </div>

                  <form onSubmit={handleCreateSession} className="space-y-4">
                    <div>
                      <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block mb-1">Session Name</label>
                      <input 
                        type="text"
                        required
                        value={newSessionName}
                        onChange={(e) => setNewSessionName(e.target.value)}
                        placeholder="e.g. Sales WhatsApp Session"
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block mb-1">Phone Number (International Format)</label>
                      <input 
                        type="text"
                        required
                        value={newSessionPhone}
                        onChange={(e) => setNewSessionPhone(e.target.value)}
                        placeholder="e.g. +1234567890"
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-bold py-3 rounded-xl transition-all duration-200 mt-2 shadow-lg shadow-emerald-500/10"
                    >
                      Initialize Session
                    </button>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ------------------------------------------------------------------
            TAB: GROUPS
            ------------------------------------------------------------------ */}
        {activeTab === 'groups' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-white font-bold text-lg">Monitored Groups</h3>
                <p className="text-xs text-zinc-500">Tracked WhatsApp groups synced with the active phone session</p>
              </div>
              
              <button
                onClick={handleSyncGroups}
                disabled={isSyncing || !activeSession}
                className="flex items-center space-x-2 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-white text-xs font-bold px-4 py-2.5 rounded-xl disabled:opacity-50 transition-all duration-200"
              >
                <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>Sync Groups & Members</span>
              </button>
            </div>

            {/* Groups Table */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-zinc-800 bg-zinc-900/50 text-zinc-500 text-[10px] font-bold uppercase tracking-wider">
                    <th className="p-4">Group Name</th>
                    <th className="p-4">JID (Jabber ID)</th>
                    <th className="p-4">Sync Status</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {groups.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-xs text-zinc-600">
                        No groups found. Please select a connected session and click "Sync Groups & Members" to sync.
                      </td>
                    </tr>
                  ) : (
                    groups.map((group) => {
                      const members = groupMembers[group.id] || [];
                      return (
                        <tr key={group.id} className="border-b border-zinc-800 hover:bg-zinc-900/20 text-xs transition-colors">
                          <td className="p-4 font-bold text-white">{group.name}</td>
                          <td className="p-4 font-mono text-zinc-500 text-[10px]">{group.group_jid}</td>
                          <td className="p-4">
                            <span className="flex items-center space-x-1.5 text-[10px] text-emerald-400 font-semibold">
                              <CheckCircle className="w-3.5 h-3.5" />
                              <span>{members.length} members tracked</span>
                            </span>
                          </td>
                          <td className="p-4 text-right flex justify-end space-x-2">
                            <button
                              onClick={() => setSelectedGroup(group)}
                              className="flex items-center space-x-1 bg-zinc-800 hover:bg-zinc-700 text-white font-bold px-3 py-1.5 rounded-lg transition-colors text-[10px]"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>View Members</span>
                            </button>
                            <button
                              onClick={() => exportToCSV(group, members)}
                              className="flex items-center space-x-1 bg-zinc-800 hover:bg-emerald-950 border border-transparent hover:border-emerald-500/20 text-white font-bold px-3 py-1.5 rounded-lg transition-all text-[10px]"
                            >
                              <Download className="w-3.5 h-3.5" />
                              <span>Export CSV</span>
                            </button>
                            <button
                              onClick={() => exportToXLSX(group, members)}
                              className="flex items-center space-x-1 bg-zinc-800 hover:bg-emerald-950 border border-transparent hover:border-emerald-500/20 text-white font-bold px-3 py-1.5 rounded-lg transition-all text-[10px]"
                            >
                              <Download className="w-3.5 h-3.5" />
                              <span>Export XLSX</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Modal: Group Members Detail view */}
            {selectedGroup && (
              <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-2xl p-6 shadow-2xl flex flex-col max-h-[80vh]">
                  <div className="flex justify-between items-center mb-6 pb-3 border-b border-zinc-800">
                    <div>
                      <h3 className="text-white font-bold text-lg">{selectedGroup.name}</h3>
                      <p className="text-xs text-zinc-500 font-mono mt-0.5">{selectedGroup.group_jid}</p>
                    </div>
                    <button 
                      onClick={() => setSelectedGroup(null)}
                      className="text-zinc-500 hover:text-white text-xs font-bold"
                    >
                      Close
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto space-y-4 pr-1">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="border-b border-zinc-800 bg-zinc-900/50 text-zinc-500 text-[10px] font-bold uppercase tracking-wider">
                            <th className="p-3">Phone</th>
                            <th className="p-3">JID</th>
                            <th className="p-3">Role</th>
                            <th className="p-3">Joined At</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(groupMembers[selectedGroup.id] || []).length === 0 ? (
                            <tr>
                              <td colSpan={4} className="p-6 text-center text-xs text-zinc-600">
                                No participants synchronized.
                              </td>
                            </tr>
                          ) : (
                            (groupMembers[selectedGroup.id] || []).map((m) => (
                              <tr key={m.id} className="border-b border-zinc-800 hover:bg-zinc-900/10 text-xs">
                                <td className="p-3 text-white font-bold">{m.phone_number}</td>
                                <td className="p-3 font-mono text-[10px] text-zinc-500">{m.member_jid}</td>
                                <td className="p-3">
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                    m.role === 'superadmin' || m.role === 'admin'
                                      ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                      : 'bg-zinc-800 text-zinc-400'
                                  }`}>
                                    {m.role.toUpperCase()}
                                  </span>
                                </td>
                                <td className="p-3 text-zinc-500 text-[10px]">
                                  {new Date(m.joined_at).toLocaleDateString()}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ------------------------------------------------------------------
            TAB: AUTOMATIONS
            ------------------------------------------------------------------ */}
        {activeTab === 'automations' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Create Automation Form (1/3 width) */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl h-fit">
              <h3 className="text-white font-bold text-lg mb-4 pb-3 border-b border-zinc-800/60">
                New Keyword Automation
              </h3>

              <form onSubmit={handleAddWorkflow} className="space-y-4">
                <div>
                  <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block mb-1">Workflow Name</label>
                  <input 
                    type="text"
                    required
                    value={newWfName}
                    onChange={(e) => setNewWfName(e.target.value)}
                    placeholder="e.g. Price Catalog Trigger"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block mb-1">Trigger Keyword (Exact Match)</label>
                  <input 
                    type="text"
                    required
                    value={newWfKeyword}
                    onChange={(e) => setNewWfKeyword(e.target.value)}
                    placeholder="e.g. price"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block mb-1.5">Action Response Type</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'send_text', label: 'Text only', icon: MessageSquare },
                      { id: 'send_image', label: 'Image', icon: ImageIcon },
                      { id: 'send_document', label: 'Document', icon: FileText }
                    ].map((type) => {
                      const Icon = type.icon;
                      const isSelected = newActionType === type.id;
                      return (
                        <button
                          key={type.id}
                          type="button"
                          onClick={() => {
                            setNewActionType(type.id as any);
                            setUploadedUrl('');
                            setUploadedFileName('');
                          }}
                          className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-[10px] font-semibold transition-all duration-200 ${
                            isSelected 
                              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
                              : 'bg-zinc-950 border-zinc-800 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300'
                          }`}
                        >
                          <Icon className="w-4 h-4 mb-1" />
                          <span>{type.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Drag and Drop media uploader for image/document actions */}
                {newActionType !== 'send_text' && (
                  <div>
                    <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block mb-1">Drag & Drop Media Attachment</label>
                    <DragDropUploader 
                      tenantId={tenantId}
                      isMockMode={isMockMode}
                      allowedTypes={newActionType === 'send_image' ? 'image/*' : 'application/*'}
                      onUploadSuccess={(url, fn) => {
                        setUploadedUrl(url);
                        setUploadedFileName(fn);
                      }}
                    />
                  </div>
                )}

                <div>
                  <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block mb-1">
                    {newActionType === 'send_text' ? 'Message Body' : 'Caption / Text (Optional)'}
                  </label>
                  <textarea 
                    value={newActionBody}
                    onChange={(e) => setNewActionBody(e.target.value)}
                    placeholder="Enter reply text content..."
                    className="w-full h-24 bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-emerald-500 resize-none"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block mb-1">Simulated Delay (Seconds)</label>
                  <input 
                    type="number"
                    min={0}
                    max={6}
                    value={newActionDelay}
                    onChange={(e) => setNewActionDelay(Number(e.target.value))}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-bold py-3 rounded-xl transition-all duration-200 shadow-md shadow-emerald-500/10"
                >
                  Save Workflow
                </button>
              </form>
            </div>

            {/* List Active Workflows (2/3 width) */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl lg:col-span-2">
              <h3 className="text-white font-bold text-lg mb-4 pb-3 border-b border-zinc-800/60">
                Active Keyword Automation Workflows
              </h3>

              <div className="space-y-4">
                {workflows.length === 0 ? (
                  <div className="py-12 text-center text-xs text-zinc-600">
                    No workflows created yet. Build your first workflow in the sidebar on the left.
                  </div>
                ) : (
                  workflows.map((wf) => (
                    <div key={wf.id} className="bg-zinc-950 border border-zinc-850 rounded-2xl p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:border-zinc-800 transition-colors">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-1.5">
                          <h4 className="text-white font-bold text-sm">{wf.name}</h4>
                          <span className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[9px] font-bold px-2 py-0.5 rounded-full">
                            keyword: "{wf.trigger_value}"
                          </span>
                        </div>

                        {wf.automation_actions.map((act) => (
                          <div key={act.id} className="flex items-center space-x-2 text-xs text-zinc-500 mt-1">
                            <span className="font-semibold text-zinc-400">Response:</span>
                            <span>
                              {act.action_type === 'send_text' && `Text ("${act.message_body?.substring(0, 40)}...")`}
                              {act.action_type === 'send_image' && `Image attachment`}
                              {act.action_type === 'send_document' && `Document attachment`}
                            </span>
                            {act.delay_seconds > 0 && (
                              <span className="text-[10px] text-zinc-600 bg-zinc-900 px-1.5 py-0.5 rounded border border-zinc-850">
                                {act.delay_seconds}s delay
                              </span>
                            )}
                          </div>
                        ))}
                      </div>

                      <div className="flex items-center space-x-3 self-end md:self-center">
                        {/* Toggle active switch */}
                        <button
                          onClick={() => toggleWorkflow(wf.id)}
                          className={`text-[10px] font-bold px-3 py-1.5 rounded-lg border transition-all ${
                            wf.is_active
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'
                              : 'bg-zinc-900 text-zinc-500 border-zinc-850 hover:bg-zinc-850'
                          }`}
                        >
                          {wf.is_active ? 'ACTIVE' : 'INACTIVE'}
                        </button>
                        
                        {/* Delete button */}
                        <button
                          onClick={() => deleteWorkflow(wf.id)}
                          className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-850 hover:bg-red-500/10 hover:border-red-500/20 text-zinc-500 hover:text-red-400 flex items-center justify-center transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------
            TAB: ANALYTICS
            ------------------------------------------------------------------ */}
        {activeTab === 'analytics' && (
          <div className="space-y-6">
            {/* Sync manual logs trigger warning */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl">
              <h4 className="text-white font-bold text-base mb-1">WhatsApp Analytics Dashboard</h4>
              <p className="text-xs text-zinc-500 mb-4 leading-relaxed">
                Progression metrics are pulled in real-time from Supabase log tables. Daily message logs capture incoming events, outgoing chatbot automation loops, and group member progression logs.
              </p>
              
              {/* Render Charts */}
              {/* Prepare simple logs mock for Recharts */}
              <ActivityChart 
                messages={messages} 
                groupLogs={
                  isMockMode 
                    ? [
                        { event_type: 'member_joined', created_at: new Date(Date.now() - 24 * 3600 * 1000).toISOString() },
                        { event_type: 'member_joined', created_at: new Date(Date.now() - 24 * 3600 * 1000).toISOString() },
                        { event_type: 'member_left', created_at: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString() },
                        { event_type: 'member_joined', created_at: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString() },
                        { event_type: 'member_joined', created_at: new Date(Date.now() - 4 * 24 * 3600 * 1000).toISOString() }
                      ]
                    : [] // Real SQL database records loaded in context
                } 
              />
            </div>
          </div>
        )}
      </main>

      {/* Auth Modal Overlay */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-md transition-all duration-300">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8 max-w-md w-full shadow-2xl relative mx-4">
            <button 
              onClick={() => {
                setShowAuthModal(false);
                setAuthError(null);
              }}
              className="absolute top-6 right-6 text-zinc-500 hover:text-white transition-colors cursor-pointer text-sm"
            >
              ✕
            </button>
            
            <div className="mb-6 flex justify-center">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center font-bold text-white text-lg shadow-lg shadow-emerald-500/25">
                W
              </div>
            </div>

            <h3 className="text-xl font-bold text-white text-center mb-1">
              {isSignUpMode ? 'Create WatsFlow Account' : 'Connect Real Database'}
            </h3>
            <p className="text-zinc-400 text-center text-xs mb-6">
              {isSignUpMode 
                ? 'Sign up to map a new tenant and sync live WhatsApp sessions.' 
                : 'Log in to pull dynamic sessions and group activity logs.'}
            </p>

            <form onSubmit={handleAuthSubmit} className="space-y-4">
              {isSignUpMode && (
                <div>
                  <label className="block text-zinc-400 text-[10px] uppercase font-bold tracking-wider mb-1.5">Tenant Name</label>
                  <input 
                    type="text" 
                    required 
                    value={authName}
                    onChange={(e) => setAuthName(e.target.value)}
                    placeholder="e.g. My Agency"
                    className="w-full bg-zinc-950 border border-zinc-800/80 rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>
              )}
              <div>
                <label className="block text-zinc-400 text-[10px] uppercase font-bold tracking-wider mb-1.5">Email Address</label>
                <input 
                  type="email" 
                  required 
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full bg-zinc-950 border border-zinc-800/80 rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>
              <div>
                <label className="block text-zinc-400 text-[10px] uppercase font-bold tracking-wider mb-1.5">Password</label>
                <input 
                  type="password" 
                  required 
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-zinc-950 border border-zinc-800/80 rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>

              {authError && (
                <p className="text-red-400 text-xs text-center font-medium mt-2">{authError}</p>
              )}

              <button 
                type="submit" 
                disabled={authLoading}
                className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all duration-200 shadow-lg shadow-emerald-500/10 cursor-pointer mt-4 flex items-center justify-center"
              >
                {authLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                ) : (
                  isSignUpMode ? 'Sign Up' : 'Log In'
                )}
              </button>
            </form>

            <div className="mt-6 pt-5 border-t border-zinc-800/60 text-center">
              <button 
                onClick={() => {
                  setIsSignUpMode(!isSignUpMode);
                  setAuthError(null);
                }}
                className="text-xs text-zinc-400 hover:text-emerald-400 font-medium transition-colors"
              >
                {isSignUpMode 
                  ? 'Already have an account? Sign In' 
                  : "Don't have an account? Sign Up"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
// ROOT PAGE COMPONENT WRAPPED IN CONTEXT
// ----------------------------------------------------------------------------
export default function DashboardPage() {
  return (
    <DashboardProvider>
      <DashboardContent />
    </DashboardProvider>
  );
}
