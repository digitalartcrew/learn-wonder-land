/* =============================================================
   WonderWorld — tutor/safety.js
   The rules WonderTutor cannot talk its way around.

   THREE JOBS
   ----------
   1. NOTHING IDENTIFYING LEAVES THE DEVICE. The context sent to a
      model is built by allow-list, so a field added carelessly
      somewhere else cannot ride along. The child's nickname, the
      parent's email, the avatar, the save file and anything
      location-shaped are all absent by construction, not by
      remembering to strip them.

   2. THE CHILD'S OWN WORDS ARE CHECKED BEFORE THEY GO ANYWHERE.
      Children volunteer their full name and their school without
      being asked. If the question contains something personal we
      do not send it — we answer locally and gently move on.

   3. THE TUTOR'S WORDS ARE CHECKED BEFORE THE CHILD SEES THEM. A
      model that asks "what school do you go to?" has failed, and
      no prompt is strong enough to rely on alone. Output that
      breaks a rule is replaced, not shown.

   WHAT WONDERTUTOR IS
   -------------------
   "Your WonderWorld learning guide." Not a person, not a friend,
   not a counsellor, not a stand-in for a parent. Output claiming
   otherwise is rejected by `inspectOutput` below.

   This is a belt-and-braces layer. The server prompt says the same
   things; this file is what happens when the prompt is ignored.
   ============================================================= */
