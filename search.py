"""Web search. Google (via Serper or Programmable Search) when a key is set,
otherwise DuckDuckGo with Bing as a fallback. No key is needed for the defaults."""
import base64
import html
import json
import os
import re
import urllib.parse

from net import FetchError, fetch, form

SKIP_HOSTS = ("youtube.com", "youtu.be", "facebook.com", "instagram.com", "tiktok.com",
              "twitter.com", "x.com", "pinterest.", "quora.com", "amazon.", "linkedin.com",
              "duckduckgo.com", "bing.com", "google.com", "msn.com/en-us/video")


def _clean(s):
    return html.unescape(re.sub(r"<[^>]+>", "", s or "")).strip()


def _ok(url):
    u = url.lower()
    if not u.startswith("http"):
        return False
    if u.split("?")[0].endswith((".pdf", ".doc", ".docx", ".ppt", ".pptx", ".xls", ".xlsx", ".zip")):
        return False
    return not any(h in u for h in SKIP_HOSTS)


def providers():
    p = []
    if os.environ.get("SERPER_API_KEY"):
        p.append("google")
    elif os.environ.get("GOOGLE_CSE_KEY") and os.environ.get("GOOGLE_CSE_CX"):
        p.append("google")
    p += ["duckduckgo", "bing"]
    return p


def google(q, recent):
    key = os.environ.get("SERPER_API_KEY")
    if key:
        body = {"q": q, "num": 10, "gl": "us", "hl": "en"}
        if recent:
            body["tbs"] = "qdr:y"
        _, t = fetch("https://google.serper.dev/search", data=json.dumps(body).encode(),
                     headers={"X-API-KEY": key, "Content-Type": "application/json"}, ttl=900)
        d = json.loads(t)
        return [{"url": r.get("link", ""), "title": r.get("title", ""), "snippet": r.get("snippet", ""),
                 "date": r.get("date", "")} for r in d.get("organic", [])]
    k, cx = os.environ.get("GOOGLE_CSE_KEY"), os.environ.get("GOOGLE_CSE_CX")
    if k and cx:
        params = {"key": k, "cx": cx, "q": q, "num": 10}
        if recent:
            params["dateRestrict"] = "y1"
        _, t = fetch("https://www.googleapis.com/customsearch/v1?" + urllib.parse.urlencode(params), ttl=900)
        d = json.loads(t)
        return [{"url": i.get("link", ""), "title": i.get("title", ""), "snippet": i.get("snippet", "")}
                for i in d.get("items", [])]
    return []


def duckduckgo(q, recent):
    data = {"q": q, "kl": "us-en"}
    if recent:
        data["df"] = "y"
    _, t = fetch("https://html.duckduckgo.com/html/", data=form(data), ttl=900,
                 headers={"Content-Type": "application/x-www-form-urlencoded", "Referer": "https://html.duckduckgo.com/"})
    out = []
    for block in re.split(r'<div class="result results_links', t)[1:]:
        if "result--ad" in block[:200] or "badge--ad" in block:
            continue
        m = re.search(r'class="result__a" href="([^"]+)"[^>]*>(.*?)</a>', block, re.S)
        if not m:
            continue
        href = html.unescape(m.group(1))
        if "uddg=" in href:
            href = urllib.parse.unquote(urllib.parse.parse_qs(urllib.parse.urlparse(href).query).get("uddg", [""])[0])
        if href.startswith("//"):
            href = "https:" + href
        sn = re.search(r'class="result__snippet"[^>]*>(.*?)</a>', block, re.S)
        out.append({"url": href, "title": _clean(m.group(2)), "snippet": _clean(sn.group(1) if sn else "")})
    return out


def _bing_url(href):
    href = html.unescape(href)
    if "bing.com/ck/a" in href:
        u = urllib.parse.parse_qs(urllib.parse.urlparse(href).query).get("u", [""])[0]
        if u.startswith("a1"):
            u = u[2:]
            try:
                return base64.urlsafe_b64decode(u + "=" * (-len(u) % 4)).decode("utf-8", "replace")
            except Exception:
                return ""
    return href


def bing(q, recent):
    params = {"q": q, "setlang": "en", "cc": "US"}
    if recent:
        params["filters"] = 'ex1:"ez5"'
    _, t = fetch("https://www.bing.com/search?" + urllib.parse.urlencode(params), ttl=900)
    out = []
    for block in t.split('<li class="b_algo"')[1:]:
        m = re.search(r'<h2[^>]*>\s*<a[^>]+href="([^"]+)"[^>]*>(.*?)</a>', block, re.S)
        if not m:
            continue
        sn = re.search(r'<p[^>]*>(.*?)</p>', block, re.S)
        out.append({"url": _bing_url(m.group(1)), "title": _clean(m.group(2)), "snippet": _clean(sn.group(1) if sn else "")})
    return out


def search(q, recent=False):
    """Return (provider, results). Tries each provider until one returns results."""
    errors = []
    for name, fn in (("google", google), ("duckduckgo", duckduckgo), ("bing", bing)):
        if name not in providers():
            continue
        try:
            res = [r for r in fn(q, recent) if _ok(r["url"])]
        except (FetchError, ValueError) as e:
            errors.append("%s: %s" % (name, e))
            continue
        if res:
            seen, uniq = set(), []
            for r in res:
                k = r["url"].split("#")[0]
                if k not in seen:
                    seen.add(k)
                    uniq.append(r)
            return name, uniq
    return None, []
