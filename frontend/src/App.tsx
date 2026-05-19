import React, { useState, useEffect } from 'react';
import {
  ShieldCheck, FileSearch, ShieldAlert, BookOpen,
  History, Activity, Wifi, WifiOff, Zap, Sun, Moon
} from 'lucide-react';
import Dashboard from './components/Dashboard';
import AuthAudit from './components/AuthAudit';
import MASVSMapping from './components/MASVSMapping';
import ReportHistory from './components/ReportHistory';

const envUrl = (import.meta as any).env?.VITE_API_URL;
const API_BASE_URL = envUrl && !envUrl.includes('localhost') && !envUrl.includes('127.0.0.1') ? envUrl : `http://${window.location.hostname}:8000`;

type Tab = 'scanner' | 'audit' | 'mapping' | 'history';

const TABS: { id: Tab; label: string; icon: React.ReactNode; badge?: string; color?: string }[] = [
  { id: 'scanner', label: 'Scanner SAST',  icon: <FileSearch  className="w-4 h-4" />, color: '#4f9ef8' },
  { id: 'audit',   label: 'Audit Auth IA', icon: <ShieldAlert className="w-4 h-4" />, badge: 'RAG',  color: '#a78bfa' },
  { id: 'mapping', label: 'MASVS v2',      icon: <BookOpen    className="w-4 h-4" />, color: '#34d399' },
  { id: 'history', label: 'Historique',    icon: <History     className="w-4 h-4" />, color: '#fb923c' },
];

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('scanner');
  const [apiOnline, setApiOnline] = useState<boolean | null>(null);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('theme');
    if (saved) return saved === 'dark';
    return !window.matchMedia('(prefers-color-scheme: light)').matches;
  });

  // Apply theme class
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.remove('light');
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  // Check API health
  useEffect(() => {
    const check = async () => {
      try {
        const r = await fetch(`${API_BASE_URL}/api/report/`, { signal: AbortSignal.timeout(3000) });
        setApiOnline(r.ok || r.status < 500);
      } catch { setApiOnline(false); }
    };
    check();
    const id = setInterval(check, 15000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="min-h-screen flex flex-col" style={{ fontFamily: "'Inter', sans-serif" }}>

      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="glass sticky top-0 z-20" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="max-w-7xl mx-auto px-5 py-3 flex items-center justify-between gap-4">

          {/* Logo + title */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center animate-pulse-glow"
              style={{ background: 'linear-gradient(135deg,#4f9ef8,#7c5bf5)' }}
            >
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-sm leading-tight" style={{ color: 'var(--text-primary)' }}>
                Auth & Session Analyzer
              </h1>
              <p className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>
                OWASP MASVS v2 · SAST · DAST · RAG
              </p>
            </div>
          </div>

          {/* Theme Toggle & API Status */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="p-2 rounded-full hover:bg-[rgba(255,255,255,0.1)] transition-colors border border-transparent hover:border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              aria-label="Toggle theme"
            >
              {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <div
              className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium"
            style={{
              background: apiOnline === null
                ? 'rgba(100,116,139,0.1)'
                : apiOnline
                  ? 'rgba(52,211,153,0.1)'
                  : 'rgba(248,113,113,0.1)',
              border: `1px solid ${apiOnline === null
                ? 'rgba(100,116,139,0.2)'
                : apiOnline
                  ? 'rgba(52,211,153,0.25)'
                  : 'rgba(248,113,113,0.25)'}`,
              color: apiOnline === null ? '#94a3b8' : apiOnline ? '#6ee7b7' : '#fca5a5',
            }}
          >
            {apiOnline === null ? (
              <><Activity className="w-3 h-3 animate-spin" /> Vérification...</>
            ) : apiOnline ? (
              <><Wifi className="w-3 h-3" /> API Connectée</>
            ) : (
              <><WifiOff className="w-3 h-3" /> API Hors-ligne</>
            )}
            </div>
          </div>
        </div>

        {/* ── Tab Navigation ─────────────────────────────────────── */}
        <div className="max-w-7xl mx-auto px-5 flex overflow-x-auto no-scrollbar" style={{ borderTop: '1px solid var(--border)' }}>
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
              style={activeTab === tab.id ? { color: tab.color, borderBottomColor: tab.color } as React.CSSProperties : {}}
            >
              <span style={{ color: activeTab === tab.id ? tab.color : undefined }}>
                {tab.icon}
              </span>
              <span>{tab.label}</span>
              {tab.badge && (
                <span
                  className="badge text-[9px] px-1.5 py-0"
                  style={{
                    borderRadius: 5,
                    background: 'rgba(167,139,250,0.15)',
                    color: '#c4b5fd',
                    border: '1px solid rgba(167,139,250,0.25)',
                  }}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </header>

      {/* ── Main Content ───────────────────────────────────────── */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-7">
        <div className="animate-fade-in-up" key={activeTab}>
          {activeTab === 'scanner' && <Dashboard />}
          {activeTab === 'audit'   && <AuthAudit />}
          {activeTab === 'mapping' && <MASVSMapping />}
          {activeTab === 'history' && <ReportHistory />}
        </div>
      </main>

      {/* ── Footer ─────────────────────────────────────────────── */}
      <footer
        className="py-4 px-6 text-center text-xs flex flex-wrap items-center justify-center gap-4"
        style={{ color: 'var(--text-muted)', borderTop: '1px solid var(--border)' }}
      >
        <span className="flex items-center gap-1.5">
          <ShieldCheck className="w-3 h-3" style={{ color: 'var(--accent-blue)' }} />
          Auth &amp; Session Security Analyzer
        </span>
        <span style={{ color: 'var(--text-dim)' }}>·</span>
        <span>OWASP MASVS v2</span>
        <span style={{ color: 'var(--text-dim)' }}>·</span>
        <span className="flex items-center gap-1">
          <Zap className="w-3 h-3" style={{ color: 'var(--accent-purple)' }} />
          Gemini Flash + ChromaDB RAG
        </span>
      </footer>
    </div>
  );
}

export default App;