(function (WW) {
  'use strict';

  /* ---------- patterns that mean "personal information" ---------- */
  var EMAIL = /[^\s@]+@[^\s@]+\.[a-z]{2,}/i;
  var PHONE = /(?:\+?\d[\d\s().-]{7,}\d)/;
  var URL = /\b(?:https?:\/\/|www\.)\S+/i;
  var STREET = /\b\d{1,5}\s+[a-z]+\s+(street|st|road|rd|avenue|ave|lane|ln|drive|dr|way|court|ct|boulevard|blvd)\b/i;
  var POSTCODE = /\b\d{5}(?:-\d{4})?\b/;

  /* Things a child might say that we must not forward to a model. */
  var CHILD_PII = [
    { re: EMAIL, kind: 'email' },
    { re: PHONE, kind: 'phone' },
    { re: URL, kind: 'link' },
    { re: STREET, kind: 'address' },
    { re: POSTCODE, kind: 'postcode' },
    { re: /\bi live (at|on|in)\b/i, kind: 'address' },
    { re: /\bmy (address|phone number|email|password)\b/i, kind: 'contact' },
    { re: /\bmy school is\b|\bi go to .{0,30}(school|academy|elementary)\b/i, kind: 'school' },
    { re: /\bmy (full|last|real) name\b/i, kind: 'name' }
  ];

  /* Things the tutor must never say. Each one is a hard failure. */
  var FORBIDDEN_OUTPUT = [
    { re: /what(?:'s| is) your (full |real |last )?name/i, why: 'asks_name' },
    { re: /where do you live|what(?:'s| is) your address/i, why: 'asks_address' },
    { re: /what school do you (go to|attend)|name of your school/i, why: 'asks_school' },
    { re: /your (phone|mobile) number|what(?:'s| is) your email/i, why: 'asks_contact' },
    { re: /how old are you|what(?:'s| is) your (birthday|date of birth)/i, why: 'asks_age' },
    { re: /don'?t tell (your )?(mum|mom|dad|parents|grown-?ups?)/i, why: 'secrecy' },
    { re: /\b(our|a) (little )?secret\b/i, why: 'secrecy' },
    { re: /\bi(?:'m| am) (a )?(real|human|person)\b/i, why: 'claims_human' },
    { re: /\b(i(?:'m| am) your|your) best friend\b/i, why: 'claims_friend' },
    { re: /\b(diagnos|therapy|therapist|counsell?or|medication)\w*/i, why: 'clinical' },
    { re: /\b(dyslexi|adhd|autis|disorder|disabilit)\w*/i, why: 'clinical' },
    { re: URL, why: 'external_link' },
    { re: EMAIL, why: 'contact_detail' }
  ];

  /* Shapes of question that are not what a tutor is for. Redirected kindly
     rather than refused coldly — a child asking something odd is a child,
     not an attacker. */
  var OFF_TOPIC = [
    /\b(kill|die|gun|weapon|blood|sex|drunk|drug)\w*/i,
    /\b(buy|purchase|subscribe|credit card|password)\b/i,
    /\byour (creator|developer|prompt|instructions|system)\b/i,
    /\bignore (all |your |previous )?(instructions|rules)\b/i
  ];

  /* How much of the current lesson may be carried into the next request.
     Deliberately small: enough for continuity, nowhere near a transcript. */
  var MAX_HISTORY_TURNS = 6;
  var MAX_HISTORY_CHARS = 700;

  var REDIRECT =
    'I\'m here to help you learn! Let\'s get back to that — ' +
    'would you like to try a question?';

  var PII_REPLY =
    'Let\'s keep things like names, addresses and phone numbers private — ' +
    'even with me. Ask me about something you\'re learning instead!';

  var Safety = WW.tutorSafety = {
    MAX_HISTORY_TURNS: MAX_HISTORY_TURNS,
    MAX_HISTORY_CHARS: MAX_HISTORY_CHARS,
    IDENTITY: 'Your WonderWorld learning guide',
    REDIRECT: REDIRECT,
    PII_REPLY: PII_REPLY,
    FORBIDDEN_OUTPUT: FORBIDDEN_OUTPUT,

    /* ---------- outbound context ----------
       An allow-list, so the only way to send a new field is to add it here
       on purpose. Everything about who the child IS is absent: no nickname,
       no avatar, no email, no save, no device id, no location.

       `sessionRef` is an opaque random string regenerated each session. It
       lets a server tie two turns of one conversation together and nothing
       else — it is not stored, not reused, and maps to no person. */
    buildContext: function (opts) {
      opts = opts || {};
      var P = WW.learningProfile;
      var T = WW.tutorTaxonomy;
      var grade = P ? P.grade() : null;

      var ctx = {
        /* what to teach */
        grade: grade === null ? null : Number(grade),
        language: P ? P.language() : 'en',
        skillId: opts.skillId || null,
        skillName: null,
        level: opts.level === undefined ? null : Number(opts.level),
        band: null,

        /* how it is going, as counts only */
        recentCorrect: opts.recentCorrect === undefined ? null : Number(opts.recentCorrect),
        recentAttempted: opts.recentAttempted === undefined ? null : Number(opts.recentAttempted),
        stuck: !!opts.stuck,

        /* why we are talking */
        intent: opts.intent || 'lesson',      /* lesson | answer | practice */

        /* one short, already-screened question from the child */
        question: null,

        /* game context, named worlds only — never the save */
        worldsPlayed: Array.isArray(opts.worldsPlayed) ? opts.worldsPlayed.slice(0, 6) : [],

        /* A SHORT rolling window of the current lesson, so the tutor can say
           "like we did a moment ago" instead of starting from nothing every
           turn. Bounded hard on both axes: a transcript is not a thing we want
           to accumulate about a child, and an unbounded history would also
           make input tokens grow with session length. Each line is screened
           again here — a turn that was safe to display is not automatically
           safe to re-transmit. */
        recentTurns: [],

        sessionRef: opts.sessionRef || null
      };

      if (Array.isArray(opts.recentTurns)) {
        var budget = MAX_HISTORY_CHARS;
        /* newest first, so if the budget runs out it is the OLDEST that is lost */
        opts.recentTurns.slice(-MAX_HISTORY_TURNS).reverse().forEach(function (t) {
          if (!t || !t.text) return;
          var who = t.who === 'child' ? 'child' : 'tutor';
          var line = String(t.text).slice(0, 160);

          /* A child's line gets the same screening it got on the way in. */
          if (who === 'child' && !Safety.inspectInput(line).ok) return;
          if (who === 'tutor' && !Safety.inspectOutput(line).ok) return;

          if (line.length > budget) return;
          budget -= line.length;
          ctx.recentTurns.unshift({ who: who, text: line });
        });
      }

      if (ctx.skillId && T) {
        var def = T.skill(ctx.skillId);
        if (def) ctx.skillName = def.name;
        if (grade !== null && ctx.level !== null) ctx.band = T.band(ctx.level, grade);
      }

      if (opts.question) {
        var checked = Safety.inspectInput(opts.question);
        ctx.question = checked.ok ? checked.text : null;
      }

      return ctx;
    },

    /* A final sweep over anything about to be transmitted. Cheap insurance
       against a future caller building a context by hand. */
    scrubOutbound: function (obj) {
      var json = JSON.stringify(obj || {});
      var bad = null;
      if (EMAIL.test(json)) bad = 'email';
      else if (PHONE.test(json)) bad = 'phone';
      else if (STREET.test(json)) bad = 'address';
      /* A nickname is not pattern-matchable, so check it directly. */
      try {
        var nick = WW.State && WW.State.data && WW.State.data.player &&
                   WW.State.data.player.name;
        if (nick && String(nick).length > 2 &&
            json.toLowerCase().indexOf(String(nick).toLowerCase()) !== -1) bad = 'nickname';
      } catch (e) { /* no state */ }
      return { ok: !bad, reason: bad };
    },

    /* ---------- the child's input ---------- */
    inspectInput: function (text) {
      var s = String(text == null ? '' : text).trim();
      if (!s) return { ok: false, reason: 'empty', reply: null, text: '' };
      if (s.length > 300) s = s.slice(0, 300);

      for (var i = 0; i < CHILD_PII.length; i++) {
        if (CHILD_PII[i].re.test(s)) {
          return { ok: false, reason: 'pii:' + CHILD_PII[i].kind, reply: PII_REPLY, text: '' };
        }
      }
      for (var j = 0; j < OFF_TOPIC.length; j++) {
        if (OFF_TOPIC[j].test(s)) {
          return { ok: false, reason: 'off_topic', reply: REDIRECT, text: '' };
        }
      }
      return { ok: true, reason: null, reply: null, text: s };
    },

    /* ---------- the tutor's output ----------
       Runs on EVERY tutor line, whether it came from a model or from the
       offline bank. A rule that only applies to one source is a rule with a
       hole in it. */
    inspectOutput: function (text) {
      var s = String(text == null ? '' : text);
      if (!s.trim()) return { ok: false, reason: 'empty', text: REDIRECT };

      for (var i = 0; i < FORBIDDEN_OUTPUT.length; i++) {
        if (FORBIDDEN_OUTPUT[i].re.test(s)) {
          return { ok: false, reason: FORBIDDEN_OUTPUT[i].why, text: REDIRECT };
        }
      }
      /* Long walls of text are a pedagogical failure for this age, so they
         are trimmed rather than rejected. */
      if (s.length > 700) s = s.slice(0, 700).replace(/\s+\S*$/, '') + '…';
      return { ok: true, reason: null, text: s };
    },

    /* Does this look like a request for personal information, whoever said
       it? Used by tests and by the server-side mirror of these rules. */
    asksForPII: function (text) {
      var s = String(text == null ? '' : text);
      return FORBIDDEN_OUTPUT.some(function (r) {
        return (r.why.indexOf('asks_') === 0) && r.re.test(s);
      });
    },

    /* An opaque per-session handle. Random, unstored, meaningless on its own. */
    newSessionRef: function () {
      var s = '';
      for (var i = 0; i < 4; i++) s += Math.random().toString(36).slice(2, 8);
      return s.slice(0, 20);
    }
  };

})(window.WW);
