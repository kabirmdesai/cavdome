"""Pull the article text and citation details out of a web page (stdlib only)."""
import datetime
import html
import json
import re
import urllib.parse
from html.parser import HTMLParser

VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param",
        "source", "track", "wbr"}
SKIP_TAGS = {"script", "style", "noscript", "nav", "footer", "aside", "form", "svg", "button",
             "select", "iframe", "template", "figcaption", "header"}
BLOCK_TAGS = {"p", "li", "blockquote", "h2", "h3", "h4", "pre", "dd"}
BOILER = re.compile(
    r"(^|[\s_-])(comment|comments|related|newsletter|promo|subscribe|share|social|sidebar|footer|"
    r"breadcrumb|cookie|advert|ad-slot|ads|paywall|recirc|most-popular|trending|signup|modal|byline-bio-short)"
    r"($|[\s_-])", re.I)
JUNK = re.compile(r"(cookie|subscribe|sign up|newsletter|all rights reserved|©|click here|"
                  r"advertisement|javascript|your browser|log in|read more:|follow us)", re.I)


class _P(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.stack = []          # (tag, skipping)
        self.skip = 0
        self.title = ""
        self._in_title = False
        self.meta = {}
        self.ld = []
        self._in_ld = False
        self._ld_buf = []
        self.times = []
        self.blocks = []         # (tag, text)
        self._buf = None
        self._buf_tag = None
        self.byline = []
        self._in_by = 0

    def handle_starttag(self, tag, attrs):
        a = dict((k, v or "") for k, v in attrs)
        if tag == "meta":
            k = (a.get("property") or a.get("name") or a.get("itemprop") or "").lower()
            if k and a.get("content") and k not in self.meta:
                self.meta[k] = a["content"].strip()
            return
        if tag == "time" and a.get("datetime"):
            self.times.append(a["datetime"])
        if tag == "script" and "ld+json" in a.get("type", ""):
            self._in_ld = True
            self._ld_buf = []
        if tag == "title":
            self._in_title = True
        if self._buf is not None and tag in ("br", "div", "span", "td", "li", "section", "sup", "sub"):
            self._buf.append(" ")
        if tag in VOID:
            return
        cls = (a.get("class", "") + " " + a.get("id", "")).strip()
        rel = a.get("rel", "")
        if ("author" in cls.lower() or rel == "author") and self.skip == 0:
            self._in_by += 1
        skipping = tag in SKIP_TAGS or (tag not in ("html", "body", "main", "article") and bool(BOILER.search(cls)))
        if tag == "header" and self.stack and any(s[0] == "article" for s in self.stack):
            skipping = False  # article headers often hold the byline only; keep but they rarely have <p>
        self.stack.append((tag, skipping, "author" in cls.lower() or rel == "author"))
        if skipping:
            self.skip += 1
        if tag in BLOCK_TAGS and self.skip == 0 and self._buf is None:
            self._buf, self._buf_tag = [], tag

    def handle_endtag(self, tag):
        if tag == "script" and self._in_ld:
            self._in_ld = False
            self.ld.append("".join(self._ld_buf))
        if tag == "title":
            self._in_title = False
        if tag in VOID:
            return
        # pop to the matching tag
        for i in range(len(self.stack) - 1, -1, -1):
            if self.stack[i][0] == tag:
                for t, sk, au in self.stack[i:]:
                    if sk:
                        self.skip -= 1
                    if au and self._in_by:
                        self._in_by -= 1
                del self.stack[i:]
                break
        if tag == self._buf_tag and self._buf is not None:
            txt = re.sub(r"\s+", " ", "".join(self._buf)).strip()
            txt = re.sub(r"\s+([,.;:!?)\]])", r"\1", txt)
            if txt:
                self.blocks.append((tag, txt))
            self._buf, self._buf_tag = None, None

    def handle_data(self, data):
        if self._in_ld:
            self._ld_buf.append(data)
            return
        if self._in_title:
            self.title += data
            return
        if self._in_by and data.strip():
            self.byline.append(data.strip())
        if self._buf is not None and self.skip == 0:
            self._buf.append(data)


def _ld_items(raw):
    out = []
    for chunk in raw:
        try:
            d = json.loads(chunk.strip())
        except Exception:
            continue
        stack = [d]
        while stack:
            x = stack.pop()
            if isinstance(x, list):
                stack.extend(x)
            elif isinstance(x, dict):
                out.append(x)
                if "@graph" in x:
                    stack.append(x["@graph"])
    return out


def _names(v):
    if not v:
        return []
    if isinstance(v, str):
        return [v]
    if isinstance(v, dict):
        return [v.get("name", "")] if v.get("name") else []
    if isinstance(v, list):
        r = []
        for i in v:
            r += _names(i)
        return r
    return []


def parse_date(s):
    if not s:
        return None
    s = s.strip()
    m = re.match(r"(\d{4})-(\d{2})-(\d{2})", s)
    if m:
        try:
            return datetime.date(int(m.group(1)), int(m.group(2)), int(m.group(3)))
        except ValueError:
            return None
    for fmt in ("%B %d, %Y", "%b %d, %Y", "%d %B %Y", "%b. %d, %Y", "%m/%d/%Y"):
        try:
            return datetime.datetime.strptime(s[:30].strip(), fmt).date()
        except ValueError:
            pass
    m = re.search(r"([A-Z][a-z]{2,8})\.? (\d{1,2}), (\d{4})", s)
    if m:
        for fmt in ("%B %d %Y", "%b %d %Y"):
            try:
                return datetime.datetime.strptime("%s %s %s" % m.groups(), fmt).date()
            except ValueError:
                pass
    return None


def fmt_date(d):
    return d.strftime("%B ") + str(d.day) + d.strftime(", %Y") if d else ""


def site_from_host(url):
    host = urllib.parse.urlparse(url).netloc.lower().replace("www.", "")
    base = host.split(":")[0]
    parts = base.split(".")
    core = parts[-2] if len(parts) >= 2 else parts[0]
    return core.upper() if len(core) <= 4 else core.capitalize()


def clean_author(a):
    a = html.unescape(a or "").strip()
    a = re.sub(r"^\s*(by|written by|author:)\s+", "", a, flags=re.I)
    a = re.sub(r"\s+", " ", a)
    if a.startswith("http") or len(a) > 80 or "@" in a:
        return ""
    return a.strip(" ,|")


def extract(url, page_html):
    p = _P()
    try:
        p.feed(page_html)
        p.close()
    except Exception:
        pass
    m = p.meta
    items = _ld_items(p.ld)
    art = next((i for i in items if str(i.get("@type", "")).lower() in
                ("newsarticle", "article", "blogposting", "report", "scholarlyarticle", "webpage", "reportagenewsarticle", "analysisnewsarticle")
                and (i.get("author") or i.get("datePublished"))), {})

    title = m.get("og:title") or m.get("twitter:title") or art.get("headline") or p.title
    title = re.sub(r"\s+", " ", html.unescape(title or "")).strip()
    site = m.get("og:site_name") or m.get("application-name") or ""
    if not site:
        pub = art.get("publisher")
        site = pub.get("name", "") if isinstance(pub, dict) else ""
    site = site or site_from_host(url)
    for sep in (" | ", " – ", " — ", " - "):
        if sep in title and len(title.split(sep)[-1]) < 40:
            title = sep.join(title.split(sep)[:-1]).strip()

    authors = _names(art.get("author"))
    for k in ("author", "article:author", "parsely-author", "sailthru.author", "dc.creator", "citation_author", "byl"):
        if not authors and m.get(k):
            authors = [m[k]]
    if not authors and p.byline:
        authors = [" ".join(p.byline[:3])]
    authors = [clean_author(a) for a in authors]
    authors = [a for a in authors if a and len(a.split()) <= 6]
    author = ", ".join(dict.fromkeys(authors[:3]))

    date = None
    for v in (art.get("datePublished"), m.get("article:published_time"), m.get("og:published_time"),
              m.get("datepublished"), m.get("parsely-pub-date"), m.get("pubdate"), m.get("publishdate"),
              m.get("date"), m.get("dc.date"), m.get("citation_publication_date"), art.get("dateModified"),
              *(p.times[:2])):
        date = parse_date(v) if isinstance(v, str) else None
        if date:
            break

    paras = []
    for tag, txt in p.blocks:
        if tag in ("h2", "h3", "h4"):
            continue
        words = len(txt.split())
        if words < 12 or len(txt) < 70:
            continue
        if JUNK.search(txt) and words < 40:
            continue
        paras.append(txt)
    # de-duplicate repeated blocks
    seen, body = set(), []
    for t in paras:
        if t not in seen:
            seen.add(t)
            body.append(t)

    quals = ""
    au = art.get("author")
    if isinstance(au, dict):
        quals = au.get("jobTitle") or au.get("description") or ""
    elif isinstance(au, list) and au and isinstance(au[0], dict):
        quals = au[0].get("jobTitle") or au[0].get("description") or ""
    quals = re.sub(r"\s+", " ", html.unescape(quals or "")).strip()[:200]
    if not quals and author:
        last = author.split(",")[0].split()[-1]
        full = " ".join(t for _, t in p.blocks[-60:]) + " " + " ".join(p.byline)
        mm = re.search(r"\b" + re.escape(last) + r"\b[^.]{0,60}?\b(?:is|serves as|was)\s+((?:a|an|the)\s+[^.]{8,180})\.", full)
        if mm:
            quals = mm.group(1).strip()

    return {
        "url": url,
        "title": title,
        "site": html.unescape(site).strip(),
        "author": author,
        "quals": quals,
        "date": fmt_date(date),
        "year": str(date.year) if date else "",
        "date_obj": date,
        "paragraphs": body,
    }
