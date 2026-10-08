/* =============================================================
   WonderWorld — tutor/assessment.js
   The friendly first look at what a child already knows.

   NOT AN EXAM
   -----------
   The child is never shown the word "test", "exam" or "score".
   To them this is "Let's see what you already know!". The parent
   dashboard may call it an Initial Skills Assessment, because a
   grown-up is entitled to the real name for it.

   ADAPTIVE, AND SHORT
   -------------------
   Nobody gives a six-year-old a standardised battery. This starts at
   the child's enrolled grade and moves:

       correct            → try one step harder
       incorrect          → ask again on the SAME skill, same level,
                            because one slip is not evidence
       wrong twice        → step the skill down and move on
       right twice        → step the skill up and move on

   It stops as soon as every planned skill has a verdict, or the
   question budget runs out. CONFIG.min / CONFIG.max bound it, and
   both are configurable.

   IT COSTS NOTHING TO RUN
   -----------------------
   Every question comes from the offline bank and every answer is
   scored by ordinary comparison. A diagnostic that called a language
   model twenty times per child would be the single most expensive
   thing in the product and would not be any more accurate. No AI
   call happens anywhere in this file.

   WHAT IT DOES NOT DO
   -------------------
   It measures SKILLS. It does not diagnose a learner, screen for a
   disability or disorder, estimate ability, or produce anything that
   may be presented as a clinical or psychological finding. Results
   are per-skill levels and nothing else.
   ============================================================= */
