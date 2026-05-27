'use client';

import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';

interface ActivityChartProps {
  messages: any[];
  groupLogs: any[];
}

export default function ActivityChart({ messages, groupLogs }: ActivityChartProps) {
  // 1. Format Message Activity Data (last 7 days)
  const getMessageActivityData = () => {
    const datesMap: Record<string, { date: string; incoming: number; outgoing: number; total: number }> = {};
    
    // Initialize last 7 days
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const isoDate = d.toISOString().split('T')[0];
      datesMap[isoDate] = { date: dateStr, incoming: 0, outgoing: 0, total: 0 };
    }

    messages.forEach((msg) => {
      const dateKey = msg.created_at.split('T')[0];
      if (datesMap[dateKey]) {
        if (msg.direction === 'incoming') {
          datesMap[dateKey].incoming += 1;
        } else {
          datesMap[dateKey].outgoing += 1;
        }
        datesMap[dateKey].total += 1;
      }
    });

    return Object.values(datesMap);
  };

  // 2. Format Group Member Change Activity Data (last 7 days)
  const getGroupActivityData = () => {
    const datesMap: Record<string, { date: string; joined: number; left: number }> = {};

    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const isoDate = d.toISOString().split('T')[0];
      datesMap[isoDate] = { date: dateStr, joined: 0, left: 0 };
    }

    groupLogs.forEach((log) => {
      const dateKey = log.created_at.split('T')[0];
      if (datesMap[dateKey]) {
        if (log.event_type === 'member_joined') {
          datesMap[dateKey].joined += 1;
        } else if (log.event_type === 'member_left') {
          datesMap[dateKey].left += 1;
        }
      }
    });

    return Object.values(datesMap);
  };

  const messageData = getMessageActivityData();
  const groupData = getGroupActivityData();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* Messages Flow Area Chart */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl">
        <div className="mb-4">
          <h3 className="text-white font-bold text-lg">Message Flow Rate</h3>
          <p className="text-xs text-zinc-500">Monitor incoming vs outgoing messages over the last 7 days</p>
        </div>
        <div className="h-72 w-full mt-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={messageData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorIncoming" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorOutgoing" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.2}/>
                  <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
              <XAxis dataKey="date" stroke="#71717a" fontSize={11} tickLine={false} />
              <YAxis stroke="#71717a" fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '12px' }}
                labelStyle={{ color: '#ffffff', fontWeight: 'bold' }}
              />
              <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '12px', color: '#71717a' }} />
              <Area type="monotone" name="Incoming Messages" dataKey="incoming" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorIncoming)" />
              <Area type="monotone" name="Outgoing Messages" dataKey="outgoing" stroke="#06b6d4" strokeWidth={2} fillOpacity={1} fill="url(#colorOutgoing)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Group Joins/Leaves Bar Chart */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl">
        <div className="mb-4">
          <h3 className="text-white font-bold text-lg">Group Member Progression</h3>
          <p className="text-xs text-zinc-500">Track user join and leave activity rate inside monitored groups</p>
        </div>
        <div className="h-72 w-full mt-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={groupData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
              <XAxis dataKey="date" stroke="#71717a" fontSize={11} tickLine={false} />
              <YAxis stroke="#71717a" fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '12px' }}
                labelStyle={{ color: '#ffffff', fontWeight: 'bold' }}
              />
              <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '12px', color: '#71717a' }} />
              <Bar type="monotone" name="Members Joined" dataKey="joined" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={25} />
              <Bar type="monotone" name="Members Left" dataKey="left" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={25} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
