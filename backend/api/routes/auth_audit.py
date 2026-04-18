from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from backend.ai.llm_client import LLMClient
from backend.ai.rag_engine import RAGEngine
import json

router = APIRouter(prefix="/auth-audit", tags=["Auth & Session Audit"])


class AuthAuditRequest(BaseModel):
    """Paramètres d'architecture pour un audit contextuel (Shift-Left)."""
    auth_type: str                          # JWT | OAuth2 | Sessions
    token_storage: Optional[str] = None     # EncryptedSharedPrefs | Keystore | Cookie | Memory
    has_refresh_token: Optional[bool] = None
    logout_endpoint: Optional[str] = None   # ex: /api/auth/logout
    session_timeout_minutes: Optional[int] = None
    use_certificate_pinning: Optional[bool] = None
    use_mfa: Optional[bool] = None
    platforms: Optional[str] = "Android"   # Android | iOS | Both


def get_llm_client():
    return LLMClient()


def get_rag_engine():
    return RAGEngine()


@router.post("/generate-checklist")
def generate_checklist(
    request: AuthAuditRequest,
    client: LLMClient = Depends(get_llm_client),
    rag: RAGEngine = Depends(get_rag_engine)
):
    """Gènère une checklist de sécurité MASVS contextuelle + des SAC Agile (Gherkin)."""
    if request.auth_type not in ["JWT", "OAuth2", "Sessions"]:
        raise HTTPException(
            status_code=400,
            detail="Type d'authentification invalide. Choisissez JWT, OAuth2, ou Sessions."
        )

    # Construire le contexte d'architecture pour un audit ciblé
    arch_context = f"""
- Type d'authentification : {request.auth_type}
- Stockage des tokens : {request.token_storage or 'Non spécifié (considérer toutes les options)'}
- Refresh Token : {'Oui' if request.has_refresh_token else 'Non' if request.has_refresh_token is False else 'Non spécifié'}
- Endpoint de logout : {request.logout_endpoint or 'Non spécifié'}
- Timeout de session (minutes) : {request.session_timeout_minutes or 'Non spécifié'}
- Certificate Pinning : {'Activé' if request.use_certificate_pinning else 'Désactivé' if request.use_certificate_pinning is False else 'Non spécifié'}
- Authentification multi-facteurs (MFA) : {'Activé' if request.use_mfa else 'Désactivé' if request.use_mfa is False else 'Non spécifié'}
- Plateforme cible : {request.platforms}
""".strip()

    rag_ctx = rag.retrieve_context(f"authentification session {request.auth_type} stockage tokens mobile")
    res_str = client.generate_auth_checklist(request.auth_type, rag_context=rag_ctx, arch_context=arch_context)

    try:
        data = json.loads(res_str)
        return data
    except json.JSONDecodeError:
        return {
            "error": "L'IA a généré une réponse mal formatée.",
            "raw_response": res_str,
            "checklist": [],
            "acceptance_criteria": [],
            "gherkin_scenarios": []
        }
