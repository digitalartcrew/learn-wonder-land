/* =============================================================
   WonderWorld — tutor/provider.js
   Where tutor language comes from, and what happens when it doesn't.

   THE SHAPE IS THE SAME AS BILLING
   --------------------------------
   Game code calls `WW.tutorProvider.generate()` and never a model
   SDK. Providers are swappable, and none of them is allowed to hold
   a key: the only network path is a first-party endpoint on our own
   origin. There is no OpenAI SDK in the browser, no key in client
   code, and no way to add one without changing this file and the
   Cloudflare Function behind it.

   TWO PROVIDERS
   -------------
     offline   The lesson bank in tutor/content.js. Always available,
               costs nothing, works on a plane. This is the default
               and the floor — not a degraded mode.
     server    POST /api/tutor. Better explanations, novel phrasing,
               and answers to questions we have no canned reply for.
               Optional, in every sense.

   WHY `offline` IS THE DEFAULT
   ----------------------------
   Calling a model to produce "What is 7 × 6?" would be slower,
   less reliable and vastly more expensive than four lines of
   JavaScript. The provider is asked only for the things it is
   actually better at — see `WORTH_ASKING` below. Everything else
   never leaves the device. That single decision is most of the cost
   model in docs/TUTOR_PRICING.md.

   FAILING
   -------
   Every failure path — offline, no endpoint, HTTP error, timeout,
   malformed JSON, unsafe output — resolves to a usable offline
   result. `generate()` does not reject. A model being down is not a
   reason a child cannot have a lesson.

   After repeated failures the server provider trips a breaker and
   stops being tried for a while, so a broken deploy costs one slow
   request rather than one per turn.
   ============================================================= */
