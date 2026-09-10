#!/usr/bin/env python3
"""Source historical natural-history plates for the species register.

Only works whose copyright has expired are used. The rules below are applied
as hard filters, not preferences, and the evidence for each is recorded in
data/plates.json so any reader can check the claim themselves:

  * the file must be marked Public Domain (or CC0) on Wikimedia Commons;
  * it must carry a publication or creation date, and that date must be at or
    before PD_CUTOFF, which is set well inside the US public domain;
  * it must carry no usage restrictions;
  * it must be large enough to be a plate rather than a thumbnail.

A faithful photographic reproduction of a two-dimensional public-domain artwork
does not attract a new copyright in the United States (Bridgeman v. Corel), and
Article 14 of the EU Copyright Directive says the same for the EU. So the scan
is as free as the engraving it reproduces.

Species described after the plate era — the saola, the Tapanuli orangutan,
Rice's whale — simply have no historical plate, and keep the drawn figure.

Usage:
  python3 scripts/plates.py search           # find and record candidates
  python3 scripts/plates.py search --limit 20 --only vaquita
  python3 scripts/plates.py download         # fetch and downscale accepted plates
  python3 scripts/plates.py sheet            # contact sheet for visual review
  python3 scripts/plates.py audit            # re-check provenance of the registry
  python3 scripts/plates.py reject <id> ...  # drop a plate that failed review
"""

import argparse
import io
import json
import os
import re
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")
PLATE_DIR = os.path.join(ROOT, "assets", "plates")
REGISTRY = os.path.join(DATA, "plates.json")

API = "https://commons.wikimedia.org/w/api.php"
# Wikimedia's user-agent policy asks for a contactable identity. Give it one.
UA = ("FieldNotesOnVanishingSpecies/1.0 (non-commercial conservation archive; "
      "contact aisynergypartners@gmail.com)")

# Comfortably inside the public domain: US protection for published works runs
# 95 years, so anything published in 1929 or earlier is free as of 2026. The
# cutoff is set earlier still to leave no argument.
PD_CUTOFF = 1928
MIN_WIDTH = 380
MAX_PX = 1100                      # plates are downscaled to this on the long edge

PD_MARKERS = ("public domain", "pd-", "cc0", "no restrictions")
BAD_MARKERS = ("cc by", "cc-by", "fair use", "non-free", "copyright", "all rights")

# The plate literature. A hit on any of these is strong evidence the file is a
# historical illustration rather than a modern photograph.
WORKS = [
    "lydekker", "gould", "joseph wolf", "brehm", "elliot", "audubon",
    "haeckel", "buffon", "cuvier", "sclater", "rothschild", "keulemans",
    "smit", "wolf", "richter", "hart", "grönvold", "gronvold", "millais",
    "naturgeschichte", "tierleben", "naturelle", "zoological sketches",
    "royal natural history", "lloyd's natural history", "novitates",
    "proceedings of the zoological society", "transactions of the zoological",
    "iconographia", "fauna japonica", "meyers", "nordisk", "brockhaus",
    "dictionnaire", "planches", "monograph", "histoire naturelle",
    "die säugethiere", "saugethiere", "vögel", "voegel", "birds of",
    "mammals of", "wytsman", "cassell", "wood's natural history",
]
ILLUS_HINTS = ("plate", "pl.", "tafel", "planche", "lithograph", "engraving",
               "illustration", "drawing", "etching", "chromolithograph")
PHOTO_HINTS = ("photograph", "photo by", "camera", ".png thumbnail", "zoo, ",
               "captivity photo")


# ------------------------------------------------------------------ helpers
def api(params):
    params = dict(params)
    params.setdefault("format", "json")
    url = API + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)


def strip_html(v):
    return re.sub(r"<[^>]+>", " ", str(v or "")).replace("&amp;", "&").strip()


def meta(em, key):
    return strip_html(em.get(key, {}).get("value", ""))


