/* =============================================================
   WonderWorld — tutor/languages.js
   Which languages WonderTutor can teach in, and how far we are
   actually willing to vouch for each one.

   TWO THINGS THAT ARE NOT THE SAME
   --------------------------------
     TUTORING LANGUAGE   the language the tutor SPEAKS to the child.
                         A child can learn fractions in Spanish.
     LANGUAGE BEING      a language that is itself the SUBJECT.
     LEARNED             An English speaker studying Spanish.

   This file is only ever about the first one. The second is a skill
   domain and will live in the taxonomy when it is built — see
   `WW.tutorLanguages.LEARNING_MODE_NOTE` at the bottom. Keeping them
   apart matters: "teach me math in Spanish" and "teach me Spanish"
   need completely different content.

   HONESTY ABOUT CAPABILITY
   ------------------------
   These twelve are NOT presented as the world's most-spoken
   languages. Rankings disagree depending on whether you count
   native speakers, total speakers, or how you group dialects, so
   the UI calls them "Supported Languages" and nothing else.

   Nor is quality equal across them. Every entry carries a
   capability state, and nothing in the app is allowed to claim
   educational accuracy beyond it:

     supported      English today. Human-written lesson content,
                    reviewed, safe to make claims about.
     beta           The model can tutor in it, but no native
                    speaker has reviewed the output and the offline
                    lesson bank is still English. Say so in the UI.
     experimental   Not offered as a teaching medium at all until a
                    native speaker validates it. Listed, visible,
                    and honest about why it is not ready.

   Kosraean and Hawaiian are `experimental` deliberately. Machine
   translation into low-resource languages is unreliable in ways
   that are invisible to a non-speaker, and shipping wrong language
   to a child learning to read would be worse than not shipping it.
   See docs/WONDERTUTOR.md, "What needs native-speaker validation".
   ============================================================= */
