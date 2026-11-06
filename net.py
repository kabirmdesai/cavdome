"""HTTP fetching with TLS setup, decompression, size limits and a small cache."""
import gzip
import os
import ssl
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
import zlib

UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/124.0 Safari/537.36")
MAX_BYTES = 4_000_000


def _ssl_context():
    cafile = os.environ.get("CA_BUNDLE")
    if cafile and os.path.exists(cafile):
        return ssl.create_default_context(cafile=cafile)
    try:
        import certifi  # optional
        return ssl.create_default_context(cafile=certifi.where())
    except Exception:
        return ssl.create_default_context()


CTX = _ssl_context()
_cache = {}
_lock = threading.Lock()


class FetchError(Exception):
    pass


def fetch(url, data=None, headers=None, timeout=12, ttl=1800, want_html=True):
    """Return (final_url, text). Raises FetchError."""
    key = (url, data)
    now = time.time()
    with _lock:
        hit = _cache.get(key)
        if hit and now - hit[0] < ttl:
            return hit[1]
    h = {
        "User-Agent": UA,
        "Accept": "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate",
    }
    if headers:
        h.update(headers)
    req = urllib.request.Request(url, data=data, headers=h)
    try:
        with urllib.request.urlopen(req, timeout=timeout, context=CTX) as r:
            ctype = r.headers.get("Content-Type", "")
            if want_html and ctype and not any(t in ctype for t in ("html", "xml", "text", "json")):
                raise FetchError("not a web page (%s)" % ctype.split(";")[0])
            raw = r.read(MAX_BYTES + 1)
            enc = (r.headers.get("Content-Encoding") or "").lower()
            final = r.geturl()
            charset = r.headers.get_content_charset() or "utf-8"
    except urllib.error.HTTPError as e:
        raise FetchError("HTTP %s" % e.code)
    except FetchError:
        raise
    except Exception as e:  # timeouts, DNS, TLS
        raise FetchError(str(e)[:120])
    if enc == "gzip":
        try:
            raw = gzip.decompress(raw)
        except Exception:
            pass
    elif enc == "deflate":
        try:
            raw = zlib.decompress(raw)
        except Exception:
            try:
                raw = zlib.decompress(raw, -zlib.MAX_WBITS)
            except Exception:
                pass
    try:
        text = raw.decode(charset, "replace")
    except LookupError:
        text = raw.decode("utf-8", "replace")
    out = (final, text)
    with _lock:
        if len(_cache) > 400:
            _cache.clear()
        _cache[key] = (now, out)
    return out


def form(d):
    return urllib.parse.urlencode(d).encode()
