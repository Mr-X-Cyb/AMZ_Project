"""Passive subdomain enumeration.

Strategy (explained in README):
  1. If a `subfinder` binary is present on PATH, we shell out to it (fast, broad).
  2. Otherwise we fall back to PUBLIC, passive data sources over HTTPS:
       - crt.sh  (Certificate Transparency logs)
       - hackertarget hostsearch (free tier, best-effort)
  No active brute forcing or wordlist DNS resolution is performed.
"""
import asyncio
import json
import re
import shutil
import subprocess

import httpx

_DOMAIN_RE = re.compile(r"^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$")


def _clean(domain: str) -> str:
    domain = domain.strip().lower()
    domain = re.sub(r"^https?://", "", domain)
    domain = domain.split("/")[0].split(":")[0]
    return domain


async def _from_crtsh(domain: str, client: httpx.AsyncClient) -> set[str]:
    out: set[str] = set()
    try:
        r = await client.get(
            "https://crt.sh/", params={"q": f"%.{domain}", "output": "json"}, timeout=20
        )
        if r.status_code == 200 and r.text.strip():
            data = json.loads(r.text)
            for entry in data:
                for name in str(entry.get("name_value", "")).splitlines():
                    name = name.strip().lstrip("*.").lower()
                    if name.endswith(domain) and _DOMAIN_RE.match(name):
                        out.add(name)
    except Exception:
        pass
    return out


async def _from_hackertarget(domain: str, client: httpx.AsyncClient) -> set[str]:
    out: set[str] = set()
    try:
        r = await client.get(
            "https://api.hackertarget.com/hostsearch/", params={"q": domain}, timeout=20
        )
        if r.status_code == 200 and "," in r.text and "API count" not in r.text:
            for line in r.text.splitlines():
                host = line.split(",")[0].strip().lower()
                if host.endswith(domain) and _DOMAIN_RE.match(host):
                    out.add(host)
    except Exception:
        pass
    return out


def _from_subfinder(domain: str) -> set[str]:
    out: set[str] = set()
    binary = shutil.which("subfinder")
    if not binary:
        return out
    try:
        proc = subprocess.run(
            [binary, "-silent", "-d", domain],
            capture_output=True, text=True, timeout=120,
        )
        for line in proc.stdout.splitlines():
            host = line.strip().lower()
            if host.endswith(domain) and _DOMAIN_RE.match(host):
                out.add(host)
    except Exception:
        pass
    return out


async def enumerate_subdomains(domain: str, max_hosts: int) -> tuple[list[str], str]:
    """Return (sorted_subdomains, method_used)."""
    domain = _clean(domain)
    found: set[str] = set()

    method = "subfinder"
    found |= _from_subfinder(domain)

    if not found:
        method = "passive-ct (crt.sh + hackertarget)"
        async with httpx.AsyncClient(follow_redirects=True) as client:
            results = await asyncio.gather(
                _from_crtsh(domain, client),
                _from_hackertarget(domain, client),
            )
        for s in results:
            found |= s

    # Always include the apex domain itself.
    found.add(domain)

    ordered = sorted(found)
    return ordered[:max_hosts], method
