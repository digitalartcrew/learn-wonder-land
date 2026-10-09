/* =============================================================
   WonderWorld — tutor/emotion.js
   Which face the TUTOR wears. Never a claim about the child.

   READ THIS FIRST
   ---------------
   This picks a pedagogical expression for an animated character
   based on what just happened in a lesson. It does NOT infer, model,
   score or store the child's emotional or mental state.

   It is allowed to know: an answer was right, an answer was wrong,
   the same thing has been missed twice, a question was asked, a
   lesson finished. From that it chooses what a good teacher's face
   would do.

   It is NOT allowed to conclude that a child is sad, frustrated,
   anxious, bored, inattentive, or anything resembling a trait or a
   condition. Those categories do not exist anywhere in this file and
   must not be added to it.

   THE ALLOW-LIST IS THE SECURITY BOUNDARY
   ---------------------------------------
   A model never returns animation code, CSS, or anything the
   renderer executes. It returns one word, and that word must already
   be in EMOTIONS or it is discarded and the deterministic answer is
   used instead. `WW.tutorAvatar` refuses anything not on its own
   list as well, so there are two independent checks.

   THE API CALL IS OPTIONAL
   ------------------------
   `decide()` resolves to a valid state even with no network, no
   server, no key and no provider. The deterministic rules below are
   the product; the Decisions API is a refinement on top, and if it
   is slow it is abandoned rather than waited for. A child should
   never watch a face buffer.
   ============================================================= */
(function (WW) {
  'use strict';

  /* The complete vocabulary a decision may return. */
  var EMOTIONS = [
    'happy',
    'excited',
    'encouraging',
    'curious',
    'celebrating',
    'gentle_correction',
    'thinking',
    'neutral'
  ];

  /* Interaction states we are willing to reason from. Anything else is an
     unknown and lands on 'neutral'. */
  var SIGNALS = [
    'answered_correctly',
    'answered_incorrectly',
    'repeated_incorrect',
    'asked_question',
    'lesson_started',
    'lesson_completed',
    'skill_mastered',
    'assessment_completed',
    'processing',
    'idle'
  ];

  /* How long we are prepared to wait for a nicer answer before shrugging and
     using the one we already have. */
  var TIMEOUT_MS = 1200;

  var ENDPOINT = '/api/tutor-emotion';

  function isValid(state) { return EMOTIONS.indexOf(state) !== -1; }

  var Emotion = WW.tutorEmotion = {
    EMOTIONS: EMOTIONS,
    SIGNALS: SIGNALS,
    TIMEOUT_MS: TIMEOUT_MS,
    ENDPOINT: ENDPOINT,

    /* Turned on only once a server endpoint actually exists. Off means the
       deterministic path is the only path, which is a perfectly good product. */
    useDecisionsAPI: false,

    isValid: isValid,

    /* ---------- the deterministic rules ----------
       These ARE the behaviour. Everything else is optional polish. */
    fallback: function (ctx) {
      ctx = ctx || {};
      var signal = ctx.signal;

      switch (signal) {
        case 'skill_mastered':
        case 'assessment_completed':
          return 'celebrating';

        case 'lesson_completed':
          return ctx.mastered ? 'celebrating' : 'encouraging';

        case 'answered_correctly':
          /* A run of right answers earns more than a polite smile. */
          return (ctx.streak && ctx.streak >= 3) ? 'excited' : 'happy';

        case 'repeated_incorrect':
          /* The one place a different face genuinely matters: keep it warm
             and slow down, never disappointed. */
          return 'gentle_correction';

        case 'answered_incorrectly':
          return 'encouraging';

        case 'asked_question':
          return 'curious';

        case 'lesson_started':
          return 'happy';

        case 'processing':
          return 'thinking';

        case 'idle':
          return 'neutral';

        default:
          return 'neutral';
      }
    },

    /* The public call. Always resolves, always to a valid state.

       The deterministic answer is computed FIRST and is what resolves if the
       network is missing, slow, disabled, or returns something we do not
       recognize. */
    decide: function (ctx) {
      ctx = ctx || {};
      var safe = Emotion.fallback(ctx);

      var settle = function (v) {
        return window.Promise ? Promise.resolve(v)
                              : { then: function (f) { f(v); return this; } };
      };

      if (!Emotion.useDecisionsAPI || !window.fetch || !window.Promise) {
        return settle(safe);
      }

      /* Only the interaction shape goes over the wire. No question text, no
         answer text, no nickname, nothing about who is playing. */
      var body = {
        signal: SIGNALS.indexOf(ctx.signal) !== -1 ? ctx.signal : 'idle',
        streak: Number(ctx.streak) || 0,
        consecutiveWrong: Number(ctx.consecutiveWrong) || 0,
        mastered: !!ctx.mastered,
        allowed: EMOTIONS
      };

      return new Promise(function (resolve) {
        var done = false;
        var finish = function (v) {
          if (done) return;
          done = true;
          resolve(isValid(v) ? v : safe);
        };

        /* Hard deadline. A face is not worth a stall. */
        setTimeout(function () { finish(safe); }, TIMEOUT_MS);

        try {
          window.fetch(ENDPOINT, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(body)
          }).then(function (r) {
            return r && r.ok ? r.json() : null;
          }).then(function (data) {
            if (WW.learningProfile) WW.learningProfile.countUsage('decision');
            finish(data && data.expression);
          })['catch'](function () { finish(safe); });
        } catch (e) {
          finish(safe);
        }
      });
    },

    /* Synchronous answer, for the many places that just need a face now and
       have no reason to involve a server at all. */
    now: function (ctx) { return Emotion.fallback(ctx); }
  };

})(window.WW);
