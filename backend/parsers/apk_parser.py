import subprocess
import os
import shutil
from typing import Optional
from backend.core.config import settings

class ApkParser:
    def __init__(self, apk_path: str, apk_hash: str):
        self.apk_path = apk_path
        self.apk_hash = apk_hash
        self.output_dir = os.path.join(settings.EXTRACT_DIR, apk_hash)
        self.apktool_dir = os.path.join(self.output_dir, "apktool")
        self.jadx_dir = os.path.join(self.output_dir, "jadx")

    def run_apktool(self) -> bool:
        """Décompile les ressources via Apktool (Manifest, res/ xml)"""
        if os.path.exists(self.apktool_dir):
            return True # Déjà extrait
            
        print(f"Running Apktool on {self.apk_path}")
        try:
            # -f (force delete destination), -o (output dir)
            cmd = ["apktool", "d", "-f", "-o", self.apktool_dir, self.apk_path]
            result = subprocess.run(cmd, capture_output=True, text=True)
            if result.returncode != 0:
                print(f"Apktool error: {result.stderr}")
                return False
            return True
        except Exception as e:
            print(f"Exception running apktool: {e}")
            return False

    def run_jadx(self) -> bool:
        """Décompile le code Java/Kotlin via JADX"""
        if os.path.exists(self.jadx_dir):
            return True
        
        print(f"Running JADX on {self.apk_path}")
        try:
            # -d (output dir), -e (export as gradle project)
            cmd = ["jadx", "-d", self.jadx_dir, self.apk_path]
            result = subprocess.run(cmd, capture_output=True, text=True)
            if result.returncode != 0:
                print(f"JADX error: {result.stderr}")
                return False
            return True
        except Exception as e:
            print(f"Exception running jadx: {e}")
            return False
            
    def get_manifest_path(self) -> Optional[str]:
        path = os.path.join(self.apktool_dir, "AndroidManifest.xml")
        return path if os.path.exists(path) else None

    def clean(self):
        """Nettoie les fichiers extraits une fois l'analyse terminée"""
        if os.path.exists(self.output_dir):
            shutil.rmtree(self.output_dir)
