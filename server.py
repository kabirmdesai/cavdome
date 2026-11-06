"""CAVDOME web server. Python 3.9+ standard library only.

Run:  python3 server.py         (then open http://localhost:8000)
Env:  PORT, SERPER_API_KEY (Google results), GOOGLE_CSE_KEY + GOOGLE_CSE_CX,
      OPENCASELIST_USERNAME + OPENCASELIST_PASSWORD, CA_BUNDLE
"""
import json
import mimetypes
import os
import re
import sys
import threading
import time
import traceback
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import cards  # noqa: E402
import caselist  # noqa: E402
import search  # noqa: E402
from net import FetchError  # noqa: E402

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static")
_hits = {}
_hl = threading.Lock()


def limited(ip, cost=1, per_min=40):
    now = time.time()
    with _hl:
        q = [t for t in _hits.get(ip, []) if now - t < 60]
        if len(q) + cost > per_min:
            _hits[ip] = q
            return True
        q += [now] * cost
        _hits[ip] = q
    return False


class H(BaseHTTPRequestHandler):
    server_version = "CAVDOME/1.0"

    def log_message(self, fmt, *args):
        sys.stderr.write("%s %s\n" % (self.address_string(), fmt % args))

    def _json(self, code, obj):
        b = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(b)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(b)

    def _body(self):
        n = int(self.headers.get("Content-Length") or 0)
        if n > 2_000_000:
            raise ValueError("request too large")
        raw = self.rfile.read(n) if n else b"{}"
        return json.loads(raw or b"{}")

    def _ip(self):
        return (self.headers.get("X-Forwarded-For") or self.client_address[0]).split(",")[0].strip()

    def do_GET(self):
        path = self.path.split("?")[0]
        if path == "/api/health":
            return self._json(200, {"ok": True, "search": search.providers(), "caselist": caselist.configured()})
        if path == "/api/caselist":
            from urllib.parse import parse_qs, urlparse
            q = parse_qs(urlparse(self.path).query)
            team = (q.get("team") or [""])[0].strip()
            event = (q.get("event") or ["hspolicy"])[0]
            if not team:
                return self._json(400, {"error": "Type a team name."})
            if not caselist.configured():
                return self._json(200, {"error": "not_configured"})
            try:
                return self._json(200, caselist.lookup(team, event))
            except caselist.CaselistError as e:
                return self._json(200, {"error": str(e)})
        return self._static(path)

    def do_POST(self):
        path = self.path.split("?")[0]
        if limited(self._ip(), 3 if path == "/api/find" else 1):
            return self._json(429, {"error": "Too many requests. Wait a minute and try again."})
        try:
            d = self._body()
        except Exception:
            return self._json(400, {"error": "Bad request."})
        try:
            if path == "/api/find":
                claim = str(d.get("claim", "")).strip()[:400]
                if len(claim) < 4:
                    return self._json(400, {"error": "Type a claim first."})
                mode = "block" if d.get("mode") == "block" else "support"
                r = cards.find_cards(claim, mode=mode, recent=bool(d.get("recent", True)),
                                     n=max(1, min(5, int(d.get("n", 3)))), angle=str(d.get("angle", ""))[:40])
                if not r["cards"]:
                    r["error"] = ("Search ran but no article could be read. Try different wording."
                                  if r["searched"] else "The search engines didn't answer. Try again in a minute.")
                return self._json(200, r)
            if path == "/api/cut":
                url = str(d.get("url", "")).strip()
                claim = str(d.get("claim", "")).strip()[:400]
                if url:
                    if not re.match(r"^https?://", url):
                        url = "https://" + url
                    return self._json(200, cards.cut_url(url, claim))
                text = str(d.get("text", ""))[:200_000]
                if len(text.split()) < 15:
                    return self._json(400, {"error": "Paste a link or at least a paragraph of text."})
                return self._json(200, cards.cut_text(text, claim))
            if path == "/api/search":
                q = str(d.get("q", "")).strip()[:300]
                prov, res = search.search(q, bool(d.get("recent")))
                return self._json(200, {"provider": prov, "results": res[:15]})
        except FetchError as e:
            msg = str(e)
            if msg.startswith("HTTP 403") or msg.startswith("HTTP 401"):
                msg = "That site blocks automated readers. Copy the article text and paste it instead."
            elif msg.startswith("HTTP 404"):
                msg = "That page doesn't exist. Check the link."
            elif "readable" in msg:
                msg = "Couldn't find article text on that page. Paste the text instead."
            else:
                msg = "Couldn't open that page (%s)." % msg
            return self._json(200, {"error": msg})
        except Exception:
            traceback.print_exc()
            return self._json(500, {"error": "Something broke on the server. Try again."})
        return self._json(404, {"error": "Not found."})

    def _static(self, path):
        if path in ("", "/"):
            path = "/index.html"
        full = os.path.normpath(os.path.join(ROOT, path.lstrip("/")))
        if not full.startswith(ROOT) or not os.path.isfile(full):
            full = os.path.join(ROOT, "index.html")
        ctype = mimetypes.guess_type(full)[0] or "application/octet-stream"
        with open(full, "rb") as f:
            b = f.read()
        self.send_response(200)
        self.send_header("Content-Type", ctype + ("; charset=utf-8" if ctype.startswith("text/") or ctype.endswith("javascript") else ""))
        self.send_header("Content-Length", str(len(b)))
        self.send_header("Cache-Control", "no-cache")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(b)


def main():
    port = int(os.environ.get("PORT", "8000"))
    host = os.environ.get("HOST", "0.0.0.0")
    srv = ThreadingHTTPServer((host, port), H)
    print("CAVDOME running on http://localhost:%d" % port, flush=True)
    srv.serve_forever()


if __name__ == "__main__":
    main()
