"""
LLM Client — Google Gemini avec fallback automatique et gestion des quotas.

Modèles disponibles (vérifiés via ListModels — Avril 2026) :
  1. gemini-2.0-flash        → 1 500 req/jour free tier (priorité)
  2. gemini-2.0-flash-lite   → 1 500 req/jour free tier (fallback léger)
  3. gemini-2.5-flash-lite   → quota réduit, mais disponible
  4. Mode simulation local   → sans aucun appel API (toujours disponible)

IMPORTANT : gemini-1.5-flash et gemini-1.5-flash-8b ne sont PLUS disponibles
via l'API v1beta. Utiliser uniquement les modèles de la série gemini-2.x.

Référence : https://ai.google.dev/gemini-api/docs/rate-limits
"""

import time
import json
import re
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import PromptTemplate
from backend.core.config import settings

# ──────────────────────────────────────────────────────────────────────────────
# Modèles ordonnés par préférence (vérifiés disponibles via ListModels)
# ──────────────────────────────────────────────────────────────────────────────
_MODEL_PRIORITY = [
    "gemini-2.0-flash",        # 1 500 req/jour — modèle principal
    "gemini-2.0-flash-lite",   # 1 500 req/jour — fallback léger
    "gemini-2.5-flash-lite",   # quota plus faible — dernier recours IA
]

# Cache in-process des modèles marqués comme épuisés (429) ou introuvables (404)
_EXHAUSTED: dict[str, bool] = {}


def _is_quota_error(exc: Exception) -> bool:
    """Détecte une erreur 429 RESOURCE_EXHAUSTED."""
    msg = str(exc)
    return "429" in msg or "RESOURCE_EXHAUSTED" in msg or "quota" in msg.lower()


def _is_not_found_error(exc: Exception) -> bool:
    """Détecte une erreur 404 NOT_FOUND (modèle inexistant ou déprécié)."""
    msg = str(exc)
    return "404" in msg or "NOT_FOUND" in msg or "not found" in msg.lower()


def _build_llm(model: str) -> ChatGoogleGenerativeAI:
    """Construit un client LangChain pour un modèle Gemini donné."""
    return ChatGoogleGenerativeAI(
        model=model,
        temperature=0.2,
        google_api_key=settings.GEMINI_API_KEY,
        request_timeout=90,
        max_retries=1,
    )


def _clean_json_response(raw: str) -> str:
    """Nettoie la réponse IA : supprime les balises markdown ```json ... ```."""
    content = raw.strip()
    # Supprimer ```json ... ``` ou ``` ... ```
    content = re.sub(r'^```(?:json)?\s*', '', content, flags=re.MULTILINE)
    content = re.sub(r'\s*```$', '', content, flags=re.MULTILINE)
    return content.strip()


