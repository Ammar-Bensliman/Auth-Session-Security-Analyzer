import os
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.core.config import settings
from backend.core.database import Base, engine

# ── Filtre le warning bruit uvicorn "Invalid HTTP request received" ────────────
# Ce warning est généré par des connexions keep-alive du navigateur ou sondes Docker
# Ce n'est pas un vrai problème — juste du bruit dans les logs
logging.getLogger("uvicorn.error").addFilter(
    type("_InvalidHTTPFilter", (logging.Filter,), {
        "filter": lambda self, r: "Invalid HTTP request received" not in r.getMessage()
    })()
)

# ── Création automatique des tables DB ────────────────────────────────────────
Base.metadata.create_all(bind=engine)

# ── Application FastAPI ───────────────────────────────────────────────────────
app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Automated Auth & Session Security Audit Tool for Android — OWASP MASVS v2",
    version="2.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)

# ── CORS — autoriser le frontend Vite (dev) et localhost ──────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "*",  # Garder * pour les déploiements Docker différents
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routes de santé ───────────────────────────────────────────────────────────
@app.get("/health", tags=["Health"])
async def health_check():
    """Vérification de santé du service backend."""
    return {
        "status": "ok",
        "project": settings.PROJECT_NAME,
        "version": "2.0.0",
        "environment": settings.ENV,
    }

# ── Inclusion des routes API ──────────────────────────────────────────────────
from backend.api.routes import upload, analyze, report, auth_audit, jobs, export

app.include_router(upload.router,     prefix="/api/upload",     tags=["Upload"])
app.include_router(analyze.router,    prefix="/api/analyze",    tags=["Analyze"])
app.include_router(report.router,     prefix="/api/report",     tags=["Report"])
app.include_router(jobs.router,       prefix="/api/jobs",       tags=["Jobs"])
app.include_router(export.router,     prefix="/api/export",     tags=["Export"])
app.include_router(auth_audit.router, prefix="/api",            tags=["Auth & Session Audit"])

# ── Point d'entrée direct ─────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "backend.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info",
    )
