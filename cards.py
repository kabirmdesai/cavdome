"""Turn article text into debate cards: pick the passage, tag it, underline and highlight it.
Pure heuristics, no AI."""
import datetime
import math
import re
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

from extract import extract
from net import FetchError, fetch
from search import search

STOP = set("""a about above after again against all am an and any are as at be because been before being below
between both but by can could did do does doing down during each few for from further had has have having he her
here hers herself him himself his how i if in into is it its itself just me more most my myself no nor not now of
off on once only or other our ours ourselves out over own same she should so some such than that the their theirs
them themselves then there these they this those through to too under until up very was we were what when where
which while who whom why will with would you your yours yourself yourselves also may might must shall s t can't
won't don't isn't aren't wasn't weren't hasn't haven't doesn't didn't new one two say says said get got make made
like many much well even still yet via per according way ways thing things people year years time times use used""".split())

WARRANT = re.compile(r"\b(because|since|therefore|thus|hence|as a result|leads? to|led to|causes?|caused|means|"
                     r"drives?|due to|results? in|so that|which (?:would|will|could)|consequently|risk|threat|"
                     r"increase[sd]?|decrease[sd]?|reduce[sd]?|undermine[sd]?|prevent[sed]*|ensure[sd]?|"
                     r"critical|key|essential|necessary|only way)\b", re.I)
EVIDENCE = re.compile(r"(\d[\d,.]*\s?(%|percent|million|billion|trillion)|\$\d|\b(study|studies|research|data|"
                      r"analysis|report|survey|found|finds|estimate[sd]?|evidence|according|projected|record)\b)", re.I)
REFUTE = re.compile(r"\b(however|but|no evidence|little evidence|not|n't|never|overstated|overblown|exaggerat\w*|"
                    r"myth|false|misleading|unlikely|fails?|failed|flawed|wrong|actually|in fact|contrary|"
                    r"despite|doubt\w*|unfounded|debunk\w*|outweigh\w*|minimal|negligible)\b", re.I)
QUALITY = {
    ".gov": 6, ".edu": 6, ".mil": 5, ".int": 5,
    "brookings.edu": 4, "rand.org": 8, "cfr.org": 8, "csis.org": 8, "carnegieendowment.org": 8,
    "foreignaffairs.com": 9, "foreignpolicy.com": 7, "nature.com": 9, "science.org": 9, "nber.org": 9,
    "reuters.com": 7, "apnews.com": 7, "bloomberg.com": 7, "ft.com": 7, "economist.com": 8,
    "nytimes.com": 7, "washingtonpost.com": 7, "wsj.com": 7, "theatlantic.com": 6, "politico.com": 5,
    "axios.com": 5, "vox.com": 4, "pewresearch.org": 8, "iea.org": 8, "iaea.org": 8, "who.int": 8,
    "un.org": 7, "imf.org": 8, "worldbank.org": 8, "piie.com": 8, "aei.org": 6, "cato.org": 6,
    "heritage.org": 5, "americanprogress.org": 5, "belfercenter.org": 8, "hbr.org": 6, "lawfaremedia.org": 8,
    "warontherocks.com": 8, "thebulletin.org": 7, "scientificamerican.com": 6, "technologyreview.com": 6,
    "wikipedia.org": -6, "reddit.com": -8, "medium.com": -2, "quora.com": -10,
}


def stem(w):
    w = w.lower()
    for suf in ("ational", "ations", "ation", "ments", "ment", "ings", "ing", "edly", "ies", "ied", "ers", "er", "ed", "es", "ly", "s"):
        if w.endswith(suf) and len(w) - len(suf) >= 3:
            return w[: -len(suf)]
    return w


def words(text):
    return re.findall(r"[A-Za-z][A-Za-z'\-]*|\d[\d,.]*%?", text)


def keyset(text):
    return [stem(w) for w in words(text) if w.lower() not in STOP and len(w) > 2]