(function (WW) {
  'use strict';

  var ENDPOINT = '/api/tutor';
  var TIMEOUT_MS = 8000;

  /* Trip after this many consecutive failures, and stay tripped this long. */
  var FAIL_LIMIT = 2;
  var COOLDOWN_MS = 60000;

  /* The intents a model handles. Everything NOT on this list — generating a
     question, scoring an answer, computing mastery, choosing the next skill —
     stays deterministic, because those are things a computer is actually good
     at and a model would be slower and less reliable at.

     This list used to be narrower: lessons only went to a model for four
     "prose" skills and everything else got a canned sentence. That was a cost
     decision made before the cost was measured, and the measurement killed it
     — a model-written lesson costs about 0.011 cents, so restricting them was
     saving roughly two cents a month per subscriber at the price of the tutor
     sounding like a worksheet. See docs/TUTOR_PRICING.md. */
  var WORTH_ASKING = ['answer', 'explain_again', 'lesson', 'encourage'];

  function settled(v) {
    return window.Promise ? Promise.resolve(v)
                          : { then: function (f) { f(v); return this; } };
  }

  function result(ok, text, source, reason) {
    return { ok: !!ok, text: text || '', source: source, reason: reason || null };
  }

  /* ===========================================================
     OFFLINE — the floor
     =========================================================== */
  var offline = {
    name: 'offline',
    isAvailable: function () { return true; },

    generate: function (intent, ctx) {
      var C = WW.tutorContent;
      ctx = ctx || {};

      if (intent === 'lesson' && C && ctx.skillId) {
        var l = C.lesson(ctx.skillId, ctx.level || 0);
        return settled(result(true, l.body, 'offline'));
      }

      if (intent === 'explain_again' && C && ctx.skillId) {
        /* A second explanation we actually have, rather than a reworded
           first one. The bank's worked example is the useful thing here. */
        var q = C.question(ctx.skillId, Math.max(0, (ctx.level || 0) - 1));
        if (q && q.explain) {
          return settled(result(true, 'Let\'s look at it another way. ' + q.explain, 'offline'));
        }
        return settled(result(true,
          'Let\'s try a slightly easier one first, then come back to this.', 'offline'));
      }

      if (intent === 'answer') {
        /* Answer it properly. WW.tutorAnswers works out arithmetic, spells
           words it actually knows, defines terms from the glossary, and
           explains the concepts the lesson bank already covers — all without
           a network. When it genuinely cannot, it says so and offers a lesson
           rather than guessing.

           This used to be a flat apology that looked something up for nobody,
           which made the whole Ask box useless in the default no-key state. */
        var A = WW.tutorAnswers;
        if (A && ctx.question) {
          var a = A.answer(ctx.question);
          /* `ok: false` still carries usable copy — an honest non-answer that
             offers something. Report it as a result either way so the UI can
             show it; `reason` records which it was. */
          return settled(result(a.ok, a.text, 'offline',
            a.ok ? null : 'no_offline_answer'));
        }
        return settled(result(false,
          'Ask me anything about what we\'re learning!', 'offline', 'no_question'));
      }

      return settled(result(false, '', 'offline', 'unsupported_intent'));
    }
  };

  /* ===========================================================
     SERVER — first-party endpoint, no key in the browser
     =========================================================== */
  var server = {
    name: 'server',

    _fails: 0,
    _openedAt: 0,

    /* Set false to switch the model off entirely without a deploy. */
    enabled: true,

    isAvailable: function () {
      if (!server.enabled) return false;
      if (!window.fetch || !window.Promise) return false;
      try { if (navigator && navigator.onLine === false) return false; } catch (e) {}
      /* breaker open? */
      if (server._fails >= FAIL_LIMIT) {
        if (Date.now() - server._openedAt < COOLDOWN_MS) return false;
        server._fails = 0;                  /* cooled down — allow one probe */
      }
      return true;
    },

    _trip: function () {
      server._fails++;
      if (server._fails >= FAIL_LIMIT) server._openedAt = Date.now();
    },

    generate: function (intent, ctx) {
      if (!server.isAvailable()) return settled(result(false, '', 'server', 'unavailable'));

      /* Last gate before anything leaves the device. */
      var scrub = WW.tutorSafety ? WW.tutorSafety.scrubOutbound(ctx) : { ok: true };
      if (!scrub.ok) {
        return settled(result(false, '', 'server', 'blocked:' + scrub.reason));
      }

      return new Promise(function (resolve) {
        var done = false;
        var finish = function (r) { if (!done) { done = true; resolve(r); } };

        var timer = setTimeout(function () {
          server._trip();
          finish(result(false, '', 'server', 'timeout'));
        }, TIMEOUT_MS);

        try {
          window.fetch(ENDPOINT, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ intent: intent, context: ctx })
          }).then(function (r) {
            if (!r || !r.ok) throw new Error('http');
            return r.json();
          }).then(function (data) {
            clearTimeout(timer);
            if (!data || !data.ok || !data.text) throw new Error('shape');

            /* The model's words are inspected exactly like anyone else's. */
            var checked = WW.tutorSafety
              ? WW.tutorSafety.inspectOutput(data.text)
              : { ok: true, text: data.text };

            if (!checked.ok) {
              /* Not a transport failure, so the breaker stays shut — but the
                 child never sees it. */
              if (WW.events) WW.events.track('activity_completed', { kind: 'tutor_blocked' });
              finish(result(false, '', 'server', 'unsafe:' + checked.reason));
              return;
            }

            server._fails = 0;
            if (WW.learningProfile) {
              WW.learningProfile.countUsage('ai', data.tokensIn, data.tokensOut);
            }
            finish(result(true, checked.text, 'server'));
          })['catch'](function () {
            clearTimeout(timer);
            server._trip();
            finish(result(false, '', 'server', 'error'));
          });
        } catch (e) {
          clearTimeout(timer);
          server._trip();
          finish(result(false, '', 'server', 'error'));
        }
      });
    }
  };

  var Provider = WW.tutorProvider = {
    ENDPOINT: ENDPOINT,
    WORTH_ASKING: WORTH_ASKING,
    providers: { offline: offline, server: server },

    _name: null,

    /* Is a model reachable at all right now? */
    aiAvailable: function () { return server.isAvailable(); },

    use: function (name) {
      if (!Provider.providers[name]) return null;
      Provider._name = name;
      return Provider.providers[name];
    },

    /* Should this intent cost a model call?

       Every teaching intent does. A child gets a lesson written for them, at
       their level, about the thing they are actually stuck on — not a lookup
       from a table of nine canned paragraphs. The offline bank is still there
       underneath for when the network is not. */
    shouldAsk: function (intent) {
      return WORTH_ASKING.indexOf(intent) !== -1;
    },

    /* The one call the rest of the tutor makes.

       Tries the server when the intent is worth it and it is reachable, and
       falls back to the bank for everything else and every failure. Always
       resolves; never rejects. */
    generate: function (intent, ctx) {
      ctx = ctx || {};

      if (Provider._name === 'offline') return offline.generate(intent, ctx);

      if (!Provider.shouldAsk(intent) || !server.isAvailable()) {
        if (WW.learningProfile && Provider.shouldAsk(intent)) {
          WW.learningProfile.countUsage('offline');
        }
        return offline.generate(intent, ctx);
      }

      return server.generate(intent, ctx).then(function (r) {
        if (r.ok) return r;
        if (WW.learningProfile) WW.learningProfile.countUsage('offline');
        return offline.generate(intent, ctx).then(function (f) {
          /* Carry the reason through so the UI can say something true about
             why the tutor is quieter than usual. */
          f.reason = f.reason || r.reason;
          return f;
        });
      });
    },

    /* For the development panel and the tests. */
    describe: function () {
      return {
        aiAvailable: server.isAvailable(),
        enabled: server.enabled,
        fails: server._fails,
        endpoint: ENDPOINT
      };
    }
  };

})(window.WW);