(function (WW) {
  'use strict';

  var T = WW.tutorTaxonomy;
  var Content = WW.tutorContent;
  var Profile = WW.learningProfile;

  var Assessment = WW.tutorAssessment = {

    /* Tunable rather than hard-coded, because the right length is a product
       question and will change once there is real usage to look at. */
    CONFIG: {
      min: 10,            /* never finish before this many questions */
      max: 20,            /* never go past this many */
      perSkill: 3,        /* most questions one skill may consume */
      skillsTargeted: 8   /* breadth of the first pass */
    },

    _state: null,

    /* ---------- planning ---------- */

    /* One skill per domain first, so the profile has breadth before depth,
       then fill up to skillsTargeted with more from the busiest domains.
       Skills with no offline content are skipped: the diagnostic must work
       on a plane. */
    plan: function (grade) {
      var picked = [];
      var seen = {};

      T.DOMAINS.forEach(function (d) {
        var candidates = T.skillsForGrade(grade)
          .filter(function (s) { return s.domain === d.id && Content.has(s.id); });
        if (candidates.length) {
          picked.push(candidates[0].id);
          seen[candidates[0].id] = true;
        }
      });

      T.skillsForGrade(grade).forEach(function (s) {
        if (picked.length >= Assessment.CONFIG.skillsTargeted) return;
        if (seen[s.id] || !Content.has(s.id)) return;
        picked.push(s.id);
        seen[s.id] = true;
      });

      return picked;
    },

    /* ---------- lifecycle ---------- */

    /* Refuses to start without a grade. Guessing one from gameplay would be
       a worse answer than asking a grown-up for it. */
    start: function () {
      if (!Profile.hasGrade()) {
        return { ok: false, reason: 'no_grade' };
      }
      var grade = Profile.grade();
      var skills = Assessment.plan(grade);
      if (!skills.length) return { ok: false, reason: 'no_content' };

      Assessment._state = {
        grade: grade,
        queue: skills,          /* skills still to reach a verdict on */
        done: [],               /* skills with a verdict */
        cursor: 0,
        asked: 0,
        current: null,
        /* per-skill working memory for the adaptation */
        work: {},
        results: []
      };

      skills.forEach(function (id) {
        Assessment._state.work[id] = {
          level: T.defaultLevel(id, grade),
          asked: 0, right: 0, wrongRun: 0, rightRun: 0
        };
      });

      var p = Profile.data();
      p.assessment.state = 'in-progress';
      p.assessment.startedAt = Date.now();
      p.assessment.asked = 0;
      p.assessment.results = [];
      Profile.save();

      if (WW.events) WW.events.track('activity_started', { kind: 'assessment' });
      return { ok: true, planned: skills.slice() };
    },

    isRunning: function () {
      return !!Assessment._state && Profile.data().assessment.state === 'in-progress';
    },

    /* The next question, or null when there is enough evidence. */
    next: function () {
      var st = Assessment._state;
      if (!st) return null;

      if (Assessment._shouldStop()) return null;

      /* Round-robin across the skills still waiting for a verdict, so the
         child gets variety instead of eight sums in a row. */
      if (!st.queue.length) return null;
      st.cursor = st.cursor % st.queue.length;
      var skillId = st.queue[st.cursor];
      var w = st.work[skillId];

      var q = Content.question(skillId, w.level);
      if (!q) {
        /* No content at this level after all — retire the skill rather than
           loop forever on it. */
        Assessment._retire(skillId);
        return Assessment.next();
      }
      st.current = q;
      return q;
    },

    /* Score an answer and adapt. Returns what the UI needs to respond. */
    submit: function (given) {
      var st = Assessment._state;
      if (!st || !st.current) return null;

      var q = st.current;
      var correct = Content.check(q, given);
      var w = st.work[q.skillId];
      var range = T.levelRange(q.skillId);

      st.asked++;
      w.asked++;
      if (correct) { w.right++; w.rightRun++; w.wrongRun = 0; }
      else { w.wrongRun++; w.rightRun = 0; }

      /* The profile learns from assessment answers too, flagged as such so a
         parent report can tell practice from diagnosis. */
      Profile.recordAnswer(q.skillId, correct, { assessment: true });

      st.results.push({ skillId: q.skillId, level: w.level, correct: correct });

      var moved = null;

      if (correct && w.rightRun >= 2) {
        /* Consistent mastery — step up and stop spending questions here. */
        if (w.level < range[1]) { w.level++; moved = 'up'; }
        Assessment._retire(q.skillId);
      } else if (correct && w.asked >= Assessment.CONFIG.perSkill) {
        Assessment._retire(q.skillId);
      } else if (!correct && w.wrongRun >= 2) {
        /* Repeated difficulty — step the skill down and move on. */
        if (w.level > range[0]) { w.level--; moved = 'down'; }
        Assessment._retire(q.skillId);
      } else if (w.asked >= Assessment.CONFIG.perSkill) {
        Assessment._retire(q.skillId);
      } else if (correct) {
        /* One right: try a harder one on the same skill. */
        if (w.level < range[1]) { w.level++; moved = 'up'; }
        st.cursor++;
      } else {
        /* One wrong: ask again on the SAME concept at the SAME level. One
           slip is not evidence, and dropping a child a level for it would
           be both unfair and inaccurate. */
      }

      st.current = null;

      var p = Profile.data();
      p.assessment.asked = st.asked;
      p.assessment.results.push({ skillId: q.skillId, level: q.level, correct: correct });
      Profile.save();

      return {
        correct: correct,
        skillId: q.skillId,
        level: q.level,
        moved: moved,
        explain: q.explain || null,
        answer: q.answer,
        remaining: Math.max(0, Assessment.CONFIG.max - st.asked),
        complete: Assessment._shouldStop()
      };
    },

    _retire: function (skillId) {
      var st = Assessment._state;
      var i = st.queue.indexOf(skillId);
      if (i !== -1) {
        st.queue.splice(i, 1);
        st.done.push(skillId);
        if (st.cursor > i) st.cursor--;
      }
    },

    /* Every planned skill reached a verdict but we are still short of the
       minimum, so widen rather than stop: a six-question picture is not a
       profile. Pulls in skills from the grade either side, which also catches
       a child who is working well above or below their enrolled grade. */
    _refill: function () {
      var st = Assessment._state;
      var already = {};
      st.done.concat(st.queue).forEach(function (id) { already[id] = true; });

      var extra = [];
      [st.grade, st.grade + 1, st.grade - 1].forEach(function (g) {
        if (g < T.KINDERGARTEN || g > T.MAX_GRADE) return;
        T.skillsForGrade(g).forEach(function (s) {
          if (already[s.id] || !Content.has(s.id)) return;
          already[s.id] = true;
          extra.push(s.id);
        });
      });

      if (!extra.length) return false;

      extra.slice(0, 4).forEach(function (id) {
        st.queue.push(id);
        st.work[id] = {
          level: T.defaultLevel(id, st.grade),
          asked: 0, right: 0, wrongRun: 0, rightRun: 0
        };
      });
      return true;
    },

    _shouldStop: function () {
      var st = Assessment._state;
      if (!st) return true;
      if (st.asked >= Assessment.CONFIG.max) return true;
      if (st.queue.length) return false;
      /* Out of planned skills. Only actually stop if we have asked enough. */
      if (st.asked < Assessment.CONFIG.min && Assessment._refill()) return false;
      return true;
    },

    /* Write the verdicts into the profile and close the assessment. */
    finish: function () {
      var st = Assessment._state;
      if (!st) return { ok: false, reason: 'not_started' };

      Object.keys(st.work).forEach(function (skillId) {
        var w = st.work[skillId];
        if (!w.asked) return;                 /* never reached — leave untouched */
        Profile.setLevel(skillId, w.level);
      });

      var p = Profile.data();
      p.assessment.state = 'complete';
      p.assessment.completedAt = Date.now();
      Profile.save();

      Assessment._state = null;

      if (WW.events) {
        WW.events.track('activity_completed', { kind: 'assessment', count: st.asked });
      }
      return { ok: true, asked: st.asked, skills: st.done.slice() };
    },

    isComplete: function () {
      return Profile.data().assessment.state === 'complete';
    },

    /* ---------- the resulting picture ----------
       Per-domain levels and bands, for the "here's your learning path"
       screen and for the parent report. Skill-level statements only. */
    summary: function () {
      var grade = Profile.grade() || 0;
      return T.DOMAINS.map(function (d) {
        var s = Profile.domainSummary(d.id);
        return {
          domain: d,
          level: s.level,
          band: s.level === null ? null : T.band(s.level, grade),
          mastered: s.mastered.length,
          practising: s.practising.length,
          review: s.review.length
        };
      }).filter(function (r) { return r.level !== null; });
    }
  };

})(window.WW);
