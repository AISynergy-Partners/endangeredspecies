# Field Notes on Vanishing Species

An illustrated atlas of the world's endangered species — world map, then
continent, then country, then twenty plates of what lives there and how few are
left. Every figure is cited. Every organisation named is real, working on that
species, and re-checked weekly.

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
verification.html     what the last weekly check found

data/*.json           the source of truth — edit these
assets/data.js        generated from data/ by scripts/build.py
assets/sketches.js    the plate engraver: 55 base forms, 163 species keys
assets/flags.js       the flag engraver: 206 drawn flags from compact specs
assets/app.js         page logic, ranking, projected world map, counters
assets/field.css      the whole visual system

scripts/build.py      data/*.json  ->  assets/data.js
scripts/verify.py     the weekly compliance and monitoring check
scripts/serve.py      local static server
```

## How the figures work

**Historical plates** (`scripts/plates.py`, `data/plates.json`,
`assets/plates/`). 121 of the 280 species carry a natural-history plate whose
copyright has expired — Brehm's *Tierleben*, Lydekker's handbooks, Gould's
monographs, and illustrators such as Joseph Wolf, Joseph Smit and John Gerrard
Keulemans. Sourcing is a pipeline, not a manual hunt:

```bash
python3 scripts/plates.py harvest    # pull whole works from Commons categories
python3 scripts/plates.py match      # assign pooled plates to species offline
python3 scripts/plates.py download   # fetch and downscale the accepted ones
python3 scripts/plates.py sheet      # contact sheets for visual review
python3 scripts/plates.py audit      # re-check provenance of the registry
python3 scripts/plates.py reject ID  # drop one that failed review
```

Harvesting whole works rather than searching species by species is what keeps
the pool historical by construction and the API load small. Matching then runs
offline against the pool, and requires the file's own metadata to name the
species — by current binomial, by a recorded historical synonym (a Victorian
plate says *Felis leo*, not *Panthera leo*), or by full common name. A looser
genus-plus-stem rule was tried and matched a bonobo to a plate of sparrows, so
it is gone.

Four hard gates are applied to every candidate: a public-domain licence, a
recorded date at or before 1928, no usage restrictions, and enough resolution
to be a plate. Every accepted plate is then reviewed by eye on a contact sheet
before it ships. `scripts/verify.py` re-checks the provenance weekly.

**Drawn studies** (`assets/sketches.js`) are the fallback, and the only figure
for species described after the plate era — the saola (1992), the Tapanuli
orangutan (2017), Rice's whale (2021). Nobody engraved those.

55 base forms mapped to 163 species keys.
Each form is drawn on a measured facial or skeletal grid rather than by eye,
because a head drawn by eye comes out as a teddy bear. Every path is stroked in
a weight hierarchy — heavy contour, lighter interior structure, fine detail,
finer shading — and shading is clipped inside the silhouette. A very small
turbulence displacement keeps the line from being mechanical without making it
wobble.

The view follows field-guide practice: whatever identifies the animal. Cats,
canids, bears and primates are head-and-shoulders portraits, because the face
is the identification. Ungulates are profile heads, because the horns are.
Birds are profile heads, because the bill is. Fish, cetaceans, reptiles and
invertebrates are whole animals, because the outline is.

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

## The weekly check

`scripts/verify.py` runs every Monday via
`.github/workflows/weekly-verification.yml`, and anyone can run it:

```bash
python3 scripts/verify.py            # everything, including live link checks
python3 scripts/verify.py --offline  # structural checks only
python3 scripts/verify.py --strict   # exit non-zero on warnings too
```

It checks record shape and types; that every organisation id, source id, country
code and plate key resolves; that population ranges bracket their own estimate
and carry a survey and a date; that every species rests on at least one primary
assessment; that assessments and counts old enough to warrant a human look are
surfaced; that every continent and country page can render; and that all 210
organisation and source URLs still answer.

It writes `data/verification-report.json`, which the site renders at
`/verification.html`. It never edits the species data — a checker that edits the
thing it checks is not a checker.

Two deliberate limits, both stated on the site:

- It cannot re-read the IUCN Red List and re-derive a category on its own; that
  needs an API token this project does not hold. Instead it flags every record
  old enough to be worth re-checking, so staleness is visible rather than silent.
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

Nothing here is copied. Species names, Red List categories, assessment years and
published population estimates are facts, which are not copyrightable, and they
are reproduced as facts with their sources named.

- **Historical plates** are out of copyright: only works published in 1928 or
  earlier are used, which is comfortably inside the public domain, since US
  copyright in a published work runs 95 years. A faithful photographic
  reproduction of a two-dimensional public-domain artwork does not attract a new
  copyright — *Bridgeman v. Corel* in the US, Article 14 of the EU Copyright
  Directive in the EU — so the scan is as free as the engraving. Every plate is
  credited under the figure and listed in full at `/references.html#plate-list`,
  and its provenance is re-checked weekly.
- **Drawn studies** are generated as original vector work by
  `assets/sketches.js` — 55 hand-authored base forms built on measured
  proportion grids. Nothing is traced, photographed or adapted from another
  artist's work.
- **The world map** is drawn from hand-entered coastline coordinates and
  projected equirectangularly. It is not derived from any commercial or open
  geodata product.
- **Flags** are drawn by `assets/flags.js` from compact geometric specs written
  for this project. Flags of state are not copyrightable subject matter, and in
  any case none of this artwork is traced or copied; no flag image is bundled or
  hot-linked.
- **Fonts** are Fraunces, EB Garamond and Caveat, all Open Font License, served
  from Google Fonts.

No text or bulk database extract has been taken from any source in the
bibliography. The only images taken from elsewhere are the historical plates
described above, all of them out of copyright and all of them credited.

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
checker will tell you what is missing. A record needs a `sketch` key that
`assets/sketches.js` defines, at least one primary-assessment source, three
organisation ids, and either a population estimate with a survey and a date or a
`pop.label` explaining why there isn't one.

---

© 2026 AISynergy Partners. Text and drawings are ours; the underlying facts are
cited, not owned.
