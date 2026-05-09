from backend.core.database import ReportDBModel, AnalysisJob, SessionLocal
from backend.core.models import AuditReport, Finding
from backend.parsers.apk_parser import ApkParser
from backend.parsers.traffic_parser import TrafficParser
from backend.parsers.jwt_parser import JWTParser
from backend.parsers.manifest_parser import ManifestParser
from backend.analyzers.semgrep_runner import SemgrepRunner
from backend.analyzers.flow_analyzer import FlowAnalyzer
from backend.analyzers.compliance_mapper import map_to_masvs
from backend.ai.llm_client import LLMClient
from backend.ai.rag_engine import RAGEngine
from backend.core.config import settings
import os


def _update_job(job_id: str, status: str, progress: str, report_id: str = None, error: str = None):
    """Met à jour l'état d'un job d'analyse dans une session DB indépendante."""
    db = SessionLocal()
    try:
        job = db.query(AnalysisJob).filter(AnalysisJob.id == job_id).first()
        if job:
            job.status = status
            job.progress = progress
            if report_id:
                job.report_id = report_id
            if error:
                job.error_message = error
            db.commit()
    finally:
        db.close()


async def run_full_analysis(file_id: str, apk_hash: str, filename: str):
    print(f"[*] Démarrage de l'analyse pour {filename} (ID: {file_id})")

    _update_job(file_id, "PENDING", "Démarrage de l'analyse...")

    # Determine file type from extension
    is_log_file = filename.endswith(".txt") or filename.endswith(".xml") or filename.endswith(".har")
    file_path = os.path.join(settings.UPLOAD_DIR, f"{file_id}_{filename}" if is_log_file else f"{file_id}.apk")

    findings = []

    try:
        if not os.path.exists(file_path):
            print(f"Fichier inexistant : {file_path}. Mode simulation.")
            _update_job(file_id, "PENDING", "Fichier non trouvé — mode simulation.")

        elif is_log_file:
            # ─── Analyse de trafic HTTP ───────────────────────────────────────────
            print("[*] Analyse de trafic dynamique identifiée.")
            _update_job(file_id, "SCANNING_SAST", "Analyse du trafic HTTP (DAST)...")

            parser = TrafficParser(file_path)
            analyzer = FlowAnalyzer(parser)
            traffic_findings = analyzer.analyze()
            findings.extend(traffic_findings)

            # Détection de tokens JWT dans le trafic
            _update_job(file_id, "SCANNING_SAST", "Analyse des tokens JWT dans le trafic...")
            bearer_tokens = parser.find_bearer_tokens()
            for token in bearer_tokens:
                if token.count(".") == 2:  # Format JWT basique
                    jwt_info = JWTParser.decode_token(token)
                    if jwt_info.get("valid_format"):
                        issues = JWTParser.analyze_claims(jwt_info.get("payload", {}))
                        if "Missing expiration 'exp' claim" in issues:
                            findings.append(Finding(
                                title="JWT sans claim d'expiration (exp)",
                                description="Un token JWT intercepté dans le trafic ne contient pas de claim 'exp'."
                                            " Il est donc valide indéfiniment, ce qui est une faille critique.",
                                file_path=filename,
                                evidence=f"JWT Header: {jwt_info.get('headers')} | Issues: {', '.join(issues)}",
                                masvs_id="MASVS-AUTH-5",
                                mastg_test="MASTG-TEST-0024",
                                impact=3, exploitability=2, exposure=3,
                                remediation="Ajouter un claim 'exp' avec une durée de vie courte (< 15 minutes pour les access tokens)."
                            ))
                        alg = jwt_info.get("algorithm", "")
                        if alg and alg.lower() in ("none", ""):
                            findings.append(Finding(
                                title="JWT avec algorithme 'none' (signature désactivée)",
                                description="Un token JWT utilise l'algorithme 'none', ce qui signifie que la signature"
                                            " n'est pas vérifiée. N'importe qui peut forger un token.",
                                file_path=filename,
                                evidence=f"alg=none détecté dans le header JWT",
                                masvs_id="MASVS-AUTH-2",
                                mastg_test="MASTG-TEST-0020",
                                impact=3, exploitability=3, exposure=3,
                                remediation="Forcer l'algorithme HS256 ou RS256 côté serveur. Rejeter tout token avec alg='none'."
                            ))

        else:
            # ─── Analyse SAST d'un APK ────────────────────────────────────────────
            print("[*] Analyse SAST d'un APK identifiée.")
            _update_job(file_id, "DECOMPILING", "Décompilation APK avec Apktool...")

            apk_parser = ApkParser(file_path, apk_hash)
            apk_parser.run_apktool()

            # Analyse du Manifest Android
            _update_job(file_id, "SCANNING_SAST", "Analyse du AndroidManifest.xml...")
            manifest_path = apk_parser.get_manifest_path()
            if manifest_path:
                try:
                    manifest = ManifestParser(manifest_path)
                    exported = manifest.get_exported_activities()
                    if exported:
                        findings.append(Finding(
                            title=f"Activités Android exportées sans protection ({len(exported)} trouvées)",
                            description=f"Le Manifest expose {len(exported)} activité(s) avec `android:exported=true`"
                                        f" sans permission requise. Cela peut permettre un démarrage non autorisé.",
                            file_path="AndroidManifest.xml",
                            evidence=f"Activités: {', '.join([a['name'] for a in exported[:3]])}",
                            masvs_id="MASVS-AUTH-2",
                            mastg_test="MASTG-TEST-0020",
                            impact=2, exploitability=2, exposure=2,
                            remediation="Ajouter `android:permission` sur les activités exportées ou passer `exported=false`."
                        ))
                    permissions = manifest.get_permissions()
                    dangerous_perms = [p for p in permissions if "READ_CONTACTS" in p or "CAMERA" in p or "RECORD_AUDIO" in p]
                    if dangerous_perms:
                        findings.append(Finding(
                            title=f"Permissions Android dangereuses déclarées ({len(dangerous_perms)})",
                            description="L'APK déclare des permissions dangereuses (CAMERA, READ_CONTACTS, RECORD_AUDIO)."
                                        " Valider que ces permissions sont strictement nécessaires.",
                            file_path="AndroidManifest.xml",
                            evidence=f"Permissions: {', '.join(dangerous_perms[:5])}",
                            masvs_id="MASVS-AUTH-1",
                            mastg_test="MASTG-TEST-0019",
                            impact=1, exploitability=1, exposure=2,
                            remediation="Appliquer le principe de moindre privilège. Supprimer les permissions non utilisées."
                        ))
                except Exception as e:
                    print(f"[Manifest] Erreur d'analyse : {e}")

            # Décompilation Java via JADX + Semgrep
            _update_job(file_id, "DECOMPILING", "Décompilation Java avec JADX...")
            apk_parser.run_jadx()

            _update_job(file_id, "SCANNING_SAST", "Analyse statique Semgrep (SAST)...")
            try:
                semgrep = SemgrepRunner(apk_parser.jadx_dir)
                sast_findings = semgrep.run()
                findings.extend(sast_findings)
            except Exception as e:
                print(f"[Semgrep] Erreur lors de l'exécution: {e}")
                # Ne bloque pas le pipeline


        # ─── RAG + LLM Report Generation ─────────────────────────────────────────
        _update_job(file_id, "AI_ANALYSIS", "Génération du résumé exécutif par IA (Gemini)...")
        llm = LLMClient()
        try:
            rag = RAGEngine()
            rag_context = rag.retrieve_context(
                "Quelles sont les obligations de sécurité autour de l'authentification et des tokens (MASVS-AUTH) ?"
            )
        except Exception as e:
            print(f"[RAG] Echec initialisation: {e}")
            rag_context = ""

        findings_str = "\n".join([f"- {f.title}: {f.description} ({f.file_path})" for f in findings])
        if not findings:
            findings_str = "Aucune vulnérabilité trouvée lors de l'analyse (SAST/DAST)."

        summary = llm.generate_executive_summary(findings_str, rag_context)

        _update_job(file_id, "AI_ANALYSIS", "Mapping MASVS par IA...")
        import json
        llm_mapping_json = []
        try:
            raw_llm_mapping = llm.generate_masvs_mapping(findings_str, rag_context)
            if raw_llm_mapping:
                llm_mapping_json = json.loads(raw_llm_mapping)
        except Exception as e:
            print(f"[LLM Mapping] Erreur: {e}")

        masvs_mapping_result = map_to_masvs(findings, llm_mapping_json)

        # ─── Sauvegarde du rapport ────────────────────────────────────────────────
        _update_job(file_id, "AI_ANALYSIS", "Sauvegarde du rapport en base de données...")
        report = AuditReport(
            apk_hash=apk_hash,
            apk_name=filename,
            findings=findings,
            executive_summary=summary,
            masvs_mapping=masvs_mapping_result
        )

        db_report = ReportDBModel(
            id=report.id,
            apk_name=filename,
            apk_hash=apk_hash,
            report_json=report.model_dump_json()
        )

        # Session propre pour la sauvegarde du rapport final
        save_db = SessionLocal()
        try:
            save_db.add(db_report)
            save_db.commit()
        finally:
            save_db.close()

        _update_job(file_id, "COMPLETED", f"Analyse terminée — {len(findings)} finding(s) détecté(s).", report_id=report.id)
        print(f"[*] Analyse terminée (Rapport ID: {report.id})")

    except Exception as exc:
        import traceback
        tb = traceback.format_exc()
        print(f"[RUNNER ERROR] {exc}\n{tb}")
        _update_job(file_id, "failed", "L'analyse a échoué.", error=str(exc))
