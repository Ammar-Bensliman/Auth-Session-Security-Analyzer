from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field
import os
import tempfile

# Répertoire de base du projet (2 niveaux au-dessus de ce fichier : backend/core/ → racine)
_BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
_DEFAULT_DATA_DIR = os.path.join(_BASE_DIR, "data")


class Settings(BaseSettings):
    PROJECT_NAME: str = "Auth & Session Security Analyzer"
    API_V1_STR: str = "/api/v1"

    # Environment
    ENV: str = "development"

    # Database — chemin absolu relatif à la racine du projet
    DATABASE_URL: str = Field(default=f"sqlite:///{os.path.join(_BASE_DIR, 'analyzer.db')}")

    # Security / Secrets
    SECRET_KEY: str = Field(default="default_insecure_key_for_dev_change_in_prod")

    # IA — Google Gemini (RAG + Checklists)
    GEMINI_API_KEY: str | None = None
    # Modèle Gemini à utiliser (gemini-2.0-flash = 1 500 req/jour free tier)
    # gemini-2.5-flash = seulement 20 req/jour sur le free tier !
    GEMINI_MODEL: str = "gemini-2.0-flash"

    # Paths — compatibles Windows & Linux
    UPLOAD_DIR: str = Field(default=os.path.join(_DEFAULT_DATA_DIR, "uploads"))
    EXTRACT_DIR: str = Field(default=os.path.join(_DEFAULT_DATA_DIR, "extracts"))
    CHROMA_DIR: str = Field(default=os.path.join(_DEFAULT_DATA_DIR, "chroma_db"))

    # MobSF Configuration (Optionnel — MUST use port différent de FastAPI)
    # MobSF tourne sur 8008 par convention, FastAPI sur 8000
    MOBSF_URL: str | None = None           # ex: http://localhost:8008
    MOBSF_API_KEY: str | None = None       # clé générée par MobSF à la 1ère connexion

    model_config = SettingsConfigDict(
        env_file=".env",
        case_sensitive=True,
        extra="ignore"
    )


settings = Settings()

# Création automatique des répertoires nécessaires
for _dir in [settings.UPLOAD_DIR, settings.EXTRACT_DIR, settings.CHROMA_DIR]:
    os.makedirs(_dir, exist_ok=True)