def _human_date(text):
    """The readable part of a Commons date field.

    Commons appends a machine-readable Wikidata qualifier, e.g.
      "between 1700 and 1880 date QS:P571,+1500-00-00T00:00:00Z/6,..."
    The +1500 in there is a precision marker, not a year, and reading it as one
    dates an Iconographia Zoologica print to the age of Columbus. Everything
    from " date QS:" onward is therefore discarded.
    """
    t = str(text or "")
    return re.split(r"\s*date QS:", t)[0].strip()


def year_of(text):
    """A conservative publication year for the copyright test.

    Where the source gives a range ("between 1700 and 1880") the LATER bound is
    taken, because the work could be that recent and the claim has to hold at
    the worst case.
    """
    years = [int(y) for y in re.findall(r"\b(1[4-9]\d{2}|20[0-2]\d)\b", _human_date(text))]
    return max(years) if years else None


def date_label(text):
    """How the date should be shown to a reader, ranges included."""
    t = _human_date(text)
    return t if t else None


def load_registry():
    if os.path.exists(REGISTRY):
        return json.load(open(REGISTRY, encoding="utf-8"))
    return {"_about": "", "plates": {}, "rejected": {}}


def save_registry(reg):
    reg["_about"] = (
        "Historical natural-history plates used as the figure for a species, in "
        "place of the drawn study. Every entry records the artist, the work, the "
        "year of publication, the licence and the source file, so the public-domain "
        "claim can be checked. Only works published in %d or earlier are used. "
        "Species with no entry here fall back to the drawn plate in "
        "assets/sketches.js." % PD_CUTOFF)
    reg["_cutoff"] = PD_CUTOFF
    with open(REGISTRY, "w", encoding="utf-8") as f:
        json.dump(reg, f, ensure_ascii=False, indent=1, sort_keys=False)


def species():
    return json.load(open(os.path.join(DATA, "species.json"), encoding="utf-8"))["species"]


# ------------------------------------------------------------------ harvest
# Searching Commons species by species returns modern photographs and hammers
# the API. Harvesting whole works instead gives a pool that is historical by
# construction, in a handful of requests, and the matching is then done offline.
SEED_CATEGORIES = [
    # Chosen for yield per request: works whose files are named or described by
    # species. The great journal runs — Proceedings and Transactions of the
    # Zoological Society, Meyers, the Naturalis archive — hold superb plates but
    # number in the tens of thousands, and harvesting them politely would take
    # hours for little extra coverage.
    "Category:Brehms Tierleben",
    "Category:Lloyd's Natural History",
    "Category:Joseph Wolf",
    "Category:Joseph Smit",
    "Category:John Gerrard Keulemans",
    "Category:John Gould",
    "Category:Daniel Giraud Elliot",
    "Category:Henrik Grönvold",
    "Category:Johann Baptist von Spix",
    "Category:The book of antelopes",
    "Category:A monograph of the Felidae",
    "Category:Extinct birds (Rothschild)",
    "Category:Kunstformen der Natur",
    "Category:Histoire naturelle des mammifères",
    "Category:Die Säugethiere in Abbildungen nach der Natur",
    "Category:Illustrations of Indian zoology",
    "Category:Naturgeschichte der Vögel Mitteleuropas",
    "Category:Wildlife illustrations by Wilhelm Kuhnert",
    "Category:Richard Lydekker",
]
POOL = os.path.join(DATA, "plate-pool.json")
SLEEP = 1.4                     # Commons asks for restraint; this obliges


def api_backoff(params, tries=5):
    delay = SLEEP
    for attempt in range(tries):
        try:
            return api(params)
        except urllib.error.HTTPError as e:
            if e.code == 429:
                delay *= 2
                time.sleep(delay)
                continue
            raise
        except Exception:
            time.sleep(delay)
            delay *= 1.6
    return {}


