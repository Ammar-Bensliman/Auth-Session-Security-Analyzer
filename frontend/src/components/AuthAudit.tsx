import React, { useState } from 'react';
import {
  Loader2, Zap, ShieldAlert, CheckSquare, FileText,
  Download, CheckCircle2, XCircle, Copy, Check,
  AlertTriangle, Code2, BookOpen, Shield, Cpu
} from 'lucide-react';

const envUrl = (import.meta as any).env?.VITE_API_URL;
const API_BASE_URL = envUrl && !envUrl.includes('localhost') && !envUrl.includes('127.0.0.1') ? envUrl : `http://${window.location.hostname}:8000`;

/* ── Static configuration ─────────────────────────────────────── */
const AUTH_TYPES = [
  { value: 'JWT',      label: 'JWT (JSON Web Tokens)',       desc: 'Stateless · RFC 7519' },
  { value: 'OAuth2',   label: 'OAuth2 / OpenID Connect',     desc: 'Fédération · RFC 6749' },
  { value: 'Sessions', label: 'Sessions Serveur (Stateful)', desc: 'Cookie-based · RFC 6265' },
];

const STORAGE_OPTIONS = [
  { value: '',                        label: 'Non spécifié' },
  { value: 'EncryptedSharedPrefs',    label: 'EncryptedSharedPreferences (Android)' },
  { value: 'Keystore',                label: 'Android Keystore (Hardware-backed)' },
  { value: 'NSUserDefaults',          label: 'NSUserDefaults (iOS — déconseillé)' },
  { value: 'Keychain',                label: 'iOS Keychain (recommandé iOS)' },
  { value: 'Memory',                  label: 'Mémoire uniquement (volatile)' },
  { value: 'Cookie',                  label: 'Cookie HTTP (Secure + HttpOnly)' },
  { value: 'LocalStorage',            label: 'LocalStorage / SharedPrefs non chiffrées' },
];

const PLATFORM_OPTIONS = [
  { value: 'Android', label: 'Android' },
  { value: 'iOS',     label: 'iOS' },
  { value: 'Both',    label: 'Android & iOS' },
];

const MANUAL_CHECKS = [
  { key: 'lifetime',  label: 'Durée de vie (Token Lifetime)',   desc: 'Les tokens ont-ils une durée de vie courte (< 15 min) ?' },
  { key: 'rotation',  label: 'Rotation & Refresh',              desc: 'Les refresh tokens sont-ils invalidés après usage ?' },
  { key: 'logout',    label: 'Logout Effectif',                 desc: '/logout invalide-t-il le token côté backend ?' },
  { key: 'fixation',  label: 'Session Fixation',                desc: 'Nouvel ID délivré après élévation de privilège ?' },
  { key: 'mfa',       label: 'Multi-facteur (MFA/2FA)',         desc: 'L\'authentification forte est-elle disponible ?' },
  { key: 'binding',   label: 'Liaisons Appareil',               desc: 'Le token est-il lié à l\'empreinte de l\'appareil ?' },
];

const RISK_COLORS: Record<string, string> = {
  HIGH:   'var(--accent-red)',
  MEDIUM: '#f59e0b',
  LOW:    'var(--accent-green)',
};

const TEST_TYPE_COLORS: Record<string, string> = {
  SAST: 'rgba(99,102,241,0.2)',
  DAST: 'rgba(16,185,129,0.2)',
  BOTH: 'rgba(59,130,246,0.2)',
};

