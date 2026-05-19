import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  History, RefreshCw, FileText, Download, ChevronRight,
  AlertCircle, Clock, CheckCircle, Loader2, ShieldOff,
  Zap, BarChart3, Calendar, Hash, X
} from 'lucide-react';

const envUrl = (import.meta as any).env?.VITE_API_URL;
const API_BASE_URL = envUrl && !envUrl.includes('localhost') && !envUrl.includes('127.0.0.1') ? envUrl : `http://${window.location.hostname}:8000`;

interface ReportSummary {
  id: string;
  apk_name: string;
  apk_hash: string;
  overall_score?: number;
  timestamp: string;
}

interface JobSummary {
  job_id: string;
  filename: string;
  status: string;
  progress: string;
  report_id?: string;
  created_at: string;
}

interface FullReport {
  id: string;
  apk_name: string;
  apk_hash: string;
  overall_score: number;
  executive_summary: string;
  findings: any[];
  timestamp: string;
}

/* ── Sub-components ──────────────────────────────────────────── */
const JobStatusBadge = ({ status }: { status: string }) => {
  const map: Record<string, { style: React.CSSProperties; icon: React.ReactNode; label: string }> = {
    done:    { style: { background: 'rgba(52,211,153,0.12)', color: '#6ee7b7', border: '1px solid rgba(52,211,153,0.25)' }, icon: <CheckCircle className="w-3 h-3" />, label: 'DONE' },
    failed:  { style: { background: 'rgba(248,113,113,0.12)', color: '#fca5a5', border: '1px solid rgba(248,113,113,0.25)' }, icon: <AlertCircle className="w-3 h-3" />, label: 'FAILED' },
    running: { style: { background: 'rgba(79,158,248,0.12)', color: '#93c5fd', border: '1px solid rgba(79,158,248,0.25)' }, icon: <Loader2 className="w-3 h-3 animate-spin" />, label: 'RUNNING' },
    pending: { style: { background: 'rgba(124,143,168,0.12)', color: '#94a3b8', border: '1px solid rgba(124,143,168,0.2)' }, icon: <Clock className="w-3 h-3" />, label: 'PENDING' },
  };
  const cfg = map[status] || map['pending']!;
  return (
    <span className="badge flex items-center gap-1" style={cfg.style}>
      {cfg.icon} {cfg.label}
    </span>
  );
};

const ScoreCircle = ({ score }: { score: number }) => {
  const s = Math.min(100, Math.max(0, score ?? 0));
  const color   = s > 80 ? '#34d399' : s > 50 ? '#fb923c' : '#f87171';
  const glow    = s > 80 ? 'rgba(52,211,153,0.4)' : s > 50 ? 'rgba(251,146,60,0.4)' : 'rgba(248,113,113,0.4)';
  const label   = s > 80 ? 'Sûr' : s > 50 ? 'Risqué' : 'Critique';
  const r = 26, c = 2 * Math.PI * r;
  const arc = (s / 100) * c;
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="70" height="70" viewBox="0 0 68 68" style={{ filter: `drop-shadow(0 0 8px ${glow})` }}>
        <circle cx="34" cy="34" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
        <circle
          cx="34" cy="34" r={r} fill="none"
          stroke={color} strokeWidth="6" strokeLinecap="round"
          strokeDasharray={`${arc} ${c}`} strokeDashoffset={-(c / 4)}
          style={{ transition: 'stroke-dasharray 1.2s cubic-bezier(0.4,0,0.2,1)' }}
        />
        <text x="34" y="30" textAnchor="middle" fontSize="14" fontWeight="800" fill={color} dominantBaseline="middle">
          {Math.round(s)}
        </text>
        <text x="34" y="44" textAnchor="middle" fontSize="8" fill="var(--text-muted)" dominantBaseline="middle">
          /100
        </text>
      </svg>
      <span className="text-[10px] font-bold" style={{ color }}>{label}</span>
    </div>
  );
};