def pool_entry(pg):
    ii = (pg.get("imageinfo") or [{}])[0]
    em = ii.get("extmetadata", {})
    return {
        "title": pg.get("title", ""),
        "artist": meta(em, "Artist") or "Unknown",
        "work": meta(em, "Credit") or meta(em, "ImageDescription") or "",
        "desc": meta(em, "ImageDescription")[:400],
        "cats": meta(em, "Categories"),
        "date": meta(em, "DateTimeOriginal") or meta(em, "DateTime"),
        "licence": meta(em, "LicenseShortName") or meta(em, "UsageTerms"),
        "restrictions": meta(em, "Restrictions"),
        "url": ii.get("url", ""),
        "width": ii.get("width") or 0,
        "height": ii.get("height") or 0,
    }


def harvest_category(cat, depth, seen_cats, out, verbose):
    if depth < 0 or cat in seen_cats:
        return
    seen_cats.add(cat)
    cont, n = {}, 0
    while True:
        params = {"action": "query", "generator": "categorymembers",
                  "gcmtitle": cat, "gcmtype": "file", "gcmlimit": 100,
                  "prop": "imageinfo", "iiprop": "url|size|extmetadata",
                  "iiextmetadatafilter": "Artist|Credit|DateTimeOriginal|DateTime|"
                                         "LicenseShortName|UsageTerms|Restrictions|"
                                         "ImageDescription|Categories"}
        params.update(cont)
        d = api_backoff(params)
        for pg in (d.get("query", {}).get("pages", {}) or {}).values():
            e = pool_entry(pg)
            if e["title"] and e["title"] not in out:
                out[e["title"]] = e
                n += 1
        if "continue" in d:
            cont = d["continue"]
            time.sleep(SLEEP)
        else:
            break
    if verbose:
        print("    %-58s +%d files" % (cat[:58], n))
    time.sleep(SLEEP)

    if depth > 0:                                   # walk one level of subcategories
        d = api_backoff({"action": "query", "list": "categorymembers",
                         "cmtitle": cat, "cmtype": "subcat", "cmlimit": 60})
        subs = [m["title"] for m in d.get("query", {}).get("categorymembers", [])]
        time.sleep(SLEEP)
        for sub in subs:
            harvest_category(sub, depth - 1, seen_cats, out, verbose)


def cmd_harvest(args):
    out = {}
    if os.path.exists(POOL) and not args.fresh:
        out = json.load(open(POOL, encoding="utf-8")).get("files", {})
    seen = set()
    cats = args.only or SEED_CATEGORIES
    if args.cats_file:
        with open(args.cats_file, encoding="utf-8") as fh:
            cats = [ln.strip() for ln in fh if ln.strip() and not ln.startswith("#")]
    for cat in cats:
        print("  %s" % cat)
        try:
            harvest_category(cat, args.depth, seen, out, args.verbose)
        except Exception as e:                      # noqa: BLE001
            print("    failed: %s" % str(e)[:70])
    with open(POOL, "w", encoding="utf-8") as f:
        json.dump({"_about": "Working pool of candidate historical plates harvested "
                             "from Wikimedia Commons categories of pre-1929 natural "
                             "history works. Filtered and matched by plates.py match.",
                   "files": out}, f, ensure_ascii=False, indent=0)
    print("\npool now holds %d files" % len(out))
    return 0


# -------------------------------------------------------------------- match
def usable(e):
    """Hard public-domain gate, applied identically to every candidate."""
    lic = (e.get("licence") or "").lower()
    if any(b in lic for b in BAD_MARKERS) and "public domain" not in lic:
        return None, "licence: %s" % lic[:38]
    if not any(m in lic for m in PD_MARKERS):
        return None, "licence not public domain: %s" % lic[:38]
    if e.get("restrictions"):
        return None, "restrictions recorded"
    yr = year_of(e.get("date")) or year_of(e.get("work")) or year_of(e.get("title"))
    if yr is None:
        return None, "no date"
    if yr > PD_CUTOFF:
        return None, "dated %d" % yr
    if (e.get("width") or 0) < MIN_WIDTH:
        return None, "too small"
    if not e["title"].lower().endswith((".jpg", ".jpeg", ".png", ".tif", ".tiff")):
        return None, "not a raster image"
    return yr, None


