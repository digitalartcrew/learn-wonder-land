/* =============================================================
   WonderWorld — devtools.js
   A tier simulator, for development only.

   WHY IT EXISTS
   -------------
   Billing is not connected, but the whole WonderWorld+ experience
   still has to be designed, reviewed and tested: the child-facing
   prompt, the gate, the parent page, the trial banner, what an
   expired subscription looks like. This lets all of that be
   exercised today without inventing a fake payment path.

   WHY IT CANNOT LEAK INTO PRODUCTION
   ----------------------------------
   Three independent layers have to fail at once:

     1. WW.dev.available() is false unless WW.env.isDev(), and
        WW.env hard-stops on any host in PRODUCTION_HOSTS.
     2. The mock billing adapter's own isAvailable() repeats the
        same check, so calling it directly changes nothing.
     3. Every record the mock writes carries provider:'mock', and
        WW.entitlements refuses to honour a 'mock' record outside
        development — so even a record copied by hand into
        localStorage on the live site reads as 'free'.

   Nothing in this file is reachable from the child's game. The
   panel it builds is only ever rendered into the grown-ups area,
   and only in development.

   USING IT
   --------
     From the console:   WW.dev.setTier('plus')
     Valid tiers:        'free' | 'trial' | 'plus' | 'expired'
     From the UI:        Grown-Ups → Developer tools
   ============================================================= */
(function (WW) {
  'use strict';

  var U = WW.Util, UI = WW.UI;

  var TIERS = ['free', 'trial', 'plus', 'expired'];

  var Dev = WW.dev = {
    TIERS: TIERS,

    available: function () { return !!(WW.env && WW.env.isDev()); },

    /* Simulate a subscription state. Resolves to a billing Result. */
    setTier: function (tier) {
      if (!Dev.available()) {
        if (window.console && console.warn) {
          console.warn('WW.dev is development-only and is inert here.');
        }
        return { ok: false, reason: 'not_available' };
      }
      if (TIERS.indexOf(tier) === -1) return { ok: false, reason: 'unknown_tier' };
      var res = WW.billing.providers.mock._simulate(tier);
      if (WW.events) WW.events.track('dev_tier_simulated', { tier: tier, simulated: true });
      return res;
    },

    state: function () {
      return {
        env: WW.env.describe(),
        status: WW.entitlements.status(),
        simulated: WW.entitlements.isSimulated(),
        provider: WW.billing.providerName(),
        billingAvailable: WW.billing.isAvailable(),
        profiles: { used: WW.profiles.usedSlots(), max: WW.profiles.maxSlots() }
      };
    },

    /* A card for the grown-ups area. Returns null in production, so the
       caller can append it unconditionally. */
    panel: function (onChange) {
      if (!Dev.available()) return null;

      var card = UI.card('dev-card', [
        U.el('h3', { text: '🛠️ Developer tools' }),
        U.el('p', { class: 'dev-note', text:
          'DEVELOPMENT ONLY. This panel is not present in production, and the states it ' +
          'sets are simulated locally — they are never real subscriptions.' })
      ]);

      var status = U.el('p', { class: 'muted small', role: 'status' });
      function refresh() {
        var s = WW.entitlements.status();
        status.textContent = 'Simulated tier: ' + s +
          (WW.entitlements.isSimulated() ? ' (mock provider)' : ' (no mock record)') +
          ' · host: ' + (WW.env.host() || 'file://');
      }

      var row = U.el('div', { class: 'dev-tiers' });
      TIERS.forEach(function (t) {
        row.appendChild(U.el('button', {
          class: 'chip dev-chip',
          text: t,
          'aria-label': 'Simulate ' + t + ' tier',
          onclick: function () {
            Dev.setTier(t);
            refresh();
            if (onChange) onChange(t);
          }
        }));
      });
      card.appendChild(row);
      card.appendChild(status);
      refresh();
      return card;
    }
  };

  /* A one-line reminder in the console, development only. */
  if (Dev.available() && window.console && console.info) {
    console.info('%cWW.dev ready', 'color:#ffcf3d;font-weight:bold',
      "· WW.dev.setTier('free'|'trial'|'plus'|'expired')");
  }

})(window.WW);