class LLMClient:
    def __init__(self):
        self.api_key = settings.GEMINI_API_KEY

    def _invoke_with_fallback(self, prompt_template: PromptTemplate, variables: dict) -> str:
        """
        Tente d'appeler Gemini avec le modèle prioritaire.
        En cas d'erreur 429 (quota) ou 404 (modèle introuvable),
        passe automatiquement au modèle suivant.
        Lève RuntimeError si tous les modèles échouent.
        """
        if not self.api_key:
            raise EnvironmentError("GEMINI_API_KEY manquante dans .env")

        last_error = None
        for model in _MODEL_PRIORITY:
            if _EXHAUSTED.get(model):
                continue

            try:
                print(f"[LLM] Tentative avec : {model}")
                llm = _build_llm(model)
                chain = prompt_template | llm
                result = chain.invoke(variables)
                print(f"[LLM] Succès avec : {model}")
                return result.content

            except Exception as exc:
                last_error = exc
                if _is_quota_error(exc):
                    print(f"[LLM] Quota épuisé pour {model} (429) — passage au suivant.")
                    _EXHAUSTED[model] = True
                    time.sleep(0.5)
                elif _is_not_found_error(exc):
                    print(f"[LLM] Modèle introuvable : {model} (404) — passage au suivant.")
                    _EXHAUSTED[model] = True
                else:
                    # Autre erreur (réseau, auth, etc.) → on lève immédiatement
                    print(f"[LLM] Erreur inattendue avec {model} : {exc}")
                    raise

        raise RuntimeError(
            f"Tous les modèles Gemini sont indisponibles. "
            f"Dernière erreur : {last_error}. "
            "→ Le mode simulation local sera utilisé à la place."
        )

    # ──────────────────────────────────────────────────────────────────────────
    # Résumé exécutif
    # ──────────────────────────────────────────────────────────────────────────

    def generate_executive_summary(self, findings_text: str, rag_context: str = "") -> str:
        """Génère un résumé exécutif des vulnérabilités détectées, en français."""
        if not self.api_key:
            return _fallback_executive_summary(findings_text)

        prompt = PromptTemplate.from_template(
            "Tu es un expert en cybersécurité mobile Android.\n"
            "Contexte MASVS de référence :\n{rag_context}\n\n"
            "Vulnérabilités détectées :\n{findings}\n\n"
            "Rédige un résumé exécutif concis en Français (150-200 mots maximum). "
            "Parle des risques métier concrets et des priorités de remédiation."
        )

        try:
            return self._invoke_with_fallback(
                prompt, {"findings": findings_text, "rag_context": rag_context or "Non disponible."}
            )
        except RuntimeError:
            return _fallback_executive_summary(findings_text)
        except Exception as e:
            return f"Résumé non disponible (erreur IA : {type(e).__name__}). Consulter les findings ci-dessous."

    # ──────────────────────────────────────────────────────────────────────────
    # Checklist MASVS + SAC Agile + Gherkin
    # ──────────────────────────────────────────────────────────────────────────

    def generate_auth_checklist(
        self,
        auth_type: str,
        rag_context: str = "",
        arch_context: str = "",
    ) -> str:
        """
        Génère une checklist MASVS, SAC Agile et scénarios Gherkin via Gemini.
        Retourne toujours un JSON valide — utilise la simulation si l'IA échoue.
        """
        if not self.api_key:
            print("[LLM] Pas de clé API — mode simulation.")
            return json.dumps(_fallback_checklist(auth_type), ensure_ascii=False, indent=2)

        prompt = PromptTemplate.from_template(
            "Tu es un Lead Security Engineer expert OWASP MASVS v2 et MASTG.\n\n"
            "Type d'authentification : {auth_type}\n"
            "Architecture : {arch_context}\n"
            "Référence MASVS (RAG) : {rag_context}\n\n"
            "Retourne UNIQUEMENT un objet JSON valide (sans markdown, sans balises) "
            "avec cette structure exacte :\n"
            "{{\"checklist\":[{{\"id\":1,\"title\":\"...\",\"description\":\"...\","
            "\"test_type\":\"SAST|DAST|BOTH\",\"masvs_ref\":\"MASVS-AUTH-X\","
            "\"mastg_test\":\"MASTG-TEST-XXXX\",\"risk_level\":\"HIGH|MEDIUM|LOW\"}}],"
            "\"acceptance_criteria\":[\"Given...When...Then...\"],"
            "\"gherkin_scenarios\":[{{\"user_story\":\"US-SEC-01\","
            "\"scenario\":\"Given...\\n  When...\\n  Then...\","
            "\"masvs_ref\":\"MASVS-AUTH-X\"}}],"
            "\"design_risks\":[{{\"risk\":\"...\","
            "\"description\":\"...\",\"mitigation\":\"...\"}}]}}\n"
            "Génère au minimum 8 éléments dans checklist et 4 critères d'acceptation."
        )

        try:
            raw = self._invoke_with_fallback(
                prompt,
                {
                    "auth_type": auth_type,
                    "rag_context": rag_context or "Utiliser les best practices MASVS v2.",
                    "arch_context": arch_context or "Architecture non spécifiée.",
                },
            )
            cleaned = _clean_json_response(raw)
            # Valider que c'est du JSON valide
            json.loads(cleaned)
            return cleaned

        except RuntimeError:
            print("[LLM] Tous les modèles épuisés — mode simulation.")
            return json.dumps(_fallback_checklist(auth_type), ensure_ascii=False, indent=2)
        except json.JSONDecodeError as e:
            print(f"[LLM] JSON invalide reçu : {e} — mode simulation.")
            return json.dumps(_fallback_checklist(auth_type), ensure_ascii=False, indent=2)
        except Exception as e:
            print(f"[LLM] Erreur inattendue : {e} — mode simulation.")
            return json.dumps(_fallback_checklist(auth_type), ensure_ascii=False, indent=2)


