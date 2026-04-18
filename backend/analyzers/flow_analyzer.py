from typing import List
from backend.core.models import Finding
from backend.parsers.traffic_parser import TrafficParser

class FlowAnalyzer:
    def __init__(self, parser: TrafficParser):
        self.parser = parser

    def analyze(self) -> List[Finding]:
        findings = []
        file_basename = self.parser.log_path.split("/")[-1]
        
        tokens = self.parser.find_bearer_tokens()
        if tokens:
            findings.append(Finding(
                title="Fuite potentielle de jeton (Token) HTTP",
                description=f"Identifié {len(tokens)} token(s) d'authentification trouvés physiquement de manière statique dans les logs.",
                file_path=file_basename,
                evidence=f"Extrait: Authorization Bearer {tokens[0][:15]}...",
                masvs_id="MASVS-AUTH-1",
                mastg_test="MASTG-TEST-0020",
                impact=3, exploitability=2, exposure=3,
                remediation="Assurez-vous que l'authentification se fait via TLS strict (HTTPS) avec Certificate Pinning actif côté Android."
            ))
            
        insecure_cookies = self.parser.check_insecure_cookies()
        if insecure_cookies:
            findings.append(Finding(
                title="Cookie Dépourvu du Flag Secure/HttpOnly",
                description="Le backend web/API renvoie des cookies de session sans précautions.",
                file_path=file_basename,
                evidence=insecure_cookies[0],
                masvs_id="MASVS-AUTH-3",
                mastg_test="MASTG-TEST-0022",
                impact=2, exploitability=2, exposure=3,
                remediation="Positionner l'attribut Secure (HTTP-only flag pour empêcher l'accès XSS) sur les cookies envoyés à l'application mobile."
            ))

        secrets_in_url = self.parser.find_secrets_in_url()
        if secrets_in_url:
            findings.append(Finding(
                title="Transmission de Secrets dans l'URL",
                description="Des tokens ou clés d'API ont été trouvés sous forme de paramètres (GET) dans l'URL.",
                file_path=file_basename,
                evidence=f"{len(secrets_in_url)} paramètres exposés. Exemple: {secrets_in_url[0][:15]}",
                masvs_id="MASVS-AUTH-2",
                mastg_test="MASTG-TEST-0021",
                impact=2, exploitability=3, exposure=3,
                remediation="Ne transmettez jamais de jetons JWT, Session ID ou clés via l'URL (GET). Utilisez le header système 'Authorization' ou POST JSON."
            ))

        return findings
