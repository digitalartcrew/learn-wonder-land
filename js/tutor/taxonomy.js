/* =============================================================
   WonderWorld — tutor/taxonomy.js
   What WonderTutor can teach, and roughly when.

   THE SHAPE
   ---------
   DOMAIN (Mathematics)  →  SKILL (multiplication)  →  LEVEL (grade band)

   A skill is the unit everything else works in: the diagnostic
   measures skills, mastery is tracked per skill, and a lesson
   teaches one skill at one level.

   GRADE IS NOT A SINGLE NUMBER
   ----------------------------
   A child is enrolled in one grade but has a level per skill. A
   Grade 2 child can be working at Grade 3 multiplication and Grade 1
   spelling at the same time, and the profile stores it that way.
   `band()` turns "this skill's level vs the enrolled grade" into the
   four words a parent report is allowed to use:

     below | approaching | on | above

   Those describe SKILLS, never children. Nothing here diagnoses a
   learner, and nothing here may be used to label one — see
   docs/WONDERTUTOR.md, "What this is not".

   GRADES
   ------
   Kindergarten is 0 and Grade 6 is 6, so the whole range is plain
   integer arithmetic. Age is never asked for and never inferred: a
   grade is what a grown-up tells us, nothing more.

   EXPANDING IT
   ------------
   Add a skill to SKILLS. Give it a domain, a grade range, and its
   prerequisites. The diagnostic, the lesson picker and the parent
   report all read this table, so that is the whole job.
   ============================================================= */
