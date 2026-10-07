/* =============================================================
   WonderWorld — billing.js
   The ONLY place in the game that knows what a subscription is.

   Game and UI code calls WW.billing.*. It never calls StoreKit, a
   payment SDK, or any web checkout directly. When Apple billing is
   connected, exactly one file changes: the `apple` provider below.

   PROVIDER INTERFACE
   ------------------
   Every provider implements:

     name                     string
     isAvailable()            boolean — can this provider transact here?
     products()               array of PRODUCTS entries it can sell
     startTrial(productId)    -> Promise<Result>
     purchase(productId)      -> Promise<Result>
     restorePurchases()       -> Promise<Result>
     manageSubscription()     -> Promise<Result>
     verify()                 -> Promise<Result>   re-check with the source of truth

   Result is always:
     { ok: boolean, reason: string|null, status: string|null }

   A provider NEVER writes to localStorage itself. It verifies, then
   hands a record to WW.entitlements.apply(). That keeps "what the
   player is entitled to" in one place and "how we found out" in
   another.

   WHAT IS AND IS NOT IMPLEMENTED TODAY
   ------------------------------------
     mock   implemented — development and testing only. Refuses to
            work unless WW.env.isDev(), and the records it writes
            carry provider:'mock', which WW.entitlements ignores on
            a production host.
     apple  documented stub. Every method resolves { ok:false,
            reason:'not_connected' }. The native bridge contract is
            written out in docs/MONETIZATION.md.
     web    documented stub. Same shape. No processor is chosen yet.

   There is deliberately no fake production purchase path. If
   billing is not connected, the UI says so plainly.
   ============================================================= */
