/* =============================================================
   WonderWorld — worlds/math.js
   MATH ISLAND: build the Rainbow Bridge by solving problems.

   Difficulty adapts: every first-try correct answer nudges the
   difficulty up, every miss nudges it gently down.

   ADDING QUESTIONS: push a new object into GENERATORS below.
     { id, topic, minTier, make: function (tier) { return {...} } }
   A question looks like:
     { text, visual (HTML string|null), answer (string),
       choices [strings], hint, concept }
   ============================================================= */
(function (WW) {
  'use strict';

  var U = WW.Util, S = WW.State, P = WW.Progress, FX = WW.FX,
      UI = WW.UI, Nav = WW.Nav, Sound = WW.Sound;

  var QUESTIONS_PER_RUN = 8;

  /* ---------- small helpers ---------- */
  function fmtCents(c) {
    return c < 100 ? c + '¢' : '$' + (c / 100).toFixed(2);
  }

  /* Build 4 answer choices around the correct number */
  function numChoices(ans, spread, fmt, count) {
    fmt = fmt || function (v) { return String(v); };
    count = count || 4;
    var correct = fmt(ans), out = [correct], seen = {}, guard = 0;
    seen[correct] = true;
    while (out.length < count && guard++ < 120) {
      var v = ans + U.pick(spread);
      if (v < 0) continue;
      var s = fmt(v);
      if (seen[s]) continue;
      seen[s] = true; out.push(s);
    }
    return { correct: correct, choices: U.shuffle(out) };
  }

  /* Rows of emoji for small numbers — makes maths concrete */
  function emojiRow(n, emoji) {
    var out = '';
    for (var i = 0; i < n; i++) out += '<span class="e-item">' + emoji + '</span>';
    return '<span class="e-group">' + out + '</span>';
  }
  function emojiSum(a, b, emoji, sign) {
    return '<div class="q-emoji">' + emojiRow(a, emoji) +
      '<span class="e-sign">' + sign + '</span>' + emojiRow(b, emoji) + '</div>';
  }
  function emojiTakeaway(a, b, emoji) {
    var out = '';
    for (var i = 0; i < a; i++) {
      out += '<span class="e-item' + (i >= a - b ? ' gone' : '') + '">' + emoji + '</span>';
    }
    return '<div class="q-emoji"><span class="e-group">' + out + '</span></div>';
  }

  /* Fraction pie chart */
  function pieSVG(num, den, color, size) {
    size = size || 110;
    var r = 46, cx = 50, cy = 50, parts = '';
    for (var i = 0; i < den; i++) {
      var a0 = (i / den) * Math.PI * 2 - Math.PI / 2;
      var a1 = ((i + 1) / den) * Math.PI * 2 - Math.PI / 2;
      var x0 = cx + r * Math.cos(a0), y0 = cy + r * Math.sin(a0);
      var x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
      var large = (a1 - a0) > Math.PI ? 1 : 0;
      var d = den === 1
        ? 'M' + cx + ' ' + cy + ' m' + (-r) + ' 0 a' + r + ' ' + r + ' 0 1 0 ' + (2 * r) + ' 0 a' + r + ' ' + r + ' 0 1 0 ' + (-2 * r) + ' 0'
        : 'M' + cx + ' ' + cy + ' L' + x0.toFixed(2) + ' ' + y0.toFixed(2) +
          ' A' + r + ' ' + r + ' 0 ' + large + ' 1 ' + x1.toFixed(2) + ' ' + y1.toFixed(2) + ' Z';
      parts += '<path d="' + d + '" fill="' + (i < num ? color : '#ffffff') +
        '" stroke="#3b3360" stroke-width="2"/>';
    }
    return '<svg class="pie" width="' + size + '" height="' + size + '" viewBox="0 0 100 100" ' +
      'role="img" aria-label="' + num + ' out of ' + den + ' parts shaded">' + parts + '</svg>';
  }

  var COINS = [
    { v: 1, name: 'penny', emoji: '🟤' },
    { v: 5, name: 'nickel', emoji: '⚪' },
    { v: 10, name: 'dime', emoji: '🔘' },
    { v: 25, name: 'quarter', emoji: '🪙' }
  ];
  function coinRow(coins) {
    return '<div class="q-coins">' + coins.map(function (c) {
      return '<span class="coin"><span class="coin-face" aria-hidden="true">' + c.emoji +
        '</span><b>' + c.v + '¢</b></span>';
    }).join('') + '</div>';
  }

  var NAMES = ['Mia', 'Leo', 'Ava', 'Sam', 'Zoe', 'Kai', 'Nina', 'Theo', 'Ruby', 'Max'];
  function who() {
    /* Mix in the player and their companion so stories feel personal */
    var r = Math.random();
    if (r < 0.25) return S.name();
    if (r < 0.45) return S.companion().name;
    return U.pick(NAMES);
  }

  /* ===========================================================
     QUESTION GENERATORS
     =========================================================== */
  var GENERATORS = [

    /* ---------------- ADDITION ---------------- */
    { id: 'addSmall', topic: 'add', minTier: 1, make: function () {
        var a = U.rnd(1, 5), b = U.rnd(1, 5), e = U.pick(['🍎', '⭐', '🐟', '🌸', '🍀']);
        var c = numChoices(a + b, [1, -1, 2, -2, 3]);
        return { text: a + ' + ' + b + ' = ?', visual: emojiSum(a, b, e, '+'),
          answer: c.correct, choices: c.choices,
          hint: 'Count all the ' + e + ' together, one by one.', concept: 'Adding small numbers' };
      } },
    { id: 'addTen', topic: 'add', minTier: 2, make: function () {
        var a = U.rnd(2, 10), b = U.rnd(2, 10);
        var c = numChoices(a + b, [1, -1, 2, -2, 10, -3]);
        return { text: a + ' + ' + b + ' = ?',
          visual: a + b <= 14 ? emojiSum(a, b, '🔵', '+') : null,
          answer: c.correct, choices: c.choices,
          hint: 'Start at ' + a + ' and count up ' + b + ' more.', concept: 'Addition to 20' };
      } },
    { id: 'addTwoDigit', topic: 'add', minTier: 3, make: function () {
        var a = U.rnd(11, 45), b = U.rnd(11, 44);
        var c = numChoices(a + b, [1, -1, 10, -10, 2, -2]);
        return { text: a + ' + ' + b + ' = ?', visual: null, answer: c.correct, choices: c.choices,
          hint: 'Add the tens first, then the ones.', concept: 'Two-digit addition' };
      } },
    { id: 'addBig', topic: 'add', minTier: 5, make: function () {
        var a = U.rnd(46, 99), b = U.rnd(28, 99);
        var c = numChoices(a + b, [1, -1, 10, -10, 9, -9]);
        return { text: a + ' + ' + b + ' = ?', visual: null, answer: c.correct, choices: c.choices,
          hint: 'Tens plus tens, ones plus ones — then regroup if the ones go past 10.',
          concept: 'Addition with regrouping' };
      } },

    /* ---------------- SUBTRACTION ---------------- */
    { id: 'subSmall', topic: 'sub', minTier: 1, make: function () {
        var a = U.rnd(3, 9), b = U.rnd(1, a - 1), e = U.pick(['🍪', '🎈', '🐞', '🍋']);
        var c = numChoices(a - b, [1, -1, 2, -2, 3]);
        return { text: a + ' − ' + b + ' = ?', visual: emojiTakeaway(a, b, e),
          answer: c.correct, choices: c.choices,
          hint: 'The faded ones are taken away. Count the bright ones left.',
          concept: 'Taking away' };
      } },
    { id: 'subTen', topic: 'sub', minTier: 2, make: function () {
        var a = U.rnd(10, 20), b = U.rnd(2, 9);
        var c = numChoices(a - b, [1, -1, 2, -2, 10]);
        return { text: a + ' − ' + b + ' = ?', visual: null, answer: c.correct, choices: c.choices,
          hint: 'Count backwards from ' + a + ', ' + b + ' steps.', concept: 'Subtraction to 20' };
      } },
    { id: 'subTwoDigit', topic: 'sub', minTier: 4, make: function () {
        var a = U.rnd(30, 99), b = U.rnd(11, a - 5);
        var c = numChoices(a - b, [1, -1, 10, -10, 2]);
        return { text: a + ' − ' + b + ' = ?', visual: null, answer: c.correct, choices: c.choices,
          hint: 'Take away the tens first, then the ones.', concept: 'Two-digit subtraction' };
      } },

    /* ---------------- MULTIPLICATION ---------------- */
    { id: 'mulSmall', topic: 'mul', minTier: 3, make: function () {
        var a = U.pick([2, 5, 10]), b = U.rnd(2, 6), e = U.pick(['🍓', '⭐', '🐠']);
        var rows = '';
        for (var i = 0; i < b; i++) rows += '<div class="e-line">' + emojiRow(a, e) + '</div>';
        var c = numChoices(a * b, [a, -a, 1, -1, 2]);
        return { text: b + ' groups of ' + a + '.  ' + b + ' × ' + a + ' = ?',
          visual: '<div class="q-emoji col">' + rows + '</div>',
          answer: c.correct, choices: c.choices,
          hint: 'Count by ' + a + 's: ' + [1, 2, 3].map(function (n) { return a * n; }).join(', ') + '…',
          concept: 'Multiplication as groups' };
      } },
    { id: 'mulTables', topic: 'mul', minTier: 4, make: function () {
        var a = U.rnd(2, 9), b = U.rnd(2, 9);
        var c = numChoices(a * b, [a, -a, b, -b, 1, -1]);
        return { text: a + ' × ' + b + ' = ?', visual: null, answer: c.correct, choices: c.choices,
          hint: a + ' × ' + b + ' is the same as ' + b + ' lots of ' + a + '.',
          concept: 'Times tables' };
      } },
    { id: 'mulBig', topic: 'mul', minTier: 6, make: function () {
        var a = U.rnd(3, 12), b = U.rnd(6, 12);
        var c = numChoices(a * b, [a, -a, b, -b, 10, -10]);
        return { text: a + ' × ' + b + ' = ?', visual: null, answer: c.correct, choices: c.choices,
          hint: 'Split it up: ' + a + ' × 10 = ' + (a * 10) + ', then add ' + a + ' × ' + (b - 10 >= 0 ? (b - 10) : b) + '.',
          concept: 'Bigger times tables' };
      } },

    /* ---------------- DIVISION ---------------- */
    { id: 'divSimple', topic: 'div', minTier: 4, make: function () {
        var b = U.pick([2, 3, 4, 5]), q = U.rnd(2, 6), a = b * q;
        var e = U.pick(['🍬', '🧁', '🪄']);
        var c = numChoices(q, [1, -1, 2, -2, b]);
        return { text: 'Share ' + a + ' ' + e + ' fairly between ' + b + ' friends. ' +
            'How many each?  ' + a + ' ÷ ' + b + ' = ?',
          visual: '<div class="q-emoji">' + emojiRow(a, e) + '</div>',
          answer: c.correct, choices: c.choices,
          hint: 'How many ' + b + 's fit inside ' + a + '?', concept: 'Sharing equally' };
      } },
    { id: 'divTables', topic: 'div', minTier: 5, make: function () {
        var b = U.rnd(2, 9), q = U.rnd(2, 9), a = b * q;
        var c = numChoices(q, [1, -1, 2, -2, b]);
        return { text: a + ' ÷ ' + b + ' = ?', visual: null, answer: c.correct, choices: c.choices,
          hint: 'Think: ' + b + ' × ? = ' + a, concept: 'Division facts' };
      } },

    /* ---------------- COMPARING ---------------- */
    { id: 'compareNum', topic: 'compare', minTier: 1, make: function () {
        var a = U.rnd(1, 20), b = U.rnd(1, 20);
        while (b === a) b = U.rnd(1, 20);
        var big = Math.max(a, b);
        return { text: 'Which number is BIGGER?', visual:
            '<div class="q-compare"><span class="cmp-num">' + a + '</span><span class="cmp-vs">vs</span>' +
            '<span class="cmp-num">' + b + '</span></div>',
          answer: String(big), choices: U.shuffle([String(a), String(b)]),
          hint: 'The bigger number is further along when you count up.', concept: 'Comparing numbers' };
      } },
    { id: 'compareSigns', topic: 'compare', minTier: 3, make: function () {
        var a = U.rnd(5, 60), b = U.rnd(5, 60);
        var ans = a > b ? 'greater than' : (a < b ? 'less than' : 'equal to');
        return { text: a + ' is ______ ' + b,
          visual: '<div class="q-compare"><span class="cmp-num">' + a + '</span>' +
            '<span class="cmp-vs">?</span><span class="cmp-num">' + b + '</span></div>',
          answer: ans, choices: U.shuffle(['greater than', 'less than', 'equal to']),
          hint: 'The crocodile mouth always opens towards the bigger number.',
          concept: 'Greater than / less than' };
      } },
    { id: 'compareSums', topic: 'compare', minTier: 5, make: function () {
        var a1 = U.rnd(3, 19), a2 = U.rnd(3, 19), b1 = U.rnd(3, 19), b2 = U.rnd(3, 19);
        while (a1 + a2 === b1 + b2) b2 = U.rnd(3, 19);
        var left = a1 + ' + ' + a2, right = b1 + ' + ' + b2;
        var ans = (a1 + a2 > b1 + b2) ? left : right;
        return { text: 'Which side is worth MORE?',
          visual: '<div class="q-compare"><span class="cmp-num small">' + left + '</span>' +
            '<span class="cmp-vs">vs</span><span class="cmp-num small">' + right + '</span></div>',
          answer: ans, choices: U.shuffle([left, right]),
          hint: 'Work out both sides first, then compare.', concept: 'Comparing expressions' };
      } },

    /* ---------------- FRACTIONS ---------------- */
    { id: 'fracIdent', topic: 'fraction', minTier: 4, make: function () {
        var den = U.pick([2, 3, 4, 6, 8]), num = U.rnd(1, den - 1);
        var opts = [num + '/' + den], seen = {}, guard = 0;
        seen[opts[0]] = true;
        while (opts.length < 4 && guard++ < 60) {
          var d2 = U.pick([2, 3, 4, 6, 8]), n2 = U.rnd(1, d2 - 1), s = n2 + '/' + d2;
          if (seen[s]) continue;
          seen[s] = true; opts.push(s);
        }
        return { text: 'What fraction of the pizza is topped?',
          visual: '<div class="q-pie">' + pieSVG(num, den, '#ffb347') + '</div>',
          answer: num + '/' + den, choices: U.shuffle(opts),
          hint: 'Count ALL the slices for the bottom number, and the orange ones for the top.',
          concept: 'Naming fractions' };
      } },
    { id: 'fracCompare', topic: 'fraction', minTier: 5, make: function () {
        var pairs = [[1, 2, 1, 4], [1, 2, 1, 3], [3, 4, 1, 2], [2, 3, 1, 3], [1, 4, 1, 8], [2, 4, 3, 4], [5, 6, 1, 2]];
        var p = U.pick(pairs);
        if (Math.random() < 0.5) p = [p[2], p[3], p[0], p[1]];
        var l = p[0] + '/' + p[1], r = p[2] + '/' + p[3];
        var ans = (p[0] / p[1] > p[2] / p[3]) ? l : r;
        return { text: 'Which slice of cake is BIGGER?',
          visual: '<div class="q-pie two">' + pieSVG(p[0], p[1], '#ff8aa8', 92) +
            '<span class="cmp-vs">vs</span>' + pieSVG(p[2], p[3], '#7bd3ff', 92) + '</div>',
          answer: ans, choices: U.shuffle([l, r]),
          hint: 'More slices on the bottom means each slice is SMALLER.',
          concept: 'Comparing fractions' };
      } },
    { id: 'fracOf', topic: 'fraction', minTier: 6, make: function () {
        var den = U.pick([2, 3, 4, 5]), q = U.rnd(2, 6), total = den * q;
        var c = numChoices(q, [1, -1, 2, -2, den]);
        return { text: 'What is 1/' + den + ' of ' + total + '?',
          visual: '<div class="q-emoji">' + emojiRow(total, '🍇') + '</div>',
          answer: c.correct, choices: c.choices,
          hint: 'Split ' + total + ' into ' + den + ' equal piles, then take one pile.',
          concept: 'Fraction of an amount' };
      } },

    /* ---------------- MONEY ---------------- */
    { id: 'moneyCount', topic: 'money', minTier: 2, make: function () {
        var coins = [], total = 0, n = U.rnd(2, 4);
        for (var i = 0; i < n; i++) {
          var c = U.pick(COINS.slice(0, 3));
          coins.push(c); total += c.v;
        }
        var ch = numChoices(total, [1, -1, 5, -5, 10, -10], fmtCents);
        return { text: 'How much money is this?', visual: coinRow(coins),
          answer: ch.correct, choices: ch.choices,
          hint: 'Start with the biggest coin and count on.', concept: 'Counting coins' };
      } },
    { id: 'moneyChange', topic: 'money', minTier: 4, make: function () {
        var price = U.rnd(3, 18) * 5;            /* multiple of 5 cents */
        var paid = Math.ceil((price + U.rnd(5, 30)) / 25) * 25;
        var change = paid - price;
        var item = U.pick(['🍪 cookie', '🍏 apple', '✏️ pencil', '🎈 balloon', '🧃 juice']);
        var ch = numChoices(change, [5, -5, 10, -10, 1, -1], fmtCents);
        return { text: 'A ' + item + ' costs ' + fmtCents(price) + '. You pay ' + fmtCents(paid) +
            '. How much change do you get back?',
          visual: '<div class="q-money"><span class="price-tag">' + fmtCents(price) +
            '</span><span class="cmp-vs">paid</span><span class="price-tag paid">' + fmtCents(paid) + '</span></div>',
          answer: ch.correct, choices: ch.choices,
          hint: 'Change = what you paid − what it cost.', concept: 'Giving change' };
      } },
    { id: 'moneyTotal', topic: 'money', minTier: 6, make: function () {
        var p1 = U.rnd(4, 20) * 5, p2 = U.rnd(4, 20) * 5, qty = U.rnd(2, 3);
        var total = p1 * qty + p2;
        var ch = numChoices(total, [5, -5, 10, -10, p1, -p1], fmtCents);
        return { text: 'You buy ' + qty + ' stickers at ' + fmtCents(p1) + ' each and 1 pencil for ' +
            fmtCents(p2) + '. What is the total?',
          visual: '<div class="q-money"><span class="price-tag">' + qty + ' × ' + fmtCents(p1) +
            '</span><span class="cmp-vs">+</span><span class="price-tag">' + fmtCents(p2) + '</span></div>',
          answer: ch.correct, choices: ch.choices,
          hint: 'Multiply first, then add the pencil.', concept: 'Shopping totals' };
      } },

    /* ---------------- WORD PROBLEMS ---------------- */
    { id: 'wordAdd', topic: 'word', minTier: 4, make: function () {
        var n = who(), a = U.rnd(5, 20), b = U.rnd(3, 15);
        var thing = U.pick(['seashells', 'stickers', 'acorns', 'marbles', 'star coins']);
        var c = numChoices(a + b, [1, -1, 2, -2, 10]);
        return { text: n + ' has ' + a + ' ' + thing + ' and finds ' + b + ' more. ' +
            'How many ' + thing + ' now?',
          visual: '<div class="q-story">🎒</div>', answer: c.correct, choices: c.choices,
          hint: '"Finds more" means we ADD.', concept: 'Addition word problem' };
      } },
    { id: 'wordSub', topic: 'word', minTier: 4, make: function () {
        var n = who(), a = U.rnd(12, 30), b = U.rnd(3, 11);
        var thing = U.pick(['berries', 'balloons', 'cookies', 'pebbles']);
        var c = numChoices(a - b, [1, -1, 2, -2, 10]);
        return { text: n + ' had ' + a + ' ' + thing + ' and gave away ' + b + '. How many are left?',
          visual: '<div class="q-story">🎁</div>', answer: c.correct, choices: c.choices,
          hint: '"Gave away" means we SUBTRACT.', concept: 'Subtraction word problem' };
      } },
    { id: 'wordMul', topic: 'word', minTier: 5, make: function () {
        var n = who(), rows = U.rnd(3, 7), per = U.rnd(3, 8);
        var c = numChoices(rows * per, [per, -per, rows, 1, -1]);
        return { text: n + ' plants ' + rows + ' rows of flowers with ' + per +
            ' flowers in each row. How many flowers altogether?',
          visual: '<div class="q-story">🌻</div>', answer: c.correct, choices: c.choices,
          hint: 'Equal rows means MULTIPLY: ' + rows + ' × ' + per,
          concept: 'Multiplication word problem' };
      } },
    { id: 'wordDiv', topic: 'word', minTier: 5, make: function () {
        var n = who(), groups = U.rnd(2, 6), per = U.rnd(2, 8), total = groups * per;
        var c = numChoices(per, [1, -1, 2, groups, -2]);
        return { text: n + ' puts ' + total + ' cupcakes into ' + groups +
            ' boxes, the same number in each. How many in one box?',
          visual: '<div class="q-story">🧁</div>', answer: c.correct, choices: c.choices,
          hint: 'Sharing equally means DIVIDE: ' + total + ' ÷ ' + groups,
          concept: 'Division word problem' };
      } },
    { id: 'wordTwoStep', topic: 'word', minTier: 6, make: function () {
        var n = who(), packs = U.rnd(3, 6), per = U.rnd(4, 8), eaten = U.rnd(2, 9);
        var ans = packs * per - eaten;
        var c = numChoices(ans, [1, -1, per, -per, eaten]);
        return { text: n + ' buys ' + packs + ' packs of ' + per + ' crackers, then eats ' + eaten +
            '. How many crackers are left?',
          visual: '<div class="q-story">🥨</div>', answer: c.correct, choices: c.choices,
          hint: 'Two steps: multiply first (' + packs + ' × ' + per + '), then subtract ' + eaten + '.',
          concept: 'Two-step word problem' };
      } }
  ];

  var TOPICS = [
    { id: 'mixed', label: 'Mixed', emoji: '🎲' },
    { id: 'add', label: 'Add', emoji: '➕' },
    { id: 'sub', label: 'Subtract', emoji: '➖' },
    { id: 'mul', label: 'Multiply', emoji: '✖️' },
    { id: 'div', label: 'Divide', emoji: '➗' },
    { id: 'compare', label: 'Compare', emoji: '⚖️' },
    { id: 'fraction', label: 'Fractions', emoji: '🍕' },
    { id: 'money', label: 'Money', emoji: '🪙' },
    { id: 'word', label: 'Story problems', emoji: '📖' }
  ];

  /* ===========================================================
     THE WORLD MODULE
     =========================================================== */
  var Math_ = WW.Worlds.math = {
    run: null,

    tier: function () { return U.clamp(Math.round(S.world('math').diff), 1, 6); },

    generate: function (topic) {
      var tier = this.tier();
      var pool = GENERATORS.filter(function (g) {
        return g.minTier <= tier && (topic === 'mixed' || g.topic === topic);
      });
      /* If the child picked a topic they haven't unlocked by level yet,
         give them the easiest version of it rather than nothing. */
      if (!pool.length && topic !== 'mixed') {
        var byTopic = GENERATORS.filter(function (g) { return g.topic === topic; })
          .sort(function (a, b) { return a.minTier - b.minTier; });
        pool = byTopic.length ? [byTopic[0]] : GENERATORS.filter(function (g) { return g.minTier === 1; });
      }
      if (!pool.length) pool = GENERATORS.filter(function (g) { return g.minTier === 1; });
      var q = U.pick(pool).make(tier);
      q.tier = tier;
      return q;
    },

    back: function () {
      if (this.run) { this.quitRun(); return; }
      Nav.go('map');
    },

    enter: function () {
      this.run = null;
      this.renderHub();
    },

    /* ---------------- HUB ---------------- */
    renderHub: function () {
      var self = this;
      var body = document.getElementById('math-body');
      var w = S.world('math');
      body.innerHTML = '';
      document.getElementById('math-bar').innerHTML =
        '<span class="chip">Lv ' + this.tier() + ' maths</span>';

      body.appendChild(UI.worldHero('math', 'Math Island',
        'The Rainbow Bridge is broken! Each answer builds one more plank.'));

      var island = U.el('div', { class: 'island-scene', 'aria-hidden': 'true' });
      island.innerHTML =
        '<div class="isl isl-left">🏝️</div>' +
        '<div class="isl-gap">🌊🌊🌊</div>' +
        '<div class="isl isl-right">🏰</div>';
      body.appendChild(island);

      var card = UI.card('', [
        U.el('h3', { text: 'Cross the Rainbow Bridge' }),
        U.el('p', { class: 'muted', text: QUESTIONS_PER_RUN + ' questions. The bridge grows as you go. ' +
          'Wrong answers just mean a hint — you never fall!' }),
        UI.progressRow('math')
      ]);
      card.appendChild(U.el('p', { class: 'label-row', text: 'Choose what to practise:' }));
      var chips = U.el('div', { class: 'chips topic-chips' });
      TOPICS.forEach(function (t) {
        chips.appendChild(U.el('button', {
          class: 'chip topic-chip', 'data-topic': t.id,
          onclick: function () { Sound.play('tap'); self.startRun(t.id); },
          'aria-label': 'Start a bridge run: ' + t.label
        }, [U.el('span', { text: t.emoji, 'aria-hidden': 'true' }), U.el('span', { text: t.label })]));
      });
      card.appendChild(chips);
      card.appendChild(UI.bigButton('🌈 Start the bridge!', function () { self.startRun('mixed'); }, 'primary wide'));
      body.appendChild(card);

      var tries = w.correct + w.wrong;
      body.appendChild(UI.card('', [
        U.el('h4', { text: '🧮 My maths so far' }),
        U.el('div', { class: 'stat-row' }, [
          U.el('div', { class: 'stat-pill' }, [U.el('b', { text: String(w.runs) }), U.el('small', { text: 'bridges' })]),
          U.el('div', { class: 'stat-pill' }, [U.el('b', { text: String(w.correct) }), U.el('small', { text: 'correct' })]),
          U.el('div', { class: 'stat-pill' }, [U.el('b', { text: tries ? Math.round(w.correct / tries * 100) + '%' : '—' }), U.el('small', { text: 'accuracy' })]),
          U.el('div', { class: 'stat-pill' }, [U.el('b', { text: '⭐'.repeat(w.bestStars) || '—' }), U.el('small', { text: 'best run' })])
        ])
      ]));
    },

    /* ---------------- RUN ---------------- */
    startRun: function (topic) {
      this.run = {
        topic: topic || 'mixed', idx: 0, total: QUESTIONS_PER_RUN,
        firstTry: 0, xp: 0, gems: 0, attempts: 0, q: null, revealed: false, streak: 0
      };
      this.renderStage();
      this.nextQuestion();
      WW.Buddy.say('Let\'s build this bridge! 🌈');
    },

    quitRun: function () {
      var self = this;
      WW.Modal.open({
        title: 'Leave the bridge?',
        body: U.el('p', { class: 'modal-text', text: 'Your XP so far is already saved. You can start a new bridge any time.' }),
        actions: [
          { text: 'Keep playing', primary: true, onClick: function () { WW.Modal.close(); } },
          { text: 'Leave', onClick: function () { WW.Modal.close(); self.run = null; self.renderHub(); } }
        ]
      });
    },

    renderStage: function () {
      var body = document.getElementById('math-body');
      body.innerHTML = '';

      var scene = U.el('div', { class: 'bridge-scene' });
      scene.innerHTML =
        '<div class="bridge-sky" aria-hidden="true"><span class="cloud c1">☁️</span><span class="cloud c2">☁️</span><span class="sun">🌤️</span></div>' +
        '<div class="bridge-water" aria-hidden="true"></div>' +
        '<div class="bridge-start" aria-hidden="true">🏝️</div>' +
        '<div class="bridge-end" aria-hidden="true">🏰</div>' +
        '<div class="bridge-planks" id="bridge-planks" aria-hidden="true"></div>' +
        '<div class="bridge-hero" id="bridge-hero"></div>';
      body.appendChild(scene);

      var planks = scene.querySelector('#bridge-planks');
      for (var i = 0; i < this.run.total; i++) {
        var p = U.el('i', { class: 'plank' });
        p.style.setProperty('--hue', Math.round((i / this.run.total) * 300));
        planks.appendChild(p);
      }
      var hero = scene.querySelector('#bridge-hero');
      hero.innerHTML = WW.Avatar.svg(S.data.player, { label: 'You on the bridge' }) +
        '<span class="hero-buddy" aria-hidden="true">' + S.companion().emoji + '</span>';

      var qcard = UI.card('q-card', []);
      qcard.id = 'math-q';
      body.appendChild(qcard);

      this.updateBridge();
    },

    updateBridge: function () {
      var r = this.run;
      var planks = U.$$('#bridge-planks .plank');
      planks.forEach(function (p, i) { p.classList.toggle('built', i < r.idx); });
      var hero = document.getElementById('bridge-hero');
      if (hero) hero.style.left = (6 + (r.idx / r.total) * 76) + '%';
      var bar = document.getElementById('math-bar');
      if (bar) bar.innerHTML = '<span class="chip">' + Math.min(r.idx + 1, r.total) + ' / ' + r.total + '</span>';
    },

    nextQuestion: function () {
      var r = this.run;
      if (!r) return;
      if (r.idx >= r.total) { this.finishRun(); return; }
      r.q = this.generate(r.topic);
      r.attempts = 0;
      r.revealed = false;
      this.renderQuestion();
    },

    renderQuestion: function () {
      var self = this, r = this.run, q = r.q;
      var card = document.getElementById('math-q');
      card.innerHTML = '';
      card.appendChild(U.el('div', { class: 'q-top' }, [
        U.el('span', { class: 'chip chip-soft', text: 'Plank ' + (r.idx + 1) + ' of ' + r.total })
      ]));
      if (q.visual) card.appendChild(U.el('div', { class: 'q-visual', html: q.visual }));
      card.appendChild(U.el('p', { class: 'q-text', text: q.text }));

      var choices = U.el('div', { class: 'choices n' + q.choices.length });
      q.choices.forEach(function (c) {
        choices.appendChild(U.el('button', {
          class: 'choice', text: c, 'data-val': c,
          onclick: function (e) { self.answer(c, e.currentTarget); }
        }));
      });
      card.appendChild(choices);
      card.appendChild(U.el('div', { class: 'q-hint', id: 'math-hint', role: 'status' }));
      FX.pulse(card, 'slide-in');
    },

    answer: function (value, btn) {
      var self = this, r = this.run, q = r.q;
      if (!r || btn.disabled) return;
      var hintBox = document.getElementById('math-hint');
      var correct = (value === q.answer);

      if (correct) {
        var first = (r.attempts === 0 && !r.revealed);
        btn.classList.add('right');
        U.$$('.choice').forEach(function (b) { b.disabled = true; });
        Sound.play('good');
        FX.burst(btn, '✨', 10);

        if (first) r.firstTry++;
        var gained = first ? (8 + q.tier * 2) : 4;
        r.xp += gained;
        if (first) r.gems += 1;

        P.answer('math', first);
        var w = S.world('math');
        w.diff = U.clamp(w.diff + (first ? 0.18 : 0.02), 1, 6);

        hintBox.innerHTML = '<span class="good-note">' + U.pick(WW.Data.cheers) + ' ' +
          U.esc(q.concept) + ' ✔︎  <b>+' + gained + ' XP</b></span>';
        FX.gain('+' + gained + ' XP', 'xp', btn);
        if (Math.random() < 0.4) WW.Buddy.cheer();

        /* A short spoken "Nice!" on every 3rd correct answer in a row —
           enough to feel alive, not so much that it nags. */
        r.streak = first ? r.streak + 1 : 0;
        if (r.streak > 0 && r.streak % 3 === 0) {
          setTimeout(function () { Sound.praise(true); }, 260);
        }

        r.idx++;
        this.updateBridge();
        setTimeout(function () { if (self.run) self.nextQuestion(); }, 1000);

      } else {
        r.attempts++;
        btn.classList.add('wrong');
        btn.disabled = true;
        FX.pulse(btn, 'shake');
        Sound.play('oops');
        r.streak = 0;
        P.answer('math', false);
        var wl = S.world('math');
        wl.diff = U.clamp(wl.diff - 0.3, 1, 6);

        if (r.attempts === 1) {
          hintBox.innerHTML = '<span class="hint-note">💡 ' + U.esc(U.pick(WW.Data.nudges)) +
            '<br>' + U.esc(q.hint) + '</span>';
          WW.Buddy.say('Try again — you\'ve got this!');
        } else {
          /* Second miss: show the answer, let them tap it. No shame, no fail. */
          r.revealed = true;
          hintBox.innerHTML = '<span class="hint-note">🤝 Let\'s do it together. The answer is <b>' +
            U.esc(q.answer) + '</b>. Tap the glowing button!</span>';
          U.$$('.choice').forEach(function (b) {
            if (b.getAttribute('data-val') === q.answer) b.classList.add('reveal');
          });
        }
      }
    },

    finishRun: function () {
      var self = this, r = this.run;
      var w = S.world('math');
      var stars = r.firstTry >= 8 ? 3 : (r.firstTry >= 6 ? 2 : (r.firstTry >= 4 ? 1 : 0));
      var bonusXP = 20, bonusGems = 5;

      w.runs++;
      if (stars > w.bestStars) w.bestStars = stars;

      P.addXP(r.xp + bonusXP);
      P.addGems(r.gems + bonusGems);
      P.addWorldProgress('math', (r.firstTry / r.total) * 25);
      P.logActivity({
        world: 'math', name: 'Rainbow Bridge', stars: stars,
        detail: r.firstTry + '/' + r.total + ' first try · level ' + this.tier(),
        xp: r.xp + bonusXP
      });
      if (r.firstTry === r.total) P.badge('bridge_master');

      var body = document.getElementById('math-body');
      var result = UI.card('result-card', [
        U.el('div', { class: 'result-emoji', text: '🏰' }),
        U.el('h3', { text: 'You crossed the bridge!' }),
        U.el('div', { class: 'stars', 'aria-label': stars + ' out of 3 stars' },
          [U.el('span', { text: '⭐'.repeat(stars) + '☆'.repeat(3 - stars) })]),
        U.el('p', { class: 'muted', text: r.firstTry + ' of ' + r.total + ' right on the first try.' }),
        U.el('div', { class: 'reward-row' }, [
          U.el('div', { class: 'reward-pill' }, [U.el('span', { class: 'reward-emoji', text: '⭐' }), U.el('span', { text: '+' + (r.xp + bonusXP) + ' XP' })]),
          U.el('div', { class: 'reward-pill' }, [U.el('span', { class: 'reward-emoji', text: '💎' }), U.el('span', { text: '+' + (r.gems + bonusGems) + ' gems' })])
        ])
      ]);
      result.appendChild(UI.progressRow('math'));
      result.appendChild(UI.bigButton('🌈 Cross again', function () { self.startRun(r.topic); }, 'primary wide'));
      result.appendChild(UI.bigButton('🏝️ Back to the island', function () { self.run = null; self.renderHub(); }, 'secondary wide'));

      body.innerHTML = '';
      body.appendChild(result);
      this.run = null;
      Sound.win('big');                 /* fanfare + applause + spoken praise */
      FX.confetti();
      WW.Buddy.say(stars === 3 ? 'PERFECT! Wow!' : 'Great crossing!');
      document.getElementById('math-bar').innerHTML = '';
    }
  };

  /* expose for tests / future question packs */
  Math_.GENERATORS = GENERATORS;
  Math_.TOPICS = TOPICS;
  WW.Screens.math = Math_;

})(window.WW);
