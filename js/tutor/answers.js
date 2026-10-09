/* =============================================================
   WonderWorld — tutor/answers.js
   Answering a child's question with no model and no network.

   WHY THIS EXISTS
   ---------------
   "Ask WonderTutor" used to return a shrug whenever the AI endpoint
   was unconfigured or unreachable — which is the default state and
   the state on a plane. A question box that cannot answer questions
   is worse than no question box, so this module answers the kinds
   of thing children actually ask, deterministically.

   The model, when it is available, is still better: it handles
   phrasing we have never seen and topics we have no entry for. This
   is the floor, not the ceiling. But the floor has to be a real
   answer.

   WHAT IT CAN ACTUALLY DO
   -----------------------
     ARITHMETIC   parsed and worked out, with the reasoning shown.
                  "why is 8 x 4 32" gets the repeated-addition
                  explanation, not just confirmation.
     SPELLING     a list of words children commonly ask for, spelled
                  out letter by letter with the tricky part named.
     MEANINGS     a glossary of ~90 terms across all six domains, at
                  a child's reading level.
     CONCEPTS     "why do plants need sunlight" style questions
                  matched to the explanations already written for
                  the lesson bank.

   WHAT IT WILL NOT DO
   -------------------
   Guess. If nothing matches, it says so plainly and offers to teach
   something related instead. An invented answer to a child's
   question about the world is the worst outcome available here, and
   a confident wrong answer is worse than an honest "I don't know
   that one".
   ============================================================= */
