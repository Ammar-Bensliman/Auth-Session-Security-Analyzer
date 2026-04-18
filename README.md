# Auth & Session Security Analyzer

Outil d'audit automatisé de la sécurité d'authentification pour applications Android. Couvre les standards OWASP MASVS (MASVS-AUTH), MASTG et MASWE.

## Architecture
- **Backend:** Python 3.11, FastAPI, Pydantic, SQLite, Celery
- **Analyse Stratifiée:** Apktool, JADX, Androguard, PyJWT, Semgrep
- **Intelligence Artificielle:** Claude API, LangChain, ChromaDB
- **Frontend:** React, TypeScript, Tailwind, Recharts

## Démarrage Rapide (Docker)
1. Copiez `.env.example` vers `.env` (configurez `ANTHROPIC_API_KEY`)
2. `docker-compose up --build`
3. Ouvrez http://localhost:5173 (Frontend)
4. L'API backend est disponible sur http://localhost:8000
