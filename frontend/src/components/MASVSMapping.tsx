import React, { useState, useEffect } from 'react';
import { BookOpen, Shield, Wifi, Key, Globe, Database, Cpu, TrendingUp } from 'lucide-react';

const MASVS_CATEGORIES = [
  {
    id: 'MASVS-AUTH',
    title: 'Auth & Session',
    chapter: 'Chapitre 4',
    lab: 'Lab 3',
    icon: <Shield className="w-4 h-4" />,
    color: '#4f9ef8',
    colorBg: 'rgba(79,158,248,0.10)',
    colorBorder: 'rgba(79,158,248,0.22)',
    reqs: [
      { id: 'MASVS-AUTH-1',  title: 'Authentification serveur robuste',         status: 'covered' },
      { id: 'MASVS-AUTH-2',  title: "Prévention bypass d'authentification",     status: 'covered' },
      { id: 'MASVS-AUTH-3',  title: "Non-usage d'identifiants falsifiables",    status: 'covered' },
      { id: 'MASVS-AUTH-4',  title: 'Rate Limiting & Bruteforce Protection',    status: 'partial'  },
      { id: 'MASVS-AUTH-5',  title: 'Timeout & Inactivité',                     status: 'covered' },
      { id: 'MASVS-AUTH-6',  title: 'Invalidation de session au logout',        status: 'covered' },
      { id: 'MASVS-AUTH-7',  title: 'Stockage sécurisé des secrets',            status: 'covered' },
      { id: 'MASVS-AUTH-8',  title: 'Authentification biométrique robuste',     status: 'partial'  },
      { id: 'MASVS-AUTH-9',  title: 'Transfert réseau sécurisé',                status: 'covered' },
      { id: 'MASVS-AUTH-10', title: 'Rotation des Refresh Tokens',              status: 'covered' },
      { id: 'MASVS-AUTH-11', title: 'Protection contre la fixation de session', status: 'partial'  },
    ],
  },
  {
    id: 'MASVS-STORAGE',
    title: 'Stockage Local',
    chapter: 'Chapitre 5',
    lab: 'Lab 3',
    icon: <Database className="w-4 h-4" />,
    color: '#fbbf24',
    colorBg: 'rgba(251,191,36,0.10)',
    colorBorder: 'rgba(251,191,36,0.22)',
    reqs: [
      { id: 'MASVS-STORAGE-1', title: 'Données sensibles non stockées en clair',   status: 'covered' },
      { id: 'MASVS-STORAGE-2', title: 'Pas de données sensibles dans les logs',    status: 'covered' },
      { id: 'MASVS-STORAGE-3', title: 'Pas de données sensibles dans les backups', status: 'partial'  },
    ],
  },
  {
    id: 'MASVS-CRYPTO',
    title: 'Cryptographie',
    chapter: 'Chapitre 6',
    lab: 'Lab 4',
    icon: <Key className="w-4 h-4" />,
    color: '#a78bfa',
    colorBg: 'rgba(167,139,250,0.10)',
    colorBorder: 'rgba(167,139,250,0.22)',
    reqs: [
      { id: 'MASVS-CRYPTO-1', title: 'Clés cryptographiques robustes',  status: 'covered' },
      { id: 'MASVS-CRYPTO-2', title: 'Algorithmes éprouvés uniquement', status: 'covered' },
      { id: 'MASVS-CRYPTO-3', title: 'Entropie suffisante (PRNG)',      status: 'partial'  },
      { id: 'MASVS-CRYPTO-4', title: 'Pas de clés hardcodées',          status: 'covered' },
      { id: 'MASVS-CRYPTO-5', title: 'Stockage local DB sécurisé',      status: 'covered' },
    ],
  },
  {
    id: 'MASVS-NETWORK',
    title: 'Réseau & TLS',
    chapter: 'Chapitre 7',
    lab: 'Lab 5',
    icon: <Wifi className="w-4 h-4" />,
    color: '#22d3ee',
    colorBg: 'rgba(34,211,238,0.10)',
    colorBorder: 'rgba(34,211,238,0.22)',
    reqs: [
      { id: 'MASVS-NETWORK-1', title: 'TLS/SSL activé et configuré', status: 'covered' },
      { id: 'MASVS-NETWORK-2', title: 'Certificate Pinning',          status: 'covered' },
      { id: 'MASVS-NETWORK-3', title: 'Pas de trafic HTTP en clair',  status: 'covered' },
    ],
  },
  {
    id: 'MASVS-RESILIENCE',
    title: 'Résilience & Anti-Tampering',
    chapter: 'Chapitre 10',
    lab: 'Lab Avancé',
    icon: <Cpu className="w-4 h-4" />,
    color: '#f472b6',
    colorBg: 'rgba(244,114,182,0.10)',
    colorBorder: 'rgba(244,114,182,0.22)',
    reqs: [
      { id: 'MASVS-RESILIENCE-1', title: 'Protection contre le reverse engineering', status: 'partial'  },
      { id: 'MASVS-RESILIENCE-2', title: 'Détection de root / jailbreak',             status: 'partial'  },
      { id: 'MASVS-RESILIENCE-3', title: "Obfuscation du code",                       status: 'missing' },
    ],
  },
  {
    id: 'MASVS-PLATFORM',
    title: 'Platform & WebView',
    chapter: 'Chapitres 12 & 14',
    lab: 'Labs Transverses',
    icon: <Globe className="w-4 h-4" />,
    color: '#34d399',
    colorBg: 'rgba(52,211,153,0.10)',
    colorBorder: 'rgba(52,211,153,0.22)',
    reqs: [
      { id: 'MASVS-PLATFORM-1', title: 'Exposition des composants', status: 'covered' },
      { id: 'MASVS-PLATFORM-2', title: 'Sécurité WebView (JS)',      status: 'partial'  },
      { id: 'MASVS-PLATFORM-3', title: 'Deep Links Auth / OAuth',   status: 'partial'  },
    ],
  },
];