def sentences(par):
    parts = re.split(r'(?<=[.!?])["”’)]?\s+(?=["“(]?[A-Z0-9])', par)
    out, buf = [], ""
    for s in parts:
        buf = (buf + " " + s).strip() if buf else s
        # rejoin splits after common abbreviations
        if re.search(r"\b(Mr|Mrs|Ms|Dr|Prof|Sen|Rep|Gov|St|U\.S|Inc|Corp|vs|No|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\.$", buf):
            continue
        out.append(buf)
        buf = ""
    if buf:
        out.append(buf)
    return [s.strip() for s in out if s.strip()]


def source_score(url, meta):
    host = re.sub(r"^https?://(www\.)?", "", url.lower()).split("/")[0]
    q = 0
    for k, v in QUALITY.items():
        if host.endswith(k):
            q = max(q, v) if v > 0 else v
            if v < 0:
                break
    if meta.get("author"):
        q += 3
    d = meta.get("date_obj")
    if d:
        age = (datetime.date.today() - d).days / 365.0
        q += 5 if age < 1 else 3 if age < 2 else 1 if age < 4 else -1
    return q


def best_window(paragraphs, claim_keys, mode="support", min_words=60, max_words=240):
    """Slide over consecutive sentences and return (score, text)."""
    sents = []
    for pi, par in enumerate(paragraphs[:120]):
        for s in sentences(par):
            sents.append((pi, s))
    if not sents:
        return 0, ""
    ck = set(claim_keys)
    bigr = set(zip(claim_keys, claim_keys[1:]))
    sk = [keyset(s) for _, s in sents]
    best = (-1e9, 0, 0)
    for i in range(len(sents)):
        wc = 0
        for j in range(i, min(len(sents), i + 14)):
            wc += len(sents[j][1].split())
            if wc > max_words:
                break
            if wc < min_words:
                continue
            ks = [k for idx in range(i, j + 1) for k in sk[idx]]
            if not ks:
                continue
            hits = [k for k in ks if k in ck]
            cover = len(set(hits)) / max(1, len(ck))
            dens = len(hits) / len(ks)
            bh = sum(1 for a, b in zip(ks, ks[1:]) if (a, b) in bigr)
            txt = " ".join(s for _, s in sents[i:j + 1])
            sc = cover * 10 + dens * 12 + bh * 1.5
            sc += min(len(WARRANT.findall(txt)), 4) * 0.8 + min(len(EVIDENCE.findall(txt)), 4) * 0.9
            if mode == "block":
                sc += min(len(REFUTE.findall(txt)), 6) * 1.1
            if "?" in txt or re.search(r"(^|\s)Q:", txt):
                sc -= 4
            if re.match(r"(It|This|That|They|These|He|She|But|And|Also)\b", sents[i][1]):
                sc -= 1.2
            sc -= abs(wc - 140) / 140.0
            if sc > best[0]:
                best = (sc, i, j)
    sc, i, j = best
    if sc <= -1e8:
        # very short article: use everything
        return 0.1, "\n".join(paragraphs)[:1800]
    out, last_p = [], None
    for pi, s in sents[i:j + 1]:
        if last_p is not None and pi != last_p:
            out.append("\n")
        elif out:
            out.append(" ")
        out.append(s)
        last_p = pi
    return sc, "".join(out).strip()


