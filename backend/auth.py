from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
import bcrypt
import jwt
from datetime import datetime, timedelta
from database import get_db
from models import User
import httpx
from config import JWT_SECRET, ALGORITHM

router = APIRouter(prefix="/auth", tags=["auth"])

class SignupRequest(BaseModel):
    email: str
    password: str

class LoginRequest(BaseModel):
    email: str
    password: str

class GoogleLoginRequest(BaseModel):
    access_token: str

@router.post("/signup")
def signup(req: SignupRequest, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == req.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already exists")
    
    password_hash = bcrypt.hashpw(req.password.encode(), bcrypt.gensalt()).decode()
    user = User(email=req.email, password_hash=password_hash)
    db.add(user)
    db.commit()
    db.refresh(user)
    
    token = jwt.encode(
        {"user_id": user.id, "exp": datetime.utcnow() + timedelta(days=7)},
        JWT_SECRET,
        algorithm=ALGORITHM
    )
    
    return {"access_token": token, "user_id": user.id, "email": user.email}

@router.post("/login")
def login(req: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == req.email).first()
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not bcrypt.checkpw(req.password.encode(), user.password_hash.encode()):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = jwt.encode(
        {"user_id": user.id, "exp": datetime.utcnow() + timedelta(days=7)},
        JWT_SECRET,
        algorithm=ALGORITHM
    )

    return {"access_token": token, "user_id": user.id, "email": user.email}


@router.post("/google-login")
def google_login(req: GoogleLoginRequest, db: Session = Depends(get_db)):
    response = httpx.get(
        "https://www.googleapis.com/oauth2/v3/userinfo",
        headers={"Authorization": f"Bearer {req.access_token}"},
        timeout=10,
    )
    if response.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid Google token")

    user_info = response.json()
    email = user_info.get("email")
    if not email:
        raise HTTPException(status_code=400, detail="Google account has no email")

    user = db.query(User).filter(User.email == email).first()
    if not user:
        user = User(email=email, password_hash="")
        db.add(user)
        db.commit()
        db.refresh(user)

    token = jwt.encode(
        {"user_id": user.id, "exp": datetime.utcnow() + timedelta(days=7)},
        JWT_SECRET,
        algorithm=ALGORITHM
    )
    return {"access_token": token, "user_id": user.id, "email": user.email}
