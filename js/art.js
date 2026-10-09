/* =============================================================
   WonderWorld — art.js
   Hand-built SVG illustrations for the story passages.

   No image files and no external URLs — every scene is drawn from
   gradients, paths and circles, so nothing can ever 404 and the
   whole game still loads instantly.

   Usage:   WW.Art.scene('hill-night')   ->  SVG markup string
   Add a scene: put a builder in SCENES and a description in ALT.
   ============================================================= */
(function (WW) {
  'use strict';

  var VW = 320, VH = 180;          /* every scene shares this canvas */

  /* ---------- tiny drawing helpers ---------- */

  function starPath(cx, cy, r, inner) {
    var pts = [], i, rad, a;
    inner = inner || r * 0.44;
    for (i = 0; i < 10; i++) {
      rad = (i % 2 === 0) ? r : inner;
      a = -Math.PI / 2 + i * Math.PI / 5;
      pts.push((cx + rad * Math.cos(a)).toFixed(1) + ',' + (cy + rad * Math.sin(a)).toFixed(1));
    }
    return 'M' + pts.join(' L') + ' Z';
  }

  /* A twinkling star field. Positions are fixed so scenes never jitter. */
  var STARFIELD = [
    [18, 22, 1.6], [46, 12, 1.1], [78, 30, 1.8], [104, 16, 1.2], [136, 26, 1.4],
    [168, 14, 1.7], [196, 32, 1.1], [226, 18, 1.5], [254, 28, 1.2], [282, 15, 1.7],
    [306, 34, 1.3], [32, 50, 1.2], [122, 48, 1.1], [212, 46, 1.4], [294, 54, 1.1],
    [60, 66, 1.0], [152, 62, 1.2], [242, 68, 1.0]
  ];
  function stars(n, color) {
    var out = '', i, s;
    for (i = 0; i < Math.min(n, STARFIELD.length); i++) {
      s = STARFIELD[i];
      out += '<circle class="art-twinkle" style="animation-delay:' + (i * 0.17).toFixed(2) +
        's" cx="' + s[0] + '" cy="' + s[1] + '" r="' + s[2] + '" fill="' + (color || '#fff') + '"/>';
    }
    return out;
  }

  function moon(x, y, r) {
    return '<circle cx="' + x + '" cy="' + y + '" r="' + (r + 7) + '" fill="#fff6c8" opacity=".12"/>' +
      '<circle cx="' + x + '" cy="' + y + '" r="' + r + '" fill="#ffeeb0"/>' +
      '<circle cx="' + (x - r * 0.3) + '" cy="' + (y - r * 0.2) + '" r="' + (r * 0.22) + '" fill="#f3dd98"/>' +
      '<circle cx="' + (x + r * 0.28) + '" cy="' + (y + r * 0.3) + '" r="' + (r * 0.16) + '" fill="#f3dd98"/>';
  }

  /* A glowing little star character */
  function littleStar(x, y, r, float) {
    return '<g' + (float ? ' class="art-float"' : '') + '>' +
      '<circle cx="' + x + '" cy="' + y + '" r="' + (r * 2.6) + '" fill="#fff3a8" opacity=".18"/>' +
      '<circle cx="' + x + '" cy="' + y + '" r="' + (r * 1.7) + '" fill="#fff3a8" opacity=".3"/>' +
      '<path d="' + starPath(x, y, r) + '" fill="#ffe259"/>' +
      '<circle cx="' + (x - r * 0.25) + '" cy="' + (y - r * 0.12) + '" r="' + (r * 0.1) + '" fill="#6b4f10"/>' +
      '<circle cx="' + (x + r * 0.25) + '" cy="' + (y - r * 0.12) + '" r="' + (r * 0.1) + '" fill="#6b4f10"/>' +
      '<path d="M' + (x - r * 0.2) + ' ' + (y + r * 0.22) + ' Q' + x + ' ' + (y + r * 0.45) + ' ' +
        (x + r * 0.2) + ' ' + (y + r * 0.22) + '" stroke="#6b4f10" stroke-width="' + (r * 0.09) +
        '" fill="none" stroke-linecap="round"/>' +
      '</g>';
  }

  /* Luna the fox. dir = 1 faces right, -1 faces left. */
  function fox(x, y, s, dir, sitting) {
    var body = sitting
      ? '<ellipse cx="0" cy="-11" rx="12" ry="12" fill="#f0943f"/>' +
        '<ellipse cx="2" cy="-7" rx="7" ry="8" fill="#ffe6cf"/>'
      : '<ellipse cx="0" cy="-13" rx="15" ry="9.5" fill="#f0943f"/>' +
        '<ellipse cx="3" cy="-9" rx="9" ry="5.5" fill="#ffe6cf"/>' +
        '<rect x="-9" y="-6" width="4" height="7" rx="2" fill="#d97a2c"/>' +
        '<rect x="-1" y="-6" width="4" height="7" rx="2" fill="#e8873a"/>' +
        '<rect x="6" y="-6" width="4" height="7" rx="2" fill="#d97a2c"/>' +
        '<rect x="11" y="-6" width="4" height="7" rx="2" fill="#e8873a"/>';

    return '<g transform="translate(' + x + ',' + y + ') scale(' + (s * dir) + ',' + s + ')">' +
      /* tail */
      '<path d="M-11,-14 Q-27,-16 -27,-31 Q-18,-24 -8,-21 Z" fill="#e8873a"/>' +
      '<path d="M-27,-31 Q-23,-27 -20,-26 Q-24,-29 -24,-33 Z" fill="#fff1e0"/>' +
      body +
      /* head */
      '<circle cx="12" cy="-24" r="8.5" fill="#f0943f"/>' +
      '<path d="M5,-30 L4,-39 L12,-33 Z" fill="#e8873a"/>' +
      '<path d="M18,-31 L22,-39 L23,-30 Z" fill="#e8873a"/>' +
      '<path d="M6.5,-31.5 L6,-36.5 L10.5,-33 Z" fill="#c76a6a"/>' +
      '<path d="M18.5,-31.8 L21,-36.5 L21.5,-31 Z" fill="#c76a6a"/>' +
      '<ellipse cx="17" cy="-21" rx="6" ry="4.4" fill="#fff1e0"/>' +
      '<circle cx="21.5" cy="-21.5" r="1.5" fill="#3a2a20"/>' +
      '<circle cx="12.5" cy="-26" r="1.7" fill="#3a2a20"/>' +
      '<circle cx="13" cy="-26.6" r=".55" fill="#fff"/>' +
      '<path d="M14,-18.5 Q17,-16.5 20,-18" stroke="#c98a5e" stroke-width=".9" fill="none" stroke-linecap="round"/>' +
      '</g>';
  }

  function owl(x, y, s) {
    return '<g transform="translate(' + x + ',' + y + ') scale(' + s + ')">' +
      '<ellipse cx="0" cy="0" rx="13" ry="16" fill="#9b7653"/>' +
      '<ellipse cx="0" cy="3" rx="8.5" ry="11" fill="#c8a883"/>' +
      '<path d="M-13,-4 Q-18,4 -12,12 Q-10,2 -9,-3 Z" fill="#846140"/>' +
      '<path d="M13,-4 Q18,4 12,12 Q10,2 9,-3 Z" fill="#846140"/>' +
      '<path d="M-11,-13 L-13,-21 L-6,-16 Z" fill="#9b7653"/>' +
      '<path d="M11,-13 L13,-21 L6,-16 Z" fill="#9b7653"/>' +
      '<circle cx="-5.2" cy="-6" r="5.4" fill="#fff8ea"/>' +
      '<circle cx="5.2" cy="-6" r="5.4" fill="#fff8ea"/>' +
      '<circle cx="-5.2" cy="-6" r="2.7" fill="#2f2419"/>' +
      '<circle cx="5.2" cy="-6" r="2.7" fill="#2f2419"/>' +
      '<circle cx="-4.3" cy="-7" r="1" fill="#fff"/>' +
      '<circle cx="6.1" cy="-7" r="1" fill="#fff"/>' +
      '<path d="M0,-3 L-2.6,1.4 L2.6,1.4 Z" fill="#e8a33a"/>' +
      '<path d="M-5,15 L-5,18 M-2,15 L-2,18 M3,15 L3,18 M6,15 L6,18" stroke="#e8a33a" stroke-width="1.6" stroke-linecap="round"/>' +
      '</g>';
  }

  /* Trees: 'pine' or 'round' */
  function tree(x, baseY, s, kind, dark) {
    var trunk = '<rect x="' + (x - 3 * s) + '" y="' + (baseY - 26 * s) + '" width="' + (6 * s) +
      '" height="' + (28 * s) + '" rx="' + (2 * s) + '" fill="' + (dark ? '#3c2a1c' : '#6b4a2c') + '"/>';
    if (kind === 'pine') {
      var c1 = dark ? '#1f3a26' : '#2f6b3d', c2 = dark ? '#27472e' : '#3d8049';
      return trunk +
        '<path d="M' + x + ',' + (baseY - 70 * s) + ' L' + (x + 17 * s) + ',' + (baseY - 42 * s) +
          ' L' + (x - 17 * s) + ',' + (baseY - 42 * s) + ' Z" fill="' + c2 + '"/>' +
        '<path d="M' + x + ',' + (baseY - 54 * s) + ' L' + (x + 21 * s) + ',' + (baseY - 22 * s) +
          ' L' + (x - 21 * s) + ',' + (baseY - 22 * s) + ' Z" fill="' + c1 + '"/>';
    }
    var g1 = dark ? '#25452c' : '#4a9450', g2 = dark ? '#2d5233' : '#5aa85c';
    return trunk +
      '<circle cx="' + x + '" cy="' + (baseY - 42 * s) + '" r="' + (20 * s) + '" fill="' + g1 + '"/>' +
      '<circle cx="' + (x - 14 * s) + '" cy="' + (baseY - 32 * s) + '" r="' + (13 * s) + '" fill="' + g2 + '"/>' +
      '<circle cx="' + (x + 14 * s) + '" cy="' + (baseY - 32 * s) + '" r="' + (13 * s) + '" fill="' + g2 + '"/>';
  }

  /* Little tufts of grass and pebbles to fill the foreground */
  function tufts(y, color) {
    var spots = [[18, 6], [58, 2], [96, 9], [144, 4], [188, 8], [232, 3], [272, 7], [304, 2]];
    return spots.map(function (p) {
      var x = p[0], d = p[1], gy = y + d;
      return '<path d="M' + x + ',' + gy + ' l-3,-7 M' + x + ',' + gy + ' l0,-9 M' + x + ',' + gy +
        ' l3,-7" stroke="' + (color || '#58a05f') + '" stroke-width="1.8" stroke-linecap="round" fill="none"/>';
    }).join('');
  }

  function ground(y, c1, c2) {
    return '<path d="M0,' + y + ' Q80,' + (y - 12) + ' 160,' + (y - 4) + ' T320,' + (y - 10) +
      ' L320,' + VH + ' L0,' + VH + ' Z" fill="' + c1 + '"/>' +
      '<path d="M0,' + (y + 10) + ' Q110,' + (y + 2) + ' 320,' + (y + 8) + ' L320,' + VH +
      ' L0,' + VH + ' Z" fill="' + c2 + '"/>';
  }

  function nightSky(id, top, bottom) {
    return '<defs><linearGradient id="' + id + '" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" stop-color="' + top + '"/><stop offset="1" stop-color="' + bottom + '"/>' +
      '</linearGradient></defs>' +
      '<rect width="' + VW + '" height="' + VH + '" fill="url(#' + id + ')"/>';
  }

  /* Low banks of fog drifting across the whole scene */
  function mist() {
    var bands = [[96, 7, .22], [112, 9, .3], [128, 11, .34], [146, 13, .4]], out = '';
    bands.forEach(function (b, i) {
      out += '<rect x="-20" y="' + (b[0] - b[1]) + '" width="360" height="' + (b[1] * 2) +
        '" rx="' + b[1] + '" fill="#eef4ff" opacity="' + b[2] + '"/>';
      out += '<ellipse cx="' + (60 + i * 70) + '" cy="' + b[0] + '" rx="74" ry="' + (b[1] + 5) +
        '" fill="#eef4ff" opacity="' + (b[2] * 0.6).toFixed(2) + '"/>';
    });
    return out;
  }

  /* Swirling wind / leaves */
  function swirl(cx, cy, r) {
    var out = '<path d="M' + (cx - r) + ',' + cy + ' A' + r + ',' + (r * 0.45) + ' 0 1 1 ' +
      (cx + r) + ',' + cy + '" stroke="#dff1ff" stroke-width="2.4" fill="none" opacity=".75" stroke-linecap="round"/>' +
      '<path d="M' + (cx - r * 0.7) + ',' + (cy + 9) + ' A' + (r * 0.7) + ',' + (r * 0.32) +
      ' 0 1 0 ' + (cx + r * 0.7) + ',' + (cy + 9) + '" stroke="#dff1ff" stroke-width="2" fill="none" opacity=".5" stroke-linecap="round"/>';
    var leaves = [[-r * 0.9, -2], [-r * 0.3, -9], [r * 0.4, -7], [r * 0.85, 2], [0, 11], [-r * 0.6, 12]];
    leaves.forEach(function (l, i) {
      out += '<ellipse cx="' + (cx + l[0]) + '" cy="' + (cy + l[1]) + '" rx="4.6" ry="2.6" fill="' +
        (i % 2 ? '#e0a33a' : '#c87a33') + '" transform="rotate(' + (i * 47) + ' ' +
        (cx + l[0]) + ' ' + (cy + l[1]) + ')"/>';
    });
    return out;
  }

  function sparkles(list) {
    return list.map(function (p, i) {
      return '<path class="art-twinkle" style="animation-delay:' + (i * 0.21).toFixed(2) + 's" d="' +
        starPath(p[0], p[1], p[2]) + '" fill="#fff4b0"/>';
    }).join('');
  }

  /* ===========================================================
     SCENES
     =========================================================== */
  var SCENES = {

    'hill-night': function () {
      return nightSky('skA', '#141b4d', '#3b2a6b') + stars(18) + moon(268, 34, 15) +
        ground(126, '#3f7d4a', '#2f6239') + tufts(134, '#5fae68') +
        fox(150, 136, 1.15, 1, true) +
        littleStar(196, 60, 6, true) + littleStar(104, 46, 4.4, true) +
        sparkles([[220, 86, 3], [84, 80, 2.4]]);
    },

    'star-falls': function () {
      return nightSky('skB', '#13194a', '#4a2f6e') + stars(14) + moon(40, 30, 12) +
        /* falling trail */
        '<path d="M214,24 Q230,58 246,96" stroke="#ffe259" stroke-width="3" fill="none" ' +
          'opacity=".55" stroke-linecap="round" stroke-dasharray="2 7"/>' +
        tree(292, 152, 1.05, 'pine', false) + tree(254, 154, 0.85, 'pine', false) +
        ground(130, '#35703f', '#28552f') + tufts(138, '#4e9158') +
        littleStar(248, 100, 7, true) +
        fox(118, 140, 1.2, 1, false) +
        /* Luna's surprise, as a little speech bubble */
        '<g><ellipse cx="104" cy="92" rx="15" ry="12" fill="#fff" opacity=".95"/>' +
        '<path d="M110,101 L112,110 L118,102 Z" fill="#fff" opacity=".95"/>' +
        '<text x="104" y="99" text-anchor="middle" font-size="17" font-weight="bold" fill="#c7442f">!</text></g>';
    },

    'dark-woods': function () {
      return nightSky('skC', '#0e1536', '#1d2a52') + stars(10, '#cfe0ff') +
        tree(26, 164, 1.15, 'pine', true) + tree(86, 170, 1.4, 'pine', true) +
        tree(238, 168, 1.3, 'pine', true) + tree(300, 162, 1.1, 'pine', true) +
        ground(140, '#1e3b28', '#162d1e') +
        /* a winding moonlit path receding into the trees */
        '<path d="M120,180 Q150,156 176,134 L198,134 Q166,158 170,180 Z" fill="#53604a" opacity=".55"/>' +
        tufts(146, '#2f5c3a') +
        '<circle cx="186" cy="92" r="40" fill="#ffe259" opacity=".13"/>' +
        littleStar(186, 92, 7, true) +
        fox(126, 160, 1.3, 1, false) +
        sparkles([[212, 70, 3], [160, 66, 2.4], [206, 118, 2.2]]);
    },

    'found-star': function () {
      return nightSky('skD', '#131c45', '#2a3a66') + stars(9, '#d8e6ff') +
        ground(118, '#2f6239', '#234b2c') +
        /* a soft leafy bush the star is resting under */
        '<g>' +
          '<ellipse cx="268" cy="150" rx="34" ry="20" fill="#2f6b3d"/>' +
          '<ellipse cx="248" cy="140" rx="22" ry="15" fill="#3f8a4a"/>' +
          '<ellipse cx="284" cy="136" rx="20" ry="14" fill="#3f8a4a"/>' +
          '<ellipse cx="266" cy="128" rx="18" ry="13" fill="#4b9c55"/>' +
          '<ellipse cx="252" cy="124" rx="10" ry="7" fill="#57ab60"/>' +
          '<ellipse cx="280" cy="122" rx="9" ry="6.5" fill="#57ab60"/>' +
        '</g>' +
        tufts(150, '#3f8a4a') +
        '<circle cx="214" cy="140" r="34" fill="#ffe259" opacity=".18"/>' +
        '<circle cx="214" cy="140" r="20" fill="#ffe259" opacity=".22"/>' +
        littleStar(214, 140, 8, true) +
        fox(140, 158, 1.45, 1, false) +
        sparkles([[196, 110, 2.8], [238, 112, 2.2], [176, 128, 2]]);
    },

    'owl-oak': function () {
      return nightSky('skE', '#121a46', '#36275f') + stars(12) + moon(46, 32, 13) +
        /* big oak */
        '<path d="M186,180 Q190,120 196,78 L222,78 Q226,124 232,180 Z" fill="#6b4a2c"/>' +
        '<path d="M196,104 Q168,96 150,78" stroke="#6b4a2c" stroke-width="7" fill="none" stroke-linecap="round"/>' +
        '<path d="M222,112 Q252,104 268,88" stroke="#6b4a2c" stroke-width="7" fill="none" stroke-linecap="round"/>' +
        '<circle cx="208" cy="56" r="40" fill="#2f6b3d"/>' +
        '<circle cx="160" cy="66" r="27" fill="#3d8049"/>' +
        '<circle cx="258" cy="68" r="26" fill="#3d8049"/>' +
        '<circle cx="208" cy="28" r="26" fill="#3d8049"/>' +
        ground(150, '#2f6239', '#234b2c') + tufts(158, '#4e9158') +
        owl(160, 74, 1.0) +
        fox(90, 166, 1.25, 1, false) +
        littleStar(74, 148, 5, true);
    },

    'misty-woods': function () {
      return nightSky('skF', '#1b2550', '#49557f') +
        tree(34, 150, 1.0, 'pine', true) + tree(96, 156, 0.85, 'pine', true) +
        tree(214, 156, 0.9, 'pine', true) + tree(284, 150, 1.05, 'pine', true) +
        ground(134, '#3a5a42', '#2b4632') +
        mist() +
        fox(154, 152, 1.4, 1, false) +
        '<circle cx="168" cy="134" r="16" fill="#ffe259" opacity=".3"/>' +
        littleStar(168, 134, 5.5, true) +
        '<ellipse cx="60" cy="150" rx="46" ry="11" fill="#fff" opacity=".2"/>';
    },

    'wind-wakes': function () {
      return nightSky('skG', '#1c2a5c', '#4b3d7a') + stars(10) +
        tree(26, 160, 0.9, 'round', true) + tree(300, 158, 0.95, 'round', true) +
        ground(136, '#3a7044', '#2b5533') + tufts(144, '#4e9158') +
        swirl(178, 86, 54) +
        '<path d="M34,62 Q76,54 118,62" stroke="#dff1ff" stroke-width="2" fill="none" opacity=".45" stroke-linecap="round"/>' +
        '<path d="M28,78 Q64,72 96,78" stroke="#dff1ff" stroke-width="1.6" fill="none" opacity=".3" stroke-linecap="round"/>' +
        fox(96, 156, 1.3, 1, false) +
        littleStar(108, 136, 5, true);
    },

    'star-falters': function () {
      return nightSky('skH', '#101745', '#2e2a63') + stars(16) + moon(272, 30, 13) +
        '<path d="M150,150 Q164,74 184,40" stroke="#ffe259" stroke-width="2.4" fill="none" ' +
          'opacity=".4" stroke-dasharray="3 8" stroke-linecap="round"/>' +
        '<path d="M184,40 Q192,66 180,92" stroke="#ffd0d0" stroke-width="2.4" fill="none" ' +
          'opacity=".55" stroke-dasharray="3 8" stroke-linecap="round"/>' +
        ground(142, '#2f6239', '#234b2c') + tufts(150, '#4e9158') +
        littleStar(180, 96, 7, true) +
        '<text x="196" y="86" font-size="16" opacity=".8">💤</text>' +
        swirl(74, 70, 32) +
        fox(136, 160, 1.3, 1, false);
    },

    'knowledge-tree': function () {
      var crystals = [
        [86, 96, '#45c8ff'], [120, 48, '#63d68d'], [160, 30, '#bb8bff'],
        [200, 48, '#4fd6b8'], [234, 96, '#ffc93c']
      ];
      var art = nightSky('skI', '#141a48', '#2b2f68') + stars(13) +
        '<circle cx="160" cy="76" r="76" fill="#8fe06a" opacity=".10"/>' +
        '<path d="M150,180 Q154,122 157,74 L167,74 Q170,124 174,180 Z" fill="#7a5230"/>' +
        '<circle cx="160" cy="62" r="34" fill="#4f8a3a"/>' +
        '<circle cx="128" cy="76" r="24" fill="#5c9c43"/>' +
        '<circle cx="192" cy="76" r="24" fill="#5c9c43"/>' +
        '<circle cx="160" cy="34" r="22" fill="#6aae4c"/>' +
        ground(150, '#2f6239', '#234b2c') + tufts(158, '#4e9158');
      crystals.forEach(function (c, i) {
        art += '<g class="art-twinkle" style="animation-delay:' + (i * 0.25).toFixed(2) + 's">' +
          '<circle cx="' + c[0] + '" cy="' + c[1] + '" r="16" fill="' + c[2] + '" opacity=".22"/>' +
          '<path d="M' + c[0] + ',' + (c[1] - 9) + ' L' + (c[0] + 7) + ',' + c[1] + ' L' + c[0] + ',' +
            (c[1] + 9) + ' L' + (c[0] - 7) + ',' + c[1] + ' Z" fill="' + c[2] + '"/></g>';
      });
      return art + fox(52, 164, 1.2, 1, false);
    },

    'star-bridge': function () {
      return nightSky('skJ', '#0f1442', '#2a2560') + stars(16) +
        '<defs><linearGradient id="beamG" x1="0" y1="1" x2="0" y2="0">' +
          '<stop offset="0" stop-color="#fff3a8" stop-opacity=".65"/>' +
          '<stop offset="1" stop-color="#fff3a8" stop-opacity="0"/></linearGradient></defs>' +
        '<path d="M140,160 L188,160 L252,8 L220,8 Z" fill="url(#beamG)"/>' +
        '<path d="M150,180 Q154,130 157,96 L167,96 Q170,132 174,180 Z" fill="#7a5230"/>' +
        '<circle cx="160" cy="80" r="32" fill="#4f8a3a"/>' +
        '<circle cx="130" cy="94" r="22" fill="#5c9c43"/>' +
        '<circle cx="190" cy="94" r="22" fill="#5c9c43"/>' +
        '<circle cx="160" cy="56" r="21" fill="#6aae4c"/>' +
        ground(154, '#2f6239', '#234b2c') + tufts(160, '#4e9158') +
        littleStar(222, 48, 8, true) +
        sparkles([[200, 86, 3], [238, 24, 2.6], [182, 118, 2.2], [246, 70, 2.4]]) +
        fox(68, 166, 1.25, 1, false);
    },

    'star-home': function () {
      return nightSky('skK', '#111747', '#3c2d6c') + stars(18) + moon(50, 32, 13) +
        '<circle cx="228" cy="48" r="34" fill="#ffe259" opacity=".16"/>' +
        '<circle cx="228" cy="48" r="20" fill="#ffe259" opacity=".22"/>' +
        '<path class="art-twinkle" d="' + starPath(228, 48, 12) + '" fill="#fff07a"/>' +
        ground(128, '#3f7d4a', '#2f6239') + tufts(136, '#5fae68') +
        fox(130, 140, 1.25, 1, true) +
        sparkles([[262, 82, 3], [192, 76, 2.6], [288, 36, 2.4]]);
    }
  };

  /* Screen-reader descriptions — the picture must never be the only channel */
  var ALT = {
    'hill-night': 'Luna the fox sits on a grassy hill at night, counting the stars above her.',
    'star-falls': 'A little star falls out of the night sky, trailing light down behind the trees, while Luna looks up in surprise.',
    'dark-woods': 'Luna walks along a dark forest path. A tiny star glows brightly between the trees ahead.',
    'found-star': 'Luna leans over a glowing little star resting on the ground beneath a fern.',
    'owl-oak': 'Old Owl sits on a branch of a huge oak tree at night while Luna looks up from the ground.',
    'misty-woods': 'Luna walks through misty woods with the little star glowing in her fur.',
    'wind-wakes': 'The Wind wakes up and swirls autumn leaves into a dancing ring above Luna.',
    'star-falters': 'The little star drifts back down from the sky, too tired to fly, as Luna watches.',
    'knowledge-tree': 'The Knowledge Tree glows in the night with five colored crystals shining around its branches.',
    'star-bridge': 'A bright beam of light rises from the Knowledge Tree and the little star climbs it back into the sky.',
    'star-home': 'One star shines brighter than all the rest in the night sky while Luna watches happily from her hill.'
  };

  WW.Art = {
    has: function (id) { return !!SCENES[id]; },
    alt: function (id) { return ALT[id] || ''; },
    scene: function (id) {
      var build = SCENES[id];
      if (!build) return '';
      return '<svg class="art-svg" viewBox="0 0 ' + VW + ' ' + VH + '" ' +
        'preserveAspectRatio="xMidYMid slice" role="img" aria-label="' +
        WW.Util.esc(ALT[id] || 'Story illustration') + '">' + build() + '</svg>';
    },
    /* exposed for reuse elsewhere */
    starPath: starPath,
    fox: fox,
    littleStar: littleStar
  };

})(window.WW);
