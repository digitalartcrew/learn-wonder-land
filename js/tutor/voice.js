/* =============================================================
   WonderWorld — tutor/voice.js
   WonderTutor speaking out loud, on the device and nowhere else.

   THE PRIVACY RULE, UNCHANGED
   ---------------------------
   `SpeechSynthesisUtterance` is not necessarily local. Several
   browsers ship "natural" voices that synthesise in the cloud, which
   would post whatever the tutor is saying — sometimes containing a
   word the child typed — to a third party we have no relationship
   with. js/core.js already refuses any voice without
   `localService === true`, and this file applies exactly the same
   rule per language.

   If no on-device voice exists for the tutoring language, WonderTutor
   stays silent. It does not fall back to a cloud voice, and it does
   not fall back to the wrong language, which would be worse than
   silence for a child learning to read.

   VOICE IS NEVER REQUIRED
   -----------------------
   Every lesson, question and explanation is on screen as text first.
   Speech is an accessibility and delight layer on top. If
   speechSynthesis is missing, broken, muted or unsupported for the
   language, tutoring continues exactly as it is — the only
   difference is that the mouth does not move.

   WHAT IT DRIVES
   --------------
   While speech is playing the avatar is in `is-speaking` so the
   mouth animates; when it ends, or is stopped, or fails, the avatar
   goes back. That handoff is here rather than in the avatar so the
   mouth can never be left moving after the sound has stopped.
   ============================================================= */
(function (WW) {
  'use strict';

  function synth() {
    try { return ('speechSynthesis' in window) ? window.speechSynthesis : null; }
    catch (e) { return null; }
  }

  var Voice = WW.tutorVoice = {
    _current: null,
    _voices: null,

    available: function () { return !!synth(); },

    /* The master sound switch applies; the separate "cheering voice" toggle
       does not, because this is how the tutor talks rather than praise. */
    enabled: function () {
      if (!Voice.available()) return false;
      try {
        if (WW.State && WW.State.data && WW.State.data.settings &&
            WW.State.data.settings.sound === false) return false;
      } catch (e) { /* no state yet */ }
      return true;
    },

    /* On-device voices only. Returns [] until the browser has loaded the
       list, which several do asynchronously. */
    localVoices: function () {
      var s = synth();
      if (!s) return [];
      var list = [];
      try { list = s.getVoices() || []; } catch (e) { list = []; }
      return list.filter(function (v) { return v && v.localService === true; });
    },

    /* Best on-device voice for a BCP-47 tag, or null. Exact match first,
       then the base language, then nothing — never "close enough". */
    voiceFor: function (lang) {
      var want = String(lang || 'en').toLowerCase();
      var base = want.split('-')[0];
      var local = Voice.localVoices();
      if (!local.length) return null;

      var exact = local.filter(function (v) {
        return (v.lang || '').toLowerCase().replace('_', '-') === want;
      })[0];
      if (exact) return exact;

      var sameLang = local.filter(function (v) {
        return (v.lang || '').toLowerCase().split(/[-_]/)[0] === base;
      })[0];
      return sameLang || null;
    },

    /* Can we actually speak this language here? The UI uses this to decide
       whether to offer a "read it to me" control at all, rather than offering
       one that silently does nothing. */
    canSpeak: function (lang) {
      return Voice.enabled() && !!Voice.voiceFor(lang);
    },

    /* speak(text, language, opts)
       Resolves nothing and throws nothing — a failure to speak is never
       allowed to interrupt a lesson. */
    speak: function (text, lang, opts) {
      opts = opts || {};
      var s = synth();
      if (!s || !Voice.enabled() || !text) return false;

      var code = lang || (WW.learningProfile ? WW.learningProfile.language() : 'en');
      var voice = Voice.voiceFor(code);

      if (!voice) {
        /* The list may simply not have loaded yet. Try once more shortly,
           then give up quietly and leave the text on screen. */
        if (Voice._voices === null) {
          Voice._voices = 'retrying';
          setTimeout(function () {
            Voice._voices = [];
            if (Voice.voiceFor(code)) Voice.speak(text, code, opts);
          }, 400);
        }
        return false;
      }

      Voice.stop();

      try {
        var u = new window.SpeechSynthesisUtterance(String(text));
        u.voice = voice;
        u.lang = voice.lang;
        /* A little slower and warmer than the game's praise voice: this is
           instruction, and a child is following along. */
        u.rate = opts.rate === undefined ? 0.95 : opts.rate;
        u.pitch = opts.pitch === undefined ? 1.15 : opts.pitch;
        u.volume = opts.volume === undefined ? 1 : opts.volume;

        u.onstart = function () {
          if (WW.tutorAvatar) WW.tutorAvatar.startTalking();
        };
        var done = function () {
          Voice._current = null;
          if (WW.tutorAvatar) WW.tutorAvatar.stopTalking();
          if (typeof opts.onEnd === 'function') { try { opts.onEnd(); } catch (e) {} }
        };
        u.onend = done;
        u.onerror = done;

        Voice._current = u;
        s.speak(u);
        return true;
      } catch (e) {
        if (WW.tutorAvatar) WW.tutorAvatar.stopTalking();
        return false;
      }
    },

    stop: function () {
      var s = synth();
      Voice._current = null;
      if (WW.tutorAvatar) WW.tutorAvatar.stopTalking();
      if (!s) return false;
      try { s.cancel(); } catch (e) {}
      return true;
    },

    pause: function () {
      var s = synth();
      if (!s) return false;
      try { s.pause(); } catch (e) { return false; }
      if (WW.tutorAvatar) WW.tutorAvatar.stopTalking();
      return true;
    },

    resume: function () {
      var s = synth();
      if (!s) return false;
      try { s.resume(); } catch (e) { return false; }
      if (Voice._current && WW.tutorAvatar) WW.tutorAvatar.startTalking();
      return true;
    },

    isSpeaking: function () {
      var s = synth();
      if (!s) return false;
      try { return !!s.speaking; } catch (e) { return false; }
    }
  };

})(window.WW);
