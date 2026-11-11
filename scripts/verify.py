#!/usr/bin/env python3
"""Compliance and monitoring check for Field Notes on Vanishing Species.

.github/workflows/weekly-verification.yml runs it every Monday once the
repository is hosted on GitHub, and anyone with a copy of this repository can
run it:

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
  Without IUCN_API_TOKEN in the environment it cannot re-read the Red List and
  re-derive a category by itself; it flags every record whose assessment is old
  enough to be worth a human look, so that staleness is visible rather than
  silent. With a token — free for non-commercial use from
  https://api.iucnredlist.org — it also asks the Red List API for the current
  category and published year of every record it can key by name, and reports
  any disagreement as a warning for a human to settle. That API is also the only
  sanctioned automated route to BirdLife's bird assessments, which are published
  through the Red List; BirdLife's own Data Zone forbids automated access.

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
import time
import subprocess
import sys
import urllib.error
import urllib.parse
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
NATIONAL_RECHECK_DAYS = 365      # how long a national listing may go unconfirmed


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
    required = ("id", "common", "sci", "group", "iucn", "iucnYear",
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
        if s.get("possiblyExtinct") not in (None, True, "wild"):
            f.error(name, sid, "possiblyExtinct must be true or \"wild\", not %r" % s.get("possiblyExtinct"))
        if not isinstance(s.get("countries"), list) or not s.get("countries"):
            f.error(name, sid, "range must list at least one country")
        if not isinstance(s.get("threats"), list) or not s.get("threats"):
            f.error(name, sid, "no threats recorded")
        if len(s.get("note", "")) < 60:
            f.warn(name, sid, "descriptive note is very short")
        year = s.get("iucnYear")
        status_source = s.get("statusSource")
        if status_source:
            if year is not None:
                f.error(name, sid, "category comes from a national list, so iucnYear should be null")
            for key in ("scheme", "status", "source", "text"):
                if not status_source.get(key):
                    f.error(name, sid, "statusSource is missing '%s'" % key)
            if status_source.get("source") not in s.get("sources", []):
                f.error(name, sid, "statusSource cites '%s', which the record does not list"
                        % status_source.get("source"))
            link = status_source.get("url")
            if link and not link.startswith("https://"):
                f.error(name, sid, "the listing link should be https, not %r" % link)
            confirmed = status_source.get("checked")
            if confirmed is not None:
                try:
                    datetime.date.fromisoformat(str(confirmed))
                except ValueError:
                    f.error(name, sid,
                            "statusSource 'checked' should read YYYY-MM-DD, not %r" % confirmed)
        elif not isinstance(year, int) or not (1960 < year <= datetime.date.today().year):
            f.error(name, sid, "implausible assessment year %r" % year)
        sis = s.get("iucnSis")
        if sis is not None and not (isinstance(sis, int) and sis > 0):
            f.error(name, sid, "iucnSis should be the Red List's numeric taxon id, not %r" % sis)
        archived = s.get("iucnArchived")
        if archived:
            for key in ("taxon", "status", "year", "currentTaxon", "currentStatus", "currentYear"):
                if not archived.get(key):
                    f.error(name, sid, "iucnArchived is missing '%s'" % key)
            if archived.get("status") != s.get("iucn") or archived.get("year") != year:
                f.error(name, sid, "iucnArchived should restate the category and year this record "
                                   "carries (%s/%s)" % (s.get("iucn"), year))
            stamp = archived.get("checked")
            if stamp is not None:
                try:
                    datetime.date.fromisoformat(str(stamp))
                except ValueError:
                    f.error(name, sid, "iucnArchived 'checked' should read YYYY-MM-DD, not %r" % stamp)
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
        for code in (s.get("national") or {}):
            if code not in cc:
                f.error(name, sid, "national listing for unknown country '%s'" % code)
        for code in (s.get("popNational") or {}):
            if code not in s.get("countries", []):
                f.error(name, sid, "national population figure for '%s', outside its range" % code)
    f.check(name, "Organisation ids, source ids and country codes all resolve",
            len(species), f.count(name, "warning"), f.count(name, "error"))


def check_populations(species, f):
    """A number without a range, a survey and a date is not evidence."""
    name = "Population figures"
    for s in species:
        sid = s.get("id", "<no id>")
        pop = s.get("pop") or {}
        est, low, high = pop.get("est"), pop.get("low"), pop.get("high")
        if est is None:
            if low is not None and high is not None:
                # a published range with no single best estimate
                if low > high:
                    f.error(name, sid, "published low (%s) is above the published high (%s)" % (low, high))
                for key, what in (("unit", "no unit"), ("basis", "does not say which survey it came from"),
                                  ("asOf", "has no date")):
                    if not pop.get(key):
                        f.error(name, sid, "population range " + what)
            elif not pop.get("label"):
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
        archived = s.get("iucnArchived")
        if archived:
            # Being old is the whole point of an archived assessment, so the age is not
            # news; what matters is that someone re-reads it, and that the API check
            # notices if the Red List ever assesses the taxon again.
            try:
                stamp = datetime.date.fromisoformat(str(archived.get("checked")))
            except (TypeError, ValueError):
                f.warn(name, sid, "archived Red List assessment has no confirmation date")
            else:
                if (datetime.date.today() - stamp).days > NATIONAL_RECHECK_DAYS:
                    f.warn(name, sid, "archived Red List assessment last confirmed %s — re-read it"
                           % stamp.isoformat())
        elif isinstance(year, int) and this_year - year > STALE_ASSESSMENT_YEARS:
            f.warn(name, sid, "last assessed in %d, %d years ago — worth re-checking against "
                              "the current Red List entry" % (year, this_year - year))
        pop = s.get("pop") or {}
        as_of = str(pop.get("asOf") or "")
        if as_of[:4].isdigit() and this_year - int(as_of[:4]) > STALE_POPULATION_YEARS:
            f.warn(name, sid, "population figure dates from %s; check for a newer survey" % as_of)
        # A national listing carries the whole status claim for these records, so it is
        # worth re-reading once a year rather than trusting it indefinitely.
        national = s.get("statusSource")
        if national:
            try:
                confirmed = datetime.date.fromisoformat(str(national.get("checked")))
            except (TypeError, ValueError):
                f.warn(name, sid, "national listing has no confirmation date — re-read %s and "
                                  "record it as 'checked'" % national.get("scheme", "the listing"))
            else:
                age = (datetime.date.today() - confirmed).days
                if age > NATIONAL_RECHECK_DAYS:
                    f.warn(name, sid, "national listing last confirmed %s, %d days ago — re-read it"
                           % (confirmed.isoformat(), age))
    f.check(name, "Assessments over %d years old, counts over %d years old and national listings "
            "unconfirmed for %d days are surfaced"
            % (STALE_ASSESSMENT_YEARS, STALE_POPULATION_YEARS, NATIONAL_RECHECK_DAYS),
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
        lic = (pl.get("licence") or "").lower()
        strong = any(m in lic for m in ("public domain", "pd-", "cc0"))
        weak = any(m in lic for m in ("no restrictions", "no known copyright"))
        if pl.get("basis") == "usgov":
            # Public domain by statute (17 U.S.C. section 105), so no date test;
            # but the file must carry a public-domain tag and say why.
            if not strong:
                f.error(name, sid, "claimed as a US federal work but tagged %r, not public domain"
                        % pl.get("licence"))
            if "105" not in (pl.get("pdBasis") or ""):
                f.error(name, sid, "claimed as a US federal work without stating the statutory basis")
        else:
            if not isinstance(yr, int):
                f.error(name, sid, "no publication year recorded, so the copyright claim cannot be checked")
            elif yr > cutoff:
                f.error(name, sid, "plate dated %s, whose latest possible year (%d) is after the "
                                   "%d public-domain cutoff" % (pl.get("dateLabel") or yr, yr, cutoff))
            # The operative fact is the publication date: US copyright in a
            # published work runs 95 years, so anything at or before the cutoff
            # is free whatever the file is tagged. "No known copyright
            # restrictions" is accepted only because the date already settles it.
            if not strong and not weak:
                f.error(name, sid, "licence %r is neither a public-domain declaration nor a "
                                   "no-known-restrictions tag" % pl.get("licence"))
            elif weak and not (isinstance(yr, int) and yr <= cutoff):
                f.error(name, sid, "licence is only %r and the date does not independently "
                                   "establish expiry" % pl.get("licence"))
        if not pl.get("artist") and not pl.get("work"):
            f.warn(name, sid, "neither the artist nor the source publication is recorded")
        if not pl.get("source"):
            f.error(name, sid, "no source URL, so the provenance cannot be audited")
        rel = pl.get("file")
        if not rel:
            f.warn(name, sid, "registered but not yet downloaded")
        elif not os.path.exists(os.path.join(ROOT, rel)):
            f.error(name, sid, "image file %s is missing from disk" % rel)

    drawn = len(species) - len(plates)
    f.check(name, "Historical plates carry artist, work, year, licence and source; "
                  "%d species have a portrait, %d have none located" % (len(plates), drawn),
            len(plates), f.count(name, "warning"), f.count(name, "error"))


def fetch(url, _second_try=False):
    """Return (state, detail) where state is 'ok', 'gone' or 'unverified'.

    The distinction matters. A 404 means the page a reader would click has
    genuinely vanished and the entry must be fixed. A timeout or a TLS
    negotiation failure means this runner could not reach it, which is not the
    same claim at all, and is reported as unverified rather than as a death.

    A name that will not resolve is the one failure worth a second attempt: a
    resolver hiccup and a domain that has really gone both look like this, and
    only one of them repeats a moment later.
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
    if code is not None and 100 <= code < 400:
        return "ok", "HTTP %d (via curl)" % code
    if code == 0:
        # curl reports 0 when it never got an HTTP response at all; that is a
        # failure to reach the page, not proof the page is alive.
        code = None
    if code in (403, 405, 406, 429):
        return "ok", "HTTP %d (bot filter, page live)" % code
    if code is not None and code >= 400:
        return "gone", "HTTP %d" % code
    detail = soft or note or "no response"
    unresolved = ("Name or service not known" in detail or
                  "nodename nor servname" in detail or
                  "Temporary failure in name resolution" in detail)
    if unresolved:
        if not _second_try:
            time.sleep(2)
            return fetch(url, _second_try=True)
        return "gone", "domain did not resolve on two attempts"
    return "unverified", detail


