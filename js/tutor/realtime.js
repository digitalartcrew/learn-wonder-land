/* =============================================================
   WonderWorld — tutor/realtime.js
   Talking with WonderTutor, out loud.

   WHAT THIS IS
   ------------
   A WebRTC connection to the Realtime API so a child can speak to
   the tutor and hear it answer. The browser authenticates with an
   ephemeral client secret minted by /api/tutor-realtime; our API
   key never exists in this process.

   WHY IT IS DIFFERENT FROM EVERYTHING ELSE HERE
   ---------------------------------------------
   Every other part of WonderTutor is built so nothing identifying
   leaves the device. This feature sends a child's voice to a third
   party. That is not a detail — it is a different privacy posture,
   and it is why this file is the most locked-down one in the
   project:

     • OFF by default. `WW.tutorVoiceChat.isEnabled()` is false
       until a grown-up passes the parental gate and consents, and
       the server switch is independently off.
     • PUSH-TO-TALK. There is no open microphone. The audio track is
       `enabled = false` except while the button is physically held,
       so the mic is genuinely off between turns rather than live
       and ignored.
     • VISIBLE. The UI must show an unmistakable indicator whenever
       the track is live. `onListening` fires on both edges so it
       cannot drift out of sync.
     • NOTHING STORED. No audio is recorded, buffered to disk or
       uploaded by us. Transcripts are held in memory for the
       lesson and discarded with it.
     • SCREENED. Transcript text — the child's and the tutor's —
       goes through the same tutorSafety checks as typed text.

   HOW A TURN WORKS
   ----------------
     hold   → track.enabled = true          child speaks
     release→ track.enabled = false
              input_audio_buffer.commit     "that was my turn"
              response.create               "your go"

   `turn_detection` is null in the session config, so the model
   never decides on its own that it is being spoken to.

   EVERYTHING DEGRADES
   -------------------
   No consent, no server switch, no WebRTC, no microphone
   permission, a refused token, a failed connection — every path
   leaves the typed tutor working exactly as before. Voice is never
   required to learn.
   ============================================================= */
