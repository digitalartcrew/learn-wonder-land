/* =============================================================
   WonderWorld — events.js
   A privacy-conscious, first-party-only event interface.

   This is NOT analytics. Nothing here talks to the network, and
   there is no third-party SDK anywhere in the project. It exists
   so that product questions ("do grown-ups find the Plus page?")
   can one day be answered by a first-party endpoint WE write and
   WE document in the privacy policy — without having to retro-fit
   instrumentation through the whole game at that point.

   Until such an endpoint exists and is approved, every event
   lands in an in-memory ring buffer and, in development only, the
   console. `WW.events.sinks` is the single seam where a future
   first-party transport would be added.

   SAFETY RULES BAKED IN HERE
     • Property keys are allow-listed. Anything not on the list is
       dropped, so a careless caller cannot leak a new field.
     • Values are coerced to string/number/boolean and truncated.
     • Any string value matching the child's nickname is redacted,
       as a backstop against the most likely mistake.
     • No timestamps finer than the event itself, no device ids,
       no IP, no session stitching.
   ============================================================= */
(function (WW) {
  'use strict';

  var MAX_BUFFER = 200;
  var MAX_STRING = 64;

  /* The complete vocabulary. Adding an event name here is a deliberate act. */
  var NAMES = [
    'game_started', 'explorer_created', 'world_entered',
    'activity_started', 'activity_completed', 'level_up', 'crystal_earned',

    'premium_content_viewed', 'premium_prompt_shown', 'premium_help_requested',
    'parent_gate_started', 'parent_gate_completed', 'parent_gate_failed',
    'parent_dashboard_viewed', 'plus_page_viewed',

    'trial_started', 'subscription_started', 'subscription_restored',
    'subscription_manage_opened', 'entitlement_changed',

    'dev_tier_simulated'
  ];

  /* Property keys that may be attached to an event. Nothing else survives. */
  var ALLOWED_PROPS = [
    'world', 'contentId', 'feature', 'kind', 'screen', 'source',
    'tier', 'status', 'productId', 'provider', 'reason', 'result',
    'level', 'count', 'stars', 'crystals', 'simulated'
  ];

  function nickname() {
    try {
      var d = WW.State && WW.State.data;
      return (d && d.player && d.player.name) ? String(d.player.name).toLowerCase() : '';
    } catch (e) { return ''; }
  }

  function clean(props) {
    var out = {}, nick = nickname();
    if (!props || typeof props !== 'object') return out;
    ALLOWED_PROPS.forEach(function (k) {
      if (!Object.prototype.hasOwnProperty.call(props, k)) return;
      var v = props[k];
      if (v === null || v === undefined) return;
      if (typeof v === 'number') { out[k] = isFinite(v) ? v : 0; return; }
      if (typeof v === 'boolean') { out[k] = v; return; }
      var s = String(v).slice(0, MAX_STRING);
      /* backstop: never let the child's nickname ride along in any field */
      if (nick && s.toLowerCase() === nick) s = '[redacted]';
      out[k] = s;
    });
    return out;
  }

  var Events = WW.events = {
    NAMES: NAMES,
    ALLOWED_PROPS: ALLOWED_PROPS,

    buffer: [],

    /* Transports. Deliberately empty of anything that leaves the device.
       A future first-party sink would be pushed here and nowhere else. */
    sinks: [],

    enabled: true,

    track: function (name, props) {
      if (!Events.enabled) return null;
      if (NAMES.indexOf(name) === -1) {
        /* An unknown name is a bug, not a reason to crash a child's game. */
        if (WW.env && WW.env.isDev() && window.console && console.warn) {
          console.warn('WW.events: unknown event name "' + name + '" — add it to NAMES.');
        }
        return null;
      }
      var ev = { name: name, props: clean(props), at: Date.now() };
      Events.buffer.push(ev);
      if (Events.buffer.length > MAX_BUFFER) Events.buffer.shift();

      Events.sinks.forEach(function (sink) {
        try { sink(ev); } catch (e) { /* a broken sink must never break play */ }
      });
      return ev;
    },

    recent: function (n) { return Events.buffer.slice(-(n || 20)); },
    clear: function () { Events.buffer.length = 0; }
  };

  /* Development only: echo to the console so flows can be watched live. */
  if (WW.env && WW.env.isDev()) {
    Events.sinks.push(function (ev) {
      if (window.console && console.debug) {
        console.debug('%cWW.event', 'color:#bb8bff;font-weight:bold', ev.name, ev.props);
      }
    });
  }

})(window.WW);
