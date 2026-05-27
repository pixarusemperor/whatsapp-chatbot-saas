import React from 'react';
import { LayoutDashboard, Phone, Users, ShieldAlert, BarChart3, HelpCircle } from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isMockMode: boolean;
}

export default function DashboardSidebar({ activeTab, setActiveTab, isMockMode }: SidebarProps) {
  const menuItems = [
    { id: 'overview', name: 'Overview', icon: LayoutDashboard },
    { id: 'sessions', name: 'Sessions', icon: Phone },
    { id: 'groups', name: 'Groups Tracking', icon: Users },
    { id: 'automations', name: 'Automation Workflows', icon: ShieldAlert },
    { id: 'analytics', name: 'Analytics & Graph', icon: BarChart3 },
  ];

  return (
    <aside className="w-64 bg-zinc-950 border-r border-zinc-800 text-zinc-300 flex flex-col h-full">
      {/* Brand Logo Header */}
      <div className="p-6 border-b border-zinc-800 flex items-center space-x-3">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center font-bold text-white shadow-lg shadow-emerald-500/20">
          W
        </div>
        <div>
          <h1 className="font-bold text-lg text-white leading-tight tracking-tight">WatsFlow</h1>
          <span className="text-xs text-zinc-500 font-medium">WhatsApp SaaS MVP</span>
        </div>
      </div>

      {/* Mode Status Indicator */}
      <div className="px-6 py-4 border-b border-zinc-800/50">
        <div className={`flex items-center space-x-2.5 rounded-lg px-3 py-2 text-xs font-semibold ${
          isMockMode 
            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' 
            : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
        }`}>
          <span className={`w-2 h-2 rounded-full ${isMockMode ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400 animate-pulse'}`} />
          <span>{isMockMode ? 'Local Simulation Mode' : 'Connected to Supabase'}</span>
        </div>
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 px-4 py-6 space-y-1.5">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center space-x-3.5 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 group ${
                isActive
                  ? 'bg-zinc-800 text-white font-semibold shadow-inner border-l-4 border-emerald-400 pl-3'
                  : 'hover:bg-zinc-900/50 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Icon className={`w-5 h-5 transition-transform duration-200 ${
                isActive ? 'text-emerald-400' : 'text-zinc-500 group-hover:text-zinc-400'
              }`} />
              <span>{item.name}</span>
            </button>
          );
        })}
      </nav>

      {/* Footer Info */}
      <div className="p-6 border-t border-zinc-800 text-xs text-zinc-500 flex flex-col space-y-1.5">
        <div className="flex items-center space-x-2">
          <HelpCircle className="w-3.5 h-3.5 text-zinc-600" />
          <span className="font-medium text-zinc-400">WatsSender Docs v2.6</span>
        </div>
        <p className="text-[10px] leading-relaxed text-zinc-600">
          Aesthetics based on custom-built modern web standard practices.
        </p>
      </div>
    </aside>
  );
}
