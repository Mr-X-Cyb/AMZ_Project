"""Non-destructive exposed-path checks. HTTP GET only. No brute force, no fuzzing.

We check a SMALL, fixed list of well-known sensitive paths and report which ones
respond in a way that suggests exposure. We never send payloads, never attempt
auth, never write. This is equivalent to manually visiting a handful of URLs.
"""
import asyncio

import httpx

# (path, human_label) — deliberately short and well-known.
_PATHS = [
    ("/.git/config", ".git repository"),
    ("/.env", ".env file"),
    ("/admin", "Admin panel"),
    ("/administrator", "Admin panel (Joomla)"),
    ("/wp-admin/", "WordPress admin"),
    ("/wp-login.php", "WordPress login"),
    ("/phpmyadmin/", "phpMyAdmin"),
    ("/.svn/entries", ".svn repository"),
    ("/.DS_Store", ".DS_Store file"),
    ("/config.php.bak", "Config backup"),
    ("/server-status", "Apache server-status"),
    ("/actuator/health", "Spring Boot actuator"),
    ("/swagger-ui/", "Swagger UI"),
    ("/api/docs", "API docs"),
    ("/robots.txt", "robots.txt"),
    ("/.well-known/security.txt", "security.txt"),
]

# Signals that a path is actually exposed vs. a soft-404.
_SENSITIVE_HINTS = {
    "/.git/config": ("[core]", "repositoryformatversion"),
    "/.env": ("=", "APP_", "DB_", "SECRET"),
    "/.svn/entries": ("dir", "\n"),
}


def _looks_exposed(path: str, status: int, body: str) -> bool:
    if status in (401, 403):
        # Present but protected — still worth flagging as "exists".
        return True
    if status != 200:
        return False
    hints = _SENSITIVE_HINTS.get(path)
    if hints:
        return any(h in body for h in hints)
    # For panels/docs a 200 is meaningful on its own.
    return True


async def _check(base: str, path: str, label: str, client: httpx.AsyncClient, timeout: int):
    try:
        r = await client.get(base + path, timeout=timeout)
        body = (r.text or "")[:4000]
        if _looks_exposed(path, r.status_code, body):
            return {"path": path, "label": label, "status": r.status_code}
    except Exception:
        return None
    return None


async def scan_paths(base_url: str, concurrency: int, timeout: int) -> list[dict]:
    sem = asyncio.Semaphore(min(concurrency, 8))
    headers = {"User-Agent": "AMZ-Recon/1.0 (+authorized-testing-only)"}
    findings: list[dict] = []

    async with httpx.AsyncClient(follow_redirects=True, verify=False, headers=headers) as client:
        async def worker(path, label):
            async with sem:
                res = await _check(base_url, path, label, client, timeout)
                if res:
                    findings.append(res)

        await asyncio.gather(*(worker(p, l) for p, l in _PATHS))

    findings.sort(key=lambda x: x["path"])
    return findings