/* ── Component ────────────────────────────────────────────────── */
const AuthAudit = () => {
  // ── Architecture form state
  const [authType,          setAuthType]          = useState('JWT');
  const [tokenStorage,      setTokenStorage]      = useState('');
  const [hasRefreshToken,   setHasRefreshToken]   = useState<boolean | null>(null);
  const [logoutEndpoint,    setLogoutEndpoint]    = useState('');
  const [sessionTimeout,    setSessionTimeout]    = useState('');
  const [certPinning,       setCertPinning]       = useState<boolean | null>(null);
  const [useMfa,            setUseMfa]            = useState<boolean | null>(null);
  const [platform,          setPlatform]          = useState('Android');

  // ── UI state
  const [activeTab,    setActiveTab]    = useState<'checklist' | 'criteria' | 'gherkin' | 'risks'>('checklist');
  const [loading,      setLoading]      = useState(false);
  const [checklistData,setChecklistData]= useState<any>(null);
  const [errorMsg,     setErrorMsg]     = useState('');
  const [copied,       setCopied]       = useState(false);
  const [checks,       setChecks]       = useState<Record<string, boolean>>(
    Object.fromEntries(MANUAL_CHECKS.map(c => [c.key, false]))
  );

  const toggleCheck = (k: string) => setChecks(p => ({ ...p, [k]: !p[k] }));

  /* ── API call ─────────────────────────────────────────────── */
  const handleGenerate = async () => {
    setLoading(true); setErrorMsg(''); setChecklistData(null);
    try {
      const payload: any = { auth_type: authType, platforms: platform };
      if (tokenStorage)                   payload.token_storage          = tokenStorage;
      if (hasRefreshToken !== null)       payload.has_refresh_token      = hasRefreshToken;
      if (logoutEndpoint.trim())          payload.logout_endpoint        = logoutEndpoint.trim();
      if (sessionTimeout && !isNaN(+sessionTimeout)) payload.session_timeout_minutes = +sessionTimeout;
      if (certPinning !== null)           payload.use_certificate_pinning = certPinning;
      if (useMfa !== null)                payload.use_mfa                = useMfa;

      const res = await fetch(`${API_BASE_URL}/api/auth-audit/generate-checklist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`Erreur serveur (HTTP ${res.status}).`);
      const data = await res.json();
      // Ne pas traiter data.error comme une exception si c'est une simulation
      if (data.error && !data.simulated) throw new Error(data.error);
      setChecklistData(data);
      setActiveTab('checklist');
    } catch (err: any) {
      const m = err.message || 'Erreur inconnue.';
      setErrorMsg(m.includes('Failed to fetch')
        ? 'Impossible de se connecter à l\'API backend. Assurez-vous que le serveur est démarré.'
        : m);
    } finally {
      setLoading(false);
    }
  };

  /* ── Export helpers ───────────────────────────────────────── */
  const exportMarkdown = () => {
    if (!checklistData) return;
    const ts = new Date().toLocaleString('fr-FR');
    const lines = [
      `# 🔐 Checklist de Sécurité Auth — ${authType}`,
      '',
      `> **Généré le :** ${ts}  `,
      `> **Plateforme :** ${platform}  `,
      `> **Stockage :** ${tokenStorage || 'Non spécifié'}  `,
      `> **Outil :** Auth & Session Security Analyzer · MASVS v2`,
      '',
      '---',
      '',
      '## 📋 Liste de Vérification',
      '',
      ...(checklistData.checklist || []).flatMap((item: any, i: number) => [
        `### ${i + 1}. ${item.title}`,
        '',
        `| Champ | Valeur |`,
        `|---|---|`,
        `| **MASVS** | \`${item.masvs_ref || 'N/A'}\` |`,
        `| **MASTG** | \`${item.mastg_test || 'N/A'}\` |`,
        `| **Type** | \`${item.test_type || 'N/A'}\` |`,
        `| **Risque** | ${item.risk_level || 'N/A'} |`,
        '',
        item.description,
        '',
      ]),
      '---',
      '',
      '## ✅ Security Acceptance Criteria (SAC)',
      '',
      ...(checklistData.acceptance_criteria || []).map((c: string) => `- ${c}`),
      '',
      '---',
      '',
      '## 🎭 Scénarios Gherkin (User Stories)',
      '',
      ...(checklistData.gherkin_scenarios || []).flatMap((g: any) => [
        `### ${g.user_story || 'Scénario'} — \`${g.masvs_ref || ''}\``,
        '',
        '```gherkin',
        g.scenario || '',
        '```',
        '',
      ]),
      '---',
      '',
      '## ⚠️ Risques de Conception',
      '',
      ...(checklistData.design_risks || []).flatMap((r: any) => [
        `### ${r.risk}`,
        '',
        `**Description :** ${r.description}`,
        '',
        `**Mitigation :** ${r.mitigation}`,
        '',
      ]),
      '---',
      '',
      '## 🔲 Points de Contrôle Manuels',
      '',
      ...MANUAL_CHECKS.map(c => `- [${checks[c.key] ? 'x' : ' '}] **${c.label}** : ${c.desc}`),
      '',
      '---',
      '',
      '_Rapport généré par **Auth & Session Security Analyzer** · MASVS v2 · Gemini RAG_',
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/markdown' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `checklist_${authType.toLowerCase()}_${Date.now()}.md`; a.click();
    URL.revokeObjectURL(url);
  };

  const copyJSON = async () => {
    if (!checklistData) return;
    await navigator.clipboard.writeText(JSON.stringify(checklistData, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const passCount  = Object.values(checks).filter(Boolean).length;
  const totalChecks = MANUAL_CHECKS.length;

  /* ── A tiny tristate toggle ───────────────────────────────────── */
  const Tristate = ({
    label, value, onChange,
  }: { label: string; value: boolean | null; onChange: (v: boolean | null) => void }) => (
    <div>
      <p className="label-sm mb-1.5">{label}</p>
      <div className="flex gap-2">
        {([true, false, null] as const).map((v) => {
          const active = value === v;
          const text   = v === true ? 'Oui' : v === false ? 'Non' : 'N/A';
          return (
            <button key={String(v)} onClick={() => onChange(v)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{
                background: active ? 'rgba(99,102,241,0.2)' : 'var(--bg-secondary)',
                border: `1px solid ${active ? 'rgba(99,102,241,0.5)' : 'var(--border)'}`,
                color: active ? 'var(--accent-purple)' : 'var(--text-muted)',
              }}>
              {text}
            </button>
          );
        })}
      </div>
    </div>
  );

  /* ── Render ───────────────────────────────────────────────── */
  return (
    <div className="space-y-6 animate-fade-in-up">

      {/* ── Configuration Card ─────────────────────────────────── */}
      <div className="card">
        <div className="flex items-center gap-3 mb-1">
          <ShieldAlert className="w-5 h-5" style={{ color: 'var(--accent-purple)' }} />
          <h2 className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>
            Audit d'Architecture Auth &amp; Session
          </h2>
        </div>
        <div className="flex flex-wrap gap-2 mb-6">
          {['MASVS v2 · AUTH', 'MASTG Labs 3–5', 'Shift-Left · SAC Agile', 'RAG + Gemini'].map(t => (
            <span key={t} className="badge badge-running">{t}</span>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* COL 1 — Auth type + Platform */}
          <div className="space-y-5">
            <div>
              <p className="label-sm mb-2">Type d'Authentification</p>
              <div className="space-y-2">
                {AUTH_TYPES.map(at => (
                  <label key={at.value}
                    className="flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all"
                    style={{
                      background: authType === at.value ? 'rgba(99,102,241,0.1)' : 'var(--bg-secondary)',
                      border: `1px solid ${authType === at.value ? 'rgba(99,102,241,0.4)' : 'var(--border)'}`,
                    }}>
                    <input type="radio" name="authType" value={at.value}
                      checked={authType === at.value} onChange={() => setAuthType(at.value)}
                      className="hidden" />
                    <div className="w-3.5 h-3.5 rounded-full border-2 flex-shrink-0 flex items-center justify-center"
                      style={{ borderColor: authType === at.value ? 'var(--accent-blue)' : 'var(--text-muted)' }}>
                      {authType === at.value && (
                        <div className="w-2 h-2 rounded-full" style={{ background: 'var(--accent-blue)' }} />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{at.label}</p>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{at.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <p className="label-sm mb-1.5">Plateforme Cible</p>
              <div className="flex gap-2 flex-wrap">
                {PLATFORM_OPTIONS.map(p => (
                  <button key={p.value} onClick={() => setPlatform(p.value)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                    style={{
                      background: platform === p.value ? 'rgba(16,185,129,0.15)' : 'var(--bg-secondary)',
                      border: `1px solid ${platform === p.value ? 'rgba(16,185,129,0.4)' : 'var(--border)'}`,
                      color: platform === p.value ? 'var(--accent-green)' : 'var(--text-muted)',
                    }}>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* COL 2 — Technical architecture */}
          <div className="space-y-4">
            <div>
              <p className="label-sm mb-1.5">Stockage des Tokens</p>
              <select
                value={tokenStorage}
                onChange={(e) => setTokenStorage(e.target.value)}
                className="w-full rounded-lg px-3 py-2 text-sm"
                style={{
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-primary)',
                }}>
                {STORAGE_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            <div>
              <p className="label-sm mb-1.5">Endpoint de Logout</p>
              <input
                type="text"
                placeholder="ex: /api/auth/logout"
                value={logoutEndpoint}
                onChange={(e) => setLogoutEndpoint(e.target.value)}
                className="w-full rounded-lg px-3 py-2 text-sm"
                style={{
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-primary)',
                }} />
            </div>

            <div>
              <p className="label-sm mb-1.5">Timeout Session (minutes)</p>
              <input
                type="number"
                placeholder="ex: 15"
                min="1" max="10080"
                value={sessionTimeout}
                onChange={(e) => setSessionTimeout(e.target.value)}
                className="w-full rounded-lg px-3 py-2 text-sm"
                style={{
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-primary)',
                }} />
            </div>

            <Tristate label="Refresh Token" value={hasRefreshToken} onChange={setHasRefreshToken} />
            <Tristate label="Certificate Pinning" value={certPinning} onChange={setCertPinning} />
            <Tristate label="MFA / 2FA" value={useMfa} onChange={setUseMfa} />
          </div>

          {/* COL 3 — Manual checks + Generate */}
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="label-sm">Points de Contrôle ({passCount}/{totalChecks})</p>
                <div className="progress-track w-20" style={{ height: 6 }}>
                  <div className="progress-fill" style={{
                    width: `${(passCount / totalChecks) * 100}%`,
                    animation: 'none',
                    background: passCount === totalChecks ? 'var(--accent-green)' : undefined,
                  }} />
                </div>
              </div>
              <div className="space-y-1.5">
                {MANUAL_CHECKS.map(c => (
                  <label key={c.key}
                    className="flex items-start gap-3 p-2.5 rounded-lg cursor-pointer transition-colors"
                    style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                    <div className="mt-0.5 flex-shrink-0 w-4 h-4 rounded border-2 flex items-center justify-center transition-colors"
                      style={{
                        borderColor: checks[c.key] ? 'var(--accent-green)' : 'var(--text-muted)',
                        background:  checks[c.key] ? 'var(--accent-green)' : 'transparent',
                      }}
                      onClick={() => toggleCheck(c.key)}>
                      {checks[c.key] && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
                    </div>
                    <div>
                      <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{c.label}</p>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{c.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <button onClick={handleGenerate} disabled={loading} className="btn-primary w-full">
              {loading
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Génération IA en cours...</>
                : <><Zap className="w-4 h-4" /> Générer l'Audit MASVS</>
              }
            </button>
            {errorMsg && (
              <div className="flex items-start gap-2 p-3 rounded-lg"
                style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}>
                <XCircle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: 'var(--accent-red)' }} />
                <p className="text-xs" style={{ color: 'var(--accent-red)' }}>{errorMsg}</p>
              </div>
            )}
            <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>
              Propulsé par RAG (ChromaDB · MASVS v2) + Gemini Flash
            </p>
          </div>
        </div>
      </div>

      {/* ── Results ───────────────────────────────────────────── */}
      {checklistData && !loading && (
        <div className="animate-fade-in-up space-y-4">

          {/* ── Action bar ────────────────────────────────────── */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <CheckSquare className="w-4 h-4" style={{ color: 'var(--accent-green)' }} />
              <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                Audit Généré
              </span>
              <span className="badge badge-done">{checklistData.checklist?.length || 0} tests</span>
              {checklistData.design_risks?.length > 0 && (
                <span className="badge badge-pending">{checklistData.design_risks.length} risques conception</span>
              )}
              {checklistData.simulated && (
                <span className="badge" style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)' }}>
                  ⚡ Mode Simulation
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <button className="btn-secondary" onClick={copyJSON}>
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copié !' : 'JSON'}
              </button>
              <button className="btn-secondary" onClick={exportMarkdown}>
                <Download className="w-3.5 h-3.5" /> Export .md
              </button>
            </div>
          </div>

          {/* ── Simulation warning banner ──────────────────── */}
          {checklistData.simulated && (
            <div className="flex items-start gap-3 p-3 rounded-xl"
              style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)' }}>
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#f59e0b' }} />
              <div>
                <p className="text-xs font-semibold" style={{ color: '#f59e0b' }}>
                  Quota Gemini atteint — Checklist locale affichée
                </p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                  {checklistData.quota_info || 'Le quota API Gemini est épuisé. La checklist ci-dessous est générée localement (MASVS v2 standard).'}
                </p>
                <p className="text-xs mt-1 font-medium" style={{ color: '#fbbf24' }}>
                  Solution rapide : dans votre .env, ajoutez <code className="mono" style={{ background: 'rgba(0,0,0,0.2)', padding: '1px 4px', borderRadius: 3 }}>GEMINI_MODEL=gemini-2.0-flash</code> (1 500 req/jour free tier)
                </p>
              </div>
            </div>
          )}

          {/* ── Tabs ──────────────────────────────────────────── */}
          <div className="flex gap-1 p-1 rounded-lg" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
            {([
              { key: 'checklist', label: 'Checklist',    icon: <FileText   className="w-3.5 h-3.5" />, count: checklistData.checklist?.length },
              { key: 'criteria',  label: 'SAC Agile',    icon: <CheckCircle2 className="w-3.5 h-3.5" />, count: checklistData.acceptance_criteria?.length },
              { key: 'gherkin',   label: 'Gherkin',      icon: <Code2      className="w-3.5 h-3.5" />, count: checklistData.gherkin_scenarios?.length },
              { key: 'risks',     label: 'Risques Design',icon: <AlertTriangle className="w-3.5 h-3.5" />, count: checklistData.design_risks?.length },
            ] as const).map(tab => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key as any)}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-all"
                style={{
                  background: activeTab === tab.key ? 'var(--bg-card)' : 'transparent',
                  color: activeTab === tab.key ? 'var(--text-primary)' : 'var(--text-muted)',
                  border: activeTab === tab.key ? '1px solid var(--border)' : '1px solid transparent',
                }}>
                {tab.icon}
                <span className="hidden sm:inline">{tab.label}</span>
                {tab.count !== undefined && tab.count > 0 && (
                  <span className="badge badge-pending text-[10px] px-1.5 py-0" style={{ borderRadius: 4 }}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* ── Tab: Checklist ────────────────────────────────── */}
          {activeTab === 'checklist' && (
            <div className="card space-y-3">
              {(checklistData.checklist || []).map((item: any, idx: number) => (
                <div key={idx} className="p-3 rounded-lg"
                  style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-3 flex-1">
                      <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                        style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)' }}>
                        <span className="text-[10px] font-bold" style={{ color: 'var(--accent-blue)' }}>{idx + 1}</span>
                      </div>
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{item.title}</p>
                          {item.test_type && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                              style={{
                                background: TEST_TYPE_COLORS[item.test_type] || 'rgba(99,102,241,0.15)',
                                color: 'var(--text-secondary)',
                              }}>
                              {item.test_type}
                            </span>
                          )}
                        </div>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{item.description}</p>
                        {item.mastg_test && (
                          <p className="text-[10px] mt-1 font-mono" style={{ color: 'var(--text-muted)' }}>
                            🔬 {item.mastg_test}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                      {item.masvs_ref && (
                        <span className="badge badge-pending mono text-[10px]">{item.masvs_ref}</span>
                      )}
                      {item.risk_level && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                          style={{
                            color: RISK_COLORS[item.risk_level] || 'var(--text-muted)',
                            background: `${RISK_COLORS[item.risk_level] || '#888'}22`,
                          }}>
                          ● {item.risk_level}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── Tab: SAC ──────────────────────────────────────── */}
          {activeTab === 'criteria' && (
            <div className="card space-y-2">
              <div className="flex items-center gap-2 mb-3">
                <Shield className="w-4 h-4" style={{ color: 'var(--accent-green)' }} />
                <h4 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
                  Security Acceptance Criteria — Intégration Jira / Agile
                </h4>
              </div>
              {(checklistData.acceptance_criteria || []).map((criteria: string, idx: number) => (
                <div key={idx} className="flex items-start gap-3 p-3 rounded-lg"
                  style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: 'var(--accent-green)' }} />
                  <p className="text-sm" style={{ color: '#94a3b8' }}>{criteria}</p>
                </div>
              ))}
              {(!checklistData.acceptance_criteria || checklistData.acceptance_criteria.length === 0) && (
                <p className="text-sm text-center py-4" style={{ color: 'var(--text-muted)' }}>
                  Aucun critère d'acceptation généré.
                </p>
              )}
            </div>
          )}

          {/* ── Tab: Gherkin ──────────────────────────────────── */}
          {activeTab === 'gherkin' && (
            <div className="card space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <Code2 className="w-4 h-4" style={{ color: 'var(--accent-blue)' }} />
                <h4 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
                  Scénarios Gherkin (Given / When / Then)
                </h4>
              </div>
              {(checklistData.gherkin_scenarios || []).map((g: any, idx: number) => (
                <div key={idx} className="rounded-lg overflow-hidden"
                  style={{ border: '1px solid var(--border)' }}>
                  <div className="flex items-center justify-between px-3 py-2"
                    style={{ background: 'rgba(59,130,246,0.08)' }}>
                    <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
                      {g.user_story || `Scénario #${idx + 1}`}
                    </p>
                    {g.masvs_ref && (
                      <span className="badge badge-pending mono text-[10px]">{g.masvs_ref}</span>
                    )}
                  </div>
                  <pre className="px-3 py-3 text-xs overflow-x-auto whitespace-pre-wrap"
                    style={{
                      background: 'var(--bg-secondary)',
                      color: '#a5f3fc',
                      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                    }}>
                    {g.scenario}
                  </pre>
                </div>
              ))}
              {(!checklistData.gherkin_scenarios || checklistData.gherkin_scenarios.length === 0) && (
                <p className="text-sm text-center py-4" style={{ color: 'var(--text-muted)' }}>
                  Aucun scénario Gherkin généré. Relancez l'audit pour en obtenir.
                </p>
              )}
            </div>
          )}

          {/* ── Tab: Design Risks ─────────────────────────────── */}
          {activeTab === 'risks' && (
            <div className="card space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="w-4 h-4" style={{ color: '#f59e0b' }} />
                <h4 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
                  Risques de Conception (Security by Design)
                </h4>
              </div>
              {(checklistData.design_risks || []).map((r: any, idx: number) => (
                <div key={idx} className="p-3 rounded-lg"
                  style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)' }}>
                  <p className="font-semibold text-sm mb-1" style={{ color: '#fbbf24' }}>
                    ⚠️ {r.risk}
                  </p>
                  <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>{r.description}</p>
                  <div className="flex items-start gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: 'var(--accent-green)' }} />
                    <p className="text-xs" style={{ color: '#86efac' }}>{r.mitigation}</p>
                  </div>
                </div>
              ))}
              {(!checklistData.design_risks || checklistData.design_risks.length === 0) && (
                <p className="text-sm text-center py-4" style={{ color: 'var(--text-muted)' }}>
                  Aucun risque de conception identifié.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AuthAudit;
