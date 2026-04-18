import requests
import time
import sys
import os

BASE_URL = "http://localhost:8000"

print("=== DEBUT DES TESTS E2E ===")
print("1. Creation d'un faux APK...")
with open("test.apk", "wb") as f:
    f.write(b"PK\x03\x04\n\x00\x00\x00\x00\x00dummy content")

print("2. Envoi du fichier vers /api/upload/apk...")
try:
    with open("test.apk", "rb") as f:
        res = requests.post(f"{BASE_URL}/api/upload/apk", files={"file": ("test.apk", f, "application/vnd.android.package-archive")})
    res.raise_for_status()
    data = res.json()
    file_id = data["file_id"]
    apk_hash = data["hash"]
    print(f" Succes: Fichier televerse, ID={file_id}")
except Exception as e:
    print(f" Erreur Upload: {e}")
    sys.exit(1)

print("3. Lancement de l'analyse /api/analyze/start...")
try:
    payload = {
        "file_id": file_id,
        "apk_hash": apk_hash,
        "filename": "test.apk"
    }
    res = requests.post(f"{BASE_URL}/api/analyze/start", json=payload)
    res.raise_for_status()
    print(f" Succes: Analyse demarree, JobID={res.json().get('job_id')}")
except Exception as e:
    print(f" Erreur Analyze: {e}")
    sys.exit(1)

print("4. Attente du traitement background (5 sec)...")
for i in range(5):
    print(f" . {5-i}s restantes")
    time.sleep(1)

print("5. Recuperation des rapports depuis la base DB SQLite /api/report/...")
try:
    res = requests.get(f"{BASE_URL}/api/report/")
    res.raise_for_status()
    reports = res.json()
    if not reports:
        print(" Echec: Aucun rapport trouve en BDD. Le `runner.py` a echoue en background.")
        sys.exit(1)
        
    latest_id = reports[0]["id"]
    print(f" Succes: Rapport trouve, ID={latest_id}")
    
    print("6. Consultation des details JSON du rapport...")
    res2 = requests.get(f"{BASE_URL}/api/report/{latest_id}")
    res2.raise_for_status()
    report = res2.json()
    print("\n   [Resume Executif IA] :")
    print("   " + report.get("executive_summary", "Aucun resume"))
    print(f"\n   [Score de Sécurite global] : {report.get('overall_score')}/100")
    print("\n=== TESTS E2E VALIDES AVEC SUCCES ! ===")
except Exception as e:
    print(f" Erreur au fetch du rapport: {e}")
    sys.exit(1)
finally:
    if os.path.exists("test.apk"):
        os.remove("test.apk")
