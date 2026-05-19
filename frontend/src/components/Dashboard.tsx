import React, { useState, useRef, useCallback } from 'react';
import { 
  Shield, Wifi, CheckCircle2, Download, FileOutput, 
  ChevronDown, ChevronUp, BrainCircuit, Activity, Upload, Loader2, AlertCircle, RefreshCw
} from 'lucide-react';

const envUrl = (import.meta as any).env?.VITE_API_URL;
const API_BASE_URL = envUrl && !envUrl.includes('localhost') && !envUrl.includes('127.0.0.1') ? envUrl : `http://${window.location.hostname}:8000`;

type Status = 'idle' | 'uploading' | 'pending' | 'PENDING' | 'DECOMPILING' | 'SCANNING_SAST' | 'AI_ANALYSIS' | 'COMPLETED' | 'FAILED' | 'error';

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

interface GroupedFinding {
  id: string;
  title: string;
  severity: string;
  rule: string; // fallback to mastg_test or title
  count: number;
  occurrences: Finding[];
  bg: string;
  color: string;
  border: string;
}

const SEV_CONFIG: Record<string, { bg: string, color: string, border: string }> = {
  critical: { color: 'text-red-500', bg: 'bg-red-500/10', border: 'border-red-500/20' },
  major:    { color: 'text-orange-500', bg: 'bg-orange-500/10', border: 'border-orange-500/20' },
  minor:    { color: 'text-yellow-500', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20' },
};

export default function Dashboard() {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'critical' | 'major' | 'minor'>('all');
  
  // Scanner State
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
        const backendStatus = job.status.toUpperCase() as Status;
        setStatus(backendStatus);

        if (backendStatus === 'COMPLETED' && job.report_id) {
          stopPolling();
          const rep = await fetch(`${API_BASE_URL}/api/report/${job.report_id}`);
          if (rep.ok) setReport(await rep.json());
        } else if (backendStatus === 'FAILED') {
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
      setErrorMsg(err.message || 'Erreur inconnue.');
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

  const dlMarkdown = () => {
    if (!report) return;
    window.open(`${API_BASE_URL}/api/export/${report.id}/markdown`, '_blank');
  };

  const dlPDF = () => {
    if (!report) return;
    window.open(`${API_BASE_URL}/api/export/${report.id}/pdf`, '_blank');
  };

  const isIdle = status === 'idle' || status === 'error' || status === 'COMPLETED' || status === 'FAILED';
  const isBusy = !isIdle;

  // Process Report
  const criticals = report?.findings.filter(f => f.severity === 'critical').length ?? 0;
  const majors    = report?.findings.filter(f => f.severity === 'major').length ?? 0;
  const minors    = report?.findings.filter(f => f.severity === 'minor').length ?? 0;
  const total     = report?.findings.length ?? 0;

  // Group findings
  const groupedFindings: GroupedFinding[] = [];
  if (report) {
    const groups: Record<string, Finding[]> = {};
    report.findings.forEach(f => {
      (groups[f.title] = groups[f.title] || []).push(f);
    });

    Object.entries(groups).forEach(([title, occs]) => {
      const f = occs[0];
      if (!f) return;
      const cfg = SEV_CONFIG[f.severity] || SEV_CONFIG.minor;
      groupedFindings.push({
        id: title,
        title: title,
        severity: f.severity.toUpperCase(),
        rule: f.mastg_test || f.masvs_id || 'Règle inconnue',
        count: occs.length,
        occurrences: occs,
        bg: cfg.bg,
        color: cfg.color,
        border: cfg.border
      });
    });
  }

  // Filtered
  const filteredGroups = groupedFindings.filter(g => filter === 'all' || g.severity.toLowerCase() === filter);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white font-sans selection:bg-blue-500/30 pb-20">
      

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        
        {/* 3. Scanner Status Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-xl">
          <div className="flex items-start justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg">
                <Activity className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">Scanner SAST / DAST</h2>
                <p className="text-sm text-slate-400 dark:text-slate-400">Analyse statique + dynamique - OWASP MASVS v2</p>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <span className="px-3 py-1 text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-300 rounded-full border border-slate-300 dark:border-slate-700">Semgrep</span>
              <span className="px-3 py-1 text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-300 rounded-full border border-slate-300 dark:border-slate-700">JADX</span>
              <span className="px-3 py-1 text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-300 rounded-full border border-slate-300 dark:border-slate-700">JWT</span>
              <span className="px-3 py-1 text-xs font-medium bg-purple-500/10 text-purple-400 rounded-full border border-purple-500/20">RAG+Gemini</span>
            </div>
          </div>
          
          <input
            type="file"
            ref={fileInputRef}
            onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
            accept=".apk,.txt,.xml,.har"
            className="hidden"
          />
          
          <div 
            className={`flex flex-col items-center justify-center py-10 text-center rounded-xl border-2 border-dashed transition-all
              ${dragging ? 'border-blue-500 bg-blue-500/5' : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:border-slate-700'}
              ${isIdle ? 'cursor-pointer' : ''}`}
            onClick={() => isIdle && fileInputRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
          >
            {status === 'idle' && (
              <>
                <div className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center mb-4 border border-blue-500/20">
                  <Upload className="w-8 h-8 text-blue-500" />
                </div>
                <h3 className="text-lg font-bold text-slate-700 dark:text-slate-200 mb-1">Glissez un fichier ou cliquez</h3>
                <p className="text-sm text-slate-400 dark:text-slate-500">Formats acceptés : .apk · .txt · .xml · .har</p>
              </>
            )}

            {status === 'uploading' && (
              <>
                <Loader2 className="w-12 h-12 animate-spin text-blue-500 mb-4" />
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Téléversement en cours...</h3>
                <p className="text-sm text-slate-400 dark:text-slate-500">{fileName}</p>
              </>
            )}

            {['pending', 'PENDING', 'DECOMPILING', 'SCANNING_SAST', 'AI_ANALYSIS'].includes(status) && (
              <>
                <Loader2 className="w-12 h-12 animate-spin text-purple-500 mb-4" />
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">{progress || 'Analyse en cours...'}</h3>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 text-[10px] uppercase font-bold rounded bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-300 ${status.includes('DECOMPILING') ? 'ring-1 ring-blue-500' : ''}`}>Décompilation</span>
                  <span className={`px-2 py-1 text-[10px] uppercase font-bold rounded bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-300 ${status === 'SCANNING_SAST' ? 'ring-1 ring-blue-500' : ''}`}>SAST/DAST</span>
                  <span className={`px-2 py-1 text-[10px] uppercase font-bold rounded bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-300 ${status === 'AI_ANALYSIS' ? 'ring-1 ring-purple-500' : ''}`}>IA Rapport</span>
                </div>
              </>
            )}

            {status === 'COMPLETED' && (
              <div className="group" onClick={(e) => { e.stopPropagation(); reset(); }}>
                <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex mx-auto items-center justify-center mb-4 border border-emerald-500/20 group-hover:scale-105 transition-transform">
                  <CheckCircle2 className="w-10 h-10 text-emerald-500" />
                </div>
                <h3 className="text-xl font-bold text-emerald-400 mb-1">Analyse terminée !</h3>
                <p className="text-sm text-slate-400 dark:text-slate-400 group-hover:text-slate-400 dark:text-slate-300">Cliquez pour analyser un autre fichier</p>
              </div>
            )}

            {(status === 'error' || status === 'FAILED') && (
              <div onClick={(e) => { e.stopPropagation(); reset(); }}>
                <AlertCircle className="w-16 h-16 text-red-500 mb-4 mx-auto" />
                <h3 className="text-xl font-bold text-red-400 mb-1">Erreur pendant l'analyse</h3>
                <p className="text-sm text-slate-400 dark:text-slate-400 max-w-md mx-auto mb-4">{errorMsg}</p>
                <button className="flex items-center gap-2 mx-auto px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-700 rounded-lg text-sm text-slate-900 dark:text-white">
                  <RefreshCw className="w-4 h-4" /> Réessayer
                </button>
              </div>
            )}
          </div>
        </div>

        {/* 4. Metrics & Action Card */}
        {report && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-xl animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="mb-6">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-1">{report.apk_name}</h2>
              <p className="text-xs font-mono text-slate-400 dark:text-slate-500">SHA256: {report.apk_hash}</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-[auto_1fr_auto] gap-8 items-center">
              
              {/* Score */}
              <div className="flex flex-col items-center">
                <div className="relative w-28 h-28 flex items-center justify-center">
                  <svg className="w-full h-full transform -rotate-90">
                    <circle cx="56" cy="56" r="52" className="stroke-slate-200 dark:stroke-slate-800" strokeWidth="8" fill="none" />
                    <circle 
                      cx="56" cy="56" r="52" 
                      className={report.overall_score > 80 ? "stroke-emerald-500" : report.overall_score > 50 ? "stroke-orange-500" : "stroke-red-500"} 
                      strokeWidth="8" fill="none" 
                      strokeDasharray="326" 
                      strokeDashoffset={326 - (report.overall_score / 100) * 326} 
                      style={{ transition: 'stroke-dashoffset 1s ease-out' }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className={`text-3xl font-black tracking-tighter ${report.overall_score > 80 ? "text-emerald-500" : report.overall_score > 50 ? "text-orange-500" : "text-red-500"}`}>
                      {Math.round(report.overall_score)}
                    </span>
                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-widest border-t border-slate-200 dark:border-slate-800 pt-1 mt-1 w-12 text-center">/ 100</span>
                  </div>
                </div>
                <span className={`text-sm font-bold mt-3 tracking-wide uppercase ${report.overall_score > 80 ? "text-emerald-500" : report.overall_score > 50 ? "text-orange-500" : "text-red-500"}`}>
                  {report.overall_score > 80 ? 'Sûr' : report.overall_score > 50 ? 'Risqué' : 'Critique'}
                </span>
              </div>

              {/* Metrics */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 w-full">
                <div className="bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 p-4 rounded-xl relative overflow-hidden group">
                  <div className="absolute top-0 left-0 w-1 h-full bg-red-500"></div>
                  <div className="text-3xl font-black text-red-500 mb-1 group-hover:scale-105 transition-transform origin-left">{criticals}</div>
                  <div className="text-xs font-bold text-slate-400 dark:text-slate-400 tracking-wider">CRITIQUES</div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 p-4 rounded-xl relative overflow-hidden group">
                  <div className="absolute top-0 left-0 w-1 h-full bg-orange-500"></div>
                  <div className="text-3xl font-black text-orange-500 mb-1 group-hover:scale-105 transition-transform origin-left">{majors}</div>
                  <div className="text-xs font-bold text-slate-400 dark:text-slate-400 tracking-wider">MAJEURS</div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 p-4 rounded-xl relative overflow-hidden group">
                  <div className="absolute top-0 left-0 w-1 h-full bg-yellow-500"></div>
                  <div className="text-3xl font-black text-yellow-500 mb-1 group-hover:scale-105 transition-transform origin-left">{minors}</div>
                  <div className="text-xs font-bold text-slate-400 dark:text-slate-400 tracking-wider">MINEURS</div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 p-4 rounded-xl relative overflow-hidden group">
                  <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
                  <div className="text-3xl font-black text-blue-500 mb-1 group-hover:scale-105 transition-transform origin-left">{total}</div>
                  <div className="text-xs font-bold text-slate-400 dark:text-slate-400 tracking-wider">TOTAL</div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col sm:flex-row md:flex-col gap-3">
                <button onClick={dlMarkdown} className="flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold text-slate-400 dark:text-slate-300 bg-transparent border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:bg-slate-800 hover:text-slate-900 dark:text-white rounded-xl transition-all">
                  <Download className="w-4 h-4" />
                  Exporter .md
                </button>
                <button onClick={dlPDF} className="flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold text-slate-900 dark:text-white bg-blue-600 hover:bg-blue-500 rounded-xl shadow-lg shadow-blue-900/20 transition-all border border-blue-500 hover:border-blue-400">
                  <FileOutput className="w-4 h-4" />
                  Télécharger rapport PDF détaillé
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 5. Findings Section */}
        {report && (
          <div className="pt-4 animate-in fade-in slide-in-from-bottom-6 duration-700">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Vulnérabilités Détectées</h2>
            </div>

            <div className="flex gap-2 overflow-x-auto no-scrollbar mb-6 pb-2">
              <button onClick={() => setFilter('all')} className={`px-4 py-2 text-sm rounded-full transition-colors whitespace-nowrap ${filter === 'all' ? 'font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'font-medium bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-300 border border-slate-300 dark:border-slate-700 hover:bg-slate-700'}`}>
                Tous ({total})
              </button>
              <button onClick={() => criticals > 0 && setFilter('critical')} className={`px-4 py-2 text-sm rounded-full transition-colors whitespace-nowrap ${filter === 'critical' ? 'font-bold bg-red-500/20 text-red-400 border border-red-500/30' : criticals === 0 ? 'font-medium bg-white dark:bg-slate-900/50 text-slate-400 dark:text-slate-600 border border-slate-200 dark:border-slate-800 cursor-not-allowed' : 'font-medium bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-300 border border-slate-300 dark:border-slate-700 hover:bg-slate-700'}`}>
                🔴 Critiques ({criticals})
              </button>
              <button onClick={() => majors > 0 && setFilter('major')} className={`px-4 py-2 text-sm rounded-full transition-colors whitespace-nowrap ${filter === 'major' ? 'font-bold bg-orange-500/20 text-orange-400 border border-orange-500/30' : majors === 0 ? 'font-medium bg-white dark:bg-slate-900/50 text-slate-400 dark:text-slate-600 border border-slate-200 dark:border-slate-800 cursor-not-allowed' : 'font-medium bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-300 border border-slate-300 dark:border-slate-700 hover:bg-slate-700'}`}>
                🟠 Majeurs ({majors})
              </button>
              <button onClick={() => minors > 0 && setFilter('minor')} className={`px-4 py-2 text-sm rounded-full transition-colors whitespace-nowrap ${filter === 'minor' ? 'font-bold bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' : minors === 0 ? 'font-medium bg-white dark:bg-slate-900/50 text-slate-400 dark:text-slate-600 border border-slate-200 dark:border-slate-800 cursor-not-allowed' : 'font-medium bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-300 border border-slate-300 dark:border-slate-700 hover:bg-slate-700'}`}>
                🟡 Mineurs ({minors})
              </button>
            </div>

            {filteredGroups.length === 0 && (
              <p className="text-slate-400 dark:text-slate-500 text-center py-10">Aucune vulnérabilité trouvée pour ce filtre.</p>
            )}

            <div className="space-y-3">
              {filteredGroups.map((g) => (
                <div key={g.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden hover:border-slate-300 dark:border-slate-700 transition-colors">
                  <div 
                    className="flex items-center justify-between p-4 cursor-pointer select-none"
                    onClick={() => setExpanded(expanded === g.id ? null : g.id)}
                  >
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <span className={`px-2.5 py-1 text-[10px] font-black tracking-wider rounded uppercase flex-shrink-0 ${g.bg} ${g.color} border ${g.border}`}>
                        {g.severity}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{g.title}</p>
                        <p className="text-xs font-mono text-slate-400 dark:text-slate-500 mt-1 truncate">{g.rule}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4 ml-4">
                      <span className={`px-3 py-1 text-xs font-bold rounded-full ${g.bg} ${g.color}`}>
                        {g.count} occurrence{g.count > 1 ? 's' : ''}
                      </span>
                      {expanded === g.id ? (
                        <ChevronUp className="w-5 h-5 text-slate-400 dark:text-slate-500" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-slate-400 dark:text-slate-500" />
                      )}
                    </div>
                  </div>
                  
                  {expanded === g.id && (
                    <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 space-y-4">
                      {g.occurrences.map((occ, idx) => (
                        <div key={idx} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3">
                          <p className="text-sm text-slate-400 dark:text-slate-300 mb-2">{occ.description}</p>
                          <div className="text-xs font-mono bg-slate-50 dark:bg-slate-950 p-2 rounded text-slate-400 dark:text-slate-400 overflow-x-auto border border-slate-200 dark:border-slate-800/50">
                            {occ.file_path}{occ.line_number ? `:${occ.line_number}` : ''}
                          </div>
                          {occ.evidence && (
                            <div className="mt-2 text-xs font-mono bg-slate-50 dark:bg-slate-950 p-2 rounded text-blue-400/80 overflow-x-auto border border-slate-200 dark:border-slate-800/50">
                              {occ.evidence}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
