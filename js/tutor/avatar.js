/* =============================================================
   WonderWorld — tutor/avatar.js
   The face of WonderTutor. SVG, CSS and a timer — nothing else.

   No animation library. The rest of the game draws its characters
   with hand-written SVG and moves them with CSS, and a tutor is not
   a good enough reason to add a dependency to a project that has
   none.

   HOW A STATE BECOMES A FACE
   --------------------------
   `setState('encouraging')` puts `is-encouraging` on the root
   element. Every eyebrow angle, eye shape and mouth curve for that
   state lives in style.css. JavaScript decides WHAT the tutor feels;
   CSS decides what that looks like. Nothing here writes a style
   string, and nothing outside can hand this module markup to render.

   THE ALLOW-LIST IS ENFORCED HERE TOO
   -----------------------------------
   `WW.tutorEmotion` validates a decision before returning it, and
   this file validates again before touching the DOM. An unknown
   state is dropped and the previous face stays. Two independent
   checks, because the first one existing is not a reason for the
   second one not to.

   MOTION IS DECORATION; EXPRESSION IS INFORMATION
   -----------------------------------------------
   Under reduced motion the blinking, the idle float and the talking
   bob all stop — but the face still CHANGES. A child who has asked
   for less movement has not asked to be denied the difference
   between "well done" and "let's try that again". So expressions
   remain; only the movement between them goes.
   ============================================================= */
