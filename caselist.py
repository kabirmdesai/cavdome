"""openCaselist lookups. openCaselist requires a Tabroom login, so this needs
OPENCASELIST_USERNAME and OPENCASELIST_PASSWORD set on the server."""
import datetime
import http.cookiejar
import json
import os
import re
import threading
import urllib.parse
import urllib.request

from net import CTX, UA

API = "https://api.opencaselist.com/v1"
_jar = http.cookiejar.CookieJar()
_opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(_jar),
                                      urllib.request.HTTPSHandler(context=CTX))
_lock = threading.Lock()
_logged_in = False


class CaselistError(Exception):
    pass


def configured():
    return bool(os.environ.get("OPENCASELIST_USERNAME") and os.environ.get("OPENCASELIST_PASSWORD"))


def _call(path, body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(API + path, data=data, headers={
        "User-Agent": UA, "Accept": "application/json", "Content-Type": "application/json"})
    try:
        with _opener.open(req, timeout=15) as r:
            t = r.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        raise CaselistError("openCaselist answered HTTP %s" % e.code)
    except Exception as e:
        raise CaselistError("couldn't reach openCaselist (%s)" % str(e)[:80])
    try:
        return json.loads(t) if t.strip() else {}
    except ValueError:
        return {}


def _login():
    global _logged_in
    with _lock:
        if _logged_in:
            return
        if not configured():
            raise CaselistError("not_configured")
        _call("/login", {"username": os.environ["OPENCASELIST_USERNAME"],
                         "password": os.environ["OPENCASELIST_PASSWORD"], "remember": True})
        _logged_in = True


def _get(path):
    global _logged_in
    _login()
    try:
        return _call(path)
    except CaselistError as e:
        if "401" in str(e):
            _logged_in = False
            _login()
            return _call(path)
        raise


def _norm(s):
    return re.sub(r"[^a-z0-9]", "", (s or "").lower())


def _pick(d, *keys):
    for k in keys:
        if isinstance(d, dict) and d.get(k) not in (None, ""):
            return d[k]
    return ""


def lookup(team, event="hspolicy"):
    lists = _get("/caselists")
    if not isinstance(lists, list):
        raise CaselistError("unexpected reply from openCaselist")
    mine = [c for c in lists if str(_pick(c, "name")).startswith(event)]
    if not mine:
        raise CaselistError("no caselist found for " + event)
    mine.sort(key=lambda c: str(_pick(c, "year", "name")), reverse=True)
    cl = mine[0]
    cname = _pick(cl, "name")

    schools = _get("/caselists/%s/schools" % urllib.parse.quote(cname))
    words = team.split()
    code = words[-1] if len(words) > 1 and len(words[-1]) <= 4 else ""
    school_q = _norm(" ".join(words[:-1]) if code else team)
    best = None
    for s in schools if isinstance(schools, list) else []:
        n = _norm(_pick(s, "display_name", "name"))
        if school_q and (school_q in n or n in school_q):
            best = s
            break
    if not best:
        return {"found": False, "caselist": cname, "notes": "No school matching “%s” on %s." % (team, cname)}
    sname = _pick(best, "name")
    teams = _get("/caselists/%s/schools/%s/teams" % (urllib.parse.quote(cname), urllib.parse.quote(sname)))
    tm = None
    for t in teams if isinstance(teams, list) else []:
        if not code or _norm(_pick(t, "name", "code")).endswith(_norm(code)) or _norm(code) in _norm(_pick(t, "display_name")):
            tm = t
            break
    if not tm:
        return {"found": False, "caselist": cname, "school": _pick(best, "display_name", "name"),
                "notes": "School found but no team code matching “%s”." % code}
    tname = _pick(tm, "name")
    base = "/caselists/%s/schools/%s/teams/%s" % tuple(urllib.parse.quote(x) for x in (cname, sname, tname))
    rounds = _get(base + "/rounds")
    cites = []
    try:
        cites = _get(base + "/cites")
    except CaselistError:
        pass
    rlist = []
    for r in rounds if isinstance(rounds, list) else []:
        rlist.append({
            "tournament": _pick(r, "tournament"), "round": str(_pick(r, "round")),
            "side": {"A": "Aff", "N": "Neg"}.get(str(_pick(r, "side")), str(_pick(r, "side"))),
            "opponent": _pick(r, "opponent"), "judge": _pick(r, "judge"),
            "report": re.sub(r"\s+", " ", str(_pick(r, "report")))[:300],
        })
    clist = [{"title": _pick(c, "title"), "text": re.sub(r"\s+", " ", str(_pick(c, "cites")))[:600]}
             for c in (cites if isinstance(cites, list) else [])][:30]
    return {"found": True, "caselist": cname, "school": _pick(best, "display_name", "name"),
            "team": _pick(tm, "display_name", "name"), "rounds": rlist[:40], "cites": clist,
            "url": "https://opencaselist.com/%s/%s/%s" % (cname, sname, tname)}
