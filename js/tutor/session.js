/* =============================================================
   WonderWorld — tutor/session.js
   One lesson, from hello to well done.

   THE SHAPE OF A LESSON
   ---------------------
     LESSON    three or four sentences. Not a lecture.
     PRACTICE  2–4 questions WITH help. Getting one wrong here is
               part of learning, so the tutor explains and the child
               tries again.
     CHECK     2–3 questions WITHOUT help. This is the evidence.
     VERDICT   mastered → celebrate, reward, advance.
               not yet  → explain it a different way and go again.

   Practice and check are different on purpose. A child who needs
   three goes at a practice question has still learned it; a child
   who needs three goes at a check question has not shown it yet.
   Only the check counts towards mastery.

   NEVER SHAME
   -----------
   There is no "wrong again", no "that's easy", no streak the child
   can break. A missed answer gets "Almost! Let's look at it another
   way." and a different explanation. The copy in this file is part
   of the product, not decoration.

   ASKING AT ANY POINT
   -------------------
   `ask()` works in every state. A child who wants to know why 8 × 4
   is 32 in the middle of a spelling lesson gets an answer, and the
   lesson is still there afterwards.

   EVERYTHING DEGRADES
   -------------------
   No network, no model, no speech: the lesson still runs, because
   the questions and the explanations come from the offline bank and
   the scoring is arithmetic. See tutor/provider.js.
   ============================================================= */
