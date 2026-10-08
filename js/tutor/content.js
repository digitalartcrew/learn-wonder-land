/* =============================================================
   WonderWorld — tutor/content.js
   The offline lesson and question bank.

   WHY THIS EXISTS AT ALL
   ----------------------
   WonderTutor must work on a plane. The game is offline-first and
   the tutor does not get to be the thing that breaks that, so every
   core teaching loop — explain, practise, check, score — runs here,
   in ordinary JavaScript, with no network and no model.

   The AI provider is an ENHANCEMENT layered on top: better
   explanations, novel phrasing, answering a question we have no
   canned answer for. When it is unavailable the child still gets a
   real lesson. See docs/WONDERTUTOR.md, "Failure mode".

   WHERE THE AI IS ACTUALLY WORTH IT
   ---------------------------------
   Arithmetic questions generate perfectly well from a few lines of
   code, and scoring `7 × 6` does not need a language model. So maths
   and money are fully generative here. Comprehension and inference
   need prose, which is where a model genuinely earns its cost, so
   those carry a smaller hand-written bank and are marked
   `aiPreferred` — the engine will ask the provider first and fall
   back to the bank.

   Nothing in here fabricates content for a language we have not
   validated. Every item below is English; `WW.tutorLanguages`
   decides what may be claimed about anything else.

   DETERMINISM
   -----------
   `seed()` swaps the generator for a small LCG so tests can assert
   that level 2 addition really is harder than level 0 addition
   without fighting Math.random.
   ============================================================= */