(function (WW) {
  'use strict';

  /* Every state the renderer will act on. A superset of the emotions a
     decision may return, because 'listening' and 'talking' are driven by
     the session rather than chosen. */
  var STATES = [
    'idle',
    'listening',
    'thinking',
    'talking',
    'happy',
    'excited',
    'encouraging',
    'curious',
    'celebrating',
    'gentle_correction',
    'neutral'
  ];

  /* How long a reaction face holds before drifting back to idle. */
  var REACTION_MS = 2600;

  /* Mouth shapes live here rather than in CSS because the CSS `d` property
     is not supported everywhere — Firefox would leave the mouth frozen,
     which is the most expressive part of the face. Brows, cheeks, halo and
     all the movement stay in the stylesheet; only this one attribute is set
     from JavaScript, and it is a path from a fixed table, never anything
     computed or supplied by a caller. */
  var MOUTHS = {
    idle:              'M68 101 q12 7 24 0',
    neutral:           'M68 101 q12 7 24 0',
    listening:         'M72 103 q8 3 16 0',
    thinking:          'M72 104 q8 0 16 0',
    talking:           'M68 100 q12 8 24 0',
    happy:             'M64 100 q16 14 32 0',
    excited:           'M62 98 q18 20 36 0',
    encouraging:       'M68 102 q12 8 24 0',
    curious:           'M72 103 q8 6 16 0',
    celebrating:       'M60 96 q20 24 40 0',
    gentle_correction: 'M70 103 q10 4 20 0'
  };

  var SVG =
    '<svg class="tutor-svg" viewBox="0 0 160 160" role="img" aria-hidden="true" focusable="false">' +
      '<defs>' +
        '<radialGradient id="tutorGlow" cx="50%" cy="45%" r="55%">' +
          '<stop offset="0%" stop-color="#ffe9a8"/>' +
          '<stop offset="100%" stop-color="#ffc93c"/>' +
        '</radialGradient>' +
      '</defs>' +

      /* soft halo — the only purely decorative element */
      '<circle class="tutor-halo" cx="80" cy="80" r="62" />' +

      /* body */
      '<circle class="tutor-head" cx="80" cy="80" r="50" fill="url(#tutorGlow)" />' +

      /* little star tuft, so it reads as a WonderWorld creature */
      '<path class="tutor-tuft" d="M80 22 l6 13 14 2 -10 10 3 14 -13 -7 -13 7 3 -14 -10 -10 14 -2z" />' +

      /* cheeks */
      '<circle class="tutor-cheek tutor-cheek-l" cx="56" cy="92" r="8" />' +
      '<circle class="tutor-cheek tutor-cheek-r" cx="104" cy="92" r="8" />' +

      /* brows */
      '<path class="tutor-brow tutor-brow-l" d="M50 60 q10 -6 20 -1" />' +
      '<path class="tutor-brow tutor-brow-r" d="M90 59 q10 -5 20 1" />' +

      /* eyes */
      '<g class="tutor-eye tutor-eye-l">' +
        '<ellipse class="tutor-eye-white" cx="62" cy="76" rx="11" ry="12" />' +
        '<circle class="tutor-pupil" cx="62" cy="77" r="5.5" />' +
        '<circle class="tutor-spark" cx="64.5" cy="73.5" r="2" />' +
      '</g>' +
      '<g class="tutor-eye tutor-eye-r">' +
        '<ellipse class="tutor-eye-white" cx="98" cy="76" rx="11" ry="12" />' +
        '<circle class="tutor-pupil" cx="98" cy="77" r="5.5" />' +
        '<circle class="tutor-spark" cx="100.5" cy="73.5" r="2" />' +
      '</g>' +

      /* mouth — one path, re-shaped per state by CSS */
      '<path class="tutor-mouth" d="M66 102 q14 10 28 0" />' +
    '</svg>';

  var Avatar = WW.tutorAvatar = {
    STATES: STATES,
    REACTION_MS: REACTION_MS,

    el: null,
    state: 'idle',
    _blink: null,
    _settle: null,

    isValidState: function (s) { return STATES.indexOf(s) !== -1; },

    /* Honour both the app's own switch and the OS preference. */
    reducedMotion: function () {
      try {
        if (WW.State && WW.State.data && WW.State.data.settings &&
            WW.State.data.settings.reduceMotion) return true;
        if (window.matchMedia &&
            window.matchMedia('(prefers-reduced-motion: reduce)').matches) return true;
      } catch (e) { /* assume motion is fine */ }
      return false;
    },

    /* Build the character into a container. Safe to call again — it replaces
       rather than stacking. */
    mount: function (container) {
      if (!container) return null;
      var wrap = document.createElement('div');
      wrap.className = 'tutor-avatar is-idle';
      wrap.innerHTML = SVG;
      container.innerHTML = '';
      container.appendChild(wrap);

      Avatar.el = wrap;
      Avatar.state = 'idle';
      Avatar.startBlinking();
      return wrap;
    },

    unmount: function () {
      Avatar.stopBlinking();
      if (Avatar._settle) { clearTimeout(Avatar._settle); Avatar._settle = null; }
      Avatar.el = null;
    },

    /* The one way the face changes. Rejects anything not on the list, so a
       value that somehow came from a model cannot reach the DOM. */
    setState: function (state) {
      if (!Avatar.isValidState(state)) return false;
      if (!Avatar.el) { Avatar.state = state; return true; }

      STATES.forEach(function (s) { Avatar.el.classList.remove('is-' + s); });
      Avatar.el.classList.add('is-' + state);

      var mouth = Avatar.el.querySelector('.tutor-mouth');
      if (mouth && MOUTHS[state]) mouth.setAttribute('d', MOUTHS[state]);

      Avatar.state = state;
      return true;
    },

    /* Show a reaction, then drift back to idle on its own, the way a face
       does. Expressions still change under reduced motion — only the
       movement between them is suppressed, by CSS. */
    react: function (state, holdMs) {
      if (!Avatar.setState(state)) return false;
      if (Avatar._settle) clearTimeout(Avatar._settle);
      Avatar._settle = setTimeout(function () {
        /* Don't stomp on a state something else set in the meantime. */
        if (Avatar.state === state) Avatar.setState('idle');
      }, holdMs || REACTION_MS);
      return true;
    },

    /* Driven by WW.tutorVoice while speech is playing. */
    startTalking: function () {
      if (!Avatar.el) return;
      Avatar.el.classList.add('is-speaking');
    },
    stopTalking: function () {
      if (!Avatar.el) return;
      Avatar.el.classList.remove('is-speaking');
    },

    /* ---------- blinking ----------
       Irregular on purpose: a perfectly timed blink looks like a machine. */
    startBlinking: function () {
      Avatar.stopBlinking();
      if (Avatar.reducedMotion()) return;
      var schedule = function () {
        var wait = 2200 + Math.random() * 3600;
        Avatar._blink = setTimeout(function () {
          if (!Avatar.el) return;
          Avatar.el.classList.add('is-blinking');
          setTimeout(function () {
            if (Avatar.el) Avatar.el.classList.remove('is-blinking');
          }, 140);
          schedule();
        }, wait);
      };
      schedule();
    },

    stopBlinking: function () {
      if (Avatar._blink) { clearTimeout(Avatar._blink); Avatar._blink = null; }
      if (Avatar.el) Avatar.el.classList.remove('is-blinking');
    },

    /* Called when the reduce-motion setting changes while the tutor is open. */
    refreshMotion: function () {
      if (Avatar.reducedMotion()) Avatar.stopBlinking();
      else Avatar.startBlinking();
    }
  };

})(window.WW);