(function (WW) {
  'use strict';

  var T = WW.tutorTaxonomy;
  var Profile = WW.learningProfile;
  var Content = WW.tutorContent;
  var Provider = WW.tutorProvider;
  var Safety = WW.tutorSafety;

  var PRACTICE_N = 3;
  var CHECK_N = 3;

  /* Fraction of check questions needed to call a skill mastered this lesson. */
  var CHECK_PASS = 2 / 3;

  /* Two misses on the same practice question and we make it easier rather
     than letting a child grind. */
  var RETRY_LIMIT = 2;

  function settled(v) {
    return window.Promise ? Promise.resolve(v)
                          : { then: function (f) { f(v); return this; } };
  }

  var Session = WW.tutorSession = {
    PRACTICE_N: PRACTICE_N,
    CHECK_N: CHECK_N,
    CHECK_PASS: CHECK_PASS,

    /* idle | lesson | practice | check | verdict */
    state: 'idle',

    skillId: null,
    level: 0,
    reason: null,
    ref: null,

    _q: null,
    _retries: 0,
    _practiceDone: 0,
    _checkDone: 0,
    _checkRight: 0,
    _consecutiveWrong: 0,

    /* The current lesson's exchange, so the tutor can refer back to what was
       just said instead of starting cold every turn. In memory only — never
       written to storage, cleared when the lesson ends, and trimmed by
       tutorSafety before any of it is transmitted. */
    _turns: [],

    isRunning: function () { return Session.state !== 'idle'; },

    /* Record a line of the current exchange. */
    remember: function (who, text) {
      if (!text) return;
      Session._turns.push({ who: who, text: String(text) });
      /* Hard cap well above what is ever sent, so the array cannot grow
         without bound during a long lesson. */
      while (Session._turns.length > 20) Session._turns.shift();
    },

    /* Everything a request needs about where we are. One place, so no caller
       can forget the history or the game context. */
    _context: function (intent, extra) {
      var o = {
        skillId: Session.skillId,
        level: Session.level,
        intent: intent,
        sessionRef: Session.ref,
        recentTurns: Session._turns,
        worldsPlayed: Session._worldsPlayed()
      };
      Object.keys(extra || {}).forEach(function (k) { o[k] = extra[k]; });
      return WW.tutorSafety ? WW.tutorSafety.buildContext(o) : o;
    },

    /* ---------- starting ---------- */

    /* choice: { skillId, level, reason } from WW.tutor.nextSkill(), or the
       child's own pick. Resolves with the opening lesson step. */
    start: function (choice) {
      if (!choice || !choice.skillId) return settled(null);

      Session.state = 'lesson';
      Session.skillId = choice.skillId;
      Session.level = choice.level === undefined || choice.level === null
        ? Profile.level(choice.skillId) : choice.level;
      Session.reason = choice.reason || 'new';
      Session.ref = Safety ? Safety.newSessionRef() : null;

      Session._q = null;
      Session._retries = 0;
      Session._practiceDone = 0;
      Session._checkDone = 0;
      Session._checkRight = 0;
      Session._consecutiveWrong = 0;
      Session._turns = [];

      var d = Profile.data();
      d.sessions++;
      d.lastSessionAt = Date.now();
      Profile.save();

      if (WW.events) {
        WW.events.track('activity_started', { kind: 'tutor_lesson', feature: choice.skillId });
      }

      return Provider.generate('lesson', Session._context('lesson', {
        reason: Session.reason
      })).then(function (r) {
        var body = r.ok ? r.text : Content.lesson(Session.skillId, Session.level).body;
        var checked = Safety ? Safety.inspectOutput(body) : { ok: true, text: body };
        var def = T.skill(Session.skillId);
        var text = checked.ok ? checked.text
                              : Content.lesson(Session.skillId, Session.level).body;

        Session.remember('tutor', text);

        return {
          step: 'lesson',
          skillId: Session.skillId,
          title: def ? def.name : Session.skillId,
          text: text,
          expression: 'happy',
          source: r.source
        };
      });
    },

    /* Names only — never the save file. */
    _worldsPlayed: function () {
      try {
        var w = WW.State && WW.State.data && WW.State.data.worlds;
        if (!w) return [];
        return Object.keys(w).filter(function (id) {
          return (w[id].correct || 0) + (w[id].wrong || 0) > 0;
        });
      } catch (e) { return []; }
    },

    /* ---------- moving through the lesson ---------- */

    /* The next thing to put on screen. Returns a question step, or the
       verdict when the check is done. */
    next: function () {
      if (Session.state === 'lesson') {
        Session.state = 'practice';
        return Session._question('practice');
      }
      if (Session.state === 'practice') {
        if (Session._practiceDone >= PRACTICE_N) {
          Session.state = 'check';
          return Session._question('check');
        }
        return Session._question('practice');
      }
      if (Session.state === 'check') {
        if (Session._checkDone >= CHECK_N) return Session._verdict();
        return Session._question('check');
      }
      return null;
    },

    _question: function (phase) {
      var q = Content.question(Session.skillId, Session.level);
      if (!q) {
        /* Nothing at this level — end kindly rather than loop. */
        return Session._verdict();
      }
      Session._q = q;
      Session._retries = 0;
      return {
        step: phase,
        skillId: Session.skillId,
        question: q,
        /* The check is where the child is on their own, and saying so is
           fairer than pretending it is more practice. */
        lead: phase === 'check'
          ? (Session._checkDone === 0 ? 'Now let\'s see what you remember. No hints this time!' : null)
          : null,
        expression: phase === 'check' ? 'curious' : 'happy',
        index: phase === 'check' ? Session._checkDone : Session._practiceDone,
        total: phase === 'check' ? CHECK_N : PRACTICE_N
      };
    },

    /* The child answered. Scored locally, always. */
    answer: function (given) {
      if (!Session._q) return settled(null);
      var q = Session._q;
      var correct = Content.check(q, given);
      var phase = Session.state;

      /* Practice answers teach the profile too, but the check is the
         evidence that moves a level. */
      Profile.recordAnswer(Session.skillId, correct, { assessment: false });

      if (correct) Session._consecutiveWrong = 0;
      else Session._consecutiveWrong++;

      if (phase === 'check') {
        Session._checkDone++;
        if (correct) Session._checkRight++;
        Session._q = null;
        return settled({
          step: 'result',
          correct: correct,
          /* No explanation during the check — that is what makes it a check.
             No walkthrough either: `question` is deliberately absent, so the
             UI cannot offer "Show me how" here. The explanation comes in the
             verdict, once the evidence is already taken. */
          text: correct ? Session._praise() : 'Thanks! Let\'s keep going.',
          expression: correct ? 'happy' : 'neutral',
          answer: null
        });
      }

      /* --- practice --- */
      if (correct) {
        Session._practiceDone++;
        Session._q = null;
        if (WW.tutor) WW.tutor.rewardPractice();
        return settled({
          step: 'result',
          correct: true,
          text: Session._praise(),
          explain: q.explain || null,
          expression: Session._consecutiveWrong === 0 ? 'happy' : 'excited'
        });
      }

      Session._retries++;

      /* Two misses: make it easier, and say something kind about why. */
      if (Session._retries >= RETRY_LIMIT) {
        Session._practiceDone++;
        Session._q = null;
        var stepped = false;
        var range = T.levelRange(Session.skillId);
        if (Session.level > range[0]) { Session.level--; stepped = true; }

        Session.remember('child', 'I got that wrong twice.');

        return Provider.generate('explain_again', Session._context('explain_again', {
          stuck: true,
          missedPrompt: q.prompt,
          correctAnswer: q.answer
        })).then(function (r) {
          var text = r.ok ? r.text : (q.explain || 'Let\'s look at it another way.');
          var checked = Safety ? Safety.inspectOutput(text) : { ok: true, text: text };
          Session.remember('tutor', checked.ok ? checked.text : text);
          return {
            step: 'result',
            correct: false,
            /* Never "wrong again". */
            text: 'Almost! Let\'s look at it another way.',
            explain: checked.ok ? checked.text : (q.explain || null),
            answer: q.answer,
            steppedDown: stepped,
            /* Carried so the UI can offer a step-by-step walkthrough of the
               problem they actually missed. PRACTICE ONLY — see below. */
            question: q,
            expression: 'gentle_correction'
          };
        });
      }

      /* First miss: encourage and let them try the same one again. */
      return settled({
        step: 'retry',
        correct: false,
        text: 'Not quite — have another go. You\'re close!',
        hint: q.explain ? null : undefined,
        expression: 'encouraging'
      });
    },

    _praise: function () {
      var lines = ['Nice one!', 'That\'s it!', 'Exactly right.', 'Well done!', 'Yes — great thinking.'];
      return lines[Math.floor(Math.random() * lines.length)];
    },

    /* ---------- the verdict ---------- */
    _verdict: function () {
      var answered = Session._checkDone;
      var ratio = answered ? Session._checkRight / answered : 0;
      var mastered = answered > 0 && ratio >= CHECK_PASS;

      Profile.completeLesson(Session.skillId, mastered);
      var paid = WW.tutor
        ? WW.tutor.rewardLesson(Session.skillId, answered, mastered)
        : { xp: 0, gems: 0 };

      var def = T.skill(Session.skillId);
      var name = def ? def.name.toLowerCase() : 'that';

      Session.state = 'verdict';

      if (WW.events) {
        WW.events.track('activity_completed', {
          kind: 'tutor_lesson', feature: Session.skillId, result: mastered ? 'mastered' : 'practicing'
        });
      }

      return {
        step: 'verdict',
        mastered: mastered,
        skillId: Session.skillId,
        correct: Session._checkRight,
        total: answered,
        xp: paid.xp,
        gems: paid.gems,
        text: mastered
          ? 'You\'ve got ' + name + '! That was really solid work.'
          : 'Good effort — ' + name + ' is coming along. We\'ll come back to it soon.',
        expression: mastered ? 'celebrating' : 'encouraging'
      };
    },

    end: function () {
      Session.state = 'idle';
      Session.skillId = null;
      Session._q = null;
      /* The exchange does not outlive the lesson. */
      Session._turns = [];
      if (WW.tutorVoice) WW.tutorVoice.stop();
    },

    /* ---------- asking, at any point ---------- */

    /* The child typed a question. Screened before it goes anywhere, answered
       at their level, and short. Resolves with something safe to display
       whatever happens. */
    ask: function (text) {
      var checked = Safety ? Safety.inspectInput(text)
                           : { ok: true, text: String(text || '') };

      if (!checked.ok) {
        /* PII or off-topic: handled entirely on the device. The child's words
           are not transmitted, and we do not explain in a way that teaches
           them to work around it. */
        if (WW.events) WW.events.track('premium_content_viewed', { kind: 'tutor_redirect' });
        return settled({
          step: 'answer',
          text: checked.reply || Safety.REDIRECT,
          expression: 'encouraging',
          source: 'local',
          blocked: checked.reason
        });
      }

      if (WW.events) WW.events.track('activity_started', { kind: 'tutor_question' });

      Session.remember('child', checked.text);

      return Provider.generate('answer', Session._context('answer', {
        question: checked.text
      })).then(function (r) {
        /* The screening verdict wins, whatever the provider said. An earlier
           version fell back to `r.text` when `r.ok` was false — which meant a
           result that FAILED screening was displayed, because failing
           screening also makes r.ok false. The two are different questions:
           `r.ok` is "did we find an answer", `out.ok` is "is it safe to show". */
        var out = Safety ? Safety.inspectOutput(r.text) : { ok: true, text: r.text };
        var text = out.ok ? (out.text || Safety.REDIRECT) : Safety.REDIRECT;
        Session.remember('tutor', text);
        return {
          step: 'answer',
          text: text,
          expression: 'curious',
          source: r.source,
          offline: !r.ok
        };
      });
    }
  };

})(window.WW);