(function (WW) {
  'use strict';

  var T = WW.tutorTaxonomy;

  /* ---------- randomness, seedable for tests ---------- */
  var _seed = null;
  function next() {
    if (_seed === null) return Math.random();
    /* Numerical Recipes LCG — small, fast, good enough to vary questions. */
    _seed = (_seed * 1664525 + 1013904223) % 4294967296;
    return _seed / 4294967296;
  }
  function rnd(a, b) { return a + Math.floor(next() * (b - a + 1)); }
  function pick(list) { return list[Math.floor(next() * list.length)]; }
  function shuffle(list) {
    var a = list.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(next() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  /* Build a multiple-choice question with plausible wrong answers. */
  function choiceQ(skillId, level, prompt, answer, distractors, explain) {
    var opts = shuffle([answer].concat(distractors).slice(0, 4));
    return {
      skillId: skillId, level: level, kind: 'choice',
      prompt: prompt, choices: opts.map(String), answer: String(answer),
      explain: explain || null
    };
  }
  function numberQ(skillId, level, prompt, answer, explain) {
    return {
      skillId: skillId, level: level, kind: 'number',
      prompt: prompt, choices: null, answer: String(answer),
      explain: explain || null
    };
  }
  function textQ(skillId, level, prompt, answer, explain) {
    return {
      skillId: skillId, level: level, kind: 'text',
      prompt: prompt, choices: null, answer: String(answer),
      explain: explain || null
    };
  }

  /* Numbers that scale with level, so the same generator covers a grade range. */
  function span(level, table) {
    var i = Math.max(0, Math.min(table.length - 1, level));
    return table[i];
  }

  /* ===========================================================
     MATHEMATICS — fully generative
     =========================================================== */
  var MATH = {
    counting: function (level) {
      var max = span(level, [10, 20, 50]);
      var start = rnd(1, Math.max(2, max - 5));
      var step = level >= 2 ? pick([2, 5, 10]) : 1;
      var seq = [start, start + step, start + step * 2];
      var answer = start + step * 3;
      return numberQ('counting', level,
        'What number comes next?  ' + seq.join(', ') + ', ___',
        answer,
        step === 1 ? 'We are counting up by one each time.'
                   : 'We are counting up by ' + step + ' each time.');
    },

    'number-sense': function (level) {
      var max = span(level, [20, 100, 1000]);
      var n = rnd(10, max);
      if (level >= 2) {
        var hundreds = Math.floor(n / 100);
        return numberQ('number-sense', level,
          'How many hundreds are in ' + n + '?', hundreds,
          n + ' has ' + hundreds + ' hundred' + (hundreds === 1 ? '' : 's') + '.');
      }
      var tens = Math.floor(n / 10);
      return numberQ('number-sense', level,
        'How many tens are in ' + n + '?', tens,
        n + ' is ' + tens + ' ten' + (tens === 1 ? '' : 's') + ' and ' + (n % 10) + ' more.');
    },

    comparison: function (level) {
      var max = span(level, [10, 100, 1000]);
      var a = rnd(1, max), b = rnd(1, max);
      while (b === a) b = rnd(1, max);
      return choiceQ('comparison', level,
        'Which is bigger — ' + a + ' or ' + b + '?',
        Math.max(a, b), [Math.min(a, b)],
        Math.max(a, b) + ' is bigger than ' + Math.min(a, b) + '.');
    },

    addition: function (level) {
      var max = span(level, [10, 20, 100, 1000]);
      var a = rnd(1, max), b = rnd(1, max);
      return numberQ('addition', level,
        'What is ' + a + ' + ' + b + '?', a + b,
        a + ' + ' + b + ' = ' + (a + b) + '.');
    },

    subtraction: function (level) {
      var max = span(level, [10, 20, 100, 1000]);
      var a = rnd(2, max), b = rnd(1, a);
      return numberQ('subtraction', level,
        'What is ' + a + ' − ' + b + '?', a - b,
        'Start at ' + a + ' and take away ' + b + ' to get ' + (a - b) + '.');
    },

    multiplication: function (level) {
      var max = span(level, [5, 5, 10, 12, 12]);
      var a = rnd(2, max), b = rnd(2, max);
      return numberQ('multiplication', level,
        'What is ' + a + ' × ' + b + '?', a * b,
        a + ' × ' + b + ' means ' + b + ' groups of ' + a + ', which is ' + (a * b) + '.');
    },

    division: function (level) {
      var max = span(level, [5, 5, 10, 12, 12, 12]);
      var b = rnd(2, max), q = rnd(2, max);
      var a = b * q;
      return numberQ('division', level,
        'What is ' + a + ' ÷ ' + b + '?', q,
        'How many ' + b + 's fit into ' + a + '? ' + q + ' of them.');
    },

    fractions: function (level) {
      if (level <= 3) {
        var d = pick([2, 3, 4]);
        var whole = d * rnd(2, 6);
        return numberQ('fractions', level,
          'What is 1/' + d + ' of ' + whole + '?', whole / d,
          'Split ' + whole + ' into ' + d + ' equal groups — each one is ' + (whole / d) + '.');
      }
      var den = pick([4, 6, 8]);
      var n1 = rnd(1, den - 1), n2 = rnd(1, den - n1);
      return textQ('fractions', level,
        'What is ' + n1 + '/' + den + ' + ' + n2 + '/' + den + '?  (write it like 3/4)',
        (n1 + n2) + '/' + den,
        'The bottom numbers match, so add the tops: ' + n1 + ' + ' + n2 + ' = ' + (n1 + n2) + '.');
    },

    'money-math': function (level) {
      var max = span(level, [50, 100, 500, 1000]);
      var a = rnd(5, max), b = rnd(5, max);
      if (level >= 2) {
        var paid = Math.ceil((a + b) / 100) * 100;
        return numberQ('money-math', level,
          'A toy costs ' + cents(a) + ' and a book costs ' + cents(b) +
          '. You pay with ' + cents(paid) + '. How much change, in cents?',
          paid - a - b,
          'They cost ' + cents(a + b) + ' together, so the change is ' + cents(paid - a - b) + '.');
      }
      return numberQ('money-math', level,
        'How many cents altogether — ' + cents(a) + ' and ' + cents(b) + '?', a + b,
        cents(a) + ' + ' + cents(b) + ' = ' + cents(a + b) + '.');
    },

    measurement: function (level) {
      if (level <= 2) {
        var cm = rnd(2, 40);
        return choiceQ('measurement', level,
          'Would you measure a pencil in centimetres or kilometres?',
          'centimetres', ['kilometres'],
          'A pencil is small, so centimetres fit. Kilometres measure long journeys. ' +
          'A pencil might be about ' + cm + ' cm.');
      }
      var m = rnd(2, 9);
      return numberQ('measurement', level,
        'How many centimetres are in ' + m + ' metres?', m * 100,
        'One metre is 100 cm, so ' + m + ' × 100 = ' + (m * 100) + '.');
    },

    geometry: function (level) {
      var shapes = level <= 1
        ? [['triangle', 3], ['square', 4], ['rectangle', 4], ['pentagon', 5]]
        : [['pentagon', 5], ['hexagon', 6], ['octagon', 8], ['triangle', 3]];
      var s = pick(shapes);
      return numberQ('geometry', level,
        'How many sides does a ' + s[0] + ' have?', s[1],
        'A ' + s[0] + ' has ' + s[1] + ' sides.');
    },

    'word-problems': function (level) {
      var names = ['Mia', 'Leo', 'Ada', 'Sam', 'Kai', 'Nia'];
      var who = pick(names);
      var max = span(level, [10, 20, 50, 100, 100, 200]);
      var a = rnd(2, max), b = rnd(2, Math.max(2, Math.floor(a / 2)));
      if (level >= 3) {
        var groups = rnd(2, 6);
        return numberQ('word-problems', level,
          who + ' packs ' + groups + ' boxes with ' + b + ' stickers in each. ' +
          'How many stickers altogether?', groups * b,
          groups + ' groups of ' + b + ' is ' + groups + ' × ' + b + ' = ' + (groups * b) + '.');
      }
      return numberQ('word-problems', level,
        who + ' has ' + a + ' shells and gives away ' + b + '. How many are left?', a - b,
        a + ' − ' + b + ' = ' + (a - b) + '.');
    }
  };

  function cents(c) {
    return c >= 100 ? '$' + (c / 100).toFixed(2) : c + 'c';
  }

  /* ===========================================================
     FINANCIAL LITERACY — generative, tied to Business Town ideas
     =========================================================== */
  var FINANCE = {
    'coins-notes': function (level) {
      var coins = [['a nickel', 5], ['a dime', 10], ['a quarter', 25], ['a penny', 1]];
      if (level >= 2) {
        var q = rnd(1, 3), d = rnd(1, 4);
        return numberQ('coins-notes', level,
          'How many cents are ' + q + ' quarter' + (q === 1 ? '' : 's') +
          ' and ' + d + ' dime' + (d === 1 ? '' : 's') + '?', q * 25 + d * 10,
          q + ' × 25c = ' + (q * 25) + 'c, and ' + d + ' × 10c = ' + (d * 10) + 'c.');
      }
      var c = pick(coins);
      return numberQ('coins-notes', level,
        'How many cents is ' + c[0] + ' worth?', c[1],
        c[0].charAt(0).toUpperCase() + c[0].slice(1) + ' is worth ' + c[1] + 'c.');
    },

    saving: function (level) {
      var perWeek = pick([5, 10, 20]);
      /* A whole number of weeks, so the explanation is actually true. */
      var weeks = rnd(3, span(level, [6, 8, 10, 12, 12]));
      var goal = perWeek * weeks;
      return numberQ('saving', level,
        'You want to save ' + goal + ' cents and you put away ' + perWeek +
        ' cents a week. How many weeks will it take?',
        weeks,
        goal + ' ÷ ' + perWeek + ' = ' + weeks + ' weeks.');
    },

    'spending-choices': function (level) {
      var have = rnd(5, 20) * 10;
      var want = have + rnd(1, 5) * 10;
      return choiceQ('spending-choices', level,
        'You have ' + have + ' cents. A toy costs ' + want +
        ' cents. What is the sensible choice?',
        'Save a bit more first', ['Buy it anyway', 'Borrow from a friend'],
        'You need ' + (want - have) + ' cents more, so saving a little longer works.');
    },

    profit: function (level) {
      var price = rnd(3, 12), cost = rnd(1, price - 1), sold = rnd(4, 20);
      var revenue = price * sold, spend = cost * sold;
      if (level >= 5) {
        return numberQ('profit', level,
          'You sell ' + sold + ' cups at ' + price + ' coins each. Each cup costs you ' +
          cost + ' coins to make. What is the profit?', revenue - spend,
          'Revenue is ' + sold + ' × ' + price + ' = ' + revenue +
          '. Costs are ' + sold + ' × ' + cost + ' = ' + spend +
          '. Profit is ' + revenue + ' − ' + spend + ' = ' + (revenue - spend) + '.');
      }
      return numberQ('profit', level,
        'You take in ' + revenue + ' coins and your costs were ' + spend +
        ' coins. What is the profit?', revenue - spend,
        'Profit = money in − money out = ' + revenue + ' − ' + spend + ' = ' + (revenue - spend) + '.');
    }
  };

  /* ===========================================================
     BANKED SKILLS — written out, because prose does not generate
     =========================================================== */

  /* Each entry: level -> array of items. The engine picks the closest level
     at or below the requested one, so a sparse bank still answers. */
  var BANK = {
    phonics: {
      0: [
        { q: 'Which word starts with the same sound as "sun"?', a: 'sock', d: ['moon', 'tree'],
          e: 'Sun and sock both start with the /s/ sound.' },
        { q: 'Which word rhymes with "cat"?', a: 'hat', d: ['dog', 'cup'],
          e: 'Cat and hat both end with the /at/ sound.' }
      ],
      1: [
        { q: 'How many sounds do you hear in "ship"?', a: '3', d: ['2', '4'],
          e: '/sh/ /i/ /p/ — three sounds, even though there are four letters.' },
        { q: 'Which word has a long "a" sound?', a: 'cake', d: ['cat', 'cap'],
          e: 'In "cake" the a says its own name.' }
      ],
      2: [
        { q: 'Which word has a silent letter?', a: 'knee', d: ['nest', 'nail'],
          e: 'The k in "knee" is silent — we say /nee/.' }
      ]
    },

    vocabulary: {
      0: [
        { q: 'What does "enormous" mean?', a: 'very big', d: ['very small', 'very fast'],
          e: 'Enormous means very, very big.' },
        { q: 'What does "chilly" mean?', a: 'a bit cold', d: ['a bit hot', 'very loud'],
          e: 'Chilly means cold enough to want a jumper.' }
      ],
      2: [
        { q: 'What does "curious" mean?', a: 'wanting to know more', d: ['feeling tired', 'being unkind'],
          e: 'A curious person asks lots of questions.' },
        { q: 'What does "ancient" mean?', a: 'very old', d: ['very new', 'very clean'],
          e: 'Ancient means from a very long time ago.' }
      ],
      4: [
        { q: 'What does "reluctant" mean?', a: 'not keen to do it', d: ['excited to do it', 'very good at it'],
          e: 'Someone reluctant drags their feet a bit.' },
        { q: 'What does "abundant" mean?', a: 'there is plenty', d: ['there is none', 'it is hidden'],
          e: 'Abundant means there is lots and lots of it.' }
      ]
    },

    spelling: {
      0: [{ q: 'Spell the word you hear: a large grey animal with a trunk.', a: 'elephant',
            e: 'e-l-e-p-h-a-n-t. The "ph" makes an /f/ sound.' },
          { q: 'Spell: the opposite of night.', a: 'day', e: 'd-a-y.' }],
      2: [{ q: 'Spell: something you read with pages and a cover.', a: 'book', e: 'b-o-o-k.' },
          { q: 'Spell: the season after summer.', a: 'autumn',
            e: 'a-u-t-u-m-n. The n at the end is silent.' }],
      4: [{ q: 'Spell: a word meaning "happening every year".', a: 'annual',
            e: 'a-n-n-u-a-l — double n.' },
          { q: 'Spell: the study of living things.', a: 'biology', e: 'b-i-o-l-o-g-y.' }]
    },

    grammar: {
      1: [
        { q: 'Which word is the naming word (noun)?  "The dog barked loudly."', a: 'dog',
          d: ['barked', 'loudly'], e: 'A noun names a person, place or thing. "Dog" is the thing.' }
      ],
      3: [
        { q: 'Which sentence is correct?', a: 'She and I went to the park.',
          d: ['Her and me went to the park.', 'Her and I went to the park.'],
          e: 'Try each part alone: "She went" and "I went" both sound right.' }
      ],
      5: [
        { q: 'Which is the correct past tense of "bring"?', a: 'brought',
          d: ['bringed', 'branged'], e: '"Bring" is irregular — it becomes "brought".' }
      ]
    },

    sentences: {
      1: [{ q: 'Which one is a complete sentence?', a: 'The cat sat down.',
            d: ['The fluffy cat.', 'Sat down quickly.'],
            e: 'A sentence needs someone AND something they do.' }],
      3: [{ q: 'Which word joins these best?  "I was tired ___ I kept reading."', a: 'but',
            d: ['because', 'so'], e: '"But" shows the two parts disagree with each other.' }]
    },

    comprehension: {
      1: [{ passage: 'Nia planted a seed in a cup. Every morning she gave it water and put it on the sunny windowsill. After two weeks a small green shoot appeared.',
            q: 'What did Nia do every morning?', a: 'Gave it water',
            d: ['Moved it outside', 'Planted a new seed'],
            e: 'The passage says she gave it water every morning.' }],
      3: [{ passage: 'The lighthouse keeper climbed the stairs at dusk, as he had every evening for forty years. The lamp had to burn before the fishing boats turned for home.',
            q: 'Why did the lamp have to be lit before dark?', a: 'To guide the boats home',
            d: ['To warm the lighthouse', 'To signal a storm'],
            e: 'The boats turn for home at dusk, and the lamp shows them the way.' }]
    },

    'main-idea': {
      2: [{ passage: 'Bees visit flowers to collect nectar. While they do, pollen sticks to their legs and travels to the next flower. That is how many plants make seeds.',
            q: 'What is this mostly about?', a: 'How bees help plants make seeds',
            d: ['What nectar tastes like', 'Where bees sleep'],
            e: 'Every sentence is about bees moving pollen between flowers.' }]
    },

    inference: {
      3: [{ passage: 'Sam pulled on his boots, grabbed the umbrella by the door, and sighed at the window before heading out.',
            q: 'What was the weather probably like?', a: 'Rainy',
            d: ['Sunny and hot', 'Snowy'],
            e: 'Boots, an umbrella and a sigh at the window all point to rain.' }]
    },

    'living-things': {
      0: [{ q: 'Which one is a living thing?', a: 'a tree', d: ['a rock', 'a spoon'],
            e: 'Living things grow, need food or water, and change over time.' }],
      2: [{ q: 'What do all animals need to stay alive?', a: 'Food, water and air',
            d: ['Only sunlight', 'Only soil'], e: 'Animals need food, water and air.' }]
    },

    plants: {
      0: [{ q: 'What do plants need to make their own food?', a: 'Sunlight',
            d: ['Moonlight', 'Darkness'],
            e: 'Leaves use sunlight, water and air to make food for the plant.' }],
      2: [{ q: 'Which part of a plant takes in water from the soil?', a: 'The roots',
            d: ['The flower', 'The leaves'], e: 'Roots drink up water and hold the plant steady.' }]
    },

    weather: {
      0: [{ q: 'What falls from clouds when it rains?', a: 'Water', d: ['Sand', 'Light'],
            e: 'Clouds are made of tiny water drops that join up and fall.' }],
      2: [{ q: 'What is a thermometer used for?', a: 'Measuring temperature',
            d: ['Measuring wind', 'Measuring rain'], e: 'A thermometer tells us how hot or cold it is.' }]
    },

    matter: {
      1: [{ q: 'Which one is a liquid?', a: 'milk', d: ['a brick', 'air'],
            e: 'A liquid pours and takes the shape of its container.' }],
      3: [{ q: 'What happens to water when it freezes?', a: 'It becomes a solid',
            d: ['It becomes a gas', 'It disappears'], e: 'Frozen water is ice, which is a solid.' }]
    },

    forces: {
      1: [{ q: 'What will a magnet stick to?', a: 'A steel paperclip',
            d: ['A plastic cup', 'A wooden spoon'], e: 'Magnets pull on some metals, like steel and iron.' }],
      3: [{ q: 'What force pulls a dropped ball to the ground?', a: 'Gravity',
            d: ['Magnetism', 'Friction'], e: 'Gravity pulls everything towards the Earth.' }]
    },

    'earth-space': {
      2: [{ q: 'What is a planet?', a: 'A large world that orbits a star',
            d: ['A very bright star', 'A piece of a cloud'],
            e: 'Planets go around stars. Earth goes around the Sun.' }],
      4: [{ q: 'Why do we have day and night?', a: 'The Earth spins',
            d: ['The Sun switches off', 'Clouds cover the Sun'],
            e: 'Earth turns all the way round about once every 24 hours.' }]
    },

    community: {
      0: [{ q: 'Who helps put out fires?', a: 'A firefighter', d: ['A baker', 'A pilot'],
            e: 'Firefighters keep our community safe from fires.' }],
      2: [{ q: 'What are taxes mostly used for?', a: 'Things everyone shares, like roads',
            d: ['Presents for one person', 'Nothing at all'],
            e: 'Taxes pay for shared things — roads, parks, libraries, schools.' }]
    },

    maps: {
      1: [{ q: 'Which direction is at the top of most maps?', a: 'North',
            d: ['South', 'East'], e: 'Most maps put north at the top.' }],
      3: [{ q: 'What does a map key (legend) do?', a: 'Explains what the symbols mean',
            d: ['Shows the time', 'Measures the weather'],
            e: 'The key tells you what each little picture on the map stands for.' }]
    },

    environment: {
      2: [{ q: 'Which one helps the planet most?', a: 'Reusing a bottle',
            d: ['Leaving taps running', 'Throwing litter outside'],
            e: 'Reusing something means one less thing has to be made.' }],
      4: [{ q: 'Why are trees helpful to a city?', a: 'They clean the air and give shade',
            d: ['They make it noisier', 'They use up all the water'],
            e: 'Trees take in carbon dioxide, give off oxygen, and cool the streets.' }]
    }
  };

  /* Skills where a model earns its cost, so the engine asks the provider
     first and falls back to the bank above. */
  var AI_PREFERRED = ['comprehension', 'main-idea', 'inference', 'vocabulary'];

  /* Pick the bank level at or below `level`, so a sparse bank still answers. */
  function bankFor(skillId, level) {
    var b = BANK[skillId];
    if (!b) return null;
    var keys = Object.keys(b).map(Number).sort(function (x, y) { return x - y; });
    var best = null;
    keys.forEach(function (k) { if (k <= level) best = k; });
    if (best === null) best = keys[0];
    return b[best] || null;
  }

  /* ===========================================================
     SHORT LESSONS
     A lesson is three or four sentences. Children do not read walls
     of text, and a tutor that lectures is a tutor that gets skipped.
     =========================================================== */
  var LESSONS = {
    addition: 'Adding means putting groups together. If you have 3 shells and find 4 more, ' +
              'you can count them all: 3, then 4 more makes 7. Big numbers work the same way — ' +
              'add the ones first, then the tens.',
    subtraction: 'Subtracting means taking away. Start at the bigger number and count back. ' +
                 '10 take away 4: count back 9, 8, 7, 6. You land on 6.',
    multiplication: 'Multiplication is repeated addition. 8 × 4 means four groups of 8. ' +
                    'So 8 + 8 + 8 + 8 = 32. That is why 8 × 4 = 32.',
    division: 'Division is sharing fairly. 12 ÷ 3 asks "how many threes fit into 12?" ' +
              'Count them: 3, 6, 9, 12 — that is four threes. So 12 ÷ 3 = 4.',
    fractions: 'A fraction is a piece of a whole. The bottom number says how many equal ' +
               'pieces there are, and the top says how many you have. In 3/4, the cake was ' +
               'cut into 4 pieces and you have 3 of them.',
    profit: 'Profit is what is left over. Money in is called revenue. Money out is called ' +
            'cost. Profit = revenue − cost. If you take 20 coins and spent 8 making lemonade, ' +
            'your profit is 12.',
    phonics: 'Words are built from sounds. If you can hear each sound in order, you can ' +
             'read the word. Try it slowly: /sh/ /i/ /p/ — ship.',
    'main-idea': 'The main idea is what the whole piece is mostly about — not one small ' +
                 'detail from it. Ask yourself: if I had to tell a friend in one sentence, ' +
                 'what would I say?',
    inference: 'Sometimes a story does not tell you something directly, but it gives you ' +
               'clues. Putting the clues together is called inferring. Boots and an umbrella ' +
               'tell you it is raining, even if nobody says so.'
  };

  var Content = WW.tutorContent = {
    AI_PREFERRED: AI_PREFERRED,

    /* Tests call this; nothing in the game does. */
    seed: function (n) { _seed = (n === null || n === undefined) ? null : (n >>> 0); },

    /* Is there anything offline for this skill at all? */
    has: function (skillId) {
      return !!(MATH[skillId] || FINANCE[skillId] || BANK[skillId]);
    },

    /* A model is worth paying for here. */
    prefersAI: function (skillId) { return AI_PREFERRED.indexOf(skillId) !== -1; },

    /* ---------- the one question generator ---------- */
    question: function (skillId, level) {
      level = Math.max(0, Math.round(level || 0));

      if (MATH[skillId]) return MATH[skillId](level);
      if (FINANCE[skillId]) return FINANCE[skillId](level);

      var items = bankFor(skillId, level);
      if (!items || !items.length) return null;
      var it = pick(items);

      if (it.a && it.d) {
        var q = choiceQ(skillId, level, it.q, it.a, it.d, it.e);
        if (it.passage) q.passage = it.passage;
        return q;
      }
      /* spelling and the like: typed answer */
      return textQ(skillId, level, it.q, it.a, it.e);
    },

    lesson: function (skillId, level) {
      var def = T.skill(skillId);
      var body = LESSONS[skillId];
      if (!body) {
        /* Honest generic opener rather than invented pedagogy. */
        body = 'Let\'s look at ' + (def ? def.name.toLowerCase() : 'this') +
               ' together. I\'ll show you one, then you try.';
      }
      return {
        skillId: skillId,
        level: level,
        title: def ? def.name : skillId,
        body: body
      };
    },

    /* ---------- deterministic scoring ----------
       Never ask a model whether "7" equals "7". */
    check: function (question, given) {
      if (!question) return false;
      var want = String(question.answer == null ? '' : question.answer).trim().toLowerCase();
      var got = String(given == null ? '' : given).trim().toLowerCase();
      if (!got) return false;
      if (got === want) return true;

      /* Numbers: compare as numbers so "07" and "7 " both pass. */
      if (question.kind === 'number') {
        var a = parseFloat(got.replace(/[^0-9.\-]/g, ''));
        var b = parseFloat(want);
        return isFinite(a) && isFinite(b) && a === b;
      }
      /* Typed words: forgive punctuation and an article, not spelling, because
         spelling is often the thing being tested. */
      if (question.kind === 'text') {
        var norm = function (s) { return s.replace(/^(a|an|the)\s+/, '').replace(/[^a-z0-9/ ]/g, '').trim(); };
        return norm(got) === norm(want);
      }
      return false;
    }
  };

})(window.WW);
