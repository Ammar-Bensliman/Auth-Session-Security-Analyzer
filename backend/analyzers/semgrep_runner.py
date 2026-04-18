import subprocess
import shutil
import sys
import json
import os
from typing import List
from backend.core.models import Finding

# ── Chemin des règles Semgrep ───────────────────────────────────────────────
# Structure : backend/analyzers/semgrep_runner.py
#   → remonte 1 niveau : backend/analyzers/ → backend/
#   → descend dans  : backend/rules/semgrep/
_RULES_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "rules", "semgrep")
)

# ── Résolution du binaire Semgrep ───────────────────────────────────────────
# Dans Docker (pip install semgrep), le binaire est dans le PATH Python.
# On cherche d'abord via shutil.which, puis dans le répertoire bin de Python.
def _find_semgrep() -> str | None:
    """Retourne le chemin absolu du binaire semgrep, ou None s'il est absent."""
    # 1) PATH système (devrait fonctionner après pip install semgrep sur Linux)
    path = shutil.which("semgrep")
    if path:
        return path

    # 2) Répertoire Scripts/bin du venv Python courant
    scripts_dir = os.path.join(os.path.dirname(sys.executable))
    for name in ("semgrep", "semgrep.exe"):
        candidate = os.path.join(scripts_dir, name)
        if os.path.isfile(candidate):
            return candidate

    # 3) Répertoire bin d'installation pip (ex: /usr/local/bin dans Docker)
    for prefix in ("/usr/local/bin", "/usr/bin"):
        candidate = os.path.join(prefix, "semgrep")
        if os.path.isfile(candidate):
            return candidate

    return None


_SEMGREP_BIN = _find_semgrep()

if _SEMGREP_BIN:
    print(f"[Semgrep] Binaire détecté : {_SEMGREP_BIN}")
else:
    print("[Semgrep] ⚠️  Binaire introuvable — l'analyse SAST statique sera désactivée.")
    print("  → Docker : pip install semgrep est dans requirements.txt — rebuild l'image.")
    print("  → Windows local : installer WSL ou utiliser le mode simulation.")


class SemgrepRunner:
    def __init__(self, target_dir: str, rules_path: str = None):
        self.target_dir = target_dir
        self.rules_path = rules_path or _RULES_DIR
        self.semgrep_bin = _SEMGREP_BIN

    def is_available(self) -> bool:
        """Retourne True si Semgrep est disponible et les règles existent."""
        return self.semgrep_bin is not None and os.path.exists(self.rules_path)

    def run(self) -> List[Finding]:
        """Lance Semgrep sur target_dir et retourne les findings MASVS."""

        # ── Pré-conditions ────────────────────────────────────────────────
        if not self.semgrep_bin:
            print("[Semgrep] Non disponible — analyse SAST ignorée.")
            return []

        if not os.path.exists(self.rules_path):
            print(f"[Semgrep] Règles introuvables : {self.rules_path}")
            return []

        if not os.path.exists(self.target_dir):
            print(f"[Semgrep] Dossier cible introuvable : {self.target_dir}")
            return []

        # ── Exécution ─────────────────────────────────────────────────────
        cmd = [
            self.semgrep_bin,
            "--config", self.rules_path,
            "--json",
            "--quiet",          # Réduit le bruit stderr
            "--no-git-ignore",  # Analyser même les fichiers non trackés
            self.target_dir,
        ]

        try:
            print(f"[Semgrep] Lancement : {' '.join(cmd[:4])} ...")
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=180,    # 3 min max pour les gros APK
            )

            raw_output = result.stdout.strip()
            if not raw_output:
                stderr_preview = result.stderr[:300] if result.stderr else "aucun"
                print(f"[Semgrep] Aucune sortie JSON (stderr: {stderr_preview})")
                return []

            data = json.loads(raw_output)
            findings = []

            for item in data.get("results", []):
                extra    = item.get("extra", {})
                metadata = extra.get("metadata", {})
                raw_path = item.get("path", "")

                # Chemin relatif pour l'affichage
                clean_path = raw_path
                if self.target_dir and self.target_dir in raw_path:
                    clean_path = raw_path.split(self.target_dir)[-1].lstrip("\\/")

                # Valeurs numériques bornées [1, 3]
                def _clamp(val, default=2):
                    try:
                        return max(1, min(3, int(val)))
                    except (TypeError, ValueError):
                        return default

                finding = Finding(
                    title=item.get("check_id", "Règle Semgrep inconnue"),
                    description=extra.get("message", "Voir MASVS v2."),
                    file_path=clean_path or raw_path or "inconnu",
                    line_number=item.get("start", {}).get("line"),
                    evidence=extra.get("lines", "").strip()[:400],
                    masvs_id=metadata.get("masvs_id", "MASVS-AUTH-Unknown"),
                    mastg_test=metadata.get("mastg_test", "MASTG-Unknown"),
                    impact=_clamp(metadata.get("impact")),
                    exploitability=_clamp(metadata.get("exploitability")),
                    exposure=_clamp(metadata.get("exposure")),
                    remediation=metadata.get("remediation", "Consulter les guidelines MASVS v2."),
                )
                findings.append(finding)

            print(f"[Semgrep] ✅ {len(findings)} finding(s) SAST détecté(s).")
            return findings

        except subprocess.TimeoutExpired:
            print("[Semgrep] ⏱ Timeout (180s) — analyse interrompue.")
            return []
        except json.JSONDecodeError as e:
            print(f"[Semgrep] JSON invalide en sortie : {e}")
            return []
        except FileNotFoundError:
            print(f"[Semgrep] Binaire introuvable à runtime : {self.semgrep_bin}")
            return []
        except Exception as e:
            print(f"[Semgrep] Erreur inattendue : {type(e).__name__}: {e}")
            return []
