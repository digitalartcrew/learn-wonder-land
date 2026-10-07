/* =============================================================
   WonderWorld — sync.js
   The interface for cloud backup. No backend, by design.

   OFFLINE-FIRST, ALWAYS
   ---------------------
   localStorage stays the source of truth on the device. Sync is a
   backup and a transport between a family's own devices — never a
   dependency. Pulling the plug on the server must leave the game
   exactly as playable as it is today, which is why nothing in the
   game ever awaits a sync call.

   WHY THERE IS NO IMPLEMENTATION HERE
   -----------------------------------
   Uploading a child's save means uploading their nickname, their
   avatar and their answer history. That needs a privacy review, a
   data-retention policy, a deletion path and a published update to
   privacy.html before a single byte leaves the device. None of
   that is done, so `providers.none` is the only provider, and it
   reports honestly that there is nowhere to sync to.

   The shape below is what a first-party provider must implement.
   See docs/MONETIZATION.md, "Cloud backup".

   WHEN IT IS BUILT, THE NON-NEGOTIABLES
   -------------------------------------
     • First-party endpoint on our own origin. No third-party
       storage SDK in the client.
     • Opt-in by a grown-up, behind the parental gate.
     • A visible delete-everything control.
     • Minimised payload: progress only. No free text beyond the
       nickname the child chose, which is already warned about in
       the character creator.
   ============================================================= */
(function (WW) {
  'use strict';

  function settled(v) {
    return (window.Promise ? Promise.resolve(v) : { then: function (f) { f(v); return this; } });
  }

  /* -----------------------------------------------------------
     PROVIDER INTERFACE

       name              string
       isAvailable()     boolean
       push(payload)     -> Promise<{ok, reason, at}>
       pull()            -> Promise<{ok, reason, payload}>
       status()          -> Promise<{ok, state, lastPushedAt, lastPulledAt}>
     ----------------------------------------------------------- */

  var none = {
    name: 'none',
    isAvailable: function () { return false; },
    push: function () { return settled({ ok: false, reason: 'no_provider', at: null }); },
    pull: function () { return settled({ ok: false, reason: 'no_provider', payload: null }); },
    status: function () {
      return settled({ ok: true, state: 'local-only', lastPushedAt: null, lastPulledAt: null });
    }
  };

  /* Documented target for the future first-party service. Left unimplemented
     on purpose: a stub that pretended to work would be worse than none. */
  var firstParty = {
    name: 'first-party',
    isAvailable: function () { return false; },
    push: function () { return settled({ ok: false, reason: 'not_implemented', at: null }); },
    pull: function () { return settled({ ok: false, reason: 'not_implemented', payload: null }); },
    status: function () {
      return settled({ ok: false, state: 'not_implemented', lastPushedAt: null, lastPulledAt: null });
    }
  };

  var Sync = WW.sync = {
    providers: { none: none, firstParty: firstParty },
    _name: 'none',

    use: function (name) {
      if (!Sync.providers[name]) return null;
      Sync._name = name;
      return Sync.providers[name];
    },
    provider: function () { return Sync.providers[Sync._name] || none; },

    /* Cloud backup is a WonderWorld+ feature AND needs a working provider.
       Both must be true; neither alone is enough. */
    isAvailable: function () {
      var entitled = !WW.entitlements || WW.entitlements.hasFeature('cloud-sync');
      return !!(entitled && Sync.provider().isAvailable());
    },

    /* What would be uploaded. Built here so the payload is reviewable in one
       place rather than assembled at the call site. */
    payload: function () {
      var d = WW.State && WW.State.data;
      if (!d) return null;
      return {
        schema: 'wonderworld.save.v1',
        profileId: WW.profiles ? WW.profiles.active().id : 'explorer-1',
        savedAt: Date.now(),
        data: d
      };
    },

    push: function () {
      if (!Sync.isAvailable()) return settled({ ok: false, reason: 'not_available', at: null });
      return Sync.provider().push(Sync.payload());
    },

    pull: function () {
      if (!Sync.isAvailable()) return settled({ ok: false, reason: 'not_available', payload: null });
      return Sync.provider().pull();
    },

    status: function () { return Sync.provider().status(); },

    /* Synchronous summary for the grown-ups UI, which must not block. */
    describe: function () {
      if (!WW.entitlements || !WW.entitlements.hasFeature('cloud-sync')) {
        return { state: 'needs-plus', text: 'Included with WonderWorld+.' };
      }
      if (!Sync.provider().isAvailable()) {
        return { state: 'not-ready', text: 'Progress backup is still being built. ' +
          'Your progress is saved on this device, and you can export a copy below.' };
      }
      return { state: 'ready', text: 'Progress backup is on.' };
    }
  };

})(window.WW);
