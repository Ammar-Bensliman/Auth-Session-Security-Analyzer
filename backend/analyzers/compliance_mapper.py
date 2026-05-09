import json
from typing import List, Dict, Any

# Liste des contrôles MASVS v2 par défaut
DEFAULT_MASVS_CONTROLS = [
    # Auth & Session
    "MASVS-AUTH-1", "MASVS-AUTH-2", "MASVS-AUTH-3", "MASVS-AUTH-4", 
    "MASVS-AUTH-5", "MASVS-AUTH-6", "MASVS-AUTH-7", "MASVS-AUTH-8",
    "MASVS-AUTH-9", "MASVS-AUTH-10", "MASVS-AUTH-11",
    # Stockage Local
    "MASVS-STORAGE-1", "MASVS-STORAGE-2", "MASVS-STORAGE-3",
    # Cryptographie
    "MASVS-CRYPTO-1", "MASVS-CRYPTO-2", "MASVS-CRYPTO-3", "MASVS-CRYPTO-4", "MASVS-CRYPTO-5",
    # Réseau & TLS
    "MASVS-NETWORK-1", "MASVS-NETWORK-2", "MASVS-NETWORK-3",
    # Résilience & Anti-Tampering
    "MASVS-RESILIENCE-1", "MASVS-RESILIENCE-2", "MASVS-RESILIENCE-3",
    # Platform & WebView
    "MASVS-PLATFORM-1", "MASVS-PLATFORM-2", "MASVS-PLATFORM-3"
]

def map_to_masvs(findings: List[Any], llm_json_results: List[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    Mappe les résultats de l'analyse statique et dynamique sur les contrôles MASVS v2.
    """
    # 1. Initialiser le dictionnaire des statuts avec "covered" par défaut
    # (Si le code est analysé et qu'aucune vuln n'est trouvée, c'est couvert).
    mapping = {control_id: "covered" for control_id in DEFAULT_MASVS_CONTROLS}
    
    # Certains contrôles complexes nécessitent souvent un audit manuel ("partial") ou sont manquants ("missing") par défaut
    # pour une analyse purement statique/DAST basique, mais selon l'énoncé, on part sur "covered" pour l'UI,
    # sauf si le LLM ou SAST dit autrement. Pour coller à l'UI actuelle :
    mapping["MASVS-AUTH-4"] = "partial"
    mapping["MASVS-AUTH-8"] = "partial"
    mapping["MASVS-AUTH-11"] = "partial"
    mapping["MASVS-STORAGE-3"] = "partial"
    mapping["MASVS-CRYPTO-3"] = "partial"
    mapping["MASVS-RESILIENCE-1"] = "partial"
    mapping["MASVS-RESILIENCE-2"] = "partial"
    mapping["MASVS-RESILIENCE-3"] = "missing"
    mapping["MASVS-PLATFORM-2"] = "partial"
    mapping["MASVS-PLATFORM-3"] = "partial"

    # 2. Intégrer les résultats de l'IA (LLM RAG)
    if llm_json_results:
        # S'assurer que c'est bien une liste
        if isinstance(llm_json_results, dict):
            llm_json_results = [llm_json_results]
        elif not isinstance(llm_json_results, list):
            llm_json_results = []
            
        for item in llm_json_results:
            if not isinstance(item, dict):
                continue
            masvs_id = item.get("id_masvs")
            status = item.get("status")
            if masvs_id in mapping and status in ["covered", "partial", "absent", "missing"]:
                # Normalisation du status absent -> missing pour correspondre à l'UI
                if status == "absent":
                    status = "missing"
                mapping[masvs_id] = status

    # 3. Écraser avec les résultats SAST/DAST (findings)
    # Si une vulnérabilité formelle est détectée pour un ID, le contrôle devient "missing" (Absent)
    for finding in findings:
        masvs_id = getattr(finding, "masvs_id", None)
        if not masvs_id and isinstance(finding, dict):
            masvs_id = finding.get("masvs_id")
            
        if masvs_id in mapping:
            mapping[masvs_id] = "missing"
            
    # 4. Calcul de la couverture globale
    total = len(DEFAULT_MASVS_CONTROLS)
    covered_count = sum(1 for status in mapping.values() if status == "covered")
    partial_count = sum(1 for status in mapping.values() if status == "partial")
    missing_count = total - covered_count - partial_count
    
    global_coverage = round((covered_count / total) * 100) if total > 0 else 0

    return {
        "mapping": mapping,
        "stats": {
            "total": total,
            "covered": covered_count,
            "partial": partial_count,
            "missing": missing_count,
            "coverage_percentage": global_coverage
        }
    }
