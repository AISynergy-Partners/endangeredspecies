/* ===========================================================================
   Field Notes on Vanishing Species — page logic
   Vanilla, no build step. Data arrives as window.FNDATA (see scripts/build.py).
   =========================================================================== */
(function () {
  "use strict";

  var D = window.FNDATA || {};
  var COUNTRIES = (D.countries && D.countries.countries) || [];
  var CONTINENTS = (D.countries && D.countries.continents) || [];
  var SPECIES = (D.species && D.species.species) || [];
  var ORGS = (D.organizations && D.organizations.organizations) || [];
  var SOURCES = (D.sources && D.sources.sources) || [];
  var REPORT = D.report || null;
  var PLATES = (D.plates && D.plates.plates) || {};

  var byCode = {}, byOrg = {}, bySource = {}, byContinent = {};
  COUNTRIES.forEach(function (c) { byCode[c.code] = c; });
  ORGS.forEach(function (o) { byOrg[o.id] = o; });
  SOURCES.forEach(function (s) { bySource[s.id] = s; });
  CONTINENTS.forEach(function (c) { byContinent[c.id] = c; });

  /* species index by country */
  var inCountry = {};
  SPECIES.forEach(function (s) {
    s.countries.forEach(function (cc) {
      (inCountry[cc] || (inCountry[cc] = [])).push(s);
    });
  });

  var CAT_NAME = {
    EW: "Extinct in the Wild", CR: "Critically Endangered", EN: "Endangered",
    VU: "Vulnerable", NT: "Near Threatened", LC: "Least Concern", DD: "Data Deficient"
  };
  var CAT_W = { EW: 700, CR: 600, EN: 450, VU: 300, NT: 150, LC: 60, DD: 200 };
  var TREND = { dec: "declining", inc: "increasing", stable: "stable", unknown: "trend unknown" };
  var GROUP_NAME = {
    mammal: "Mammal", bird: "Bird", reptile: "Reptile", amphibian: "Amphibian",
    fish: "Fish", invertebrate: "Invertebrate", plant: "Plant"
  };

  /* ------------------------------------------------------------- utilities */
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function el(html) {
    var t = document.createElement("template");
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  }
  function qs(name) {
    return new URLSearchParams(location.search).get(name);
  }
  function num(n) { return Number(n).toLocaleString("en-GB"); }
  /* Flags are drawn by assets/flags.js rather than set as Unicode
     regional-indicator characters. Emoji flags are rendered as two bare
     letters by most Windows browsers, and they never sat right against the
     paper anyway. */
  function flagMark(cc, cls) {
    return '<span class="flag' + (cls ? " " + cls : "") + '">' +
      FNFlag.svg(cc, { label: (byCode[cc] || {}).name || cc }) + "</span>";
  }

  /* ------------------------------------------------------------- ranking */
  /* How "most endangered" is decided. Category dominates; scarcity, endemism
     and a declining trend break ties. Documented on the references page. */
  function severity(s, cc) {
    var score = CAT_W[s.iucn] || 0;
    if (s.possiblyExtinct) score += 60;
    if (cc && s.endemic === cc) score += 90;
    if (s.trend === "dec") score += 20;
    var est = s.pop && s.pop.est;
    if (est === null || est === undefined) {
      /* An uncounted species is rarely an abundant one, so absence of a figure
         still counts against it -- but not more than a published count in the
         low hundreds does. This sits it around the four-thousand mark, which
         stops "no one has counted them" outranking "there are 250 left". */
      score += 45;
    } else {
      score += Math.max(0, Math.min(120, 120 - 20 * Math.log10(Math.max(est, 1))));
      score += 2;    /* on a near-tie, prefer the record that carries a number */
    }
    return score;
  }
  function speciesFor(cc, limit) {
    var list = (inCountry[cc] || []).slice();
    list.sort(function (a, b) {
      var d = severity(b, cc) - severity(a, cc);
      return d !== 0 ? d : a.common.localeCompare(b.common);
    });
    return limit ? list.slice(0, limit) : list;
  }
  function continentCountries(id) {
    return COUNTRIES.filter(function (c) { return c.continent === id; });
  }
  function continentSpecies(id) {
    var codes = {}, out = [], seen = {};
    continentCountries(id).forEach(function (c) { codes[c.code] = 1; });
    SPECIES.forEach(function (s) {
      if (seen[s.id]) return;
      for (var i = 0; i < s.countries.length; i++) {
        if (codes[s.countries[i]]) { seen[s.id] = 1; out.push(s); return; }
      }
    });
    return out;
  }

  /* ---------------------------------------------------------- population */
  function popPhrase(s) {
    var p = s.pop || {};
    if (p.est === null || p.est === undefined) return null;
    return num(p.est);
  }
  function popShort(s) {
    var p = s.pop || {};
    if (p.est === null || p.est === undefined) return "not counted";
    if (p.est === 0) return "none in the wild";
    if (p.est >= 1000000) return (p.est / 1000000).toFixed(1).replace(/\.0$/, "") + "m left";
    if (p.est >= 10000) return Math.round(p.est / 1000) + "k left";
    return num(p.est) + " left";
  }

  /* ------------------------------------------------------------ ornament */
  function ornament() {
    return '<div class="ornament" aria-hidden="true"><svg viewBox="0 0 300 26" fill="none" ' +
      'stroke="currentColor" stroke-width="1.1" stroke-linecap="round">' +
      '<path d="M6 13h96"/><path d="M198 13h96"/>' +
      '<path d="M112 13q10-9 19 0t19 0t19 0t19-9"/>' +
      '<path d="M112 13q10 9 19 0t19 0t19 0t19 9"/>' +
      '<circle cx="150" cy="13" r="3.4"/>' +
      '<path d="M126 6q-5-5-11-4M174 6q5-5 11-4M126 20q-5 5-11 4M174 20q5 5 11 4"/>' +
      "</svg></div>";
  }

  /* -------------------------------------------------------------- the seal */
  function seal(size, letters, caption) {
    var cls = size === "sm" ? " seal--sm" : size === "lg" ? " seal--lg" : "";
    return '<svg class="seal' + cls + '" viewBox="0 0 100 100" role="img" aria-label="' +
      esc(caption || "wax seal") + '">' +
      '<defs><filter id="sealw"><feTurbulence type="fractalNoise" baseFrequency="0.05" ' +
      'numOctaves="3" seed="4" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" ' +
      'scale="4" xChannelSelector="R" yChannelSelector="G"/></filter>' +
      '<radialGradient id="sealg" cx="38%" cy="32%">' +
      '<stop offset="0%" stop-color="#a8493a"/><stop offset="62%" stop-color="#8d3a2c"/>' +
      '<stop offset="100%" stop-color="#6b2a1f"/></radialGradient></defs>' +
      '<g filter="url(#sealw)">' +
      '<circle cx="50" cy="50" r="42" fill="url(#sealg)"/>' +
      '<circle cx="50" cy="50" r="34" fill="none" stroke="rgba(255,225,205,.34)" stroke-width="1.4"/>' +
      '<circle cx="50" cy="50" r="30" fill="none" stroke="rgba(80,25,15,.35)" stroke-width="1"/>' +
      "</g>" +
      '<text x="50" y="57" text-anchor="middle" font-family="Fraunces, Georgia, serif" ' +
      'font-size="25" letter-spacing="1" fill="#f6e7dc">' + esc(letters || "FN") + "</text>" +
      "</svg>";
  }

  /* ------------------------------------------------------- shared furniture */
  function masthead(current) {
    var links = [
      ["index.html", "The Register", "home"],
      ["references.html", "Citations", "refs"],
      ["verification.html", "Verification", "verify"]
    ];
    return '<header class="masthead"><div class="wrap"><div class="masthead__inner">' +
      '<a class="wordmark" href="index.html">Field Notes on <em>Vanishing Species</em></a>' +
      '<nav class="nav" aria-label="Primary">' +
      links.map(function (l) {
        return '<a href="' + l[0] + '"' + (l[2] === current ? ' aria-current="page"' : "") +
          ">" + l[1] + "</a>";
      }).join("") +
      "</nav></div></div></header>";
  }

  function colophon() {
    var d = REPORT && REPORT.generatedAt ? REPORT.generatedAt.slice(0, 10) : null;
    var conts = CONTINENTS.map(function (c) {
      return '<li><a href="continent.html?c=' + c.id + '">' + esc(c.name) + "</a></li>";
    }).join("");
    return '<footer class="colophon"><div class="wrap">' +
      '<div class="colophon__grid">' +
        "<div><h4>The Register</h4><ul>" + conts + "</ul></div>" +
        '<div><h4>Sources &amp; method</h4><ul>' +
          '<li><a href="references.html">Citations &amp; references</a></li>' +
          '<li><a href="references.html#method">How a species is ranked</a></li>' +
          '<li><a href="references.html#plates">About the plates</a></li>' +
          '<li><a href="references.html#rights">Rights &amp; reuse</a></li>' +
          '<li><a href="verification.html">Verification log</a></li>' +
        "</ul></div>" +
        '<div><h4>On giving</h4><ul>' +
          '<li><a href="references.html#giving">How organisations are chosen</a></li>' +
          '<li><a href="references.html#giving">Checking a charity yourself</a></li>' +
        "</ul></div>" +
        '<div class="stack"><h4>Verification</h4>' +
          '<p style="font-size:.93rem;color:var(--ink-soft)">Every record — category, count, range and named organisation — is checked each time the verification script runs.' +
          (d ? " Last run <strong>" + esc(d) + "</strong>." : " The first run has not yet been recorded.") +
          "</p>" +
          '<a class="cite-link" href="references.html">Citations &amp; references &rarr;</a>' +
        "</div>" +
      "</div>" +
      '<div class="colophon__fine">' +
        "<span>A non-commercial archive. Text, map and flags &copy; 2026 AISynergy Partners. Portraits are public domain; facts are cited, not owned.</span>" +
        '<a class="to-top" href="#top">Back to top &uarr;</a>' +
      "</div></div></footer>";
  }

  /* =============================================================== THE MAP */
  /* Original stylised cartography: control points placed by hand, smoothed
     with a Catmull-Rom pass. Deliberately not a projection of real geometry —
     it is a journal map, and it owes nothing to anyone's dataset. */
  function smoothClosed(pts, t) {
    t = t === undefined ? 0.22 : t;
    var n = pts.length, d = "M" + pts[0][0] + " " + pts[0][1], i;
    for (i = 0; i < n; i++) {
      var p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
      var c1x = p1[0] + (p2[0] - p0[0]) * t / 3, c1y = p1[1] + (p2[1] - p0[1]) * t / 3;
      var c2x = p2[0] - (p3[0] - p1[0]) * t / 3, c2y = p2[1] - (p3[1] - p1[1]) * t / 3;
      d += "C" + c1x.toFixed(1) + " " + c1y.toFixed(1) + "," + c2x.toFixed(1) + " " +
           c2y.toFixed(1) + "," + p2[0] + " " + p2[1];
    }
    return d + "Z";
  }

  /* Coastlines given as [lat, lon] and projected equirectangularly, so the
     shapes are the real ones rather than invented blobs. Traced by hand from
     coordinates, deliberately coarse: this is a journal map, not a survey, and
     it owes nothing to any commercial or open geodata product. */
  function proj(lat, lon) {
    return [((lon + 180) / 360) * 1000, (84 - lat) * (500 / 142)];
  }
  function coast(pts) {
    return pts.map(function (p) { return proj(p[0], p[1]); });
  }

  var COAST = {
    "north-america": [[
      [71,-156],[70,-143],[69,-131],[70,-125],[68,-114],[69,-101],[67,-95],[64,-88],
      [60,-94],[57,-92],[55,-87],[51,-80],[55,-77],[59,-78],[63,-77],[60,-69],[58,-64],
      [55,-60],[52,-56],[48,-59],[45,-62],[43,-70],[41,-74],[35,-76],[31,-81],[25,-80],
      [28,-83],[30,-88],[29,-95],[26,-97],[22,-98],[19,-96],[18,-92],[21,-87],[18,-88],
      [15,-83],[12,-83],[9,-82],[8,-78],[9,-80],[13,-88],[16,-95],[18,-104],[21,-106],
      [23,-110],[28,-114],[31,-114],[32,-117],[35,-121],[40,-124],[46,-124],[49,-125],
      [55,-133],[59,-140],[60,-148],[58,-153],[55,-162],[58,-158],[60,-165],[63,-165],
      [65,-168],[69,-163]
    ], [
      [76,-68],[81,-62],[83,-38],[80,-20],[76,-19],[70,-22],[65,-40],[67,-53],[72,-55]
    ]],
    "south-america": [[
      [11,-72],[11,-64],[10,-61],[8,-60],[6,-57],[5,-52],[2,-50],[-1,-44],[-3,-38],
      [-5,-35],[-8,-35],[-13,-38],[-18,-39],[-23,-43],[-25,-48],[-30,-50],[-33,-53],
      [-35,-57],[-39,-62],[-43,-65],[-47,-66],[-50,-69],[-53,-68],[-55,-67],[-53,-72],
      [-50,-75],[-45,-74],[-41,-74],[-37,-73],[-33,-72],[-30,-71],[-25,-70],[-20,-70],
      [-18,-71],[-14,-76],[-12,-77],[-6,-81],[-4,-81],[-2,-80],[1,-80],[4,-77],[8,-77],
      [9,-76],[11,-74]
    ]],
    "africa": [[
      [37,-6],[33,-8],[30,-9],[28,-13],[24,-15],[21,-17],[18,-16],[15,-17],[13,-17],
      [11,-16],[9,-13],[7,-12],[5,-9],[5,-4],[6,1],[4,6],[4,9],[2,10],[0,9],[-3,10],
      [-6,12],[-9,13],[-12,13],[-15,12],[-18,12],[-22,14],[-26,15],[-29,17],[-33,18],
      [-34,20],[-34,25],[-33,28],[-30,31],[-27,33],[-24,35],[-20,35],[-16,40],[-12,40],
      [-10,40],[-7,39],[-5,39],[-2,41],[2,41],[5,46],[9,49],[11,51],[12,44],[15,40],
      [18,38],[22,37],[24,35],[27,34],[30,32],[31,32],[31,29],[32,23],[32,15],[34,11],
      [37,10],[37,8],[36,1],[35,-2]
    ], [
      [-12,49],[-15,50],[-19,49],[-23,48],[-25,45],[-22,43],[-18,44],[-15,46],[-13,48]
    ]],
    "europe": [[
      [36,-9],[41,-9],[43,-9],[43,-2],[46,-2],[48,-5],[49,-1],[51,2],[53,5],[55,8],
      [57,10],[58,6],[62,5],[65,12],[68,15],[71,25],[69,31],[66,29],[64,25],[60,22],
      [59,24],[57,21],[55,21],[54,19],[54,14],[52,5],[51,3],[49,0],[46,-1],[43,3],
      [41,3],[39,0],[37,-2],[36,-6]
    ], [
      [50,-5],[53,-4],[55,-6],[58,-5],[58,-2],[56,-2],[54,0],[52,1],[51,1]
    ], [
      [46,13],[44,12],[42,15],[40,18],[38,16],[40,15],[41,13],[44,10],[45,8]
    ], [
      [46,17],[45,19],[42,19],[40,20],[37,23],[38,26],[41,26],[44,29],[46,28],[48,24],[47,19]
    ]],
    "asia": [[
      [68,66],[72,80],[75,100],[73,113],[71,130],[70,143],[69,161],[66,171],[64,178],
      [60,170],[59,163],[55,160],[51,157],[59,152],[59,143],[54,141],[48,140],[43,132],
      [39,128],[35,129],[34,126],[38,124],[40,121],[38,118],[35,120],[32,121],[28,121],
      [24,118],[22,114],[21,109],[20,107],[16,108],[11,109],[9,105],[10,103],[13,100],
      [8,99],[6,101],[10,98],[16,95],[21,92],[22,89],[21,87],[19,85],[16,81],[13,80],
      [9,78],[8,77],[11,75],[15,74],[19,73],[22,69],[24,67],[25,62],[26,57],[25,57],
      [25,56],[24,54],[26,50],[29,48],[30,48],[27,50],[24,53],[21,57],[17,55],[14,53],
      [13,44],[16,42],[21,39],[26,36],[29,35],[31,34],[36,36],[37,41],[38,45],[41,48],
      [44,50],[47,52],[46,53],[44,51],[42,53],[38,55],[37,54],[40,53],[45,52],[47,52],
      [50,52],[52,58],[55,62],[58,65],[62,66],[66,64]
    ], [
      [6,95],[2,102],[-6,105],[-8,114],[-8,122],[-5,120],[-2,117],[2,110],[5,98]
    ], [
      [7,117],[4,114],[-1,110],[-4,114],[-1,117],[4,119],[7,119]
    ], [
      [19,121],[14,122],[10,126],[6,126],[9,123],[13,120],[16,120]
    ]],
    "oceania": [[
      [-11,142],[-13,136],[-12,131],[-14,127],[-18,122],[-20,119],[-22,114],[-26,113],
      [-30,115],[-34,115],[-35,118],[-32,126],[-32,133],[-35,137],[-38,141],[-38,145],
      [-39,147],[-37,150],[-32,153],[-27,153],[-22,150],[-19,147],[-16,146],[-13,143]
    ], [
      [-41,173],[-45,167],[-46,170],[-42,174],[-39,177],[-37,175],[-39,174]
    ], [
      [-2,131],[-4,136],[-8,141],[-10,148],[-9,151],[-6,148],[-3,142],[-1,135]
    ]],
    /* Antarctica wraps the pole, so in an equirectangular frame it is a band
       across the foot of the map. Traced as one pass west to east along the
       coast and one pass back along the interior, so the outline never
       crosses itself. */
    "antarctica": [[
      [-72,-180],[-75,-150],[-77,-120],[-74,-92],[-71,-70],[-68,-62],[-66,-58],
      [-70,-40],[-71,-10],[-70,20],[-69,45],[-67,72],[-66,96],[-67,120],[-70,146],
      [-72,166],[-71,180],
      [-84,180],[-85,120],[-86,50],[-86,-20],[-85,-80],[-84,-130],[-84,-180]
    ]]
  };

  var LAND = {};
  Object.keys(COAST).forEach(function (id) {
    LAND[id] = COAST[id].map(coast);
  });

  /* label anchors, given as [lat, lon] like the coastlines themselves */
  var LABEL = {
    "north-america": [46, -101], "south-america": [-14, -59], "europe": [51, 16],
    "africa": [4, 20], "asia": [46, 94], "oceania": [-25, 134], "antarctica": [-72, 0]
  };

  function atlas() {
    var VW = 1000, VH = 620;
    var svg = ['<svg viewBox="0 0 ' + VW + " " + VH + '" role="group" ' +
               'aria-label="World map, by continent">'];
    svg.push('<defs><filter id="mapw" x="-3%" y="-3%" width="106%" height="106%">' +
      '<feTurbulence type="fractalNoise" baseFrequency="0.01" numOctaves="2" seed="11" result="n"/>' +
      '<feDisplacementMap in="SourceGraphic" in2="n" scale="1.1" ' +
      'xChannelSelector="R" yChannelSelector="G"/></filter></defs>');

    /* graticule, with the equator drawn a shade heavier as on an engraved plate */
    svg.push('<g class="atlas__sea">');
    [60, 30, 0, -30].forEach(function (lat) {
      var y = proj(lat, 0)[1];
      svg.push('<path class="atlas__par' + (lat === 0 ? " is-equator" : "") +
               '" d="M28 ' + y.toFixed(1) + "H" + (VW - 28) + '"/>');
    });
    [-120, -60, 0, 60, 120].forEach(function (lon) {
      var x = proj(0, lon)[0];
      svg.push('<path class="atlas__mer" d="M' + x.toFixed(1) + ' 26V' + (VH - 40) + '"/>');
    });
    svg.push("</g>");

    svg.push('<g class="atlas__compass" transform="translate(56,556)">' +
      '<circle r="20"/><path d="M0 -26 L5 0 L0 26 L-5 0 Z"/>' +
      '<path d="M-26 0 L0 -5 L26 0 L0 5 Z"/><circle r="2.8"/></g>');

    CONTINENTS.forEach(function (c) {
      var shapes = LAND[c.id] || [];
      var n = continentSpecies(c.id).length;
      var ll = LABEL[c.id] || [0, 0];
      var lab = proj(ll[0], ll[1]);
      var d = shapes.map(function (pts) { return smoothClosed(pts); }).join(" ");
      svg.push(
        '<a class="atlas__group" href="continent.html?c=' + c.id + '" role="link" ' +
        'aria-label="' + esc(c.name) + ", " + n + ' species recorded">' +
        '<path class="atlas__land" filter="url(#mapw)" d="' + d + '"/>' +
        '<text class="atlas__label" x="' + lab[0].toFixed(0) + '" y="' + lab[1].toFixed(0) + '">' +
          esc(c.name) + "</text>" +
        '<text class="atlas__count" x="' + lab[0].toFixed(0) + '" y="' + (lab[1] + 19).toFixed(0) +
          '">' + n + " species</text>" +
        "</a>"
      );
    });
    svg.push("</svg>");
    return '<div class="atlas">' + svg.join("") + "</div>";
  }

  /* ------------------------------------------------------- live counters */
  function mountCounters(root) {
    var nodes = Array.prototype.slice.call((root || document).querySelectorAll("[data-count]"));
    /* zero is a fact about the species, not a starting value to animate from */
    nodes = nodes.filter(function (n) { return Number(n.getAttribute("data-count")) > 0; });
    if (!nodes.length) return;
    var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    function run(node) {
      var target = Number(node.getAttribute("data-count"));
      if (reduce || !isFinite(target)) { node.textContent = num(target); return; }
      node.textContent = num(0);
      var dur = 1100 + Math.min(700, Math.log10(Math.max(target, 10)) * 220);
      var t0 = null;
      function step(ts) {
        if (t0 === null) t0 = ts;
        var k = Math.min(1, (ts - t0) / dur);
        var eased = 1 - Math.pow(1 - k, 3);
        node.textContent = num(Math.round(target * eased));
        if (k < 1) requestAnimationFrame(step);
        else node.textContent = num(target);
      }
      requestAnimationFrame(step);
    }

    if (!("IntersectionObserver" in window)) { nodes.forEach(run); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { run(e.target); io.unobserve(e.target); }
      });
    }, { rootMargin: "0px 0px -12% 0px" });
    nodes.forEach(function (n) { io.observe(n); });
  }

  /* ---------------------------------------------------------- plate render */
  /* The figure is a finished natural-history portrait in the public domain: a
     historical plate, or illustration made by the US federal government. Where
     no such portrait of a species has been located, the plate says so plainly
     rather than showing a stand-in drawing. Attribution sits under every plate. */
  function figureFor(s, plateNo) {
    var pl = PLATES[s.id];
    if (pl && pl.file) {
      var who = pl.artist || "Illustrator not recorded";
      var when = pl.dateLabel || pl.year;
      return '<figure class="plate__figure">' +
        '<div class="plate__frame plate__frame--photo">' +
          '<img class="plate__img" src="' + esc(pl.file) + '" alt="' + esc(pl.for || s.common) +
          (pl.basis === "usgov" ? ", field-guide illustration" : ", historical plate") +
          '" loading="lazy" decoding="async">' +
        "</div>" +
        '<figcaption class="plate__caption">fig. ' + plateNo + " &mdash; " + esc(s.common) +
          '<span class="plate__prov">' + esc(who) +
          '<span class="plate__work">' + esc(pl.work ? shortWork(pl.work, pl.title) : "Source file on Wikimedia Commons") +
            (when ? ", " + esc(when) : "") + "</span>" +
          (pl.depicts ? '<span class="plate__depicts">' + esc(pl.depicts) + "</span>" : "") +
          '<a href="' + esc(pl.source) + '" target="_blank" rel="noopener noreferrer">' +
          esc(pl.licence || "Public domain") + " &middot; Wikimedia Commons</a></span>" +
        "</figcaption></figure>";
    }
    return '<figure class="plate__figure">' +
      '<div class="plate__frame plate__frame--empty" role="img" aria-label="' + esc(s.common) +
        ': no public-domain portrait located">' +
        '<span class="plate__empty-name">' + esc(s.common) + "</span>" +
        '<span class="plate__empty-sci">' + esc(s.sci) + "</span>" +
        '<span class="plate__empty-rule" aria-hidden="true"></span>' +
        '<span class="plate__empty-note">No public-domain portrait of this species has been located.</span>' +
      "</div>" +
      '<figcaption class="plate__caption">fig. ' + plateNo + " &mdash; " + esc(s.common) +
        '<span class="plate__prov"><a href="references.html#plates">How portraits are chosen</a></span>' +
      "</figcaption></figure>";
  }
  /* Commons credit fields are inconsistent: some are a clean citation, some run
     to paragraphs, and the Internet Archive uploads give only a Flickr URL. Pull
     out something a reader can actually read, falling back to the file's own
     title where the credit is just a link. */
  function shortWork(w, title) {
    var t = String(w || "").replace(/\s+/g, " ").trim();
    if (!t || /^https?:\/\//i.test(t)) {
      t = String(title || "").replace(/^File:/, "").replace(/\.[a-z]+$/i, "");
      t = t.replace(/[_-]+/g, " ").replace(/\(\d{6,}\)/g, "").replace(/\s+/g, " ").trim();
      return t || "Source file on Wikimedia Commons";
    }
    t = t.replace(/^.*?\bfrom\s+/i, "").replace(/\s*\[\d+\]\s*/g, " ");
    if (t.length > 110) t = t.slice(0, 108).replace(/[\s,;:]+\S*$/, "") + "\u2026";
    return t;
  }

  /* A plate is laid out as a field-guide entry: figure on the left, a ruled
     table of the facts, then description, habitat, threats and giving, each
     under its own label. One display face for the name, one body face for
     everything else, and the handwriting used once -- under the figure --
     so it reads as an annotation rather than as a competing voice. */
  function fieldRow(label, value, sub) {
    return '<div class="frow"><dt>' + esc(label) + "</dt><dd>" + value +
      (sub ? '<span class="frow__sub">' + sub + "</span>" : "") + "</dd></div>";
  }

  function popRow(s, cc, country) {
    var pop = s.pop || {};
    var nat = s.popNational && cc && s.popNational[cc];
    var value, sub = "";

    if ((pop.est === null || pop.est === undefined) && pop.low != null && pop.high != null) {
      value = '<span class="popnum">' + num(pop.low) + "&ndash;" + num(pop.high) + "</span>" +
              '<span class="popunit">' + esc(pop.unit || "mature individuals") + "</span>";
      sub = esc(pop.label || "");
    } else if (pop.est === null || pop.est === undefined) {
      value = '<span class="frow__none">No published estimate</span>';
      sub = esc(pop.label || "");
    } else {
      var cls = pop.est === 0 ? " is-zero" : "";
      value = '<span class="popnum' + cls + '" data-count="' + pop.est + '">' +
              num(pop.est) + "</span>" +
              '<span class="popunit">' + esc(pop.unit || "mature individuals") + "</span>";
      if (pop.est === 0 && pop.label) sub = esc(pop.label);
      else if (pop.low != null && pop.high != null && (pop.low !== pop.est || pop.high !== pop.est)) {
        sub = "Published range " + num(pop.low) + "&ndash;" + num(pop.high) + ".";
      }
    }
    if (pop.basis) {
      sub += (sub ? " " : "") + esc(pop.basis) + (pop.asOf ? ", " + esc(pop.asOf) : "") + ".";
    }
    if (nat) {
      sub += " In " + esc(country.name) + ": <strong>" + num(nat.est) + "</strong> (" +
             esc(nat.basis) + ", " + esc(nat.asOf) + ").";
    }
    return fieldRow("Population", value, sub);
  }

  /* Where the category comes from: the taxon's own IUCN assessment, or a
     national or regional list when the IUCN has not assessed it separately. */
  function statusNote(s) {
    var ss = s.statusSource;
    if (ss) {
      return "Not assessed separately on the IUCN Red List" +
        (ss.iucnNote ? " (" + esc(ss.iucnNote) + ")" : "") + ". " + esc(ss.text) +
        (ss.url ? ' <a class="cite-link" href="' + esc(ss.url) +
          '" target="_blank" rel="noopener noreferrer">Read the listing &rarr;</a>' : "");
    }
    var ar = s.iucnArchived;
    if (ar) {
      return "The Red List&rsquo;s last separate assessment of <em>" + esc(ar.taxon) +
        "</em>, published " + esc(ar.year) + ". It is no longer assessed on its own: the Red List " +
        "now assesses <em>" + esc(ar.currentTaxon) + "</em> as a whole, " +
        esc(CAT_NAME[ar.currentStatus] || ar.currentStatus) + " (" + esc(ar.currentYear) + ").";
    }
    return "IUCN Red List assessment" +
      (s.iucnTaxon ? " of <em>" + esc(s.iucnTaxon) + "</em>," : "") +
      " published " + esc(s.iucnYear) +
      (s.possiblyExtinct ? ". Tagged <em>Possibly Extinct" +
        (s.possiblyExtinct === "wild" ? " in the Wild" : "") + "</em>." : ".");
  }

  function plate(s, i, cc) {
    var cat = CAT_NAME[s.iucn] || s.iucn;
    var country = cc && byCode[cc];
    var natl = s.national && cc && s.national[cc];
    var plateNo = ("0" + (i + 1)).slice(-2);

    /* range, phrased for the country being read */
    var others = s.countries.length - 1;
    var range;
    if (s.endemic && cc && s.endemic === cc) {
      range = "Found only in " + esc(country.name);
    } else if (country) {
      range = esc(country.name) + (others > 0
        ? '<span class="frow__sub-inline"> and ' + others +
          (others === 1 ? " other country" : " other countries") + "</span>"
        : "");
    } else {
      range = s.countries.length + " countries";
    }

    var rows = [
      fieldRow("Status", '<span class="statusword">' + esc(cat) + "</span>" +
        '<span class="statuscode">' + esc(s.iucn) + "</span>", statusNote(s)),
      popRow(s, cc, country),
      fieldRow("Trend", esc(cap(TREND[s.trend] || s.trend))),
      fieldRow("Range", range, esc(s.habitat)),
      fieldRow("Group", esc(GROUP_NAME[s.group] || s.group))
    ];
    if (natl) {
      rows.push(fieldRow("Also listed", esc(natl.scheme),
        esc(natl.status) + (natl.rank ? " &middot; conservation rank " + esc(natl.rank) : "")));
    }

    var cites = (s.sources || []).map(function (id) {
      var src = bySource[id];
      return src ? '<a href="references.html#src-' + esc(id) + '">' + esc(src.title) + "</a>" : "";
    }).filter(Boolean).join("; ");

    var orgs = (s.orgs || []).map(function (id, n) {
      var o = byOrg[id];
      if (!o) return "";
      return '<li><a class="give__item" href="' + esc(o.url) + '" target="_blank" rel="noopener noreferrer">' +
        '<span class="give__num">' + (n + 1) + "</span>" +
        '<span><span class="give__name">' + esc(o.name) + "</span>" +
        '<span class="give__role">' + esc(o.role) + "</span></span>" +
        '<span class="give__go">Give</span></a></li>';
    }).join("");

    return '<li class="plate cat-' + esc(s.iucn) + '" id="sp-' + esc(s.id) + '">' +

      '<header class="plate__masthead">' +
        '<span class="plate__no">Plate ' + plateNo + "</span>" +
        '<span class="plate__cat">' + esc(s.iucn) + "</span>" +
      "</header>" +

      '<div class="plate__body">' +
        figureFor(s, plateNo) +

        '<div class="plate__record">' +
          '<h3 class="plate__name">' + esc(s.common) + "</h3>" +
          '<p class="plate__sci">' + esc(s.sci) + "</p>" +
          '<dl class="fieldtable">' + rows.join("") + "</dl>" +
        "</div>" +
      "</div>" +

      '<div class="plate__prose">' +
        '<section class="pblock"><h4 class="pblock__h">Field note</h4>' +
          "<p>" + esc(s.note) + "</p></section>" +

        '<section class="pblock"><h4 class="pblock__h">Threats</h4>' +
          '<ol class="threatlist">' +
            (s.threats || []).map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("") +
          "</ol></section>" +

        '<section class="pblock"><h4 class="pblock__h">Where to give</h4>' +
          '<ul class="give__list">' + orgs + "</ul></section>" +

        '<p class="cites"><span class="cites__label">Sources</span> ' + cites + ".</p>" +
      "</div></li>";
  }

  function cap(t) { return t ? t.charAt(0).toUpperCase() + t.slice(1) : t; }

  /* ================================================================ PAGES */
  function shell(current, main) {
    document.body.insertAdjacentHTML("afterbegin",
      '<a class="skip" href="#main">Skip to content</a><span id="top"></span>' + masthead(current));
    document.getElementById("main").innerHTML = main;
    document.body.insertAdjacentHTML("beforeend", colophon());
    mountCounters();
  }

  var PAGES = {};

  /* ------------------------------------------------------------------ home */
  PAGES.home = function () {
    var cr = SPECIES.filter(function (s) { return s.iucn === "CR" || s.iucn === "EW"; }).length;
    var countries = Object.keys(inCountry).length;
    var tiny = SPECIES.filter(function (s) {
      return s.pop && s.pop.est !== null && s.pop.est !== undefined && s.pop.est > 0 && s.pop.est < 250;
    }).length;

    var html =
      '<section class="section wrap">' +
        '<div style="display:flex;gap:2rem;align-items:flex-start;flex-wrap:wrap;justify-content:space-between">' +
          '<div style="flex:1 1 30rem">' +
            '<p class="eyebrow">An illustrated register of what is left</p>' +
            "<h1>Field Notes on<br><em>Vanishing&nbsp;Species</em></h1>" +
            '<p class="lede" style="margin-top:1.6rem">Every animal in this register is real, counted, and cited. ' +
            "Begin with a continent. Then a country. Then, one plate at a time, the species that live there and " +
            "how few of them are left.</p>" +
          "</div>" +
          "<div>" + seal("lg", "FN", "Wax seal of the archive") + "</div>" +
        "</div>" +
      "</section>" +

      '<section class="wrap" aria-labelledby="atlas-h">' +
        '<h2 id="atlas-h" class="visually-hidden" style="position:absolute;left:-9999px">Choose a continent</h2>' +
        atlas() +
        '<p class="hand hand--tilt" style="display:block;text-align:center;margin-top:1rem;font-size:1.35rem">' +
        "Choose a continent to begin &mdash;</p>" +
      "</section>" +

      ornament() +

      '<section class="section--tight wrap">' +
        '<div class="figures" style="justify-content:space-between">' +
          '<div><span class="figure__n" data-count="' + SPECIES.length + '">' + num(SPECIES.length) + "</span>" + '' +
            '<span class="figure__l">Species documented</span></div>' +
          '<div><span class="figure__n" data-count="' + cr + '">' + num(cr) + "</span>" + '' +
            '<span class="figure__l">Critically endangered or worse</span></div>' +
          '<div><span class="figure__n" data-count="' + tiny + '">' + num(tiny) + "</span>" + '' +
            '<span class="figure__l">Numbering under 250</span></div>' +
          '<div><span class="figure__n" data-count="' + countries + '">' + num(countries) + "</span>" + '' +
            '<span class="figure__l">Countries &amp; territories</span></div>' +
          '<div><span class="figure__n" data-count="' + ORGS.length + '">' + num(ORGS.length) + "</span>" + '' +
            '<span class="figure__l">Verified organisations</span></div>' +
        "</div>" +
      "</section>" +

      ornament() +

      '<section class="section wrap wrap--narrow">' +
        "<h2>How to read this book</h2>" +
        '<p class="dropcap" style="margin-top:1.4rem">Conservation status is not one number but several, and they ' +
        "disagree. This archive shows the global IUCN Red List category first, because it is the only system that " +
        "covers the whole world on one scale. Where a country keeps its own register &mdash; the United States " +
        "Endangered Species Act, NatureServe&rsquo;s G1&ndash;G5 ranks, Australia&rsquo;s EPBC Act, Brazil&rsquo;s " +
        "red book, New Zealand&rsquo;s threat classification &mdash; that is shown alongside it.</p>" +
        "<p>Population figures are the most recent published estimates from the assessments cited under each plate. " +
        "They are not live telemetry, and this site will not pretend otherwise: under every animal you will find the " +
        "survey the number came from and the year it was taken. Some species have never been counted at all, and " +
        "those say so.</p>" +
        '<div class="note-margin">Where a count is missing, that absence is itself a finding. Nobody has ever ' +
        "counted the world&rsquo;s pangolins. We only know how many were seized.</div>" +
        "<p>Every organisation named under a species is a real, working body with a public giving page, chosen " +
        "because it does documented work on that particular animal or its habitat. Their links are re-checked each time the " +
        'verification script runs, and so are the categories, counts and ranges. The <a href="verification.html">verification log</a> ' +
        "records what the last run found, including anything that failed.</p>" +
        '<p style="margin-top:1.8rem"><a class="cite-link" href="references.html">Citations &amp; references &rarr;</a></p>' +
      "</section>";
    shell("home", html);
  };

  /* ------------------------------------------------------------- continent */
  PAGES.continent = function () {
    var id = qs("c") || "africa";
    var cont = byContinent[id];
    if (!cont) { document.getElementById("main").innerHTML = notFound("continent"); return; }

    document.title = cont.name + " — Field Notes on Vanishing Species";
    var rows = continentCountries(id);
    var all = continentSpecies(id);
    var subs = [];
    rows.forEach(function (c) { if (subs.indexOf(c.sub) < 0) subs.push(c.sub); });

    var groups = subs.map(function (sub) {
      var list = rows.filter(function (c) { return c.sub === sub; })
        .sort(function (a, b) { return a.name.localeCompare(b.name); });
      var cards = list.map(function (c) {
        var top = speciesFor(c.code, 1)[0];
        var n = (inCountry[c.code] || []).length;
        var note = top
          ? "Most at risk here: <b>" + esc(top.common) + "</b> &mdash; " + esc(popShort(top)) + "."
          : "No globally threatened species recorded here yet.";
        return '<li><a class="stamp' + (top ? "" : " stamp--bare") +
          '" href="country.html?c=' + esc(c.code) + '">' +
          '<span class="stamp__frame">' + flagMark(c.code) +
            '<span class="stamp__name">' + esc(c.name) + "</span>" +
            '<span class="stamp__value">' + (n ? n + (n === 1 ? " species" : " species") : "no records") +
            (c.territory ? " &middot; " + esc(c.admin) : "") + "</span>" +
          "</span>" +
          '<span class="stamp__note">' + note + "</span>" +
          "</a></li>";
      }).join("");
      return '<h3 class="subregion">' + esc(sub) + "</h3>" +
        '<ul class="stamp-grid">' + cards + "</ul>";
    }).join("");

    var worst = all.slice().sort(function (a, b) { return severity(b) - severity(a); }).slice(0, 3);
    var contCR = all.filter(function (s) { return s.iucn === "CR" || s.iucn === "EW"; }).length;

    var html =
      '<section class="section--tight wrap">' +
        '<nav class="crumbs" aria-label="Breadcrumb"><a href="index.html">The Register</a>' +
        '<span aria-hidden="true">&rsaquo;</span><span>' + esc(cont.name) + "</span></nav>" +
      "</section>" +
      '<section class="wrap" style="padding-bottom:1rem">' +
        '<div style="display:flex;gap:2rem;flex-wrap:wrap;align-items:flex-start;justify-content:space-between">' +
          '<div style="flex:1 1 28rem">' +
            '<p class="eyebrow">Plate ' + esc(cont.plate) + " &middot; " + esc(cont.latin) + "</p>" +
            "<h1>" + esc(cont.name) + "</h1>" +
            '<p class="hand" style="font-size:1.5rem;margin-top:1rem">' + esc(cont.note) + "</p>" +
          "</div>" +
          "<div>" + seal("", esc(cont.plate), cont.name + " seal") + "</div>" +
        "</div>" +
        '<p class="lede" style="margin-top:1.8rem">' + esc(cont.blurb) + "</p>" +
        '<div class="figures" style="margin-top:2rem">' +
          '<div><span class="figure__n" data-count="' + rows.length + '">' + num(rows.length) + "</span>" + '' +
            '<span class="figure__l">Countries &amp; territories</span></div>' +
          '<div><span class="figure__n" data-count="' + all.length + '">' + num(all.length) + "</span>" + '' +
            '<span class="figure__l">Species recorded</span></div>' +
          '<div><span class="figure__n" data-count="' + contCR + '">' + num(contCR) +
            '</span><span class="figure__l">Critically endangered</span></div>' +
        "</div>" +
        '<p class="note-margin">Closest to the edge on this continent: ' +
          worst.map(function (s) { return esc(s.common) + " (" + esc(popShort(s)) + ")"; }).join(", ") +
        ".</p>" +
      "</section>" +
      ornament() +
      '<section class="section--tight wrap">' + groups + "</section>";
    shell(null, html);
  };

  /* --------------------------------------------------------------- country */
  PAGES.country = function () {
    var cc = (qs("c") || "").toUpperCase();
    var c = byCode[cc];
    if (!c) { shell(null, notFound("country")); return; }

    document.title = c.name + " — Field Notes on Vanishing Species";
    var cont = byContinent[c.continent];
    var list = speciesFor(cc, 20);
    var total = (inCountry[cc] || []).length;
    var endemics = (inCountry[cc] || []).filter(function (s) { return s.endemic === cc; }).length;

    var body;
    if (!list.length) {
      body = '<div class="empty"><p class="hand" style="font-size:1.6rem">The page for this country is ' +
        "genuinely empty &mdash; and that is the honest answer.</p>" +
        '<p style="max-width:34rem;margin:1.2rem auto 0;color:var(--ink-soft)">No species in this archive has ' +
        esc(c.name) + " within its range. This archive holds a selection of the Red List rather than all of it, " +
        "so for a very small state that usually means no species of the kind recorded here lives inside its " +
        "borders. Regional registers such as the " +
        '<a href="references.html#src-eu-red-list">European Red List</a> assess many species at a finer grain ' +
        "than the global list, and are the right place to look next.</p>" +
        '<p style="margin-top:1.5rem"><a class="cite-link" href="continent.html?c=' + esc(c.continent) +
        '">Back to ' + esc(cont ? cont.name : "the continent") + " &rarr;</a></p></div>";
    } else {
      body = '<ol class="plates">' + list.map(function (s, i) { return plate(s, i, cc); }).join("") + "</ol>";
    }

    var html =
      '<section class="section--tight wrap">' +
        '<nav class="crumbs" aria-label="Breadcrumb"><a href="index.html">The Register</a>' +
        '<span aria-hidden="true">&rsaquo;</span><a href="continent.html?c=' + esc(c.continent) + '">' +
        esc(cont ? cont.name : "") + "</a>" +
        '<span aria-hidden="true">&rsaquo;</span><span>' + esc(c.name) + "</span></nav>" +
      "</section>" +
      '<section class="wrap">' +
        '<div style="display:flex;gap:1.6rem;align-items:center;flex-wrap:wrap">' +
          flagMark(cc, "flag--hero") +
          "<div><h1>" + esc(c.name) + "</h1>" +
          '<p class="eyebrow" style="margin-top:.7rem">' + esc(c.sub) +
          (c.territory ? " &middot; administered by " + esc(c.admin) : "") + "</p></div>" +
        "</div>" +
        '<p class="lede" style="margin-top:1.6rem">' +
          (list.length
            ? "The " + (list.length < 20 ? list.length : "twenty") + " species below are the most at risk of the " +
              total + " recorded here, ranked by Red List category, then by how few are left. " +
              (endemics ? "Of everything recorded in " + esc(c.name) + ", " + endemics +
                (endemics === 1 ? " species lives" : " species live") + " nowhere else on Earth." : "")
            : "") +
        "</p>" +
      "</section>" +
      ornament() +
      '<section class="section--tight wrap">' + body + "</section>";
    shell(null, html);
  };

  function notFound(what) {
    return '<section class="section wrap"><div class="empty">' +
      "<h1>Not on the map</h1>" +
      '<p class="lede" style="margin:1.2rem auto 0">That ' + esc(what) + " is not in the register.</p>" +
      '<p style="margin-top:1.5rem"><a class="cite-link" href="index.html">Return to the Register &rarr;</a></p>' +
      "</div></section>";
  }

  /* ----------------------------------------------------------- references */
  PAGES.references = function () {
    var byType = {};
    SOURCES.forEach(function (s) { (byType[s.type] || (byType[s.type] = [])).push(s); });
    var TYPE_LABEL = {
      "primary-assessment": "Primary assessments",
      "national-listing": "National and regional registers",
      "treaty": "Treaties and legal instruments",
      "specialist-group": "IUCN SSC Specialist Groups",
      "survey": "Surveys, censuses and action plans"
    };
    var order = ["primary-assessment", "national-listing", "treaty", "specialist-group", "survey"];

    var sections = order.filter(function (t) { return byType[t]; }).map(function (t) {
      var rows = byType[t].slice().sort(function (a, b) { return a.title.localeCompare(b.title); })
        .map(function (s) {
          var used = SPECIES.filter(function (sp) { return sp.sources.indexOf(s.id) >= 0; }).length;
          return '<tr id="src-' + esc(s.id) + '">' +
            "<td><strong>" + esc(s.title) + "</strong><br>" +
            '<span style="color:var(--ink-faint);font-size:.9rem">' + esc(s.publisher) + "</span></td>" +
            "<td>" + esc(s.note) + '<br><a href="' + esc(s.url) +
            '" target="_blank" rel="noopener noreferrer" style="font-size:.88rem">' + esc(s.url) + "</a></td>" +
            '<td style="text-align:right;font-variant-numeric:lining-nums">' + used + "</td></tr>";
        }).join("");
      return "<h3 style=\"margin-top:2.6rem\">" + esc(TYPE_LABEL[t] || t) + "</h3>" +
        '<div class="scroll-x"><table class="ledger"><thead><tr><th>Reference</th>' +
        "<th>What it is used for</th><th style=\"text-align:right\">Records</th></tr></thead>" +
        "<tbody>" + rows + "</tbody></table></div>";
    }).join("");

    var orgRows = ORGS.slice().sort(function (a, b) { return a.name.localeCompare(b.name); })
      .map(function (o) {
        var used = SPECIES.filter(function (s) { return s.orgs.indexOf(o.id) >= 0; }).length;
        return "<tr><td><strong>" + esc(o.name) + "</strong><br>" +
          '<span style="color:var(--ink-faint);font-size:.88rem">' +
          esc(o.scope === "global" ? "Global" : "Regional") +
          (o.hq ? " &middot; based in " + esc(byCode[o.hq] ? byCode[o.hq].name : o.hq) : "") + "</span></td>" +
          "<td>" + esc(o.role) + '<br><a href="' + esc(o.url) +
          '" target="_blank" rel="noopener noreferrer" style="font-size:.88rem">' + esc(o.url) + "</a></td>" +
          '<td style="text-align:right;font-variant-numeric:lining-nums">' + used + "</td></tr>";
      }).join("");

    var rights = (D.sources && D.sources._rights) || "";
    var PLATE_CUTOFF = (D.plates && D.plates._cutoff) || 1928;
    var FED = Object.keys(PLATES).filter(function (k) { return PLATES[k].basis === "usgov"; }).length;
    var NOPORTRAIT = SPECIES.filter(function (x) { return !(PLATES[x.id] && PLATES[x.id].file); }).length;
    var PLATE_ROWS = Object.keys(PLATES).sort(function (a, b) {
      return (PLATES[a]["for"] || a).localeCompare(PLATES[b]["for"] || b);
    }).map(function (sid) {
      var pl = PLATES[sid];
      return "<tr><td><strong>" + esc((pl["for"] || sid).replace(/\s*\(.*\)$/, "")) + "</strong><br>" +
        '<span style="color:var(--ink-faint);font-size:.88rem;font-style:italic">' +
        esc(((pl["for"] || "").match(/\(([^)]+)\)$/) || [])[1] || "") + "</span></td>" +
        "<td>" + esc(pl.artist || "Not recorded") + "</td>" +
        '<td><a href="' + esc(pl.source) + '" target="_blank" rel="noopener noreferrer">' +
        esc(shortWork(pl.work, pl.title)) + "</a>" +
        (pl.depicts ? '<span class="frow__sub"><strong>' + esc(pl.depicts) + "</strong></span>" : "") +
        (pl.pdBasis ? '<span class="frow__sub">' + esc(pl.pdBasis) + "</span>" : "") + "</td>" +
        '<td style="text-align:right;font-variant-numeric:lining-nums;white-space:nowrap">' +
        esc(pl.dateLabel || pl.year) + "</td></tr>";
    });

    var html =
      '<section class="section--tight wrap">' +
        '<nav class="crumbs" aria-label="Breadcrumb"><a href="index.html">The Register</a>' +
        '<span aria-hidden="true">&rsaquo;</span><span>Citations &amp; references</span></nav>' +
      "</section>" +
      '<section class="wrap wrap--narrow">' +
        '<p class="eyebrow">Apparatus</p><h1>Citations &amp;<br>References</h1>' +
        '<p class="lede" style="margin-top:1.6rem">Every figure on this site traces to something published by ' +
        "somebody accountable. This page is where those somebodies are named.</p>" +
      "</section>" +
      ornament() +

      '<section class="section--tight wrap wrap--narrow" id="method">' +
        "<h2>How a species is ranked</h2>" +
        '<p class="dropcap" style="margin-top:1.2rem">Each country page lists its twenty most endangered species. ' +
        "Rank is decided first by Red List category, which dominates everything else: Extinct in the Wild, then " +
        "Critically Endangered, Endangered, Vulnerable, Near Threatened. Within a category, four things break the tie " +
        "&mdash; how few individuals remain, whether the species is found in that country and nowhere else, whether " +
        "its population is still falling, and whether it carries the Red List&rsquo;s <em>Possibly Extinct</em> tag. " +
        "The category is the IUCN&rsquo;s wherever the IUCN has assessed that animal; for the few it has not, the " +
        "species record names the national or regional list the category comes from.</p>" +
        "<p>Species with no published count are ranked as though scarce rather than as though abundant, because an " +
        "uncounted species is almost never an abundant one. A species appears on the page of every country its range " +
        "touches, so a snow leopard is listed by all twelve of its range states &mdash; the global population is shown, " +
        "with a national figure added where a reliable one exists.</p>" +
        '<div class="note-margin">Categories can move in both directions. The Iberian lynx, the saiga antelope, the ' +
        "Arabian oryx and the scimitar-horned oryx have all been downlisted after real recoveries. Those are in here too.</div>" +
      "</section>" +

      '<section class="section--tight wrap wrap--narrow" id="giving">' +
        "<h2>How organisations are chosen</h2>" +
        "<p>Three organisations are named under each species. To be listed, a body must be a functioning " +
        "conservation organisation with a public giving page, and must do documented work on that species, its " +
        "habitat, or the specific threat driving its decline. Preference goes to organisations based in the range " +
        "country, then to species-specific funds, then to the large international bodies.</p>" +
        "<p>Only homepages are stored, never deep &lsquo;donate&rsquo; links: those change constantly and rot " +
        "quietly, whereas a homepage is stable and every organisation here carries a visible giving link. " +
        "All " + ORGS.length + " links are re-checked whenever the verification script runs, and any failure is published in the " +
        '<a href="verification.html">verification log</a>.</p>' +
        "<p>This archive takes no commission, holds no affiliate arrangement with any organisation listed, and " +
        "receives nothing if you give. Before giving to any charity, you can check it yourself: in the United " +
        "States through the IRS Tax Exempt Organization Search or Candid; in the United Kingdom through the " +
        "Charity Commission register; in Australia through the ACNC; and elsewhere through the relevant national " +
        "regulator. A good organisation will publish its accounts without being asked.</p>" +
      "</section>" +

      '<section class="section--tight wrap wrap--narrow" id="rights">' +
        "<h2>Rights &amp; reuse</h2>" +
        "<p>" + esc(rights) + "</p>" +
        "<p>The portraits come from Wikimedia Commons scans of published natural-history works. The grounds for " +
        'each public-domain claim are given in the <a href="#plate-list">list of plates</a> below.</p>' +
        "<p>The world map is drawn in the browser from coastline coordinates stored with the site and projected " +
        "equirectangularly. The flags are drawn from compact geometric specifications written for this project; no " +
        "flag image is bundled or hot-linked, and where a flag carries an intricate coat of arms the device is drawn " +
        "as a simplified emblem.</p>" +
        "<p>Cite the Red List as: IUCN 2026. <em>The IUCN Red List of Threatened Species.</em> Version 2026-1. " +
        "https://www.iucnredlist.org. Its terms of use are published at " +
        '<a href="https://www.iucnredlist.org/terms/terms-of-use" target="_blank" rel="noopener noreferrer">' +
        "iucnredlist.org/terms/terms-of-use</a>.</p>" +
      "</section>" +
      ornament() +

      '<section class="section--tight wrap wrap--narrow" id="plates">' +
        "<h2>The plates</h2>" +
        "<p>Every figure in this register is a finished natural-history portrait in the public " +
        "domain: lithographs and engravings from works such as Brehm&rsquo;s <em>Tierleben</em>, " +
        "Lydekker&rsquo;s handbooks and Gould&rsquo;s monographs, by illustrators including Joseph " +
        "Wolf, Joseph Smit and John Gerrard Keulemans" +
        (FED ? ", alongside field-guide illustration published by the United States government" : "") +
        ". Each is credited under the figure with its artist, its source work, its date and a link " +
        "to the file.</p>" +
        "<p>Only two routes into the public domain are accepted. The first is age: works published " +
        "in " + esc(PLATE_CUTOFF) + " or earlier, comfortably inside the 95 years that US copyright " +
        "in a published work runs. " +
        (FED ? "The second is statute: illustration made by the United States federal government, " +
               "such as the US Fish and Wildlife Service and NOAA, which 17 U.S.C. &sect;105 places " +
               "in the public domain whatever its date. " : "") +
        "A faithful photographic reproduction of a two-dimensional public-domain artwork does not " +
        "attract a new copyright of its own &mdash; that is the holding in <em>Bridgeman v. " +
        "Corel</em>, and Article 14 of the EU Copyright Directive says the same.</p>" +
        "<p>Every plate is chosen by eye as well as by its metadata. Photographs, anatomical " +
        "diagrams, faint sketches and scenes in which the animal is lost are turned away, and so " +
        "are plates that turn out to show the wrong animal &mdash; a scarlet macaw catalogued as a " +
        "hyacinth macaw, and a lion&ndash;tiger hybrid catalogued as a tiger, were both caught " +
        "this way.</p>" +
        '<div class="note-margin">Some species were described too recently for any historical ' +
        "artist to have seen them &mdash; the Tapanuli orangutan in 2017, Rice&rsquo;s whale in " +
        "2021." + (NOPORTRAIT ? " Where no public-domain portrait has been located, the plate says " +
        "so plainly rather than showing a stand-in drawing." : "") + "</div>" +
        "<p>Provenance for every plate is re-checked alongside the species data whenever the verification script runs: " +
        "publication year against the cutoff, licence, artist, source URL and that the file is " +
        'still where the register says it is. See the <a href="verification.html">verification ' +
        "log</a>.</p>" +
      "</section>" +
      ornament() +

      '<section class="section--tight wrap" id="plate-list">' +
        "<h2>Plates used</h2>" +
        '<p class="lede" style="margin:1rem 0 1.4rem">' + PLATE_ROWS.length +
        " plates, each in the public domain and credited to its artist and source work.</p>" +
        (PLATE_ROWS.length
          ? '<div class="scroll-x"><table class="ledger"><thead><tr><th>Species</th>' +
            "<th>Artist</th><th>Source work and grounds for the public-domain claim</th>" +
            "<th style=\"text-align:right\">Date</th>" +
            "</tr></thead><tbody>" + PLATE_ROWS.join("") + "</tbody></table></div>"
          : '<div class="empty"><p class="hand" style="font-size:1.4rem">No portraits ' +
            "are registered yet.</p></div>") +
      "</section>" +
      ornament() +

      '<section class="section--tight wrap" id="sources">' +
        "<h2>Data sources</h2>" +
        '<p class="lede" style="margin-top:1rem">' + SOURCES.length + " references, cited " +
        SPECIES.reduce(function (n, s) { return n + s.sources.length; }, 0) +
        " times across " + SPECIES.length + " species records.</p>" +
        sections +
      "</section>" +
      ornament() +

      '<section class="section--tight wrap" id="organisations">' +
        "<h2>Organisations named on this site</h2>" +
        '<p class="lede" style="margin-top:1rem">' + ORGS.length +
        " conservation organisations, each linked to the species it works on.</p>" +
        '<div class="scroll-x"><table class="ledger"><thead><tr><th>Organisation</th>' +
        "<th>What it does</th><th style=\"text-align:right\">Species</th></tr></thead><tbody>" +
        orgRows + "</tbody></table></div>" +
      "</section>";
    shell("refs", html);
  };

  /* ---------------------------------------------------------- verification */
  PAGES.verification = function () {
    var html;
    if (!REPORT) {
      html = '<section class="section wrap wrap--narrow">' +
        '<p class="eyebrow">Compliance &amp; monitoring</p><h1>Verification&nbsp;Log</h1>' +
        '<div class="empty" style="margin-top:2rem">' +
        '<p class="hand" style="font-size:1.5rem">No run has been recorded yet.</p>' +
        '<p style="max-width:34rem;margin:1rem auto 0;color:var(--ink-soft)">The checker lives at ' +
        "<code>scripts/verify.py</code> and is run by hand, or weekly once this repository is hosted on GitHub. " +
        "Once it has run, this page shows " +
        "what it found, including anything that failed.</p></div></section>";
      shell("verify", html);
      return;
    }

    var r = REPORT;
    var cls = r.status === "pass" ? "pill--ok" : r.status === "warn" ? "pill--warn" : "pill--bad";
    var checkRows = (r.checks || []).map(function (c) {
      var p = c.failed ? "pill--bad" : c.warned ? "pill--warn" : "pill--ok";
      return "<tr><td><strong>" + esc(c.name) + "</strong></td><td>" + esc(c.description) + "</td>" +
        '<td style="text-align:right;font-variant-numeric:lining-nums">' + esc(c.checked) + "</td>" +
        '<td style="text-align:right"><span class="pill ' + p + '">' +
        (c.failed ? c.failed + " failed" : c.warned ? c.warned + " to review" : "clear") +
        "</span></td></tr>";
    }).join("");

    var issues = (r.issues || []).length
      ? '<div class="scroll-x"><table class="ledger"><thead><tr><th>Level</th><th>Check</th>' +
        "<th>Record</th><th>Detail</th></tr></thead><tbody>" +
        r.issues.map(function (i) {
          return "<tr><td><span class=\"pill " + (i.level === "error" ? "pill--bad" : "pill--warn") +
            '">' + esc(i.level) + "</span></td><td>" + esc(i.check) + "</td><td>" + esc(i.record || "&mdash;") +
            "</td><td>" + esc(i.message) + "</td></tr>";
        }).join("") + "</tbody></table></div>"
      : '<div class="empty"><p class="hand" style="font-size:1.5rem">Nothing to report. Everything checked out.</p></div>';

    html =
      '<section class="section--tight wrap">' +
        '<nav class="crumbs" aria-label="Breadcrumb"><a href="index.html">The Register</a>' +
        '<span aria-hidden="true">&rsaquo;</span><span>Verification</span></nav>' +
      "</section>" +
      '<section class="wrap wrap--narrow">' +
        '<p class="eyebrow">Compliance &amp; monitoring</p><h1>Verification&nbsp;Log</h1>' +
        '<p class="lede" style="margin-top:1.6rem">An automated check reads the whole archive: ' +
        "species categories, population figures, range countries, citations and every organisation link. " +
        "This is what the last run found.</p>" +
        '<p style="margin-top:1.4rem"><span class="pill ' + cls + '">' + esc(r.status) + "</span> " +
        '<span style="color:var(--ink-faint);font-size:.92rem">Run ' + esc((r.generatedAt || "").replace("T", " ").replace("Z", " UTC")) +
        (r.mode ? " &middot; " + esc(r.mode) : "") + "</span></p>" +
      "</section>" +
      ornament() +
      '<section class="section--tight wrap">' +
        "<h2>Checks performed</h2>" +
        '<div class="scroll-x" style="margin-top:1.2rem"><table class="ledger"><thead><tr><th>Check</th>' +
        "<th>What it verifies</th><th style=\"text-align:right\">Records</th>" +
        "<th style=\"text-align:right\">Result</th></tr></thead><tbody>" + checkRows + "</tbody></table></div>" +
      "</section>" +
      '<section class="section--tight wrap">' +
        "<h2>Findings</h2>" +
        '<p class="lede" style="margin:1rem 0 1.4rem">' + ((r.issues || []).length || "No") +
        " item" + ((r.issues || []).length === 1 ? "" : "s") + " flagged for review.</p>" + issues +
      "</section>" +
      '<section class="section--tight wrap wrap--narrow">' +
        "<h2>What the checker does</h2>" +
        "<p>The script is <code>scripts/verify.py</code>. The repository includes " +
        "<code>.github/workflows/weekly-verification.yml</code> to run it weekly once the site is hosted on GitHub; anyone with a copy of this " +
        "repository can also run it. It validates the shape and internal consistency of every record, confirms that each species " +
        "cites at least one primary assessment, that every named organisation and every range country resolves, " +
        "that population ranges bracket their own point estimate, and that no record has gone stale. With network " +
        "access it also requests every source and organisation URL and reports anything that no longer answers.</p>" +
        "<p>Given an IUCN Red List API token &mdash; free for non-commercial use &mdash; it also asks the Red List " +
        "itself for the current category and published year of every record it can key by name, and reports any " +
        "disagreement for a human to settle. That API is also how the bird assessments reach this archive: they are " +
        "compiled by BirdLife International and published through the Red List, whose terms allow this, while " +
        "BirdLife&rsquo;s own Data Zone does not permit automated access. Without a token the check falls back to " +
        "flagging every record whose assessment is old enough to be worth a human look, so that staleness is " +
        "visible rather than silent.</p>" +
        "<p>The five species the Red List does not assess separately rest on a national or legal listing instead. " +
        "Each links to that listing, the check requests it alongside every other link, and it asks for the listing " +
        "to be read again by hand once a year.</p>" +
      "</section>";
    shell("verify", html);
  };

  /* ------------------------------------------------------------------ boot */
  function boot() {
    var page = document.body.getAttribute("data-page");
    if (!D.species) {
      document.getElementById("main").innerHTML =
        '<section class="section wrap"><div class="empty"><h1>Data not loaded</h1>' +
        '<p class="lede" style="margin:1rem auto 0">Run <code>python3 scripts/build.py</code> to generate ' +
        "<code>assets/data.js</code>, then reload.</p></div></section>";
      return;
    }
    (PAGES[page] || PAGES.home)();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
