/* ===========================================================================
   Field Notes on Vanishing Things — plate engraver
   ---------------------------------------------------------------------------
   Original ink drawings, generated as SVG. Nothing here is traced, copied or
   derived from any third-party image: every path is drawn from scratch for
   this archive, which is what keeps the whole site clean of licensing.

   How it works
     - 55 base forms, each a small set of bezier outlines in a 220 x 150 field.
     - Each species key maps to a base plus parameters (proportions, horn or
       crest type, markings, tail), so a Javan rhino renders differently from
       a Sumatran one without needing its own drawing.
     - Every outline is stroked twice: a displaced "ghost" underdrawing and the
       ink line over it, then the whole group is pushed through a turbulence
       displacement filter. That is what turns clean beziers into pen wobble.

   Public API:  FNSketch.svg(key, { seed, marks, scale })  ->  SVG string
   =========================================================================== */
(function (global) {
  "use strict";

  var VB_W = 220, VB_H = 150;

  /* -------------------------------------------------------------- helpers */
  function P(d) { return d; }
  /* ellipse as a path, so everything can go through one pipeline */
  function ell(cx, cy, rx, ry) {
    return "M" + (cx - rx) + " " + cy +
           "a" + rx + " " + ry + " 0 1 0 " + (rx * 2) + " 0" +
           "a" + rx + " " + ry + " 0 1 0 " + (-rx * 2) + " 0Z";
  }
  /* parallel shading strokes inside a rough box, at an angle */
  function hatch(x, y, w, h, n, slant) {
    var out = [], step = w / (n + 1), i, sx;
    slant = slant === undefined ? 0.45 : slant;
    for (i = 1; i <= n; i++) {
      sx = x + step * i;
      out.push("M" + sx + " " + y + "L" + (sx - h * slant) + " " + (y + h));
    }
    return out;
  }
  /* a short curved tick, used for fur, feather and grass marks */
  function tick(x, y, dx, dy, bow) {
    bow = bow === undefined ? 0.35 : bow;
    return "M" + x + " " + y + "Q" + (x + dx / 2 - dy * bow) + " " +
           (y + dy / 2 + dx * bow) + " " + (x + dx) + " " + (y + dy);
  }
  function spots(list, r) {
    return list.map(function (p) { return ell(p[0], p[1], r || 3, (r || 3) * 0.8); });
  }
  function dflt(v, d) { return v === undefined ? d : v; }

  /* Canonical facial proportions. Drawing a head by eye produces a teddy
     bear; drawing it on a measured grid produces an animal. Ratios are the
     ones used in wildlife-art practice: eye line just above centre, nose at
     roughly two thirds, muzzle a little under half the head width. */
  function face(cx, cy, w, h, r) {
    r = r || {};
    var g = {
      cx: cx, cy: cy, w: w, h: h,
      top: cy - h / 2, bot: cy + h / 2, left: cx - w / 2, right: cx + w / 2,
      eyeY: cy + h * dflt(r.eyeY, -0.06),
      eyeDX: w * dflt(r.eyeDX, 0.22),
      eyeW: w * dflt(r.eyeW, 0.105),          /* half-width */
      eyeH: h * dflt(r.eyeH, 0.052),
      noseY: cy + h * dflt(r.noseY, 0.16),
      noseW: w * dflt(r.noseW, 0.065),        /* half-width */
      padY: cy + h * dflt(r.padY, 0.28),
      padDX: w * dflt(r.padDX, 0.115),
      padR: w * dflt(r.padR, 0.135),
      chinY: cy + h * dflt(r.chinY, 0.46),
      earY: cy + h * dflt(r.earY, -0.34),
      earDX: w * dflt(r.earDX, 0.40)
    };
    return g;
  }
  /* An almond eye set on the grid, angled up and out as a predator's is. */
  function eyeOn(g, side, tiltAmt, lower) {
    var x = g.cx + side * g.eyeDX, y = g.eyeY, w = g.eyeW, h = g.eyeH;
    var t = dflt(tiltAmt, 0.35) * h * side;
    return {
      x: x, y: y,
      lid: "M" + (x - w) + " " + (y + t) +
           "C" + (x - w * 0.55) + " " + (y - h * 2.1) + " " + (x + w * 0.55) + " " + (y - h * 2.1) +
           " " + (x + w) + " " + (y - t) +
           "C" + (x + w * 0.5) + " " + (y + h * dflt(lower, 1.8)) + " " + (x - w * 0.5) + " " +
           (y + h * dflt(lower, 1.8)) + " " + (x - w) + " " + (y + t) + "Z",
      /* the fold of skin above the eye, set well clear of the lid */
      brow: "M" + (x - w * 1.3) + " " + (y - h * 3.1) +
            "C" + (x - w * 0.4) + " " + (y - h * 4.6) + " " + (x + w * 0.4) + " " + (y - h * 4.6) +
            " " + (x + w * 1.3) + " " + (y - h * 2.7)
    };
  }
  /* A muzzle: two whisker pads and a leather nose, never one circle. */
  function muzzle(g, noseShape) {
    var out = [];
    out.push("M" + (g.cx - g.padDX - g.padR) + " " + g.padY +
      "C" + (g.cx - g.padDX - g.padR) + " " + (g.padY - g.padR * 0.75) + " " +
      (g.cx - g.padR * 0.2) + " " + (g.padY - g.padR * 0.9) + " " + g.cx + " " + (g.padY - g.padR * 0.5) +
      "C" + (g.cx + g.padR * 0.2) + " " + (g.padY - g.padR * 0.9) + " " +
      (g.cx + g.padDX + g.padR) + " " + (g.padY - g.padR * 0.75) + " " +
      (g.cx + g.padDX + g.padR) + " " + g.padY +
      "C" + (g.cx + g.padDX + g.padR) + " " + (g.padY + g.padR) + " " +
      (g.cx + g.padR) + " " + (g.chinY - 2) + " " + g.cx + " " + (g.chinY - 2) +
      "C" + (g.cx - g.padR) + " " + (g.chinY - 2) + " " +
      (g.cx - g.padDX - g.padR) + " " + (g.padY + g.padR) + " " +
      (g.cx - g.padDX - g.padR) + " " + g.padY + "Z");
    if (noseShape === "round") {
      out.push(ell(g.cx, g.noseY, g.noseW, g.noseW * 0.8));
    } else {
      /* inverted triangle with a softened base -- the felid/canid leather */
      out.push("M" + (g.cx - g.noseW) + " " + (g.noseY - g.noseW * 0.5) +
        "C" + (g.cx - g.noseW * 0.4) + " " + (g.noseY - g.noseW) + " " +
        (g.cx + g.noseW * 0.4) + " " + (g.noseY - g.noseW) + " " +
        (g.cx + g.noseW) + " " + (g.noseY - g.noseW * 0.5) +
        "C" + (g.cx + g.noseW * 0.8) + " " + (g.noseY + g.noseW * 0.6) + " " +
        (g.cx + g.noseW * 0.3) + " " + (g.noseY + g.noseW) + " " + g.cx + " " + (g.noseY + g.noseW) +
        "C" + (g.cx - g.noseW * 0.3) + " " + (g.noseY + g.noseW) + " " +
        (g.cx - g.noseW * 0.8) + " " + (g.noseY + g.noseW * 0.6) + " " +
        (g.cx - g.noseW) + " " + (g.noseY - g.noseW * 0.5) + "Z");
    }
    /* philtrum and mouth */
    out.push("M" + g.cx + " " + (g.noseY + g.noseW) + "V" + (g.padY + g.padR * 0.55));
    out.push("M" + g.cx + " " + (g.padY + g.padR * 0.55) +
      "C" + (g.cx - g.padR * 0.7) + " " + (g.padY + g.padR * 1.15) + " " +
      (g.cx - g.padDX - g.padR * 0.6) + " " + (g.padY + g.padR * 0.7) + " " +
      (g.cx - g.padDX - g.padR * 0.9) + " " + (g.padY + g.padR * 0.15));
    out.push("M" + g.cx + " " + (g.padY + g.padR * 0.55) +
      "C" + (g.cx + g.padR * 0.7) + " " + (g.padY + g.padR * 1.15) + " " +
      (g.cx + g.padDX + g.padR * 0.6) + " " + (g.padY + g.padR * 0.7) + " " +
      (g.cx + g.padDX + g.padR * 0.9) + " " + (g.padY + g.padR * 0.15));
    return out;
  }
  /* whisker-pad stipple */
  function whiskerDots(g) {
    var out = [], i, side, j;
    for (side = -1; side <= 1; side += 2) {
      for (i = 0; i < 3; i++) {
        out.push([g.cx + side * (g.padDX * 0.7 + i * g.padR * 0.4),
                  g.padY + 1 + (i % 2) * 3.5, 0.6]);
      }
    }
    return out;
  }

  /* Curved shading that follows the form, rather than flat parallel ruling.
     n strokes swept between two points, each bowed by `bow`. */
  function wrapHatch(x0, y0, x1, y1, n, bow, len) {
    var out = [], i, t, x, y, dx = x1 - x0, dy = y1 - y0;
    bow = dflt(bow, 0.5); len = dflt(len, 14);
    for (i = 0; i < n; i++) {
      t = (i + 0.5) / n;
      x = x0 + dx * t; y = y0 + dy * t;
      out.push("M" + x.toFixed(1) + " " + y.toFixed(1) +
        "q" + (len * bow).toFixed(1) + " " + (len * 0.45).toFixed(1) +
        " " + (len * 0.15).toFixed(1) + " " + len.toFixed(1));
    }
    return out;
  }
  /* An almond eye with lid, iris and catchlight -- the single mark that does
     most to make an animal look observed rather than invented. */
  function eyeAlmond(x, y, w, h, tilt) {
    var t = dflt(tilt, 0);
    return {
      lid: "M" + (x - w) + " " + (y + t) + "Q" + x + " " + (y - h) + " " + (x + w) + " " + y +
           "Q" + x + " " + (y + h * 0.85) + " " + (x - w) + " " + (y + t) + "Z",
      brow: "M" + (x - w - 1) + " " + (y - h * 0.9) + "Q" + x + " " + (y - h * 1.7) + " " +
            (x + w + 1) + " " + (y - h * 0.5)
    };
  }

  /* ground and water furniture --------------------------------------------- */
  var GROUND = ["M26 133q34 -5 62 -1t76 -2"];
  var WATER = ["M18 118q16 -6 32 0t32 0t32 0t32 0t32 0t22 -3",
               "M28 130q16 -5 32 0t32 0t32 0t32 0t26 -2"];
  var PERCH = ["M22 128q40 4 78 -3t96 -14"];

  /* =========================================================== BASE FORMS */
  /* Each returns { o: outlines, d: fine detail, h: hatching, g: ground } */
  var B = {};

  /* ------------------------------------------------------------ MAMMALS */
  /* Proportion rules that hold across the terrestrial forms, so that the
     plates read as one hand: ground at y=132, torso roughly x50-165 and
     y52-106, a real neck, a head 30-40 units across, and legs long enough
     to carry the animal rather than prop it up. */

  /* ------------------------------------------------------------ MAMMALS */
  /* A standing mammal is drawn as ONE continuous silhouette -- rump, back,
     neck, skull, muzzle, jaw, throat, chest, belly -- because that is how an
     animal actually reads. Heads drawn as separate ovals float off the body
     like balloons. Legs, ears, horns, tail and markings are added over it.

       rx/ry  rump x and back height      sx/sy  shoulder x and height
       by     belly line                  hx/hy  head centre
       hw/hh  head half-width and depth   mz     extra muzzle length
     Species differ by head placement, muzzle, horns and markings -- not by
     skeleton, which is what keeps the whole plate set in one hand. */
  var G = 132;                                    /* the ground line */

  function beast(a) {
    var rx = a.rx, ry = a.ry, sx = a.sx, sy = a.sy, by = a.by;
    var hx = a.hx, hy = a.hy, hw = a.hw, hh = a.hh;
    var mz = dflt(a.mz, 4), nb = dflt(a.nb, 0), nt = dflt(a.nt, 0);
    var midB = (rx + sx) / 2;
    return "M" + rx + " " + ((ry + by) / 2) +
      /* rump over the back to the shoulder */
      "C" + (rx - 2) + " " + (ry + 4) + " " + (rx + 13) + " " + ry + " " + midB + " " + ((ry + sy) / 2 - 2) +
      "C" + (sx - 28) + " " + (sy - 2) + " " + (sx - 8) + " " + sy + " " + sx + " " + (sy + 2) +
      /* up the back of the neck to the crown */
      "C" + (sx + 10 + nb) + " " + (sy - 8) + " " + (hx - hw - 8) + " " + (hy - hh - 6) + " " +
        (hx - hw + 4) + " " + (hy - hh) +
      /* over the skull and out along the muzzle */
      "C" + (hx - 1) + " " + (hy - hh - 5) + " " + (hx + hw) + " " + (hy - hh + 2) + " " +
        (hx + hw + mz) + " " + (hy - 2) +
      /* round the nose */
      "C" + (hx + hw + mz + 5) + " " + (hy + 2) + " " + (hx + hw + mz + 3) + " " + (hy + hh - 2) + " " +
        (hx + hw + mz - 5) + " " + (hy + hh) +
      /* back under the jaw */
      "C" + (hx - 2) + " " + (hy + hh + 4) + " " + (hx - hw - 2) + " " + (hy + hh + 1) + " " +
        (hx - hw - 7) + " " + (hy + hh - 3) +
      /* down the throat to the chest */
      "C" + (hx - hw - 12) + " " + (hy + hh + 16) + " " + (sx + 12 + nt) + " " + (sy + 16) + " " +
        (sx - 3) + " " + (by - 4) +
      /* belly back to the rump */
      "C" + (sx - 36) + " " + (by + 7) + " " + (rx + 34) + " " + (by + 8) + " " + (rx + 12) + " " + (by - 1) +
      "C" + (rx + 2) + " " + (by - 6) + " " + (rx - 2) + " " + (by - 13) + " " + rx + " " + ((ry + by) / 2) + "Z";
  }

  /* Four legs, near pair drawn full and far pair slightly short and behind,
     which is what stops them reading as table legs. */
  function legs(a) {
    var by = a.by, fx = dflt(a.fx, a.sx - 20), lx = dflt(a.lx, a.rx + 20);
    var bend = dflt(a.bend, 7), th = dflt(a.thick, 0), hoof = dflt(a.hoof, 0);
    var out = [
      "M" + fx + " " + (by - 5) + "C" + (fx + 4) + " " + (by + 14) + " " + (fx + 3) + " " + (G - 12) + " " + (fx + 2) + " " + G,
      "M" + (fx - 15) + " " + (by - 2) + "C" + (fx - 12) + " " + (by + 14) + " " + (fx - 13) + " " + (G - 12) + " " + (fx - 14) + " " + (G - 3),
      "M" + lx + " " + (by - 6) + "C" + (lx - bend - 4) + " " + (by + 8) + " " + (lx - bend + 3) + " " + (by + 20) + " " + (lx - bend + 2) + " " + G,
      "M" + (lx + 16) + " " + (by - 3) + "C" + (lx + 16 - bend) + " " + (by + 10) + " " + (lx + 15) + " " + (by + 22) + " " + (lx + 15) + " " + (G - 3)
    ];
    if (th) out = out.concat([
      "M" + (fx + 10) + " " + (by - 3) + "C" + (fx + 14) + " " + (by + 14) + " " + (fx + 13) + " " + (G - 11) + " " + (fx + 12) + " " + G,
      "M" + (lx - 10) + " " + (by - 4) + "C" + (lx - 16) + " " + (by + 10) + " " + (lx - 14) + " " + (by + 21) + " " + (lx - 14) + " " + G
    ]);
    if (hoof) out = out.concat([
      "M" + (fx - 2) + " " + G + "h7", "M" + (lx - bend - 2) + " " + G + "h7"
    ]);
    return out;
  }
  function eye(a, dx, dy) {
    return "M" + (a.hx + dflt(dx, 3)) + " " + (a.hy + dflt(dy, -4)) + "a2.1 2.1 0 1 0 .1 0";
  }
  /* a pricked ear anchored on the skull */
  function ear(x, y, h, lean) {
    lean = dflt(lean, 0);
    return "M" + x + " " + y + "C" + (x - 4 + lean) + " " + (y - h) + " " + (x + 4 + lean) + " " +
      (y - h - 4) + " " + (x + 8 + lean) + " " + (y - h + 4) + "C" + (x + 10 + lean) + " " +
      (y - h + 10) + " " + (x + 7) + " " + (y - 3) + " " + (x + 6) + " " + y;
  }

  B.rhino = function (p) {
    var horns = dflt(p.horns, 2), lip = dflt(p.lip, "square"), folds = dflt(p.folds, 0);
    /* Built on the same profile-head skeleton as the antelopes, which is what
       keeps the plates consistent. The horn is drawn as a solid mass sitting
       ON the muzzle line rather than floating above it. */
    var h = ungulateHead({ mz: 0.55, ear: 0.55, jaw: 1.05 });
    var nx = 150 + 34 * 0.55, ny = 66 + 16 * 0.55;        /* nose, as the builder places it */
    if (horns >= 1) {
      h.o.push("M154 74C156 56 166 38 178 32C185 29 184 42 178 56C173 68 166 76 161 80Z");
    }
    if (horns >= 2) {
      h.o.push("M128 66C130 54 138 44 144 45C150 46 147 58 142 68Z");
    }
    if (lip === "hook") h.d.push("M" + (nx - 4) + " " + (ny + 16) + "C" + (nx + 2) + " " +
                                 (ny + 22) + " " + (nx - 6) + " " + (ny + 26) + " " + (nx - 12) + " " + (ny + 22));
    if (folds) h.f = h.f.concat(["M86 76C94 92 96 112 92 130", "M70 90C76 106 78 122 74 138"]);
    h.f.push("M96 68C112 66 130 74 144 86");
    return h;
  };

  B.elephant = function (p) {
    var earSz = dflt(p.ear, 1), tusk = dflt(p.tusk, 1);
    /* Profile head. The trunk replaces the muzzle, the ear is a closed fan
       drawn behind the skull, and the tusk emerges beneath the lip. */
    var o = [
      /* ear first, so the head overlaps it */
      "M110 50C" + (92 - 10 * earSz) + " 50 " + (80 - 11 * earSz) + " 72 " +
        (85 - 8 * earSz) + " 96C" + (89 - 6 * earSz) + " 114 " + (102 - 3 * earSz) + " 122 112 118Z",
      /* domed cranium, brow, and the trunk falling to a curled tip */
      "M104 44C112 22 138 16 158 26C174 34 184 50 187 68" +
        "C190 82 192 100 191 116C190 128 186 136 180 136" +
        "C175 136 173 129 174 120C176 104 174 90 168 80" +
        "C160 86 148 90 138 90C130 90 125 96 123 106" +
        "C121 118 122 130 124 142L84 142C80 120 80 92 86 72C91 56 96 48 104 44Z"
    ];
    if (tusk) o.push("M164 94C176 102 186 118 186 131C186 138 180 140 176 135C170 127 165 110 161 98Z");
    var f = [
      "M110 42C126 34 146 38 160 50",
      "M180 78C184 94 185 110 183 124",
      "M" + (96 - 6 * earSz) + " 66C" + (101 - 4 * earSz) + " 90 106 110 112 128",
      "M132 102C134 116 133 130 133 142"
    ];
    var d = [
      "M148 54C152 50 158 50 161 53",
      "M176 128C182 130 186 133 187 138",
      "M108 70C116 66 124 66 130 68",
      "M112 112C116 114 119 114 121 112", "M112 126C116 128 119 128 121 126"
    ];
    o.push(ell(150, 60, 4.8, 3.8));
    return { o: o, f: f, d: d, k: [[150, 60, 2]], s: [],
             h: wrapHatch(84, 84, 112, 128, 6, 0.3, 12)
                 .concat(wrapHatch(114, 48, 156, 54, 4, 0.25, 7)),
             g: [] };
  };

  B.bigcat = function (p) {
    var mane = dflt(p.mane, 0), tuft = dflt(p.tuft, 0), mark = dflt(p.mark, 0);
    var slit = dflt(p.slit, 0);
    var g = face(110, 64, 108, 100, { eyeY: -0.09, eyeDX: 0.215, eyeW: 0.15, eyeH: 0.075,
                                      noseY: 0.155, noseW: 0.075,
                                      padY: 0.29, padR: 0.135, padDX: 0.095, chinY: 0.45 });
    /* Skull: flat across the top between the ears, widest at the cheekbone,
       narrowing to a small chin. Cats are broader than they are tall. */
    var o = [
      "M56 62C54 44 64 28 80 21C90 17 100 15 110 15C120 15 130 17 140 21" +
        "C156 28 166 44 164 62C162 80 156 96 144 107C132 118 120 122 110 122" +
        "C100 122 88 118 76 107C64 96 58 80 56 62Z",
      /* ears: closed triangles seated on the corners of the skull */
      "M63 48C55 34 48 18 53 13C59 8 76 18 88 30C80 38 70 44 63 48Z",
      "M157 48C165 34 172 18 167 13C161 8 144 18 132 30C140 38 150 44 157 48Z"
    ];
    o = o.concat(muzzle(g));
    if (tuft) o.push("M52 14C48 4 50 0 55 2", "M168 14C172 4 170 0 165 2");
    if (mane) {
      o.push("M54 44C30 52 18 78 26 104C34 130 62 146 96 148C124 149 150 142 166 126");
      o = o.concat([tick(52, 38, -16, -6), tick(38, 56, -17, 0), tick(29, 76, -16, 8),
                    tick(30, 98, -13, 14), tick(42, 120, -8, 15), tick(64, 138, -2, 14),
                    tick(90, 148, 3, 13), tick(166, 44, 16, -4), tick(176, 66, 16, 6),
                    tick(172, 92, 14, 12), tick(158, 118, 10, 14)]);
    }

    /* structure lines: cheek ruff, brow mass, bridge of the nose */
    var f = [
      "M62 70C66 88 74 102 88 112",                  /* left cheek ruff */
      "M158 70C154 88 146 102 132 112",              /* right cheek ruff */
      "M" + (g.cx - 12) + " 54C" + (g.cx - 8) + " 62 " + (g.cx - 7) + " 68 " + (g.cx - 6) + " 74",
      "M" + (g.cx + 12) + " 54C" + (g.cx + 8) + " 62 " + (g.cx + 7) + " 68 " + (g.cx + 6) + " 74",
      "M74 44C84 36 96 33 108 34",                   /* brow mass */
      "M146 44C136 36 124 33 112 34"
    ];

    var eL = eyeOn(g, -1), eR = eyeOn(g, 1);
    var d = [eL.lid, eL.brow, eR.lid, eR.brow,
             "M66 42C62 32 58 22 60 18C65 20 74 27 82 33",   /* inner ear */
             "M154 42C158 32 162 22 160 18C155 20 146 27 138 33",
             /* short fur strokes broken out of the contour, so the edge reads
                as coat rather than as a drawn line */
             tick(56, 58, -7, -3), tick(58, 76, -7, 2), tick(64, 92, -7, 4),
             tick(76, 108, -5, 6), tick(164, 58, 7, -3), tick(162, 76, 7, 2),
             tick(156, 92, 7, 4), tick(144, 108, 5, 6)];
    var k = slit
      ? [[eL.x, eL.y, 1.4], [eR.x, eR.y, 1.4]]
      : [[eL.x, eL.y, 3.1], [eR.x, eR.y, 3.1]];
    if (slit) d = d.concat(["M" + eL.x + " " + (eL.y - 4) + "V" + (eL.y + 4),
                            "M" + eR.x + " " + (eR.y - 4) + "V" + (eR.y + 4)]);
    var st = whiskerDots(g);

    if (mark === 1) {                                 /* tiger */
      d = d.concat(["M78 26C75 18 74 11 76 6", "M94 20C93 12 93 6 94 2",
                    "M126 20C127 12 127 6 126 2", "M142 26C145 18 146 11 144 6",
                    "M58 58C48 55 40 53 34 51", "M162 58C172 55 180 53 186 51",
                    "M60 76C50 76 42 77 36 78", "M160 76C170 76 178 77 184 78",
                    "M66 94C58 97 52 100 48 103", "M154 94C162 97 168 100 172 103"]);
    } else if (mark === 2) {                          /* leopard and jaguar */
      d = d.concat(spots([[68, 34], [86, 24], [110, 20], [134, 24], [152, 34],
                          [60, 56], [160, 56], [62, 78], [158, 78],
                          [70, 98], [150, 98], [88, 114], [132, 114]], 3.2));
    } else if (mark === 3) {                          /* cheetah: the tear line */
      d = d.concat(["M" + (eL.x - 2) + " " + (eL.y + 7) + "C" + (eL.x - 6) + " 88 " +
                      (eL.x - 8) + " 104 " + (eL.x - 8) + " 114",
                    "M" + (eR.x + 2) + " " + (eR.y + 7) + "C" + (eR.x + 6) + " 88 " +
                      (eR.x + 8) + " 104 " + (eR.x + 8) + " 114"]);
      d = d.concat(spots([[70, 36], [90, 24], [110, 19], [130, 24], [150, 36],
                          [60, 58], [160, 58], [64, 80], [156, 80]], 2));
    }

    return { o: o, f: f, d: d, k: k, s: st,
             h: wrapHatch(60, 92, 160, 92, 11, 0.3, 8)
                 .concat(wrapHatch(64, 30, 156, 30, 9, 0.28, 6)),
             g: [] };
  };

  B.canid = function (p) {
    var earH = dflt(p.ear, 1), brush = dflt(p.brush, 1), leg = dflt(p.leg, 1);
    /* A canid head is a wedge: broad braincase, high cheekbones, and a long
       tapering muzzle. Ear height separates a wolf from a fennec, so it is the
       parameter that matters most. */
    var g = face(110, 58, 96, 92, { eyeY: -0.10, eyeDX: 0.235, eyeW: 0.115, eyeH: 0.058,
                                    noseY: 0.55, noseW: 0.075, padY: 0.50,
                                    padR: 0.10, padDX: 0.055 });
    var o = [
      "M62 52C58 33 69 19 85 15C97 12 123 12 135 15C151 19 162 33 158 52" +
        "C155 71 147 84 137 92C129 98 122 102 118 110" +
        "C115 118 113 123 110 125C107 123 105 118 102 110" +
        "C98 102 91 98 83 92C73 84 65 71 62 52Z",
      /* pricked ears, tall and set on the corners */
      "M66 44C" + (56 - 6 * earH) + " " + (26 - 16 * (earH - 1)) + " " +
        (50 - 6 * earH) + " " + (8 - 20 * (earH - 1)) + " 58 " + (4 - 18 * (earH - 1)) +
        "C68 " + (0 - 16 * (earH - 1)) + " 85 14 93 28C83 34 72 40 66 44Z",
      "M154 44C" + (164 + 6 * earH) + " " + (26 - 16 * (earH - 1)) + " " +
        (170 + 6 * earH) + " " + (8 - 20 * (earH - 1)) + " 162 " + (4 - 18 * (earH - 1)) +
        "C152 " + (0 - 16 * (earH - 1)) + " 135 14 127 28C137 34 148 40 154 44Z"
    ];
    var f = [
      "M96 40C102 34 118 34 124 40",                  /* brow */
      "M100 66C99 80 100 92 104 102",                 /* bridge of the muzzle */
      "M120 66C121 80 120 92 116 102",
      "M74 60C78 74 84 84 92 92",                     /* cheek */
      "M146 60C142 74 136 84 128 92"
    ];
    var eL = eyeOn(g, -1, 0.5), eR = eyeOn(g, 1, 0.5);
    var d = [
      eL.lid, eL.brow, eR.lid, eR.brow,
      /* nose leather at the tip of the wedge */
      "M104 108C104 105 107 104 110 104C113 104 116 105 116 108" +
        "C116 112 113 115 110 115C107 115 104 112 104 108Z",
      "M110 115V119",
      "M110 119C107 122 103 122 100 120", "M110 119C113 122 117 122 120 120",
      "M70 34C76 26 84 22 90 24", "M150 34C144 26 136 22 130 24",   /* inner ear */
      tick(62, 56, -7, 0), tick(66, 74, -7, 3), tick(158, 56, 7, 0), tick(154, 74, 7, 3)
    ];
    var k = [[eL.x, eL.y, 2.6], [eR.x, eR.y, 2.6]];
    var st = [[98, 100, .7], [95, 104, .7], [102, 105, .7],
              [122, 100, .7], [125, 104, .7], [118, 105, .7]];
    return { o: o, f: f, d: d, k: k, s: st,
             h: wrapHatch(66, 80, 154, 80, 9, 0.3, 8)
                 .concat(wrapHatch(72, 28, 148, 28, 7, 0.28, 6)),
             g: [] };
  };

  B.bear = function (p) {
    var snout = dflt(p.snout, 1), mark = dflt(p.mark, 0);
    /* Round braincase, small high-set ears, and a long straight muzzle with a
       broad leather. Bears read as bears from the ear placement above all. */
    var g = face(110, 62, 100, 94, { eyeY: -0.08, eyeDX: 0.19, eyeW: 0.075, eyeH: 0.04,
                                     noseY: 0.42, noseW: 0.10, padY: 0.38,
                                     padR: 0.13, padDX: 0.06 });
    var o = [
      "M60 58C58 34 76 16 100 13C107 12 113 12 120 13C144 16 162 34 160 58" +
        "C158 78 150 92 138 100C130 106 124 112 121 " + (114 + snout * 4) +
        "C118 " + (121 + snout * 5) + " 114 " + (125 + snout * 5) + " 110 " + (126 + snout * 5) +
        "C106 " + (125 + snout * 5) + " 102 " + (121 + snout * 5) + " 99 " + (114 + snout * 4) +
        "C96 112 90 106 82 100C70 92 62 78 60 58Z",
      /* small rounded ears, set wide and high */
      "M62 42C50 34 42 18 52 12C62 6 78 16 84 28C76 34 68 40 62 42Z",
      "M158 42C170 34 178 18 168 12C158 6 142 16 136 28C144 34 152 40 158 42Z"
    ];
    var f = [
      "M92 42C99 37 121 37 128 42",
      "M96 70C95 84 96 96 100 106", "M124 70C125 84 124 96 120 106",
      "M72 62C76 78 82 90 90 98", "M148 62C144 78 138 90 130 98"
    ];
    var eL = eyeOn(g, -1, 0.3), eR = eyeOn(g, 1, 0.3);
    var ny = g.noseY + snout * 4;
    var d = [
      eL.lid, eR.lid,
      "M99 " + (ny - 4) + "C99 " + (ny - 8) + " 104 " + (ny - 10) + " 110 " + (ny - 10) +
        "C116 " + (ny - 10) + " 121 " + (ny - 8) + " 121 " + (ny - 4) +
        "C121 " + (ny + 2) + " 116 " + (ny + 5) + " 110 " + (ny + 5) +
        "C104 " + (ny + 5) + " 99 " + (ny + 2) + " 99 " + (ny - 4) + "Z",
      "M110 " + (ny + 5) + "V" + (ny + 11),
      "M110 " + (ny + 11) + "C105 " + (ny + 15) + " 100 " + (ny + 14) + " 97 " + (ny + 11),
      "M110 " + (ny + 11) + "C115 " + (ny + 15) + " 120 " + (ny + 14) + " 123 " + (ny + 11),
      "M66 36C72 28 78 24 84 26", "M154 36C148 28 142 24 136 26"
    ];
    var k = [[eL.x, eL.y, 2.4], [eR.x, eR.y, 2.4]];
    if (mark === 1) {           /* the panda's eye patches */
      d = d.concat(["M" + (eL.x - 13) + " " + (eL.y - 9) + "C" + (eL.x - 17) + " " + (eL.y + 6) +
                      " " + (eL.x - 8) + " " + (eL.y + 14) + " " + (eL.x + 4) + " " + (eL.y + 10) +
                      "C" + (eL.x + 12) + " " + (eL.y + 5) + " " + (eL.x + 9) + " " + (eL.y - 10) +
                      " " + (eL.x - 13) + " " + (eL.y - 9) + "Z",
                    "M" + (eR.x + 13) + " " + (eR.y - 9) + "C" + (eR.x + 17) + " " + (eR.y + 6) +
                      " " + (eR.x + 8) + " " + (eR.y + 14) + " " + (eR.x - 4) + " " + (eR.y + 10) +
                      "C" + (eR.x - 12) + " " + (eR.y + 5) + " " + (eR.x - 9) + " " + (eR.y - 10) +
                      " " + (eR.x + 13) + " " + (eR.y - 9) + "Z"]);
    }
    return { o: o, f: f, d: d, k: k, s: [],
             h: wrapHatch(64, 84, 156, 84, 10, 0.3, 8), g: [] };
  };

  B.redpanda = function () {
    var a = { rx: 56, sx: 142, ry: 62, sy: 58, by: 92, hx: 168, hy: 60, hw: 17, hh: 14,
              mz: 6, bend: 6 };
    var o = [beast(a)].concat(legs(a));
    o.push(ear(152, 48, 14, -2), ear(174, 46, 14, 2));
    o.push("M56 78C34 76 18 86 14 100C11 112 21 120 30 114C38 109 34 96 46 90");
    return { o: o,
      d: [eye(a, 1, -4), "M189 62a1.6 1.6 0 1 0 .1 0",
          "M20 106C25 102 27 98 27 94", "M28 113C33 109 35 105 35 101",
          "M158 68C164 72 174 72 180 68"],
      h: hatch(68, 62, 64, 28, 6), g: GROUND };
  };

  /* Ungulate head in profile facing right. Horns rise from the poll, the eye
     sits far back on the side of a long skull, and the muzzle carries the
     nostril and lip. Horn shape is the identification, so it is the parameter
     that varies most. */
  function ungulateHead(o) {
    var mz = dflt(o.mz, 1), earSz = dflt(o.ear, 1), jaw = dflt(o.jaw, 1);
    var out = { o: [], f: [], d: [], k: [], s: [], h: [], g: [] };
    var nx = 150 + 34 * mz, ny = 66 + 16 * mz;
    out.o.push(
      "M96 44C112 40 128 44 140 54" +
      "C" + (nx - 24) + " " + (ny - 12) + " " + (nx - 6) + " " + (ny - 6) + " " + nx + " " + ny +
      "C" + (nx + 8) + " " + (ny + 5) + " " + (nx + 7) + " " + (ny + 15) + " " + (nx - 2) + " " + (ny + 18) +
      "C" + (nx - 12) + " " + (ny + 21) + " " + (nx - 24) + " " + (ny + 18) + " " + (nx - 34) + " " + (ny + 14) +
      "C" + (138 * jaw) + " " + (104 + 8 * mz) + " 112 116 98 122" +
      "C84 128 70 134 62 142L98 142" +
      "C94 120 88 96 86 76C85 62 88 50 96 44Z");
    /* ear, laid back along the neck */
    out.o.push("M92 54C" + (74 - 10 * earSz) + " 44 " + (58 - 12 * earSz) + " 46 " +
      (62 - 10 * earSz) + " 58C" + (66 - 8 * earSz) + " 70 84 72 92 66Z");
    out.f.push("M100 58C112 56 126 60 136 68");           /* cheekbone */
    out.f.push("M100 100C114 104 128 104 140 100");       /* jaw line */
    out.f.push("M" + (nx - 30) + " " + (ny - 2) + "C" + (nx - 18) + " " + (ny + 2) + " " +
               (nx - 8) + " " + (ny + 6) + " " + (nx - 4) + " " + (ny + 10));
    /* eye, large and set back */
    var ex = 132, ey = 66;
    out.o.push(ell(ex, ey, 7.4, 5.6));
    out.k.push([ex, ey, 3]);
    out.d.push("M" + (ex - 9) + " " + (ey - 5) + "C" + (ex - 2) + " " + (ey - 11) + " " +
               (ex + 7) + " " + (ey - 10) + " " + (ex + 10) + " " + (ey - 4));
    /* nostril and lip */
    out.d.push("M" + (nx - 6) + " " + (ny + 6) + "a3 2.2 0 1 0 .1 0");
    out.d.push("M" + (nx - 2) + " " + (ny + 18) + "C" + (nx - 12) + " " + (ny + 22) + " " +
               (nx - 24) + " " + (ny + 20) + " " + (nx - 32) + " " + (ny + 16));
    out.h = wrapHatch(74, 96, 120, 118, 7, 0.3, 10)
      .concat(wrapHatch(96, 58, 130, 54, 4, 0.28, 7));
    return out;
  }

  B.antelope = function (p) {
    var horn = dflt(p.horn, "sweep"), nose = dflt(p.nose, 0), stripe = dflt(p.stripe, 0);
    var h = ungulateHead({ mz: 1, ear: 1.15, jaw: 1 });
    /* horns rise from the poll, behind the brow */
    if (horn === "straight")     h.o.push("M100 42C98 26 96 10 96 -4", "M114 42C114 26 114 10 116 -4");
    else if (horn === "spiral")  h.o.push("M100 42C86 30 84 10 96 4C104 0 110 8 106 16",
                                          "M114 42C110 24 118 8 128 12C134 15 133 25 128 30");
    else if (horn === "sweep")   h.o.push("M100 42C84 32 78 12 90 4", "M114 42C108 24 116 6 132 8");
    else if (horn === "lyre")    h.o.push("M100 42C86 30 78 12 66 4", "M116 42C114 24 122 8 136 0");
    else if (horn === "curl")    h.o.push("M100 42C82 34 76 14 92 8C102 4 106 14 102 22",
                                          "M115 42C132 34 138 14 122 8C112 4 108 14 112 22");
    if (nose) {   /* the saiga's inflated proboscis */
      h.o.push("M176 74C192 72 200 82 196 94C193 103 180 106 172 100");
    }
    if (stripe) h.d = h.d.concat(["M92 78C100 80 108 84 114 90",
                                  "M90 92C98 94 106 98 112 104",
                                  "M88 106C96 108 104 112 110 118"]);
    return h;
  };

  B.bovid = function (p) {
    var horn = dflt(p.horn, "wide"), shag = dflt(p.shag, 0);
    var a = { rx: 46, sx: 140, ry: 62, sy: shag ? 44 : 50, by: 92, hx: 170, hy: 72,
              hw: 19, hh: 15, mz: 9, thick: 1, bend: 6, hoof: 1, nb: 4 };
    var o = [beast(a)].concat(legs(a));
    if (horn === "wide") o.push("M156 62C140 48 120 50 118 62C117 71 128 74 136 68",
                                "M186 60C202 46 220 50 220 62C220 71 210 74 202 68");
    if (horn === "vee")  o.push("M158 60C150 44 146 30 150 24", "M184 58C192 42 198 30 196 22");
    if (horn === "boss") o.push("M154 60C166 48 182 48 188 60",
                                "M154 60C138 52 124 60 127 72C129 80 140 81 146 76",
                                "M188 60C204 52 218 62 214 74C212 82 202 82 196 76");
    if (shag) o = o.concat(["M52 62C62 72 74 74 82 70", "M56 78C66 88 78 90 86 86"]);
    o.push("M46 76C34 74 28 80 30 87");
    return { o: o, d: [eye(a, 1, -5), "M" + (a.hx + a.hw + a.mz - 3) + " " + (a.hy + 2) + "a1.5 1.5 0 1 0 .1 0"],
             h: hatch(54, 56, 80, 34, 7), g: GROUND };
  };

  B.equid = function (p) {
    var mane = dflt(p.mane, "erect"), stripe = dflt(p.stripe, 0);
    var a = { rx: 52, sx: 138, ry: 60, sy: 54, by: 88, hx: 176, hy: 32, hw: 15, hh: 11,
              mz: 14, bend: 8, hoof: 1, nb: 8, nt: 4 };
    var o = [beast(a)].concat(legs(a));
    o.push("M162 24C150 16 142 20 146 28C149 34 158 34 162 30");
    o.push(mane === "erect"
      ? "M136 56C144 38 158 26 170 22"
      : "M136 56C148 36 164 24 178 20C166 34 154 46 146 60");
    o.push("M52 74C36 72 26 82 28 94C29 102 38 104 42 98");
    var d = [eye(a, 0, -3), "M" + (a.hx + a.hw + a.mz - 3) + " " + (a.hy + 2) + "a1.4 1.4 0 1 0 .1 0"];
    if (stripe) d = d.concat(["M66 58C64 68 65 78 68 86", "M80 56C78 66 79 78 82 88",
                              "M94 55C92 66 93 78 96 88", "M108 56C106 66 107 76 110 86",
                              "M122 60C120 68 121 76 124 84", "M146 50C152 40 158 34 164 30",
                              "M154 62C160 52 166 44 172 40"]);
    return { o: o, d: d, h: stripe ? [] : hatch(64, 58, 64, 26, 6), g: GROUND };
  };

  B.camel = function () {
    var a = { rx: 50, sx: 138, ry: 66, sy: 62, by: 92, hx: 176, hy: 36, hw: 15, hh: 11,
              mz: 11, bend: 8, hoof: 1, nb: 6 };
    var o = [beast(a)].concat(legs(a));
    /* two humps drawn over the backline */
    o.push("M68 66C72 44 88 38 98 44C105 48 106 60 106 66");
    o.push("M112 66C118 44 134 38 142 46C148 52 146 62 144 68");
    o.push("M162 28C150 20 142 24 146 32C149 38 158 38 162 34");
    return { o: o, d: [eye(a, 0, -3), "M" + (a.hx + a.hw + a.mz - 3) + " " + (a.hy + 2) + "a1.4 1.4 0 1 0 .1 0"],
             h: hatch(62, 72, 68, 22, 6), g: GROUND };
  };

  B.giraffe = function (p) {
    var neckL = dflt(p.neck, 1), patch = dflt(p.patch, 1);
    var top = 100 - 74 * neckL;
    var o = [
      /* body and the long neck drawn as one rising silhouette */
      "M46 100C42 84 60 74 88 72C108 71 120 74 126 80" +
        "C134 " + (80 - 26 * neckL) + " 150 " + (80 - 50 * neckL) + " 158 " + (top + 12) +
        "C160 " + (top + 2) + " 172 " + (top - 2) + " 180 " + (top + 4) +
        "C190 " + (top + 8) + " 192 " + (top + 18) + " 186 " + (top + 22) +
        "C180 " + (top + 26) + " 170 " + (top + 26) + " 164 " + (top + 22) +
        "C156 " + (top + 30) + " 148 " + (80 - 44 * neckL) + " 138 " + (80 - 20 * neckL) +
        "C132 92 130 100 128 106C104 112 62 112 48 106C44 104 46 102 46 100Z",
      "M46 88C34 84 26 90 28 98"
    ].concat(legs({ rx: 46, sx: 126, by: 104, bend: 9, hoof: 1 }));
    /* ossicones and ear */
    o.push("M168 " + (top + 1) + "C166 " + (top - 12) + " 168 " + (top - 17) + " 172 " + (top - 16) +
           "C176 " + (top - 15) + " 176 " + (top - 8) + " 175 " + (top + 1));
    o.push("M180 " + (top + 2) + "C179 " + (top - 11) + " 182 " + (top - 15) + " 186 " + (top - 14) +
           "C190 " + (top - 13) + " 189 " + (top - 6) + " 187 " + (top + 3));
    o.push("M160 " + (top + 8) + "C148 " + (top) + " 140 " + (top + 5) + " 145 " + (top + 13) +
           "C148 " + (top + 18) + " 156 " + (top + 17) + " 160 " + (top + 13));
    var d = ["M174 " + (top + 10) + "a1.9 1.9 0 1 0 .1 0"];
    if (patch) d = d.concat(spots([[62, 88], [78, 84], [94, 88], [110, 86],
                                   [66, 100], [84, 100], [102, 100],
                                   [134, 80 - 22 * neckL], [144, 80 - 42 * neckL],
                                   [152, top + 24]], 5.2));
    return { o: o, d: d, h: [], g: GROUND };
  };

  B.tapir = function () {
    var a = { rx: 44, sx: 138, ry: 58, sy: 50, by: 92, hx: 166, hy: 68, hw: 19, hh: 15,
              mz: 8, thick: 1, bend: 6, nb: 4 };
    var o = [beast(a)].concat(legs(a));
    /* the short prehensile proboscis */
    o.push("M196 64C210 64 216 76 212 88C208 98 196 98 192 90");
    o.push("M152 54C148 42 156 37 162 41C167 44 166 53 164 57");
    o.push("M44 76C32 74 26 80 28 87");
    return { o: o, d: [eye(a, 1, -5), "M206 86a1.5 1.5 0 1 0 .1 0"],
             h: hatch(52, 56, 80, 34, 7), g: GROUND };
  };

  B.ape = function (p) {
    var crest = dflt(p.crest, 0), shag = dflt(p.shag, 0), flange = dflt(p.flange, 0);
    /* Great ape: heavy supraorbital torus, a flat dished face, small ears set
       low and back, and a wide mouth. The brow is what says "ape". */
    var g = face(110, 66, 96, 104, { eyeY: -0.13, eyeDX: 0.185, eyeW: 0.085, eyeH: 0.042,
                                     noseY: 0.11, noseW: 0.085, padY: 0.27,
                                     padR: 0.13, padDX: 0.05 });
    var o = [
      /* cranium and jaw */
      "M60 62C58 34 76 14 100 11C107 10 113 10 120 11C144 14 162 34 160 62" +
        "C158 84 150 104 136 116C127 124 118 128 110 128C102 128 93 124 84 116" +
        "C70 104 62 84 60 62Z",
      /* the face mask, dished and set inside the head */
      "M78 58C78 40 92 30 110 30C128 30 142 40 142 58C142 78 134 100 122 110" +
        "C117 114 103 114 98 110C86 100 78 78 78 58Z",
      /* ears, low and close to the skull */
      "M60 62C50 58 46 70 52 78C56 83 62 82 64 78",
      "M160 62C170 58 174 70 168 78C164 83 158 82 156 78"
    ];
    if (flange) {   /* the orangutan's cheek pads */
      o.push("M62 56C42 58 34 74 42 92C48 104 62 108 72 102");
      o.push("M158 56C178 58 186 74 178 92C172 104 158 108 148 102");
    }
    if (crest) o.push("M88 20C96 6 124 6 132 20");        /* sagittal crest */
    var f = [
      "M80 50C92 42 128 42 140 50",                        /* brow ridge */
      "M96 60C98 72 100 82 104 88", "M124 60C122 72 120 82 116 88",
      "M92 104C102 110 118 110 128 104"
    ];
    if (shag) f = f.concat([tick(58, 44, -11, -6), tick(56, 70, -12, 2), tick(64, 96, -10, 8),
                            tick(162, 44, 11, -6), tick(164, 70, 12, 2), tick(156, 96, 10, 8),
                            tick(88, 16, -4, -10), tick(110, 12, 0, -11), tick(132, 16, 4, -10)]);
    var eL = eyeOn(g, -1, 0.15, 1.2), eR = eyeOn(g, 1, 0.15, 1.2);
    var d = [
      eL.lid, eR.lid,
      /* flat nostrils, no leather */
      "M104 " + (g.noseY + 4) + "a2.4 1.8 0 1 0 .1 0", "M116 " + (g.noseY + 4) + "a2.4 1.8 0 1 0 .1 0",
      "M104 " + (g.noseY - 2) + "C107 " + (g.noseY - 6) + " 113 " + (g.noseY - 6) + " 116 " + (g.noseY - 2),
      /* wide mouth */
      "M92 " + g.padY + "C100 " + (g.padY + 7) + " 120 " + (g.padY + 7) + " 128 " + g.padY,
      "M94 " + (g.padY + 3) + "C102 " + (g.padY + 12) + " 118 " + (g.padY + 12) + " 126 " + (g.padY + 3)
    ];
    return { o: o, f: f, d: d, k: [[eL.x, eL.y, 2.3], [eR.x, eR.y, 2.3]], s: [],
             h: wrapHatch(64, 88, 156, 88, 9, 0.3, 9), g: [] };
  };

  B.gibbon = function () {
    return { o: [
      "M96 112C86 92 88 74 100 66C110 59 124 60 132 68C142 78 143 96 136 112" +
        "C130 124 104 125 96 112Z",
      "M100 74C78 66 62 48 60 32C59 22 66 16 72 20",
      "M134 76C156 70 176 78 182 94C186 105 180 114 172 112",
      "M104 62C100 46 112 36 126 38C138 40 145 50 142 60C139 70 128 74 117 72C109 71 105 68 104 62Z",
      "M110 58C110 48 117 43 125 44C133 45 137 51 136 59C135 67 128 70 121 69C114 68 110 64 110 58Z",
      "M104 114C100 124 104 132 110 131", "M130 114C134 124 130 132 124 131"
    ], d: ["M117 54a1.9 1.9 0 1 0 .1 0", "M131 54a1.9 1.9 0 1 0 .1 0",
           "M118 63C122 66 128 66 131 63", "M62 26C58 20 60 14 66 14"],
      h: hatch(102, 80, 34, 30, 5), g: ["M18 18C64 30 118 30 164 18"] };
  };

  B.monkey = function (p) {
    var crest = dflt(p.crest, 0), ruff = dflt(p.ruff, 0), snout = dflt(p.snout, 0);
    /* Smaller face than an ape, rounder skull, larger and more exposed ears,
       and — in the guenons and langurs — a bright ruff framing the cheeks. */
    var g = face(110, 64, 88, 96, { eyeY: -0.11, eyeDX: 0.195, eyeW: 0.10, eyeH: 0.052,
                                    noseY: 0.14, noseW: 0.07, padY: 0.30,
                                    padR: 0.12, padDX: 0.05 });
    var o = [
      "M66 60C64 34 82 16 110 14C138 16 156 34 154 60" +
        "C152 82 144 102 132 114C125 121 116 125 110 125C104 125 95 121 88 114" +
        "C76 102 68 82 66 60Z",
      /* the bare face */
      "M82 58C82 40 94 30 110 30C126 30 138 40 138 58" +
        "C138 76 131 " + (96 + snout * 6) + " 120 " + (106 + snout * 8) +
        "C116 " + (110 + snout * 8) + " 104 " + (110 + snout * 8) + " 100 " + (106 + snout * 8) +
        "C89 " + (96 + snout * 6) + " 82 76 82 58Z",
      /* big exposed ears */
      "M66 56C52 48 42 58 48 70C53 80 63 80 68 74Z",
      "M154 56C168 48 178 58 172 70C167 80 157 80 152 74Z"
    ];
    if (crest) o.push("M88 22C96 6 124 6 132 22");
    if (ruff) {
      o.push("M66 52C48 56 40 76 48 94C55 110 74 120 94 122");
      o.push("M154 52C172 56 180 76 172 94C165 110 146 120 126 122");
      o = o.concat([tick(56, 60, -10, -4), tick(50, 82, -10, 4), tick(58, 104, -8, 9),
                    tick(164, 60, 10, -4), tick(170, 82, 10, 4), tick(162, 104, 8, 9)]);
    }
    var f = ["M86 50C96 43 124 43 134 50",
             "M100 62C101 74 102 84 105 92", "M120 62C119 74 118 84 115 92"];
    var eL = eyeOn(g, -1, 0.2, 1.4), eR = eyeOn(g, 1, 0.2, 1.4);
    var d = [
      eL.lid, eL.brow, eR.lid, eR.brow,
      "M105 " + (g.noseY + 3) + "a2 1.6 0 1 0 .1 0", "M115 " + (g.noseY + 3) + "a2 1.6 0 1 0 .1 0",
      "M96 " + (g.padY + snout * 6) + "C103 " + (g.padY + 6 + snout * 6) + " 117 " +
        (g.padY + 6 + snout * 6) + " 124 " + (g.padY + snout * 6),
      "M70 50C76 42 82 40 86 42", "M150 50C144 42 138 40 134 42"
    ];
    return { o: o, f: f, d: d, k: [[eL.x, eL.y, 2.6], [eR.x, eR.y, 2.6]], s: [],
             h: wrapHatch(70, 88, 150, 88, 8, 0.3, 8), g: [] };
  };

  B.lemur = function (p) {
    var earSz = dflt(p.ear, 1), tail = dflt(p.tail, "ring"), pointed = dflt(p.pointed, 1);
    /* Enormous forward eyes with a bright ring, a narrow fox-like muzzle and
       large mobile ears. The eye is far larger relative to the skull than in
       any monkey, and that is the whole of the impression. */
    var g = face(110, 62, 92, 94, { eyeY: -0.10, eyeDX: 0.215, eyeW: 0.135, eyeH: 0.10,
                                    noseY: 0.40, noseW: 0.055, padY: 0.36,
                                    padR: 0.085, padDX: 0.04 });
    var o = [
      "M64 56C62 32 80 14 110 12C140 14 158 32 156 56" +
        "C154 74 146 86 136 94C128 100 122 106 118 " + (112 * pointed) +
        "C115 " + (119 * pointed) + " 113 " + (123 * pointed) + " 110 " + (124 * pointed) +
        "C107 " + (123 * pointed) + " 105 " + (119 * pointed) + " 102 " + (112 * pointed) +
        "C98 106 92 100 84 94C74 86 66 74 64 56Z",
      /* large ears */
      "M66 44C" + (52 - 8 * earSz) + " 34 " + (44 - 8 * earSz) + " 14 54 8" +
        "C64 3 82 16 90 30C80 36 70 41 66 44Z",
      "M154 44C" + (168 + 8 * earSz) + " 34 " + (176 + 8 * earSz) + " 14 166 8" +
        "C156 3 138 16 130 30C140 36 150 41 154 44Z"
    ];
    var eL = eyeOn(g, -1, 0.1, 1.05), eR = eyeOn(g, 1, 0.1, 1.05);
    /* the pale ring round the eye, which most lemurs carry */
    var f = [
      "M" + (eL.x - g.eyeW - 4) + " " + eL.y + "a" + (g.eyeW + 4) + " " + (g.eyeH + 4) +
        " 0 1 0 " + ((g.eyeW + 4) * 2) + " 0a" + (g.eyeW + 4) + " " + (g.eyeH + 4) +
        " 0 1 0 " + (-(g.eyeW + 4) * 2) + " 0Z",
      "M" + (eR.x - g.eyeW - 4) + " " + eR.y + "a" + (g.eyeW + 4) + " " + (g.eyeH + 4) +
        " 0 1 0 " + ((g.eyeW + 4) * 2) + " 0a" + (g.eyeW + 4) + " " + (g.eyeH + 4) +
        " 0 1 0 " + (-(g.eyeW + 4) * 2) + " 0Z",
      "M102 76C102 88 104 98 107 106", "M118 76C118 88 116 98 113 106"
    ];
    var d = [
      eL.lid, eR.lid,
      "M105 " + (g.noseY - 2) + "C105 " + (g.noseY - 5) + " 115 " + (g.noseY - 5) + " 115 " +
        (g.noseY - 2) + "C115 " + (g.noseY + 2) + " 105 " + (g.noseY + 2) + " 105 " +
        (g.noseY - 2) + "Z",
      "M110 " + (g.noseY + 2) + "V" + (g.noseY + 8),
      "M110 " + (g.noseY + 8) + "C106 " + (g.noseY + 12) + " 102 " + (g.noseY + 11) + " 100 " + (g.noseY + 8),
      "M110 " + (g.noseY + 8) + "C114 " + (g.noseY + 12) + " 118 " + (g.noseY + 11) + " 120 " + (g.noseY + 8),
      "M70 36C76 26 84 22 88 26", "M150 36C144 26 136 22 132 26"
    ];
    if (tail === "ring") {
      /* a banded tail brought up beside the head, the way it is carried */
      d = d.concat(["M172 122C184 108 190 88 186 70", "M162 126C174 112 180 92 176 74"]);
      d = d.concat(["M170 112L180 116", "M176 98L186 101", "M178 84L188 86"]);
    }
    return { o: o, f: f, d: d, k: [[eL.x, eL.y, 4.2], [eR.x, eR.y, 4.2]], s: [],
             h: wrapHatch(70, 84, 150, 84, 8, 0.3, 8), g: [] };
  };

  B.smallmammal = function (p) {
    var earSz = dflt(p.ear, 1), tail = dflt(p.tail, 0), stripe = dflt(p.stripe, 0);
    var a = { rx: 62, sx: 148, ry: 84, sy: 80, by: 110, hx: 172, hy: 82, hw: 16, hh: 13,
              mz: 7, bend: 6 };
    var o = [beast(a)].concat(legs(a));
    o.push(ear(158, 72, 26 * earSz, -2), ear(178, 70, 26 * earSz, 2));
    if (tail) o.push("M62 96C48 92 40 98 42 106C44 112 52 113 56 108");
    if (stripe) o = o.concat(["M86 84C84 94 85 104 88 110", "M100 82C98 92 99 104 102 110",
                              "M114 82C112 92 113 104 116 110", "M126 84C124 94 125 102 128 108"]);
    return { o: o,
      d: [eye(a, 1, -3), "M" + (a.hx + a.hw + a.mz - 3) + " " + (a.hy + 1) + "a1.5 1.5 0 1 0 .1 0",
          "M" + (a.hx + 12) + " " + (a.hy + 6) + "C" + (a.hx + 20) + " " + (a.hy + 9) + " " + (a.hx + 24) + " " + (a.hy + 10) + " " + (a.hx + 26) + " " + (a.hy + 12)],
      h: stripe ? [] : hatch(72, 82, 62, 26, 6), g: GROUND };
  };

  B.mustelid = function (p) {
    var web = dflt(p.web, 0), snout = dflt(p.snout, 1);
    var a = { rx: 36, sx: 146, ry: 88, sy: 84, by: 110, hx: 170, hy: 84, hw: 15, hh: 12,
              mz: 6 + snout * 3, bend: 5 };
    var o = [beast(a)].concat(legs(a));
    o.push("M156 74C152 64 159 60 164 64C168 67 167 74 165 77");
    o.push("M176 73C176 63 184 60 187 65C190 69 187 76 184 79");
    o.push("M36 96C20 92 8 98 8 106C8 112 16 115 22 110");
    if (web) o = o.concat(["M50 130C56 134 64 134 68 130", "M112 130C118 134 126 134 130 130"]);
    return { o: o, d: [eye(a, 1, -3), "M" + (a.hx + a.hw + a.mz - 3) + " " + (a.hy + 1) + "a1.5 1.5 0 1 0 .1 0"],
             h: hatch(46, 86, 96, 24, 9), g: GROUND };
  };

  B.pangolin = function (p) {
    var band = dflt(p.bands, 7), tail = dflt(p.tail, 1);
    var a = { rx: 46, sx: 148, ry: 86, sy: 62, by: 110, hx: 170, hy: 84, hw: 14, hh: 11,
              mz: 8, bend: 5 };
    var o = [beast(a)].concat(legs(a));
    if (tail) o.push("M46 98C26 96 10 102 8 112C7 119 15 122 21 117C26 113 22 106 32 102");
    var d = [], i;
    for (i = 0; i < band; i++) {
      var x = 56 + i * 13;
      d.push("M" + x + " " + (108 - i * 1.4) + "C" + (x + 4) + " " + (92 - i * 3.2) +
             " " + (x + 5) + " " + (78 - i * 3.2) + " " + (x + 2) + " " + (68 - i * 2.4));
    }
    d.push(eye(a, 1, -3));
    if (tail) d = d.concat(["M16 112C21 109 23 105 23 101", "M24 117C29 114 31 110 31 106"]);
    return { o: o, d: d, h: [], g: GROUND };
  };

  B.wombat = function (p) {
    var arboreal = dflt(p.arboreal, 0);
    if (arboreal) {
      return { o: [
        "M92 124C82 104 84 80 98 70C110 61 128 62 138 72C150 84 152 106 144 124" +
          "C138 132 100 133 92 124Z",
        "M98 80C84 86 78 98 82 110C84 118 92 120 96 114",
        "M140 82C154 88 160 100 156 112C154 120 146 122 142 116",
        "M100 62C94 42 110 28 128 30C144 32 154 46 150 60C146 74 130 80 116 77C106 75 101 69 100 62Z",
        "M100 46C88 34 90 22 100 22C110 22 116 34 114 44",
        "M148 44C160 32 170 24 174 34C178 43 168 52 158 54",
        "M118 58C118 50 124 45 130 46C137 47 140 53 139 60C138 68 131 71 125 70C119 69 118 64 118 58Z",
        "M98 122C94 130 98 133 104 132", "M142 122C146 130 142 133 136 132"
      ], d: ["M112 52a2 2 0 1 0 .1 0", "M141 52a2 2 0 1 0 .1 0", "M126 62C130 65 134 64 136 61"],
        h: hatch(98, 84, 52, 34, 5), g: ["M182 8C176 52 178 96 184 132"] };
    }
    var a = { rx: 52, sx: 148, ry: 84, sy: 78, by: 110, hx: 172, hy: 84, hw: 18, hh: 14,
              mz: 6, bend: 5 };
    var o = [beast(a)].concat(legs(a));
    o.push("M158 72C154 62 162 57 168 61C172 64 171 72 169 76");
    o.push("M180 71C180 61 188 57 191 63C194 67 191 74 188 77");
    return { o: o, d: [eye(a, 1, -3), "M" + (a.hx + a.hw + a.mz - 3) + " " + (a.hy + 1) + "a1.5 1.5 0 1 0 .1 0"],
             h: hatch(62, 82, 80, 28, 8), g: GROUND };
  };

  B.treekangaroo = function () {
    return { o: [
      "M86 118C76 98 80 76 94 66C106 57 124 58 134 68C146 80 148 100 142 118" +
        "C136 128 94 130 86 118Z",
      "M94 76C80 84 74 98 78 110C80 118 88 120 92 114",
      "M138 78C152 86 158 100 154 112C152 120 144 122 140 116",
      "M100 60C94 42 108 30 126 32C142 34 150 46 146 58C142 70 128 75 114 72C104 70 101 66 100 60Z",
      "M100 44C90 32 94 22 104 24C112 26 116 36 114 44",
      "M142 42C152 30 162 26 164 36C166 45 158 52 150 53",
      "M146 112C170 116 188 104 190 86C191 74 182 68 176 74C171 79 176 90 168 96",
      "M96 118C92 128 96 132 102 131", "M136 118C140 128 136 132 130 131"
    ], d: ["M112 52a2 2 0 1 0 .1 0", "M136 52a2 2 0 1 0 .1 0", "M120 62C124 65 130 65 133 62"],
      h: hatch(94, 80, 52, 34, 5), g: ["M16 22C62 34 118 34 166 20"] };
  };

  B.devil = function () {
    var a = { rx: 50, sx: 146, ry: 84, sy: 76, by: 108, hx: 172, hy: 82, hw: 18, hh: 14,
              mz: 7, bend: 5 };
    var o = [beast(a)].concat(legs(a));
    /* the gape it is named for */
    o.push("M192 82C202 82 208 88 205 94C202 100 190 100 185 95");
    o.push(ear(156, 68, 15, -2), ear(178, 66, 15, 2));
    o.push("M50 92C34 88 22 94 22 102C22 108 30 111 36 106");
    return { o: o,
      d: [eye(a, 1, -4), "M194 88L197 94", "M201 88L203 93", "M189 96C194 94 201 94 205 96"],
      h: hatch(58, 80, 84, 26, 8), g: GROUND };
  };

  B.bat = function () {
    return { o: [
      "M110 56C100 56 96 70 98 88C100 106 106 118 116 118C126 118 132 106 134 88" +
        "C136 70 130 56 118 56Z",
      "M104 62C74 44 40 40 20 56C10 64 12 78 24 82C44 88 76 78 100 74",
      "M126 62C156 44 190 40 210 56C220 64 218 78 206 82C186 88 154 78 130 74",
      "M104 54C100 38 112 30 124 32C136 34 140 44 136 52C132 60 114 62 104 54Z",
      "M104 40C98 26 106 20 113 24C118 27 118 36 116 42",
      "M132 40C134 26 142 22 146 28C149 33 144 42 140 46",
      "M112 116C108 126 112 132 118 130", "M124 116C128 126 124 132 118 130"
    ], d: ["M112 46a1.9 1.9 0 1 0 .1 0", "M128 46a1.9 1.9 0 1 0 .1 0",
           "M86 70L72 52", "M62 70L52 50", "M40 68L34 52",
           "M144 70L158 52", "M168 70L178 50", "M190 68L196 52"],
      h: [], g: ["M14 14C64 26 156 26 208 12"] };
  };

  B.saola = function () {
    var a = { rx: 56, sx: 136, ry: 62, sy: 56, by: 88, hx: 170, hy: 32, hw: 14, hh: 10,
              mz: 10, bend: 10, hoof: 1, nt: 6 };
    var o = [beast(a)].concat(legs(a));
    o.push("M158 26C146 19 138 23 142 31C145 37 154 36 158 32");
    /* the two long straight parallel horns that identify it */
    o.push("M164 21C163 4 164 -12 166 -26", "M179 21C181 4 184 -12 187 -26");
    return { o: o,
      d: [eye(a, 0, -3), "M160 28C165 25 171 25 175 27",
          "M178 25C182 24 186 25 188 27", "M156 38C160 36 164 36 167 37"],
      h: hatch(68, 60, 60, 26, 6), g: GROUND };
  };

  /* --------------------------------------------------------------- BIRDS */
  /* Birds are drawn as head-and-breast profiles facing right, because a bird
     is identified by its bill. One builder serves them all; the parameters
     that change are bill length, depth, curvature and hook, plus crown shape.

       bl  bill length        bd  bill depth       hook  downcurve at the tip
       cr  crown height       nk  nape fullness    gape  line of the mouth   */
  function birdHead(o) {
    var bl = dflt(o.bl, 34), bd = dflt(o.bd, 9), hook = dflt(o.hook, 0);
    var cr = dflt(o.cr, 0), nk = dflt(o.nk, 0), bx = 146, by = 64;
    var tipX = bx + bl, tipY = by + dflt(o.droop, 2);
    var out = { o: [], f: [], d: [], k: [], s: [], h: [], g: [] };

    /* crown, nape, breast: one contour down the back of the bird */
    out.o.push(
      "M" + (104 - cr * 0.3) + " " + (30 - cr) +
      "C" + (126 + cr * 0.2) + " " + (31 - cr * 0.8) + " " + (140) + " " + (46) +
      " " + bx + " " + (by - bd * 0.55) +
      /* upper mandible */
      "C" + (bx + bl * 0.45) + " " + (by - bd * 0.62) + " " + (tipX - 4) + " " + (tipY - hook - 1) +
      " " + tipX + " " + (tipY + hook * 0.4) +
      /* the tip, hooked or pointed */
      (hook
        ? "C" + (tipX + 3) + " " + (tipY + hook * 1.5) + " " + (tipX - 2) + " " +
          (tipY + hook * 1.9) + " " + (tipX - 6) + " " + (tipY + hook * 1.2)
        : "C" + (tipX + 1) + " " + (tipY + 2) + " " + (tipX - 2) + " " + (tipY + 3) +
          " " + (tipX - 5) + " " + (tipY + 3)) +
      /* lower mandible back to the chin */
      "C" + (bx + bl * 0.4) + " " + (by + bd * 0.75) + " " + (bx - 2) + " " + (by + bd * 0.9) +
      " " + (bx - 10) + " " + (by + bd * 0.9) +
      /* throat and breast falling away, then a curved crop across the foot of
         the plate so the study reads as a bust rather than a flat-bottomed box */
      "C" + 132 + " " + 84 + " " + 128 + " " + 104 + " " + 124 + " " + 128 +
      "C" + 112 + " " + 140 + " " + (76 - nk) + " " + 140 + " " + (64 - nk) + " " + 126 +
      /* back up the nape to the crown */
      "C" + (58 - nk) + " " + 104 + " " + (68 - nk * 0.6) + " " + 64 + " " +
      (84 - nk * 0.3) + " " + (44 - cr * 0.5) +
      "C" + (90 - cr * 0.2) + " " + (34 - cr * 0.9) + " " + (96 - cr * 0.3) + " " +
      (30 - cr) + " " + (104 - cr * 0.3) + " " + (30 - cr) + "Z");

    /* the line where the bill meets the face, and the mouth */
    out.f.push("M" + (bx - 1) + " " + (by - bd * 0.55) + "C" + (bx - 3) + " " + by +
               " " + (bx - 3) + " " + (by + bd * 0.5) + " " + (bx - 10) + " " + (by + bd * 0.9));
    out.d.push("M" + (bx - 6) + " " + (by + 1) + "C" + (bx + bl * 0.45) + " " + (by + 2) +
               " " + (tipX - 12) + " " + (tipY + 2) + " " + (tipX - 5) + " " + (tipY + 3));
    /* nostril */
    out.d.push("M" + (bx + bl * 0.16) + " " + (by - bd * 0.15) + "a1.5 1.1 0 1 0 .1 0");

    /* eye, set high and just behind the bill */
    var ex = dflt(o.eyeX, 128), ey = dflt(o.eyeY, 55), er = dflt(o.eyeR, 6.4);
    out.o.push(ell(ex, ey, er, er * 0.92));
    out.k.push([ex + 0.6, ey, er * 0.42]);
    out.d.push("M" + (ex - er - 2) + " " + (ey - er * 0.7) + "C" + (ex - 2) + " " +
               (ey - er * 1.9) + " " + (ex + er) + " " + (ey - er * 1.6) + " " +
               (ex + er + 3) + " " + (ey - er * 0.4));

    /* feather groups: crown, ear coverts, breast */
    out.f.push("M96 44C108 40 122 42 132 48");
    out.f.push("M" + (ex - 12) + " " + (ey + 12) + "C" + (ex - 2) + " " + (ey + 16) + " " +
               (ex + 8) + " " + (ey + 14) + " " + (ex + 12) + " " + (ey + 9));
    out.h = wrapHatch(74, 96, 120, 100, 7, 0.35, 12)
      .concat(wrapHatch(82, 58, 120, 52, 5, 0.3, 8));
    return out;
  }


  /* Bird rule: rounded body, a wing arc laid over it, tail projecting clear
     behind, head on a visible neck, and legs that reach the perch. */

  B.perchbird = function (p) {
    var bill = dflt(p.bill, 1), crest = dflt(p.crest, 0), cr = crest ? 12 : 0;
    var h = birdHead({
      bl: bill === 2 ? 44 : bill === 3 ? 22 : 28,
      bd: bill === 3 ? 13 : bill === 2 ? 6 : 8,
      cr: cr, eyeR: 6.2
    });
    if (crest) {
      h.o.push("M100 16C106 2 124 0 132 10C136 15 135 22 132 26");
      h.f = h.f.concat([tick(104, 18, -5, -10), tick(114, 12, -2, -11), tick(124, 12, 3, -10)]);
    }
    return h;
  };

  B.raptor = function (p) {
    var crest = dflt(p.crest, 0);
    /* heavy hooked bill, a bony brow over the eye, and a cere at the base */
    var h = birdHead({ bl: 26, bd: 15, hook: 7, cr: 4, eyeR: 7.4, eyeX: 126, eyeY: 53 });
    h.f.push("M112 40C122 34 136 36 144 44");             /* brow ridge */
    h.d.push("M146 52C152 50 158 51 161 54");             /* cere */
    if (crest) {
      h.o.push("M104 22C110 6 130 4 138 14");
      h.f = h.f.concat([tick(108, 22, -6, -12), tick(120, 14, -2, -12), tick(130, 14, 4, -11)]);
    }
    return h;
  };

  B.vulture = function (p) {
    var beard = dflt(p.beard, 0);
    /* bare skin over the head and neck, so the contour is smooth and the
       feather ruff starts abruptly at the base of the neck */
    var h = birdHead({ bl: 30, bd: 14, hook: 6, cr: -6, nk: -6, eyeR: 5.6,
                       eyeX: 124, eyeY: 52 });
    h.f.push("M108 38C118 32 132 34 142 42");
    h.f.push("M80 96C96 88 116 88 128 94");               /* the ruff line */
    h.f = h.f.concat([tick(78, 96, -8, 6), tick(90, 90, -6, 9), tick(106, 87, -2, 11),
                      tick(122, 89, 3, 10)]);
    h.d.push("M148 50C154 48 160 49 163 52");
    h.s = [[100, 58, .8], [110, 52, .8], [94, 68, .8], [106, 70, .8], [118, 64, .8],
           [88, 58, .8], [116, 76, .8]];                  /* bare-skin stipple */
    if (beard) h.d.push("M150 74C148 84 150 90 154 92");
    return h;
  };

  B.crane = function (p) {
    var bill = dflt(p.bill, "long"), crest = dflt(p.crest, 0);
    var o = [
      /* compact body carried high on long legs */
      "M74 92C66 76 76 62 96 58C118 54 138 60 144 74C149 85 143 97 126 101" +
        "C106 106 82 102 74 92Z",
      /* bustle of tertials trailing behind */
      "M78 96C60 100 46 108 40 118C50 118 66 112 78 104",
      /* long neck */
      "M126 62C120 44 122 26 132 16",
      "M138 66C134 48 138 28 146 18",
      /* small head */
      "M132 14C142 8 156 12 158 22C160 32 152 38 143 36C134 34 129 24 132 16Z"
    ];
    if (bill === "long")   o.push("M158 22C176 22 190 26 190 30C190 34 174 37 157 33");
    if (bill === "shoe")   o.push("M157 20C176 18 188 26 187 36C186 44 172 46 160 41C154 38 153 28 157 20Z");
    if (bill === "curved") o.push("M158 22C174 26 184 38 182 50C181 56 175 56 173 50C171 40 165 30 156 27");
    if (crest) o.push("M136 12C140 0 152 -2 156 8C158 13 156 18 153 20");
    o.push("M104 104C106 116 105 126 104 134", "M120 103C122 115 121 126 120 134");
    return { o: o,
      d: ["M146 22a2 2 0 1 0 .1 0",
          "M98 134L92 140", "M104 136L110 140", "M114 134L108 140", "M120 136L126 140",
          "M84 74C102 70 122 76 132 88"],
      h: hatch(88, 68, 50, 30, 5), g: GROUND };
  };

  B.waterfowl = function (p) {
    var crest = dflt(p.crest, 0), neck = dflt(p.neck, 1);
    var top = 66 - 22 * (neck - 1);
    return { o: [
      /* body sitting low in the water */
      "M56 108C48 92 62 78 92 74C124 70 152 76 160 88C166 97 162 108 148 113" +
        "C124 121 76 122 56 108Z",
      /* neck */
      "M140 82C142 " + (82 - 14 * neck) + " 148 " + (top + 6) + " 156 " + top,
      "M152 88C154 " + (88 - 14 * neck) + " 160 " + (top + 10) + " 168 " + (top + 4),
      /* head */
      "M156 " + top + "C166 " + (top - 8) + " 180 " + (top - 4) + " 182 " + (top + 6) +
        "C184 " + (top + 16) + " 175 " + (top + 22) + " 166 " + (top + 20) +
        "C157 " + (top + 18) + " 152 " + (top + 8) + " 156 " + top + "Z",
      /* flat bill */
      "M181 " + (top + 8) + "C196 " + (top + 7) + " 206 " + (top + 11) + " 205 " + (top + 16) +
        "C204 " + (top + 21) + " 192 " + (top + 23) + " 181 " + (top + 19),
      /* wing */
      "M74 86C96 78 128 82 142 96C150 104 148 112 140 114"
    ].concat(crest ? ["M158 " + (top - 4) + "C164 " + (top - 18) + " 178 " + (top - 18) +
                      " 180 " + (top - 6)] : []),
      d: ["M170 " + (top + 8) + "a2 2 0 1 0 .1 0",
          "M186 " + (top + 15) + "C192 " + (top + 15) + " 198 " + (top + 16) + " 201 " + (top + 17),
          "M78 96C100 90 126 94 138 106"],
      h: hatch(74, 84, 66, 26, 6), g: WATER };
  };

  B.parrot = function (p) {
    var crest = dflt(p.crest, 0), tail = dflt(p.tail, 1), heavy = dflt(p.heavy, 1);
    var o = [
      "M88 100C78 82 86 62 108 55C130 48 152 58 158 78C164 98 152 114 132 117" +
        "C110 120 96 112 88 100Z",
      /* head, blockier than a songbird's */
      "M124 55C114 38 126 24 143 25C159 26 168 39 162 52C156 64 135 67 124 55Z",
      /* the deep hooked bill */
      "M162 40C" + (176 + 6 * heavy) + " 37 " + (184 + 8 * heavy) + " 44 " +
        (181 + 8 * heavy) + " 52C" + (179 + 6 * heavy) + " 58 172 62 166 60" +
        "C169 66 161 68 157 63",
      "M158 52C166 56 174 56 179 53",
      /* wing */
      "M100 74C122 66 146 78 153 98C157 110 150 118 140 118",
      /* long graduated tail */
      "M92 106C" + (74 - 22 * tail) + " 114 " + (60 - 28 * tail) + " 126 " + (52 - 32 * tail) + " 138",
      "M100 114C" + (82 - 22 * tail) + " 120 " + (68 - 28 * tail) + " 132 " + (60 - 32 * tail) + " 142",
      /* zygodactyl feet */
      "M114 116C114 124 114 129 113 133", "M132 116C132 124 132 129 131 133"
    ];
    if (crest === 1) o.push("M128 26C136 12 154 12 160 24C163 30 162 37 159 40");
    if (crest === 2) o.push("M126 30C130 14 140 8 146 14", "M136 26C142 10 152 6 157 14",
                            "M146 26C154 14 164 12 166 20");
    return { o: o,
      d: ["M147 42a2.2 2.2 0 1 0 .1 0",
          "M108 131L102 137", "M114 133L120 137", "M126 131L120 137", "M132 133L138 137",
          "M108 86C122 82 138 90 146 104"],
      h: hatch(100, 68, 50, 36, 5), g: PERCH };
  };

  B.penguin = function (p) {
    var crest = dflt(p.crest, 0), tall = dflt(p.tall, 1);
    var top = 46 - 14 * (tall - 1);
    return { o: [
      /* upright teardrop */
      "M86 130C76 108 78 " + (top + 26) + " 96 " + (top + 8) + "C108 " + (top - 4) +
        " 132 " + (top - 4) + " 144 " + (top + 8) + "C162 " + (top + 26) + " 164 108 154 130" +
        "C146 138 94 138 86 130Z",
      /* flipper */
      "M94 " + (top + 34) + "C82 " + (top + 56) + " 84 100 92 116C96 124 104 122 104 114",
      /* head and bill */
      "M102 " + (top + 10) + "C98 " + (top - 8) + " 114 " + (top - 18) + " 132 " + (top - 14) +
        "C146 " + (top - 11) + " 152 " + (top + 2) + " 146 " + (top + 12),
      "M148 " + (top - 6) + "C164 " + (top - 6) + " 174 " + (top - 2) + " 172 " + (top + 3) +
        "C170 " + (top + 8) + " 156 " + (top + 8) + " 146 " + (top + 4),
      /* feet */
      "M98 132C88 138 92 142 102 141C108 140 110 136 110 132",
      "M138 132C148 138 144 142 134 141C128 140 126 136 126 132"
    ], d: ["M140 " + (top - 4) + "a2.1 2.1 0 1 0 .1 0",
           /* the bib line, where black meets white */
           "M104 " + (top + 16) + "C118 " + (top + 26) + " 138 " + (top + 24) + " 148 " + (top + 12)]
        .concat(crest === 1
          ? ["M112 " + (top - 14) + "C100 " + (top - 22) + " 92 " + (top - 18) + " 90 " + (top - 12)]
          : crest === 2
          ? ["M114 " + (top - 15) + "C100 " + (top - 26) + " 88 " + (top - 22) + " 84 " + (top - 14),
             "M120 " + (top - 17) + "C108 " + (top - 30) + " 94 " + (top - 28) + " 90 " + (top - 20),
             "M140 " + (top - 12) + "C152 " + (top - 24) + " 164 " + (top - 22) + " 166 " + (top - 14)]
          : []),
      h: hatch(94, top + 30, 42, 56, 5), g: GROUND };
  };

  B.seabird = function () {
    return { o: [
      /* gliding, seen slightly from the front */
      "M96 88C88 74 100 62 118 62C136 62 148 74 142 88C136 100 108 102 96 88Z",
      /* long narrow wings */
      "M100 74C68 56 30 48 8 58C30 74 66 86 100 84",
      "M140 74C172 56 210 48 232 58C210 74 174 86 140 84",
      /* head and heavy bill */
      "M114 62C108 48 118 38 132 39C145 40 151 50 146 60C141 69 121 71 114 62Z",
      "M147 48C163 47 174 51 173 56C172 61 158 63 146 59",
      /* short tail */
      "M118 98C114 110 116 120 122 126"
    ], d: ["M136 48a2 2 0 1 0 .1 0", "M162 54C166 54 169 55 170 56",
           "M36 66C58 72 78 78 96 80", "M204 66C182 72 162 78 144 80",
           "M60 62L54 72", "M84 70L80 78", "M180 62L186 72", "M156 70L160 78"],
      h: [], g: WATER };
  };

  B.groundbird = function (p) {
    var crest = dflt(p.crest, 0), leg = dflt(p.leg, 1), bill = dflt(p.bill, 1);
    var o = [
      "M72 94C64 76 76 62 100 58C124 54 146 62 152 78C158 94 148 108 126 111" +
        "C102 114 80 108 72 94Z",
      /* trailing tail */
      "M76 98C58 104 44 114 38 126C50 126 68 118 80 108",
      /* upright neck */
      "M126 62C120 46 124 34 136 28",
      "M138 66C134 50 140 36 148 30",
      "M136 26C146 20 160 24 162 34C164 44 156 50 147 48C138 46 133 34 136 26Z",
      /* long legs */
      "M104 110C106 " + (120 + 6 * leg) + " 105 " + (128 + 6 * leg) + " 104 " + (132 + 6 * leg),
      "M122 109C124 " + (119 + 6 * leg) + " 123 " + (128 + 6 * leg) + " 122 " + (132 + 6 * leg)
    ];
    o.push(bill === 2
      ? "M162 34C178 34 190 38 190 42C190 46 174 49 161 45"
      : "M162 34C174 33 182 37 181 41C180 46 170 48 161 45");
    if (crest === 1) o.push("M140 24C146 12 160 10 165 20C168 25 167 31 164 33");
    if (crest === 2) o.push("M138 26C142 12 152 6 157 12", "M146 24C152 10 162 6 166 14",
                            "M154 26C162 14 172 12 174 20");
    return { o: o,
      d: ["M150 33a2 2 0 1 0 .1 0",
          "M98 " + (132 + 6 * leg) + "L92 " + (138 + 6 * leg),
          "M104 " + (134 + 6 * leg) + "L110 " + (138 + 6 * leg),
          "M116 " + (132 + 6 * leg) + "L110 " + (138 + 6 * leg),
          "M122 " + (134 + 6 * leg) + "L128 " + (138 + 6 * leg),
          "M84 74C102 70 124 76 136 90"],
      h: hatch(88, 68, 54, 32, 5), g: GROUND };
  };

  B.wader = function (p) {
    var spoon = dflt(p.spoon, 0);
    return { o: [
      "M88 92C82 78 94 66 112 63C130 60 146 68 150 82C154 96 144 106 126 108" +
        "C108 110 94 104 88 92Z",
      "M94 96C78 100 66 108 60 118C70 118 84 112 94 104",
      "M124 64C118 50 126 40 138 40C150 40 156 50 152 60",
      "M138 38C146 32 158 36 159 45C160 54 152 59 144 57C136 55 133 44 138 38Z",
      spoon
        ? "M136 48C120 48 106 50 100 54C94 58 96 62 104 62C110 62 116 60 122 58"
        : "M136 48C120 48 108 51 104 55",
      "M112 108C112 118 112 126 111 132", "M128 107C128 117 128 126 127 132"
    ].concat(spoon ? ["M104 54C96 50 88 52 86 57C84 62 90 66 98 64C104 63 106 58 104 54Z"] : []),
      d: ["M148 44a1.9 1.9 0 1 0 .1 0",
          "M106 132L100 138", "M112 134L118 138", "M122 132L116 138", "M128 134L134 138",
          "M96 78C112 74 130 80 140 92"],
      h: hatch(98, 72, 46, 28, 4), g: WATER };
  };

  B.hornbill = function () {
    return { o: [
      "M84 100C74 82 82 62 104 55C126 48 148 58 154 78C160 98 148 114 128 117" +
        "C106 120 92 112 84 100Z",
      /* long banded tail */
      "M88 106C72 116 60 128 54 142", "M96 114C82 122 72 132 66 144",
      "M120 55C112 38 124 24 141 25C157 26 166 39 160 52C154 64 131 67 120 55Z",
      /* the great bill with its solid casque */
      "M160 40C186 36 202 42 200 50C198 58 178 62 159 57",
      "M160 32C182 27 198 32 197 40C196 46 182 48 168 46",
      "M100 74C122 66 146 78 152 98C156 110 149 118 139 118",
      "M114 116C114 124 114 129 113 133", "M130 116C130 124 130 129 129 133"
    ], d: ["M146 44a2.1 2.1 0 1 0 .1 0", "M170 48C180 48 190 49 196 51",
           "M108 131L102 137", "M114 133L120 137", "M126 131L120 137", "M132 133L138 137"],
      h: hatch(100, 68, 48, 36, 5), g: PERCH };
  };

  /* ---------------------------------------------------- REPTILES & AMPHIBIA */

  B.tortoise = function (p) {
    var dome = dflt(p.dome, 1), saddle = dflt(p.saddle, 0);
    var o = saddle
      ? ["M46 106C46 92 56 76 82 68C110 60 146 62 160 74C168 81 168 90 164 96" +
           "C158 62 130 54 106 62C88 68 74 82 70 98",
         "M46 106C60 116 100 120 134 114C156 110 166 104 164 96"]
      : ["M46 104C44 " + (86 - 16 * dome) + " 70 " + (68 - 18 * dome) + " 106 " + (68 - 18 * dome) +
           "C142 " + (68 - 18 * dome) + " 168 " + (84 - 16 * dome) + " 166 104",
         "M46 104C60 116 100 120 134 114C156 110 168 108 166 104"];
    o = o.concat([
      "M62 112C64 122 63 128 62 132", "M104 116C106 125 105 129 104 132",
      "M144 112C146 122 145 128 144 132",
      /* neck and head */
      "M162 " + (saddle ? 78 : 94) + "C174 " + (saddle ? 68 : 84) + " 190 " + (saddle ? 70 : 86) +
        " 194 " + (saddle ? 80 : 96) + "C198 " + (saddle ? 91 : 107) + " 189 " + (saddle ? 99 : 115) +
        " 178 " + (saddle ? 97 : 113) + "C169 " + (saddle ? 95 : 111) + " 164 " +
        (saddle ? 87 : 103) + " 165 " + (saddle ? 80 : 96) + "Z",
      "M50 106C38 104 32 110 34 116"
    ]);
    var d = [], i;
    /* scute pattern */
    for (i = 0; i < 5; i++) {
      var x = 62 + i * 22;
      d.push("M" + x + " " + (106 - i) + "C" + (x + 3) + " " + (94 - 12 * dome) + " " +
             (x + 3) + " " + (84 - 14 * dome) + " " + x + " " + (74 - 16 * dome));
    }
    d.push("M56 " + (88 - 12 * dome) + "C90 " + (78 - 14 * dome) + " 130 " + (78 - 14 * dome) +
           " 160 " + (88 - 12 * dome));
    d.push("M184 " + (saddle ? 82 : 98) + "a1.8 1.8 0 1 0 .1 0");
    return { o: o, d: d, h: [], g: GROUND };
  };

  B.seaturtle = function (p) {
    var ridge = dflt(p.ridge, 0);
    var o = [
      /* carapace from above */
      "M62 82C62 54 88 38 116 38C144 38 168 54 168 82C168 108 144 122 116 122" +
        "C88 122 62 108 62 82Z",
      /* fore flippers, long and bladed */
      "M72 62C46 40 20 34 8 44C-2 53 12 74 40 84C54 89 66 82 72 72",
      "M158 62C184 40 210 34 222 44C232 53 218 74 190 84C176 89 164 82 158 72",
      /* hind flippers */
      "M84 114C68 126 62 138 72 142C82 146 96 136 102 124",
      "M146 114C162 126 168 138 158 142C148 146 134 136 128 124",
      /* head */
      "M100 44C98 26 110 16 124 18C138 20 144 32 138 44"
    ];
    var d = ["M112 32a1.9 1.9 0 1 0 .1 0"];
    if (ridge) d = d.concat(["M84 56C80 82 84 104 92 118", "M104 46C102 76 104 104 108 120",
                             "M128 46C130 76 128 104 124 120", "M148 56C152 82 148 104 140 118"]);
    else d = d.concat(["M70 70C100 80 136 80 162 70", "M74 94C102 102 132 102 158 94",
                       "M98 44C94 74 96 104 102 120", "M134 44C138 74 136 104 130 120"]);
    return { o: o, d: d, h: [], g: WATER };
  };

  B.softshell = function () {
    return { o: [
      /* flat leathery pancake */
      "M44 92C42 70 78 56 116 56C154 56 180 68 180 88C180 106 152 118 112 118" +
        "C74 118 46 110 44 92Z",
      "M74 114C70 126 76 132 84 128", "M150 114C154 126 148 132 140 128",
      /* long neck, snorkel snout */
      "M176 78C190 70 204 76 206 86C208 97 199 104 189 102",
      "M204 84C214 84 220 87 219 90C218 93 209 94 203 92"
    ], d: ["M196 84a1.6 1.6 0 1 0 .1 0", "M60 86C96 96 148 96 174 86",
           "M64 74C96 66 140 66 168 74"],
      h: hatch(70, 70, 96, 34, 8), g: WATER };
  };

  B.croc = function (p) {
    var snout = dflt(p.snout, 1), knob = dflt(p.knob, 0);
    var o = [
      /* long low body with a tapering tail */
      "M12 106C34 92 62 86 96 85C130 84 154 88 168 94",
      "M12 106C34 116 62 122 96 122C130 122 154 116 168 108",
      /* stumpy splayed legs */
      "M58 120C54 130 58 136 66 134", "M104 122C100 132 104 138 112 136",
      "M78 118C86 128 82 134 74 134", "M126 118C134 128 130 134 122 134",
      /* jaws */
      "M168 94C" + (186 + 18 * snout) + " 92 " + (200 + 20 * snout) + " 95 " +
        (200 + 20 * snout) + " 99",
      "M168 108C" + (186 + 18 * snout) + " 108 " + (200 + 20 * snout) + " 105 " +
        (200 + 20 * snout) + " 100"
    ];
    if (knob) o.push("M" + (196 + 20 * snout) + " 96C" + (206 + 20 * snout) + " 92 " +
                     (212 + 20 * snout) + " 96 " + (208 + 20 * snout) + " 102");
    var d = ["M172 92a1.6 1.6 0 1 0 .1 0"], i;
    for (i = 0; i < 8; i++) {
      var x = 26 + i * 18;
      d.push("M" + x + " 88C" + (x + 3) + " 80 " + (x + 7) + " 79 " + (x + 8) + " 87");
    }
    for (i = 0; i < 6; i++) {
      var jx = 174 + i * (7 + 3 * snout);
      d.push("M" + jx + " 100L" + jx + " 96", "M" + (jx + 3) + " 102L" + (jx + 3) + " 106");
    }
    return { o: o, d: d, h: [], g: WATER };
  };

  B.lizard = function (p) {
    var crest = dflt(p.crest, 0), dewlap = dflt(p.dewlap, 0);
    var o = [
      "M36 94C56 78 88 72 120 73C148 74 164 80 172 88",
      "M36 94C56 110 88 116 120 115C148 114 164 106 172 98",
      "M62 114C56 126 60 134 70 132", "M110 116C104 128 108 136 118 134",
      "M84 110C94 122 90 132 80 132", "M136 108C146 120 142 130 132 130",
      /* head */
      "M170 84C184 78 198 84 200 94C202 105 193 112 182 110C172 108 167 100 168 92Z",
      /* whipping tail */
      "M36 94C18 88 6 92 4 100C2 108 10 114 18 110"
    ];
    var d = ["M184 90a1.7 1.7 0 1 0 .1 0", "M196 98C200 99 202 100 202 101"], i;
    if (crest) for (i = 0; i < 10; i++) {
      var x = 50 + i * 13;
      d.push("M" + x + " " + (80 - i * 0.4) + "L" + (x + (i % 2 ? 3 : -3)) + " " + (68 - i * 0.5));
    }
    if (dewlap) o.push("M176 106C182 116 176 122 168 118C163 115 164 109 168 106");
    return { o: o, d: d, h: hatch(60, 84, 96, 24, 9), g: GROUND };
  };

  B.frog = function () {
    return { o: [
      /* squat body, front on */
      "M70 116C62 96 74 78 100 74C126 70 152 78 158 96C164 114 150 126 124 128" +
        "C98 130 76 128 70 116Z",
      /* powerful folded hind leg */
      "M152 96C176 92 190 104 186 118C182 130 164 134 152 126",
      "M156 128C170 134 184 132 190 124",
      /* fore leg with splayed toes */
      "M86 116C70 118 62 128 68 134C72 138 82 136 88 130",
      /* the eye bulges that define a frog */
      "M92 78C88 62 100 54 112 58C122 61 124 74 120 82",
      "M134 76C132 60 146 52 156 58C165 63 164 76 158 82"
    ], d: ["M106 72a3 3 0 1 0 .1 0", "M147 70a3 3 0 1 0 .1 0",
           "M86 96C108 106 138 106 156 96",
           "M62 132L56 136", "M68 134L64 140", "M76 134L74 140",
           "M164 124C170 128 178 128 184 126"],
      h: hatch(92, 94, 54, 26, 5), g: GROUND };
  };

  B.salamander = function (p) {
    var gills = dflt(p.gills, 0), pale = dflt(p.pale, 0);
    var o = [
      "M18 100C40 88 74 82 108 82C142 82 164 86 174 92",
      "M18 100C40 112 74 118 108 118C142 118 164 112 174 106",
      "M58 116C52 128 56 134 66 132", "M112 118C106 130 110 136 120 134",
      "M80 112C90 124 86 132 76 132", "M136 110C146 122 142 130 132 130",
      "M174 92C188 86 200 92 202 101C204 111 195 118 185 116C176 114 172 106 173 98Z",
      "M18 100C6 96 0 100 0 106C0 112 6 116 12 112"
    ];
    if (gills) o = o.concat([
      "M172 90C176 74 190 68 194 78C197 86 188 92 180 94",
      "M170 96C158 84 144 84 146 94C148 102 160 104 168 102",
      "M176 110C182 124 196 126 196 116C196 108 186 104 178 104"
    ]);
    return { o: o,
      d: ["M188 96a1.7 1.7 0 1 0 .1 0"].concat(
        gills ? ["M186 76C190 80 191 84 190 88", "M152 92C158 94 162 96 164 98"] : []),
      h: pale ? [] : hatch(46, 90, 110, 22, 10), g: WATER };
  };

  /* ------------------------------------------------------- FISH & MARINE */

  B.shark = function (p) {
    var head = dflt(p.head, "point"), spot = dflt(p.spots, 0), wide = dflt(p.wide, 1);
    var o = [
      /* fusiform body */
      "M26 92C46 " + (92 - 30 * wide) + " 92 " + (92 - 32 * wide) + " 138 " + (92 - 22 * wide) +
        "C158 " + (92 - 18 * wide) + " 172 " + (92 - 10 * wide) + " 180 88",
      "M26 92C46 " + (92 + 28 * wide) + " 92 " + (92 + 30 * wide) + " 138 " + (92 + 20 * wide) +
        "C158 " + (92 + 16 * wide) + " 172 " + (92 + 8 * wide) + " 180 96",
      /* dorsal */
      "M98 " + (92 - 31 * wide) + "C106 " + (62 - 26 * wide) + " 124 " + (56 - 26 * wide) +
        " 128 " + (74 - 24 * wide),
      /* pectoral */
      "M132 " + (92 + 20 * wide) + "C144 " + (112 + 18 * wide) + " 164 " + (116 + 16 * wide) +
        " 168 " + (104 + 14 * wide),
      /* second dorsal and anal */
      "M56 " + (92 - 26 * wide) + "C60 " + (78 - 22 * wide) + " 68 " + (76 - 22 * wide) +
        " 70 " + (84 - 22 * wide),
      /* asymmetric caudal */
      "M26 92C14 66 8 54 4 46C16 58 24 76 26 90",
      "M26 92C16 108 10 118 6 126C18 116 24 102 26 94"
    ];
    if (head === "hammer") {
      o.push("M180 88C196 74 216 76 218 86C220 94 208 98 196 94");
      o.push("M180 96C196 110 216 108 218 98");
    } else if (head === "blunt") {
      o.push("M180 88C194 86 202 90 202 92C202 94 194 98 180 96");
    } else {
      o.push("M180 88C194 88 204 90 206 92C204 94 194 96 180 96");
    }
    var d = [head === "hammer" ? "M204 84a1.9 1.9 0 1 0 .1 0" : "M186 84a1.9 1.9 0 1 0 .1 0",
             "M176 98C186 100 194 100 198 98",
             "M154 78L150 88", "M162 80L158 90", "M170 82L166 92"];
    if (spot) d = d.concat(spots([[60, 76], [84, 70], [108, 74], [132, 72],
                                  [70, 104], [96, 108], [122, 104], [146, 96],
                                  [50, 92], [90, 92], [126, 88]], 3.6));
    return { o: o, d: d, h: [], g: WATER,
      w: ["M26 92C46 " + (92 - 30 * wide) + " 92 " + (92 - 32 * wide) + " 138 " + (92 - 22 * wide) +
            "C170 " + (92 - 12 * wide) + " 190 90 190 92C190 94 170 " + (92 + 10 * wide) +
            " 138 " + (92 + 20 * wide) + "C92 " + (92 + 30 * wide) + " 46 " + (92 + 28 * wide) + " 26 92Z"] };
  };

  B.ray = function (p) {
    var kind = dflt(p.kind, "manta");
    if (kind === "saw") {
      return { o: [
        "M40 92C64 74 108 70 142 74C158 76 168 82 174 88",
        "M40 92C64 110 108 114 142 110C158 108 168 102 174 96",
        "M56 78C36 62 20 58 12 62C20 74 38 84 54 86",
        "M56 106C36 122 20 126 12 122C20 110 38 100 54 98",
        /* the rostrum */
        "M174 88C196 88 216 89 220 91C216 93 196 96 174 96"
      ], d: (function () {
        var t = [], i;
        for (i = 0; i < 10; i++) {
          t.push("M" + (180 + i * 4) + " 89L" + (180 + i * 4) + " 80");
          t.push("M" + (180 + i * 4) + " 95L" + (180 + i * 4) + " 104");
        }
        t.push("M162 84a1.6 1.6 0 1 0 .1 0", "M168 84a1.6 1.6 0 1 0 .1 0");
        return t;
      })(), h: [], g: WATER };
    }
    if (kind === "angel") {
      return { o: [
        /* flattened, buried in sand */
        "M46 92C70 66 118 62 154 70C172 74 182 82 186 90",
        "M46 92C70 118 118 122 154 114C172 110 182 100 186 94",
        "M24 84C36 78 46 80 50 88", "M24 104C36 110 46 108 50 100",
        "M186 90C196 88 202 90 202 92C202 94 196 96 186 94",
        "M64 74C58 62 62 56 70 60", "M64 110C58 122 62 128 70 124"
      ], d: ["M176 86a1.7 1.7 0 1 0 .1 0", "M190 86a1.7 1.7 0 1 0 .1 0",
             "M120 74C124 84 124 100 120 110"],
        h: hatch(70, 80, 100, 26, 9), g: WATER };
    }
    return { o: [
      /* manta: the diamond, seen from in front and above */
      "M110 58C74 58 34 76 14 96C40 114 74 124 110 124C146 124 180 114 206 96" +
        "C186 76 146 58 110 58Z",
      "M14 96C6 104 2 112 2 118C14 116 24 108 30 100",
      "M206 96C214 104 218 112 218 118C206 116 196 108 190 100",
      /* tail */
      "M110 124C108 138 110 146 114 150",
      /* cephalic lobes */
      "M88 64C78 50 82 40 92 44C99 47 100 58 98 66",
      "M132 64C142 50 138 40 128 44C121 47 120 58 122 66"
    ], d: ["M92 82a2 2 0 1 0 .1 0", "M128 82a2 2 0 1 0 .1 0",
           "M64 92C88 104 132 104 156 92", "M74 78C96 72 124 72 146 78"],
      h: [], g: WATER };
  };

  B.fish = function (p) {
    var deep = dflt(p.deep, 1), barbel = dflt(p.barbel, 0);
    var snout = dflt(p.snout, 0), lobe = dflt(p.lobe, 0);
    var o = [
      "M42 92C62 " + (92 - 34 * deep) + " 104 " + (92 - 36 * deep) + " 142 " + (92 - 26 * deep) +
        "C162 " + (92 - 21 * deep) + " 178 " + (92 - 12 * deep) + " 186 88",
      "M42 92C62 " + (92 + 32 * deep) + " 104 " + (92 + 34 * deep) + " 142 " + (92 + 24 * deep) +
        "C162 " + (92 + 19 * deep) + " 178 " + (92 + 10 * deep) + " 186 96",
      /* forked tail */
      "M42 92C28 70 20 58 14 48C26 60 38 76 42 90",
      "M42 92C28 114 20 126 14 136C26 124 38 108 42 94",
      /* dorsal, anal, pectoral */
      "M92 " + (92 - 35 * deep) + "C104 " + (92 - 52 * deep) + " 128 " + (92 - 52 * deep) +
        " 140 " + (92 - 30 * deep),
      "M96 " + (92 + 33 * deep) + "C108 " + (92 + 48 * deep) + " 126 " + (92 + 46 * deep) +
        " 134 " + (92 + 28 * deep),
      "M136 96C146 " + (92 + 30 * deep) + " 160 " + (92 + 32 * deep) + " 166 " + (92 + 22 * deep),
      /* head line and mouth */
      "M162 " + (92 - 22 * deep) + "C156 " + 92 + " 158 " + (92 + 16 * deep) + " 164 " + (92 + 20 * deep)
    ];
    if (snout) o.push("M186 88C202 84 214 86 216 90C218 94 206 98 186 96");
    else       o.push("M186 88C196 88 202 90 202 92C202 94 196 96 186 96");
    if (lobe) o = o.concat(["M64 " + (92 - 26 * deep) + "C50 " + (92 - 44 * deep) + " 40 " +
                            (92 - 44 * deep) + " 38 " + (92 - 32 * deep),
                            "M64 " + (92 + 24 * deep) + "C50 " + (92 + 42 * deep) + " 40 " +
                            (92 + 42 * deep) + " 38 " + (92 + 30 * deep)]);
    var d = ["M176 " + (92 - 8 * deep) + "a2.1 2.1 0 1 0 .1 0",
             "M170 " + (92 + 6 * deep) + "C180 " + (92 + 9 * deep) + " 190 " + (92 + 7 * deep) +
               " 194 " + (92 + 4 * deep)];
    if (barbel) d = d.concat(["M188 98C200 108 200 120 194 126", "M192 96C204 104 208 116 204 122"]);
    return { o: o, d: d, h: hatch(64, 74, 90, 36, 8), g: WATER };
  };

  B.eel = function () {
    return { o: [
      /* one long sinuous line, doubled */
      "M10 100C34 68 62 116 92 96C122 76 142 116 172 92",
      "M10 108C34 78 60 126 90 106C120 86 142 126 176 100",
      /* head */
      "M172 92C186 86 198 90 199 96C200 103 190 106 180 103",
      /* dorsal ripple */
      "M40 84C60 78 66 96 84 88"
    ], d: ["M186 94a1.6 1.6 0 1 0 .1 0", "M190 100C194 100 197 99 198 98",
           "M28 92C36 84 42 86 46 92", "M104 96C112 88 118 90 122 96"],
      h: [], g: WATER };
  };

  B.whale = function (p) {
    var kind = dflt(p.kind, "rorqual");
    var o = [
      kind === "sperm"
        /* the square head that makes a sperm whale unmistakable */
        ? "M30 96C40 66 84 56 138 56C170 56 194 58 208 62C210 70 210 82 208 90"
        : "M30 96C48 66 96 54 144 56C176 57 198 66 208 78",
      kind === "sperm"
        ? "M30 96C46 122 92 132 146 130C176 129 198 122 208 112"
        : "M30 96C48 126 96 138 144 136C176 135 198 124 208 108",
      /* flukes */
      "M30 96C18 74 10 62 4 52C16 64 26 82 30 94",
      "M30 96C18 118 10 130 4 140C16 128 26 110 30 98",
      /* flipper */
      "M104 130C96 146 104 154 116 148C124 144 124 134 120 128"
    ];
    if (kind === "rorqual") o.push("M60 70C64 54 78 48 82 60C84 66 80 72 74 74");
    if (kind === "right")   o.push("M208 78C218 84 220 96 210 106C204 112 196 112 192 106");
    if (kind === "sperm")   o.push("M208 90C216 96 216 106 208 110");
    var d = [kind === "right" ? "M196 82a1.9 1.9 0 1 0 .1 0" : "M196 90a1.9 1.9 0 1 0 .1 0"];
    if (kind === "rorqual") {
      d = d.concat(["M116 132C138 142 168 140 186 128", "M124 138C144 146 168 144 184 134",
                    "M132 142C150 148 168 146 182 140"]);   /* throat pleats */
    }
    if (kind === "right") d = d.concat(spots([[200, 70], [210, 76], [194, 66]], 3.4));
    if (kind === "sperm") d = d.concat(["M196 62C196 78 196 92 198 104"]);
    return { o: o, d: d, h: [], g: WATER };
  };

  B.dolphin = function (p) {
    var beak = dflt(p.beak, 1), fin = dflt(p.fin, 1);
    var o = [
      "M30 92C50 62 96 52 142 56C168 58 190 66 202 " + (beak ? 82 : 78),
      "M30 92C50 122 96 132 142 128C168 126 190 116 202 " + (beak ? 98 : 102),
      "M30 92C18 72 10 60 4 50C16 62 26 78 30 90",
      "M30 92C18 112 10 124 4 134C16 122 26 106 30 94",
      "M100 126C92 142 100 150 112 144C120 140 120 130 116 124"
    ];
    if (fin) o.push("M92 62C96 44 112 38 116 50C118 57 112 64 106 66");
    if (beak) o.push("M202 82C214 82 220 86 220 90C220 94 214 98 202 98");
    var d = ["M188 78a1.9 1.9 0 1 0 .1 0"];
    d.push(beak ? "M204 92C212 93 216 92 218 91" : "M196 96C204 98 210 96 214 93");
    return { o: o, d: d, h: [], g: WATER };
  };

  B.seal = function (p) {
    var eared = dflt(p.eared, 0);
    return { o: [
      /* hauled out, head raised */
      "M32 118C28 100 56 90 100 88C144 86 172 90 182 98",
      "M32 118C56 128 108 130 152 126C170 124 180 122 182 114",
      /* fore flipper */
      "M92 116C80 128 82 138 94 138C102 138 106 130 104 122",
      /* hind flippers */
      "M32 118C18 110 10 104 6 98C18 98 28 104 34 110",
      "M32 120C18 126 10 132 6 138C18 138 28 132 34 126",
      /* head */
      "M182 98C194 88 208 92 211 102C214 113 205 122 194 120C184 118 179 108 181 100Z",
      "M208 104C216 104 220 107 219 110C218 113 210 114 205 112"
    ].concat(eared ? ["M186 92C184 82 192 78 196 82C199 85 197 92 195 95"] : []),
      d: ["M196 100a2 2 0 1 0 .1 0", "M212 109C216 111 218 113 219 115",
          "M210 114C214 116 216 118 217 120"],
      h: hatch(50, 96, 118, 26, 10), g: WATER };
  };

  B.dugong = function () {
    return { o: [
      "M28 100C42 74 88 62 138 64C170 65 194 72 206 84",
      "M28 100C46 128 92 138 140 134C172 132 194 122 204 108",
      /* the fluked tail */
      "M28 100C16 82 8 70 2 60C14 72 24 88 28 98",
      "M28 100C16 118 8 130 2 140C14 128 24 112 28 102",
      "M100 130C92 146 100 154 112 148C120 144 120 134 116 128",
      /* blunt downturned muzzle */
      "M206 84C216 88 218 98 212 106C206 113 196 112 192 106"
    ], d: ["M198 84a1.9 1.9 0 1 0 .1 0", "M204 104C208 108 206 112 202 112",
           "M210 100C214 102 214 106 211 108"],
      h: hatch(56, 88, 120, 32, 10), g: WATER };
  };

  /* ------------------------------------------- INVERTEBRATES & BOTANICALS */

  B.butterfly = function () {
    return { o: [
      /* body and antennae */
      "M110 56C106 56 104 66 105 84C106 100 108 112 112 112C116 112 118 100 119 84C120 66 118 56 114 56Z",
      "M108 56C102 44 92 34 82 30", "M116 56C122 44 132 34 142 30",
      /* forewings */
      "M106 66C88 40 56 26 38 34C22 41 22 66 40 80C58 94 88 88 106 76",
      "M118 66C136 40 168 26 186 34C202 41 202 66 184 80C166 94 136 88 118 76",
      /* hindwings */
      "M106 80C90 88 70 104 68 118C66 132 84 138 100 128C110 122 112 104 110 92",
      "M118 80C134 88 154 104 156 118C158 132 140 138 124 128C114 122 112 104 114 92"
    ], d: spots([[62, 52], [86, 62], [150, 52], [126, 62], [88, 112], [136, 112]], 4.6)
        .concat(["M52 46C70 56 88 68 100 78", "M172 46C154 56 136 68 124 78",
                 "M80 104C90 110 98 116 104 122", "M144 104C134 110 126 116 120 122"]),
      h: [], g: [] };
  };

  B.bee = function () {
    return { o: [
      /* abdomen, thorax, head */
      "M96 92C92 76 100 68 112 68C124 68 132 76 128 92C124 110 118 120 112 120C106 120 100 110 96 92Z",
      "M100 68C96 56 102 48 112 48C122 48 128 56 124 68",
      "M104 48C100 36 106 28 114 28C122 28 128 36 124 46",
      /* wings */
      "M102 62C78 46 52 44 46 56C40 68 60 82 82 82C92 82 100 74 102 66",
      "M126 62C150 46 176 44 182 56C188 68 168 82 146 82C136 82 128 74 126 66",
      /* legs */
      "M98 88C84 92 76 102 78 112", "M128 88C142 92 150 102 148 112",
      "M98 100C86 106 82 116 84 124", "M128 100C140 106 144 116 142 124"
    ], d: ["M96 82C104 84 122 84 130 82", "M97 94C106 96 120 96 129 94",
           "M100 106C108 108 118 108 126 106",
           "M108 34L100 22", "M120 34L130 22",
           "M60 58C74 64 88 70 98 74", "M164 58C150 64 136 70 126 74"],
      h: [], g: [] };
  };

  B.mussel = function (p) {
    var fan = dflt(p.fan, 0);
    return fan
      ? { o: ["M112 134C88 78 82 44 92 26C102 8 132 8 142 26C152 44 144 80 124 134C120 140 116 140 112 134Z"],
          d: ["M100 34C102 76 108 108 116 132", "M112 24C112 70 114 104 118 132",
              "M126 30C124 74 124 106 122 132", "M136 44C132 80 128 108 124 130"],
          h: [], g: WATER }
      : { o: ["M42 96C42 74 72 60 112 60C152 60 178 70 178 88C178 106 148 118 108 118" +
                "C68 118 42 112 42 96Z"],
          d: ["M56 88C76 74 108 70 140 74C158 76 170 80 176 86",
              "M52 100C74 86 108 82 140 86C158 88 172 92 177 96",
              "M62 110C82 100 110 98 138 102"],
          h: [], g: WATER };
  };

  B.coral = function () {
    return { o: [
      /* a branching acroporid colony */
      "M92 134C86 106 90 84 88 62",
      "M88 62C74 44 58 38 44 40", "M88 66C104 48 122 44 136 50",
      "M44 40C34 26 22 22 12 26", "M136 50C150 36 166 34 178 40",
      "M88 92C68 82 50 84 40 92", "M92 98C114 88 134 92 144 102",
      "M40 92C26 86 16 88 10 96", "M144 102C160 96 172 100 178 110",
      "M124 134C118 110 126 90 126 72", "M126 72C140 56 156 52 168 56",
      "M126 76C112 62 98 58 86 62"
    ], d: ["M12 24a3.4 3.4 0 1 0 .1 0", "M178 38a3.4 3.4 0 1 0 .1 0",
           "M8 94a3.4 3.4 0 1 0 .1 0", "M178 108a3.4 3.4 0 1 0 .1 0",
           "M168 54a3.4 3.4 0 1 0 .1 0", "M44 38a3 3 0 1 0 .1 0"],
      h: [], g: WATER };
  };

  B.tree = function (p) {
    var kind = dflt(p.kind, "broad");
    if (kind === "bottle") {
      /* baobab: the swollen trunk and the root-like crown */
      return { o: [
        "M84 134C80 108 76 84 76 66C76 44 92 34 112 34C132 34 148 44 148 66C148 84 144 108 140 134",
        "M78 60C60 48 44 44 32 46", "M146 60C164 48 180 44 192 46",
        "M86 46C72 32 58 26 46 26", "M138 46C152 32 166 26 178 26",
        "M100 38C94 22 86 12 76 8", "M124 38C130 22 138 12 148 8",
        "M112 34C112 20 112 10 112 4"
      ], d: ["M92 70C90 96 92 116 96 134", "M132 70C134 96 132 116 128 134",
             "M36 44C30 40 24 40 20 42", "M188 44C194 40 200 40 204 42",
             "M52 26C46 22 40 22 36 24", "M172 26C178 22 184 22 188 24"],
        h: [], g: GROUND };
    }
    if (kind === "conifer") {
      /* araucaria/wollemi habit: whorled tiers on a straight bole */
      return { o: [
        "M112 134C112 110 112 80 112 30",
        "M112 34C98 40 84 46 72 50C86 52 100 52 112 50C124 52 138 52 152 50C140 46 126 40 112 34Z",
        "M112 58C94 66 76 72 60 76C80 80 98 80 112 78C126 80 144 80 164 76C148 72 130 66 112 58Z",
        "M112 84C90 94 68 100 48 104C72 110 94 110 112 108C130 110 152 110 176 104C156 100 134 94 112 84Z"
      ], d: hatch(76, 44, 72, 60, 8, 0.15), h: [], g: GROUND };
    }
    return { o: [
      "M104 134C106 110 104 92 104 78",
      "M104 78C74 74 56 58 60 40C63 26 78 20 90 24C96 8 122 4 136 16C148 26 148 40 142 48" +
        "C158 54 160 74 144 82C132 88 116 84 104 78Z",
      "M104 88C96 96 86 100 78 98", "M104 82C114 92 124 96 132 94"
    ], d: hatch(66, 22, 88, 54, 9), h: [], g: GROUND };
  };

  /* ================================================== KEY -> BASE MAPPING */
  var K = {};
  function map(keys, base, params) {
    keys.split(" ").forEach(function (k) { K[k] = { base: base, params: params || {} }; });
  }

  map("rhino", "rhino", { horns: 2 });
  map("elephant", "elephant");
  map("lion", "bigcat", { mane: 1, tail: 1 });
  map("tiger", "bigcat", { tail: 2, mark: 1 });
  map("leopard", "bigcat", { tail: 2, mark: 2 });
  map("jaguar", "bigcat", { tail: 1, mark: 2 });
  map("cheetah", "bigcat", { tail: 2, mark: 3 });
  map("snow-leopard", "bigcat", { tail: 2, mark: 2 });
  map("puma", "bigcat", { tail: 2 });
  map("lynx", "bigcat", { tail: 0, tuft: 1 });
  map("small-cat", "bigcat", { tail: 1, mark: 3 });
  map("fossa", "bigcat", { tail: 2, mark: 0 });
  map("wolf dhole", "canid", { leg: 1, ear: 1, brush: 2 });
  map("fox", "canid", { leg: 1, ear: 1.2, brush: 2 });
  map("wild-dog", "canid", { leg: 1.1, ear: 1.5, brush: 1 });
  map("maned-wolf", "canid", { leg: 1.6, ear: 1.3, brush: 1 });
  map("bear", "bear", { hump: 1, snout: 1, mark: 0 });
  map("polar-bear", "bear", { hump: 0, snout: 2 });
  map("panda", "bear", { hump: 0, snout: 1, mark: 1 });
  map("red-panda", "redpanda");
  map("antelope", "antelope", { horn: "sweep" });
  map("gazelle", "antelope", { horn: "lyre", neck: 1 });
  map("oryx", "antelope", { horn: "straight" });
  map("nyala bongo", "antelope", { horn: "spiral", stripe: 1 });
  map("ibex", "antelope", { horn: "curl" });
  map("saiga", "antelope", { horn: "straight", nose: 1 });
  map("deer", "antelope", { horn: "lyre", stripe: 0 });
  map("buffalo", "bovid", { horn: "wide" });
  map("wild-cattle", "bovid", { horn: "vee" });
  map("bison", "bovid", { horn: "boss", shag: 1 });
  map("zebra", "equid", { stripe: 1 });
  map("wild-ass", "equid", { mane: "erect" });
  map("wild-horse", "equid", { mane: "erect" });
  map("camel", "camel");
  map("giraffe", "giraffe", { neck: 1, patch: 1 });
  map("okapi", "giraffe", { neck: 0.55, patch: 0 });
  map("tapir", "tapir");
  map("gorilla", "ape", { crest: 1, arm: 1, shag: 1 });
  map("chimp bonobo", "ape", { crest: 0, arm: 1 });
  map("orangutan", "ape", { crest: 0, arm: 1.4, shag: 1 });
  map("gibbon", "gibbon");
  map("monkey guenon", "monkey", { tail: 1 });
  map("colobus langur", "monkey", { tail: 1, ruff: 1 });
  map("snub-nosed", "monkey", { tail: 1, crest: 1 });
  map("macaque", "monkey", { tail: 0, ruff: 1 });
  map("drill", "monkey", { tail: 0, ruff: 1 });
  map("tamarin", "monkey", { tail: 1, crest: 1 });
  map("muriqui woolly-monkey", "monkey", { tail: 2 });
  map("spider-monkey", "monkey", { tail: 2 });
  map("lemur", "lemur", { tail: "ring", post: 0 });
  map("sifaka indri", "lemur", { tail: "plume", post: 1 });
  map("bamboo-lemur sportive-lemur", "lemur", { tail: "plain", post: 1 });
  map("aye-aye", "lemur", { tail: "plume", post: 1, ear: 1.5 });
  map("loris", "lemur", { tail: "none", post: 1, ear: 0.7 });
  map("rabbit", "smallmammal", { ear: 1.4 });
  map("marmot hamster", "smallmammal", { ear: 0.5, tail: 1 });
  map("potoroo", "smallmammal", { ear: 0.9, tail: 1 });
  map("pupfish", "fish", { deep: 0.8 });
  map("ferret mustelid", "mustelid", { snout: 1 });
  map("otter", "mustelid", { web: 1, snout: 2 });
  map("desman", "mustelid", { web: 1, snout: 2 });
  map("numbat", "smallmammal", { ear: 0.8, tail: 1, stripe: 1 });
  map("pangolin", "pangolin", { bands: 7 });
  map("armadillo", "pangolin", { bands: 5, tail: 0 });
  map("wombat", "wombat", { arboreal: 0 });
  map("koala", "wombat", { arboreal: 1 });
  map("tree-kangaroo", "treekangaroo");
  map("devil", "devil");
  map("fruit-bat", "bat");
  map("saola", "saola");

  map("robin finch warbler manakin mockingbird oriole", "perchbird", { bill: 1 });
  map("honeycreeper", "perchbird", { bill: 2 });
  map("honeyeater myna monarch-flycatcher", "perchbird", { bill: 1, tail: 1.1 });
  map("pigeon", "perchbird", { bill: 1, tail: 0.85 });
  map("eagle hawk", "raptor", { crest: 0 });
  map("sea-eagle", "raptor", { crest: 0, hook: 1 });
  map("falcon", "raptor", { crest: 0 });
  map("condor", "vulture", { ruff: 1 });
  map("vulture", "vulture", { ruff: 1 });
  map("crane", "crane", { bill: "long", crest: 1 });
  map("shoebill", "crane", { bill: "shoe" });
  map("ibis", "crane", { bill: "curved", crest: 1 });
  map("duck merganser", "waterfowl", { neck: 1, crest: 1 });
  map("grebe", "waterfowl", { neck: 1.2 });
  map("parrot", "parrot", { tail: 0.7 });
  map("macaw", "parrot", { tail: 1.3, heavy: 1.2 });
  map("kakapo", "parrot", { tail: 0.5, heavy: 1 });
  map("kea", "parrot", { tail: 0.7, heavy: 1.4 });
  map("penguin", "penguin", { tall: 1 });
  map("emperor-penguin", "penguin", { tall: 1.2 });
  map("crested-penguin", "penguin", { tall: 0.9, crest: 2 });
  map("albatross petrel shearwater", "seabird");
  map("bustard", "groundbird", { leg: 1.2, crest: 2 });
  map("rail takahe", "groundbird", { leg: 1, bill: 1 });
  map("kagu", "groundbird", { leg: 1, crest: 2, bill: 2 });
  map("sandpiper", "wader", { spoon: 1 });
  map("hornbill", "hornbill");

  map("tortoise", "tortoise", { dome: 1 });
  map("giant-tortoise", "tortoise", { dome: 1.15, saddle: 1 });
  map("sea-turtle", "seaturtle", { ridge: 0 });
  map("leatherback", "seaturtle", { ridge: 1 });
  map("softshell-turtle", "softshell");
  map("crocodile alligator", "croc", { snout: 1 });
  map("gharial", "croc", { snout: 1.5, knob: 1 });
  map("iguana", "lizard", { crest: 1, dewlap: 1 });
  map("monitor", "lizard", { crest: 0 });
  map("frog poison-frog", "frog", {});
  map("salamander newt", "salamander", {});
  map("olm", "salamander", { gills: 1, pale: 1 });
  map("axolotl", "salamander", { gills: 1 });

  map("shark", "shark", { head: "point" });
  map("whale-shark", "shark", { head: "blunt", spots: 1, wide: 1.15 });
  map("hammerhead", "shark", { head: "hammer" });
  map("manta", "ray", { kind: "manta" });
  map("sawfish", "ray", { kind: "saw" });
  map("angelshark", "ray", { kind: "angel" });
  map("grouper wrasse", "fish", { deep: 1.15 });
  map("tuna", "fish", { deep: 0.9 });
  map("catfish", "fish", { deep: 0.85, barbel: 1 });
  map("sturgeon", "fish", { deep: 0.75, snout: 1, barbel: 1 });
  map("coelacanth", "fish", { deep: 1.05, lobe: 1 });
  map("eel", "eel");
  map("whale", "whale", { kind: "rorqual" });
  map("sperm-whale", "whale", { kind: "sperm" });
  map("right-whale", "whale", { kind: "right" });
  map("dolphin river-dolphin", "dolphin", { beak: 1 });
  map("porpoise", "dolphin", { beak: 0, fin: 1 });
  map("seal", "seal", { eared: 0 });
  map("sea-lion", "seal", { eared: 1 });
  map("dugong", "dugong");

  map("butterfly", "butterfly");
  map("bumblebee", "bee");
  map("mussel", "mussel", { fan: 0 });
  map("coral", "coral");
  map("baobab", "tree", { kind: "bottle" });
  map("conifer", "tree", { kind: "conifer" });

  /* ============================================================== RENDER */
  /* The drawing is assembled in the order an illustrator works: a light tonal
     wash, then form-following shading clipped inside the silhouette, then the
     interior structure lines, then the contour, then the fine detail last.

     Line weight carries most of the realism. A single stroke width reads as a
     child's drawing; a scientific plate uses a heavy contour, a lighter
     interior line for structure, and a very fine line for detail. */
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };

  function svg(key, opts) {
    opts = opts || {};
    var spec = K[key] || { base: "antelope", params: {} };
    var base = B[spec.base] || B.antelope;
    var parts = base(spec.params) || {};
    var seed = opts.seed === undefined ? (key.length * 7 % 90) : opts.seed;
    var uid = "fn" + seed + (Math.random() * 1e6 | 0).toString(36);
    var out = [];

    /* The silhouette to shade inside. Bases may name it; otherwise it is the
       first closed path, which is always the body. */
    var body = parts.clip || (parts.o || []).filter(function (d) {
      return /z\s*$/i.test(d);
    });

    out.push('<svg class="plate-svg" viewBox="0 0 ' + VB_W + ' ' + VB_H +
             '" role="img" aria-label="' + esc(opts.label || key) +
             ' — field study" preserveAspectRatio="xMidYMid meet">');

    out.push("<defs>");
    /* Barely-there displacement: enough that the line is not mechanical,
       far too little to wobble. This is the difference between a drawn line
       and a shaky one. */
    out.push('<filter id="p' + uid + '" x="-6%" y="-6%" width="112%" height="112%">' +
             '<feTurbulence type="fractalNoise" baseFrequency="0.016" numOctaves="2" seed="' +
             seed + '" result="n"/>' +
             '<feDisplacementMap in="SourceGraphic" in2="n" scale="0.7" ' +
             'xChannelSelector="R" yChannelSelector="G"/></filter>');
    if (body.length) {
      out.push('<clipPath id="c' + uid + '">' +
               body.map(function (d) { return '<path d="' + d + '"/>'; }).join("") +
               "</clipPath>");
    }
    out.push("</defs>");

    out.push('<g filter="url(#p' + uid + ')">');

    /* ground or water, behind everything and in a lighter hand */
    (parts.g || []).forEach(function (d) {
      out.push('<path class="pl-ground" d="' + d + '"/>');
    });

    /* flat tonal ground inside the silhouette */
    body.forEach(function (d) {
      out.push('<path class="pl-wash" d="' + d + '"/>');
    });

    /* shading, clipped so it can never spill outside the animal */
    if (body.length && ((parts.h || []).length || (parts.s || []).length)) {
      out.push('<g clip-path="url(#c' + uid + ')">');
      (parts.h || []).forEach(function (d) {
        out.push('<path class="pl-hatch" d="' + d + '"/>');
      });
      (parts.s || []).forEach(function (pt) {
        out.push('<circle class="pl-stipple" cx="' + pt[0] + '" cy="' + pt[1] +
                 '" r="' + (pt[2] || 0.7) + '"/>');
      });
      out.push("</g>");
    }

    /* interior structure: shoulder, haunch, feather groups, muscle grooves */
    (parts.f || []).forEach(function (d) {
      out.push('<path class="pl-form" d="' + d + '"/>');
    });

    /* the contour last but one, so it sits over the shading */
    (parts.o || []).forEach(function (d) {
      out.push('<path class="pl-contour" d="' + d + '"/>');
    });

    /* eye, nostril, mouth: the marks the reader looks at first */
    (parts.d || []).forEach(function (d) {
      out.push('<path class="pl-detail" d="' + d + '"/>');
    });
    (parts.k || []).forEach(function (pt) {
      out.push('<circle class="pl-pupil" cx="' + pt[0] + '" cy="' + pt[1] +
               '" r="' + (pt[2] || 2) + '"/>');
    });

    out.push("</g></svg>");
    return out.join("");
  }

  global.FNSketch = { svg: svg, keys: Object.keys(K), bases: Object.keys(B) };
})(typeof window !== "undefined" ? window : this);
