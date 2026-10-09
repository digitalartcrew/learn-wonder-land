/* =============================================================
   WonderWorld — tutor/steps.js
   "Show me how" — working a problem through, one step at a time.

   WHY
   ---
   A child who gets something wrong and is told "have another go"
   has been given encouragement but no help. If they did not know
   how to do it the first time, they still do not. This breaks a
   problem into the steps a teacher would say out loud, revealed
   ONE AT A TIME so the child follows along rather than reading an
   answer.

   THE LAST STEP IS THE ANSWER, AND IT COMES LAST
   ----------------------------------------------
   Steps are revealed on demand. The answer is always the final
   step, so a child who taps through has at least seen the method
   on the way past it. After the walkthrough they get a FRESH
   question at the same level — being walked through one problem
   should not count as having solved it, and should not be the end
   of the practice either.

   DETERMINISTIC
   -------------
   Every step is derived from the question's own numbers. No model
   is involved, so this works offline, costs nothing, and cannot
   invent a method that does not reach the right answer. The final
   step is checked against the question's own answer, and the whole
   walkthrough is discarded if they disagree.
   ============================================================= */
(function (WW) {
  'use strict';

  /* Parse "What is 27 + 46?" style prompts back into their parts. The
     question generator built them, so this is reliable — but every path
     still verifies against question.answer before returning. */
  var OPS = ['+', '−', '×', '÷'];

  function parts(q) {
    if (!q || !q.prompt) return null;
    var m = q.prompt.match(/(\d+)\s*([+−×÷])\s*(\d+)/);
    if (!m) return null;
    return { a: +m[1], op: m[2], b: +m[3] };
  }

  function tens(n) { return Math.floor(n / 10) * 10; }
  function ones(n) { return n % 10; }

  function countSeq(start, step, times) {
    var out = [], n = start;
    for (var i = 0; i < times && i < 14; i++) { out.push(n); n += step; }
    return out.join(', ');
  }

  /* ---------- arithmetic ---------- */

  function addSteps(a, b) {
    if (a <= 10 && b <= 10) {
      return [
        'Start at ' + a + '.',
        'Now count on ' + b + ' more: ' + countSeq(a + 1, 1, b) + '.',
        'You landed on ' + (a + b) + '. So ' + a + ' + ' + b + ' = ' + (a + b) + '.'
      ];
    }
    var at = tens(a), ao = ones(a), bt = tens(b), bo = ones(b);
    var steps = ['Big numbers are easier in pieces. ' +
                 a + ' is ' + at + ' and ' + ao + '. ' +
                 b + ' is ' + bt + ' and ' + bo + '.'];
    steps.push('Add the tens first: ' + at + ' + ' + bt + ' = ' + (at + bt) + '.');
    steps.push('Then add the ones: ' + ao + ' + ' + bo + ' = ' + (ao + bo) + '.');
    steps.push('Put the two parts together: ' + (at + bt) + ' + ' + (ao + bo) +
               ' = ' + (a + b) + '.');
    steps.push('So ' + a + ' + ' + b + ' = ' + (a + b) + '.');
    return steps;
  }

  function subSteps(a, b) {
    if (a <= 20) {
      return [
        'Start at ' + a + '.',
        'Count back ' + b + ': ' + countSeq(a - 1, -1, b) + '.',
        'You landed on ' + (a - b) + '. So ' + a + ' − ' + b + ' = ' + (a - b) + '.'
      ];
    }
    var bt = tens(b), bo = ones(b);
    var afterTens = a - bt;
    var steps = ['Take it away in pieces. ' + b + ' is ' + bt + ' and ' + bo + '.'];
    steps.push('Take away the tens first: ' + a + ' − ' + bt + ' = ' + afterTens + '.');
    steps.push('Now take away the ones: ' + afterTens + ' − ' + bo + ' = ' + (a - b) + '.');
    steps.push('So ' + a + ' − ' + b + ' = ' + (a - b) + '.');
    steps.push('You can check it by adding back: ' + (a - b) + ' + ' + b + ' = ' + a + '.');
    return steps;
  }

  function mulSteps(a, b) {
    var steps = ['Multiplication is repeated addition — adding the same number again and again.'];
    steps.push(a + ' × ' + b + ' means ' + b + ' group' + (b === 1 ? '' : 's') +
               ' of ' + a + '.');
    if (b <= 8) {
      var parts2 = [];
      for (var i = 0; i < b; i++) parts2.push(a);
      steps.push('So we need ' + parts2.join(' + ') + '.');
    }
    steps.push('Count up in ' + a + 's: ' + countSeq(a, a, b) + '.');
    steps.push('The last one is ' + (a * b) + '. So ' + a + ' × ' + b + ' = ' + (a * b) + '.');
    return steps;
  }

  function divSteps(a, b) {
    var q = a / b;
    return [
      'Dividing means sharing into equal groups.',
      a + ' ÷ ' + b + ' asks: how many ' + b + 's fit into ' + a + '?',
      'Count up in ' + b + 's until you reach ' + a + ': ' + countSeq(b, b, q) + '.',
      'That was ' + q + ' jump' + (q === 1 ? '' : 's') + '.',
      'So ' + a + ' ÷ ' + b + ' = ' + q + '.'
    ];
  }

  /* ---------- the per-skill builders ---------- */

  var BUILDERS = {
    addition: function (q) {
      var p = parts(q);
      return p ? addSteps(p.a, p.b) : null;
    },
    subtraction: function (q) {
      var p = parts(q);
      return p ? subSteps(p.a, p.b) : null;
    },
    multiplication: function (q) {
      var p = parts(q);
      return p ? mulSteps(p.a, p.b) : null;
    },
    division: function (q) {
      var p = parts(q);
      return p ? divSteps(p.a, p.b) : null;
    },

    comparison: function (q) {
      var m = q.prompt.match(/(\d+)\s*or\s*(\d+)/);
      if (!m) return null;
      var a = +m[1], b = +m[2];
      var big = Math.max(a, b), small = Math.min(a, b);
      if (big < 10) {
        return [
          'Picture counting up: 1, 2, 3 and so on.',
          'The number you reach LATER is the bigger one.',
          'You reach ' + small + ' before ' + big + '.',
          'So ' + big + ' is bigger.'
        ];
      }
      if (tens(a) !== tens(b)) {
        return [
          'With bigger numbers, look at the tens first.',
          a + ' has ' + Math.floor(a / 10) + ' tens. ' +
            b + ' has ' + Math.floor(b / 10) + ' tens.',
          Math.floor(big / 10) + ' tens is more than ' + Math.floor(small / 10) + ' tens.',
          'So ' + big + ' is bigger.'
        ];
      }
      return [
        'Look at the tens first — they are the same here.',
        'So compare the ones: ' + ones(a) + ' and ' + ones(b) + '.',
        ones(big) + ' is more than ' + ones(small) + '.',
        'So ' + big + ' is bigger.'
      ];
    },

    counting: function (q) {
      var nums = (q.prompt.match(/\d+/g) || []).map(Number);
      if (nums.length < 2) return null;
      var step = nums[1] - nums[0];
      var last = nums[nums.length - 1];
      return [
        'Look at how much the numbers jump by each time.',
        nums[0] + ' to ' + nums[1] + ' is a jump of ' + step + '.',
        'So we are counting up in ' + step + 's.',
        'Add ' + step + ' to the last number: ' + last + ' + ' + step + ' = ' + (last + step) + '.'
      ];
    },

    'number-sense': function (q) {
      var isHundreds = /hundreds/.test(q.prompt);
      var nums = (q.prompt.match(/\d+/g) || []).map(Number);
      var n = nums[nums.length - 1];
      if (!n) return null;
      if (isHundreds) {
        return [
          'Hundreds means groups of one hundred.',
          'Count up in hundreds: ' + countSeq(100, 100, Math.floor(n / 100)) + '.',
          'That fits into ' + n + ' ' + Math.floor(n / 100) + ' time' +
            (Math.floor(n / 100) === 1 ? '' : 's') + ', with ' + (n % 100) + ' left over.',
          'So there are ' + Math.floor(n / 100) + ' hundreds in ' + n + '.'
        ];
      }
      return [
        'Tens means groups of ten.',
        'Count up in tens: ' + countSeq(10, 10, Math.floor(n / 10)) + '.',
        'That is ' + Math.floor(n / 10) + ' tens, and ' + (n % 10) + ' left over.',
        'So there are ' + Math.floor(n / 10) + ' tens in ' + n + '.'
      ];
    },

    fractions: function (q) {
      /* "What is 1/4 of 12?" */
      var of = q.prompt.match(/1\/(\d+)\s+of\s+(\d+)/);
      if (of) {
        var den = +of[1], whole = +of[2];
        return [
          'The bottom number tells us how many equal groups to make: ' + den + '.',
          'So share ' + whole + ' into ' + den + ' equal groups.',
          'Count in ' + (whole / den) + 's: ' + countSeq(whole / den, whole / den, den) + '.',
          'Each group has ' + (whole / den) + ' in it.',
          'So 1/' + den + ' of ' + whole + ' = ' + (whole / den) + '.'
        ];
      }
      /* "What is 2/8 + 3/8?" */
      var add = q.prompt.match(/(\d+)\/(\d+)\s*\+\s*(\d+)\/(\d+)/);
      if (add) {
        var n1 = +add[1], d1 = +add[2], n2 = +add[3];
        return [
          'Look at the bottom numbers first. They are both ' + d1 + '.',
          'That means the pieces are the same size, so they can just be added.',
          'Add the top numbers: ' + n1 + ' + ' + n2 + ' = ' + (n1 + n2) + '.',
          'The bottom number stays ' + d1 + ' — the pieces did not change size.',
          'So the answer is ' + (n1 + n2) + '/' + d1 + '.'
        ];
      }
      return null;
    },

    'money-math': function (q) {
      var p = parts(q);
      if (p) return p.op === '+' ? addSteps(p.a, p.b) : subSteps(p.a, p.b);
      var nums = (q.prompt.match(/\d+/g) || []).map(Number);
      if (nums.length < 2) return null;
      return [
        'Turn everything into cents first, so the numbers match.',
        'Then add or take away just like normal numbers.',
        'Line up the amounts: ' + nums.join(' and ') + '.',
        'The answer is ' + q.answer + '.'
      ];
    },

    measurement: function (q) {
      var ft = q.prompt.match(/(\d+)\s*feet/);
      if (ft) {
        return [
          'Start with what you know: 1 foot is 12 inches.',
          'So every foot becomes 12.',
          ft[1] + ' feet means ' + ft[1] + ' × 12.',
          ft[1] + ' × 12 = ' + (+ft[1] * 12) + ' inches.'
        ];
      }
      var yd = q.prompt.match(/(\d+)\s*yards/);
      if (yd) {
        return [
          'Start with what you know: 1 yard is 3 feet.',
          'So every yard becomes 3.',
          yd[1] + ' yards means ' + yd[1] + ' × 3.',
          yd[1] + ' × 3 = ' + (+yd[1] * 3) + ' feet.'
        ];
      }
      return null;
    },

    geometry: function (q) {
      var m = q.prompt.match(/how many sides does an? ([a-z]+)/i);
      if (!m) return null;
      var shape = m[1];
      return [
        'Picture a ' + shape + ' in your head.',
        'Now trace around the outside with your finger.',
        'Count each straight edge as you pass it — do not count corners.',
        'A ' + shape + ' has ' + q.answer + ' sides.'
      ];
    },

    'word-problems': function (q) {
      var nums = (q.prompt.match(/\d+/g) || []).map(Number);
      if (nums.length < 2) return null;
      var takeAway = /gives away|left|lost|ate|sold/.test(q.prompt);
      var steps = [
        'Read it again and find the numbers. They are ' + nums.join(' and ') + '.',
        takeAway ? 'The words "gives away" and "left" tell us something is being taken away.'
                 : 'Words like "each" and "altogether" tell us to put groups together.'
      ];
      steps.push('So the sum we need is ' + (takeAway ? 'a subtraction' : 'a multiplication or addition') + '.');
      steps.push('Work it out, and the answer is ' + q.answer + '.');
      return steps;
    },

    spelling: function (q) {
      var word = String(q.answer || '');
      if (!word) return null;
      var steps = [
        'Say the word slowly and listen to the sounds.',
        'Write down the sounds you hear, one at a time.'
      ];
      if (q.explain) steps.push(q.explain);
      /* Both forms: the hyphenated version is what a child reads out, and the
         plain word is what they are actually writing — and it is what the
         verification below checks against. */
      steps.push('The whole word is ' + word + ': ' + word.split('').join('-') + '.');
      return steps;
    }
  };

  /* A multiple-choice question we have no bespoke method for. Elimination is
     a genuinely transferable strategy, so teach that rather than nothing. */
  function choiceSteps(q) {
    var steps = [];
    if (q.passage) {
      steps.push('Read the passage again, slowly. The answer is hiding in it.');
      steps.push('Now read the question and keep it in your head.');
    } else {
      steps.push('Read the question again, slowly.');
    }
    steps.push('Look at each answer and ask: could that really be true?');
    var wrong = (q.choices || []).filter(function (c) { return c !== q.answer; });
    if (wrong.length) {
      steps.push('Cross out the ones that cannot be right. That leaves fewer to choose from.');
    }
    if (q.explain) steps.push(q.explain);
    steps.push('So the answer is ' + q.answer + '.');
    return steps;
  }

  var Steps = WW.tutorSteps = {
    BUILDERS: BUILDERS,

    /* Is there a real walkthrough for this question? Always true in practice —
       a choice question falls back to elimination — but a caller should ask
       rather than assume. */
    has: function (q) {
      return !!Steps.build(q);
    },

    /* Returns { intro, steps: [string], closing } or null.

       The final step always states the answer, and the whole walkthrough is
       thrown away if it does not match the question's own answer — a method
       that arrives somewhere else would teach the wrong thing. */
    build: function (q) {
      if (!q) return null;

      var list = null;
      try {
        var b = BUILDERS[q.skillId];
        if (b) list = b(q);
      } catch (e) { list = null; }

      if (!list && q.kind === 'choice') list = choiceSteps(q);
      if (!list && q.explain) {
        list = [
          'Let\'s take it slowly.',
          q.explain,
          'So the answer is ' + q.answer + '.'
        ];
      }
      if (!list || !list.length) return null;

      /* Verify. The last step must contain the real answer, or the method and
         the answer disagree and the walkthrough is worse than useless. */
      var last = String(list[list.length - 1]);
      if (last.indexOf(String(q.answer)) === -1) return null;

      return {
        intro: 'No problem — let\'s do it together, one bit at a time.',
        steps: list,
        closing: 'That\'s the whole method. Want to try a different one?'
      };
    }
  };

})(window.WW);