/* ── Main Component ──────────────────────────────────────────── */
const ReportHistory = () => {
  const [reports, setReports]             = useState<ReportSummary[]>([]);
  const [jobs, setJobs]                   = useState<JobSummary[]>([]);
  const [selectedReport, setSelectedReport] = useState<FullReport | null>(null);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState('');
  const [loadingReport, setLoadingReport] = useState('');
  const reportPanelRef = useRef<HTMLDivElement>(null);

  const fetchData = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [rRes, jRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/report/`),
        fetch(`${API_BASE_URL}/api/jobs/`),
      ]);
      if (rRes.ok) setReports(await rRes.json());
      if (jRes.ok) setJobs(await jRes.json());
    } catch {
      setError("Impossible de se connecter à l'API backend.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const viewReport = async (id: string) => {
    try {
      setLoadingReport(id);
      const res = await fetch(`${API_BASE_URL}/api/report/${id}`);
      if (res.ok) {
        setSelectedReport(await res.json());
        setTimeout(() => reportPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
      }
    } catch {} finally {
      setLoadingReport('');
    }
  };

  const dlMarkdown = (id: string) => window.open(`${API_BASE_URL}/api/export/${id}/markdown`, '_blank');
  const dlJSON     = (id: string) => window.open(`${API_BASE_URL}/api/export/${id}/json`, '_blank');

  const fmtDate = (d: string) => {
    if (!d) return 'N/A';
    return new Date(d).toLocaleString('fr-FR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  return (
    <div className="space-y-6 animate-fade-in-up">

      {/* ── Header ───────────────────────────────────────────── */}
      <div className="card">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: 'rgba(251,146,60,0.1)', border: '1px solid rgba(251,146,60,0.25)' }}
            >
              <History className="w-4 h-4" style={{ color: '#fb923c' }} />
            </div>
            <div>
              <h2 className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>
                Historique des Analyses
              </h2>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {reports.length} rapport{reports.length !== 1 ? 's' : ''} · {jobs.length} job{jobs.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <button className="btn-secondary" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </button>
        </div>
      </div>

      {/* ── Error ────────────────────────────────────────────── */}
      {error && (
        <div className="alert-error flex items-center gap-3">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* ── Loading ──────────────────────────────────────────── */}
      {loading && (
        <div className="flex flex-col items-center justify-center gap-3 py-20">
          <Loader2 className="w-10 h-10 animate-spin" style={{ color: 'var(--accent-blue)' }} />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Chargement de l'historique...</p>
        </div>
      )}

      {/* ── Content ──────────────────────────────────────────── */}
      {!loading && !error && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* ── Jobs ───────────────────────────────────────── */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-3.5 h-3.5" style={{ color: 'var(--accent-orange)' }} />
              <h3 className="label-sm">Jobs Récents</h3>
              <span className="badge badge-pending ml-1" style={{ fontSize: '0.65rem' }}>{jobs.length}</span>
            </div>

            {jobs.length === 0 ? (
              <div className="card text-center py-12">
                <ShieldOff className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--text-dim)' }} />
                <p className="font-medium text-sm" style={{ color: 'var(--text-muted)' }}>Aucun job d'analyse</p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-dim)' }}>Lancez une analyse depuis l'onglet Scanner.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {jobs.map((job, i) => (
                  <div
                    key={job.job_id}
                    className="card stagger-item p-3.5 cursor-pointer"
                    style={{ animationDelay: `${i * 0.05}s`, padding: '0.875rem' }}
                    onClick={() => job.report_id && viewReport(job.report_id)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-sm truncate" style={{ color: 'var(--text-primary)' }}>
                          {job.filename || 'Fichier inconnu'}
                        </p>
                        <div className="flex items-center gap-1.5 mt-1">
                          <Calendar className="w-3 h-3" style={{ color: 'var(--text-muted)' }} />
                          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{fmtDate(job.created_at)}</span>
                        </div>
                        {job.progress && (
                          <p className="text-xs mt-1.5" style={{ color: 'var(--accent-cyan)' }}>{job.progress}</p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-2 flex-shrink-0">
                        <JobStatusBadge status={job.status} />
                        {job.report_id && (
                          <ChevronRight className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Reports ─────────────────────────────────────── */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <FileText className="w-3.5 h-3.5" style={{ color: 'var(--accent-blue)' }} />
              <h3 className="label-sm">Rapports Disponibles</h3>
              <span className="badge badge-pending ml-1" style={{ fontSize: '0.65rem' }}>{reports.length}</span>
            </div>

            {reports.length === 0 ? (
              <div className="card text-center py-12">
                <BarChart3 className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--text-dim)' }} />
                <p className="font-medium text-sm" style={{ color: 'var(--text-muted)' }}>Aucun rapport disponible</p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-dim)' }}>Lancez une analyse depuis l'onglet Scanner.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {reports.map((r, i) => (
                  <div
                    key={r.id}
                    className="card stagger-item"
                    style={{ animationDelay: `${i * 0.05}s`, padding: '0.875rem' }}
                  >
                    <div className="flex items-start gap-3 mb-3">
                      {r.overall_score !== undefined && (
                        <ScoreCircle score={r.overall_score} />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-sm truncate" style={{ color: 'var(--text-primary)' }}>
                          {r.apk_name}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <Hash className="w-3 h-3" style={{ color: 'var(--text-muted)' }} />
                          <span className="mono text-[10px]" style={{ color: 'var(--text-muted)' }}>
                            {r.apk_hash?.slice(0, 18)}...
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <Calendar className="w-3 h-3" style={{ color: 'var(--text-muted)' }} />
                          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{fmtDate(r.timestamp)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <button
                        className="btn-secondary"
                        style={{ fontSize: '0.78rem', padding: '0.4rem 0.85rem' }}
                        onClick={() => viewReport(r.id)}
                        disabled={loadingReport === r.id}
                      >
                        {loadingReport === r.id
                          ? <Loader2 className="w-3 h-3 animate-spin" />
                          : <FileText className="w-3 h-3" />
                        }
                        Voir rapport
                      </button>
                      <button
                        className="btn-ghost"
                        style={{ fontSize: '0.78rem', padding: '0.4rem 0.85rem' }}
                        onClick={() => dlMarkdown(r.id)}
                      >
                        <Download className="w-3 h-3" /> .md
                      </button>
                      <button
                        className="btn-ghost"
                        style={{ fontSize: '0.78rem', padding: '0.4rem 0.85rem' }}
                        onClick={() => dlJSON(r.id)}
                      >
                        <Download className="w-3 h-3" /> .json
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Selected Report Detail ────────────────────────────── */}
      {selectedReport && (
        <div ref={reportPanelRef} className="card animate-scale-in">

          {/* Report header */}
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex items-center gap-4">
              <ScoreCircle score={selectedReport.overall_score} />
              <div>
                <h3 className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>
                  {selectedReport.apk_name}
                </h3>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Hash className="w-3 h-3" style={{ color: 'var(--text-muted)' }} />
                  <span className="mono text-xs" style={{ color: 'var(--text-muted)' }}>
                    {selectedReport.apk_hash?.slice(0, 18)}…
                  </span>
                </div>
                {/* Severity counts */}
                <div className="flex gap-2 mt-2 flex-wrap">
                  {(() => {
                    const crits  = selectedReport.findings?.filter(f => f.severity === 'critical').length ?? 0;
                    const majors = selectedReport.findings?.filter(f => f.severity === 'major').length ?? 0;
                    const minors = selectedReport.findings?.filter(f => f.severity === 'minor').length ?? 0;
                    return (
                      <>
                        {crits  > 0 && <span className="badge badge-critical">{crits} Critiques</span>}
                        {majors > 0 && <span className="badge badge-major">{majors} Majeurs</span>}
                        {minors > 0 && <span className="badge badge-minor">{minors} Mineurs</span>}
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 flex-shrink-0">
              <button className="btn-secondary" onClick={() => dlMarkdown(selectedReport.id)}>
                <Download className="w-3.5 h-3.5" /> .md
              </button>
              <button className="btn-ghost" onClick={() => setSelectedReport(null)}>
                <X className="w-3.5 h-3.5" /> Fermer
              </button>
            </div>
          </div>

          <div className="divider" />

          {/* Executive summary */}
          {selectedReport.executive_summary && (
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="w-3.5 h-3.5" style={{ color: 'var(--accent-purple)' }} />
                <p className="label-sm">Résumé Exécutif (IA)</p>
              </div>
              <p
                className="text-sm leading-relaxed whitespace-pre-line"
                style={{ color: 'var(--text-secondary)', lineHeight: 1.75 }}
              >
                {selectedReport.executive_summary}
              </p>
            </div>
          )}

          {/* Findings compact list */}
          {selectedReport.findings?.length > 0 && (
            <div>
              <div className="divider" />
              <div className="flex items-center gap-2 mb-3">
                <BarChart3 className="w-3.5 h-3.5" style={{ color: 'var(--accent-orange)' }} />
                <p className="label-sm">Findings ({selectedReport.findings.length})</p>
              </div>
              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {selectedReport.findings
                  .sort((a, b) => {
                    const o: Record<string, number> = { critical: 0, major: 1, minor: 2 };
                    return (o[a.severity] ?? 3) - (o[b.severity] ?? 3);
                  })
                  .map((f: any) => {
                    const sev = f.severity || 'minor';
                    const colors: Record<string, string> = {
                      critical: '#f87171', major: '#fb923c', minor: '#fbbf24',
                    };
                    const c = colors[sev] || '#94a3b8';
                    return (
                      <div
                        key={f.id}
                        className="flex items-center gap-2.5 p-2.5 rounded-xl"
                        style={{
                          background: 'var(--bg-secondary)',
                          border: '1px solid var(--border)',
                          borderLeft: `3px solid ${c}`,
                        }}
                      >
                        <span
                          className="badge flex-shrink-0"
                          style={{
                            background: `${c}1a`, color: c,
                            border: `1px solid ${c}44`,
                            fontSize: '0.65rem',
                          }}
                        >
                          {sev.toUpperCase()}
                        </span>
                        <span className="text-xs flex-1 font-medium" style={{ color: 'var(--text-primary)' }}>
                          {f.title}
                        </span>
                        {f.masvs_id && (
                          <span className="badge badge-cyan mono flex-shrink-0" style={{ fontSize: '0.65rem' }}>
                            {f.masvs_id}
                          </span>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ReportHistory;
