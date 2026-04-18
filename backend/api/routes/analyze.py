from fastapi import APIRouter, BackgroundTasks, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from backend.core.database import get_db, AnalysisJob
from backend.analyzers.runner import run_full_analysis

router = APIRouter()


class AnalysisRequest(BaseModel):
    file_id: str
    apk_hash: str
    filename: str


@router.post("/start")
async def start_analysis(
    request: AnalysisRequest,
    bg_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """Lance le processus complet d'analyse SAST/DAST en arrière-plan."""

    # Vérifier si un job existe déjà pour ce file_id (évite les doublons)
    existing = db.query(AnalysisJob).filter(AnalysisJob.id == request.file_id).first()
    if existing:
        return {
            "message": "Un job existe déjà pour ce fichier",
            "job_id": request.file_id,
            "status": existing.status,
        }

    # Créer le job en base AVANT de passer au background
    job = AnalysisJob(
        id=request.file_id,
        filename=request.filename,
        status="pending",
        progress="En attente de démarrage...",
    )
    db.add(job)
    db.commit()
    # Fermeture explicite de la session AVANT le background task
    # Le runner crée sa propre session via SessionLocal()
    db.close()

    # NE PAS passer `db` au background task — il utilisera SessionLocal() lui-même
    bg_tasks.add_task(
        run_full_analysis,
        request.file_id,
        request.apk_hash,
        request.filename,
    )

    return {
        "message": "L'analyse a commencé en arrière-plan",
        "job_id": request.file_id,
    }
