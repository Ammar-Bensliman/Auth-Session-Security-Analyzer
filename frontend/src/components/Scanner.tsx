import React, { useState, useRef, useCallback } from 'react';
import {
  Upload, Loader2, FileCode2, AlertCircle, CheckCircle,
  Download, Shield, AlertTriangle, ChevronDown, ChevronUp,
  Zap, FileSearch, Hash, Clock, BarChart3, RefreshCw
} from 'lucide-react';

const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || 'http://127.0.0.1:8000';

type Status = 'idle' | 'uploading' | 'pending' | 'running' | 'done' | 'failed' | 'error';

interface Finding {
  id: string;
  title: string;
  description: string;
  file_path: string;
  line_number?: number;
  evidence: string;
  masvs_id: string;
  mastg_test: string;
  severity: string;
  score: number;
  remediation: string;
}

interface Report {
  id: string;
  apk_name: string;
  apk_hash: string;
  overall_score: number;
  executive_summary: string;
  findings: Finding[];
}

/* ── Severity config ─────────────────────────────────────────── */
const SEV_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; icon: string }> = {
  critical: { label: 'CRITICAL', color: '#fca5a5', bg: 'rgba(248,113,113,0.10)', border: 'rgba(248,113,113,0.28)', icon: '🔴' },
  major:    { label: 'MAJOR',    color: '#fdba74', bg: 'rgba(251,146,60,0.10)',  border: 'rgba(251,146,60,0.28)',  icon: '🟠' },
  minor:    { label: 'MINOR',    color: '#fde68a', bg: 'rgba(251,191,36,0.10)', border: 'rgba(251,191,36,0.25)',  icon: '🟡' },
};

/* ── Score Circle ────────────────────────────────────────────── */
const ScoreCircle = ({ score }: { score: number }) => {
  const color =
    score > 80 ? '#34d399' :
    score > 50 ? '#fb923c' :
    '#f87171';
  const glowColor =
    score > 80 ? 'rgba(52,211,153,0.35)' :
    score > 50 ? 'rgba(251,146,60,0.35)' :
    'rgba(248,113,113,0.35)';
  const label = score > 80 ? 'Sûr' : score > 50 ? 'Risqué' : 'Critique';

  const r = 30;
  const c = 2 * Math.PI * r;
  const arc = (score / 100) * c;

  return (
    <div className="flex flex-col items-center gap-1.5">
      <svg width="90" height="90" viewBox="0 0 76 76" style={{ filter: `drop-shadow(0 0 10px ${glowColor})` }}>
        {/* Track */}
        <circle cx="38" cy="38" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="7" />
        {/* Arc */}
        <circle
          cx="38" cy="38" r={r}
          fill="none"
          stroke={color}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={`${arc} ${c}`}
          strokeDashoffset={-(c / 4)}
          style={{ transition: 'stroke-dasharray 1.4s cubic-bezier(0.4,0,0.2,1)', }}
        />
        <text x="38" y="34" textAnchor="middle" fontSize="16" fontWeight="800" fill={color} dominantBaseline="middle">
          {Math.round(score)}
        </text>
        <text x="38" y="50" textAnchor="middle" fontSize="8.5" fill="var(--text-muted)" dominantBaseline="middle">
          / 100
        </text>
      </svg>
      <span className="text-xs font-bold" style={{ color }}>{label}</span>
    </div>
  );
};