(function (WW) {
  'use strict';

  var TOKEN_ENDPOINT = '/api/tutor-realtime';
  var CALLS_URL = 'https://api.openai.com/v1/realtime/calls';
  var DATA_CHANNEL = 'oai-events';

  /* Bump when the consent wording changes, so a stored consent always says
     which text a grown-up actually agreed to. */
  var CONSENT_VERSION = 'voice-v1-2026-10';

  var CONNECT_TIMEOUT = 12000;

  function settled(v) {
    return window.Promise ? Promise.resolve(v)
                          : { then: function (f) { f(v); return this; } };
  }

  var VoiceChat = WW.tutorVoiceChat = {
    CONSENT_VERSION: CONSENT_VERSION,
    TOKEN_ENDPOINT: TOKEN_ENDPOINT,

    pc: null,
    dc: null,
    micTrack: null,
    audioEl: null,

    state: 'idle',        /* idle | connecting | ready | listening | speaking | error */
    listening: false,

    /* Set by the screen so the UI can react. */
    onState: null,
    onListening: null,
    onTranscript: null,   /* (who, text) — already screened */
    onError: null,

    /* ---------- capability ---------- */

    /* Could this device do it at all? Says nothing about whether it may. */
    isSupported: function () {
      try {
        return !!(window.RTCPeerConnection && navigator.mediaDevices &&
                  navigator.mediaDevices.getUserMedia && window.fetch && window.Promise);
      } catch (e) { return false; }
    },

    /* ---------- consent ----------
       Stored per Explorer, versioned, and revocable. A grown-up grants it
       behind the parental gate; nothing here grants it on its own. */

    record: function () {
      var d = WW.learningProfile.data();
      if (!d.voiceChat) {
        d.voiceChat = { enabled: false, consentedAt: null, consentVersion: null };
      }
      return d.voiceChat;
    },

    isEnabled: function () {
      var v = VoiceChat.record();
      return v.enabled === true && v.consentVersion === CONSENT_VERSION;
    },

    /* Called ONLY from behind the parental gate. */
    grantConsent: function () {
      var v = VoiceChat.record();
      v.enabled = true;
      v.consentedAt = Date.now();
      v.consentVersion = CONSENT_VERSION;
      WW.learningProfile.save();
      if (WW.events) WW.events.track('parent_gate_completed', { source: 'voice-consent' });
      return v;
    },

    revokeConsent: function () {
      var v = VoiceChat.record();
      v.enabled = false;
      v.consentedAt = null;
      v.consentVersion = null;
      WW.learningProfile.save();
      VoiceChat.stop();
      return v;
    },

    /* The single question the UI should ask before offering a talk button.

       Budget is checked here as well as at start(), so the UI never offers a
       microphone that would be refused the moment it was held. */
    available: function () {
      if (!VoiceChat.isSupported()) return { ok: false, reason: 'unsupported' };
      if (!VoiceChat.isEnabled()) return { ok: false, reason: 'no_consent' };
      if (WW.tutor && WW.tutor.voiceBudget) {
        var b = WW.tutor.voiceBudget();
        if (!b.allowed) return { ok: false, reason: 'budget:' + (b.reason || 'spent') };
      }
      return { ok: true, reason: null };
    },

    /* ---------- metering ----------
       Spoken seconds cost real money — roughly 3-4 cents a minute — so they
       are metered rather than trusted. The clock runs for as long as the
       session is OPEN, not just while the button is held, because the model
       is streaming audio back during the gaps too. */
    _openedAt: 0,
    _budgetTimer: null,

    _startMeter: function () {
      VoiceChat._openedAt = Date.now();
      if (VoiceChat._budgetTimer) clearInterval(VoiceChat._budgetTimer);
      /* Check often enough that an overrun is seconds, not minutes. */
      VoiceChat._budgetTimer = setInterval(function () {
        if (!VoiceChat.pc) return;
        var b = WW.tutor && WW.tutor.voiceBudget ? WW.tutor.voiceBudget() : null;
        var elapsed = (Date.now() - VoiceChat._openedAt) / 1000;
        if (b && elapsed >= b.leftSec) {
          VoiceChat.stop();
          if (typeof VoiceChat.onError === 'function') {
            try { VoiceChat.onError('budget_spent'); } catch (e) {}
          }
        }
      }, 5000);
    },

    _stopMeter: function () {
      if (VoiceChat._budgetTimer) { clearInterval(VoiceChat._budgetTimer); VoiceChat._budgetTimer = null; }
      if (VoiceChat._openedAt && WW.tutor && WW.tutor.recordVoice) {
        WW.tutor.recordVoice((Date.now() - VoiceChat._openedAt) / 1000);
      }
      VoiceChat._openedAt = 0;
    },

    _setState: function (s) {
      VoiceChat.state = s;
      if (typeof VoiceChat.onState === 'function') {
        try { VoiceChat.onState(s); } catch (e) {}
      }
    },

    _fail: function (reason) {
      VoiceChat._setState('error');
      if (typeof VoiceChat.onError === 'function') {
        try { VoiceChat.onError(reason); } catch (e) {}
      }
      VoiceChat.stop();
      return { ok: false, reason: reason };
    },

    /* ---------- connecting ---------- */

    start: function (opts) {
      opts = opts || {};
      var gate = VoiceChat.available();
      if (!gate.ok) return settled({ ok: false, reason: gate.reason });
      if (VoiceChat.pc) return settled({ ok: true, reason: 'already_open' });

      VoiceChat._setState('connecting');

      var P = WW.learningProfile;
      var skill = opts.skillId && WW.tutorTaxonomy
        ? WW.tutorTaxonomy.skill(opts.skillId) : null;

      /* Only what the session needs to teach — the same shape the typed
         tutor sends. No nickname, no identifier, no save. */
      return window.fetch(TOKEN_ENDPOINT, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          parentConsent: true,
          grade: P.grade(),
          language: P.language(),
          skillName: skill ? skill.name : null
        })
      }).then(function (r) {
        return r && r.ok ? r.json() : null;
      }).then(function (data) {
        if (!data || !data.ok || !data.value) {
          return VoiceChat._fail((data && data.reason) || 'no_token');
        }
        return VoiceChat._connect(data.value);
      })['catch'](function () {
        return VoiceChat._fail('token_failed');
      });
    },

    _connect: function (ephemeralKey) {
      return new Promise(function (resolve) {
        var done = false;
        var finish = function (r) { if (!done) { done = true; resolve(r); } };
        setTimeout(function () {
          if (!done) finish(VoiceChat._fail('timeout'));
        }, CONNECT_TIMEOUT);

        var pc;
        try {
          pc = new RTCPeerConnection();
        } catch (e) { finish(VoiceChat._fail('no_webrtc')); return; }
        VoiceChat.pc = pc;

        /* The tutor's voice comes back on this element. */
        var audio = document.createElement('audio');
        audio.autoplay = true;
        audio.setAttribute('aria-hidden', 'true');
        VoiceChat.audioEl = audio;

        pc.ontrack = function (e) {
          audio.srcObject = e.streams[0];
          VoiceChat._setState('speaking');
          if (WW.tutorAvatar) WW.tutorAvatar.startTalking();
        };

        pc.onconnectionstatechange = function () {
          if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
            finish(VoiceChat._fail('connection_lost'));
          }
        };

        navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
          var track = stream.getAudioTracks()[0];
          /* THE MICROPHONE STARTS OFF. It is enabled only while the child
             physically holds the talk button, and disabled the moment they
             let go. Between turns the track is genuinely not capturing. */
          track.enabled = false;
          VoiceChat.micTrack = track;
          pc.addTrack(track, stream);

          var dc = pc.createDataChannel(DATA_CHANNEL);
          VoiceChat.dc = dc;
          dc.addEventListener('message', function (e) { VoiceChat._event(e.data); });
          dc.addEventListener('open', function () {
            VoiceChat._startMeter();
            VoiceChat._setState('ready');
            finish({ ok: true });
          });

          return pc.createOffer().then(function (offer) {
            return pc.setLocalDescription(offer).then(function () { return offer; });
          }).then(function (offer) {
            return window.fetch(CALLS_URL, {
              method: 'POST',
              body: offer.sdp,
              headers: {
                'authorization': 'Bearer ' + ephemeralKey,
                'content-type': 'application/sdp'
              }
            });
          }).then(function (r) {
            if (!r || !r.ok) throw new Error('sdp');
            return r.text();
          }).then(function (sdp) {
            return pc.setRemoteDescription({ type: 'answer', sdp: sdp });
          });
        })['catch'](function (err) {
          /* A refused microphone is a normal outcome, not a crash. */
          var reason = (err && (err.name === 'NotAllowedError' ||
                                err.name === 'SecurityError')) ? 'mic_denied' : 'connect_failed';
          finish(VoiceChat._fail(reason));
        });
      });
    },

    /* ---------- push-to-talk ---------- */

    /* Called on pointer-down / key-down. */
    hold: function () {
      if (!VoiceChat.micTrack || VoiceChat.state === 'connecting') return false;
      VoiceChat.micTrack.enabled = true;
      VoiceChat.listening = true;
      VoiceChat._setState('listening');
      if (WW.tutorAvatar) WW.tutorAvatar.setState('listening');
      if (typeof VoiceChat.onListening === 'function') {
        try { VoiceChat.onListening(true); } catch (e) {}
      }
      return true;
    },

    /* Called on pointer-up / key-up / blur / anything that ends the gesture. */
    release: function () {
      if (!VoiceChat.micTrack) return false;
      VoiceChat.micTrack.enabled = false;
      VoiceChat.listening = false;
      if (typeof VoiceChat.onListening === 'function') {
        try { VoiceChat.onListening(false); } catch (e) {}
      }

      /* With turn_detection null, the model is waiting to be told the turn
         ended. Commit what was captured, then ask for a reply. */
      VoiceChat._send({ type: 'input_audio_buffer.commit' });
      VoiceChat._send({ type: 'response.create' });

      VoiceChat._setState('ready');
      if (WW.tutorAvatar) WW.tutorAvatar.setState('thinking');
      return true;
    },

    _send: function (obj) {
      try {
        if (VoiceChat.dc && VoiceChat.dc.readyState === 'open') {
          VoiceChat.dc.send(JSON.stringify(obj));
          return true;
        }
      } catch (e) {}
      return false;
    },

    /* ---------- events from the session ---------- */

    _event: function (raw) {
      var ev;
      try { ev = JSON.parse(raw); } catch (e) { return; }
      if (!ev || !ev.type) return;

      /* Transcripts are screened exactly like typed text. A spoken rule that
         is weaker than the written one would be the obvious hole. */
      if (/transcription\.completed$/.test(ev.type) && ev.transcript) {
        var inbound = WW.tutorSafety
          ? WW.tutorSafety.inspectInput(ev.transcript)
          : { ok: true, text: ev.transcript };
        VoiceChat._emitTranscript('child',
          inbound.ok ? inbound.text : null, inbound.ok ? null : inbound.reason);
        return;
      }

      if (ev.type === 'response.output_audio_transcript.done' && ev.transcript) {
        var out = WW.tutorSafety
          ? WW.tutorSafety.inspectOutput(ev.transcript)
          : { ok: true, text: ev.transcript };
        if (!out.ok) {
          /* The tutor said something it should not have. Cut the audio and
             show the safe line instead of letting it finish. */
          VoiceChat._send({ type: 'response.cancel' });
          VoiceChat._emitTranscript('tutor', out.text, 'blocked:' + out.reason);
          return;
        }
        VoiceChat._emitTranscript('tutor', out.text, null);
        return;
      }

      if (ev.type === 'response.done') {
        VoiceChat._setState('ready');
        if (WW.tutorAvatar) WW.tutorAvatar.stopTalking();
      }
      if (ev.type === 'error') {
        VoiceChat._fail('session_error');
      }
    },

    _emitTranscript: function (who, text, blocked) {
      if (WW.tutorSession && text) WW.tutorSession.remember(who, text);
      if (typeof VoiceChat.onTranscript === 'function') {
        try { VoiceChat.onTranscript(who, text, blocked); } catch (e) {}
      }
    },

    /* ---------- stopping ---------- */

    stop: function () {
      /* Count the time before anything is torn down, so a crash or a
         navigation still bills the seconds that were actually used. */
      VoiceChat._stopMeter();
      try {
        if (VoiceChat.micTrack) {
          VoiceChat.micTrack.enabled = false;
          VoiceChat.micTrack.stop();
        }
      } catch (e) {}
      try { if (VoiceChat.dc) VoiceChat.dc.close(); } catch (e) {}
      try { if (VoiceChat.pc) VoiceChat.pc.close(); } catch (e) {}
      try {
        if (VoiceChat.audioEl) {
          VoiceChat.audioEl.srcObject = null;
          VoiceChat.audioEl = null;
        }
      } catch (e) {}

      VoiceChat.micTrack = null;
      VoiceChat.dc = null;
      VoiceChat.pc = null;
      VoiceChat.listening = false;
      if (WW.tutorAvatar) WW.tutorAvatar.stopTalking();
      if (typeof VoiceChat.onListening === 'function') {
        try { VoiceChat.onListening(false); } catch (e) {}
      }
      if (VoiceChat.state !== 'error') VoiceChat._setState('idle');
      return true;
    },

    isOpen: function () { return !!VoiceChat.pc; }
  };

})(window.WW);
