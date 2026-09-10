#!/usr/bin/env python3
"""Weekly compliance and monitoring check for Field Notes on Vanishing Things.

Runs every Monday via .github/workflows/weekly-verification.yml, and can be run
by anyone with a copy of this repository:

    python3 scripts/verify.py              # full run, including live link checks
    python3 scripts/verify.py --offline    # structural checks only, no network
    python3 scripts/verify.py --strict     # exit non-zero on warnings too

What it verifies
  1. Shape        every record has the fields the site relies on, correctly typed
  2. References   every organisation id, source id, country code and sketch key
                  named by a species actually resolves
  3. Populations  low <= estimate <= high, and any figure carries a survey and a
                  date saying where it came from
  4. Citations    every species cites at least one primary assessment, and every
                  population figure cites something
  5. Staleness    assessments and population figures old enough to warrant a
                  human re-check are surfaced rather than left silent
  6. Coverage     every continent has countries, every country page can render
  7. Liveness     every organisation and source URL still answers (network runs)

What it deliberately does not do
  It cannot re-read the IUCN Red List and re-derive a category by itself: that
  needs an API token this project does not hold. Instead it flags every record
  whose assessment is old enough to be worth a human look, so that staleness is
  visible rather than silent. If IUCN_API_TOKEN is present in the environment
  the same report will note it, but category re-derivation remains manual.

Output: data/verification-report.json, which the site renders at
/verification.html. Nothing is written to the species data — a checker that
edits the thing it is checking is not a checker.
"""

import argparse
import concurrent.futures
import datetime
import json
import os
import ssl
import subprocess
import sys
import urllib.error
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")
REPORT = os.path.join(DATA, "verification-report.json")

UA = "FieldNotesVerifier/1.0 (+conservation data integrity check)"
TIMEOUT = 20

VALID_IUCN = {"EX", "EW", "CR", "EN", "VU", "NT", "LC", "DD"}
VALID_GROUP = {"mammal", "bird", "reptile", "amphibian", "fish", "invertebrate", "plant"}
VALID_TREND = {"dec", "inc", "stable", "unknown"}
PRIMARY_TYPES = {"primary-assessment", "national-listing"}

# A Red List assessment older than this is not wrong, but it is worth a look.
STALE_ASSESSMENT_YEARS = 12
STALE_POPULATION_YEARS = 8


class Findings(object):
    """Collects issues and the per-check tallies the report page renders."""

    def __init__(self):
        self.issues = []
        self.checks = []

    def check(self, name, description, checked, warned=0, failed=0):
        self.checks.append({
            "name": name, "description": description,
            "checked": checked, "warned": warned, "failed": failed,
        })

    def error(self, check, record, message):
        self.issues.append({"level": "error", "check": check,
                            "record": record, "message": message})

    def warn(self, check, record, message):
        self.issues.append({"level": "warning", "check": check,
                            "record": record, "message": message})

    def count(self, check, level):
        return sum(1 for i in self.issues
                   if i["check"] == check and i["level"] == level)


def load(name):
    with open(os.path.join(DATA, name), encoding="utf-8") as f:
        return json.load(f)


# --------------------------------------------------------------------- checks
def check_shape(species, f):
    """Every record has what the site reads, correctly typed."""
    name = "Record shape"
    required = ("id", "common", "sci", "group", "sketch", "iucn", "iucnYear",
                "trend", "countries", "habitat", "note", "threats", "orgs",
                "sources", "pop")
    seen = set()
    for s in species:
        sid = s.get("id", "<no id>")
        for field in required:
            if field not in s:
                f.error(name, sid, "missing required field '%s'" % field)
        if sid in seen:
            f.error(name, sid, "duplicate species id")
        seen.add(sid)
        if s.get("iucn") not in VALID_IUCN:
            f.error(name, sid, "unknown IUCN category %r" % s.get("iucn"))
        if s.get("group") not in VALID_GROUP:
            f.error(name, sid, "unknown taxonomic group %r" % s.get("group"))
        if s.get("trend") not in VALID_TREND:
            f.error(name, sid, "unknown population trend %r" % s.get("trend"))
        if not isinstance(s.get("countries"), list) or not s.get("countries"):
            f.error(name, sid, "range must list at least one country")
        if not isinstance(s.get("threats"), list) or not s.get("threats"):
            f.error(name, sid, "no threats recorded")
        if len(s.get("note", "")) < 60:
            f.warn(name, sid, "descriptive note is very short")
        year = s.get("iucnYear")
        if not isinstance(year, int) or not (1960 < year <= datetime.date.today().year):
            f.error(name, sid, "implausible assessment year %r" % year)
    f.check(name, "Required fields present and correctly typed on every species record",
            len(species), f.count(name, "warning"), f.count(name, "error"))


