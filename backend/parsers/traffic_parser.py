import re
from typing import List

class TrafficParser:
    def __init__(self, log_path: str):
        self.log_path = log_path
        with open(log_path, 'r', encoding='utf-8', errors='ignore') as f:
            self.content = f.read()

    def find_bearer_tokens(self) -> List[str]:
        # Regex to find tokens inside HTTP Authorization headers
        tokens = re.findall(r'Authorization:\s*(?:Bearer|Token)\s+([A-Za-z0-9\-\._~\+\/]+)', self.content, re.IGNORECASE)
        return list(set(tokens))

    def check_insecure_cookies(self) -> List[str]:
        # Checks if Set-Cookie headers lack Secure or HttpOnly flags
        insecure_cookies = []
        lines = self.content.split('\n')
        for line in lines:
            if line.upper().startswith('SET-COOKIE:'):
                if 'SECURE' not in line.upper() or 'HTTPONLY' not in line.upper():
                    insecure_cookies.append(line.strip()[:100])
        return insecure_cookies
    
    def find_secrets_in_url(self) -> List[str]:
        # Simple regex for things like ?token=... or ?session_id=... transmitted via GET
        suspicious_params = re.findall(r'(?:token|session|auth|apikey|api_key)=([A-Za-z0-9_-]+)', self.content, re.IGNORECASE)
        return list(set(suspicious_params))
