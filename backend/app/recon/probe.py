"""Liveness probe + title/header capture. HTTP GET only, non-destructive."""
import asyncio
import re

import httpx

_TITLE_RE = re.compile(r"<title[^>]*>(.*?)</title>", re.IGNORECASE | re.DOTALL)


async def _probe_one(host: str, client: httpx.AsyncClient, timeout: int) -> dict:
    for scheme in ("https", "http"):
        url = f"{scheme}://{host}"
        try:
            r = await client.get(url, timeout=timeout)
            title_match = _TITLE_RE.search(r.text[:200_000]) if r.text else None
            title = title_match.group(1).strip()[:200] if title_match else None
            return {
                "subdomain": host,
                "is_live": True,
                "scheme": scheme,
                "status_code": r.status_code,
                "title": title,
                "headers": {k.lower(): v for k, v in r.headers.items()},
                "body_snippet": (r.text or "")[:60_000],
            }
        except Exception:
            continue
    return {
        "subdomain": host, "is_live": False, "scheme": None,
        "status_code": None, "title": None, "headers": {}, "body_snippet": "",
    }


async def probe_hosts(hosts: list[str], concurrency: int, timeout: int) -> list[dict]:
    sem = asyncio.Semaphore(concurrency)
    limits = httpx.Limits(max_connections=concurrency)
    headers = {"User-Agent": "AMZ-Recon/1.0 (+authorized-testing-only)"}
    results: list[dict] = []

    async with httpx.AsyncClient(
        follow_redirects=True, verify=False, limits=limits, headers=headers
    ) as client:
        async def worker(h: str):
            async with sem:
                results.append(await _probe_one(h, client, timeout))

        await asyncio.gather(*(worker(h) for h in hosts))

    results.sort(key=lambda x: (not x["is_live"], x["subdomain"]))
    return results
