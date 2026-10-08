/* =============================================================
   WonderWorld — entitlements.js
   Who is allowed to open what, and why.

   TWO INDEPENDENT AXES
   --------------------
   Every piece of content has a LEARNING requirement and a TIER.

     LEARNING  earned by playing. XP thresholds, restored crystals.
               Money can never satisfy this.
     TIER      'free' or 'plus'. A WonderWorld+ subscription
               satisfies this. Learning can never satisfy it.

   Both must pass. WonderSpace is the first piece of content that
   needs both, and the ordering matters: if the child has not
   restored all five crystals we show the LEARNING message, never
   the subscription one, because a subscriber with zero crystals
   must not be able to skip ahead.

   HOW FUTURE CONTENT DECLARES ITSELF
   ----------------------------------
   A world declares `tier: 'free'` or `tier: 'plus'` in its entry
   in WW.Data.worlds (core.js). Its learning requirement already
   lives there as `unlockXP` / `requiresCrystals`, and this module
   reads those rather than copying them — one source of truth.

   A non-world capability declares itself in FEATURES below.

   WHERE THE SUBSCRIPTION RECORD LIVES
   -----------------------------------
   In its own localStorage key, NEVER inside the child's save.
   The child's save stays exactly what it has always been, so
   nothing here can corrupt a game in progress, and a subscription
   is a property of the grown-up's account rather than of any one
   Explorer.

   TRUST MODEL
   -----------
   A record is only honoured if its provider is trusted:
     'apple' / 'web'  — written after real receipt verification.
     'mock'           — development only. Honoured ONLY when
                        WW.env.isDev() is true, so a mock record
                        copied onto a production host is inert.
   See docs/MONETIZATION.md.
   ============================================================= */
