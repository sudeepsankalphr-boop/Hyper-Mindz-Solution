from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.orm import Session
import csv
import io
from database import get_db
from models import UploadedFile, User
from query import get_current_user

router = APIRouter(prefix="/files", tags=["files"])

@router.post("/upload")
async def upload_file(file: UploadFile = File(...), db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    contents = await file.read()
    csv_file = io.StringIO(contents.decode())
    reader = csv.DictReader(csv_file)
    
    rows = list(reader)
    if not rows:
        raise HTTPException(status_code=400, detail="CSV is empty")
    
    columns = ",".join(reader.fieldnames)
    row_count = len(rows)
    
    uploaded = UploadedFile(
        user_id=user.id,
        filename=file.filename,
        csv_data=contents.decode(),
        columns=columns,
        row_count=row_count
    )
    db.add(uploaded)
    db.commit()
    db.refresh(uploaded)
    
    return {
        "file_id": uploaded.id,
        "filename": uploaded.filename,
        "rows": row_count,
        "columns": columns.split(",")
    }

@router.get("/list")
def list_files(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    files = db.query(UploadedFile).filter(UploadedFile.user_id == user.id).all()
    return [{"file_id": f.id, "filename": f.filename, "rows": f.row_count} for f in files]

@router.get("/{file_id}")
def get_file(file_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    file = db.query(UploadedFile).filter(
        UploadedFile.id == file_id,
        UploadedFile.user_id == user.id
    ).first()
    
    if not file:
        raise HTTPException(status_code=404, detail="File not found")
    
    return {
        "file_id": file.id,
        "filename": file.filename,
        "rows": file.row_count,
        "columns": file.columns.split(",")
    }

@router.delete("/{file_id}")
def delete_file(file_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    file = db.query(UploadedFile).filter(
        UploadedFile.id == file_id,
        UploadedFile.user_id == user.id
    ).first()
    
    if not file:
        raise HTTPException(status_code=404, detail="File not found")
    
    db.delete(file)
    db.commit()
    return {"deleted": True}
