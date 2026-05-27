'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

// TYPES
export interface WhatsAppSession {
  id: string;
  name: string;
  phone_number: string;
  status: 'connected' | 'need_scan' | 'connecting' | 'logged_out' | 'expired';
  wats_session_id?: number;
  wats_api_key?: string;
  created_at: string;
}

export interface Chat {
  id: string;
  remote_jid: string;
  name: string;
  is_group: boolean;
  updated_at: string;
}

export interface Message {
  id: string;
  chat_id: string;
  sender_jid: string;
  message_body: string;
  message_type: 'text' | 'image' | 'video' | 'document' | 'audio';
  media_url?: string;
  direction: 'incoming' | 'outgoing';
  created_at: string;
}

export interface Group {
  id: string;
  group_jid: string;
  name: string;
  img_url?: string;
  is_active: boolean;
  members_count?: number;
  updated_at: string;
}

export interface GroupMember {
  id: string;
  group_id: string;
  member_jid: string;
  phone_number: string;
  role: 'member' | 'admin' | 'superadmin';
  joined_at: string;
  left_at?: string | null;
}

export interface AutomationAction {
  id: string;
  workflow_id: string;
  action_type: 'send_text' | 'send_image' | 'send_document';
  message_body?: string;
  media_url?: string;
  delay_seconds: number;
  action_order: number;
}

export interface AutomationWorkflow {
  id: string;
  name: string;
  trigger_type: 'keyword';
  trigger_value: string;
  is_active: boolean;
  automation_actions: AutomationAction[];
}

interface DashboardContextType {
  tenantId: string;
  isMockMode: boolean;
  sessions: WhatsAppSession[];
  groups: Group[];
  groupMembers: Record<string, GroupMember[]>; // group_id -> members
  messages: Message[];
  workflows: AutomationWorkflow[];
  isLoading: boolean;
  activeSessionId: string | null;
  setActiveSessionId: (id: string | null) => void;
  createSession: (name: string, phoneNumber: string) => Promise<any>;
  connectSession: (id: string) => Promise<{ status: string; qrCode: string | null }>;
  syncGroups: (id: string) => Promise<any>;
  addWorkflow: (name: string, keyword: string, actions: Omit<AutomationAction, 'id' | 'workflow_id'>[]) => Promise<any>;
  deleteWorkflow: (id: string) => Promise<any>;
  toggleWorkflow: (id: string) => Promise<any>;
  triggerIncomingDemoMessage: (text: string, fromNumber?: string) => void;
}

const DashboardContext = createContext<DashboardContextType | undefined>(undefined);

const MOCK_TENANT_ID = 'mock-tenant-uuid-12345';