(function (WW) {
  'use strict';

  var STORE_KEY = 'wonderworld.entitlement.v1';

  /* Providers whose records are accepted in production. */
  var TRUSTED_PROVIDERS = ['apple', 'web'];

  /* Non-world capabilities. `tier` is the only thing that gates them. */
  var FEATURES = {
    /* --- free, and staying free --- */
    'core-adventure':        { tier: 'free', name: 'The five-crystal adventure' },
    'local-save':            { tier: 'free', name: 'Progress saved on this device' },
    'basic-parent-reports':  { tier: 'free', name: 'Progress summary for grown-ups' },
    'accessibility':         { tier: 'free', name: 'Accessibility settings' },
    'read-aloud':            { tier: 'free', name: 'Read-aloud and audio' },

    /* --- WonderWorld+ --- */
    /* WonderTutor is the one Plus feature with a real marginal cost per use,
       so unlike the others it also carries a fair-use ceiling. That lives in
       WW.tutor.ACCESS, not here: this answers "may they", not "how much". */
    'wonder-tutor':             { tier: 'plus', name: 'WonderTutor',
                                  blurb: 'A personal learning guide that teaches at exactly the right level.' },

    'multi-profile':            { tier: 'plus', name: 'Multiple Explorer profiles',
                                  blurb: 'Up to four Explorers, each with their own adventure.' },
    'advanced-parent-reports':  { tier: 'plus', name: 'Advanced learning reports',
                                  blurb: 'Per-subject detail, strengths and practice suggestions.' },
    'long-history':             { tier: 'plus', name: 'Longer progress history',
                                  blurb: 'Keeps far more of the activity log.' },
    'cloud-sync':               { tier: 'plus', name: 'Progress backup',
                                  blurb: 'Back up and move progress between devices.' },
    'extra-story-chapters':     { tier: 'plus', name: 'Extra Story Forest chapters' },
    'extra-math-modes':         { tier: 'plus', name: 'More Math adventures' },
    'premium-cosmetics':        { tier: 'plus', name: 'More ways to customise your Explorer',
                                  blurb: 'Included with WonderWorld+ — never sold separately.' }
  };

  /* Friendly slugs, so callers may use either `canAccess('math-island')`
     or the internal world id `canAccess('math')`. */
  var SLUGS = {
    'math-island': 'math',
    'story-forest': 'story',
    'science-lab': 'science',
    'planet-city': 'city',
    'business-town': 'business',
    'wonder-space': 'space'
  };

  /* -----------------------------------------------------------
     CONTENT REGISTRY
     ----------------------------------------------------------- */
  var Content = WW.Content = {
    FEATURES: FEATURES,
    SLUGS: SLUGS,

    /* Extra content registered at runtime by a future world module. */
    extra: {},

    /* Resolve 'math' | 'math-island' -> the WW.Data.worlds entry */
    world: function (id) {
      var key = SLUGS[id] || id;
      var list = (WW.Data && WW.Data.worlds) || [];
      for (var i = 0; i < list.length; i++) if (list[i].id === key) return list[i];
      return null;
    },

    feature: function (id) {
      return FEATURES[id] || Content.extra[id] || null;
    },

    /* 'free' | 'plus' | null if we have never heard of it.
       A world with no `tier` is treated as free — content is free
       unless it says otherwise, which is the safe default. */
    tierOf: function (id) {
      var w = Content.world(id);
      if (w) return w.tier === 'plus' ? 'plus' : 'free';
      var f = Content.feature(id);
      if (f) return f.tier === 'plus' ? 'plus' : 'free';
      return null;
    },

    /* Everything WonderWorld+ currently includes, for the parent page. */
    plusCatalogue: function () {
      var out = [];
      ((WW.Data && WW.Data.worlds) || []).forEach(function (w) {
        if (w.tier === 'plus') out.push({ id: w.id, name: w.name, emoji: w.emoji, kind: 'world' });
      });
      Object.keys(FEATURES).forEach(function (k) {
        if (FEATURES[k].tier === 'plus') {
          out.push({ id: k, name: FEATURES[k].name, blurb: FEATURES[k].blurb, kind: 'feature' });
        }
      });
      return out;
    },

    /* Future worlds/adventures call this instead of editing this file. */
    register: function (id, def) {
      Content.extra[id] = { tier: def && def.tier === 'plus' ? 'plus' : 'free',
                            name: (def && def.name) || id, blurb: def && def.blurb };
      return Content.extra[id];
    }
  };

  /* -----------------------------------------------------------
     ENTITLEMENT RECORD
     ----------------------------------------------------------- */
  function defaults() {
    return {
      version: 1,
      status: 'free',             /* free | trial | plus | expired */
      productId: null,
      provider: 'none',           /* none | mock | apple | web */
      trialStartedAt: null,
      trialEndsAt: null,
      renewsAt: null,
      entitlementVerifiedAt: null,
      updatedAt: null
    };
  }

  var Ent = WW.entitlements = {
    STORE_KEY: STORE_KEY,
    TRUSTED_PROVIDERS: TRUSTED_PROVIDERS,

    _record: null,
    _listeners: [],

    /* ---------- storage ---------- */
    load: function () {
      var raw = null;
      try { raw = window.localStorage.getItem(STORE_KEY); } catch (e) { raw = null; }
      var rec = defaults();
      if (raw) {
        try {
          var parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object') {
            Object.keys(rec).forEach(function (k) {
              if (parsed[k] !== undefined) rec[k] = parsed[k];
            });
          }
        } catch (e) { /* corrupt record → treat as free, never as paid */ }
      }
      Ent._record = rec;
      return rec;
    },

    record: function () {
      if (!Ent._record) Ent.load();
      return Ent._record;
    },

    persist: function () {
      try { window.localStorage.setItem(STORE_KEY, JSON.stringify(Ent.record())); }
      catch (e) { /* private mode — entitlement simply will not survive the session */ }
    },

    /* Written by billing adapters only. */
    apply: function (patch) {
      var rec = Ent.record();
      Object.keys(patch || {}).forEach(function (k) {
        if (k in rec) rec[k] = patch[k];
      });
      rec.updatedAt = Date.now();
      Ent.persist();
      if (WW.events) {
        WW.events.track('entitlement_changed',
          { status: Ent.status(), provider: rec.provider, productId: rec.productId });
      }
      Ent._listeners.forEach(function (fn) { try { fn(rec); } catch (e) {} });
      return rec;
    },

    onChange: function (fn) { if (typeof fn === 'function') Ent._listeners.push(fn); },

    clear: function () {
      Ent._record = defaults();
      try { window.localStorage.removeItem(STORE_KEY); } catch (e) {}
      Ent._listeners.forEach(function (fn) { try { fn(Ent._record); } catch (e) {} });
      return Ent._record;
    },

    /* ---------- trust ---------- */

    /* A record only counts if we believe where it came from. */
    recordIsTrusted: function () {
      var rec = Ent.record();
      if (TRUSTED_PROVIDERS.indexOf(rec.provider) !== -1) return true;
      /* The mock adapter is a development tool and nothing else. */
      if (rec.provider === 'mock') return !!(WW.env && WW.env.isDev());
      return false;
    },

    /* ---------- status ---------- */

    /* Effective status, with an elapsed trial downgraded to 'expired'.
       An untrusted record always reads as 'free'. */
    status: function () {
      var rec = Ent.record();
      if (!Ent.recordIsTrusted()) return 'free';
      if (rec.status === 'trial') {
        if (rec.trialEndsAt && Date.now() > rec.trialEndsAt) return 'expired';
        return 'trial';
      }
      if (rec.status === 'plus') return 'plus';
      if (rec.status === 'expired') return 'expired';
      return 'free';
    },

    isPlus: function () {
      var s = Ent.status();
      return s === 'plus' || s === 'trial';
    },
    isTrial: function () { return Ent.status() === 'trial'; },
    isExpired: function () { return Ent.status() === 'expired'; },

    /* True when Plus is only active because of a development mock. */
    isSimulated: function () {
      return Ent.isPlus() && Ent.record().provider === 'mock';
    },

    trialDaysLeft: function () {
      var rec = Ent.record();
      if (Ent.status() !== 'trial' || !rec.trialEndsAt) return 0;
      return Math.max(0, Math.ceil((rec.trialEndsAt - Date.now()) / 86400000));
    },

    /* ---------- access ---------- */

    /* Does the child's LEARNING satisfy this world?
       Reads the world's own fields so there is one source of truth. */
    learningMet: function (world) {
      if (!world) return true;

      /* A crystal requirement is recomputed from the crystals themselves every
         time, and is never satisfied by the persisted `unlocked` flag. This is
         the specific guard that stops a subscription from skipping ahead. */
      if (world.requiresCrystals) {
        return !!(WW.Progress && WW.Progress.crystalCount() >= 5);
      }

      /* For XP worlds the persisted flag is authoritative once set, so the map
         and the entitlement layer can never disagree about what is open. */
      var d = WW.State && WW.State.data;
      if (d && d.unlocked && d.unlocked[world.id]) return true;

      if (world.unlockXP === null || world.unlockXP === undefined) return true;
      return (d ? d.xp : 0) >= world.unlockXP;
    },

    /* The full answer, with the reason — used by every caller that needs
       to show a message rather than just open or not open something. */
    check: function (id) {
      var world = Content.world(id);
      var tier = Content.tierOf(id);
      if (tier === null) {
        /* Unknown content: refuse, loudly in development. */
        if (WW.env && WW.env.isDev() && window.console && console.warn) {
          console.warn('WW.entitlements: unknown content id "' + id + '"');
        }
        return { id: id, known: false, allowed: false, tier: null, blockedBy: 'unknown' };
      }

      var needsPlus = tier === 'plus';
      var tierOk = !needsPlus || Ent.isPlus();
      var learnOk = world ? Ent.learningMet(world) : true;

      /* LEARNING IS CHECKED FIRST AND REPORTED FIRST.
         A subscriber who has not earned the content still cannot open it. */
      var blockedBy = null;
      if (!learnOk) blockedBy = 'learning';
      else if (!tierOk) blockedBy = 'plus';

      return {
        id: id,
        known: true,
        world: world ? world.id : null,
        tier: tier,
        allowed: learnOk && tierOk,
        learningMet: learnOk,
        tierMet: tierOk,
        needsPlus: needsPlus,
        blockedBy: blockedBy,
        /* A child-safe sentence about the learning requirement, never about money. */
        learningHint: world
          ? (world.requiresCrystals
              ? 'Restore all 5 Knowledge Crystals first.'
              : (world.unlockXP ? 'Opens at ' + world.unlockXP + ' XP.' : ''))
          : ''
      };
    },

    canAccess: function (id) { return Ent.check(id).allowed === true; },

    hasFeature: function (id) {
      var f = Content.feature(id);
      if (!f) {
        if (WW.env && WW.env.isDev() && window.console && console.warn) {
          console.warn('WW.entitlements: unknown feature id "' + id + '"');
        }
        return false;
      }
      return f.tier !== 'plus' || Ent.isPlus();
    },

    /* ---------- tier-dependent limits ---------- */

    /* How many Explorers this account may have. Architecture only for now —
       see js/profiles.js. */
    maxProfiles: function () { return Ent.hasFeature('multi-profile') ? 4 : 1; },

    /* How many activities the parent dashboard keeps. 60 is exactly what the
       game has always kept, so free players lose nothing. */
    historyLimit: function () { return Ent.hasFeature('long-history') ? 400 : 60; }
  };

})(window.WW);
