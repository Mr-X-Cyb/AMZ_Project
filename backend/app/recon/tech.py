"""Lightweight tech-stack fingerprinting from headers + body. Passive only."""
import re

# (label, header_name, regex-or-None) — header-based signals
_HEADER_SIGNS = [
    ("Nginx", "server", re.compile(r"nginx", re.I)),
    ("Apache", "server", re.compile(r"apache", re.I)),
    ("Microsoft-IIS", "server", re.compile(r"iis", re.I)),
    ("LiteSpeed", "server", re.compile(r"litespeed", re.I)),
    ("Cloudflare", "server", re.compile(r"cloudflare", re.I)),
    ("PHP", "x-powered-by", re.compile(r"php", re.I)),
    ("ASP.NET", "x-powered-by", re.compile(r"asp\.net", re.I)),
    ("Express", "x-powered-by", re.compile(r"express", re.I)),
    ("Varnish", "via", re.compile(r"varnish", re.I)),
    ("AWS", "server", re.compile(r"amazons3|awselb", re.I)),
]

# (label, regex) — body-based signals
_BODY_SIGNS = [
    ("WordPress", re.compile(r"/wp-content/|wp-includes|wordpress", re.I)),
    ("Drupal", re.compile(r"drupal-settings-json|/sites/default/files", re.I)),
    ("Joomla", re.compile(r"/media/jui/|joomla", re.I)),
    ("React", re.compile(r"__reactcontainer|data-reactroot|react\.production", re.I)),
    ("Vue.js", re.compile(r"vue(\.min)?\.js|data-v-[0-9a-f]{8}", re.I)),
    ("Angular", re.compile(r"ng-version|angular\.js", re.I)),
    ("Next.js", re.compile(r"/_next/|__next_data__", re.I)),
    ("Laravel", re.compile(r"laravel_session|csrf-token", re.I)),
    ("Django", re.compile(r"csrfmiddlewaretoken|__admin_media_prefix__", re.I)),
    ("jQuery", re.compile(r"jquery(\.min)?\.js", re.I)),
    ("Bootstrap", re.compile(r"bootstrap(\.min)?\.css", re.I)),
    ("Shopify", re.compile(r"cdn\.shopify\.com|shopify", re.I)),
]


def detect_tech(headers: dict, body: str) -> list[str]:
    found: set[str] = set()
    headers = headers or {}
    body = body or ""

    for label, hname, rx in _HEADER_SIGNS:
        val = headers.get(hname)
        if val and rx.search(val):
            found.add(label)

    # generic X-Powered-By passthrough
    xpb = headers.get("x-powered-by")
    if xpb:
        found.add(xpb.split("/")[0].strip()[:40])

    for label, rx in _BODY_SIGNS:
        if rx.search(body):
            found.add(label)

    return sorted(found)
