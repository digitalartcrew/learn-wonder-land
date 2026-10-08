/* =============================================================
   WonderWorld — tutor/profile.js
   What WonderTutor knows about one Explorer's learning.

   WHERE IT LIVES
   --------------
   Its own localStorage key, never inside the child's save:

       wonderworld.tutor.v1            ← Explorer 1
       wonderworld.tutor.v1.explorer-2 ← and so on

   The suffix is derived from the same roster seam core.js uses, so
   the tutor follows whichever Explorer is active without the save
   format changing by a single byte. If js/profiles.js is missing the
   key falls back to the bare one, exactly like the save does.

   WHY NOT IN THE SAVE
   -------------------
   The save is the game. A learning profile is a different lifetime
   with different privacy properties: a parent may want to reset
   tutoring without wiping crystals, and nothing in the tutor should
   ever be able to corrupt a game in progress.

   MASTERY IS DETERMINISTIC
   ------------------------
   Every number in here is computed by ordinary arithmetic. No model
   is asked whether a child has mastered something — that would be
   both expensive and unreliable, and it is the kind of thing a
   computer is actually good at. See docs/WONDERTUTOR.md, "Cost
   controls".

   WHAT THIS IS NOT
   ----------------
   A skill level is a statement about a SKILL, not about a child. It
   is not a diagnosis, not an aptitude score, not an IQ, and must
   never be presented as any of those. Nothing here records or infers
   a disability, a disorder, or a personality trait.
   ============================================================= */
