from sqlalchemy import create_engine, Column, String, Text, DateTime
from sqlalchemy.orm import sessionmaker, declarative_base
from backend.core.config import settings
from datetime import datetime

# Convert sqlite:/// uri to compatible one if needed
connect_args = {"check_same_thread": False} if settings.DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(
    settings.DATABASE_URL, connect_args=connect_args
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


class ReportDBModel(Base):
    __tablename__ = "reports"

    id = Column(String, primary_key=True, index=True)
    apk_name = Column(String, index=True)
    apk_hash = Column(String, index=True)
    timestamp = Column(DateTime, default=datetime.utcnow)
    report_json = Column(Text)  # Stockera le JSON complet (Pydantic model dumped)


class AnalysisJob(Base):
    """Suit l'état d'un job d'analyse en arrière-plan."""
    __tablename__ = "analysis_jobs"

    id = Column(String, primary_key=True, index=True)          # = file_id
    filename = Column(String, default="")
    status = Column(String, default="pending")                  # pending | running | done | failed
    progress = Column(String, default="En attente...")          # Message lisible
    error_message = Column(Text, default=None)                  # Détail si failed
    report_id = Column(String, default=None)                    # ID du rapport généré
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
