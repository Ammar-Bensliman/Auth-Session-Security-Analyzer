from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from backend.core.database import get_db, ReportDBModel
from backend.core.models import AuditReport
import json

router = APIRouter()


@router.get("/")
async def list_reports(db: Session = Depends(get_db)):
    """Liste les 20 derniers rapports triés par date (plus récent en premier)."""
    reports = db.query(ReportDBModel).order_by(ReportDBModel.timestamp.desc()).limit(20).all()
    return [
        {
            "id": r.id,
            "apk_name": r.apk_name,
            "apk_hash": r.apk_hash,
            "timestamp": r.timestamp,
        }
        for r in reports
    ]


@router.get("/{report_id}", response_model=AuditReport)
async def get_report_json(report_id: str, db: Session = Depends(get_db)):
    """Retourne le rapport complet par ID."""
    db_report = db.query(ReportDBModel).filter(ReportDBModel.id == report_id).first()
    if not db_report:
        raise HTTPException(status_code=404, detail="Rapport non trouvé")

    try:
        report_data = json.loads(db_report.report_json)
        return AuditReport(**report_data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur lors de la lecture du rapport: {str(e)}")
