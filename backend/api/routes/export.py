from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import PlainTextResponse, JSONResponse
from sqlalchemy.orm import Session
from backend.core.database import get_db, ReportDBModel
from backend.core.models import AuditReport
import json
from datetime import datetime

router = APIRouter()


def _load_report(report_id: str, db: Session) -> AuditReport:
    """Charge et valide un rapport depuis la base de données."""
    db_report = db.query(ReportDBModel).filter(ReportDBModel.id == report_id).first()
    if not db_report:
        raise HTTPException(status_code=404, detail="Rapport non trouvé")
    try:
        return AuditReport(**json.loads(db_report.report_json))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur lors de la lecture du rapport: {str(e)}")


def _severity_badge(severity: str) -> str:
    mapping = {"critical": "🔴 CRITIQUE", "major": "🟠 MAJEUR", "minor": "🟡 MINEUR"}
    return mapping.get(severity, severity.upper())


@router.get("/{report_id}/markdown", response_class=PlainTextResponse)
async def export_report_markdown(report_id: str, db: Session = Depends(get_db)):
    """Exporte un rapport d'analyse complet au format Markdown."""
    report = _load_report(report_id, db)
    ts = report.timestamp.strftime("%d/%m/%Y à %H:%M") if report.timestamp else "N/A"

    lines = [
        f"# 🔐 Rapport de Sécurité — {report.apk_name}",
        f"",
        f"> **Généré le :** {ts}  ",
        f"> **Score Global :** `{report.overall_score:.1f} / 100`  ",
        f"> **Hash APK :** `{report.apk_hash}`  ",
        f"> **ID Rapport :** `{report.id}`",
        f"",
        f"---",
        f"",
        f"## 📋 Résumé Exécutif",
        f"",
        report.executive_summary or "_Aucun résumé disponible._",
        f"",
        f"---",
        f"",
        f"## 🐛 Vulnérabilités Détectées ({len(report.findings)})",
        f"",
    ]

    if not report.findings:
        lines.append("_Aucune vulnérabilité détectée lors de cette analyse._")
    else:
        for i, f in enumerate(report.findings, 1):
            lines += [
                f"### {i}. {f.title}",
                f"",
                f"| Champ | Valeur |",
                f"|---|---|",
                f"| **Sévérité** | {_severity_badge(f.severity)} |",
                f"| **Score** | {f.score} / 27 |",
                f"| **MASVS** | `{f.masvs_id}` |",
                f"| **MASTG Test** | `{f.mastg_test}` |",
                f"| **Fichier** | `{f.file_path}` |",
                f"| **Ligne** | {f.line_number or 'N/A'} |",
                f"",
                f"**Description :** {f.description}",
                f"",
                f"**Evidence :**",
                f"```",
                f.evidence,
                f"```",
                f"",
                f"**Remédiation :** {f.remediation}",
                f"",
                f"---",
                f"",
            ]

    # Critères MASVS coverage
    if report.masvs_coverage:
        lines += [
            f"## 📊 Couverture MASVS",
            f"",
        ]
        for cat, pct in report.masvs_coverage.items():
            bar = "█" * int(pct * 10) + "░" * (10 - int(pct * 10))
            lines.append(f"- **{cat}** : `{bar}` {pct*100:.0f}%")
        lines.append("")

    lines += [
        f"---",
        f"",
        f"_Rapport généré automatiquement par **Auth & Session Security Analyzer** — MASVS v2_",
    ]

    content = "\n".join(lines)
    filename = f"rapport_{report.apk_name.replace('.', '_')}_{report_id[:8]}.md"
    return PlainTextResponse(
        content=content,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


@router.get("/{report_id}/json")
async def export_report_json(report_id: str, db: Session = Depends(get_db)):
    """Exporte un rapport d'analyse complet au format JSON brut."""
    report = _load_report(report_id, db)
    filename = f"rapport_{report.apk_name.replace('.', '_')}_{report_id[:8]}.json"
    return JSONResponse(
        content=report.model_dump(mode="json"),
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


@router.get("/{report_id}/checklist-markdown", response_class=PlainTextResponse)
async def export_checklist_markdown(report_id: str, db: Session = Depends(get_db)):
    """Exporte la checklist de sécurité d'un rapport au format Markdown."""
    report = _load_report(report_id, db)

    lines = [
        f"# ✅ Checklist de Sécurité — {report.apk_name}",
        f"",
        f"> Générée le {report.timestamp.strftime('%d/%m/%Y') if report.timestamp else 'N/A'}",
        f"",
        f"## Éléments de Checklist",
        f"",
    ]

    if not report.checklist:
        lines.append("_Aucun élément de checklist disponible dans ce rapport._")
    else:
        for item in report.checklist:
            icon = "✅" if item.status == "PASS" else ("❌" if item.status == "FAIL" else "➖")
            lines.append(f"- {icon} `{item.id}` — {item.description}")
            if item.evidence:
                lines.append(f"  > Evidence: {item.evidence}")

    lines += [
        f"",
        f"## Critères d'Acceptation (SAC)",
        f"",
    ]

    if not report.sac_items:
        lines.append("_Aucun critère d'acceptation disponible._")
    else:
        for sac in report.sac_items:
            icon = "✅" if sac.status == "MET" else "❌"
            lines.append(f"- {icon} `{sac.id}` — {sac.description}")

    content = "\n".join(lines)
    return PlainTextResponse(
        content=content,
        headers={"Content-Disposition": f'attachment; filename="checklist_{report_id[:8]}.md"'}
    )