(function (WW) {
  'use strict';

  /* Capability states, weakest promise last. */
  var SUPPORTED = 'supported';
  var BETA = 'beta';
  var EXPERIMENTAL = 'experimental';

  /* `code` is BCP-47 where one exists. Kosraean and Hawaiian have no
     ISO 639-1 two-letter code, so they use their ISO 639-3 codes, which
     is what BCP-47 says to do in that case. */
  var LANGUAGES = [
    {
      code: 'en', name: 'English', nativeName: 'English', dir: 'ltr',
      state: SUPPORTED, humanValidated: true, lessonBank: 'en',
      note: null
    },
    {
      code: 'zh-CN', name: 'Mandarin Chinese', nativeName: '中文（普通话）', dir: 'ltr',
      state: BETA, humanValidated: false, lessonBank: 'en',
      note: 'Lessons are generated in this language but have not been reviewed by a native speaker.'
    },
    {
      code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', dir: 'ltr',
      state: BETA, humanValidated: false, lessonBank: 'en',
      note: 'Lessons are generated in this language but have not been reviewed by a native speaker.'
    },
    {
      code: 'es', name: 'Spanish', nativeName: 'Español', dir: 'ltr',
      state: BETA, humanValidated: false, lessonBank: 'en',
      note: 'Lessons are generated in this language but have not been reviewed by a native speaker.'
    },
    {
      code: 'fr', name: 'French', nativeName: 'Français', dir: 'ltr',
      state: BETA, humanValidated: false, lessonBank: 'en',
      note: 'Lessons are generated in this language but have not been reviewed by a native speaker.'
    },
    {
      code: 'ar', name: 'Arabic', nativeName: 'العربية', dir: 'rtl',
      state: BETA, humanValidated: false, lessonBank: 'en',
      note: 'Lessons are generated in this language but have not been reviewed by a native speaker.'
    },
    {
      code: 'bn', name: 'Bengali', nativeName: 'বাংলা', dir: 'ltr',
      state: BETA, humanValidated: false, lessonBank: 'en',
      note: 'Lessons are generated in this language but have not been reviewed by a native speaker.'
    },
    {
      code: 'pt', name: 'Portuguese', nativeName: 'Português', dir: 'ltr',
      state: BETA, humanValidated: false, lessonBank: 'en',
      note: 'Lessons are generated in this language but have not been reviewed by a native speaker.'
    },
    {
      code: 'ru', name: 'Russian', nativeName: 'Русский', dir: 'ltr',
      state: BETA, humanValidated: false, lessonBank: 'en',
      note: 'Lessons are generated in this language but have not been reviewed by a native speaker.'
    },
    {
      code: 'ur', name: 'Urdu', nativeName: 'اردو', dir: 'rtl',
      state: BETA, humanValidated: false, lessonBank: 'en',
      note: 'Lessons are generated in this language but have not been reviewed by a native speaker.'
    },
    {
      /* ISO 639-3 `kos`. The endonym is deliberately left null rather than
         guessed — writing the wrong word for someone's own language on the
         language picker is exactly the kind of error this file exists to
         avoid. A Kosraean speaker fills this in. */
      code: 'kos', name: 'Kosraean', nativeName: null, dir: 'ltr',
      state: EXPERIMENTAL, humanValidated: false, lessonBank: null,
      needsNativeValidation: true,
      note: 'Not yet available for teaching. We will not claim educational accuracy ' +
            'in Kosraean until a native speaker has reviewed it.'
    },
    {
      /* ISO 639-3 `haw`. The endonym here is well attested, so it is used. */
      code: 'haw', name: 'Hawaiian', nativeName: 'ʻŌlelo Hawaiʻi', dir: 'ltr',
      state: EXPERIMENTAL, humanValidated: false, lessonBank: null,
      needsNativeValidation: true,
      note: 'Not yet available for teaching. We will not claim educational accuracy ' +
            'in ʻŌlelo Hawaiʻi until a native speaker has reviewed it.'
    }
  ];

  var BY_CODE = {};
  LANGUAGES.forEach(function (l) { BY_CODE[l.code] = l; });

  var DEFAULT = 'en';

  var Languages = WW.tutorLanguages = {
    SUPPORTED: SUPPORTED,
    BETA: BETA,
    EXPERIMENTAL: EXPERIMENTAL,
    DEFAULT: DEFAULT,

    /* The full list, always all twelve. The picker shows every one of them,
       including the ones that are not ready, because hiding them would hide
       the reason they are not ready. */
    all: function () { return LANGUAGES.slice(); },

    get: function (code) { return BY_CODE[code] || null; },

    /* Can the tutor actually TEACH in this language today? */
    canTeachIn: function (code) {
      var l = BY_CODE[code];
      return !!l && l.state !== EXPERIMENTAL;
    },

    /* Is this one we are willing to make accuracy claims about? */
    isValidated: function (code) {
      var l = BY_CODE[code];
      return !!l && l.humanValidated === true;
    },

    needsValidation: function (code) {
      var l = BY_CODE[code];
      return !!l && l.needsNativeValidation === true;
    },

    /* Which offline lesson bank backs this language. Everything that can be
       taught falls back to the English bank for now; `null` means the
       language has no teaching path at all yet. */
    lessonBank: function (code) {
      var l = BY_CODE[code];
      return l ? l.lessonBank : null;
    },

    /* The sentence the UI must show next to a language that is not fully
       validated. Returns null when there is nothing to disclose. */
    disclosure: function (code) {
      var l = BY_CODE[code];
      return l ? (l.note || null) : null;
    },

    dir: function (code) {
      var l = BY_CODE[code];
      return l && l.dir === 'rtl' ? 'rtl' : 'ltr';
    },

    /* Normalise anything a caller hands us to a language we will teach in.
       Never throws, never returns something unusable. */
    coerce: function (code) {
      if (BY_CODE[code] && Languages.canTeachIn(code)) return code;
      return DEFAULT;
    },

    /* ---------------------------------------------------------
       LANGUAGE-LEARNING MODE — deliberately not implemented here.

       When a child wants to LEARN Spanish rather than be taught IN
       Spanish, that is a skill domain in the taxonomy with its own
       vocabulary, phonics and grammar skills. It must never be
       inferred from the tutoring language, and setting one must
       never set the other. The profile keeps them in two separate
       fields for exactly this reason.
       --------------------------------------------------------- */
    LEARNING_MODE_NOTE:
      'Tutoring language is the medium of instruction. A language being ' +
      'learned is a subject. They are stored separately and never inferred ' +
      'from one another.'
  };

})(window.WW);