(function (WW) {
  'use strict';

  /* -----------------------------------------------------------
     PRODUCT CATALOGUE
     The single source of truth for every price string shown in the
     app. Nothing child-facing is allowed to import from here.
     ----------------------------------------------------------- */
  var PRODUCTS = {
    plus_annual: {
      id: 'plus_annual',
      name: 'WonderWorld+ Annual',
      /* Store product identifiers. Must match App Store Connect exactly. */
      appleProductId: 'com.wonderworld.plus.annual',
      period: 'year',
      priceLabel: '$39.99/year',
      perMonthLabel: 'about $3.33/month',
      trialDays: 7,
      trialLabel: '7 Days Free',
      afterTrialLabel: '$39.99/year after your free trial',
      recommended: true,
      badge: 'BEST VALUE'
    },
    plus_monthly: {
      id: 'plus_monthly',
      name: 'WonderWorld+ Monthly',
      appleProductId: 'com.wonderworld.plus.monthly',
      period: 'month',
      priceLabel: '$6.99/month',
      perMonthLabel: null,
      trialDays: 0,
      trialLabel: null,
      afterTrialLabel: null,
      recommended: false,
      badge: null
    }
  };

  var DAY = 86400000;

  function result(ok, reason, status) {
    return { ok: !!ok, reason: reason || null, status: status || null };
  }
  function settled(v) {
    return (window.Promise ? Promise.resolve(v) : { then: function (f) { f(v); return this; } });
  }

  /* ===========================================================
     MOCK PROVIDER — DEVELOPMENT ONLY
     ===========================================================
     This exists so the complete Plus experience can be designed,
     reviewed and tested before StoreKit is wired up. It is not a
     payment path and must never become one.

     Two independent guards keep it out of production:
       1. isAvailable() is false unless WW.env.isDev().
       2. The records it writes carry provider:'mock', and
          WW.entitlements only honours those in development.
     =========================================================== */
  var mock = {
    name: 'mock',

    isAvailable: function () { return !!(WW.env && WW.env.isDev()); },

    products: function () { return [PRODUCTS.plus_annual, PRODUCTS.plus_monthly]; },

    /* The work itself, done synchronously because there is no store to wait
       for. The interface methods below wrap it in a Promise so that every
       provider looks the same to callers; the dev helper uses it directly. */
    _grant: function (kind, productId) {
      if (!mock.isAvailable()) return result(false, 'not_available');
      var p = PRODUCTS[productId];
      if (!p) return result(false, 'unknown_product');
      var now = Date.now();

      if (kind === 'trial') {
        var days = p.trialDays || 7;
        WW.entitlements.apply({
          status: 'trial', productId: p.id, provider: 'mock',
          trialStartedAt: now, trialEndsAt: now + days * DAY,
          renewsAt: now + days * DAY, entitlementVerifiedAt: now
        });
        if (WW.events) WW.events.track('trial_started', { productId: p.id, provider: 'mock', simulated: true });
        return result(true, null, 'trial');
      }

      WW.entitlements.apply({
        status: 'plus', productId: p.id, provider: 'mock',
        trialStartedAt: null, trialEndsAt: null,
        renewsAt: now + (p.period === 'year' ? 365 : 30) * DAY,
        entitlementVerifiedAt: now
      });
      if (WW.events) WW.events.track('subscription_started', { productId: p.id, provider: 'mock', simulated: true });
      return result(true, null, 'plus');
    },

    startTrial: function (productId) { return settled(mock._grant('trial', productId)); },
    purchase: function (productId) { return settled(mock._grant('plus', productId)); },

    restorePurchases: function () {
      if (!mock.isAvailable()) return settled(result(false, 'not_available'));
      /* Nothing to restore from: there is no store behind this adapter.
         It reports honestly rather than inventing a subscription. */
      var status = WW.entitlements.status();
      if (status === 'plus' || status === 'trial') {
        if (WW.events) WW.events.track('subscription_restored', { provider: 'mock', simulated: true });
        return settled(result(true, null, status));
      }
      return settled(result(false, 'nothing_to_restore', 'free'));
    },

    manageSubscription: function () {
      if (!mock.isAvailable()) return settled(result(false, 'not_available'));
      return settled(result(true, 'simulated', WW.entitlements.status()));
    },

    verify: function () {
      return settled(result(mock.isAvailable(), mock.isAvailable() ? null : 'not_available',
        WW.entitlements.status()));
    },

    /* Development helper used by WW.dev. NOT part of the provider interface,
       and deliberately synchronous so a test can assert on the result. */
    _simulate: function (tier) {
      if (!mock.isAvailable()) return result(false, 'not_available');
      var now = Date.now();
      if (tier === 'free') { WW.entitlements.clear(); return result(true, null, 'free'); }
      if (tier === 'trial') return mock._grant('trial', 'plus_annual');
      if (tier === 'plus') return mock._grant('plus', 'plus_annual');
      if (tier === 'expired') {
        WW.entitlements.apply({
          status: 'expired', productId: 'plus_annual', provider: 'mock',
          trialStartedAt: now - 8 * DAY, trialEndsAt: now - DAY,
          renewsAt: null, entitlementVerifiedAt: now
        });
        return result(true, null, 'expired');
      }
      return result(false, 'unknown_tier');
    }
  };

  /* ===========================================================
     APPLE PROVIDER — STUB
     ===========================================================
     Intentionally not implemented. When the game is wrapped for
     iOS, this is the only file that needs to change.

     Expected native bridge (see docs/MONETIZATION.md for the full
     contract and the Swift side):

       window.webkit.messageHandlers.wonderworldBilling.postMessage(
         { action: 'purchase' | 'startTrial' | 'restore' | 'manage'
                   | 'verify',
           productId: 'com.wonderworld.plus.annual',
           requestId: '<uuid>' })

     The native layer performs the StoreKit 2 transaction, validates
     the signed transaction, and calls back into:

       WW.billing.providers.apple._receive({ requestId, ok, status,
         productId, expiresAt, reason })

     _receive is the ONLY way a real entitlement is ever granted.
     It is already written, so the native side has a fixed target.
     =========================================================== */
  var apple = {
    name: 'apple',

    _pending: {},

    isAvailable: function () {
      return !!(WW.env && WW.env.nativeBridge() === 'apple' && apple._bridge());
    },

    _bridge: function () {
      try {
        var wk = window.webkit && window.webkit.messageHandlers;
        return (wk && wk.wonderworldBilling) || null;
      } catch (e) { return null; }
    },

    products: function () { return [PRODUCTS.plus_annual, PRODUCTS.plus_monthly]; },

    _send: function (action, productId) {
      if (!apple.isAvailable()) return settled(result(false, 'not_connected'));
      /* Deliberately left to the integration step — see the doc. The shape is
         fixed so the native side can be written against it today. */
      return settled(result(false, 'not_connected'));
    },

    startTrial: function (productId) { return apple._send('startTrial', productId); },
    purchase: function (productId) { return apple._send('purchase', productId); },
    restorePurchases: function () { return apple._send('restore'); },
    manageSubscription: function () { return apple._send('manage'); },
    verify: function () { return apple._send('verify'); },

    /* Called BY the native layer after StoreKit has verified a transaction.
       This is the only trusted path to a real entitlement on iOS. */
    _receive: function (msg) {
      if (!msg || !msg.ok) return result(false, (msg && msg.reason) || 'failed');
      var now = Date.now();
      WW.entitlements.apply({
        status: msg.status === 'trial' ? 'trial' : (msg.status === 'expired' ? 'expired' : 'plus'),
        productId: msg.productId || null,
        provider: 'apple',
        trialStartedAt: msg.trialStartedAt || null,
        trialEndsAt: msg.trialEndsAt || null,
        renewsAt: msg.expiresAt || null,
        entitlementVerifiedAt: now
      });
      return result(true, null, WW.entitlements.status());
    }
  };

  /* ===========================================================
     WEB PROVIDER — STUB
     ===========================================================
     For selling on the open web (outside the App Store). No
     processor has been chosen, and nothing here transacts.

     The intended shape: a first-party endpoint on this same origin
     starts a hosted checkout, the processor's webhook writes the
     subscription server-side, and verify() asks OUR server — never
     the processor directly from the browser — for the current
     entitlement. The browser is never the authority.
     =========================================================== */
  var web = {
    name: 'web',
    isAvailable: function () { return false; },
    products: function () { return [PRODUCTS.plus_annual, PRODUCTS.plus_monthly]; },
    startTrial: function () { return settled(result(false, 'not_connected')); },
    purchase: function () { return settled(result(false, 'not_connected')); },
    restorePurchases: function () { return settled(result(false, 'not_connected')); },
    manageSubscription: function () { return settled(result(false, 'not_connected')); },
    verify: function () { return settled(result(false, 'not_connected')); }
  };

  /* ===========================================================
     THE FACADE
     =========================================================== */
  var Billing = WW.billing = {
    PRODUCTS: PRODUCTS,
    providers: { mock: mock, apple: apple, web: web },

    _name: null,

    /* Pick a provider. Preference order:
         a real native store  >  a real web processor  >  the dev mock
       The mock is last and only ever in development. */
    autoSelect: function () {
      if (apple.isAvailable()) return 'apple';
      if (web.isAvailable()) return 'web';
      if (mock.isAvailable()) return 'mock';
      return null;
    },

    use: function (name) {
      if (!Billing.providers[name]) return null;
      Billing._name = name;
      return Billing.providers[name];
    },

    providerName: function () {
      if (!Billing._name) Billing._name = Billing.autoSelect();
      return Billing._name;
    },

    provider: function () {
      var n = Billing.providerName();
      return n ? Billing.providers[n] : null;
    },

    /* Can anything be bought from here at all? */
    isAvailable: function () {
      var p = Billing.provider();
      return !!(p && p.isAvailable());
    },

    /* True when the only thing available is the development simulator —
       the UI uses this to label itself honestly. */
    isSimulatedOnly: function () { return Billing.providerName() === 'mock'; },

    product: function (id) { return PRODUCTS[id] || null; },
    productList: function () { return [PRODUCTS.plus_annual, PRODUCTS.plus_monthly]; },

    _call: function (method, arg) {
      var p = Billing.provider();
      if (!p) return settled(result(false, 'not_connected'));
      try { return p[method](arg); }
      catch (e) { return settled(result(false, 'provider_error')); }
    },

    startTrial: function (productId) { return Billing._call('startTrial', productId); },
    purchase: function (productId) { return Billing._call('purchase', productId); },
    restorePurchases: function () { return Billing._call('restorePurchases'); },
    manageSubscription: function () { return Billing._call('manageSubscription'); },

    /* Re-ask the source of truth. Should be called on launch once a real
       provider exists, so a cancelled or lapsed subscription is noticed. */
    verify: function () { return Billing._call('verify'); }
  };

})(window.WW);