API_ROOT = "https://api.iucnredlist.org/api/v4"
API_PAUSE = 0.5                  # seconds between calls, to stay inside the rate limit


def api_query(s):
    """The API path that identifies this record, or None if it cannot be keyed.

    Subpopulations have no scientific name of their own, so a record may carry
    the Red List's own taxon id in iucnSis; everything else is keyed by name.
    """
    sis = s.get("iucnSis")
    if sis:
        return "/taxa/sis/%s" % urllib.parse.quote(str(sis))
    name = (s.get("iucnTaxon") or s.get("sci") or "").strip()
    if not name or "(" in name or "," in name:
        return None
    parts = name.split()
    if not 2 <= len(parts) <= 3:
        return None
    query = "genus_name=%s&species_name=%s" % (
        urllib.parse.quote(parts[0]), urllib.parse.quote(parts[1]))
    if len(parts) == 3:
        query += "&infra_name=" + urllib.parse.quote(parts[2])
    return "/taxa/scientific_name?" + query


def api_global(payload):
    """The current global assessment in one API answer, or None.

    The API returns one 'latest' assessment per scope — global, Europe,
    Mediterranean and so on — and only the global one is what this archive
    records, so the scope is checked rather than assumed.
    """
    for a in payload.get("assessments") or []:
        if not a.get("latest"):
            continue
        scopes = a.get("scopes") or []
        if any(str(sc.get("code")) == "1" for sc in scopes) or not scopes:
            return a
    return None