(function (WW) {
  'use strict';

  var BASE_KEY = 'wonderworld.tutor.v1';
  var LEGACY_SAVE_KEY = 'wonderworld.save.v1';

  var T = WW.tutorTaxonomy;

  /* How many recent answers feed the mastery estimate. Short enough that a
     child who has just understood something is believed quickly. */
  var RECENT_WINDOW = 8;

  /* Mastery is a weighted recent-accuracy score in 0..1. */
  var MASTERED_AT = 0.85;
  var STRUGGLING_BELOW = 0.5;

  /* Evidence needed before a mastery score means anything at all. */
  var MIN_ATTEMPTS_FOR_CONFIDENCE = 4;
  var MIN_ATTEMPTS_FOR_MASTERY = 5;

  var DAY = 86400000;

  /* Spaced review. Index by how many consecutive solid sessions a skill has
     had; the gap grows, which is the whole point. */
  var REVIEW_GAPS_DAYS = [1, 2, 4, 8, 16, 30];

  function read(key) {
    try { return window.localStorage.getItem(key); } catch (e) { return null; }
  }
  function write(key, value) {
    try { window.localStorage.setItem(key, value); return true; } catch (e) { return false; }
  }

  /* The tutor key for whichever Explorer is active. Mirrors core.js's
     saveKey() seam rather than duplicating the roster logic. */
  function storeKey() {
    try {
      var p = WW.profiles;
      if (p && typeof p.activeSaveKey === 'function') {
        var k = p.activeSaveKey();
        if (typeof k === 'string' && k && k !== LEGACY_SAVE_KEY) {
          /* 'wonderworld.save.v1.explorer-2' -> 'wonderworld.tutor.v1.explorer-2' */
          return BASE_KEY + k.slice(LEGACY_SAVE_KEY.length);
        }
      }
    } catch (e) { /* fall through */ }
    return BASE_KEY;
  }

  function freshSkill(skillId, level) {
    return {
      skillId: skillId,
      level: level,
      mastery: 0,
      confidence: 0,
      attempted: 0,
      correct: 0,
      streak: 0,
      solidSessions: 0,
      recent: [],             /* most recent LAST */
      lastPracticed: null,
      lastAssessment: null,
      needsReview: false,
      nextReview: null,
      lessons: 0
    };
  }

  function defaults() {
    return {
      version: 1,

      /* null until a grown-up sets it. The tutor refuses to start without
         it — guessing a grade from gameplay would be worse than asking. */
      gradeLevel: null,
      gradeSetAt: null,

      /* The language the tutor SPEAKS. */
      language: (WW.tutorLanguages && WW.tutorLanguages.DEFAULT) || 'en',

      /* A language being STUDIED as a subject. Deliberately a separate
         field: setting one must never set the other. Not used this sprint. */
      learningLanguage: null,

      assessment: {
        state: 'none',        /* none | in-progress | complete */
        startedAt: null,
        completedAt: null,
        asked: 0,
        results: []           /* { skillId, level, correct } */
      },

      skills: {},             /* skillId -> skill record */

      sessions: 0,
      lastSessionAt: null,
      lessonsCompleted: 0,

      /* Reward bookkeeping, so tutoring cannot become a tap-to-earn loop.
         These MUST be declared here: load() merges by the keys of this
         object, so anything the engine invents at runtime would be dropped
         on the next reload. */
      rewardedAt: {},         /* skillId -> when its lesson reward last paid */
      masteredEver: {},       /* skillId -> when mastery first paid */
      recentLessons: [],      /* timestamps, trimmed to the last 24h */

      /* Non-identifying counters, for the cost model only. No content, no
         timestamps per call, nothing that could single a child out. */
      usage: { aiCalls: 0, aiTokensIn: 0, aiTokensOut: 0, decisionCalls: 0, offlineFallbacks: 0 }
    };
  }

  var Profile = WW.learningProfile = {
    BASE_KEY: BASE_KEY,
    MASTERED_AT: MASTERED_AT,
    STRUGGLING_BELOW: STRUGGLING_BELOW,
    RECENT_WINDOW: RECENT_WINDOW,
    MIN_ATTEMPTS_FOR_MASTERY: MIN_ATTEMPTS_FOR_MASTERY,

    _data: null,
    _key: null,

    storeKey: storeKey,

    /* ---------- storage ---------- */

    load: function () {
      var key = storeKey();
      var raw = read(key);
      var d = defaults();
      if (raw) {
        try {
          var parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object') {
            Object.keys(d).forEach(function (k) {
              if (parsed[k] === undefined) return;
              /* shallow-merge the nested objects so a new field added here
                 appears on an old profile instead of wiping it */
              if (d[k] && typeof d[k] === 'object' && !Array.isArray(d[k]) &&
                  parsed[k] && typeof parsed[k] === 'object') {
                Object.keys(parsed[k]).forEach(function (kk) { d[k][kk] = parsed[k][kk]; });
              } else {
                d[k] = parsed[k];
              }
            });
          }
        } catch (e) { /* corrupt profile → start fresh, never half-read */ }
      }
      Profile._data = d;
      Profile._key = key;
      return d;
    },

    data: function () {
      if (!Profile._data || Profile._key !== storeKey()) Profile.load();
      return Profile._data;
    },

    save: function () {
      write(storeKey(), JSON.stringify(Profile.data()));
    },

    /* A grown-up resetting tutoring. Deliberately does NOT touch the game
       save — crystals, XP and badges are the child's and stay. */
    reset: function () {
      Profile._data = defaults();
      try { window.localStorage.removeItem(storeKey()); } catch (e) {}
      return Profile._data;
    },

    /* ---------- enrolment ---------- */

    /* The tutor cannot start without this. Set by a grown-up behind the
       parental gate; never inferred, and never derived from a birth date,
       which we do not ask for and do not want. */
    setGrade: function (grade) {
      var d = Profile.data();
      d.gradeLevel = T.clampGrade(grade);
      d.gradeSetAt = Date.now();
      Profile.save();
      return d.gradeLevel;
    },

    grade: function () {
      var d = Profile.data();
      return d.gradeLevel === null ? null : T.clampGrade(d.gradeLevel);
    },

    hasGrade: function () { return Profile.data().gradeLevel !== null; },

    /* Asked here rather than on WW.tutorAssessment so the engine does not
       have to depend on the assessment module being loaded. */
    isAssessmentDone: function () {
      return Profile.data().assessment.state === 'complete';
    },

    /* ---------- language ---------- */

    setLanguage: function (code) {
      var d = Profile.data();
      d.language = WW.tutorLanguages ? WW.tutorLanguages.coerce(code) : 'en';
      Profile.save();
      return d.language;
    },

    language: function () {
      var d = Profile.data();
      return WW.tutorLanguages ? WW.tutorLanguages.coerce(d.language) : 'en';
    },

    /* The separate axis. Setting a language to STUDY must never change the
       language the tutor teaches in. */
    setLearningLanguage: function (code) {
      var d = Profile.data();
      d.learningLanguage = code || null;
      Profile.save();
      return d.learningLanguage;
    },

    learningLanguage: function () { return Profile.data().learningLanguage; },

    /* ---------- skills ---------- */

    skill: function (skillId) {
      var d = Profile.data();
      if (!d.skills[skillId]) {
        var def = T.skill(skillId);
        if (!def) return null;
        d.skills[skillId] = freshSkill(skillId,
          T.defaultLevel(skillId, d.gradeLevel === null ? def.grades[0] : d.gradeLevel));
      }
      return d.skills[skillId];
    },

    /* Levels are per skill, so a child is never flattened to one number. */
    level: function (skillId) {
      var s = Profile.skill(skillId);
      return s ? s.level : null;
    },

    setLevel: function (skillId, level) {
      var s = Profile.skill(skillId);
      if (!s) return null;
      var range = T.levelRange(skillId);
      s.level = Math.max(range[0], Math.min(range[1], Math.round(level)));
      Profile.save();
      return s.level;
    },

    band: function (skillId) {
      var s = Profile.skill(skillId);
      if (!s) return null;
      return T.band(s.level, Profile.data().gradeLevel || 0);
    },

    /* Solid enough to build on. Used for prerequisite checks. */
    isSolid: function (skillId) {
      var d = Profile.data();
      var s = d.skills[skillId];
      if (!s) return false;       /* never practised is not solid */
      return s.attempted >= MIN_ATTEMPTS_FOR_MASTERY && s.mastery >= 0.7;
    },

    isMastered: function (skillId) {
      var d = Profile.data();
      var s = d.skills[skillId];
      if (!s) return false;
      return s.attempted >= MIN_ATTEMPTS_FOR_MASTERY && s.mastery >= MASTERED_AT;
    },

    /* ---------- the mastery model ----------
       Weighted recent accuracy: the newest answers count most, so a child who
       has just understood something is not held back by the attempts they got
       wrong while learning it. Plain arithmetic, no model involved. */
    _recompute: function (s) {
      var recent = s.recent;
      if (!recent.length) { s.mastery = 0; s.confidence = 0; return; }
      var num = 0, den = 0;
      for (var i = 0; i < recent.length; i++) {
        var w = i + 1;                        /* oldest 1 … newest n */
        num += w * (recent[i] ? 1 : 0);
        den += w;
      }
      s.mastery = den ? num / den : 0;
      /* Confidence is about how much evidence there is, not how good it is. */
      s.confidence = Math.min(1, s.attempted / (MIN_ATTEMPTS_FOR_CONFIDENCE * 2));
    },

    /* The single entry point for "the child answered something".
       opts: { assessment: bool, level: number } */
    recordAnswer: function (skillId, correct, opts) {
      opts = opts || {};
      var s = Profile.skill(skillId);
      if (!s) return null;

      correct = !!correct;
      s.attempted++;
      if (correct) { s.correct++; s.streak++; } else { s.streak = 0; }

      s.recent.push(correct);
      while (s.recent.length > RECENT_WINDOW) s.recent.shift();

      Profile._recompute(s);

      var now = Date.now();
      if (opts.assessment) s.lastAssessment = now; else s.lastPracticed = now;

      /* Review scheduling: a solid answer pushes the next review further out,
         a wrong one brings it back. */
      if (correct && s.mastery >= 0.7) {
        s.solidSessions = Math.min(REVIEW_GAPS_DAYS.length - 1, s.solidSessions + 1);
        s.needsReview = false;
      } else if (!correct) {
        s.solidSessions = Math.max(0, s.solidSessions - 1);
        if (s.mastery < STRUGGLING_BELOW) s.needsReview = true;
      }
      s.nextReview = now + REVIEW_GAPS_DAYS[s.solidSessions] * DAY;

      Profile.save();
      return s;
    },

    /* Called at the end of a lesson, once the check questions are in.
       Advancing a level is the ONLY way a skill level goes up, and it needs
       real evidence — never a payment, never a tap. */
    completeLesson: function (skillId, mastered) {
      var s = Profile.skill(skillId);
      if (!s) return null;
      var d = Profile.data();
      s.lessons++;
      d.lessonsCompleted++;

      if (mastered && Profile.isMastered(skillId)) {
        var range = T.levelRange(skillId);
        if (s.level < range[1]) {
          s.level++;
          /* A new level is new material: the old recent window would make the
             child look better at it than they are, so the evidence resets. */
          s.recent = [];
          s.attempted = 0;
          s.correct = 0;
          s.mastery = 0;
          s.confidence = 0;
          s.solidSessions = 0;
        }
      }
      Profile.save();
      return s;
    },

    /* A level step DOWN, when a child is clearly not ready. Used by the
       diagnostic and by the lesson engine after repeated difficulty. Never
       framed to the child as going backwards. */
    stepDown: function (skillId) {
      var s = Profile.skill(skillId);
      if (!s) return null;
      var range = T.levelRange(skillId);
      if (s.level > range[0]) {
        s.level--;
        s.recent = [];
        s.attempted = 0;
        s.correct = 0;
        s.mastery = 0;
        s.confidence = 0;
      }
      Profile.save();
      return s;
    },

    /* ---------- what to do next ---------- */

    /* Skills whose review is due, soonest first. */
    dueForReview: function (now) {
      now = now || Date.now();
      var d = Profile.data();
      return Object.keys(d.skills)
        .map(function (k) { return d.skills[k]; })
        .filter(function (s) {
          return s.attempted > 0 && (s.needsReview || (s.nextReview && s.nextReview <= now));
        })
        .sort(function (a, b) { return (a.nextReview || 0) - (b.nextReview || 0); });
    },

    /* Skills the child is visibly finding hard. Foundations first. */
    weakest: function (limit) {
      var d = Profile.data();
      return Object.keys(d.skills)
        .map(function (k) { return d.skills[k]; })
        .filter(function (s) { return s.attempted >= MIN_ATTEMPTS_FOR_CONFIDENCE && s.mastery < 0.7; })
        .sort(function (a, b) { return a.mastery - b.mastery; })
        .slice(0, limit || 5);
    },

    /* ---------- reporting ---------- */

    /* A per-domain summary for the parent dashboard. Counts only — no
       transcripts, and nothing a parent could mistake for a diagnosis. */
    domainSummary: function (domainId) {
      var d = Profile.data();
      var skills = T.skillsIn(domainId);
      var out = { domainId: domainId, mastered: [], practising: [], review: [], untouched: 0, level: null };
      var levels = [];

      skills.forEach(function (def) {
        var s = d.skills[def.id];
        if (!s || !s.attempted) { out.untouched++; return; }
        levels.push(s.level);
        if (Profile.isMastered(def.id)) out.mastered.push(def);
        else if (s.needsReview || s.mastery < STRUGGLING_BELOW) out.review.push(def);
        else out.practising.push(def);
      });

      if (levels.length) {
        levels.sort(function (a, b) { return a - b; });
        /* Median, so one very strong or very weak skill does not move the
           headline figure around. */
        out.level = levels[Math.floor(levels.length / 2)];
      }
      return out;
    },

    /* ---------- usage, for the cost model only ---------- */

    countUsage: function (kind, tokensIn, tokensOut) {
      var u = Profile.data().usage;
      if (kind === 'ai') {
        u.aiCalls++;
        u.aiTokensIn += tokensIn || 0;
        u.aiTokensOut += tokensOut || 0;
      } else if (kind === 'decision') {
        u.decisionCalls++;
      } else if (kind === 'offline') {
        u.offlineFallbacks++;
      }
      Profile.save();
      return u;
    }
  };

})(window.WW);
