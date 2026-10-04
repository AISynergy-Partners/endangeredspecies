/* ===========================================================================
   Field Notes on Vanishing Species — flag engraver
   ---------------------------------------------------------------------------
   Draws each country's flag as an original inked study rather than shipping
   anyone's flag artwork or falling back on emoji, which most Windows browsers
   render as two bare letters.

   Every flag is described by a compact spec — a field of bands plus overlays
   — and drawn onto a slightly irregular cloth shape with an ink edge and a
   soft fold. Colours are pulled a few steps towards the paper so that two
   hundred flags on one page read as a plate of stamps rather than a paint box.

   Flags of state are not copyrightable subject matter; regardless, nothing
   here is traced or copied. Where a flag carries an intricate coat of arms
   the device is drawn as a simplified emblem, and the register says so.

   Public API:  FNFlag.svg(cc, { w, h, seed })  ->  SVG string
   =========================================================================== */
(function (global) {
  "use strict";

  /* Muted inks. Saturated flag colours fight the paper; these sit on it. */
  var C = {
    r:  "#b0402f", dr: "#8a2f26", cr: "#c2503c",
    b:  "#31527e", db: "#22395c", lb: "#5f95bf", sb: "#7fb2d4",
    g:  "#3f7a52", dg: "#2c5a3a", lg: "#63a06a",
    y:  "#d3a62e", o:  "#d1762f", br: "#7a5230",
    w:  "#f7f2e6", k:  "#2f2a21", gy: "#8d8778",
    m:  "#7d3a5c", p:  "#6b4a8a", t:  "#3a8a86", pk: "#d195a8"
  };
  function col(x) { return C[x] || x || C.w; }

  var W = 64, H = 42;          /* drawing units; the cloth sits inside this */

  /* ---------------------------------------------------------------- specs */
  /* [type, "colours", "weights", [overlay, ...]]
     type: h  horizontal bands      v  vertical bands
           d  diagonal split        s  single field
     overlays:
       ["disc", col, cx, cy, r]          ["ring", col, cx, cy, r]
       ["star", col, cx, cy, r, points]  ["crescent", col, cx, cy, r, turn]
       ["cross", col, thick, cx]         ["saltire", col, thick]
       ["tri", col, width]               ["canton", col, w, h]
       ["bar", col, x, y, w, h]          ["emblem", col, cx, cy, r]
       ["stars", col, cx, cy, r, n, spread]
       ["poly", col, "x,y x,y ..."]
       ["dband", col, width, "up" | "down", offset]
       ["turn", degrees, cx, cy, [overlay, ...]]
       ["path", col, "d", strokeWidth]   ["pentagram", col, cx, cy, r, width]
       ["union", x, y, w, h]             the Union Flag drawn inside a canton  */
  var F = {};
  /* one trigram of the Korean flag, lines listed from the centre outwards:
     "1" an unbroken bar, "0" a broken one */
  function trigram(cx, cy, turn, lines) {
    var o = [];
    lines.split("").forEach(function (l, i) {
      var x = cx - 3.4 + i * 2.6;
      if (l === "1") o.push(["bar", "k", x, cy - 5, 1.6, 10]);
      else o.push(["bar", "k", x, cy - 5, 1.6, 4.3], ["bar", "k", x, cy + 0.7, 1.6, 4.3]);
    });
    return ["turn", turn, cx, cy, o];
  }
  function f(cc, type, colours, weights, overlays) {
    F[cc] = { t: type, c: (colours || "w").split(" "), w: weights ? weights.split(" ").map(Number) : null,
              o: overlays || [] };
  }

  /* ------------------------------------------------------------- AFRICA */
  f("DZ", "v", "g w", null, [["crescent", "r", 34, 21, 9], ["star", "r", 39, 21, 4]]);
  f("AO", "h", "r k", null, [["emblem", "y", 32, 21, 8]]);
  f("BJ", "v", "g y", "1 2", [["bar", "r", 21.3, 21, 42.7, 21]]);
  f("BW", "h", "lb w k w lb", "9 1 4 1 9");
  f("BF", "h", "r g", null, [["star", "y", 32, 21, 7]]);
  f("BI", "s", "w", null, [["saltire", "g", 9], ["disc", "w", 32, 21, 12],
                            ["stars", "r", 32, 21, 4, 3, 7]]);
  f("CV", "h", "db w r w db", "6 1 1 1 3", [["stars", "y", 24, 26, 2.4, 10, 11]]);
  f("CM", "v", "g r y", null, [["star", "y", 32, 21, 6]]);
  f("CF", "h", "b w g y", null, [["bar", "r", 28, 0, 8, 42], ["star", "y", 8, 7, 4]]);
  f("TD", "v", "db y r");
  f("KM", "h", "y w r b", null, [["tri", "g", 26], ["crescent", "w", 9, 21, 7],
                                 ["star", "w", 14.6, 15.6, 1.3], ["star", "w", 14.6, 19.2, 1.3],
                                 ["star", "w", 14.6, 22.8, 1.3], ["star", "w", 14.6, 26.4, 1.3]]);
  f("CG", "d", "g r", null, [["dband", "y", 13, "up"]]);
  f("CD", "s", "sb", null, [["dband", "y", 12, "up"], ["dband", "r", 7, "up"], ["star", "y", 12, 9, 5]]);
  f("CI", "v", "o w g");
  f("DJ", "h", "sb g", null, [["tri", "w", 26], ["star", "r", 9, 21, 5]]);
  f("EG", "h", "r w k", null, [["emblem", "y", 32, 21, 6]]);
  f("GQ", "h", "g w r", null, [["tri", "sb", 20], ["emblem", "gy", 32, 21, 5]]);
  f("ER", "s", "g", null, [["bar", "lb", 0, 21, 64, 21], ["tri", "r", 64],
                            ["emblem", "y", 13, 21, 6]]);
  f("SZ", "h", "sb y r y sb", "3 1 6 1 3", [["emblem", "w", 32, 21, 7]]);
  f("ET", "h", "g y r", null, [["disc", "b", 32, 21, 10], ["star", "y", 32, 21, 6]]);
  f("GA", "h", "g y b");
  f("GM", "h", "r w b w g", "6 1 4 1 6");
  f("GH", "h", "r y g", null, [["star", "k", 32, 21, 6]]);
  f("GN", "v", "r y g");
  f("GW", "h", "y g", null, [["bar", "r", 0, 0, 21, 42], ["star", "k", 10, 21, 6]]);
  f("KE", "h", "k w r w g", "6 1 8 1 6", [["turn", 28, 32, 21, [["bar", "w", 31.4, 4, 1.2, 34]]],
                                       ["turn", -28, 32, 21, [["bar", "w", 31.4, 4, 1.2, 34]]],
                                       ["emblem", "k", 32, 21, 9], ["emblem", "r", 32, 21, 6.6],
                                       ["bar", "w", 31.5, 14, 1, 14]]);
  f("LS", "h", "b w g", "3 4 3", [["emblem", "k", 32, 21, 6]]);
  f("LR", "h", "r w r w r w r w r w r", null, [["canton", "db", 26, 22], ["star", "w", 13, 11, 6]]);
  f("LY", "h", "r k g", "1 2 1", [["crescent", "w", 32, 21, 7], ["star", "w", 37, 21, 3]]);
  f("MG", "h", "r g", null, [["bar", "w", 0, 0, 21.3, 42]]);
  f("MW", "h", "k r g", null, [["disc", "r", 32, 10, 6]]);
  f("ML", "v", "g y r");
  f("MR", "h", "r g r", "3 14 3", [["crescent", "y", 32, 22, 9, -90], ["star", "y", 32, 13.5, 3.6]]);
  f("MU", "h", "r b y g");
  f("MA", "s", "r", null, [["pentagram", "g", 32, 21, 9, 1.6]]);
  f("MZ", "h", "g w k w y", "8 1 8 1 8", [["tri", "r", 24], ["star", "y", 9, 21, 5]]);
  f("NA", "d", "b g", null, [["dband", "w", 13, "up"], ["dband", "r", 9, "up"], ["star", "y", 12, 10, 6, 12]]);
  f("NE", "h", "o w g", null, [["disc", "o", 32, 21, 7]]);
  f("NG", "v", "g w g");
  f("RW", "h", "sb y g", "2 1 1", [["disc", "y", 50, 12, 6]]);
  f("ST", "h", "g y g", "1 2 1", [["tri", "r", 18], ["stars", "k", 38, 21, 3, 2, 12]]);
  f("SN", "v", "g y r", null, [["star", "g", 32, 21, 6]]);
  f("SC", "s", "b", null, [["poly", "y", "0,42 21.3,0 42.7,0"], ["poly", "r", "0,42 42.7,0 64,0 64,14"], ["poly", "w", "0,42 64,14 64,28"], ["poly", "g", "0,42 64,28 64,42"]]);
  f("SL", "h", "g w lb");
  f("SO", "s", "sb", null, [["star", "w", 32, 21, 10, 5]]);
  f("ZA", "h", "r w b", "2 1 2", [["tri", "g", 30], ["tri", "y", 22], ["tri", "k", 15]]);
  f("SS", "h", "k w r w g", "8 1 8 1 8", [["tri", "sb", 24], ["star", "y", 9, 21, 5]]);
  f("SD", "h", "r w k", null, [["tri", "g", 22]]);
  f("TZ", "d", "g b", null, [["dband", "y", 14, "up"], ["dband", "k", 9, "up"]]);
  f("TG", "h", "g y g y g", null, [["canton", "r", 24, 25], ["star", "w", 12, 12, 6]]);
  f("TN", "s", "r", null, [["disc", "w", 32, 21, 11], ["crescent", "r", 33, 21, 7],
                            ["star", "r", 36, 21, 3]]);
  f("UG", "h", "k y r k y r", null, [["disc", "w", 32, 21, 9], ["emblem", "k", 32, 21, 5]]);
  f("ZM", "s", "g", null, [["bar", "r", 40, 21, 8, 21], ["bar", "k", 48, 21, 8, 21],
                            ["bar", "o", 56, 21, 8, 21], ["emblem", "o", 48, 10, 7]]);
  f("ZW", "h", "g y r k r y g", null, [["tri", "w", 22], ["star", "r", 9, 21, 6]]);
  f("RE", "v", "b w r");

  /* --------------------------------------------------------------- ASIA */
  f("AF", "v", "k r g", null, [["emblem", "w", 32, 21, 8]]);
  f("AM", "h", "r b o");
  f("AZ", "h", "sb r g", null, [["crescent", "w", 30, 21, 7], ["star", "w", 36.5, 21, 3, 8]]);
  f("BH", "s", "r", null, [["poly", "w", "0,0 16,0 24,4.20 16,8.40 24,12.60 16,16.80 24,21.00 16,25.20 24,29.40 16,33.60 24,37.80 16,42.00 0,42"]]);
  f("BD", "s", "dg", null, [["disc", "r", 28, 21, 11]]);
  f("BT", "d", "y o", null, [["emblem", "w", 32, 21, 10]]);
  f("BN", "s", "y", null, [["dband", "w", 7, "down", -4], ["dband", "k", 7, "down", 3], ["emblem", "r", 32, 21, 8]]);
  f("KH", "h", "b r b", "1 2 1", [["emblem", "w", 32, 21, 8]]);
  f("CN", "s", "r", null, [["star", "y", 14, 11, 6], ["stars", "y", 26, 12, 2.2, 4, 5]]);
  f("CY", "s", "w", null, [["emblem", "o", 32, 18, 8], ["bar", "g", 24, 32, 16, 2]]);
  f("GE", "s", "w", null, [["cross", "r", 7, 32],
                            ["bar", "r", 10.2, 7.6, 8, 2.4], ["bar", "r", 13, 4.8, 2.4, 8],
                            ["bar", "r", 45.8, 7.6, 8, 2.4], ["bar", "r", 48.6, 4.8, 2.4, 8],
                            ["bar", "r", 10.2, 32, 8, 2.4], ["bar", "r", 13, 29.2, 2.4, 8],
                            ["bar", "r", 45.8, 32, 8, 2.4], ["bar", "r", 48.6, 29.2, 2.4, 8]]);
  f("IN", "h", "o w g", null, [["ring", "b", 32, 21, 6]]);
  f("ID", "h", "r w");
  f("IR", "h", "g w r", null, [["emblem", "r", 32, 21, 5]]);
  f("IQ", "h", "r w k", null, [["emblem", "g", 32, 21, 6]]);
  f("IL", "h", "w b w b w", "2 1 6 1 2", [["star", "b", 32, 21, 8, 6]]);
  f("JP", "s", "w", null, [["disc", "r", 32, 21, 11]]);
  f("JO", "h", "k w g", null, [["tri", "r", 26], ["star", "w", 12, 21, 4, 7]]);
  f("KZ", "s", "sb", null, [["star", "y", 32, 17, 8.5, 32], ["disc", "sb", 32, 17, 6], ["disc", "y", 32, 17, 5],
                            ["path", "y", "M20 30Q26 24 32 27.5Q38 24 44 30Q38 27.5 32 30.5Q26 27.5 20 30Z"], ["bar", "y", 3.5, 0, 3.5, 42]]);
  f("KW", "h", "g w r", null, [["poly", "k", "0,0 16,14 16,28 0,42"]]);
  f("KG", "s", "r", null, [["disc", "y", 32, 21, 9]]);
  f("LA", "h", "r db r", "1 2 1", [["disc", "w", 32, 21, 9]]);
  f("LB", "h", "r w r", "1 2 1", [["emblem", "g", 32, 21, 8]]);
  f("MY", "h", "r w r w r w r w r w r w r w", null,
    [["canton", "db", 32, 24], ["crescent", "y", 12, 12, 7], ["star", "y", 22, 12, 5, 14]]);
  f("MV", "s", "r", null, [["bar", "g", 12, 8, 40, 26], ["crescent", "w", 34, 21, 7]]);
  f("MN", "v", "r b r", null, [["emblem", "y", 11, 21, 8]]);
  f("MM", "h", "y g r", null, [["star", "w", 32, 21, 10, 5]]);
  f("NP", "s", "w", null, [["poly", "cr", "17,2.5 45,22.5 25,22.5 47,39.5 17,39.5", "b", 2.6],
                            ["crescent", "w", 25, 14.5, 3.6, -90], ["star", "w", 25, 13.4, 2, 8],
                            ["star", "w", 25.5, 31.5, 4, 12]]);
  f("KP", "h", "b w r w b", "3 1 10 1 3", [["disc", "w", 20, 21, 8], ["star", "r", 20, 21, 5]]);
  f("OM", "h", "w r g", null, [["bar", "r", 0, 0, 18, 42], ["emblem", "w", 9, 10, 5]]);
  f("PK", "s", "dg", null, [["bar", "w", 0, 0, 16, 42], ["crescent", "w", 39, 22, 9, -45],
                             ["star", "w", 45.5, 15.5, 3.6]]);
  f("PS", "h", "k w g", null, [["tri", "r", 24]]);
  f("PH", "h", "b r", null, [["tri", "w", 26], ["disc", "y", 9, 21, 5],
                              ["stars", "y", 12, 21, 2.4, 3, 14]]);
  f("QA", "s", "m", null, [["poly", "w", "0,0 15,0 21,2.33 15,4.67 21,7.00 15,9.33 21,11.67 15,14.00 21,16.33 15,18.67 21,21.00 15,23.33 21,25.67 15,28.00 21,30.33 15,32.67 21,35.00 15,37.33 21,39.67 15,42.00 0,42"]]);
  f("SA", "s", "dg", null, [["bar", "w", 12, 24, 40, 2], ["emblem", "w", 32, 16, 7]]);
  f("SG", "h", "r w", null, [["crescent", "w", 14, 11, 7], ["stars", "w", 26, 11, 2.2, 5, 5]]);
  f("KR", "s", "w", null, [["turn", 33.3, 32, 21, [["disc", "b", 32, 21, 10.5], ["path", "r", "M21.5 21A10.5 10.5 0 0 1 42.5 21Z"],
                                                     ["disc", "r", 26.75, 21, 5.25], ["disc", "b", 37.25, 21, 5.25]]],
                            trigram(11.5, 7.6, 33.3, "111"), trigram(52.5, 34.4, 33.3, "000"),
                            trigram(52.5, 7.6, -33.3, "010"), trigram(11.5, 34.4, -33.3, "101")]);
  f("LK", "s", "y", null, [["bar", "dg", 3, 6, 8, 30], ["bar", "o", 11, 6, 8, 30],
                            ["bar", "m", 21, 6, 40, 30], ["emblem", "y", 41, 21, 8]]);
  f("SY", "h", "g w k", null, [["star", "r", 20, 21, 4], ["star", "r", 32, 21, 4], ["star", "r", 44, 21, 4]]);
  f("TW", "s", "r", null, [["canton", "db", 32, 21], ["star", "w", 16, 11, 7, 12]]);
  f("TJ", "h", "r w g", "2 3 2", [["emblem", "y", 32, 21, 6]]);
  f("TH", "h", "r w b w r", "2 1 2 1 2");
  f("TL", "s", "r", null, [["tri", "y", 40], ["tri", "k", 26], ["star", "w", 11, 21, 5]]);
  f("TR", "s", "r", null, [["crescent", "w", 25, 21, 9], ["star", "w", 34.5, 21, 4]]);
  f("TM", "s", "g", null, [["bar", "r", 8, 0, 9, 42], ["crescent", "w", 34, 15, 7],
                            ["stars", "w", 44, 15, 2, 5, 4]]);
  f("AE", "h", "g w k", null, [["bar", "r", 0, 0, 16, 42]]);
  f("UZ", "h", "sb r w r g", "16 1 16 1 16", [["crescent", "w", 10, 7, 4.8],
                            ["star", "w", 24.6, 3.2, 1.3], ["star", "w", 28.4, 3.2, 1.3], ["star", "w", 32.2, 3.2, 1.3], ["star", "w", 20.8, 7, 1.3], ["star", "w", 24.6, 7, 1.3], ["star", "w", 28.4, 7, 1.3], ["star", "w", 32.2, 7, 1.3], ["star", "w", 17, 10.8, 1.3], ["star", "w", 20.8, 10.8, 1.3], ["star", "w", 24.6, 10.8, 1.3], ["star", "w", 28.4, 10.8, 1.3], ["star", "w", 32.2, 10.8, 1.3]]);
  f("VN", "s", "r", null, [["star", "y", 32, 21, 10, 5]]);
  f("YE", "h", "r w k");

  /* ------------------------------------------------------------- EUROPE */
  f("AL", "s", "dr", null, [["emblem", "k", 32, 21, 9]]);
  f("AD", "v", "b y r", null, [["emblem", "o", 32, 21, 7]]);
  f("AT", "h", "r w r");
  f("BY", "h", "r g", "2 1", [["bar", "w", 0, 0, 11, 42], ["emblem", "r", 5, 21, 5]]);
  f("BE", "v", "k y r");
  f("BA", "s", "db", null, [["poly", "y", "16,0 48,0 48,42"],
                            ["star", "w", 10, 0, 2.3], ["star", "w", 14, 5.25, 2.3], ["star", "w", 18, 10.5, 2.3], ["star", "w", 22, 15.75, 2.3], ["star", "w", 26, 21, 2.3], ["star", "w", 30, 26.25, 2.3], ["star", "w", 34, 31.5, 2.3], ["star", "w", 38, 36.75, 2.3], ["star", "w", 42, 42, 2.3]]);
  f("BG", "h", "w g r");
  f("HR", "h", "r w b", null, [["emblem", "r", 32, 18, 7]]);
  f("CZ", "h", "w r", null, [["tri", "b", 26]]);
  f("DK", "s", "r", null, [["cross", "w", 7, 24]]);
  f("EE", "h", "b k w");
  f("FI", "s", "w", null, [["cross", "b", 8, 24]]);
  f("FR", "v", "b w r");
  f("DE", "h", "k r y");
  f("GR", "h", "b w b w b w b w b", null, [["canton", "b", 22, 23], ["cross", "w", 4, 11, 11]]);
  f("HU", "h", "r w g");
  f("IS", "s", "b", null, [["cross", "w", 10, 24], ["cross", "r", 5, 24]]);
  f("IE", "v", "g w o");
  f("IT", "v", "g w r");
  f("XK", "s", "db", null, [["emblem", "y", 32, 27, 8.5],
                            ["star", "w", 17.9, 15.9, 2], ["star", "w", 22.9, 12.2, 2], ["star", "w", 28.9, 10.2, 2], ["star", "w", 35.1, 10.2, 2], ["star", "w", 41.1, 12.2, 2], ["star", "w", 46.1, 15.9, 2]]);
  f("LV", "h", "m w m", "5 2 5");
  f("LI", "h", "b r", null, [["emblem", "y", 16, 10, 5]]);
  f("LT", "h", "y g r");
  f("LU", "h", "r w sb");
  f("MT", "v", "w r", null, [["emblem", "gy", 10, 9, 4]]);
  f("MD", "v", "b y r", null, [["emblem", "o", 32, 21, 7]]);
  f("MC", "h", "r w");
  f("ME", "s", "y", null, [["bar", "r", 2.4, 2.4, 59.2, 37.2], ["emblem", "y", 32, 21, 10]]);
  f("NL", "h", "r w b");
  f("MK", "s", "r", null, [["poly", "y", "32,21 27,0 37,0"], ["poly", "y", "32,21 27,42 37,42"],
                            ["poly", "y", "32,21 0,17 0,25"], ["poly", "y", "32,21 64,17 64,25"],
                            ["poly", "y", "32,21 0,6 0,0 8,0"], ["poly", "y", "32,21 56,0 64,0 64,6"],
                            ["poly", "y", "32,21 0,36 0,42 8,42"], ["poly", "y", "32,21 56,42 64,42 64,36"],
                            ["disc", "y", 32, 21, 7], ["ring", "r", 32, 21, 5.4]]);
  f("NO", "s", "r", null, [["cross", "w", 11, 24], ["cross", "b", 5, 24]]);
  f("PL", "h", "w r");
  f("PT", "v", "g r", "2 3", [["emblem", "y", 26, 21, 8]]);
  f("RO", "v", "b y r");
  f("RU", "h", "w b r");
  f("SM", "h", "w sb", null, [["emblem", "y", 32, 21, 7]]);
  f("RS", "h", "r b w", null, [["emblem", "y", 24, 21, 8]]);
  f("SK", "h", "w b r", null, [["emblem", "r", 22, 21, 7]]);
  f("SI", "h", "w b r", null, [["emblem", "b", 20, 14, 6]]);
  f("ES", "h", "r y r", "1 2 1", [["emblem", "o", 20, 21, 7]]);
  f("SE", "s", "b", null, [["cross", "y", 8, 24]]);
  f("CH", "s", "r", null, [["bar", "w", 21, 17.5, 22, 7], ["bar", "w", 28.5, 10, 7, 22]]);
  f("UA", "h", "sb y");
  f("GB", "s", "db", null, [["saltire", "w", 10], ["saltire", "r", 5],
                             ["cross", "w", 13, 32], ["cross", "r", 7, 32]]);
  f("VA", "v", "y w", null, [["emblem", "gy", 48, 21, 7]]);

  /* ------------------------------------------------------ NORTH AMERICA */
  f("AG", "s", "r", null, [["poly", "w", "0,0 64,0 32,42"], ["poly", "k", "0,0 64,0 51.8,16 12.2,16"],
                            ["poly", "sb", "12.2,16 51.8,16 45.7,24 18.3,24"], ["emblem", "y", 32, 11, 5]]);
  f("BS", "h", "sb y sb", null, [["tri", "k", 24]]);
  f("BB", "v", "b y b", null, [["emblem", "k", 32, 21, 7]]);
  f("BZ", "s", "db", null, [["bar", "r", 0, 0, 64, 5], ["bar", "r", 0, 37, 64, 5],
                             ["disc", "w", 32, 21, 12], ["emblem", "g", 32, 21, 8]]);
  f("CA", "v", "r w r", "1 2 1", [["emblem", "r", 32, 21, 9]]);
  f("CR", "h", "b w r w b", "2 1 3 1 2");
  f("CU", "h", "b w b w b", null, [["tri", "r", 24], ["star", "w", 9, 21, 5]]);
  f("DM", "s", "g", null, [["bar", "y", 28.1, 0, 2.6, 42], ["bar", "k", 30.7, 0, 2.6, 42], ["bar", "w", 33.3, 0, 2.6, 42],
                            ["bar", "y", 0, 17.1, 64, 2.6], ["bar", "k", 0, 19.7, 64, 2.6], ["bar", "w", 0, 22.3, 64, 2.6],
                            ["disc", "r", 32, 21, 9], ["stars", "g", 32, 21, 1.5, 10, 6.8], ["emblem", "p", 32, 21, 3.4]]);
  f("DO", "s", "b", null, [["bar", "r", 32, 0, 32, 21], ["bar", "r", 0, 21, 32, 21],
                            ["cross", "w", 6, 32], ["emblem", "y", 32, 21, 5]]);
  f("SV", "h", "b w b", null, [["emblem", "y", 32, 21, 7]]);
  f("GD", "s", "r", null, [["bar", "y", 5, 5, 54, 32], ["poly", "g", "5,5 32,21 5,37"], ["poly", "g", "59,5 32,21 59,37"],
                            ["disc", "r", 32, 21, 5], ["star", "y", 32, 21, 3], ["emblem", "y", 11, 21, 2.5],
                            ["star", "y", 18, 2.5, 1.8], ["star", "y", 32, 2.5, 1.8], ["star", "y", 46, 2.5, 1.8],
                            ["star", "y", 18, 39.5, 1.8], ["star", "y", 32, 39.5, 1.8], ["star", "y", 46, 39.5, 1.8]]);
  f("GT", "v", "sb w sb", null, [["emblem", "g", 32, 21, 7]]);
  f("HT", "h", "b r", null, [["bar", "w", 22, 13, 20, 16], ["emblem", "g", 32, 21, 6]]);
  f("HN", "h", "sb w sb", null, [["star", "sb", 32, 21, 2.3], ["star", "sb", 24.5, 17.6, 2.3], ["star", "sb", 39.5, 17.6, 2.3],
                                ["star", "sb", 24.5, 24.4, 2.3], ["star", "sb", 39.5, 24.4, 2.3]]);
  f("JM", "s", "g", null, [["tri", "k", 32], ["poly", "k", "64,0 32,21 64,42"], ["saltire", "y", 8]]);
  f("MX", "v", "g w r", null, [["emblem", "br", 32, 21, 8]]);
  f("NI", "h", "b w b", null, [["emblem", "y", 32, 21, 7]]);
  f("PA", "s", "w", null, [["bar", "r", 32, 0, 32, 21], ["bar", "b", 0, 21, 32, 21],
                            ["star", "b", 16, 11, 6], ["star", "r", 48, 32, 6]]);
  f("KN", "d", "g r", null, [["dband", "y", 13, "up"], ["dband", "k", 8, "up"], ["star", "w", 24, 26, 3], ["star", "w", 40, 16, 3]]);
  f("LC", "s", "sb", null, [["poly", "w", "32,5 16,37 48,37"], ["poly", "k", "32,9 19.5,37 44.5,37"], ["poly", "y", "32,21 16,37 48,37"]]);
  f("VC", "v", "b y g", "1 2 1", [["poly", "g", "26,11 29.5,16 26,21 22.5,16"], ["poly", "g", "38,11 41.5,16 38,21 34.5,16"],
                                    ["poly", "g", "32,21 35.5,26 32,31 28.5,26"]]);
  f("TT", "s", "r", null, [["dband", "w", 16, "down"], ["dband", "k", 11, "down"]]);
  f("US", "h", "r w r w r w r w r w r w r", null,
    [["canton", "db", 26, 23], ["stars", "w", 13, 11, 1.9, 9, 9]]);
  f("GL", "h", "w r", null, [["disc", "r", 22, 21, 10], ["emblem", "w", 22, 16, 5]]);
  f("PR", "h", "r w r w r", null, [["tri", "b", 26], ["star", "w", 9, 21, 5]]);

  /* ------------------------------------------------------ SOUTH AMERICA */
  f("AR", "h", "sb w sb", null, [["disc", "y", 32, 21, 6]]);
  f("BO", "h", "r y g", null, [["emblem", "o", 32, 21, 6]]);
  f("BR", "s", "g", null, [["poly", "y", "32,4 59,21 32,38 5,21"], ["disc", "db", 32, 21, 8.5],
                            ["path", "w", "M23.6 20Q31 16.5 40.2 23.2", 1.4]]);
  f("CL", "h", "w r", null, [["canton", "db", 22, 21], ["star", "w", 11, 11, 6]]);
  f("CO", "h", "y b r", "2 1 1");
  f("EC", "h", "y b r", "2 1 1", [["emblem", "o", 32, 21, 7]]);
  f("GY", "s", "g", null, [["tri", "w", 64], ["tri", "y", 56], ["tri", "k", 24],
                            ["tri", "r", 20]]);
  f("PY", "h", "r w b", null, [["disc", "w", 32, 21, 7], ["emblem", "g", 32, 21, 5]]);
  f("PE", "v", "r w r", null, [["emblem", "o", 32, 21, 6]]);
  f("SR", "h", "g w r w g", "4 1 6 1 4", [["star", "y", 32, 21, 6]]);
  f("UY", "h", "w b w b w b w b w", null, [["canton", "w", 26, 23], ["star", "y", 13, 11, 7]]);
  f("VE", "h", "y b r", null, [["stars", "w", 32, 21, 2.2, 8, 12]]);
  f("GF", "v", "b w r");
  f("FK", "s", "db", null, [["union", 0, 0, 32, 21], ["emblem", "w", 47, 24, 8]]);

  /* ------------------------------------------------------------ OCEANIA */
  f("AU", "s", "db", null, [["union", 0, 0, 32, 21], ["star", "w", 16, 31.5, 4.6, 7],
                             ["star", "w", 48, 8, 2.6, 7], ["star", "w", 40.5, 19, 2.6, 7], ["star", "w", 55, 16.5, 2.6, 7],
                             ["star", "w", 48, 35.5, 2.8, 7], ["star", "w", 51.5, 24, 1.5]]);
  f("FJ", "s", "sb", null, [["union", 0, 0, 32, 21], ["emblem", "w", 47, 23, 8]]);
  f("KI", "h", "r b", null, [["star", "y", 32, 21, 9, 17], ["disc", "y", 32, 21, 5.5], ["bar", "b", 0, 21, 64, 21],
                               ["bar", "w", 0, 25, 64, 2.4], ["bar", "w", 0, 30.5, 64, 2.4], ["bar", "w", 0, 36, 64, 2.4],
                               ["path", "y", "M23 8.5Q27.5 3.5 32 7Q36.5 3.5 41 8.5Q36.5 6.5 32 9.5Q27.5 6.5 23 8.5Z"]]);
  f("MH", "s", "db", null, [["poly", "o", "0,42 64,0 64,5"], ["poly", "w", "0,42 64,5 64,10"],
                             ["star", "w", 14, 12, 6, 24]]);
  f("FM", "s", "sb", null, [["stars", "w", 32, 21, 3, 4, 10]]);
  f("NR", "s", "db", null, [["bar", "y", 0, 20, 64, 2], ["star", "w", 18, 30, 6, 12]]);
  f("NZ", "s", "db", null, [["union", 0, 0, 32, 21],
                             ["star", "w", 48, 8.5, 2.9], ["star", "r", 48, 8.5, 2], ["star", "w", 41.5, 19, 3.1], ["star", "r", 41.5, 19, 2.2],
                             ["star", "w", 54.5, 16.5, 2.7], ["star", "r", 54.5, 16.5, 1.8], ["star", "w", 48, 34.5, 3.4], ["star", "r", 48, 34.5, 2.5]]);
  f("PW", "s", "sb", null, [["disc", "y", 27, 21, 11]]);
  f("PG", "s", "r", null, [["poly", "k", "0,0 64,42 0,42"], ["stars", "w", 16, 28, 2.4, 5, 8], ["emblem", "y", 44, 14, 8]]);
  f("WS", "s", "r", null, [["canton", "db", 28, 22], ["stars", "w", 14, 11, 2.4, 5, 7]]);
  f("SB", "d", "b g", null, [["dband", "y", 3, "up"], ["stars", "w", 14, 10, 2.4, 5, 7]]);
  f("TO", "s", "r", null, [["canton", "w", 26, 21], ["cross", "r", 5, 13, 11]]);
  f("TV", "s", "sb", null, [["union", 0, 0, 32, 21],
                             ["star", "y", 37, 36, 2], ["star", "y", 41, 30.5, 2], ["star", "y", 45.5, 35, 2],
                             ["star", "y", 44, 25, 2], ["star", "y", 50, 22, 2], ["star", "y", 52.5, 14.5, 2],
                             ["star", "y", 57, 20, 2], ["star", "y", 58, 9, 2], ["star", "y", 61, 4.5, 2]]);
  f("VU", "h", "r g", null, [["tri", "k", 26], ["bar", "y", 0, 19, 64, 4],
                              ["emblem", "y", 10, 21, 5]]);
  f("NC", "h", "sb r g", null, [["disc", "y", 26, 21, 10], ["emblem", "k", 26, 21, 6]]);
  f("PF", "h", "r w r", "1 2 1", [["emblem", "o", 32, 21, 7]]);
  f("GU", "s", "r", null, [["bar", "db", 2, 2, 60, 38], ["emblem", "r", 32, 21, 9.5], ["emblem", "sb", 32, 21, 8]]);

  /* --------------------------------------------------------- ANTARCTICA */
  /* No sovereign flag. The Antarctic Treaty emblem stands in, drawn plainly. */
  f("AQ", "s", "w", null, [["emblem", "gy", 32, 21, 12]]);

  /* -------------------------------------------------------------- draw */
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  function starPath(cx, cy, r, points, rot) {
    points = points || 5; rot = rot || -90;
    var d = "", i, a, rr;
    for (i = 0; i < points * 2; i++) {
      a = (rot + i * 180 / points) * Math.PI / 180;
      rr = i % 2 ? r * 0.42 : r;
      d += (i ? "L" : "M") + (cx + Math.cos(a) * rr).toFixed(1) + " " +
           (cy + Math.sin(a) * rr).toFixed(1);
    }
    return d + "Z";
  }
  /* a crescent opening towards the fly: the outer circle less an inner one
     set a little towards the fly; the arcs meet where the two circles cross */
  function crescentPath(cx, cy, r) {
    var ri = r * 0.8, d = r * 0.3,
        tx = (r * r - ri * ri + d * d) / (2 * d), ty = Math.sqrt(r * r - tx * tx);
    return "M" + (cx + tx) + " " + (cy - ty) +
      "A" + r + " " + r + " 0 1 0 " + (cx + tx) + " " + (cy + ty) +
      "A" + ri + " " + ri + " 0 1 1 " + (cx + tx) + " " + (cy - ty) + "Z";
  }
  /* a plain drawn device standing in for an intricate coat of arms */
  function emblemPath(cx, cy, r) {
    return "M" + cx + " " + (cy - r) +
      "C" + (cx + r * 0.7) + " " + (cy - r * 0.7) + " " + (cx + r) + " " + (cy - r * 0.2) +
      " " + (cx + r * 0.55) + " " + (cy + r * 0.5) +
      "C" + (cx + r * 0.25) + " " + (cy + r) + " " + (cx - r * 0.25) + " " + (cy + r) +
      " " + (cx - r * 0.55) + " " + (cy + r * 0.5) +
      "C" + (cx - r) + " " + (cy - r * 0.2) + " " + (cx - r * 0.7) + " " + (cy - r * 0.7) +
      " " + cx + " " + (cy - r) + "Z";
  }

  function bands(spec) {
    var out = [], n = spec.c.length, i, y = 0, x = 0, tot, wts;
    wts = spec.w || spec.c.map(function () { return 1; });
    tot = wts.reduce(function (a, b) { return a + b; }, 0);
    if (spec.t === "h") {
      for (i = 0; i < n; i++) {
        var hh = H * wts[i] / tot;
        out.push('<rect x="0" y="' + y.toFixed(2) + '" width="' + W + '" height="' +
                 (hh + 0.4).toFixed(2) + '" fill="' + col(spec.c[i]) + '"/>');
        y += hh;
      }
    } else if (spec.t === "v") {
      for (i = 0; i < n; i++) {
        var ww = W * wts[i] / tot;
        out.push('<rect x="' + x.toFixed(2) + '" y="0" width="' + (ww + 0.4).toFixed(2) +
                 '" height="' + H + '" fill="' + col(spec.c[i]) + '"/>');
        x += ww;
      }
    } else if (spec.t === "d") {
      out.push('<rect width="' + W + '" height="' + H + '" fill="' + col(spec.c[0]) + '"/>');
      out.push('<path d="M0 ' + H + "L" + W + " 0L" + W + " " + H + 'Z" fill="' +
               col(spec.c[1] || spec.c[0]) + '"/>');
      if (spec.c[2]) {
        out.push('<path d="M0 ' + H + "L" + W + " 0L" + (W * 0.55) + ' 0Z" fill="' +
                 col(spec.c[2]) + '" opacity=".9"/>');
      }
    } else {
      out.push('<rect width="' + W + '" height="' + H + '" fill="' + col(spec.c[0]) + '"/>');
    }
    return out;
  }

  function overlay(ov) {
    var kind = ov[0], c = col(ov[1]);
    if (kind === "disc")     return '<circle cx="' + ov[2] + '" cy="' + ov[3] + '" r="' + ov[4] + '" fill="' + c + '"/>';
    if (kind === "ring")     return '<circle cx="' + ov[2] + '" cy="' + ov[3] + '" r="' + ov[4] +
                                    '" fill="none" stroke="' + c + '" stroke-width="1.6"/>';
    if (kind === "star")     return '<path d="' + starPath(ov[2], ov[3], ov[4], ov[5]) + '" fill="' + c + '"/>';
    if (kind === "crescent") return '<path d="' + crescentPath(ov[2], ov[3], ov[4]) + '" fill="' + c + '"' +
                                    (ov[5] ? ' transform="rotate(' + ov[5] + " " + ov[2] + " " + ov[3] + ')"' : "") + "/>";
    if (kind === "turn") {
      return '<g transform="rotate(' + ov[1] + " " + ov[2] + " " + ov[3] + ')">' +
             ov[4].map(overlay).join("") + "</g>";
    }
    if (kind === "emblem")   return '<path d="' + emblemPath(ov[2], ov[3], ov[4]) + '" fill="' + c +
                                    '" opacity=".92"/>';
    if (kind === "bar")      return '<rect x="' + ov[2] + '" y="' + ov[3] + '" width="' + ov[4] +
                                    '" height="' + ov[5] + '" fill="' + c + '"/>';
    if (kind === "canton")   return '<rect x="0" y="0" width="' + ov[2] + '" height="' + ov[3] +
                                    '" fill="' + c + '"/>';
    if (kind === "tri")      return '<path d="M0 0L' + ov[2] + " " + (H / 2) + "L0 " + H + 'Z" fill="' + c + '"/>';
    if (kind === "cross") {
      var th = ov[2], cx = ov[3] === undefined ? 24 : ov[3], cy = ov[4] === undefined ? H / 2 : ov[4];
      return '<path d="M0 ' + (cy - th / 2) + "h" + W + "v" + th + "h-" + W + "Z" +
             "M" + (cx - th / 2) + " 0v" + H + "h" + th + "V0Z" + '" fill="' + c + '"/>';
    }
    if (kind === "saltire") {
      var t = ov[2];
      return '<path d="M0 0L' + W + " " + H + "M" + W + " 0L0 " + H + '" stroke="' + c +
             '" stroke-width="' + t + '" fill="none"/>';
    }
    if (kind === "poly")     return '<polygon points="' + ov[2] + '" fill="' + c + '"' +
                                    (ov[3] ? ' stroke="' + col(ov[3]) + '" stroke-width="' + ov[4] +
                                             '" stroke-linejoin="round"' : "") + "/>";
    if (kind === "path")     return '<path d="' + ov[2] + '"' + (ov[3] ? ' fill="none" stroke="' + c +
                                    '" stroke-width="' + ov[3] + '"' : ' fill="' + c + '"') + "/>";
    if (kind === "pentagram") {
      var pts = [0, 2, 4, 1, 3].map(function (k) {
        var an = -Math.PI / 2 + k * 2 * Math.PI / 5;
        return (ov[2] + ov[4] * Math.cos(an)).toFixed(2) + " " + (ov[3] + ov[4] * Math.sin(an)).toFixed(2);
      });
      return '<path d="M' + pts.join("L") + 'Z" fill="none" stroke="' + c + '" stroke-width="' + ov[5] + '"/>';
    }
    if (kind === "union") {
      /* the Union Flag set in a canton; a nested viewport keeps its arms inside the box */
      return '<svg x="' + ov[1] + '" y="' + ov[2] + '" width="' + ov[3] + '" height="' + ov[4] +
             '" viewBox="0 0 ' + W + " " + H + '" preserveAspectRatio="none">' +
             '<rect width="' + W + '" height="' + H + '" fill="' + C.db + '"/>' +
             F.GB.o.map(overlay).join("") + "</svg>";
    }
    if (kind === "dband") {
      /* a band laid along a diagonal: "up" runs from the lower hoist corner to
         the upper fly corner, "down" from the upper hoist corner to the lower
         fly; it overruns the cloth so the corners stay covered */
      var off = ov[4] || 0, e = 2 * H / W, dn = ov[3] === "down";
      return '<path d="M-2 ' + ((dn ? -e : H + e) + off) + "L" + (W + 2) + " " + ((dn ? H + e : -e) + off) +
             '" stroke="' + c + '" stroke-width="' + ov[2] + '" fill="none"/>';
    }
    if (kind === "stars") {
      var out = "", n = ov[5], sp = ov[6], i, a;
      for (i = 0; i < n; i++) {
        a = (i / n) * Math.PI * 2 - Math.PI / 2;
        out += '<path d="' + starPath(ov[2] + Math.cos(a) * sp, ov[3] + Math.sin(a) * sp, ov[4]) +
               '" fill="' + c + '"/>';
      }
      return out;
    }
    return "";
  }

  function svg(cc, opts) {
    opts = opts || {};
    var spec = F[cc] || { t: "s", c: ["w"], w: null, o: [["emblem", "gy", 32, 21, 8]] };
    var seed = opts.seed === undefined ? (cc.charCodeAt(0) + cc.charCodeAt(1)) % 60 : opts.seed;
    var uid = "fl" + cc + seed;
    var out = [];

    out.push('<svg class="flag-svg" viewBox="-3 -3 ' + (W + 6) + ' ' + (H + 8) +
             '" role="img" aria-label="' + esc(opts.label || cc) +
             ' flag" preserveAspectRatio="xMidYMid meet">');
    out.push("<defs>");
    /* the cloth: a rectangle with a gently drawn edge, used as the clip */
    var cloth = "M0.6 1.2C16 0 48 0 63.4 0.9C64 14 64 28 63.2 41.1C48 42 16 42 0.8 41C0 28 0 14 0.6 1.2Z";
    out.push('<clipPath id="c' + uid + '"><path d="' + cloth + '"/></clipPath>');
    out.push('<filter id="f' + uid + '" x="-4%" y="-4%" width="108%" height="108%">' +
             '<feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="2" seed="' +
             seed + '" result="n"/>' +
             '<feDisplacementMap in="SourceGraphic" in2="n" scale="0.9" ' +
             'xChannelSelector="R" yChannelSelector="G"/></filter>');
    /* the fold, a soft diagonal so the cloth is not a flat swatch */
    out.push('<linearGradient id="g' + uid + '" x1="0" y1="0" x2="1" y2="1">' +
             '<stop offset="0%" stop-color="#fff" stop-opacity=".2"/>' +
             '<stop offset="42%" stop-color="#fff" stop-opacity="0"/>' +
             '<stop offset="72%" stop-color="#3a2f22" stop-opacity=".07"/>' +
             '<stop offset="100%" stop-color="#3a2f22" stop-opacity=".16"/></linearGradient>');
    out.push("</defs>");

    out.push('<g filter="url(#f' + uid + ')">');
    out.push('<g clip-path="url(#c' + uid + ')">');
    out = out.concat(bands(spec));
    spec.o.forEach(function (ov) { out.push(overlay(ov)); });
    out.push('<rect width="' + W + '" height="' + H + '" fill="url(#g' + uid + ')"/>');
    out.push("</g>");
    /* the inked edge, drawn over the colour */
    out.push('<path class="flag-edge" d="' + cloth + '"/>');
    out.push("</g></svg>");
    return out.join("");
  }

  global.FNFlag = { svg: svg, has: function (cc) { return !!F[cc]; },
                    count: Object.keys(F).length };
})(typeof window !== "undefined" ? window : this);