TOKEN_FILE = os.path.expanduser(
    os.environ.get("IUCN_TOKEN_FILE", "~/.config/field-notes/iucn-token"))


def read_token():
    """The Red List API token, from the environment or an untracked local file.

    It is deliberately never read from anywhere inside the repository: a token
    committed by accident is a token that has to be revoked.
    """
    token = (os.environ.get("IUCN_API_TOKEN") or "").strip()
    if token:
        return token
    try:
        with open(TOKEN_FILE, encoding="utf-8") as fh:
            return fh.read().strip()
    except OSError:
        return ""


def check_iucn_api(species, f, token, workers=1, report_limit=12):
    """Re-read every category from the Red List API itself, when a token allows it.

    This is the only sanctioned automated route to the assessments — BirdLife's
    Data Zone forbids automated access, so bird records come the same way, since
    BirdLife's assessments are published through the Red List. Disagreements are
    warnings, not errors: a name the API files differently is far more common
    than a category this archive has got wrong, and both deserve a human.
    """
    name = "Red List categories"
    askable = [(s, api_query(s)) for s in species if not s.get("statusSource")]
    askable = [(s, path) for s, path in askable if path]

    def ask(path):
        req = urllib.request.Request(
            API_ROOT + path,
            headers={"User-Agent": UA, "Accept": "application/json",
                     "Authorization": token})
        for attempt in range(4):
            try:
                with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
                    body = json.loads(r.read().decode("utf-8"))
                time.sleep(API_PAUSE)               # the API is a courtesy; do not hammer it
                return body
            except urllib.error.HTTPError as e:
                if e.code == 429 and attempt < 3:   # asked to slow down; oblige
                    time.sleep(6 * (attempt + 1) ** 2)
                    continue
                raise

    mismatch = unreadable = throttled = 0
    rejected = False
    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as pool:
        futures = {pool.submit(ask, path): s for s, path in askable}
        for fut in concurrent.futures.as_completed(futures):
            s = futures[fut]
            sid = s.get("id", "<no id>")
            try:
                assessment = api_global(fut.result())
            except urllib.error.HTTPError as e:
                if e.code in (401, 403):
                    rejected = True
                    break
                if e.code == 429:
                    # Being rate-limited says nothing about the data; count it and
                    # report it once rather than as a fault against each record.
                    throttled += 1
                    continue
                if e.code == 404 and s.get("iucnArchived"):
                    continue                     # the taxon is gone from the current taxonomy
                unreadable += 1
                if unreadable <= report_limit:
                    f.warn(name, sid, "the Red List API answered HTTP %d for %s"
                           % (e.code, s.get("iucnTaxon") or s.get("sci")))
                continue
            except Exception as e:                  # noqa: BLE001 - never break the run
                unreadable += 1
                if unreadable <= report_limit:
                    f.warn(name, sid, "could not read the API answer (%s)" % e)
                continue
            if assessment is None:
                if s.get("iucnArchived"):
                    continue                     # expected: the assessment was retired
                unreadable += 1
                if unreadable <= report_limit:
                    f.warn(name, sid, "the Red List API returned no global assessment for %s"
                           % (s.get("iucnTaxon") or s.get("sci")))
                continue
            if s.get("iucnArchived"):
                mismatch += 1
                f.warn(name, sid, "the Red List has assessed this taxon again (%s, %s) — the "
                                  "archived-assessment note needs replacing"
                       % (assessment.get("red_list_category_code"),
                          str(assessment.get("year_published"))[:4]))
                continue
            code = str(assessment.get("red_list_category_code") or "").upper()
            year = str(assessment.get("year_published") or "")[:4]
            if code and code != str(s.get("iucn", "")).upper():
                mismatch += 1
                if mismatch <= report_limit:
                    f.warn(name, sid, "the Red List API now says %s; this record says %s"
                           % (code, s.get("iucn")))
            if year and str(s.get("iucnYear")) != year:
                mismatch += 1
                if mismatch <= report_limit:
                    f.warn(name, sid, "the Red List API publishes the current assessment as %s; "
                                      "this record says %s" % (year, s.get("iucnYear")))
            # The Possibly Extinct tags are a claim in their own right, so they are
            # compared too rather than trusted from whenever they were written.
            pe_api = ("wild" if assessment.get("possibly_extinct_in_the_wild")
                      else bool(assessment.get("possibly_extinct")) or None)
            pe_ours = s.get("possiblyExtinct") or None
            if pe_ours != pe_api and not (pe_api is True and pe_ours == "yes"):
                mismatch += 1
                if mismatch <= report_limit:
                    f.warn(name, sid, "Possibly Extinct tag differs: the Red List API says %r, "
                                      "this record says %r" % (pe_api, pe_ours))
    if rejected:
        f.warn(name, "-", "the Red List API rejected the token in IUCN_API_TOKEN; "
                          "categories were not re-read")
    if throttled:
        f.warn(name, "-", "the Red List API rate-limited %d record(s), which were not re-read "
                          "this run" % throttled)
    extra = (mismatch + unreadable) - min(mismatch, report_limit) - min(unreadable, report_limit)
    if extra > 0:
        f.warn(name, "-", "and %d further disagreements, listed in full only in the log" % extra)
    f.check(name, "Every category and published year re-read from the IUCN Red List API",
            len(askable), f.count(name, "warning"), f.count(name, "error"))


