from fastapi import APIRouter, UploadFile, File, HTTPException
import shutil
import os
import uuid
import hashlib
from backend.core.config import settings

router = APIRouter()

@router.post("/apk")
async def upload_file(file: UploadFile = File(...)):
    if not (file.filename.endswith(".apk") or file.filename.endswith(".txt") or file.filename.endswith(".xml") or file.filename.endswith(".har")):
        raise HTTPException(status_code=400, detail="Format non supporté (utilisez .apk, .txt, .xml, .har)")
    
    file_id = str(uuid.uuid4())
    is_log = not file.filename.endswith(".apk")
    secure_filename = f"{file_id}_{file.filename}" if is_log else f"{file_id}.apk"
    file_path = os.path.join(settings.UPLOAD_DIR, secure_filename)
    
    sha256_hash = hashlib.sha256()
    with open(file_path, "wb") as buffer:
        while chunk := await file.read(8192):
            buffer.write(chunk)
            sha256_hash.update(chunk)
            
    return {
        "file_id": file_id,
        "filename": file.filename,
        "hash": sha256_hash.hexdigest(),
        "status": "uploaded",
        "path": file_path
    }

@router.post("/logs")
async def upload_traffic_logs(file: UploadFile = File(...)):
    """Upload proxy logs (Burp, Proxyman) or simple text file for analysis"""
    if not file.filename.endswith(".txt") and not file.filename.endswith(".xml"):
        raise HTTPException(status_code=400, detail="Format non supporté (utilisez .txt, .xml)")
    
    file_id = str(uuid.uuid4())
    file_path = os.path.join(settings.UPLOAD_DIR, f"{file_id}_{file.filename}")
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    return {
        "log_id": file_id,
        "status": "uploaded",
        "path": file_path
    }