(function (WW) {
  'use strict';

  var T = WW.tutorTaxonomy;

  /* ---------- normalising a child's phrasing ---------- */

  function norm(q) {
    return String(q || '')
      .toLowerCase()
      .replace(/[“”"']/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /* Words children use for operators, plus the symbols. */
  function normMath(q) {
    return norm(q)
      .replace(/\btimes\b|\bmultiplied by\b|\blots of\b|\bgroups of\b/g, '×')
      .replace(/\bx\b/g, '×')
      .replace(/\*/g, '×')
      .replace(/\bplus\b|\badd\b|\band\b/g, '+')
      .replace(/\bminus\b|\btake away\b|\bsubtract\b|\bless\b/g, '−')
      .replace(/-/g, '−')
      .replace(/\bdivided by\b|\bshared between\b|\bshared by\b|\bsplit between\b/g, '÷')
      .replace(/\//g, '÷')
      .replace(/\s+/g, ' ');
  }

  var NUM_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six',
                   'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
  function numWord(n) { return NUM_WORDS[n] || String(n); }

  function compute(a, op, b) {
    switch (op) {
      case '+': return a + b;
      case '−': return a - b;
      case '×': return a * b;
      case '÷': return b === 0 ? null : a / b;
      default: return null;
    }
  }

  /* The reasoning, not just the result. This is the part that makes it
     teaching rather than a calculator. */
  function explainMath(a, op, b, r) {
    switch (op) {
      case '+':
        if (a <= 10 && b <= 10) {
          return a + ' + ' + b + ' = ' + r + '. Start at ' + a +
                 ' and count on ' + b + ' more: ' + countOn(a, b) + '.';
        }
        return a + ' + ' + b + ' = ' + r + '. Add the ones first, then the tens — ' +
               'it works the same way with big numbers.';
      case '−':
        if (a <= 20) {
          return a + ' − ' + b + ' = ' + r + '. Start at ' + a +
                 ' and count back ' + b + ': ' + countBack(a, b) + '.';
        }
        return a + ' − ' + b + ' = ' + r + '. You can also check it by adding: ' +
               r + ' + ' + b + ' = ' + a + '.';
      case '×':
        return 'Multiplication is repeated addition. ' + a + ' × ' + b + ' means ' +
               numWord(b) + ' group' + (b === 1 ? '' : 's') + ' of ' + a + '. So ' +
               repeatedAddition(a, b) + ' = ' + r + '.';
      case '÷':
        return 'Division is sharing fairly. ' + a + ' ÷ ' + b + ' asks "how many ' +
               b + 's fit into ' + a + '?" Count them: ' + countBy(b, r) +
               ' — that is ' + r + ' of them.';
      default:
        return null;
    }
  }

  function countOn(a, b) {
    var out = [], n = a;
    for (var i = 0; i < b && i < 10; i++) out.push(++n);
    return out.join(', ');
  }
  function countBack(a, b) {
    var out = [], n = a;
    for (var i = 0; i < b && i < 12; i++) out.push(--n);
    return out.join(', ');
  }
  function repeatedAddition(a, b) {
    if (b > 8) return a + ' added ' + b + ' times';
    var parts = [];
    for (var i = 0; i < b; i++) parts.push(a);
    return parts.join(' + ');
  }
  /* "twice" reads better than "2 times" in the middle of a sentence. */
  var TIMES_WORDS = ['no times', 'once', 'twice', 'three times', 'four times',
                     'five times', 'six times', 'seven times', 'eight times',
                     'nine times', 'ten times'];
  function timesWord(n) {
    return TIMES_WORDS[n] || (n + ' times');
  }

  function countBy(step, times) {
    var out = [], n = 0;
    for (var i = 0; i < times && i < 12; i++) { n += step; out.push(n); }
    return out.join(', ');
  }

  /* ---------- spelling ----------
     Words children actually ask how to spell. Tricky parts are named,
     because "b-e-c-a-u-s-e" alone teaches less than "the 'au' in the
     middle is the bit people forget". */
  var SPELLINGS = {
    elephant: 'The "ph" makes an /f/ sound.',
    because: 'The "au" in the middle is the bit people forget.',
    beautiful: 'It starts with "beau" — three vowels in a row.',
    friend: 'There is an "i" before the "end": fri-end.',
    said: 'It sounds like "sed" but it is spelled with "ai".',
    people: 'The "eo" is unusual — peo-ple.',
    before: null, favorite: 'British spelling keeps the "u": fav-our-ite.',
    favorite: 'American spelling drops the "u": fav-or-ite.',
    something: null, different: 'Three syllables: dif-fer-ent. Double "f".',
    science: 'The "sci" makes a /s/ sound.',
    once: null, where: null, there: 'For a place. "Their" is for belonging.',
    their: 'For belonging. "There" is for a place.',
    which: null, what: null, when: null, who: null,
    knee: 'The "k" is silent — we say /nee/.',
    know: 'Another silent "k".',
    write: 'The "w" is silent — we say /rite/.',
    island: 'The "s" is silent — we say /eye-land/.',
    autumn: 'The "n" at the end is silent.',
    tomorrow: 'One "m", two "r"s.',
    necessary: 'One "c", two "s"s.',
    separate: 'There is "a rat" in the middle: sep-a-rat-e.',
    rhythm: 'No vowels except the "y".',
    weather: 'For rain and sun. "Whether" means "if".',
    whether: 'Means "if". "Weather" is rain and sun.',
    beginning: 'Double "n" before the "ing".',
    library: 'Two "r"s — lib-ra-ry.',
    February: 'There is an "r" after the "b".',
    Wednesday: 'There is a hidden "d": Wed-nes-day.',
    dinosaur: 'It ends in "saur", not "sore".',
    chocolate: 'Three syllables: choc-o-late.',
    enough: 'The "ough" makes an /uff/ sound.',
    through: 'The "ough" is silent here — we say /throo/.',
    thought: 'Another tricky "ough".',
    eight: 'The "gh" is silent — we say /ate/.',
    height: 'Sounds like "hite", not "heet".',
    guess: 'There is a silent "u" after the "g".',
    beach: 'The sandy kind. A "beech" is a tree.',
    piece: 'A piece of cake has "pie" in it.',
    receive: '"i" before "e" except after "c" — this is the "after c" case.',
    believe: '"i" before "e" here.',
    multiplication: 'Four syllables: mul-ti-pli-ca-tion.',
    subtraction: null, addition: 'Double "d".', division: null,
    fraction: null, measurement: 'Keep the "e" from "measure".',
    triangle: null, rectangle: null, circle: null, square: null
  };

  /* ---------- glossary ----------
     Child-level, accurate, short. `skill` ties an entry back to the
     taxonomy so the tutor can offer the matching lesson afterwards. */
  var GLOSSARY = {
    /* --- math --- */
    'add': { skill: 'addition', text: 'Adding means putting groups together to find how many there are altogether.' },
    'addition': { skill: 'addition', text: 'Addition is putting groups together. 3 + 4 = 7.' },
    'subtract': { skill: 'subtraction', text: 'Subtracting means taking some away and finding how many are left.' },
    'subtraction': { skill: 'subtraction', text: 'Subtraction is taking away. 10 − 4 = 6.' },
    'multiply': { skill: 'multiplication', text: 'Multiplying is adding the same number again and again. 8 × 4 means four groups of 8.' },
    'multiplication': { skill: 'multiplication', text: 'Multiplication is repeated addition. 8 × 4 = 8 + 8 + 8 + 8 = 32.' },
    'divide': { skill: 'division', text: 'Dividing means sharing something into equal groups.' },
    'division': { skill: 'division', text: 'Division is sharing fairly. 12 ÷ 3 = 4, because four 3s fit into 12.' },
    'fraction': { skill: 'fractions', text: 'A fraction is a piece of a whole. In 3/4, the bottom number says how many equal pieces there are and the top says how many you have.' },
    'numerator': { skill: 'fractions', text: 'The numerator is the TOP number in a fraction — how many pieces you have.' },
    'denominator': { skill: 'fractions', text: 'The denominator is the BOTTOM number in a fraction — how many equal pieces the whole was cut into.' },
    'half': { skill: 'fractions', text: 'A half is one of two equal pieces. Half of 10 is 5.' },
    'quarter': { skill: 'fractions', text: 'A quarter is one of four equal pieces. A quarter of 12 is 3.' },
    'even number': { skill: 'number-sense', text: 'An even number can be split into two equal groups. 2, 4, 6, 8 are even.' },
    'odd number': { skill: 'number-sense', text: 'An odd number always has one left over when you split it in two. 1, 3, 5, 7 are odd.' },
    'digit': { skill: 'number-sense', text: 'A digit is a single number symbol, 0 to 9. The number 47 has two digits.' },
    'place value': { skill: 'number-sense', text: 'Place value is what a digit is worth because of where it sits. In 47, the 4 means four tens.' },
    'sum': { skill: 'addition', text: 'A sum is the answer you get when you add numbers together.' },
    'difference': { skill: 'subtraction', text: 'The difference is what is left when you subtract one number from another.' },
    'product': { skill: 'multiplication', text: 'A product is the answer you get when you multiply.' },
    'estimate': { skill: 'number-sense', text: 'To estimate is to make a sensible close guess instead of working out the exact answer.' },
    'perimeter': { skill: 'measurement', text: 'The perimeter is the distance all the way around the outside of a shape.' },
    'area': { skill: 'measurement', text: 'Area is how much flat space a shape covers.' },
    'volume': { skill: 'measurement', text: 'Volume is how much space something takes up, or how much it can hold.' },
    'angle': { skill: 'geometry', text: 'An angle is the amount of turn where two lines meet at a corner.' },
    'triangle': { skill: 'geometry', text: 'A triangle is a shape with three straight sides and three corners.' },
    'rectangle': { skill: 'geometry', text: 'A rectangle has four straight sides and four square corners. The opposite sides are the same length.' },
    'square': { skill: 'geometry', text: 'A square is a rectangle where all four sides are the same length.' },
    'circle': { skill: 'geometry', text: 'A circle is a perfectly round shape. Every point on the edge is the same distance from the middle.' },
    'hexagon': { skill: 'geometry', text: 'A hexagon is a shape with six straight sides.' },
    'symmetry': { skill: 'geometry', text: 'A shape has symmetry if you can fold it so both halves match exactly.' },

    /* --- reading and writing --- */
    'vowel': { skill: 'phonics', text: 'The vowels are a, e, i, o and u. Every word has at least one vowel sound.' },
    'consonant': { skill: 'phonics', text: 'Consonants are all the letters that are not vowels, like b, c, d and f.' },
    'syllable': { skill: 'phonics', text: 'A syllable is a beat in a word. "Elephant" has three: e-le-phant.' },
    'rhyme': { skill: 'phonics', text: 'Two words rhyme when they end with the same sound, like cat and hat.' },
    'noun': { skill: 'grammar', text: 'A noun is a naming word — a person, a place or a thing. "Dog" is a noun.' },
    'verb': { skill: 'grammar', text: 'A verb is a doing word. In "the dog barked", the verb is "barked".' },
    'adjective': { skill: 'grammar', text: 'An adjective describes a noun. In "the fluffy dog", "fluffy" is the adjective.' },
    'adverb': { skill: 'grammar', text: 'An adverb describes how something is done. In "she ran quickly", "quickly" is the adverb.' },
    'sentence': { skill: 'sentences', text: 'A sentence needs someone or something AND what they do. It starts with a capital letter and ends with a full stop.' },
    'paragraph': { skill: 'sentences', text: 'A paragraph is a group of sentences all about the same idea.' },
    'main idea': { skill: 'main-idea', text: 'The main idea is what a whole piece of writing is mostly about — not one small detail from it.' },
    'inference': { skill: 'inference', text: 'An inference is working something out from clues, even when the story does not say it directly.' },
    'synonym': { skill: 'vocabulary', text: 'Synonyms are words that mean nearly the same thing, like big and large.' },
    'antonym': { skill: 'vocabulary', text: 'Antonyms are words that mean the opposite, like hot and cold.' },

    /* --- science --- */
    'planet': { skill: 'earth-space', text: 'A planet is a large world that travels around a star. Earth is a planet going around the Sun.' },
    'star': { skill: 'earth-space', text: 'A star is a huge ball of burning gas that makes its own light. The Sun is our closest star.' },
    'moon': { skill: 'earth-space', text: 'A moon is a world that travels around a planet. Our Moon goes around the Earth.' },
    'sun': { skill: 'earth-space', text: 'The Sun is the star at the center of our solar system. It gives Earth light and heat.' },
    'gravity': { skill: 'forces', text: 'Gravity is the pull that brings things down to the ground. It is why a dropped ball falls.' },
    'orbit': { skill: 'earth-space', text: 'An orbit is the curved path something takes as it travels around something bigger.' },
    'solar system': { skill: 'earth-space', text: 'The solar system is the Sun and everything that orbits it, including all the planets.' },
    'magnet': { skill: 'forces', text: 'A magnet pulls on some metals, like iron and steel. It will not pull on plastic or wood.' },
    'force': { skill: 'forces', text: 'A force is a push or a pull that can make something move, stop or change direction.' },
    'friction': { skill: 'forces', text: 'Friction is the rubbing that slows things down when two surfaces slide against each other.' },
    'solid': { skill: 'matter', text: 'A solid keeps its own shape, like a brick or an ice cube.' },
    'liquid': { skill: 'matter', text: 'A liquid pours and takes the shape of its container, like water or milk.' },
    'gas': { skill: 'matter', text: 'A gas spreads out to fill whatever space it is in. The air around you is a gas.' },
    'melt': { skill: 'matter', text: 'Melting is when heat turns a solid into a liquid, like ice becoming water.' },
    'freeze': { skill: 'matter', text: 'Freezing is when cold turns a liquid into a solid, like water becoming ice.' },
    'evaporate': { skill: 'matter', text: 'Evaporating is when a liquid slowly turns into a gas, like a puddle drying up.' },
    'photosynthesis': { skill: 'plants', text: 'Photosynthesis is how plants make their own food. Leaves use sunlight, water and air to do it.' },
    'root': { skill: 'plants', text: 'Roots drink up water from the soil and hold the plant steady in the ground.' },
    'stem': { skill: 'plants', text: 'The stem holds the plant up and carries water from the roots to the leaves.' },
    'leaf': { skill: 'plants', text: 'Leaves catch sunlight so the plant can make its food.' },
    'seed': { skill: 'plants', text: 'A seed holds a tiny new plant and the food it needs to start growing.' },
    'habitat': { skill: 'living-things', text: 'A habitat is the place where an animal or plant lives and finds what it needs.' },
    'mammal': { skill: 'living-things', text: 'Mammals have fur or hair, feed their babies milk, and are warm-blooded. Dogs, whales and people are mammals.' },
    'reptile': { skill: 'living-things', text: 'Reptiles have dry scaly skin and most lay eggs. Snakes and lizards are reptiles.' },
    'insect': { skill: 'living-things', text: 'An insect has six legs and a body in three parts. Ants and bees are insects.' },
    'carnivore': { skill: 'living-things', text: 'A carnivore is an animal that eats meat.' },
    'herbivore': { skill: 'living-things', text: 'A herbivore is an animal that eats only plants.' },
    'omnivore': { skill: 'living-things', text: 'An omnivore eats both plants and animals. People are omnivores.' },
    'thermometer': { skill: 'weather', text: 'A thermometer measures temperature — how hot or cold something is.' },
    'cloud': { skill: 'weather', text: 'A cloud is made of billions of tiny water droplets floating in the air.' },
    'rain': { skill: 'weather', text: 'Rain happens when tiny water droplets in a cloud join together until they are heavy enough to fall.' },
    'water cycle': { skill: 'weather', text: 'The water cycle is water moving round and round: it evaporates, forms clouds, falls as rain, then does it again.' },

    /* --- social studies --- */
    'community': { skill: 'community', text: 'A community is a group of people who live or work in the same place and help each other.' },
    'tax': { skill: 'community', text: 'Taxes are money people pay to the government so it can build shared things like roads, parks and schools.' },
    'map': { skill: 'maps', text: 'A map is a picture of a place from above, showing where things are.' },
    'compass': { skill: 'maps', text: 'A compass shows you which way is north, so you can find your direction.' },
    'continent': { skill: 'maps', text: 'A continent is one of the very large land areas on Earth, like Africa or Asia.' },
    'recycle': { skill: 'environment', text: 'Recycling means turning something used into something new instead of throwing it away.' },
    'pollution': { skill: 'environment', text: 'Pollution is harmful stuff that gets into the air, water or ground and makes it dirty.' },

    /* --- money --- */
    'profit': { skill: 'profit', text: 'Profit is what is left over. Money in is revenue, money out is cost. Profit = revenue − cost.' },
    'revenue': { skill: 'profit', text: 'Revenue is all the money that comes in from selling things.' },
    'cost': { skill: 'profit', text: 'Cost is the money you spend to make or buy the things you sell.' },
    'loss': { skill: 'profit', text: 'A loss is when your costs are bigger than your revenue — you spent more than you took in.' },
    'save': { skill: 'saving', text: 'Saving means keeping some money now so you can use it later.' },
    'saving': { skill: 'saving', text: 'Saving means keeping some money now so you can use it later for something you want more.' },
    'budget': { skill: 'spending-choices', text: 'A budget is a plan for your money — how much to spend and how much to keep.' },
    'interest': { skill: 'saving', text: 'Interest is a little extra money a bank adds to your savings for keeping it there.' },
    'coin': { skill: 'coins-notes', text: 'Coins are the metal money we use. Each one is worth a different amount.' },
    'change': { skill: 'money-math', text: 'Change is the money you get back when you pay more than something costs.' }
  };

  /* Concept questions that the lesson bank already explains well. Matched by
     all of the keywords being present, so "why do plants need sunlight"
     lands but "what is sunlight" does not get the wrong answer. */
  var CONCEPTS = [
    { keys: ['plant', 'sunlight'], skill: 'plants',
      text: 'Plants use sunlight to make their own food. Their leaves take in sunlight, water and air and turn it into the sugar the plant needs to grow. That is called photosynthesis.' },
    { keys: ['plant', 'water'], skill: 'plants',
      text: 'Plants drink water through their roots. They need it to make food in their leaves, and it also keeps their stems firm so they can stand up.' },
    { keys: ['sky', 'blue'], skill: 'earth-space',
      text: 'Sunlight is made of lots of colors mixed together. When it hits the air, the blue light bounces around the most, so that is the color we see all over the sky.' },
    { keys: ['day', 'night'], skill: 'earth-space',
      text: 'Earth spins all the way round about once every 24 hours. When your side faces the Sun it is day, and when it faces away it is night.' },
    { keys: ['season'], skill: 'earth-space',
      text: 'Earth is tilted as it travels around the Sun. When your part of the world leans towards the Sun you get summer, and when it leans away you get winter.' },
    { keys: ['rain'], skill: 'weather',
      text: 'The Sun warms water in seas and puddles until it turns into invisible vapour and rises. Up high it cools into tiny droplets that make clouds, and when those droplets join up they get heavy and fall as rain.' },
    { keys: ['rainbow'], skill: 'weather',
      text: 'Raindrops bend sunlight and split it into all its colors. That is why you see a rainbow when the Sun shines while it is still raining.' },
    { keys: ['thing', 'fall'], skill: 'forces',
      text: 'Gravity pulls everything towards the Earth. That is why a dropped ball goes down instead of floating away.' },
    { keys: ['magnet', 'stick'], skill: 'forces',
      text: 'Magnets pull on some metals, especially iron and steel. Plastic, wood and paper have nothing for the magnet to pull on, so they do not stick.' },
    { keys: ['ice', 'float'], skill: 'matter',
      text: 'When water freezes, the tiny bits inside spread out a little. That makes ice lighter than the same amount of water, so it floats.' }
  ];

  /* ---------- the matchers ---------- */

  function tryArithmetic(q) {
    var m = normMath(q);

    /* "why is 8 × 4 32" / "why is 8 × 4 = 32" */
    var why = m.match(/why\s+(?:is|does)\s+(\d+)\s*([+−×÷])\s*(\d+)\s*(?:=|equals?|is|make|makes)?\s*(\d+)/);
    if (why) {
      var a = +why[1], op = why[2], b = +why[3], claimed = +why[4];
      var r = compute(a, op, b);
      if (r === null) return null;
      if (r !== claimed) {
        return {
          ok: true, kind: 'arithmetic', skill: skillFor(op),
          text: 'Good question — but let\'s check it! ' + a + ' ' + op + ' ' + b +
                ' is actually ' + r + ', not ' + claimed + '. ' + explainMath(a, op, b, r)
        };
      }
      return { ok: true, kind: 'arithmetic', skill: skillFor(op), text: explainMath(a, op, b, r) };
    }

    /* "what is 7 + 5" / "7 + 5 = ?" / "how much is 9 × 3" */
    var plain = m.match(/(?:what(?:'s| is)|how much is|whats)?\s*(\d+)\s*([+−×÷])\s*(\d+)\s*=?\s*\??$/);
    if (plain) {
      var a2 = +plain[1], op2 = plain[2], b2 = +plain[3];
      var r2 = compute(a2, op2, b2);
      if (r2 === null) {
        return { ok: true, kind: 'arithmetic', skill: 'division',
          text: 'You cannot divide by zero — there is no way to share something into zero groups!' };
      }
      if (r2 % 1 !== 0) {
        var whole2 = Math.floor(r2);
        var rem = a2 % b2;
        return { ok: true, kind: 'arithmetic', skill: 'division',
          text: a2 + ' ÷ ' + b2 + ' does not share out evenly. ' + b2 + ' goes into ' +
                a2 + ' ' + timesWord(whole2) + ', and there ' +
                (rem === 1 ? 'is 1 left over' : 'are ' + rem + ' left over') + '.' };
      }
      /* explainMath already states the result for every operator, so adding
         the equation here would repeat it. */
      return {
        ok: true, kind: 'arithmetic', skill: skillFor(op2),
        text: explainMath(a2, op2, b2, r2)
      };
    }

    /* "what is half of 10" / "what is a quarter of 12" / "what is 1/4 of 8" */
    var frac = norm(q).match(/(?:what(?:'s| is))?\s*(?:a\s+)?(half|third|quarter|fifth|tenth|1\s*÷\s*(\d+)|1\/(\d+))\s+of\s+(\d+)/);
    if (frac) {
      var names = { half: 2, third: 3, quarter: 4, fifth: 5, tenth: 10 };
      var den = names[frac[1]] || +(frac[2] || frac[3]);
      var whole = +frac[4];
      if (den && whole) {
        var part = whole / den;
        var nice = part % 1 === 0 ? part : Math.round(part * 100) / 100;
        return {
          ok: true, kind: 'arithmetic', skill: 'fractions',
          text: 'Split ' + whole + ' into ' + den + ' equal groups — each group is ' + nice +
                '. So 1/' + den + ' of ' + whole + ' is ' + nice + '.'
        };
      }
    }
    return null;
  }

  function skillFor(op) {
    return { '+': 'addition', '−': 'subtraction', '×': 'multiplication', '÷': 'division' }[op] || null;
  }

  function trySpelling(q) {
    var m = norm(q);
    if (!/\bspell\b|\bspelling of\b/.test(m)) return null;
    var word = m.replace(/.*\b(?:spell|spelling of)\b\s*/, '')
                .replace(/[^a-z\s]/g, '')
                .replace(/^(the word|a|an)\s+/, '')
                .trim()
                .split(' ')[0];
    if (!word) return null;

    var keys = Object.keys(SPELLINGS);
    var hit = null;
    for (var i = 0; i < keys.length; i++) {
      if (keys[i].toLowerCase() === word) { hit = keys[i]; break; }
    }
    if (!hit) {
      return {
        ok: false, kind: 'spelling',
        text: 'I don\'t know how to spell "' + word + '" for certain, so I won\'t guess — ' +
              'a wrong spelling is worse than none! Try a grown-up or a dictionary. ' +
              'Want to practice some spellings I do know?'
      };
    }
    var letters = hit.split('').join('-');
    var tip = SPELLINGS[hit];
    var shown = hit.charAt(0).toUpperCase() + hit.slice(1);
    return {
      ok: true, kind: 'spelling', skill: 'spelling',
      text: shown + ' is spelled ' + letters + '.' + (tip ? ' ' + tip : '')
    };
  }

  function tryGlossary(q) {
    var m = norm(q).replace(/[?.!]/g, '');
    /* Only treat it as a definition question if it looks like one, so
       "what is 7 + 5" never reaches here. */
    if (!/\bwhat (?:is|are|does)\b|\bwhat.s\b|\bmeaning of\b|\bmean\b|\bdefine\b/.test(m)) return null;

    var keys = Object.keys(GLOSSARY).sort(function (a, b) { return b.length - a.length; });
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      var re = new RegExp('\\b' + k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + 's?\\b');
      if (re.test(m)) {
        var g = GLOSSARY[k];
        return { ok: true, kind: 'glossary', skill: g.skill, text: g.text, term: k };
      }
    }
    return null;
  }

  function tryConcept(q) {
    var m = norm(q);
    for (var i = 0; i < CONCEPTS.length; i++) {
      var c = CONCEPTS[i];
      var all = c.keys.every(function (k) { return m.indexOf(k) !== -1; });
      if (all) return { ok: true, kind: 'concept', skill: c.skill, text: c.text };
    }
    return null;
  }

  /* A question about a skill we teach, even if we have no entry for the exact
     wording. Offer the lesson rather than nothing. */
  function trySkillTopic(q) {
    var m = norm(q);
    var skills = T ? T.SKILLS : [];
    for (var i = 0; i < skills.length; i++) {
      var name = skills[i].name.toLowerCase();
      if (m.indexOf(name) !== -1 || m.indexOf(skills[i].id.replace(/-/g, ' ')) !== -1) {
        var lesson = WW.tutorContent ? WW.tutorContent.lesson(skills[i].id,
          WW.learningProfile ? (WW.learningProfile.level(skills[i].id) || 0) : 0) : null;
        if (lesson && lesson.body) {
          return { ok: true, kind: 'topic', skill: skills[i].id, text: lesson.body };
        }
      }
    }
    return null;
  }

  var Answers = WW.tutorAnswers = {
    GLOSSARY: GLOSSARY,
    SPELLINGS: SPELLINGS,
    CONCEPTS: CONCEPTS,

    /* How many distinct things it can answer, for the tests and the docs. */
    coverage: function () {
      return {
        glossary: Object.keys(GLOSSARY).length,
        spellings: Object.keys(SPELLINGS).length,
        concepts: CONCEPTS.length
      };
    },

    /* The one entry point.

       Returns { ok, text, kind, skill } on a real answer, or
       { ok: false, text } with an honest non-answer that still offers
       something. Never guesses, never throws. */
    answer: function (question) {
      var q = String(question || '').trim();
      if (!q) return { ok: false, text: 'Ask me anything you like about what we\'re learning!' };

      var handlers = [tryArithmetic, trySpelling, tryConcept, tryGlossary, trySkillTopic];
      for (var i = 0; i < handlers.length; i++) {
        var r = null;
        try { r = handlers[i](q); } catch (e) { r = null; }
        if (r) return r;
      }

      /* Nothing matched. Say so plainly and offer the thing we were about to
         teach anyway — a shrug is what this module exists to replace. */
      var next = WW.tutor && WW.tutor.nextSkill ? WW.tutor.nextSkill() : null;
      var def = next && T ? T.skill(next.skillId) : null;
      return {
        ok: false,
        kind: 'unknown',
        text: 'That one\'s outside what I can work out on my own — and I\'d rather ' +
              'say so than guess. ' +
              (def ? 'Shall we practice ' + def.name.toLowerCase() + ' instead?'
                   : 'Shall we practice something together instead?')
      };
    }
  };

})(window.WW);