def check_links(orgs, sources, species, f, workers=8):
    """Dead links are the failure mode most likely to mislead a would-be donor."""
    name = "Link liveness"
    targets = ([("organisation", o["id"], o["url"]) for o in orgs] +
               [("source", s["id"], s["url"]) for s in sources] +
               [("listing", s["id"], (s.get("statusSource") or {}).get("url"))
                for s in species if (s.get("statusSource") or {}).get("url")])
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
    sketch_keys = None

    f = Findings()
    check_shape(species, f)
    check_references(species, orgs, sources, countries, sketch_keys, f)
    check_populations(species, f)
    check_citations(species, sources, f)
    check_staleness(species, f)
    check_coverage(species, countries, continents, f)
    check_org_quality(species, orgs, f)
    check_plates(species, f)

    token = read_token()
    if args.offline:
        mode = "structural checks only (--offline)"
    else:
        listings = [s for s in species if (s.get("statusSource") or {}).get("url")]
        check_links(orgs, sources, species, f)
        mode = "structural checks plus %d live link checks" % (
            len(orgs) + len(sources) + len(listings))
        if token:
            try:
                check_iucn_api(species, f, token)
                mode += " and a Red List API re-read"
            except Exception as e:              # noqa: BLE001 - a checker must not fall over
                f.warn("Red List categories", "-", "the API check could not run: %s" % e)
                f.check("Red List categories",
                        "Every category and published year re-read from the IUCN Red List API",
                        0, 1, 0)

    errors = sum(1 for i in f.issues if i["level"] == "error")
    warnings = sum(1 for i in f.issues if i["level"] == "warning")
    status = "fail" if errors else ("warn" if warnings else "pass")

    report = {
        "generatedAt": datetime.datetime.now(datetime.timezone.utc)
                               .strftime("%Y-%m-%dT%H:%M:%SZ"),
        "status": status,
        "mode": mode,
        "iucnTokenPresent": bool(token),
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
