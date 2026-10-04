# Field Notes on Vanishing Species

An illustrated register of the world's endangered species — world map, then
continent, then country, then twenty plates of what lives there and how few are
left. Every figure is cited. Every organisation named is real, working on that
species, and re-checked by the verification script.

No build tooling, no framework, no dependencies. Static HTML, one stylesheet,
three scripts.

## Running it

Either open `index.html` straight off disk, or serve the folder:

```bash
python3 scripts/serve.py 8651 "$(pwd)"
```

The site reads `assets/data.js` rather than fetching the JSON, so it works from
`file://` as well as over HTTP.

## How it fits together

```
index.html            world map, by continent
continent.html?c=…    countries of that continent, each as a stamp
country.html?c=…      the twenty most endangered species there
references.html       every source, every organisation, method and rights
verification.html     what the last verification run found

data/*.json           the source of truth — edit these
assets/data.js        generated from data/ by scripts/build.py
assets/flags.js       the flag engraver: 206 drawn flags from compact specs
assets/app.js         page logic, ranking, projected world map, counters
assets/field.css      the whole visual system

scripts/build.py      data/*.json  ->  assets/data.js
scripts/verify.py     the compliance and monitoring check
scripts/plates.py     sources, reviews and audits the portrait plates
scripts/serve.py      local static server
```

## How the figures work

**Portraits** (`scripts/plates.py`, `data/plates.json`, `assets/plates/`).
Every figure is a finished natural-history portrait in the public domain. 205 of
the 278 species currently carry one — lithographs and engravings from Brehm's
*Tierleben*, Lydekker's handbooks and Gould's monographs, by illustrators such as
Joseph Wolf, Joseph Smit and John Gerrard Keulemans. Where no public-domain
portrait of a species has been located, the plate says so plainly rather than
showing a stand-in drawing. Sourcing is a pipeline, not a manual hunt:

```bash
python3 scripts/plates.py harvest       # pull whole works from Commons categories
python3 scripts/plates.py match         # assign pooled plates to species offline
python3 scripts/plates.py candidates    # compare alternatives side by side as thumbnails
python3 scripts/plates.py assign ID T   # pin a chosen plate to a species by hand
python3 scripts/plates.py download      # fetch, crop and downscale the accepted ones
python3 scripts/plates.py sheet         # contact sheets for visual review
python3 scripts/plates.py audit         # re-check provenance of the registry
python3 scripts/plates.py reject ID     # drop a plate that failed review
```

Harvesting whole works rather than searching species by species keeps the API
load small. Matching runs offline against the pool, and requires the file's own
metadata to name the species — by current binomial, by a recorded historical
synonym (a Victorian plate says *Felis leo*, not *Panthera leo*), or by full
common name. A looser genus-plus-stem rule was tried and matched a bonobo to a
plate of sparrows, so it is gone.

Two routes into the public domain are accepted, and nothing else:

- **By age** — a public-domain licence, a recorded date at or before 1928, and no
  usage restrictions. Where a source gives a range ("between 1700 and 1880") the
  later bound is used, because the claim has to hold at the worst case.
- **By statute** — illustration made by the United States federal government (the
  US Fish and Wildlife Service, NOAA), which 17 U.S.C. §105 places in the public
  domain whatever its date. Most federal imagery is photography, so these files
  must also read as illustration, and the licence evidence is taken only from
  licence tags, never from a description. The agency's own page is checked as
  well: NOAA Fisheries credits outside artists where it uses their work, so only
  an illustration it leaves uncredited (or signs itself) is accepted.

Metadata is necessary but not sufficient. Every plate is reviewed by eye before it
ships, against a portrait standard: photographs, anatomical diagrams, faint
sketches, crowded multi-species pages and scenes in which the animal is lost are
turned away, and so are plates that turn out to show the wrong animal — review has
caught a scarlet macaw catalogued as a hyacinth macaw, a lion–tiger hybrid
catalogued as a tiger, and a photograph of a museum diorama. A rejection bans the
file, not the species, so a better plate can still be found. Where the automatic
crop cuts a plate badly, `data/plates.json` records a crop by hand.
`scripts/verify.py` re-checks every plate's provenance each time it runs.

**Flags** (`assets/flags.js`). All 206 flags described as compact specs — a
field of bands plus overlays such as discs, crosses, saltires, crescents and
stars — drawn onto a slightly irregular cloth with an ink edge and a soft fold.
Colours are pulled a few steps towards the paper so two hundred flags read as a
plate of stamps rather than a paint box. Where a flag carries an intricate coat
of arms the device is drawn as a simplified emblem.

**The world map** (`assets/app.js`). Coastlines given as [lat, lon] and
projected equirectangularly, so the continents are the real shapes rather than
invented blobs.

After editing anything under `data/`, run:

```bash
python3 scripts/build.py
```

## The verification check

`.github/workflows/weekly-verification.yml` runs `scripts/verify.py` every Monday
once the repository is hosted on GitHub, and anyone can run it:

```bash
python3 scripts/verify.py            # everything, including live link checks
python3 scripts/verify.py --offline  # structural checks only
python3 scripts/verify.py --strict   # exit non-zero on warnings too
```

