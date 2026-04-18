"""Test d'import de tous les modules backend."""
import sys

errors = []

def test_import(module_path):
    try:
        __import__(module_path.replace('/', '.').replace('\\', '.'))
        print(f"  OK  {module_path}")
        return True
    except Exception as e:
        print(f"  FAIL {module_path}: {e}")
        errors.append((module_path, str(e)))
        return False

print("=== Test des imports backend ===")
modules = [
    "backend.core.config",
    "backend.core.database",
    "backend.core.models",
    "backend.parsers.traffic_parser",
    "backend.parsers.jwt_parser",
    "backend.parsers.manifest_parser",
    "backend.parsers.apk_parser",
    "backend.analyzers.flow_analyzer",
    "backend.analyzers.semgrep_runner",
    "backend.analyzers.runner",
    "backend.ai.llm_client",
    "backend.api.routes.upload",
    "backend.api.routes.analyze",
    "backend.api.routes.report",
    "backend.api.routes.jobs",
    "backend.api.routes.export",
    "backend.api.routes.auth_audit",
    "backend.main",
]

for m in modules:
    test_import(m)

print()
if errors:
    print(f"ECHEC: {len(errors)} module(s) en erreur")
    for m, e in errors:
        print(f"  - {m}: {e}")
    sys.exit(1)
else:
    print(f"SUCCES: tous les {len(modules)} modules importés correctement !")
