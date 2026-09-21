import csv
import io

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models import Scan, User

router = APIRouter(prefix="/api/scans", tags=["export"])


def _load_scan(scan_id: int, db: Session, current: User) -> Scan:
    scan = db.get(Scan, scan_id)
    if not scan or scan.user_id != current.id:
        raise HTTPException(status_code=404, detail="Scan not found")
    return scan


@router.get("/{scan_id}/export.csv")
def export_csv(scan_id: int, db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    scan = _load_scan(scan_id, db, current)
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(
        ["subdomain", "live", "status", "scheme", "title", "tech", "exposed_paths", "ai_score", "ai_reason"]
    )
    for h in sorted(scan.hosts, key=lambda x: (x.ai_score or -1), reverse=True):
        writer.writerow([
            h.subdomain,
            "yes" if h.is_live else "no",
            h.status_code or "",
            h.scheme or "",
            h.title or "",
            ", ".join(h.tech or []),
            ", ".join(f"{p.get('label')}({p.get('status')})" for p in (h.exposed_paths or [])),
            h.ai_score if h.ai_score is not None else "",
            h.ai_reason or "",
        ])
    buf.seek(0)
    filename = f"amz_scan_{scan.id}_{scan.target_domain}.csv"
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/{scan_id}/export.pdf")
def export_pdf(scan_id: int, db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    scan = _load_scan(scan_id, db, current)

    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4, landscape
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import mm
    from reportlab.platypus import (
        SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
    )

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=landscape(A4),
                            leftMargin=12 * mm, rightMargin=12 * mm,
                            topMargin=12 * mm, bottomMargin=12 * mm)
    styles = getSampleStyleSheet()
    small = ParagraphStyle("small", parent=styles["Normal"], fontSize=7, leading=9)
    elems = []

    elems.append(Paragraph(f"AMZ Recon Report — {scan.target_domain}", styles["Title"]))
    elems.append(Paragraph(
        f"Scan #{scan.id} · status: {scan.status.value if hasattr(scan.status,'value') else scan.status} · "
        f"AI provider: {scan.ai_provider or 'n/a'} · authorized_at: {scan.authorized_at}",
        styles["Normal"],
    ))
    elems.append(Spacer(1, 6))
    if scan.ai_summary:
        elems.append(Paragraph(f"<b>AI Summary:</b> {scan.ai_summary}", styles["Normal"]))
        elems.append(Spacer(1, 8))

    header = ["Subdomain", "Live", "Code", "Tech", "Exposed paths", "Score", "Reason"]
    data = [header]
    for h in sorted(scan.hosts, key=lambda x: (x.ai_score or -1), reverse=True):
        data.append([
            Paragraph(h.subdomain, small),
            "Y" if h.is_live else "N",
            str(h.status_code or ""),
            Paragraph(", ".join(h.tech or []), small),
            Paragraph(", ".join(p.get("label", "") for p in (h.exposed_paths or [])), small),
            str(int(h.ai_score)) if h.ai_score is not None else "",
            Paragraph(h.ai_reason or "", small),
        ])

    table = Table(data, repeatRows=1,
                  colWidths=[55 * mm, 10 * mm, 12 * mm, 45 * mm, 55 * mm, 12 * mm, 80 * mm])
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#111827")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTSIZE", (0, 0), (-1, 0), 8),
        ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#d1d5db")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f3f4f6")]),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))
    elems.append(table)
    elems.append(Spacer(1, 10))
    elems.append(Paragraph(
        "For use only on targets you are authorized to test (owned assets or in-scope bug bounty programs).",
        small,
    ))

    doc.build(elems)
    buf.seek(0)
    filename = f"amz_scan_{scan.id}_{scan.target_domain}.pdf"
    return StreamingResponse(
        buf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