def check_references(species, orgs, sources, countries, sketch_keys, f):
    """Everything a species points at must resolve."""
    name = "Cross-references"
    org_ids = {o["id"] for o in orgs}
    src_ids = {s["id"] for s in sources}
    cc = {c["code"] for c in countries}
    for s in species:
        sid = s.get("id", "<no id>")
        for o in s.get("orgs", []):
            if o not in org_ids:
                f.error(name, sid, "names organisation '%s', which is not in the registry" % o)
        for src in s.get("sources", []):
            if src not in src_ids:
                f.error(name, sid, "cites source '%s', which is not in the bibliography" % src)
        for code in s.get("countries", []):
            if code not in cc:
                f.error(name, sid, "range includes '%s', which is not a known country code" % code)
        if s.get("endemic") and s["endemic"] not in s.get("countries", []):
            f.error(name, sid, "marked endemic to %s but that country is not in its range"
                    % s["endemic"])
        if sketch_keys and s.get("sketch") not in sketch_keys:
            f.error(name, sid, "uses plate '%s', which the sketch library does not define"
                    % s.get("sketch"))
        for code in (s.get("national") or {}):
            if code not in cc:
                f.error(name, sid, "national listing for unknown country '%s'" % code)
        for code in (s.get("popNational") or {}):
            if code not in s.get("countries", []):
                f.error(name, sid, "national population figure for '%s', outside its range" % code)
    f.check(name, "Organisation ids, source ids, country codes and plate keys all resolve",
            len(species), f.count(name, "warning"), f.count(name, "error"))


def check_populations(species, f):
    """A number without a range, a survey and a date is not evidence."""
    name = "Population figures"
    for s in species:
        sid = s.get("id", "<no id>")
        pop = s.get("pop") or {}
        est, low, high = pop.get("est"), pop.get("low"), pop.get("high")
        if est is None:
            if not pop.get("label"):
                f.error(name, sid, "no population estimate and no explanation of why not")
            continue
        if not isinstance(est, (int, float)) or est < 0:
            f.error(name, sid, "population estimate is not a non-negative number: %r" % est)
            continue
        if low is not None and low > est:
            f.error(name, sid, "published low (%s) is above the estimate (%s)" % (low, est))
        if high is not None and high < est:
            f.error(name, sid, "published high (%s) is below the estimate (%s)" % (high, est))
        if not pop.get("unit"):
            f.error(name, sid, "population figure has no unit")
        if not pop.get("basis"):
            f.error(name, sid, "population figure does not say which survey it came from")
        if not pop.get("asOf"):
            f.error(name, sid, "population figure has no date")
    f.check(name, "Ranges bracket their estimate; every figure carries a unit, survey and date",
            len(species), f.count(name, "warning"), f.count(name, "error"))


def check_citations(species, sources, f):
    """Each record must rest on at least one primary assessment."""
    name = "Citations"
    by_id = {s["id"]: s for s in sources}
    for s in species:
        sid = s.get("id", "<no id>")
        cited = [by_id[x] for x in s.get("sources", []) if x in by_id]
        if not cited:
            f.error(name, sid, "cites no resolvable source")
            continue
        if not any(c["type"] in PRIMARY_TYPES for c in cited):
            f.error(name, sid, "cites no primary assessment or national register")
    f.check(name, "Every species rests on at least one primary assessment or national register",
            len(species), f.count(name, "warning"), f.count(name, "error"))


