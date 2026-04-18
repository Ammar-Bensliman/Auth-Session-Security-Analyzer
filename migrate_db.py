"""Script de migration DB — crée toutes les tables (y compris AnalysisJob)."""
from backend.core.database import Base, engine

Base.metadata.create_all(bind=engine)
print("DB tables créées avec succès (reports + analysis_jobs)")
