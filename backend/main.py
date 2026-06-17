from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import Base, engine
from auth import router as auth_router
from files import router as files_router
from query import router as query_router
import os

Base.metadata.create_all(bind=engine)

ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.getenv("ALLOWED_ORIGINS", "https://hyper-mindz-solution.vercel.app").split(",")
    if origin.strip()
]

app = FastAPI(docs_url=None, redoc_url=None)  # Disable public API docs in production

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(files_router)
app.include_router(query_router)

@app.get("/health")
def health():
    return {"status": "ok"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