def check_staleness(species, f):
    """Old is not wrong, but it should be visible."""
    name = "Staleness"
    this_year = datetime.date.today().year
    for s in species:
        sid = s.get("id", "<no id>")
        year = s.get("iucnYear")
        if isinstance(year, int) and this_year - year > STALE_ASSESSMENT_YEARS:
            f.warn(name, sid, "last assessed in %d, %d years ago — worth re-checking against "
                              "the current Red List entry" % (year, this_year - year))
        pop = s.get("pop") or {}
        as_of = str(pop.get("asOf") or "")
        if as_of[:4].isdigit() and this_year - int(as_of[:4]) > STALE_POPULATION_YEARS:
            f.warn(name, sid, "population figure dates from %s; check for a newer survey" % as_of)
    f.check(name, "Assessments over %d years old and counts over %d years old are surfaced"
            % (STALE_ASSESSMENT_YEARS, STALE_POPULATION_YEARS),
            len(species), f.count(name, "warning"), f.count(name, "error"))


def check_coverage(species, countries, continents, f):
    """The site promises a page per continent and per country; check it can deliver."""
    name = "Coverage"
    in_country = {}
    for s in species:
        for code in s.get("countries", []):
            in_country.setdefault(code, []).append(s)
    cont_ids = {c["id"] for c in continents}
    for c in countries:
        if c["continent"] not in cont_ids:
            f.error(name, c["code"], "assigned to unknown continent '%s'" % c["continent"])
    for cid in cont_ids:
        rows = [c for c in countries if c["continent"] == cid]
        if not rows:
            f.error(name, cid, "continent has no countries")
        if not any(in_country.get(c["code"]) for c in rows):
            f.error(name, cid, "continent has no species in any of its countries")
    empty = [c["code"] for c in countries if not in_country.get(c["code"])]
    if empty:
        f.warn(name, ", ".join(sorted(empty)),
               "%d countries have no species recorded and will render the empty state"
               % len(empty))
    f.check(name, "Every continent resolves, and countries without records are accounted for",
            len(countries), f.count(name, "warning"), f.count(name, "error"))


def check_org_quality(species, orgs, f):
    """Three named organisations per species, each with a usable link."""
    name = "Organisations"
    for o in orgs:
        if not o.get("url", "").startswith("https://"):
            f.error(name, o.get("id", "?"), "URL is not https")
        if len(o.get("role", "")) < 30:
            f.warn(name, o.get("id", "?"), "role description is very thin")
    for s in species:
        n = len(s.get("orgs", []))
        if n < 3:
            f.warn(name, s.get("id", "?"), "names only %d organisation(s); the site promises three" % n)
    f.check(name, "Every organisation has an https link and a described role; species name three",
            len(orgs), f.count(name, "warning"), f.count(name, "error"))


def _curl(url):
    """Second opinion via curl.

    Python's ssl module is only as good as the OpenSSL it was linked against,
    and the system Python on macOS ships an old LibreSSL that several perfectly
    healthy sites refuse to negotiate with. curl is present on macOS and on the
    GitHub runner and speaks modern TLS, so it is the tie-breaker rather than a
    verdict of its own.
    """
    try:
        out = subprocess.run(
            ["curl", "-sS", "-o", os.devnull, "-w", "%{http_code}", "-L",
             "--max-time", str(TIMEOUT), "-A", UA, url],
            capture_output=True, text=True, timeout=TIMEOUT + 10)
    except Exception as e:                          # noqa: BLE001
        return None, "curl unavailable: %s" % e
    code = (out.stdout or "").strip()[-3:]
    if code.isdigit():
        return int(code), (out.stderr or "").strip()[:120]
    return None, (out.stderr or "").strip()[:120] or "no response"


