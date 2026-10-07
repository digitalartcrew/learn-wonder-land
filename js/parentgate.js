/* =============================================================
   WonderWorld — parentgate.js
   One reusable adult check, used everywhere an adult is required.

   WHY A GATE AT ALL
   -----------------
   Behind these doors sit an email field, a progress report, a
   "reset everything" button and — now — subscription controls.
   COPPA treats an email address as personal information, and a
   tick-box reading "I am the parent" is not verification. A
   child must not be able to walk in by tapping.

   THE CHALLENGE
   -------------
   Two kinds, both deliberately above what the game itself ever
   teaches (which tops out at 12 × 12), and both requiring the
   answer to be TYPED rather than tapped:

     'multiply'         17 × 23 = ?
                        Used for the Grown-Ups dashboard.

     'multiply-adjust'  Read the sentence, do the multiplication,
                        then subtract. Reading comprehension plus
                        adult arithmetic in a single field.
                        Used before anything involving money.

   ACCESSIBILITY
   -------------
   One labelled numeric field, an instruction wired up with
   aria-describedby, errors announced through role="status", a
   visible focus ring, and a way out that does not require solving
   anything. Nothing here depends on colour or on hover.

   WHAT THIS IS NOT
   ----------------
   It is not authentication, and it is not a claim that the person
   is a parent. It is a speed bump sized for a 6–8 year old, which
   is exactly what the App Store asks for in front of purchase UI.
   ============================================================= */
(function (WW) {
  'use strict';

  var U = WW.Util;

  /* A pass lasts a few minutes, then the gate closes again. Long enough to
     read a report and start a subscription, short enough that a device put
     down on the sofa is safe. */
  var TTL = 5 * 60 * 1000;

  function rnd(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; }

  var Gate = WW.parentGate = {
    TTL: TTL,

    /* scope -> timestamp of the last successful pass */
    _passes: {},

    /* ---------- session ---------- */

    isOpen: function (scope) {
      var at = Gate._passes[scope || 'default'];
      return !!at && (Date.now() - at) < TTL;
    },

    markPassed: function (scope) {
      Gate._passes[scope || 'default'] = Date.now();
      if (WW.events) WW.events.track('parent_gate_completed', { source: scope || 'default' });
    },

    /* reset()        closes every gate
       reset('x')     closes just that one */
    reset: function (scope) {
      if (scope === undefined) Gate._passes = {};
      else delete Gate._passes[scope];
    },

    /* ---------- the challenge ---------- */

    challenge: function (kind) {
      if (kind === 'multiply-adjust') {
        var a = rnd(13, 29), b = rnd(13, 29), c = rnd(3, 9);
        var answer = a * b - c;
        return {
          kind: 'multiply-adjust',
          instruction: 'Read carefully: work out ' + a + ' × ' + b +
                       ', then subtract ' + c + '. Type the result.',
          sum: a + ' × ' + b + ' − ' + c + ' = ?',
          spoken: a + ' times ' + b + ', minus ' + c,
          verify: function (v) { return parseInt(v, 10) === answer; }
        };
      }
      var x = rnd(13, 29), y = rnd(13, 29);
      var product = x * y;
      return {
        kind: 'multiply',
        instruction: null,
        sum: x + ' × ' + y + ' = ?',
        spoken: x + ' times ' + y,
        verify: function (v) { return parseInt(v, 10) === product; }
      };
    },

    /* ---------- the card ----------
       opts: { kind, scope, title, blurb, onPass, onCancel, cancelText } */
    build: function (opts) {
      opts = opts || {};
      var ch = Gate.challenge(opts.kind);
      var scope = opts.scope || 'default';
      var instructionId = 'gate-instruction-' + Math.floor(Math.random() * 1e6);

      if (WW.events) WW.events.track('parent_gate_started', { source: scope, kind: ch.kind });

      var input = U.el('input', {
        type: 'text', inputmode: 'numeric', autocomplete: 'off',
        class: 'name-input gate-input', 'aria-label': 'Answer: ' + ch.spoken,
        placeholder: '?', maxlength: '6'
      });
      if (ch.instruction) input.setAttribute('aria-describedby', instructionId);

      var status = U.el('p', { class: 'beta-status', role: 'status' });

      function check() {
        if (ch.verify(input.value)) {
          Gate.markPassed(scope);
          if (WW.Sound) WW.Sound.play('unlock');
          if (opts.onPass) opts.onPass();
        } else {
          if (WW.Sound) WW.Sound.play('oops');
          if (WW.events) WW.events.track('parent_gate_failed', { source: scope });
          status.textContent = 'That\'s not it. Have another go — or ask a grown-up.';
          status.className = 'beta-status bad';
          if (WW.FX) WW.FX.pulse(input, 'shake');
          input.value = '';
          input.focus();
        }
      }
      input.addEventListener('keydown', function (e) { if (e.key === 'Enter') check(); });

      var kids = [
        U.el('div', { class: 'gate-emoji', text: '🔒', 'aria-hidden': 'true' }),
        U.el('h3', { text: opts.title || 'Grown-ups only' }),
        U.el('p', { class: 'muted', text: opts.blurb ||
          'This area has settings, your child\'s progress report and an email sign-up, ' +
          'so we check that a grown-up is here. Please answer:' })
      ];
      if (ch.instruction) {
        kids.push(U.el('p', { class: 'gate-instruction', id: instructionId, text: ch.instruction }));
      }
      kids.push(U.el('p', { class: 'gate-sum', text: ch.sum }));
      kids.push(input);
      kids.push(WW.UI.bigButton('Enter', function () { check(); }, 'primary wide'));
      kids.push(status);
      if (opts.onCancel) {
        kids.push(U.el('button', {
          class: 'ghost-btn', text: opts.cancelText || '← Back to the game',
          onclick: function () { if (WW.Sound) WW.Sound.play('tap'); opts.onCancel(); }
        }));
      }

      var card = WW.UI.card('gate-card', kids);
      card.focusInput = function () { setTimeout(function () { input.focus(); }, 120); };
      return card;
    },

    /* Inline: fill a screen's body with the gate. Used by the Grown-Ups
       dashboard and the WonderWorld+ page. */
    render: function (container, opts) {
      if (!container) return null;
      var card = Gate.build(opts);
      container.innerHTML = '';
      container.appendChild(card);
      card.focusInput();
      return card;
    },

    /* Modal: ask for an adult without leaving the current screen. Used by the
       child-facing "Ask a Grown-Up" button. */
    require: function (opts) {
      opts = opts || {};
      if (opts.scope && Gate.isOpen(opts.scope) && opts.onPass) { opts.onPass(); return null; }
      var card = Gate.build({
        kind: opts.kind,
        scope: opts.scope,
        title: opts.title,
        blurb: opts.blurb,
        onPass: function () { WW.Modal.close(); if (opts.onPass) opts.onPass(); }
      });
      /* The card already carries its own heading, so the modal title is blank. */
      WW.Modal.open({
        body: card,
        actions: [{ text: opts.cancelText || 'Not now', onClick: function () {
          WW.Modal.close();
          if (opts.onCancel) opts.onCancel();
        } }]
      });
      card.focusInput();
      return card;
    }
  };

})(window.WW);
