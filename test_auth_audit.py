from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)
response = client.post("/api/auth-audit/generate-checklist", json={"auth_type": "JWT"})
print("Status Code:", response.status_code)
print("Response JSON:")
print(response.json())