def mark(text, claim_keys, mode="support"):
    """Return underline and highlight character ranges."""
    ck = set(claim_keys)
    clauses = []
    for m in re.finditer(r"[^,;:()\n—–]+[,;:()\n—–]?", text):
        a, b = m.start(), m.end()
        seg = text[a:b]
        if not seg.strip():
            continue
        ks = keyset(seg)
        hit = sum(1 for k in ks if k in ck)
        sc = hit * 2 + min(len(WARRANT.findall(seg)), 2) + min(len(EVIDENCE.findall(seg)), 2) * 1.2
        if "?" in seg:
            sc -= 5
        if mode == "block":
            sc += min(len(REFUTE.findall(seg)), 2) * 1.3
        clauses.append([a, b, sc, len(seg.split()), hit])
    total = sum(c[3] for c in clauses) or 1
    under, used = [], 0
    for c in sorted(clauses, key=lambda c: -c[2]):
        if c[2] <= 0:
            break
        if used / total > 0.5 and c[4] < 2:
            break
        under.append(c)
        used += c[3]
    if not under and clauses:
        under = sorted(clauses, key=lambda c: -c[3])[:1]
    under.sort()
    # trim leading/trailing spaces and punctuation from ranges
    def trim(a, b):
        while a < b and text[a] in " \n,;:":
            a += 1
        while b > a and text[b - 1] in " \n,;:(":
            b -= 1
        return a, b
    ul = [list(trim(a, b)) for a, b, *_ in under]

    hl, hl_words = [], 0
    for a, b in ul:
        seg = text[a:b]
        toks = [(m.start() + a, m.end() + a, m.group()) for m in re.finditer(r"\S+", seg)]
        flags = []
        for s, e, w in toks:
            core = re.sub(r"[^\w%$'-]", "", w)
            k = stem(core)
            key = (k in ck and core.lower() not in STOP and len(core) > 3) or bool(re.match(r"[\d$]", core))
            if mode == "block" and REFUTE.fullmatch(core.lower() or "-"):
                key = True
            flags.append(key)
        # grow each key word into a short readable run
        on = [False] * len(toks)
        for i, f in enumerate(flags):
            if f:
                on[i] = True
                if i + 1 < len(toks) and toks[i + 1][2].lower().strip(",.") not in STOP:
                    on[i + 1] = True
                if i > 0 and toks[i - 1][2].lower() in ("not", "no", "never", "only", "most", "more", "less"):
                    on[i - 1] = True
        i = 0
        while i < len(toks):
            if on[i]:
                j = i
                while j + 1 < len(toks) and on[j + 1]:
                    j += 1
                s, e = toks[i][0], toks[j][1]
                while e > s and text[e - 1] in ",.;:)\"”’":
                    e -= 1
                hl.append([s, e])
                hl_words += j - i + 1
                i = j + 1
            else:
                i += 1
    return ul, hl


def make_tag(claim, text, mode):
    if claim and mode == "support":
        t = claim.strip().rstrip(".")
        return t[0].upper() + t[1:] + "."
    # pick the most informative sentence of the passage
    best, bs = "", -1
    for s in sentences(text.replace("\n", " ")):
        sc = len(WARRANT.findall(s)) + len(EVIDENCE.findall(s)) + (len(REFUTE.findall(s)) if mode == "block" else 0)
        sc -= abs(len(s.split()) - 18) / 10
        if sc > bs:
            best, bs = s, sc
    w = best.split()
    if len(w) > 24:
        best = " ".join(w[:24]).rstrip(",;:") + "…"
    return best


def last_name(author, site):
    if not author:
        return site
    first = re.split(r",| and | & ", author)[0].strip()
    parts = [p for p in first.split() if p.lower() not in ("jr.", "jr", "sr.", "iii", "ii", "phd", "dr.")]
    name = parts[-1] if parts else first
    n_auth = len(re.split(r",| and | & ", author))
    return name + (" et al." if n_auth > 2 else "")


def build_card(meta, text, claim, claim_keys, mode, score):
    ul, hl = mark(text, claim_keys, mode)
    return {
        "tag": make_tag(claim, text, mode),
        "cite": {
            "last": last_name(meta.get("author", ""), meta.get("site", "")),
            "year": meta.get("year", ""),
            "author": meta.get("author", ""),
            "quals": meta.get("quals", ""),
            "title": meta.get("title", ""),
            "pub": meta.get("site", ""),
            "date": meta.get("date", ""),
            "url": meta.get("url", ""),
            "accessed": datetime.date.today().strftime("%B ") + str(datetime.date.today().day) + datetime.date.today().strftime(", %Y"),
        },
        "body": text,
        "underline": ul,
        "highlight": hl,
        "score": round(score, 2),
    }


