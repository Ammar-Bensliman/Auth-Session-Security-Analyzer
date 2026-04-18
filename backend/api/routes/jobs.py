from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from backend.core.database import get_db, AnalysisJob

router = APIRouter()


@router.get("/")
async def list_jobs(db: Session = Depends(get_db)):
    """Liste les 20 derniers jobs triés par date de création (plus récent d'abord)."""
    jobs = db.query(AnalysisJob).order_by(AnalysisJob.created_at.desc()).limit(20).all()
    return [
        {
            "job_id": j.id,
            "filename": j.filename,
            "status": j.status,
            "progress": j.progress,
            "report_id": j.report_id,
            "created_at": j.created_at,
        }
        for j in jobs
    ]


@router.get("/{job_id}")
async def get_job_status(job_id: str, db: Session = Depends(get_db)):
    """Retourne l'état actuel d'un job d'analyse (pending/running/done/failed)."""
    job = db.query(AnalysisJob).filter(AnalysisJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job non trouvé")

    return {
        "job_id": job.id,
        "filename": job.filename,
        "status": job.status,
        "progress": job.progress,
        "error_message": job.error_message,
        "report_id": job.report_id,
        "created_at": job.created_at,
        "updated_at": job.updated_at,
    }
