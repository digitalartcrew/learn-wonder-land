/* =============================================================
   WonderWorld — tutor/engine.js
   What WonderTutor teaches next, and what that is worth.

   THE LOOP
   --------
       ASSESS → TEACH → PRACTICE → CHECK → ADAPT → REVIEW → ADVANCE

   This file owns the decisions in that loop. The running lesson
   itself lives in tutor/session.js; everything here is "what should
   happen", not "what is happening".

   CHOOSING THE NEXT SKILL
   -----------------------
   In priority order, and foundations always win:

     1. A prerequisite gap under something the child is attempting.
        Teaching long division to a child shaky on multiplication
        wastes both of their time.
     2. A skill whose spaced review has come due.
     3. The weakest skill with real evidence behind it.
     4. Something at grade level never tried.
     5. The strongest skill, one level up.

   Nothing here advances a child because they are subscribed, and
   nothing here holds a child back because they are not. Levels move
   on evidence only — see `WW.learningProfile.completeLesson`.

   REWARDS
   -------
   Tutoring pays the same XP and gems the rest of the game pays, for
   the same reason: real work. The caps below exist so that nothing
   here becomes a tap-to-earn loop. Chatting earns nothing at all.
   ============================================================= */
(function (WW) {
  'use strict';

  var T = WW.tutorTaxonomy;
  var Profile = WW.learningProfile;
  var Content = WW.tutorContent;

  /* ---------- rewards, deliberately modest ---------- */
  var XP_PRACTICE_CORRECT = 2;    /* per correct practice answer */
  var XP_LESSON_COMPLETE = 12;    /* finishing a lesson's check questions */
  var XP_MASTERY = 25;            /* a skill actually mastered */
  var GEMS_MASTERY = 5;

  /* A skill can only pay its lesson reward once in this window, so repeating
     the same easy lesson is not a strategy. */
  var LESSON_REWARD_COOLDOWN = 6 * 3600000;   /* 6 hours */

  /* Nothing is paid for a lesson with fewer than this many check answers. */
  var MIN_CHECKS_FOR_REWARD = 2;

  var Tutor = WW.tutor = {
    XP_PRACTICE_CORRECT: XP_PRACTICE_CORRECT,
    XP_LESSON_COMPLETE: XP_LESSON_COMPLETE,
    XP_MASTERY: XP_MASTERY,
    LESSON_REWARD_COOLDOWN: LESSON_REWARD_COOLDOWN,

    /* ---------- access ----------
       Configurable because the right free allowance is a pricing question,
       and docs/TUTOR_PRICING.md has not been argued out in production yet.
       Changing these numbers must never require touching UI code. */
    ACCESS: {
      /* A free Explorer may meet the tutor, be assessed, and have a real
         lesson — enough for a grown-up to judge whether it is worth paying
         for, and enough that the child gets something either way. */
      freeAssessment: true,
      freeLessons: 1,

      /* Fair use for subscribers. High enough that no ordinary child will
         ever see it; low enough that one runaway device cannot cost a
         fortune. Expressed per day and surfaced to the PARENT only. */
      plusLessonsPerDay: 40,

      /* ---- spoken conversation ----
         Voice is the one feature here with a cost that can actually exceed
         the subscription. Typed tutoring runs about 2 cents per subscriber
         per month; real-time audio bills $32/1M tokens in and $64/1M out,
         which works out around 3-4 cents a MINUTE. Forty voice sessions a
         month would cost more than a $9.99 subscription nets after Apple's
         commission.

         So unlike the lesson cap, these are real economic limits rather than
         abuse backstops, and both apply. The daily one stops a binge; the
         monthly one stops sustained use from going underwater.
         See docs/TUTOR_PRICING.md. */
      plusVoiceMinutesPerDay: 20,
      plusVoiceMinutesPerMonth: 120,

      /* Voice is never part of the free demo. A free Explorer has not had a
         grown-up agree to anything, and it is the most expensive thing here. */
      freeVoiceMinutes: 0
    },

    /* Why the tutor is or is not open. `blockedBy` mirrors the vocabulary
       WW.entitlements already uses, so callers branch the same way. */
    access: function () {
      var E = WW.entitlements;
      var plus = !E || E.isPlus();

      if (plus) {
        var today = Tutor._lessonsToday();
        if (today >= Tutor.ACCESS.plusLessonsPerDay) {
          return { allowed: false, blockedBy: 'fair-use', lessonsToday: today };
        }
        return { allowed: true, blockedBy: null, lessonsToday: today };
      }

      /* Free: the demo. */
      var used = Profile.data().lessonsCompleted;
      if (!Profile.isAssessmentDone() && Tutor.ACCESS.freeAssessment) {
        return { allowed: true, blockedBy: null, demo: true };
      }
      if (used < Tutor.ACCESS.freeLessons) {
        return { allowed: true, blockedBy: null, demo: true,
                 demoLeft: Tutor.ACCESS.freeLessons - used };
      }
      return { allowed: false, blockedBy: 'plus', demo: true, demoLeft: 0 };
    },

    /* ---------- voice budget ----------
       Spoken minutes, counted against both windows. Returned in seconds so
       the caller never has to guess at rounding.

       The child is NEVER shown these numbers. When the budget runs out they
       get "my voice needs a rest" and the typed tutor, which teaches exactly
       as well. The figures belong in the grown-ups dashboard. */
    voiceBudget: function () {
      var E = WW.entitlements;
      var plus = !E || E.isPlus();
      var A = Tutor.ACCESS;

      if (!plus) {
        return { allowed: A.freeVoiceMinutes > 0, reason: 'plus',
                 usedTodaySec: 0, usedMonthSec: 0,
                 dayLimitSec: A.freeVoiceMinutes * 60, monthLimitSec: A.freeVoiceMinutes * 60,
                 leftSec: A.freeVoiceMinutes * 60 };
      }

      var d = Profile.data();
      var now = Date.now();
      var log = d.voiceLog || [];
      var dayAgo = now - 86400000;
      var monthAgo = now - 30 * 86400000;

      var usedDay = 0, usedMonth = 0;
      log.forEach(function (e) {
        if (!e || !e.at || !e.sec) return;
        if (e.at > monthAgo) usedMonth += e.sec;
        if (e.at > dayAgo) usedDay += e.sec;
      });

      var dayLimit = A.plusVoiceMinutesPerDay * 60;
      var monthLimit = A.plusVoiceMinutesPerMonth * 60;
      var leftDay = Math.max(0, dayLimit - usedDay);
      var leftMonth = Math.max(0, monthLimit - usedMonth);
      var left = Math.min(leftDay, leftMonth);

      return {
        allowed: left > 0,
        reason: left > 0 ? null : (leftDay <= 0 ? 'daily' : 'monthly'),
        usedTodaySec: usedDay,
        usedMonthSec: usedMonth,
        dayLimitSec: dayLimit,
        monthLimitSec: monthLimit,
        leftSec: left
      };
    },

    /* Record a completed stretch of talking. Called by the voice client when
       a session closes, so a session that crashes still gets counted on the
       next open rather than being free. */
    recordVoice: function (seconds) {
      var sec = Math.max(0, Math.round(Number(seconds) || 0));
      if (!sec) return 0;
      var d = Profile.data();
      if (!d.voiceLog) d.voiceLog = [];
      var now = Date.now();
      d.voiceLog.push({ at: now, sec: sec });
      /* Keep only what the windows need. */
      var cutoff = now - 31 * 86400000;
      d.voiceLog = d.voiceLog.filter(function (e) { return e && e.at > cutoff; });
      d.usage.voiceSeconds = (d.usage.voiceSeconds || 0) + sec;
      Profile.save();
      return sec;
    },

    _lessonsToday: function () {
      var d = Profile.data();
      var since = Date.now() - 86400000;
      /* Counted from the profile rather than the save, so it survives a
         game reset and cannot be cleared by a child. */
      return (d.recentLessons || []).filter(function (t) { return t > since; }).length;
    },

    /* ---------- what to do first ---------- */

    /* The tutor refuses to open with "what would you like to ask?". This is
       what the screen checks to decide where a new Explorer goes. */
    setupNeeded: function () {
      return {
        grade: !Profile.hasGrade(),
        language: false,                 /* always has a default */
        assessment: !Profile.isAssessmentDone()
      };
    },

    isReady: function () {
      var s = Tutor.setupNeeded();
      return !s.grade && !s.assessment;
    },

    /* ---------- choosing ---------- */

    /* An unmet prerequisite under this skill, or null. Foundations first. */
    prereqGap: function (skillId) {
      var missing = T.missingPrereqs(skillId, function (p) { return Profile.isSolid(p); });
      if (!missing.length) return null;
      /* Deepest first: if multiplication is shaky AND addition is shaky,
         teach addition. */
      var deepest = missing[0];
      var guard = 0;
      while (guard++ < 6) {
        var under = T.missingPrereqs(deepest, function (p) { return Profile.isSolid(p); });
        if (!under.length) break;
        deepest = under[0];
      }
      return deepest;
    },

    /* The next skill to teach, with the reason, so the tutor can say
       something true about why it picked this. */
    nextSkill: function () {
      var grade = Profile.grade();
      if (grade === null) return null;
      var d = Profile.data();

      /* 1. review that has come due */
      var due = Profile.dueForReview();
      for (var i = 0; i < due.length; i++) {
        if (Content.has(due[i].skillId)) {
          var gap = Tutor.prereqGap(due[i].skillId);
          if (gap && Content.has(gap)) {
            return { skillId: gap, level: Profile.level(gap), reason: 'prereq', under: due[i].skillId };
          }
          return { skillId: due[i].skillId, level: due[i].level, reason: 'review' };
        }
      }

      /* 2. the weakest thing we have real evidence about */
      var weak = Profile.weakest(3);
      for (var j = 0; j < weak.length; j++) {
        if (!Content.has(weak[j].skillId)) continue;
        var g2 = Tutor.prereqGap(weak[j].skillId);
        if (g2 && Content.has(g2)) {
          return { skillId: g2, level: Profile.level(g2), reason: 'prereq', under: weak[j].skillId };
        }
        return { skillId: weak[j].skillId, level: weak[j].level, reason: 'practice' };
      }

      /* 3. something at grade level never tried */
      var fresh = T.skillsForGrade(grade).filter(function (s) {
        return Content.has(s.id) && !(d.skills[s.id] && d.skills[s.id].attempted);
      });
      if (fresh.length) {
        return { skillId: fresh[0].id, level: T.defaultLevel(fresh[0].id, grade), reason: 'new' };
      }

      /* 4. push the strongest skill on a level */
      var best = null;
      Object.keys(d.skills).forEach(function (k) {
        var s = d.skills[k];
        if (!Content.has(k) || !s.attempted) return;
        if (!best || s.mastery > best.mastery) best = s;
      });
      if (best) {
        return { skillId: best.skillId, level: best.level, reason: 'advance' };
      }
      return null;
    },

    /* The sentence the tutor opens with when the child has no question.
       Specific beats generic: "fractions could use practice" lands, "want to
       learn something?" does not. */
    proactiveOpener: function (choice) {
      if (!choice) return 'Want to learn something cool?';
      var def = T.skill(choice.skillId);
      var name = def ? def.name.toLowerCase() : 'this';

      switch (choice.reason) {
        case 'review':
          return 'Let\'s go back over ' + name + ' for a moment — a quick refresh makes it stick.';
        case 'prereq':
          var over = T.skill(choice.under);
          return 'Before we tackle ' + (over ? over.name.toLowerCase() : 'that') +
                 ', let\'s make ' + name + ' really solid. It makes the next bit much easier.';
        case 'practice':
          return 'I found something we can practice! Let\'s work on ' + name + ' together.';
        case 'new':
          return 'Today we\'re going to learn about ' + name + '!';
        case 'advance':
          return 'You\'re doing really well at ' + name + ' — ready for a trickier one?';
        default:
          return 'Want to learn something cool?';
      }
    },

    /* ---------- noticing the game ----------
       A world the child has actually been struggling in is a good reason to
       offer a skill. Reads the save locally; none of it is ever transmitted
       beyond the world NAME, via tutorSafety.buildContext. */
    gameNudge: function () {
      try {
        var w = WW.State && WW.State.data && WW.State.data.worlds;
        if (!w) return null;
        var worst = null;
        Object.keys(w).forEach(function (id) {
          var rec = w[id];
          var tried = (rec.correct || 0) + (rec.wrong || 0);
          if (tried < 6) return;
          var acc = (rec.correct || 0) / tried;
          if (!worst || acc < worst.acc) worst = { world: id, acc: acc };
        });
        if (!worst || worst.acc >= 0.7) return null;

        var skills = T.skillsForWorld(worst.world).filter(function (s) {
          return Content.has(s.id);
        });
        if (!skills.length) return null;
        return { world: worst.world, skillId: skills[0].id, accuracy: worst.acc };
      } catch (e) { return null; }
    },

    /* ---------- rewards ---------- */

    /* A correct practice answer. Small, and only inside a lesson. */
    rewardPractice: function () {
      if (WW.Progress) WW.Progress.addXP(XP_PRACTICE_CORRECT);
      return XP_PRACTICE_CORRECT;
    },

    /* End of a lesson. Pays once per skill per cooldown, and only if the
       child actually did the check questions. */
    rewardLesson: function (skillId, checksAnswered, mastered) {
      var d = Profile.data();
      if (!d.rewardedAt) d.rewardedAt = {};
      if (!d.recentLessons) d.recentLessons = [];

      var now = Date.now();
      d.recentLessons.push(now);
      d.recentLessons = d.recentLessons.filter(function (t) { return t > now - 86400000; });

      var paid = { xp: 0, gems: 0, reason: null };

      if (checksAnswered < MIN_CHECKS_FOR_REWARD) {
        paid.reason = 'not_enough_work';
        Profile.save();
        return paid;
      }
      var last = d.rewardedAt[skillId] || 0;
      if (now - last < LESSON_REWARD_COOLDOWN) {
        paid.reason = 'cooldown';
        Profile.save();
        return paid;
      }

      d.rewardedAt[skillId] = now;
      paid.xp = XP_LESSON_COMPLETE;

      /* Mastery pays once, the first time a skill is genuinely mastered. */
      if (mastered && !d.masteredEver) d.masteredEver = {};
      if (mastered && d.masteredEver && !d.masteredEver[skillId]) {
        d.masteredEver[skillId] = now;
        paid.xp += XP_MASTERY;
        paid.gems = GEMS_MASTERY;
      }

      Profile.save();

      if (WW.Progress) {
        WW.Progress.addXP(paid.xp);
        if (paid.gems) WW.Progress.addGems(paid.gems);
        var def = T.skill(skillId);
        WW.Progress.logActivity({
          world: T.worldFor(skillId) || 'tutor',
          name: 'WonderTutor: ' + (def ? def.name : skillId),
          detail: mastered ? 'Mastered' : 'Practiced',
          xp: paid.xp
        });
      }
      return paid;
    }
  };

})(window.WW);
