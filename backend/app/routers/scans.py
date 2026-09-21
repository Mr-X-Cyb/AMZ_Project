import datetime as dt
import re

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.deps import get_current_user
from app.models import Scan, ScanStatus, User
from app.schemas import ScanCreate, ScanDetail, ScanOut
from app.tasks import run_scan

router = APIRouter(prefix="/api/scans", tags=["scans"])

_DOMAIN_RE = re.compile(r"^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9-]+)+$")


def _normalize_domain(raw: str) -> str:
    raw = raw.strip().lower()
    raw = re.sub(r"^https?://", "", raw)
    raw = raw.split("/")[0].split(":")[0]
    if not _DOMAIN_RE.match(raw):
        raise HTTPException(status_code=422, detail="Invalid target domain")
    return raw


@router.post("", response_model=ScanOut, status_code=201)
def create_scan(
    body: ScanCreate,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    # Guardrail 1: mandatory scope authorization.
    if not body.authorized:
        raise HTTPException(
            status_code=400,
            detail="You must confirm you are authorized to test this target.",
        )

    domain = _normalize_domain(body.target_domain)

    # Guardrail 2: per-user rate limit to avoid hammering targets.
    recent = (
        db.query(Scan)
        .filter(Scan.user_id == current.id)
        .order_by(Scan.created_at.desc())
        .first()
    )
    if recent:
        delta = (dt.datetime.now(dt.timezone.utc) - recent.created_at).total_seconds()
        if delta < settings.SCAN_MIN_INTERVAL_SECONDS:
            raise HTTPException(
                status_code=429,
                detail=f"Rate limited: wait {int(settings.SCAN_MIN_INTERVAL_SECONDS - delta)}s "
                       "before starting another scan.",
            )

    scan = Scan(
        user_id=current.id,
        target_domain=domain,
        status=ScanStatus.pending,
        authorized=True,
        authorized_at=dt.datetime.now(dt.timezone.utc),
    )
    db.add(scan)
    db.commit()
    db.refresh(scan)

    # Guardrail 3: work runs on the queue, never inline — API returns immediately.
    run_scan.delay(scan.id)
    return scan


@router.get("", response_model=list[ScanOut])
def list_scans(db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    return (
        db.query(Scan)
        .filter(Scan.user_id == current.id)
        .order_by(Scan.created_at.desc())
        .all()
    )


@router.get("/{scan_id}", response_model=ScanDetail)
def get_scan(scan_id: int, db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    scan = db.get(Scan, scan_id)
    if not scan or scan.user_id != current.id:
        raise HTTPException(status_code=404, detail="Scan not found")
    return scan


@router.post("/{scan_id}/rerun", response_model=ScanOut, status_code=201)
def rerun_scan(scan_id: int, db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    old = db.get(Scan, scan_id)
    if not old or old.user_id != current.id:
        raise HTTPException(status_code=404, detail="Scan not found")

    scan = Scan(
        user_id=current.id,
        target_domain=old.target_domain,
        status=ScanStatus.pending,
        authorized=True,
        authorized_at=dt.datetime.now(dt.timezone.utc),
    )
    db.add(scan)
    db.commit()
    db.refresh(scan)
    run_scan.delay(scan.id)
    return scan


@router.delete("/{scan_id}", status_code=204)
def delete_scan(scan_id: int, db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    scan = db.get(Scan, scan_id)
    if not scan or scan.user_id != current.id:
        raise HTTPException(status_code=404, detail="Scan not found")
    db.delete(scan)
    db.commit()
