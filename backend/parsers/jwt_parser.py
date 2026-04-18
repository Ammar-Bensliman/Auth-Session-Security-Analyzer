import jwt
from typing import Dict, Any, List

class JWTParser:
    @staticmethod
    def decode_token(token: str) -> Dict[str, Any]:
        """Décode un token JWT en affichant son payload et ses headers (sans valider la signature pour un audit SAST)"""
        try:
            headers = jwt.get_unverified_header(token)
            payload = jwt.decode(token, options={"verify_signature": False})
            return {
                "valid_format": True,
                "headers": headers,
                "payload": payload,
                "algorithm": headers.get("alg")
            }
        except jwt.DecodeError:
            return {"valid_format": False, "error": "Invalid token format"}
            
    @staticmethod
    def analyze_claims(payload: Dict[str, Any]) -> List[str]:
        """Analyse le payload à la recherche de faiblesses communes (exp, nbf manquants, PII exposées)"""
        issues = []
        if "exp" not in payload:
            issues.append("Missing expiration 'exp' claim")
        if "sub" not in payload:
            issues.append("Missing subject 'sub' claim")
            
        pii_keywords = ["email", "password", "ssn", "phone", "dob"]
        for key in payload.keys():
            if any(k in key.lower() for k in pii_keywords):
                issues.append(f"Potential PII exposure in claim: '{key}'")
                
        return issues
