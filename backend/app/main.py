from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import auth, export, scans

app = FastAPI(title="AMZ — Bug Bounty Recon Automation", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(scans.router)
app.include_router(export.router)


@app.get("/health", tags=["meta"])
def health():
    return {"status": "ok", "service": "amz-backend"}


@app.get("/api/config", tags=["meta"])
def public_config():
    # Frontend uses this to show whether real AI ranking is active.
    return {"ai_enabled": bool(settings.ANTHROPIC_API_KEY)}