(function (WW) {
  'use strict';

  var KINDERGARTEN = 0;
  var MAX_GRADE = 6;

  var GRADES = [
    { value: 0, id: 'k',  label: 'Kindergarten', short: 'K' },
    { value: 1, id: 'g1', label: 'Grade 1',      short: '1' },
    { value: 2, id: 'g2', label: 'Grade 2',      short: '2' },
    { value: 3, id: 'g3', label: 'Grade 3',      short: '3' },
    { value: 4, id: 'g4', label: 'Grade 4',      short: '4' },
    { value: 5, id: 'g5', label: 'Grade 5',      short: '5' },
    { value: 6, id: 'g6', label: 'Grade 6',      short: '6' }
  ];

  /* `world` ties a domain to the WonderWorld world it reinforces, so the
     tutor can say "I noticed fractions could use practice" about something
     the child actually played. null means no world covers it yet. */
  var DOMAINS = [
    { id: 'math',    name: 'Mathematics',        emoji: '🧮', world: 'math' },
    { id: 'reading', name: 'Reading',            emoji: '📚', world: 'story' },
    { id: 'writing', name: 'Writing',            emoji: '✏️', world: 'story' },
    { id: 'science', name: 'Science',            emoji: '🧪', world: 'science' },
    { id: 'social',  name: 'Social Studies',     emoji: '🌎', world: 'city' },
    { id: 'finance', name: 'Financial Literacy', emoji: '💰', world: 'business' }
  ];

  /* grades: [firstGrade, lastGrade] where the skill is normally taught.
     prereq: skills that should be reasonably solid first. The lesson picker
     uses these to refuse to run ahead of a foundational gap.

     CALIBRATION NOTE. These were first drafted a year or two optimistic at the
     bottom end, which made Kindergarten and Grade 1 feel punishing: a
     five-year-old was being asked to spell "elephant" and to say how many tens
     are in 17. The rule applied since: a skill starts at the grade a child is
     normally TAUGHT it, not the grade they first hear the word. When in doubt,
     start later — a child who is ahead gets moved up by the diagnostic within
     a couple of questions, whereas a child who is behind just feels bad. */
  var SKILLS = [
    /* ---- Mathematics ---- */
    { id: 'counting',        domain: 'math', name: 'Counting',            grades: [0, 1], prereq: [] },
    { id: 'number-sense',    domain: 'math', name: 'Number sense',        grades: [1, 3], prereq: ['counting'] },
    { id: 'comparison',      domain: 'math', name: 'Comparing numbers',   grades: [0, 2], prereq: ['counting'] },
    { id: 'addition',        domain: 'math', name: 'Addition',            grades: [0, 3], prereq: ['counting'] },
    { id: 'subtraction',     domain: 'math', name: 'Subtraction',         grades: [0, 3], prereq: ['counting'] },
    { id: 'multiplication',  domain: 'math', name: 'Multiplication',      grades: [2, 5], prereq: ['addition'] },
    { id: 'division',        domain: 'math', name: 'Division',            grades: [3, 6], prereq: ['multiplication'] },
    { id: 'fractions',       domain: 'math', name: 'Fractions',           grades: [2, 6], prereq: ['division'] },
    { id: 'money-math',      domain: 'math', name: 'Money maths',         grades: [1, 4], prereq: ['addition'] },
    { id: 'measurement',     domain: 'math', name: 'Measurement',         grades: [1, 5], prereq: ['number-sense'] },
    { id: 'geometry',        domain: 'math', name: 'Shapes and geometry',  grades: [0, 6], prereq: [] },
    { id: 'word-problems',   domain: 'math', name: 'Word problems',       grades: [1, 6], prereq: ['addition', 'subtraction'] },

    /* ---- Reading ---- */
    { id: 'phonics',         domain: 'reading', name: 'Phonics',          grades: [0, 2], prereq: [] },
    { id: 'vocabulary',      domain: 'reading', name: 'Vocabulary',       grades: [0, 6], prereq: [] },
    { id: 'comprehension',   domain: 'reading', name: 'Reading comprehension', grades: [1, 6], prereq: ['vocabulary'] },
    { id: 'main-idea',       domain: 'reading', name: 'Main idea',        grades: [2, 6], prereq: ['comprehension'] },
    { id: 'inference',       domain: 'reading', name: 'Inference',        grades: [3, 6], prereq: ['main-idea'] },

    /* ---- Writing ---- */
    { id: 'spelling',        domain: 'writing', name: 'Spelling',         grades: [1, 6], prereq: ['phonics'] },
    { id: 'sentences',       domain: 'writing', name: 'Building sentences', grades: [1, 5], prereq: ['spelling'] },
    { id: 'grammar',         domain: 'writing', name: 'Grammar',          grades: [1, 6], prereq: ['sentences'] },

    /* ---- Science (aligned with Science Lab) ---- */
    { id: 'living-things',   domain: 'science', name: 'Living things',    grades: [0, 4], prereq: [] },
    { id: 'plants',          domain: 'science', name: 'How plants grow',  grades: [0, 4], prereq: ['living-things'] },
    { id: 'weather',         domain: 'science', name: 'Weather',          grades: [0, 4], prereq: [] },
    { id: 'matter',          domain: 'science', name: 'Solids and liquids', grades: [1, 5], prereq: [] },
    { id: 'forces',          domain: 'science', name: 'Forces and magnets', grades: [1, 5], prereq: [] },
    { id: 'earth-space',     domain: 'science', name: 'Earth and space',  grades: [2, 6], prereq: [] },

    /* ---- Social studies (aligned with Planet City) ---- */
    { id: 'community',       domain: 'social', name: 'Community and helpers', grades: [0, 3], prereq: [] },
    { id: 'maps',            domain: 'social', name: 'Maps and directions', grades: [1, 5], prereq: [] },
    { id: 'environment',     domain: 'social', name: 'Caring for the planet', grades: [2, 6], prereq: [] },

    /* ---- Financial literacy (aligned with Business Town) ---- */
    { id: 'coins-notes',     domain: 'finance', name: 'Coins and notes',  grades: [1, 4], prereq: ['counting'] },
    { id: 'saving',          domain: 'finance', name: 'Saving',           grades: [1, 5], prereq: ['coins-notes'] },
    { id: 'spending-choices', domain: 'finance', name: 'Spending choices', grades: [1, 5], prereq: ['coins-notes'] },
    { id: 'profit',          domain: 'finance', name: 'Revenue, cost and profit', grades: [3, 6], prereq: ['subtraction', 'saving'] }
  ];

  var BY_ID = {};
  SKILLS.forEach(function (s) { BY_ID[s.id] = s; });

  var DOMAIN_BY_ID = {};
  DOMAINS.forEach(function (d) { DOMAIN_BY_ID[d.id] = d; });

  function clampGrade(g) {
    g = Math.round(Number(g));
    if (!isFinite(g)) return KINDERGARTEN;
    return Math.max(KINDERGARTEN, Math.min(MAX_GRADE, g));
  }

  var Taxonomy = WW.tutorTaxonomy = {
    KINDERGARTEN: KINDERGARTEN,
    MAX_GRADE: MAX_GRADE,
    GRADES: GRADES,
    DOMAINS: DOMAINS,
    SKILLS: SKILLS,

    clampGrade: clampGrade,

    grade: function (value) {
      var v = clampGrade(value);
      for (var i = 0; i < GRADES.length; i++) if (GRADES[i].value === v) return GRADES[i];
      return GRADES[0];
    },

    gradeLabel: function (value) { return Taxonomy.grade(value).label; },

    skill: function (id) { return BY_ID[id] || null; },
    domain: function (id) { return DOMAIN_BY_ID[id] || null; },

    skillsIn: function (domainId) {
      return SKILLS.filter(function (s) { return s.domain === domainId; });
    },

    /* Every skill normally taught at this grade. The diagnostic starts here. */
    skillsForGrade: function (grade) {
      var g = clampGrade(grade);
      return SKILLS.filter(function (s) { return g >= s.grades[0] && g <= s.grades[1]; });
    },

    /* The level a skill should be practised at for a child in this grade,
       kept inside the skill's own range so we never ask a Grade 6 child to
       do Grade 6 counting or a Kindergartener to do Grade 0 division. */
    defaultLevel: function (skillId, grade) {
      var s = BY_ID[skillId];
      if (!s) return clampGrade(grade);
      return Math.max(s.grades[0], Math.min(s.grades[1], clampGrade(grade)));
    },

    levelRange: function (skillId) {
      var s = BY_ID[skillId];
      return s ? s.grades.slice() : [KINDERGARTEN, MAX_GRADE];
    },

    /* How a skill level sits against the child's enrolled grade.
       Describes the SKILL, never the child. */
    band: function (level, grade) {
      var d = Math.round(Number(level)) - clampGrade(grade);
      if (!isFinite(d)) return 'on';
      if (d <= -2) return 'below';
      if (d === -1) return 'approaching';
      if (d === 0) return 'on';
      return 'above';
    },

    BAND_LABELS: {
      below:       'below grade level',
      approaching: 'approaching grade level',
      on:          'on grade level',
      above:       'above grade level'
    },

    /* Prerequisites that are not yet solid. `isSolid` is supplied by the
       caller (the profile) so this file stays free of mastery state. */
    missingPrereqs: function (skillId, isSolid) {
      var s = BY_ID[skillId];
      if (!s || !s.prereq.length) return [];
      return s.prereq.filter(function (p) { return !isSolid(p); });
    },

    /* Which world in the game reinforces this skill, if any. Used to connect
       tutoring to what the child has actually been playing. */
    worldFor: function (skillId) {
      var s = BY_ID[skillId];
      if (!s) return null;
      var d = DOMAIN_BY_ID[s.domain];
      return d ? d.world : null;
    },

    /* The reverse: which skills a world exercises. Lets the tutor notice that
       Math Island has been going badly and offer the matching practice. */
    skillsForWorld: function (worldId) {
      var domains = DOMAINS.filter(function (d) { return d.world === worldId; })
        .map(function (d) { return d.id; });
      return SKILLS.filter(function (s) { return domains.indexOf(s.domain) !== -1; });
    }
  };

})(window.WW);