def _article(url):
    final, page = fetch(url, timeout=9)
    meta = extract(final, page)
    if sum(len(p.split()) for p in meta["paragraphs"]) < 80:
        raise FetchError("no readable article text")
    return meta


def queries_for(claim, mode, angle=""):
    keys = [w for w in words(claim) if w.lower() not in STOP]
    core = " ".join(keys[:8]) or claim
    if mode == "block":
        a = (angle or "").lower()
        qs = []
        if "link" in a:
            qs.append(core + " no link")
        if "unique" in a:
            qs.append(core + " already happening")
        if "turn" in a:
            qs.append(core + " actually helps")
        if "impact" in a:
            qs.append(core + " overstated")
        return qs + [core + " myth", core + " overstated", "no evidence " + core, "why " + core + " is wrong", core + " criticism"]
    return [claim, core + " study", core + " evidence analysis", " ".join(keys[:4])]


def find_cards(claim, mode="support", recent=True, n=3, angle="", budget=28):
    """Search the web and return up to n cards. Always tries to return something."""
    t0 = time.time()
    claim = re.sub(r"\s+", " ", claim or "").strip()
    claim_keys = keyset(claim)
    seen, results, provider, log = set(), [], None, []
    for q in queries_for(claim, mode, angle):
        for rec in ((True, False) if recent else (False,)):
            if len(results) >= 12 or time.time() - t0 > budget * 0.4:
                break
            prov, res = search(q, rec)
            provider = provider or prov
            log.append({"query": q, "recent": rec, "provider": prov, "count": len(res)})
            for r in res:
                u = r["url"].split("#")[0]
                if u not in seen:
                    seen.add(u)
                    results.append(r)
        if len(results) >= 12:
            break
    cards = []
    with ThreadPoolExecutor(max_workers=8) as ex:
        futs = {ex.submit(_article, r["url"]): r for r in results[:14]}
        try:
            done = list(as_completed(futs, timeout=max(5, budget - (time.time() - t0))))
        except Exception:
            done = [f for f in futs if f.done()]
        for f in done:
            r = futs[f]
            try:
                meta = f.result()
            except Exception as e:
                log.append({"skip": r["url"], "why": str(e)[:80]})
                continue
            sc, text = best_window(meta["paragraphs"], claim_keys, mode)
            if not text:
                continue
            total = sc + source_score(meta["url"], meta)
            cards.append((total, meta, text, sc))
    cards.sort(key=lambda c: -c[0])
    out, hosts = [], set()
    for total, meta, text, sc in cards:
        host = re.sub(r"^https?://(www\.)?", "", meta["url"]).split("/")[0]
        if host in hosts:
            continue
        hosts.add(host)
        out.append(build_card(meta, text, claim, claim_keys, mode, total))
        if len(out) >= n:
            break
    return {"cards": out, "provider": provider, "searched": len(results), "log": log[:30],
            "seconds": round(time.time() - t0, 1)}


def cut_url(url, claim=""):
    meta = _article(url)
    keys = keyset(claim) if claim else top_keys(meta)
    sc, text = best_window(meta["paragraphs"], keys, "support")
    card = build_card(meta, text, claim, keys, "support", sc)
    card["fulltext"] = "\n\n".join(meta["paragraphs"])
    return card


def top_keys(meta):
    from collections import Counter
    c = Counter(keyset(" ".join(meta["paragraphs"])))
    title = keyset(meta.get("title", ""))
    for k in title:
        c[k] += 5
    return [k for k, _ in c.most_common(10)]


def cut_text(text, claim="", cite=None):
    paras = [p.strip() for p in re.split(r"\n\s*\n|\n", text or "") if p.strip()]
    meta = {"paragraphs": paras, "title": (cite or {}).get("title", "")}
    keys = keyset(claim) if claim else top_keys(meta)
    if sum(len(p.split()) for p in paras) <= 260:
        body = "\n".join(paras)
        sc = 1
    else:
        sc, body = best_window(paras, keys, "support")
    ul, hl = mark(body, keys)
    return {"tag": make_tag(claim, body, "support"), "body": body, "underline": ul, "highlight": hl}