const STATUS_CONFIG = {
  covered: {
    label: 'Couvert',
    icon: '✓',
    badgeStyle: { background: 'rgba(16, 185, 129, 0.12)', color: '#10B981', border: '1px solid rgba(16, 185, 129, 0.25)' },
    dotColor: '#10B981',
  },
  partial: {
    label: 'Partiel',
    icon: '⚡',
    badgeStyle: { background: 'rgba(245, 158, 11, 0.12)', color: '#F59E0B', border: '1px solid rgba(245, 158, 11, 0.25)' },
    dotColor: '#F59E0B',
  },
  missing: {
    label: 'Absent',
    icon: '✗',
    badgeStyle: { background: 'rgba(239, 68, 68, 0.12)', color: '#EF4444', border: '1px solid rgba(239, 68, 68, 0.25)' },
    dotColor: '#EF4444',
  },
};

const envUrl = (import.meta as any).env?.VITE_API_URL;
const API_BASE_URL = envUrl && !envUrl.includes('localhost') && !envUrl.includes('127.0.0.1') ? envUrl : `http://${window.location.hostname}:8000`;

const MASVSMapping = () => {
  const [categories, setCategories] = useState(MASVS_CATEGORIES);

  useEffect(() => {
    const fetchMapping = async () => {
      try {
        const resList = await fetch(`${API_BASE_URL}/api/report/`);
        if (!resList.ok) throw new Error();
        const list = await resList.json();
        if (list.length > 0) {
          const latestId = list[0].id;
          const resDetail = await fetch(`${API_BASE_URL}/api/report/${latestId}`);
          if (resDetail.ok) {
            const detail = await resDetail.json();
            if (detail.masvs_mapping && detail.masvs_mapping.mapping) {
              const apiMapping = detail.masvs_mapping.mapping;
              const newCats = MASVS_CATEGORIES.map(cat => ({
                ...cat,
                reqs: cat.reqs.map(req => ({
                  ...req,
                  status: apiMapping[req.id] || req.status
                }))
              }));
              setCategories(newCats);
            }
          }
        }
      } catch (err) {
        console.error("Failed to fetch dynamic MASVS mapping", err);
      }
    };
    fetchMapping();
  }, []);

  const totalCovered = categories.reduce((n, c) =>
    n + c.reqs.filter(r => r.status === 'covered').length, 0);
  const totalPartial = categories.reduce((n, c) =>
    n + c.reqs.filter(r => r.status === 'partial').length, 0);
  const total = categories.reduce((n, c) => n + c.reqs.length, 0);
  const pct = total > 0 ? Math.round((totalCovered / total) * 100) : 0;

  return (
    <div className="space-y-6 animate-fade-in-up">

      {/* ── Header ───────────────────────────────────────────── */}
      <div className="card">
        <div className="flex items-center gap-3 mb-2">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.25)' }}
          >
            <BookOpen className="w-4 h-4" style={{ color: '#34d399' }} />
          </div>
          <div>
            <h2 className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>
              Mapping Exigences MASVS v2
            </h2>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Cartographie de couverture · Labs 3–5 · OWASP MASVS v2
            </p>
          </div>
        </div>

        {/* Global stats */}
        <div className="grid grid-cols-3 gap-3 mt-4">
          <div className="stat-block" style={{ background: 'rgba(16, 185, 129, 0.06)', borderColor: 'rgba(16, 185, 129, 0.2)' }}>
            <span className="stat-value" style={{ color: '#10B981' }}>{totalCovered}</span>
            <span className="stat-label" style={{ color: '#10B981' }}>Couverts</span>
          </div>
          <div className="stat-block" style={{ background: 'rgba(245, 158, 11, 0.06)', borderColor: 'rgba(245, 158, 11, 0.2)' }}>
            <span className="stat-value" style={{ color: '#F59E0B' }}>{totalPartial}</span>
            <span className="stat-label" style={{ color: '#F59E0B' }}>Partiels</span>
          </div>
          <div className="stat-block" style={{ background: 'rgba(239, 68, 68, 0.06)', borderColor: 'rgba(239, 68, 68, 0.2)' }}>
            <span className="stat-value" style={{ color: '#EF4444' }}>{total - totalCovered - totalPartial}</span>
            <span className="stat-label" style={{ color: '#EF4444' }}>Absents</span>
          </div>
        </div>

        {/* Coverage bar */}
        <div
          className="p-4 rounded-xl mt-4"
          style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
        >
          <div className="flex justify-between items-center mb-2">
            <span className="label-sm flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5" />
              Couverture MASVS globale
            </span>
            <span className="font-black text-xl" style={{ color: pct >= 70 ? '#10B981' : pct >= 40 ? '#F59E0B' : '#EF4444' }}>
              {pct}%
            </span>
          </div>
          <div className="coverage-bar" style={{ height: 10 }}>
            <div
              className="coverage-fill"
              style={{
                width: `${pct}%`,
                background: pct >= 70
                  ? 'linear-gradient(90deg, #10B981, #22d3ee)'
                  : pct >= 40
                    ? 'linear-gradient(90deg, #F59E0B, #fbbf24)'
                    : 'linear-gradient(90deg, #EF4444, #F59E0B)',
              }}
            />
          </div>
          <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
            {totalCovered} / {total} contrôles couverts par les analyseurs intégrés
          </p>
        </div>
      </div>

      {/* ── Categories grid ───────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {categories.map((cat, catIdx) => {
          const coveredCount = cat.reqs.filter(r => r.status === 'covered').length;
          const catPct = cat.reqs.length > 0 ? Math.round((coveredCount / cat.reqs.length) * 100) : 0;

          return (
            <div
              key={cat.id}
              className="card stagger-item"
              style={{ animationDelay: `${catIdx * 0.08}s` }}
            >
              {/* Cat header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: cat.colorBg, border: `1px solid ${cat.colorBorder}`, color: cat.color }}
                  >
                    {cat.icon}
                  </div>
                  <div>
                    <p className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>{cat.id}</p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{cat.title} · {cat.chapter}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="badge badge-running" style={{ fontSize: '0.65rem' }}>{cat.lab}</span>
                  <span className="text-sm font-black" style={{ color: cat.color }}>{catPct}%</span>
                </div>
              </div>

              {/* Progress bar */}
              <div className="coverage-bar mb-4" style={{ height: 5 }}>
                <div
                  className="coverage-fill"
                  style={{ width: `${catPct}%`, background: cat.color }}
                />
              </div>

              {/* Reqs list */}
              <div className="space-y-1.5">
                {cat.reqs.map(req => {
                  const cfg = STATUS_CONFIG[req.status as keyof typeof STATUS_CONFIG];
                  return (
                    <div
                      key={req.id}
                      className="flex items-center gap-2.5 py-2 px-2.5 rounded-lg transition-colors"
                      style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
                    >
                      {/* Status dot */}
                      <div
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ background: cfg.dotColor, boxShadow: `0 0 4px ${cfg.dotColor}` }}
                      />
                      {/* Control ID */}
                      <span
                        className="mono text-[9px] font-bold flex-shrink-0 px-1.5 py-0.5 rounded"
                        style={{ background: `${cat.color}1a`, color: cat.color }}
                      >
                        {req.id.split('-').pop()}
                      </span>
                      {/* Title */}
                      <span className="text-xs flex-1" style={{ color: 'var(--text-secondary)' }}>
                        {req.title}
                      </span>
                      {/* Badge */}
                      <span className="badge flex-shrink-0" style={{ ...cfg.badgeStyle, fontSize: '0.65rem', padding: '2px 7px' }}>
                        {cfg.icon} {cfg.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Legend ────────────────────────────────────────────── */}
      <div className="card">
        <p className="label-sm mb-4">Légende des statuts</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {(Object.entries(STATUS_CONFIG) as [string, typeof STATUS_CONFIG.covered][]).map(([key, cfg]) => (
            <div
              key={key}
              className="flex items-center gap-3 p-3 rounded-xl"
              style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
            >
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm flex-shrink-0"
                style={{ ...cfg.badgeStyle }}
              >
                {cfg.icon}
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color: cfg.dotColor }}>{cfg.label}</p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {key === 'covered' ? 'Détection automatique' : key === 'partial' ? 'Audit manuel recommandé' : 'Audit manuel obligatoire'}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default MASVSMapping;
