/* =============================================================
   WonderWorld — game.js  (entry point)

   Load order (see index.html):
     js/core.js          engine: state, save, progression, FX, nav
     js/env.js           where are we running (dev vs production)
     js/events.js        first-party-only event interface
     js/entitlements.js  free vs WonderWorld+, content tiers
     js/billing.js       subscription facade + provider adapters
     js/profiles.js      Explorer roster and save-key seam
     js/sync.js          cloud-backup interface (no backend yet)
     js/parentgate.js    the reusable adult check
     js/screens.js       title, creator, map, tree, profile, parent
     js/plus.js          child premium prompt + grown-ups Plus page
     js/worlds/*.js      one module per world
     js/devtools.js      development-only tier simulator
     game.js             this file — boots everything

   Everything is vanilla JS. No build step, no server, no third-party
   script. The one network call in the whole client is the parent
   mailing-list signup.
   ============================================================= */
(function () {
  'use strict';

  var WW = window.WW;

  function boot() {
    /* 0. Make sure the Explorer roster exists before the save is read, so
          State.load() asks the right key. On an existing install this simply
          records that Explorer 1 is the save that is already there. */
    WW.profiles.ensure();

    /* 1. Load the save (or create a fresh one) */
    WW.State.load();
    WW.State.data.stats.sessions++;

    /* 1b. Load the subscription record (separate key, never inside the save)
           and re-check it with the billing provider. With no provider
           connected this is a no-op; once StoreKit is wired up it is what
           notices a cancelled or lapsed subscription at launch. */
    WW.entitlements.load();
    WW.billing.verify();

    /* 2. Apply accessibility settings before anything paints */
    WW.Settings.apply();

    /* 3. Wire up global DOM behaviour */
    WW.bootCore();

    /* 4. Prime the HUD */
    WW.HUD.update();

    /* 5. Keep the screen height correct on iOS (address bar shrink) */
    function setVH() {
      document.documentElement.style.setProperty('--vh', (window.innerHeight * 0.01) + 'px');
    }
    setVH();
    window.addEventListener('resize', setVH);
    window.addEventListener('orientationchange', function () { setTimeout(setVH, 250); });

    /* 6. Go! Returning players land on the title screen with Continue. */
    document.body.classList.remove('is-booting');
    WW.events.track('game_started', { status: WW.entitlements.status() });
    WW.Nav.go('title', { replace: true });

    /* 7. Save on the way out */
    window.addEventListener('beforeunload', function () { WW.State.save(true); });

    if (window.console && console.info) {
      console.info('%cWonderWorld ready 🌳', 'color:#8fe06a;font-weight:bold',
        '· level ' + WW.State.data.level + ' · ' + WW.Progress.crystalCount() + '/5 crystals');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