export function DashboardProvider({ children }: { children: React.ReactNode }) {
  const [tenantId, setTenantId] = useState<string>(MOCK_TENANT_ID);
  const [isMockMode, setIsMockMode] = useState<boolean>(true);
  const [sessions, setSessions] = useState<WhatsAppSession[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupMembers, setGroupMembers] = useState<Record<string, GroupMember[]>>({});
  const [messages, setMessages] = useState<Message[]>([]);
  const [workflows, setWorkflows] = useState<AutomationWorkflow[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  // Check if Supabase keys are configured in local environment
  useEffect(() => {
    const checkAuthMode = async () => {
      try {
        const supabaseConfigured =
          process.env.NEXT_PUBLIC_SUPABASE_URL &&
          process.env.NEXT_PUBLIC_SUPABASE_URL !== 'https://your-supabase-project.supabase.co';
        
        if (supabaseConfigured) {
          // Attempt to get active session
          const { data: { session: supabaseSession } } = await supabase.auth.getSession();
          if (supabaseSession?.user) {
            setTenantId(supabaseSession.user.id);
            setIsMockMode(false);
            return;
          }
        }
      } catch (err) {
        console.warn('Failed to initialize real Supabase client, running in local Simulation Mode.');
      }
      setIsMockMode(true);
      setTenantId(MOCK_TENANT_ID);
    };

    checkAuthMode();
  }, []);

  // LOAD DATA (API or LocalStorage Mocks)
  const loadData = () => {
    setIsLoading(true);
    if (isMockMode) {
      // Load mock data from localStorage or create defaults
      const savedSessions = localStorage.getItem('saas_sessions');
      const savedGroups = localStorage.getItem('saas_groups');
      const savedMembers = localStorage.getItem('saas_group_members');
      const savedMessages = localStorage.getItem('saas_messages');
      const savedWorkflows = localStorage.getItem('saas_workflows');

      const defaultSessions: WhatsAppSession[] = savedSessions ? JSON.parse(savedSessions) : [
        {
          id: 'session-1',
          name: 'Main Support Session',
          phone_number: '+15550199',
          status: 'connected',
          created_at: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString(),
        },
        {
          id: 'session-2',
          name: 'Sales Inquiries',
          phone_number: '+15550233',
          status: 'need_scan',
          created_at: new Date().toISOString(),
        }
      ];

      const defaultGroups: Group[] = savedGroups ? JSON.parse(savedGroups) : [
        {
          id: 'group-1',
          group_jid: '120363294819@g.us',
          name: 'Vibe Coders Beta Launch',
          is_active: true,
          members_count: 5,
          updated_at: new Date().toISOString(),
        },
        {
          id: 'group-2',
          group_jid: '120363299999@g.us',
          name: 'Partner Support Group',
          is_active: true,
          members_count: 3,
          updated_at: new Date().toISOString(),
        }
      ];

      const defaultMembers: Record<string, GroupMember[]> = savedMembers ? JSON.parse(savedMembers) : {
        'group-1': [
          { id: 'm-1', group_id: 'group-1', member_jid: '123@lid', phone_number: '+12345678', role: 'superadmin', joined_at: new Date().toISOString() },
          { id: 'm-2', group_id: 'group-1', member_jid: '456@lid', phone_number: '+98765432', role: 'admin', joined_at: new Date().toISOString() },
          { id: 'm-3', group_id: 'group-1', member_jid: '789@lid', phone_number: '+55511223', role: 'member', joined_at: new Date().toISOString() },
          { id: 'm-4', group_id: 'group-1', member_jid: '101@lid', phone_number: '+55544332', role: 'member', joined_at: new Date(Date.now() - 24 * 3600 * 1000).toISOString() },
          { id: 'm-5', group_id: 'group-1', member_jid: '102@lid', phone_number: '+55599887', role: 'member', joined_at: new Date(Date.now() - 48 * 3600 * 1000).toISOString() },
        ],
        'group-2': [
          { id: 'm-6', group_id: 'group-2', member_jid: '999@lid', phone_number: '+11122233', role: 'admin', joined_at: new Date().toISOString() },
          { id: 'm-7', group_id: 'group-2', member_jid: '888@lid', phone_number: '+44455566', role: 'member', joined_at: new Date().toISOString() },
          { id: 'm-8', group_id: 'group-2', member_jid: '777@lid', phone_number: '+77788899', role: 'member', joined_at: new Date().toISOString() },
        ]
      };

      const defaultMessages: Message[] = savedMessages ? JSON.parse(savedMessages) : [
        {
          id: 'msg-1',
          chat_id: 'chat-contact-1',
          sender_jid: '+123456789@s.whatsapp.net',
          message_body: 'Hello, is this automated chatbot online?',
          message_type: 'text',
          direction: 'incoming',
          created_at: new Date(Date.now() - 600 * 1000).toISOString(),
        },
        {
          id: 'msg-2',
          chat_id: 'chat-contact-1',
          sender_jid: 'me',
          message_body: 'Hello! Yes, this is our customer support chatbot helper.',
          message_type: 'text',
          direction: 'outgoing',
          created_at: new Date(Date.now() - 580 * 1000).toISOString(),
        }
      ];

      const defaultWorkflows: AutomationWorkflow[] = savedWorkflows ? JSON.parse(savedWorkflows) : [
        {
          id: 'wf-1',
          name: 'Welcome Message',
          trigger_type: 'keyword',
          trigger_value: 'hello',
          is_active: true,
          automation_actions: [
            { id: 'act-1', workflow_id: 'wf-1', action_type: 'send_text', message_body: 'Hi! Welcome to our automated WhatsApp system. Type "price" to see pricing options.', delay_seconds: 1, action_order: 1 }
          ]
        },
        {
          id: 'wf-2',
          name: 'Pricing Automations',
          trigger_type: 'keyword',
          trigger_value: 'price',
          is_active: true,
          automation_actions: [
            { id: 'act-2', workflow_id: 'wf-2', action_type: 'send_text', message_body: 'Our packages start from $0/month for Hobby tier and $19/month for Pro. Check out our catalog page!', delay_seconds: 1, action_order: 1 }
          ]
        }
      ];

      setSessions(defaultSessions);
      setGroups(defaultGroups);
      setGroupMembers(defaultMembers);
      setMessages(defaultMessages);
      setWorkflows(defaultWorkflows);
      if (defaultSessions.length > 0) {
        setActiveSessionId(defaultSessions[0].id);
      }
      setIsLoading(false);
    } else {
      // Real Supabase data fetching
      const fetchRealData = async () => {
        try {
          const { data: dbSessions } = await supabase.from('whatsapp_sessions').select('*').eq('tenant_id', tenantId);
          const { data: dbGroups } = await supabase.from('groups').select('*').eq('tenant_id', tenantId);
          const { data: dbWorkflows } = await supabase.from('automation_workflows').select('*, automation_actions(*)').eq('tenant_id', tenantId);
          
          if (dbSessions) setSessions(dbSessions);
          if (dbGroups) {
            setGroups(dbGroups);
            // Fetch participants for each group
            const membersMap: Record<string, GroupMember[]> = {};
            for (const g of dbGroups) {
              const { data: dbMembers } = await supabase.from('group_members').select('*').eq('group_id', g.id).is('left_at', null);
              if (dbMembers) membersMap[g.id] = dbMembers;
            }
            setGroupMembers(membersMap);
          }
          if (dbWorkflows) setWorkflows(dbWorkflows);

          const sessionIds = dbSessions?.map(s => s.id) || [];
          if (sessionIds.length > 0) {
            const { data: dbChats } = await supabase.from('chats').select('id').in('session_id', sessionIds);
            const chatIds = dbChats?.map(c => c.id) || [];
            if (chatIds.length > 0) {
              const { data: dbMessages } = await supabase
                .from('messages')
                .select('*')
                .in('chat_id', chatIds)
                .order('created_at', { ascending: false })
                .limit(200);
              if (dbMessages) setMessages(dbMessages.reverse());
            }
            setActiveSessionId(sessionIds[0]);
          }
        } catch (err) {
          console.error('Error fetching Supabase data:', err);
        } finally {
          setIsLoading(false);
        }
      };
      fetchRealData();
    }
  };

  useEffect(() => {
    loadData();
  }, [isMockMode, tenantId]);

  // Save changes to localStorage in mock mode
  const syncMockStorage = (updatedSessions?: WhatsAppSession[], updatedGroups?: Group[], updatedMembers?: Record<string, GroupMember[]>, updatedMessages?: Message[], updatedWorkflows?: AutomationWorkflow[]) => {
    if (!isMockMode) return;
    if (updatedSessions) localStorage.setItem('saas_sessions', JSON.stringify(updatedSessions));
    if (updatedGroups) localStorage.setItem('saas_groups', JSON.stringify(updatedGroups));
    if (updatedMembers) localStorage.setItem('saas_group_members', JSON.stringify(updatedMembers));
    if (updatedMessages) localStorage.setItem('saas_messages', JSON.stringify(updatedMessages));
    if (updatedWorkflows) localStorage.setItem('saas_workflows', JSON.stringify(updatedWorkflows));
  };

  // CREATE SESSION
  const createSession = async (name: string, phoneNumber: string) => {
    if (isMockMode) {
      const newSession: WhatsAppSession = {
        id: `session-${Date.now()}`,
        name,
        phone_number: phoneNumber,
        status: 'need_scan',
        created_at: new Date().toISOString(),
      };
      const updated = [...sessions, newSession];
      setSessions(updated);
      syncMockStorage(updated);
      setActiveSessionId(newSession.id);
      return newSession;
    } else {
      // API call to our backend route
      const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
        body: JSON.stringify({ name, phone_number: phoneNumber }),
      });
      const res = await response.json();
      if (!res.success) throw new Error(res.error);
      loadData();
      return res.data;
    }
  };

  // TRIGGER SESSION CONNECTION / SCAN CODE
  const connectSession = async (id: string) => {
    if (isMockMode) {
      // Simulate status transition to connected after scan
      const mockQr = '2@ScannedCodePayloadMockString12345ForTestingQRcodesRenderingInApp';
      const updated = sessions.map(s => s.id === id ? { ...s, status: 'connecting' as const } : s);
      setSessions(updated);
      
      // Simulate successful scan after 5 seconds
      setTimeout(() => {
        setSessions(prev => prev.map(s => s.id === id ? { ...s, status: 'connected' as const } : s));
        syncMockStorage(sessions.map(s => s.id === id ? { ...s, status: 'connected' as const } : s));
      }, 5000);

      return { status: 'need_scan', qrCode: mockQr };
    } else {
      const response = await fetch(`/api/sessions/${id}/connect`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
      });
      const res = await response.json();
      if (!res.success) throw new Error(res.error);
      loadData();
      return res.data;
    }
  };

  // SYNC GROUPS
  const syncGroups = async (id: string) => {
    if (isMockMode) {
      // Simulate fresh groups and members added
      await sleep(1500);
      return { success: true };
    } else {
      const response = await fetch(`/api/sessions/${id}/sync`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
      });
      const res = await response.json();
      if (!res.success) throw new Error(res.error);
      loadData();
      return res.data;
    }
  };

  // ADD KEYWORD AUTOMATION WORKFLOW
  const addWorkflow = async (name: string, keyword: string, actionList: Omit<AutomationAction, 'id' | 'workflow_id'>[]) => {
    const cleanKeyword = keyword.trim().toLowerCase();
    if (isMockMode) {
      const workflowId = `wf-${Date.now()}`;
      const newWorkflow: AutomationWorkflow = {
        id: workflowId,
        name,
        trigger_type: 'keyword',
        trigger_value: cleanKeyword,
        is_active: true,
        automation_actions: actionList.map((a, i) => ({
          ...a,
          id: `act-${Date.now()}-${i}`,
          workflow_id: workflowId,
        })),
      };
      const updated = [...workflows, newWorkflow];
      setWorkflows(updated);
      syncMockStorage(undefined, undefined, undefined, undefined, updated);
      return newWorkflow;
    } else {
      // Supabase INSERT (leveraging RLS)
      const { data: wf, error: wfErr } = await supabase
        .from('automation_workflows')
        .insert({ name, trigger_value: cleanKeyword, tenant_id: tenantId })
        .select()
        .single();
      
      if (wfErr) throw wfErr;

      const actionsToInsert = actionList.map(a => ({
        workflow_id: wf.id,
        action_type: a.action_type,
        message_body: a.message_body,
        media_url: a.media_url,
        delay_seconds: a.delay_seconds,
        action_order: a.action_order,
      }));

      const { error: actErr } = await supabase.from('automation_actions').insert(actionsToInsert);
      if (actErr) throw actErr;

      loadData();
      return wf;
    }
  };

  // DELETE WORKFLOW
  const deleteWorkflow = async (id: string) => {
    if (isMockMode) {
      const updated = workflows.filter(w => w.id !== id);
      setWorkflows(updated);
      syncMockStorage(undefined, undefined, undefined, undefined, updated);
    } else {
      const { error } = await supabase.from('automation_workflows').delete().eq('id', id);
      if (error) throw error;
      loadData();
    }
  };

  // TOGGLE WORKFLOW ACTIVE
  const toggleWorkflow = async (id: string) => {
    const wf = workflows.find(w => w.id === id);
    if (!wf) return;
    const nextActive = !wf.is_active;

    if (isMockMode) {
      const updated = workflows.map(w => w.id === id ? { ...w, is_active: nextActive } : w);
      setWorkflows(updated);
      syncMockStorage(undefined, undefined, undefined, undefined, updated);
    } else {
      const { error } = await supabase
        .from('automation_workflows')
        .update({ is_active: nextActive })
        .eq('id', id);
      if (error) throw error;
      loadData();
    }
  };

  // DEMO INCOMING CHATBOT MATCH TRIGGER
  // Simulates a user texting our session to test LLM chatbot or automation replies!
  const triggerIncomingDemoMessage = (text: string, fromNumber: string = '+19876543') => {
    const cleanedText = text.trim().toLowerCase();
    const isWfMatch = workflows.some(w => w.is_active && w.trigger_value === cleanedText);
    
    // Add incoming message
    const incomingId = `msg-demo-${Date.now()}`;
    const newIncoming: Message = {
      id: incomingId,
      chat_id: 'demo-chat-id',
      sender_jid: `${fromNumber}@s.whatsapp.net`,
      message_body: text,
      message_type: 'text',
      direction: 'incoming',
      created_at: new Date().toISOString(),
    };

    const updatedWithIncoming = [...messages, newIncoming];
    setMessages(updatedWithIncoming);
    syncMockStorage(undefined, undefined, undefined, updatedWithIncoming);

    if (isWfMatch) {
      // Simulate automation action replies sequentially
      const wf = workflows.find(w => w.trigger_value === cleanedText);
      if (!wf) return;
      
      let delayAcc = 0;
      wf.automation_actions.forEach((act, idx) => {
        delayAcc += (act.delay_seconds || 1) * 1000;
        setTimeout(() => {
          const replyId = `msg-demo-reply-${Date.now()}-${idx}`;
          const newReply: Message = {
            id: replyId,
            chat_id: 'demo-chat-id',
            sender_jid: 'me',
            message_body: act.message_body || '',
            message_type: act.action_type === 'send_text' ? 'text' : (act.action_type === 'send_image' ? 'image' : 'document'),
            media_url: act.media_url,
            direction: 'outgoing',
            created_at: new Date().toISOString(),
          };
          setMessages(prev => {
            const up = [...prev, newReply];
            syncMockStorage(undefined, undefined, undefined, up);
            return up;
          });
        }, delayAcc);
      });
    } else {
      // Simulate AI bot response after 2.5 seconds
      setTimeout(() => {
        const replyId = `msg-demo-reply-${Date.now()}`;
        const newReply: Message = {
          id: replyId,
          chat_id: 'demo-chat-id',
          sender_jid: 'me',
          message_body: `[AI Assistant] I received your message: "${text}". How can I help you today?`,
          message_type: 'text',
          direction: 'outgoing',
          created_at: new Date().toISOString(),
        };
        setMessages(prev => {
          const up = [...prev, newReply];
          syncMockStorage(undefined, undefined, undefined, up);
          return up;
        });
      }, 2500);
    }
  };

  return (
    <DashboardContext.Provider
      value={{
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
      }}
    >
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboard() {
  const context = useContext(DashboardContext);
  if (context === undefined) {
    throw new Error('useDashboard must be used within a DashboardProvider');
  }
  return context;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