/* ── Finding Card ────────────────────────────────────────────── */
const FindingCard = ({ f, index }: { f: Finding; index: number }) => {
  const [open, setOpen] = useState(false);
  const cfg = SEV_CONFIG[f.severity] || SEV_CONFIG.minor;

  return (
    <div
      className={`card finding-${f.severity} stagger-item`}
      style={{ padding: '1rem', cursor: 'pointer', animationDelay: `${index * 0.05}s` }}
      onClick={() => setOpen(o => !o)}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            {/* Severity badge */}
            <span
              className="badge"
              style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`, fontSize: '0.68rem' }}
            >
              {cfg.icon} {cfg.label}
            </span>
            {/* MASVS badge */}
            {f.masvs_id && (
              <span className="badge badge-cyan mono" style={{ fontSize: '0.68rem' }}>
                {f.masvs_id}
              </span>
            )}
          </div>
          <p className="text-sm font-semibold leading-snug" style={{ color: 'var(--text-primary)' }}>
            {f.title}
          </p>
          <p className="text-xs mt-1 line-clamp-2" style={{ color: 'var(--text-muted)' }}>{f.description}</p>
        </div>
        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          <div
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold"
            style={{ background: 'rgba(79,158,248,0.1)', color: 'var(--accent-blue)', border: '1px solid rgba(79,158,248,0.2)' }}
          >
            <BarChart3 className="w-3 h-3" />
            {f.score}
          </div>
          {open
            ? <ChevronUp className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
            : <ChevronDown className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
          }
        </div>
      </div>

      {/* Expanded content */}
      {open && (
        <div className="mt-3 pt-3 space-y-3 animate-fade-in" style={{ borderTop: '1px solid var(--border)' }}>
          {/* Evidence */}
          {f.evidence && (
            <div className="code-block text-xs">
              {f.evidence}
            </div>
          )}
          {/* File location */}
          {f.file_path && (
            <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--accent-cyan)' }}>
              <FileSearch className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="mono">{f.file_path}{f.line_number ? `:${f.line_number}` : ''}</span>
            </div>
          )}
          {/* Remediation */}
          <div
            className="flex items-start gap-2.5 p-3 rounded-xl text-xs"
            style={{ background: 'rgba(52,211,153,0.07)', border: '1px solid rgba(52,211,153,0.2)' }}
          >
            <CheckCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: '#34d399' }} />
            <p style={{ color: '#6ee7b7' }}>
              <span className="font-semibold">Remédiation : </span>{f.remediation}
            </p>
          </div>
          {/* MASTG */}
          {f.mastg_test && (
            <p className="text-xs mono" style={{ color: 'var(--text-muted)' }}>
              🔬 MASTG : <span style={{ color: 'var(--accent-purple)' }}>{f.mastg_test}</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
};

/* ── Main Scanner Component ──────────────────────────────────── */
const Scanner = () => {
  const [status, setStatus]     = useState<Status>('idle');
  const [progress, setProgress] = useState('');
  const [report, setReport]     = useState<Report | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollRef      = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = () => { if (pollRef.current) clearInterval(pollRef.current); };

  const pollJobStatus = useCallback(async (jid: string) => {
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/jobs/${jid}`);
        if (!res.ok) return;
        const job = await res.json();
        setProgress(job.progress || '');
        setStatus(job.status);

        if (job.status === 'done' && job.report_id) {
          stopPolling();
          const rep = await fetch(`${API_BASE_URL}/api/report/${job.report_id}`);
          if (rep.ok) setReport(await rep.json());
        } else if (job.status === 'failed') {
          stopPolling();
          setErrorMsg(job.error_message || "L'analyse a échoué.");
        }
      } catch { /* keep polling */ }
    }, 1500);
  }, []);

  const handleFile = async (file: File) => {
    setStatus('uploading');
    setErrorMsg('');
    setReport(null);
    setProgress('');
    setFileName(file.name);

    const form = new FormData();
    form.append('file', file);

    try {
      const uploadRes = await fetch(`${API_BASE_URL}/api/upload/apk`, { method: 'POST', body: form });
      if (!uploadRes.ok) throw new Error("Échec de l'upload. L'API est-elle lancée ?");
      const up = await uploadRes.json();

      const analyzeRes = await fetch(`${API_BASE_URL}/api/analyze/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_id: up.file_id, apk_hash: up.hash, filename: up.filename }),
      });
      if (!analyzeRes.ok) throw new Error("Échec du lancement de l'analyse.");
      const { job_id } = await analyzeRes.json();

      setStatus('pending');
      setProgress('Job créé, démarrage en cours...');
      pollJobStatus(job_id);
    } catch (err: any) {
      stopPolling();
      setStatus('error');
      const msg = err.message || 'Erreur inconnue.';
      setErrorMsg(msg.includes('Failed to fetch') ? 'Impossible de se connecter à l\'API backend.' : msg);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
  };

  const reset = () => {
    stopPolling();
    setStatus('idle');
    setReport(null);
    setErrorMsg('');
    setProgress('');
    setFileName('');
  };

  const downloadMarkdown = () => {
    if (!report) return;
    window.open(`${API_BASE_URL}/api/export/${report.id}/markdown`, '_blank');
  };

  const isIdle = status === 'idle' || status === 'error' || status === 'done';
  const isBusy = status === 'uploading' || status === 'pending' || status === 'running';

  const criticals = report?.findings.filter(f => f.severity === 'critical').length ?? 0;
  const majors    = report?.findings.filter(f => f.severity === 'major').length ?? 0;
  const minors    = report?.findings.filter(f => f.severity === 'minor').length ?? 0;

  /* ── Progress steps ──────────────────────────────────────── */
  const STEPS = ['Upload', 'Décompilation', 'SAST/DAST', 'IA Rapport'];
  const stepIndex =
    status === 'uploading' ? 0 :
    status === 'pending'   ? 1 :
    status === 'running'   ? 2 : 3;

  return (
    <div className="space-y-6">

      {/* ── Header card ──────────────────────────────────────── */}
      <div className="card">
        <div className="flex items-center gap-3 mb-1">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg,rgba(79,158,248,0.2),rgba(79,158,248,0.05))', border: '1px solid rgba(79,158,248,0.25)' }}
          >
            <Shield className="w-4 h-4" style={{ color: 'var(--accent-blue)' }} />
          </div>
          <div>
            <h2 className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>
              Scanner SAST / DAST
            </h2>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Analyse statique + dynamique · OWASP MASVS v2
            </p>
          </div>
          <div className="ml-auto flex gap-2 flex-wrap">
            {['Semgrep', 'JADX', 'JWT', 'RAG+Gemini'].map(s => (
              <span key={s} className="badge badge-running" style={{ fontSize: '0.68rem' }}>{s}</span>
            ))}
          </div>
        </div>
      </div>

      {/* ── Upload zone ──────────────────────────────────────── */}
      <div className="card" style={{ padding: '0' }}>
        <input
          type="file"
          ref={fileInputRef}
          onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
          accept=".apk,.txt,.xml,.har"
          className="hidden"
        />
        <div
          className={`dropzone ${isBusy ? 'busy' : ''} ${dragging ? 'drag-over' : ''}`}
          style={{ borderRadius: 16, border: 'none', margin: 0 }}
          onClick={() => isIdle && fileInputRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
        >
          {/* IDLE */}
          {status === 'idle' && (
            <div className="flex flex-col items-center gap-4">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center animate-float"
                style={{ background: 'linear-gradient(135deg,rgba(79,158,248,0.15),rgba(79,158,248,0.05))', border: '1px solid rgba(79,158,248,0.25)' }}
              >
                <Upload className="w-8 h-8" style={{ color: 'var(--accent-blue)' }} />
              </div>
              <div className="text-center">
                <p className="font-semibold text-base" style={{ color: 'var(--text-primary)' }}>
                  Glissez un fichier ou cliquez pour sélectionner
                </p>
                <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                  Formats acceptés : <span className="mono" style={{ color: 'var(--accent-cyan)' }}>.apk · .txt · .xml · .har</span>
                </p>
              </div>
              {/* Pipeline steps visual */}
              <div className="flex items-center gap-1 flex-wrap justify-center">
                {['[1] Apktool+JADX', '[2] Semgrep SAST', '[3] Flow DAST', '[4] RAG+Gemini'].map((s, i) => (
                  <span key={i} className="badge badge-pending" style={{ fontSize: '0.68rem' }}>{s}</span>
                ))}
              </div>
            </div>
          )}

          {/* UPLOADING */}
          {status === 'uploading' && (
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-12 h-12 animate-spin" style={{ color: 'var(--accent-blue)' }} />
              <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>Téléversement en cours...</p>
              {fileName && (
                <p className="text-xs mono" style={{ color: 'var(--text-muted)' }}>{fileName}</p>
              )}
            </div>
          )}

          {/* PENDING / RUNNING */}
          {(status === 'pending' || status === 'running') && (
            <div className="flex flex-col items-center gap-5 w-full max-w-md mx-auto">
              <Loader2 className="w-12 h-12 animate-spin" style={{ color: 'var(--accent-purple)' }} />

              {/* Step progress */}
              <div className="w-full">
                <div className="flex justify-between mb-3">
                  {STEPS.map((s, i) => (
                    <div key={s} className="flex flex-col items-center gap-1" style={{ flex: 1 }}>
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all duration-500"
                        style={{
                          background: i <= stepIndex ? 'linear-gradient(135deg,#4f9ef8,#a78bfa)' : 'var(--bg-secondary)',
                          border: `1px solid ${i <= stepIndex ? 'rgba(79,158,248,0.4)' : 'var(--border)'}`,
                          color: i <= stepIndex ? '#fff' : 'var(--text-muted)',
                          boxShadow: i === stepIndex ? '0 0 10px rgba(79,158,248,0.5)' : 'none',
                        }}
                      >
                        {i < stepIndex ? '✓' : i + 1}
                      </div>
                      <span className="text-[9px] font-medium text-center" style={{ color: i <= stepIndex ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                        {s}
                      </span>
                    </div>
                  ))}
                </div>
                {/* Connecting line */}
                <div className="progress-track">
                  <div
                    className="progress-fill animated"
                    style={{ width: `${((stepIndex + 1) / STEPS.length) * 100}%` }}
                  />
                </div>
              </div>

              <p className="text-sm text-center" style={{ color: 'var(--text-muted)' }}>
                {progress || (status === 'pending' ? 'En attente de démarrage...' : 'Analyse en cours...')}
              </p>
            </div>
          )}

          {/* DONE */}
          {status === 'done' && (
            <div
              className="flex flex-col items-center gap-2 cursor-pointer"
              onClick={e => { e.stopPropagation(); reset(); }}
            >
              <CheckCircle className="w-12 h-12" style={{ color: '#34d399' }} />
              <p className="font-bold text-base" style={{ color: '#34d399' }}>Analyse terminée !</p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Cliquez pour analyser un autre fichier</p>
            </div>
          )}

          {/* ERROR */}
          {(status === 'error' || status === 'failed') && (
            <div
              className="flex flex-col items-center gap-2 cursor-pointer"
              onClick={e => { e.stopPropagation(); reset(); }}
            >
              <AlertCircle className="w-12 h-12" style={{ color: '#f87171' }} />
              <p className="font-bold text-base" style={{ color: '#f87171' }}>Erreur pendant l'analyse</p>
              <p className="text-xs max-w-sm text-center" style={{ color: '#fca5a5' }}>{errorMsg}</p>
              <button className="btn-ghost mt-1" onClick={e => { e.stopPropagation(); reset(); }}>
                <RefreshCw className="w-3.5 h-3.5" /> Réessayer
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Report ───────────────────────────────────────────── */}
      {report && (
        <div className="space-y-5 animate-fade-in-up">

          {/* ── Stats header ─────────────────────────────────── */}
          <div className="card">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
              <div className="flex items-center gap-5">
                <ScoreCircle score={report.overall_score} />
                <div>
                  <h3 className="font-bold text-lg leading-tight" style={{ color: 'var(--text-primary)' }}>
                    {report.apk_name}
                  </h3>
                  <div className="flex items-center gap-1.5 mt-1">
                    <Hash className="w-3 h-3" style={{ color: 'var(--text-muted)' }} />
                    <span className="text-xs mono" style={{ color: 'var(--text-muted)' }}>
                      {report.apk_hash?.slice(0, 20)}...
                    </span>
                  </div>

                  {/* Severity counts */}
                  <div className="flex gap-2 mt-3 flex-wrap">
                    <div className="stat-block" style={{ minWidth: 64 }}>
                      <span className="stat-value" style={{ color: '#f87171' }}>{criticals}</span>
                      <span className="stat-label">Critiques</span>
                    </div>
                    <div className="stat-block" style={{ minWidth: 64 }}>
                      <span className="stat-value" style={{ color: '#fdba74' }}>{majors}</span>
                      <span className="stat-label">Majeurs</span>
                    </div>
                    <div className="stat-block" style={{ minWidth: 64 }}>
                      <span className="stat-value" style={{ color: '#fde68a' }}>{minors}</span>
                      <span className="stat-label">Mineurs</span>
                    </div>
                    <div className="stat-block" style={{ minWidth: 64 }}>
                      <span className="stat-value" style={{ color: 'var(--accent-blue)' }}>{report.findings.length}</span>
                      <span className="stat-label">Total</span>
                    </div>
                  </div>
                </div>
              </div>

              <button className="btn-secondary" onClick={downloadMarkdown}>
                <Download className="w-4 h-4" />
                Exporter .md
              </button>
            </div>
          </div>

          {/* ── Executive Summary ─────────────────────────────── */}
          {report.executive_summary && (
            <div className="card">
              <div className="flex items-center gap-2 mb-3">
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center"
                  style={{ background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.2)' }}
                >
                  <Zap className="w-3.5 h-3.5" style={{ color: 'var(--accent-purple)' }} />
                </div>
                <h4 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
                  Résumé Exécutif IA (Gemini)
                </h4>
                <span className="badge badge-purple ml-auto" style={{ fontSize: '0.65rem' }}>RAG</span>
              </div>
              <p
                className="text-sm leading-relaxed whitespace-pre-line"
                style={{ color: 'var(--text-secondary)', lineHeight: 1.75 }}
              >
                {report.executive_summary}
              </p>
            </div>
          )}

          {/* ── Findings list ─────────────────────────────────── */}
          {report.findings.length > 0 ? (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle className="w-4 h-4" style={{ color: 'var(--accent-orange)' }} />
                <h4 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
                  Vulnérabilités Détectées
                </h4>
                <span className="badge badge-major" style={{ fontSize: '0.68rem' }}>{report.findings.length} findings</span>
              </div>
              <div className="space-y-3">
                {report.findings
                  .sort((a, b) => {
                    const order: Record<string, number> = { critical: 0, major: 1, minor: 2 };
                    return (order[a.severity] ?? 3) - (order[b.severity] ?? 3) || b.score - a.score;
                  })
                  .map((f, i) => <FindingCard key={f.id} f={f} index={i} />)}
              </div>
            </div>
          ) : (
            <div className="card text-center py-10" style={{ background: 'rgba(52,211,153,0.04)', borderColor: 'rgba(52,211,153,0.2)' }}>
              <CheckCircle className="w-12 h-12 mx-auto mb-3" style={{ color: '#34d399' }} />
              <p className="font-bold text-base" style={{ color: '#34d399' }}>Aucune vulnérabilité détectée</p>
              <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                L'analyse n'a trouvé aucune anomalie de sécurité dans ce fichier.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Scanner;