def check_plates(species, f):
    """Historical plates must carry provenance strong enough to stand up.

    The site makes a public claim about every one of these images -- that it is
    out of copyright -- so the evidence for that claim is checked on the same
    schedule as everything else.
    """
    name = "Plate provenance"
    path = os.path.join(DATA, "plates.json")
    if not os.path.exists(path):
        f.check(name, "Historical plates carry artist, work, year, licence and source", 0)
        return
    blob = json.load(open(path, encoding="utf-8"))
    plates = blob.get("plates", {})
    cutoff = blob.get("_cutoff", 1928)
    ids = {s["id"] for s in species}

    for sid, pl in sorted(plates.items()):
        if sid not in ids:
            f.error(name, sid, "plate registered for a species that is not in the register")
            continue
        yr = pl.get("year")
        if not isinstance(yr, int):
            f.error(name, sid, "no publication year recorded, so the copyright claim cannot be checked")
        elif yr > cutoff:
            f.error(name, sid, "plate dated %s, whose latest possible year (%d) is after the "
                               "%d public-domain cutoff"
                    % (pl.get("dateLabel") or yr, yr, cutoff))
        # The operative fact is the publication date: US copyright in a
        # published work runs 95 years, so anything at or before the cutoff is
        # free whatever the file is tagged. An affirmative "public domain" tag
        # is the strongest corroboration; "no known copyright restrictions" is
        # the weaker institutional tag used by the Internet Archive and Flickr
        # Commons, and is accepted only because the date already settles it.
        lic = (pl.get("licence") or "").lower()
        strong = any(m in lic for m in ("public domain", "pd-", "cc0"))
        weak = any(m in lic for m in ("no restrictions", "no known copyright"))
        if not strong and not weak:
            f.error(name, sid, "licence %r is neither a public-domain declaration nor a "
                               "no-known-restrictions tag" % pl.get("licence"))
        elif weak and not (isinstance(yr, int) and yr <= cutoff):
            f.error(name, sid, "licence is only %r and the date does not independently "
                               "establish expiry" % pl.get("licence"))
        if not pl.get("artist"):
            f.warn(name, sid, "no artist recorded")
        if not pl.get("source"):
            f.error(name, sid, "no source URL, so the provenance cannot be audited")
        rel = pl.get("file")
        if not rel:
            f.warn(name, sid, "registered but not yet downloaded")
        elif not os.path.exists(os.path.join(ROOT, rel)):
            f.error(name, sid, "image file %s is missing from disk" % rel)

    drawn = len(species) - len(plates)
    f.check(name, "Historical plates carry artist, work, year, licence and source; "
                  "%d species use a plate, %d the drawn study" % (len(plates), drawn),
            len(plates), f.count(name, "warning"), f.count(name, "error"))


def fetch(url):
    """Return (state, detail) where state is 'ok', 'gone' or 'unverified'.

    The distinction matters. A 404 means the page a reader would click has
    genuinely vanished and the entry must be fixed. A timeout or a TLS
    negotiation failure means this runner could not reach it, which is not the
    same claim at all, and is reported as unverified rather than as a death.
    """
    ctx = ssl.create_default_context()
    soft = None
    for method in ("HEAD", "GET"):
        req = urllib.request.Request(url, method=method, headers={
            "User-Agent": UA,
            "Accept": "text/html,application/xhtml+xml,*/*;q=0.8",
        })
        try:
            with urllib.request.urlopen(req, timeout=TIMEOUT, context=ctx) as r:
                if r.status < 400:
                    return "ok", str(r.status)
                if method == "GET":
                    soft = "HTTP %s" % r.status
        except urllib.error.HTTPError as e:
            # Plenty of sites reject HEAD outright; only a failed GET counts.
            if method == "GET":
                if e.code in (403, 405, 406, 429):
                    return "ok", "HTTP %d (bot filter, page live)" % e.code
                soft = "HTTP %d" % e.code
        except urllib.error.URLError as e:
            if method == "GET":
                soft = "unreachable: %s" % (getattr(e, "reason", e),)
        except Exception as e:                      # noqa: BLE001 - report anything
            if method == "GET":
                soft = "%s: %s" % (type(e).__name__, e)

    code, note = _curl(url)
    if code is not None and code < 400:
        return "ok", "HTTP %d (via curl)" % code
    if code in (403, 405, 406, 429):
        return "ok", "HTTP %d (bot filter, page live)" % code
    if code is not None and code >= 400:
        return "gone", "HTTP %d" % code
    detail = soft or note or "no response"
    if "Name or service not known" in detail or "nodename nor servname" in detail:
        return "gone", "domain does not resolve"
    return "unverified", detail


