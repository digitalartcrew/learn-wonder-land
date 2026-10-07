/* =============================================================
   WonderWorld — env.js
   Where is this copy of the game running?

   One job: answer `WW.env.isDev()` honestly, because that single
   answer decides whether the MOCK billing adapter is allowed to
   grant WonderWorld+. Everything about this file is deliberately
   biased towards saying "no".

   The rules, in order:
     1. A host listed in PRODUCTION_HOSTS is NEVER development.
        This is a hard stop that nothing below can override.
     2. An explicit `window.WW_DEV = true` set before the scripts
        load counts as development (for CI and for a wrapped
        native debug build).
     3. file:// counts — that is how the game is opened straight
        off disk while building content.
     4. localhost / 127.0.0.1 / *.local / private LAN ranges count,
        because that is the "test it on the iPad" workflow.
     5. Anything else — including an unknown public domain — is
        production.

   When no `location` exists at all (the headless logic tests run
   in a bare VM context) the answer is production. Tests opt INTO
   development explicitly; they never fall into it by accident.

   NOTE: this is a client-side signal, so it is a guard-rail and
   not a security boundary. The real authority for a paid
   entitlement is provider receipt verification — see
   docs/MONETIZATION.md, "Trust model".
   ============================================================= */
(function (WW) {
  'use strict';

  /* Add every real production hostname here. A custom domain MUST be
     added at the same time it is pointed at the site, or the mock
     adapter becomes reachable there. */
  var PRODUCTION_HOSTS = [
    'wonder-world-ckt.pages.dev'
  ];

  var DEV_HOSTS = ['localhost', '127.0.0.1', '::1', '[::1]', '0.0.0.0'];

  function loc() {
    try { return (typeof window !== 'undefined' && window.location) || null; }
    catch (e) { return null; }
  }
  function host() {
    var l = loc();
    return l && l.hostname ? String(l.hostname).toLowerCase() : '';
  }
  function protocol() {
    var l = loc();
    return l && l.protocol ? String(l.protocol) : '';
  }

  var Env = WW.env = {
    PRODUCTION_HOSTS: PRODUCTION_HOSTS,
    DEV_HOSTS: DEV_HOSTS,

    host: host,
    protocol: protocol,

    /* True only for a hostname we have explicitly declared as live. */
    isProductionHost: function () {
      return PRODUCTION_HOSTS.indexOf(host()) !== -1;
    },

    isDev: function () {
      /* 1. hard stop — a declared production host is never dev */
      if (Env.isProductionHost()) return false;

      /* 2. explicit opt-in */
      try { if (window.WW_DEV === true) return true; } catch (e) { /* no window */ }

      /* 3. opened straight off disk */
      if (protocol() === 'file:') return true;

      /* 4. local development and LAN device testing */
      var h = host();
      if (DEV_HOSTS.indexOf(h) !== -1) return true;
      if (/\.local$/.test(h)) return true;
      if (/^192\.168\./.test(h)) return true;
      if (/^10\./.test(h)) return true;
      if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return true;

      /* 5. everything else is production */
      return false;
    },

    /* Is the game running inside a native wrapper (Capacitor / WKWebView)?
       The wrapper is expected to expose a message handler with this exact
       name — see docs/MONETIZATION.md, "Apple StoreKit integration path". */
    nativeBridge: function () {
      try {
        var wk = window.webkit && window.webkit.messageHandlers;
        if (wk && wk.wonderworldBilling) return 'apple';
        if (window.Capacitor && window.Capacitor.isNativePlatform &&
            window.Capacitor.isNativePlatform()) return 'apple';
      } catch (e) { /* plain web */ }
      return null;
    },

    /* Human-readable, for the development panel only. */
    describe: function () {
      return {
        host: host() || '(none)',
        protocol: protocol() || '(none)',
        productionHost: Env.isProductionHost(),
        dev: Env.isDev(),
        nativeBridge: Env.nativeBridge()
      };
    }
  };

})(window.WW);
