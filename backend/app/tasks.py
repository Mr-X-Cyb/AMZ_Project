"""Celery task that runs a full recon pipeline off the request thread."""
import asyncio

from app.celery_app import celery
from app.config import settings
from app.database import SessionLocal
from app.models import Host, Scan, ScanStatus
from app.recon.ai_rank import rank_hosts
from app.recon.paths import scan_paths
from app.recon.probe import probe_hosts
from app.recon.subdomains import enumerate_subdomains
from app.recon.tech import detect_tech


async def _run_pipeline(target: str) -> tuple[list[dict], str, str]:
    # 1. Enumerate (passive)
    subs, method = await enumerate_subdomains(target, settings.RECON_MAX_HOSTS)

    # 2. Probe liveness + capture title/headers
    probed = await probe_hosts(subs, settings.RECON_CONCURRENCY, settings.RECON_TIMEOUT)

    # 3+4+5. Tech + exposed paths for live hosts
    for h in probed:
        h["tech"] = detect_tech(h.get("headers", {}), h.get("body_snippet", ""))
        h["exposed_paths"] = []
        if h["is_live"]:
            base = f"{h['scheme']}://{h['subdomain']}"
            h["exposed_paths"] = await scan_paths(
                base, settings.RECON_CONCURRENCY, settings.RECON_TIMEOUT
            )
        h.pop("body_snippet", None)  # don't persist raw bodies

    # 6. AI ranking
    scored, summary, provider = rank_hosts(target, probed)
    score_map = {s["subdomain"]: s for s in scored}
    for h in probed:
        s = score_map.get(h["subdomain"], {})
        h["ai_score"] = s.get("ai_score")
        h["ai_reason"] = s.get("ai_reason")

    probed.sort(key=lambda x: (x.get("ai_score") or -1), reverse=True)
    return probed, summary, provider


@celery.task(name="app.tasks.run_scan", bind=True)
def run_scan(self, scan_id: int) -> dict:
    db = SessionLocal()
    try:
        scan = db.get(Scan, scan_id)
        if scan is None:
            return {"error": "scan not found"}

        scan.status = ScanStatus.running
        db.commit()

        hosts, summary, provider = asyncio.run(_run_pipeline(scan.target_domain))

        for h in hosts:
            db.add(Host(
                scan_id=scan.id,
                subdomain=h["subdomain"],
                is_live=h["is_live"],
                status_code=h.get("status_code"),
                scheme=h.get("scheme"),
                title=h.get("title"),
                tech=h.get("tech") or [],
                headers=h.get("headers") or {},
                exposed_paths=h.get("exposed_paths") or [],
                ai_score=h.get("ai_score"),
                ai_reason=h.get("ai_reason"),
            ))

        scan.ai_summary = summary
        scan.ai_provider = provider
        scan.status = ScanStatus.completed
        db.commit()
        return {"scan_id": scan.id, "hosts": len(hosts), "provider": provider}
    except Exception as e:
        db.rollback()
        scan = db.get(Scan, scan_id)
        if scan:
            scan.status = ScanStatus.failed
            scan.error = f"{type(e).__name__}: {e}"
            db.commit()
        raise
    finally:
        db.close()