def check_links(orgs, sources, f, workers=8):
    """Dead links are the failure mode most likely to mislead a would-be donor."""
    name = "Link liveness"
    targets = ([("organisation", o["id"], o["url"]) for o in orgs] +
               [("source", s["id"], s["url"]) for s in sources])
    results = {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as pool:
        futures = {pool.submit(fetch, url): (kind, rid, url) for kind, rid, url in targets}
        for fut in concurrent.futures.as_completed(futures):
            kind, rid, url = futures[fut]
            try:
                state, detail = fut.result()
            except Exception as e:                  # noqa: BLE001
                state, detail = "unverified", "checker error: %s" % e
            results[rid] = (state, detail)
            if state == "gone":
                f.error(name, "%s %s" % (kind, rid),
                        "%s is gone (%s) — the entry needs a new link" % (url, detail))
            elif state == "unverified":
                f.warn(name, "%s %s" % (kind, rid),
                       "%s could not be reached from this runner (%s); not confirmed dead"
                       % (url, detail))
    f.check(name, "Every organisation and source URL still answers",
            len(targets), f.count(name, "warning"), f.count(name, "error"))
    return results


def sketch_keys_from_library():
    """Read the plate keys straight out of the sketch library."""
    path = os.path.join(ROOT, "assets", "sketches.js")
    if not os.path.exists(path):
        return None
    import re
    src = open(path, encoding="utf-8").read()
    keys = set()
    for m in re.finditer(r'map\("([^"]+)"', src):
        keys.update(m.group(1).split())
    return keys or None


# ----------------------------------------------------------------------- main
def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--offline", action="store_true", help="skip live URL checks")
    ap.add_argument("--strict", action="store_true", help="exit non-zero on warnings too")
    ap.add_argument("--out", default=REPORT, help="where to write the report")
    args = ap.parse_args()

    species = load("species.json")["species"]
    orgs = load("organizations.json")["organizations"]
    sources = load("sources.json")["sources"]
    cj = load("countries.json")
    countries, continents = cj["countries"], cj["continents"]
    sketch_keys = sketch_keys_from_library()

    f = Findings()
    check_shape(species, f)
    check_references(species, orgs, sources, countries, sketch_keys, f)
    check_populations(species, f)
    check_citations(species, sources, f)
    check_staleness(species, f)
    check_coverage(species, countries, continents, f)
    check_org_quality(species, orgs, f)
    check_plates(species, f)

    if args.offline:
        mode = "structural checks only (--offline)"
    else:
        check_links(orgs, sources, f)
        mode = "structural checks plus %d live link checks" % (len(orgs) + len(sources))

    errors = sum(1 for i in f.issues if i["level"] == "error")
    warnings = sum(1 for i in f.issues if i["level"] == "warning")
    status = "fail" if errors else ("warn" if warnings else "pass")

    report = {
        "generatedAt": datetime.datetime.now(datetime.timezone.utc)
                               .strftime("%Y-%m-%dT%H:%M:%SZ"),
        "status": status,
        "mode": mode,
        "iucnTokenPresent": bool(os.environ.get("IUCN_API_TOKEN")),
        "totals": {
            "species": len(species), "organizations": len(orgs),
            "sources": len(sources), "countries": len(countries),
            "errors": errors, "warnings": warnings,
        },
        "checks": f.checks,
        # Errors first, then warnings; the page renders them in this order.
        "issues": ([i for i in f.issues if i["level"] == "error"] +
                   [i for i in f.issues if i["level"] == "warning"]),
    }
    with open(args.out, "w", encoding="utf-8") as fh:
        json.dump(report, fh, ensure_ascii=False, indent=1)

    print("Field Notes verification — %s" % status.upper())
    print("  %s" % mode)
    for c in f.checks:
        flag = "FAIL" if c["failed"] else ("warn" if c["warned"] else "ok")
        print("  %-18s %5d checked  %-4s %s" % (
            c["name"], c["checked"], flag,
            ("%d failed" % c["failed"]) if c["failed"] else
            ("%d to review" % c["warned"]) if c["warned"] else ""))
    print("  %d errors, %d warnings" % (errors, warnings))
    print("  wrote %s" % os.path.relpath(args.out, ROOT))

    if errors:
        for i in report["issues"][:25]:
            if i["level"] == "error":
                print("    ERROR  %-16s %-28s %s" % (i["check"], i["record"], i["message"]))
        return 1
    if args.strict and warnings:
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