# ══════════════════════════════════════════════════════════════════════════════
#  SIMULATION LOCALE — Fonctionne SANS aucun appel API
# ══════════════════════════════════════════════════════════════════════════════

def _fallback_executive_summary(findings_text: str) -> str:
    n = max(1, findings_text.count("- "))
    return (
        f"[Résumé local — IA indisponible]\n\n"
        f"L'analyse a identifié {n} problème(s) de sécurité lié(s) à l'authentification "
        "et à la gestion des sessions mobiles. Les findings couvrent les contrôles "
        "OWASP MASVS-AUTH, MASVS-STORAGE et MASVS-NETWORK.\n\n"
        "Priorités recommandées :\n"
        "1. Corriger immédiatement tous les findings CRITIQUES (score ≥ 18)\n"
        "2. Planifier la remédiation des findings MAJEURS dans le prochain sprint\n"
        "3. Documenter les findings MINEURS pour suivi\n\n"
        "ℹ️  Pour un résumé IA complet, configurez GEMINI_API_KEY dans .env "
        "et assurez-vous d'utiliser GEMINI_MODEL=gemini-2.0-flash (1 500 req/jour gratuit)."
    )


def _fallback_checklist(auth_type: str) -> dict:
    """Checklist de sécurité complète générée localement — 0 appel API requis."""
    checklist = [
        {
            "id": 1,
            "title": "Vérifier la durée de vie du token d'accès (exp claim)",
            "description": (
                "Le token d'accès doit avoir un claim 'exp' avec une durée maximale "
                "de 15 minutes. Vérifier côté SAST le claim exp dans le JWT, "
                "et côté DAST que l'API rejette un token expiré avec HTTP 401."
            ),
            "test_type": "BOTH",
            "masvs_ref": "MASVS-AUTH-5",
            "mastg_test": "MASTG-TEST-0024",
            "risk_level": "HIGH",
        },
        {
            "id": 2,
            "title": "Vérifier l'invalidation de session côté serveur au logout",
            "description": (
                "Après appel à POST /logout, le token doit être révoqué "
                "dans une deny list côté serveur. Tester qu'une requête avec "
                "le même token retourne HTTP 401 après déconnexion."
            ),
            "test_type": "DAST",
            "masvs_ref": "MASVS-AUTH-6",
            "mastg_test": "MASTG-TEST-0025",
            "risk_level": "HIGH",
        },
        {
            "id": 3,
            "title": "Vérifier l'absence de secrets hardcodés dans le code source",
            "description": (
                "Analyser le code décompilé (JADX) pour détecter des tokens, "
                "clés API, JWT ou passwords directement dans les strings Java/Kotlin. "
                "Utiliser Semgrep avec la règle hardcoded-api-key."
            ),
            "test_type": "SAST",
            "masvs_ref": "MASVS-AUTH-7",
            "mastg_test": "MASTG-TEST-0023",
            "risk_level": "HIGH",
        },
        {
            "id": 4,
            "title": "Vérifier le stockage chiffré des tokens locaux",
            "description": (
                "Les tokens ne doivent pas être stockés en SharedPreferences "
                "non chiffrées. Vérifier l'utilisation d'EncryptedSharedPreferences "
                "ou de l'Android Keystore."
            ),
            "test_type": "SAST",
            "masvs_ref": "MASVS-AUTH-7",
            "mastg_test": "MASTG-TEST-0001",
            "risk_level": "HIGH",
        },
        {
            "id": 5,
            "title": "Vérifier l'algorithme de signature JWT (interdire 'none')",
            "description": (
                "L'algorithme JWT ne doit pas être 'none'. Côté DAST : "
                "forger un JWT avec alg=none et vérifier que l'API retourne 401. "
                "Côté SAST : vérifier la configuration du serveur JWT."
            ),
            "test_type": "DAST",
            "masvs_ref": "MASVS-AUTH-2",
            "mastg_test": "MASTG-TEST-0020",
            "risk_level": "HIGH",
        },
        {
            "id": 6,
            "title": "Vérifier la rotation des refresh tokens",
            "description": (
                "À chaque utilisation d'un refresh token, l'ancien doit être "
                "invalidé et un nouveau émis. Tester la réutilisation d'un "
                "ancien refresh token après rotation — doit retourner 401."
            ),
            "test_type": "DAST",
            "masvs_ref": "MASVS-AUTH-10",
            "mastg_test": "MASTG-TEST-0026",
            "risk_level": "MEDIUM",
        },
        {
            "id": 7,
            "title": "Vérifier Certificate Pinning (protection MITM)",
            "description": (
                "L'application doit implémenter le certificate pinning via "
                "OkHttp CertificatePinner (Android) ou NSURLSession avec pinning "
                "(iOS). Tester avec Burp Suite — la connexion doit être refusée."
            ),
            "test_type": "DAST",
            "masvs_ref": "MASVS-NETWORK-2",
            "mastg_test": "MASTG-TEST-0019",
            "risk_level": "HIGH",
        },
        {
            "id": 8,
            "title": "Vérifier l'absence de données sensibles dans les logs",
            "description": (
                "Exécuter 'adb logcat' pendant une session authentifiée. "
                "Aucun token, password, ou clé API ne doit apparaître. "
                "Vérifier aussi avec Semgrep la règle sensitive-data-in-logs."
            ),
            "test_type": "BOTH",
            "masvs_ref": "MASVS-STORAGE-2",
            "mastg_test": "MASTG-TEST-0023",
            "risk_level": "MEDIUM",
        },
        {
            "id": 9,
            "title": "Vérifier le timeout d'inactivité de session",
            "description": (
                "La session doit expirer après la période d'inactivité configurée. "
                "Tester en laissant l'app inactive 15+ min et en tentant une "
                "requête authentifiée — doit retourner 401."
            ),
            "test_type": "DAST",
            "masvs_ref": "MASVS-AUTH-5",
            "mastg_test": "MASTG-TEST-0024",
            "risk_level": "MEDIUM",
        },
        {
            "id": 10,
            "title": "Vérifier la protection contre la fixation de session",
            "description": (
                "Après une élévation de privilège (ex: ajout MFA, changement rôle), "
                "un nouvel ID de session doit être généré. L'ancien ID ne doit "
                "plus être accepté par le serveur."
            ),
            "test_type": "DAST",
            "masvs_ref": "MASVS-AUTH-11",
            "mastg_test": "MASTG-TEST-0022",
            "risk_level": "MEDIUM",
        },
        {
            "id": 11,
            "title": "Vérifier la protection anti-bruteforce (rate limiting login)",
            "description": (
                "Après 5 tentatives de connexion échouées, le compte doit être "
                "temporairement bloqué ou un CAPTCHA présenté. "
                "Tester avec un script simulant 10 tentatives rapides."
            ),
            "test_type": "DAST",
            "masvs_ref": "MASVS-AUTH-4",
            "mastg_test": "MASTG-TEST-0026",
            "risk_level": "HIGH",
        },
    ]

    # Éléments spécifiques au type d'authentification
    extra = {
        "JWT": {
            "id": 12,
            "title": "Vérifier l'absence de PII dans le payload JWT",
            "description": (
                "Le payload JWT (base64 décodable sans clé) ne doit contenir "
                "aucune donnée personnelle : email, téléphone, adresse. "
                "Inspecter avec jwt.io ou PyJWT en mode decode-only."
            ),
            "test_type": "DAST",
            "masvs_ref": "MASVS-STORAGE-1",
            "mastg_test": "MASTG-TEST-0001",
            "risk_level": "MEDIUM",
        },
        "OAuth2": {
            "id": 12,
            "title": "Vérifier l'utilisation du PKCE dans le flux OAuth2 mobile",
            "description": (
                "Le flux Authorization Code mobile DOIT utiliser PKCE "
                "(RFC 7636). Vérifier la présence des paramètres "
                "code_challenge et code_verifier dans les requêtes OAuth2."
            ),
            "test_type": "DAST",
            "masvs_ref": "MASVS-AUTH-1",
            "mastg_test": "MASTG-TEST-0020",
            "risk_level": "HIGH",
        },
        "Sessions": {
            "id": 12,
            "title": "Vérifier les attributs de sécurité du cookie de session",
            "description": (
                "Le cookie de session doit avoir les attributs : "
                "Secure (HTTPS uniquement), HttpOnly (non accessible JS), "
                "SameSite=Strict (protection CSRF). Vérifier avec Burp."
            ),
            "test_type": "DAST",
            "masvs_ref": "MASVS-AUTH-3",
            "mastg_test": "MASTG-TEST-0022",
            "risk_level": "HIGH",
        },
    }
    if auth_type in extra:
        checklist.append(extra[auth_type])

    return {
        "simulated": True,
        "model_used": "local-simulation",
        "quota_info": (
            "Mode simulation actif (IA Gemini indisponible ou quota atteint). "
            "Cette checklist est basée sur OWASP MASVS v2 standards. "
            "Pour activer l'IA : vérifiez GEMINI_API_KEY dans .env et "
            "utilisez GEMINI_MODEL=gemini-2.0-flash (1 500 req/jour gratuit)."
        ),
        "checklist": checklist,
        "acceptance_criteria": [
            f"Given un utilisateur {auth_type} authentifié avec un token valide, "
            "When le token expire (claim exp dépassé), "
            "Then l'API retourne HTTP 401 avec le body {\"error\": \"token_expired\"} "
            "And le client mobile redirige vers la page de login.",

            "Given un utilisateur connecté, "
            "When il appelle POST /api/auth/logout, "
            "Then la réponse est HTTP 200 "
            "And toute requête ultérieure avec le même token retourne HTTP 401 "
            "And un log d'audit est créé côté serveur.",

            "Given l'application mobile stocke un token d'accès, "
            "When on inspecte le stockage local (SharedPreferences, Keychain), "
            "Then le token est chiffré et non lisible en clair "
            "And il n'apparaît pas dans les logs adb logcat.",

            "Given une tentative de connexion avec de mauvaises credentials, "
            "When 5 tentatives échouées sont effectuées consécutivement, "
            "Then le serveur retourne HTTP 429 Too Many Requests "
            "And bloque le compte pendant 15 minutes minimum.",

            "Given un proxy MITM (Burp Suite) interceptant le trafic, "
            "When l'application tente une connexion réseau, "
            "Then la connexion est refusée avec SSLHandshakeException "
            "And aucune donnée n'est transmise au proxy.",
        ],
        "gherkin_scenarios": [
            {
                "user_story": f"US-SEC-01 : Cycle de vie du token {auth_type}",
                "scenario": (
                    "Scenario: Token expiré doit être rejeté par l'API\n"
                    f"  Given un utilisateur {auth_type} avec un token expiré depuis 5 minutes\n"
                    "  When il soumet une requête GET /api/protected\n"
                    "  Then l'API retourne HTTP 401 Unauthorized\n"
                    "  And le corps contient {\"error\": \"token_expired\", \"code\": 401}\n"
                    "  And le client mobile affiche la page de reconnexion"
                ),
                "masvs_ref": "MASVS-AUTH-5",
            },
            {
                "user_story": "US-SEC-02 : Déconnexion sécurisée avec révocation token",
                "scenario": (
                    "Scenario: Token invalide immédiatement après logout\n"
                    "  Given un utilisateur authentifié avec token T1 valide\n"
                    "  When il appelle POST /api/auth/logout\n"
                    "  Then la réponse est HTTP 200 avec {\"status\": \"logged_out\"}\n"
                    "  And une requête GET /api/me avec T1 retourne HTTP 401\n"
                    "  And le token T1 est dans la deny list du serveur"
                ),
                "masvs_ref": "MASVS-AUTH-6",
            },
            {
                "user_story": "US-SEC-03 : Stockage sécurisé des credentials",
                "scenario": (
                    "Scenario: Aucun token visible en clair dans le stockage local\n"
                    "  Given l'application reçoit un access token après login\n"
                    "  When elle persiste ce token pour les prochaines requêtes\n"
                    "  Then le token est stocké via EncryptedSharedPreferences\n"
                    "  And la commande 'adb logcat | grep token' ne retourne rien\n"
                    "  And le fichier SharedPreferences est chiffré AES-256"
                ),
                "masvs_ref": "MASVS-AUTH-7",
            },
            {
                "user_story": "US-SEC-04 : Protection réseau contre les interceptions MITM",
                "scenario": (
                    "Scenario: Connexion refusée si certificat invalide (Certificate Pinning)\n"
                    "  Given l'application a le certificate pinning actif\n"
                    "  When un proxy Burp Suite tente d'intercepter les requêtes HTTPS\n"
                    "  Then OkHttp lève une CertificatePinException\n"
                    "  And aucune requête n'aboutit au proxy\n"
                    "  And l'application affiche 'Connexion sécurisée impossible'"
                ),
                "masvs_ref": "MASVS-NETWORK-2",
            },
        ],
        "design_risks": [
            {
                "risk": "JWT sans révocation côté serveur",
                "description": (
                    "Les JWTs sont auto-validés via leur signature, mais sans "
                    "mécanisme de révocation, un token volé reste valide jusqu'à expiration."
                ),
                "mitigation": (
                    "Implémenter une deny list Redis pour les tokens révoqués "
                    "ou passer à des sessions avec état (opaque tokens)."
                ),
            },
            {
                "risk": "Session Fixation après élévation de privilège",
                "description": (
                    "Si le même ID de session est conservé après un changement "
                    "de niveau de sécurité (ajout MFA, rôle admin), un attaquant "
                    "peut pré-positionner un ID connu."
                ),
                "mitigation": (
                    "Régénérer systématiquement l'ID de session/token après "
                    "toute élévation de privilège ou changement de rôle."
                ),
            },
            {
                "risk": "Tokens stockés en SharedPreferences non chiffrées",
                "description": (
                    "Sur un appareil rooté, les SharedPreferences standards "
                    "sont lisibles par tout processus ayant les droits root. "
                    "Les tokens peuvent être extraits directement."
                ),
                "mitigation": (
                    "Utiliser EncryptedSharedPreferences (Android API 23+) "
                    "ou l'Android Keystore pour les clés critiques."
                ),
            },
            {
                "risk": "Absence de rate limiting sur les endpoints d'authentification",
                "description": (
                    "Sans protection anti-bruteforce, les endpoints /login et "
                    "/refresh-token sont vulnérables aux attaques automatisées "
                    "par dictionnaire ou credential stuffing."
                ),
                "mitigation": (
                    "Implémenter un rate limiting strict : max 5 tentatives / 15 min "
                    "avec blocage progressif (exponential backoff) et alerting."
                ),
            },
        ],
    }