It checks record shape and types; that every organisation id, source id, country code resolves; that population ranges bracket their own estimate
and carry a survey and a date; that every species rests on at least one primary
assessment; that assessments and counts old enough to warrant a human look are
surfaced; that every continent and country page can render; and that all 210
organisation and source URLs still answer.

It writes `data/verification-report.json`, which the site renders at
`/verification.html`. It never edits the species data — a checker that edits the
thing it checks is not a checker.

Set `IUCN_API_TOKEN` and it goes further: it asks the IUCN Red List API for the
current category and published year of every record it can key by a scientific
name, and reports any disagreement as a warning. A token is free for
non-commercial use from <https://api.iucnredlist.org>, and the weekly workflow
reads it from the repository secret of the same name. That API is also the only
sanctioned automated route to the bird assessments: BirdLife International
compiles them and the Red List publishes them, while BirdLife's own Data Zone
forbids automated access, so nothing here is taken from it.

The token lives outside the repository — `~/.config/field-notes/iucn-token`, or
wherever `IUCN_TOKEN_FILE` points — so it cannot be committed by accident. Never
put it in a file inside this repo.

The five species the Red List does not assess separately carry a `statusSource`
block instead, with the scheme, the status, the wording, a link to that taxon's
own listing page and the date a human last read it. The check requests those
listing links with every other link, and warns when a listing has gone a year
without being re-read.

Two records — the Asiatic and West African lion subpopulations — carry `iucnSis`,
the Red List's own taxon id, because a subpopulation has no scientific name the
API can be keyed by. With it, every record in the archive except the five on
national listings is re-read automatically.

Seven subspecies — four tigers, the Amur leopard and two cheetahs — carry an
`iucnArchived` block. The Red List assessed each of them once and no longer does:
their names have either left its taxonomy or been marked Not Evaluated, and the
animals are now covered by a species-level assessment. The block records the
archived assessment and the current one, the species page says so in plain words
rather than presenting a retired assessment as current, and the API check watches
for the day the Red List assesses any of them again.

One deliberate limit, stated on the site:

- It separates *gone* from *unreachable*. A 404 or a domain that no longer
  resolves is an error and must be fixed. A timeout or a TLS negotiation failure
  is reported as unverified, because "we could not reach it from this runner" is
  not the same claim as "it is dead".

## Where the data comes from

The global IUCN Red List is the spine. National and regional registers are shown
alongside it wherever a species carries one — the US Endangered Species Act and
NatureServe's G1–G5 ranks, Canada's SARA, Australia's EPBC Act, Brazil's ICMBio
red book, New Zealand's threat classification, Mexico's NOM-059, the European
Red List. They frequently disagree with the global list, and the disagreement is
informative, so both are shown.

All 53 references are listed with full citations at `/references.html`.

## On copyright

This archive is non-commercial: no advertising, nothing for sale, no sponsorship or
affiliate revenue. It is published for education and conservation, which is the
basis on which the licensed data below is used.

The writing on this site is original. Two kinds of material come from
elsewhere, and both are credited where they appear.

- **Portraits** are historical natural-history illustrations in the public
  domain, reproduced from scans on Wikimedia Commons. A plate is accepted on one
  of two grounds: publication in 1928 or earlier, outside the 95-year US term for
  published works, or creation by the US federal government, which
  17 U.S.C. §105 places in the public domain. A faithful photographic
  reproduction of a two-dimensional public-domain artwork does not attract a new
  copyright (*Bridgeman v. Corel* in the US; Article 14 of the EU Directive on
  Copyright in the Digital Single Market). Every plate is credited under its
  figure and listed in full at `/references.html#plate-list`.
- **Data.** Conservation status, trend, range and most population figures
  restate data from the IUCN Red List of Threatened Species and the other
  sources in `data/sources.json`, and each species record names its sources.
  Those data stay subject to their publishers' terms. The IUCN Red List Terms
  and Conditions of Use cover conservation, education and research use, ask for
  the Red List version to be cited (IUCN 2026, Version 2026-1), and do not allow
  commercial use, which they define to include any use by a for-profit entity,
  without IUCN's written permission. BirdLife International, the Red List
  Authority for birds, sets similar terms for its data.
- **The world map** is drawn in the browser from coastline coordinates stored in
  `assets/app.js`.
- **Flags** are drawn by `assets/flags.js` from compact geometric specs written
  for this project; no flag image is bundled or hot-linked.
- **Fonts** are Fraunces, EB Garamond and Caveat, all Open Font License, served
  from Google Fonts.

## On the organisations

Three are named under each species. To be listed, a body must be a functioning
conservation organisation with a public giving page, and must do documented work
on that species, its habitat, or the specific threat driving its decline.
Preference goes to organisations based in the range country, then to
species-specific funds, then to the large international bodies.

Only homepages are stored, never deep donate links: those rot quietly, whereas a
homepage is stable and every organisation here carries a visible giving link.

This archive takes no commission, holds no affiliate arrangement with any
organisation listed, and receives nothing if you give.

## Adding a species

Add a record to `data/species.json`, then run `build.py` and `verify.py`. The
checker will tell you what is missing. A record needs at least one primary-assessment source, three
organisation ids, and either a population estimate with a survey and a date or a
`pop.label` explaining why there isn't one.

---

© 2026 AISynergy Partners. Text, map and flags are ours; the portraits are public domain;
the underlying facts are cited, not owned.