def score_for(e, sp, yr):
    """How well one pooled plate answers to one species."""
    blob = " ".join([e.get("title", ""), e.get("desc", ""), e.get("cats", ""),
                     e.get("work", "")]).lower()
    sci = sp["sci"].lower()
    binomial = " ".join(re.sub(r"[()]", "", sci).split()[:2])
    genus, epithet = (binomial.split() + [""])[:2]
    common = sp["common"].lower()
    aliases = [a.lower() for a in (sp.get("plateAliases") or [])]

    # Only two things count as naming the species: the binomial (current or a
    # recorded historical synonym), or the full common name. A fuzzy
    # genus-plus-stem rule was tried and matched a bonobo to a plate of
    # sparrows, so it is gone.
    if binomial in blob or any(a and a in blob for a in aliases):
        match = 3
    elif len(common) >= 8 and common in blob:
        match = 2
    else:
        return 0
    score = 40 * match
    if any(k in blob for k in WORKS):
        score += 25
    if any(k in blob for k in ILLUS_HINTS):
        score += 15
    if any(k in blob for k in PHOTO_HINTS):
        score -= 50
    score += min(18, (e.get("width") or 0) // 130)
    if yr <= 1900:
        score += 6
    return score


def cmd_match(args):
    """Assign at most one pooled plate to each species, preferring unused ones."""
    if not os.path.exists(POOL):
        print("no pool yet — run: python3 scripts/plates.py harvest")
        return 1
    pool = json.load(open(POOL, encoding="utf-8"))["files"]
    sp = species()
    if args.only:
        sp = [s for s in sp if s["id"] in set(args.only)]
    reg = load_registry()
    plates, rejected = reg["plates"], reg.setdefault("rejected", {})

    ok_pool = []
    for e in pool.values():
        yr, why = usable(e)
        if yr:
            ok_pool.append((e, yr))
    print("  %d of %d pooled files pass the public-domain gate" % (len(ok_pool), len(pool)))

    used = {v.get("title") for v in plates.values()}
    found = 0
    for s in sp:
        if s["id"] in rejected and not args.force:
            continue
        if s["id"] in plates and not args.force:
            continue
        best = None
        for e, yr in ok_pool:
            sc = score_for(e, s, yr)
            if sc < args.threshold:
                continue
            if e["title"] in used:          # a plate already given to another species
                sc -= 45
            if best is None or sc > best[0]:
                best = (sc, e, yr)
        if best:
            sc, e, yr = best
            plates[s["id"]] = {
                "speciesId": s["id"], "for": "%s (%s)" % (s["common"], s["sci"]),
                "title": e["title"], "artist": e["artist"], "work": e["work"][:220],
                "year": yr, "dateLabel": date_label(e.get("date")) or str(yr),
            "licence": e["licence"] or "Public domain",
                "source": "https://commons.wikimedia.org/wiki/" +
                          urllib.parse.quote(e["title"].replace(" ", "_")),
                "sourceFile": e["url"], "width": e["width"], "height": e["height"],
                "score": sc,
            }
            used.add(e["title"])
            found += 1
            print("  %-30s %-42s %s" % (s["id"][:30], e["title"][5:47], yr))
    save_registry(reg)
    print("\nmatched %d new plate(s); %d species now have one of %d" %
          (found, len(plates), len(species())))
    return 0


# ----------------------------------------------------------------- download
def autocrop(im):
    """Trim a scanned page down to the illustration.

    Two shapes of source have to be handled. A book plate fills its page and
    needs only its margins and caption trimmed. An album sheet — the
    Iconographia Zoologica scans are all like this — is a small clipped print
    pasted onto a large blank leaf, with a scan border and handwritten notes,
    and the picture may be a fifth of the area.

    So interest is measured on a coarse grid rather than by contiguous runs, and
    a cell counts as interesting if it is either markedly darker than the paper
    or noticeably coloured. Colour is the giveaway on album sheets: the print is
    tinted, the leaf and the handwriting are not. The crop is the bounding box
    of the interesting cells, and anything implausible is refused.
    """
    from PIL import Image
    w, h = im.size
    GW, GH = 44, 58
    small = im.convert("RGB").resize((GW * 4, GH * 4), Image.BILINEAR)
    px = small.load()
    sw, sh = small.size

    # Ignore a thin frame: scans usually carry a dark edge that would otherwise
    # anchor the bounding box to the whole sheet.
    m = 3
    def cell_score(gx, gy):
        dark = chroma = n = 0
        for y in range(gy * 4, gy * 4 + 4):
            for x in range(gx * 4, gx * 4 + 4):
                r, g, b = px[x, y]
                lo, hi = min(r, g, b), max(r, g, b)
                dark += (lo + hi) / 2
                chroma += hi - lo
                n += 1
        return dark / n, chroma / n

    scores = [[cell_score(gx, gy) for gx in range(GW)] for gy in range(GH)]
    edge = [scores[gy][gx][0] for gy in (0, GH - 1) for gx in range(GW)] + \
           [scores[gy][gx][0] for gx in (0, GW - 1) for gy in range(GH)]
    paper = sorted(edge)[len(edge) // 2] if edge else 240

    interest = [[0.0] * GW for _ in range(GH)]
    for gy in range(GH):
        for gx in range(GW):
            d, c = scores[gy][gx]
            interest[gy][gx] = max(max(0.0, paper - d) / 255.0, (c - 10) / 120.0)
    peak = max(max(row) for row in interest) or 1.0
    if peak < 0.05:
        return im                                   # a blank or near-blank scan

    # Try a range of thresholds and keep the TIGHTEST box that still looks like
    # a picture. Taking the first acceptable box instead leaves an album sheet
    # mostly blank, because a low threshold happily includes the paper tone.
    best = None
    for frac in (0.62, 0.52, 0.42, 0.34, 0.26, 0.19, 0.13):
        cells = [(gx, gy) for gy in range(m, GH - m) for gx in range(m, GW - m)
                 if interest[gy][gx] >= peak * frac]
        if len(cells) < 8:
            continue
        x0 = min(c[0] for c in cells); x1 = max(c[0] for c in cells) + 1
        y0 = min(c[1] for c in cells); y1 = max(c[1] for c in cells) + 1
        bw, bh = (x1 - x0) / GW, (y1 - y0) / GH
        area = bw * bh
        if area > 0.9 or area < 0.045 or bw < 0.14 or bh < 0.10:
            continue
        if best is None or area < best[0]:
            best = (area, x0, x1, y0, y1)
    if best is None:
        return im
    _, x0, x1, y0, y1 = best
    pad = 0.02
    L = max(0.0, x0 / GW - pad); R = min(1.0, x1 / GW + pad)
    T = max(0.0, y0 / GH - pad); B = min(1.0, y1 / GH + pad)
    return im.crop((int(L * w), int(T * h), int(R * w), int(B * h)))


def cmd_download(args):
    from PIL import Image
    reg = load_registry()
    os.makedirs(PLATE_DIR, exist_ok=True)
    got = fail = 0
    items = list(reg["plates"].items())
    if args.only:
        items = [(k, v) for k, v in items if k in set(args.only)]
    for sid, info in items:
        out = os.path.join(PLATE_DIR, sid + ".jpg")
        if os.path.exists(out) and not args.force:
            continue
        try:
            # Ask Commons for a server-side thumbnail rather than the full
            # original: it is a fraction of the bytes, which is both faster and
            # considerably politer than pulling 8MB scans. curl is used because
            # urllib gets throttled where curl does not.
            src = ("https://commons.wikimedia.org/wiki/Special:FilePath/" +
                   urllib.parse.quote(info["title"].split(":", 1)[-1].replace(" ", "_")) +
                   "?width=%d" % MAX_PX)
            raw = None
            delay = args.delay
            for attempt in range(4):
                got_proc = subprocess.run(
                    ["curl", "-sS", "-L", "--max-time", "90", "-A", UA, src],
                    capture_output=True)
                if got_proc.returncode == 0 and len(got_proc.stdout) > 4096:
                    raw = got_proc.stdout
                    break
                time.sleep(delay)
                delay *= 2
            if raw is None:
                raise RuntimeError("could not fetch after 4 attempts")
            im = Image.open(io.BytesIO(raw))
            im = im.convert("RGB")
            before = im.size
            if not args.no_crop:
                im = autocrop(im)
            cropped = im.size != before
            im.thumbnail((MAX_PX, MAX_PX), Image.LANCZOS)
            im.save(out, "JPEG", quality=82, optimize=True, progressive=True)
            info["file"] = "assets/plates/" + sid + ".jpg"
            info["bytes"] = os.path.getsize(out)
            info["stored"] = [im.width, im.height]
            info["cropped"] = cropped
            got += 1
            print("  %-30s %4dx%-4d %4d KB%s" % (
                sid[:30], im.width, im.height, info["bytes"] // 1024,
                "  cropped" if cropped else ""))
        except Exception as e:                      # noqa: BLE001
            fail += 1
            print("  %-34s FAILED %s" % (sid[:34], str(e)[:50]))
        time.sleep(args.delay)
    save_registry(reg)
    print("\ndownloaded %d, failed %d" % (got, fail))
    return 0


# -------------------------------------------------------------------- sheet
def cmd_sheet(args):
    """Write a contact sheet so every plate can be eyeballed before it ships."""
    reg = load_registry()
    rows = [(k, v) for k, v in sorted(reg["plates"].items()) if v.get("file")]
    if args.only:
        rows = [(k, v) for k, v in rows if k in set(args.only)]
    per_page = args.per_page
    pages = [rows[i:i + per_page] for i in range(0, len(rows), per_page)] or [[]]
    written = []
    for n, page in enumerate(pages, 1):
        cells = "".join(
            '<figure><img src="../%s" alt="%s">'
            '<figcaption><b>%s</b><br>%s<br><i>%s, %s</i></figcaption></figure>'
            % (v["file"], k, k, v.get("for", ""), v["artist"][:40], v["year"])
            for k, v in page)
        html = ("<!doctype html><meta charset=utf-8><title>Plate review %d</title>"
                "<style>body{background:#f7f2e6;font:12px Georgia;margin:8px}"
                "div{display:grid;grid-template-columns:repeat(%d,1fr);gap:8px}"
                "figure{margin:0;background:#fff;border:1px solid #ccc;padding:4px;text-align:center}"
                "img{width:100%%;height:200px;object-fit:contain;background:#fbf7ee}"
                "figcaption{font-size:10px;line-height:1.25;margin-top:3px}</style>"
                "<div>%s</div>" % (n, args.cols, cells))
        path = os.path.join(ROOT, "scripts", "_plate-review-%d.html" % n)
        open(path, "w", encoding="utf-8").write(html)
        written.append(path)
    print("wrote %d review sheet(s) covering %d plates" % (len(written), len(rows)))
    for p in written:
        print("  " + os.path.relpath(p, ROOT))
    return 0


# -------------------------------------------------------------------- audit
def cmd_audit(args):
    reg = load_registry()
    bad = 0
    for sid, info in sorted(reg["plates"].items()):
        problems = []
        if info.get("year", 9999) > PD_CUTOFF:
            problems.append("dated %s, after the %d cutoff" % (info.get("year"), PD_CUTOFF))
        if not any(m in (info.get("licence", "") or "").lower() for m in PD_MARKERS):
            problems.append("licence %r is not a public-domain marker" % info.get("licence"))
        if not info.get("source"):
            problems.append("no source URL")
        if not info.get("artist"):
            problems.append("no artist recorded")
        f = info.get("file")
        if not f:
            problems.append("not downloaded")
        elif not os.path.exists(os.path.join(ROOT, f)):
            problems.append("file missing on disk")
        if problems:
            bad += 1
            print("  %-32s %s" % (sid[:32], "; ".join(problems)))
    print("\n%d plate(s) registered, %d with problems" % (len(reg["plates"]), bad))
    return 1 if bad else 0


def cmd_assign(args):
    """Pin a specific pooled plate to a species by hand.

    Automatic matching is good but not infallible, and review turns up cases
    where the right plate exists in the pool and the scorer picked a different
    one. This is how a human overrules it. The public-domain gate still applies.
    """
    pool = json.load(open(POOL, encoding="utf-8"))["files"]
    reg = load_registry()
    sp = {s["id"]: s for s in species()}
    if args.species not in sp:
        print("  unknown species id: %s" % args.species)
        return 1
    hits = [e for t, e in pool.items() if args.title.lower() in t.lower()]
    if not hits:
        print("  no pooled file matching %r" % args.title)
        return 1
    if len(hits) > 1:
        print("  %r is ambiguous:" % args.title)
        for e in hits[:8]:
            print("     " + e["title"])
        return 1
    e = hits[0]
    yr, why = usable(e)
    if not yr:
        print("  %s fails the public-domain gate: %s" % (e["title"], why))
        return 1
    s = sp[args.species]
    reg["plates"][args.species] = {
        "speciesId": s["id"], "for": "%s (%s)" % (s["common"], s["sci"]),
        "title": e["title"], "artist": e["artist"], "work": e["work"][:220],
        "year": yr, "dateLabel": date_label(e.get("date")) or str(yr),
        "licence": e["licence"] or "Public domain",
        "source": "https://commons.wikimedia.org/wiki/" +
                  urllib.parse.quote(e["title"].replace(" ", "_")),
        "sourceFile": e["url"], "width": e["width"], "height": e["height"],
        "assignedByHand": True,
    }
    reg.get("rejected", {}).pop(args.species, None)
    save_registry(reg)
    print("  %s -> %s (%s)" % (args.species, e["title"], yr))
    return 0


def cmd_reject(args):
    reg = load_registry()
    for sid in args.ids:
        info = reg["plates"].pop(sid, None)
        if info:
            reg.setdefault("rejected", {})[sid] = {
                "title": info.get("title"), "why": args.why or "failed visual review"}
            f = os.path.join(ROOT, info.get("file") or "")
            if info.get("file") and os.path.exists(f):
                os.remove(f)
            print("  rejected %s (%s)" % (sid, info.get("title", "")))
        else:
            print("  %s was not registered" % sid)
    save_registry(reg)
    return 0


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)

    hv = sub.add_parser("harvest"); hv.set_defaults(fn=cmd_harvest)
    hv.add_argument("--only", nargs="*"); hv.add_argument("--depth", type=int, default=1)
    hv.add_argument("--fresh", action="store_true"); hv.add_argument("--verbose", action="store_true")
    hv.add_argument("--cats-file", help="newline-delimited category names, so titles with "
                                        "spaces and brackets survive the shell")

    m = sub.add_parser("match"); m.set_defaults(fn=cmd_match)
    m.add_argument("--only", nargs="*"); m.add_argument("--force", action="store_true")
    m.add_argument("--threshold", type=int, default=110)

    d = sub.add_parser("download"); d.set_defaults(fn=cmd_download)
    d.add_argument("--only", nargs="*"); d.add_argument("--force", action="store_true")
    d.add_argument("--delay", type=float, default=2.5)
    d.add_argument("--no-crop", action="store_true")

    h = sub.add_parser("sheet"); h.set_defaults(fn=cmd_sheet)
    h.add_argument("--only", nargs="*")
    h.add_argument("--per-page", type=int, default=18)
    h.add_argument("--cols", type=int, default=6)

    a = sub.add_parser("audit"); a.set_defaults(fn=cmd_audit)

    asg = sub.add_parser("assign"); asg.set_defaults(fn=cmd_assign)
    asg.add_argument("species"); asg.add_argument("title")

    r = sub.add_parser("reject"); r.set_defaults(fn=cmd_reject)
    r.add_argument("ids", nargs="+"); r.add_argument("--why")

    args = ap.parse_args()
    return args.fn(args)


if __name__ == "__main__":
    sys.exit(main())
