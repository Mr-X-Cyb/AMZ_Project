"""AI-based target ranking.

If ANTHROPIC_API_KEY is set, we ask Claude to score each host (0-100) and explain
WHY it's worth manual investigation. If no key is set, or the API call fails, we
fall back to a transparent deterministic heuristic so the app still works.
The return value always includes which provider was used.
"""
import json

from app.config import settings

_SYSTEM = (
    "You are a senior bug bounty recon analyst. You are given passive recon data "
    "for subdomains of an authorized target. Rank each host by how interesting it "
    "is for MANUAL security investigation (0-100) and explain WHY in plain, concise "
    "language. Prioritize exposed sensitive paths (.git, .env, admin panels, "
    "actuators), unusual tech stacks, dev/staging/internal naming, and anything "
    "that suggests misconfiguration. Never suggest exploitation. Respond ONLY with "
    "valid JSON."
)


def _heuristic(hosts: list[dict]) -> tuple[list[dict], str]:
    scored = []
    for h in hosts:
        score = 0
        reasons = []
        paths = h.get("exposed_paths") or []
        name = h.get("subdomain", "")

        for p in paths:
            path = p.get("path", "")
            if path in ("/.git/config", "/.env"):
                score += 40
                reasons.append(f"Highly sensitive {p.get('label')} exposed")
            elif "admin" in path or "phpmyadmin" in path or "actuator" in path:
                score += 20
                reasons.append(f"{p.get('label')} reachable")
            else:
                score += 8
                reasons.append(f"{p.get('label')} present")

        for kw in ("dev", "staging", "test", "internal", "uat", "api", "admin", "git", "jenkins"):
            if kw in name:
                score += 12
                reasons.append(f"Interesting hostname keyword '{kw}'")
                break

        if h.get("status_code") in (401, 403):
            score += 6
            reasons.append("Auth-protected endpoint (something is behind it)")

        if not h.get("is_live"):
            score = 0
            reasons = ["Host not reachable"]

        score = min(score, 100)
        scored.append({
            "subdomain": name,
            "ai_score": float(score),
            "ai_reason": "; ".join(reasons) if reasons else "No notable signals from passive recon.",
        })
    scored.sort(key=lambda x: x["ai_score"], reverse=True)
    return scored, "heuristic"


def _compact(hosts: list[dict]) -> list[dict]:
    out = []
    for h in hosts:
        out.append({
            "subdomain": h.get("subdomain"),
            "is_live": h.get("is_live"),
            "status_code": h.get("status_code"),
            "title": h.get("title"),
            "tech": h.get("tech"),
            "exposed_paths": [p.get("path") for p in (h.get("exposed_paths") or [])],
        })
    return out


def rank_hosts(target: str, hosts: list[dict]) -> tuple[list[dict], str, str]:
    """Return (per_host_scores, summary_text, provider)."""
    if not settings.ANTHROPIC_API_KEY:
        scored, provider = _heuristic(hosts)
        return scored, _fallback_summary(target, scored), provider

    try:
        import anthropic
        client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
        payload = _compact(hosts)
        user_msg = (
            f"Target: {target}\n\nRecon data (JSON):\n{json.dumps(payload, indent=2)}\n\n"
            "Return JSON of the exact shape:\n"
            '{"summary": "<2-3 sentence overview>", '
            '"hosts": [{"subdomain": "...", "score": 0-100, "reason": "..."}]}'
        )
        resp = client.messages.create(
            model=settings.ANTHROPIC_MODEL,
            max_tokens=2000,
            system=_SYSTEM,
            messages=[{"role": "user", "content": user_msg}],
        )
        text = "".join(block.text for block in resp.content if block.type == "text")
        text = text.strip()
        if text.startswith("```"):
            text = text.split("```")[1].lstrip("json").strip()
        data = json.loads(text)

        by_name = {h["subdomain"]: h for h in data.get("hosts", [])}
        scored = []
        for h in hosts:
            entry = by_name.get(h["subdomain"], {})
            scored.append({
                "subdomain": h["subdomain"],
                "ai_score": float(entry.get("score", 0)),
                "ai_reason": entry.get("reason", "No assessment returned."),
            })
        scored.sort(key=lambda x: x["ai_score"], reverse=True)
        return scored, data.get("summary", ""), "anthropic"
    except Exception as e:
        # Never let AI failure break the scan — degrade gracefully.
        scored, _ = _heuristic(hosts)
        summary = (
            f"AI provider error ({type(e).__name__}); fell back to heuristic scoring. "
            + _fallback_summary(target, scored)
        )
        return scored, summary, "heuristic"


def _fallback_summary(target: str, scored: list[dict]) -> str:
    top = [s["subdomain"] for s in scored[:3] if s["ai_score"] > 0]
    if not top:
        return f"No high-signal hosts found for {target} via passive recon."
    return f"Top hosts to investigate for {target}: " + ", ".join(top) + "."
