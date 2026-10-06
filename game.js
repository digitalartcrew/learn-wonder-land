/* =============================================================
   WonderWorld — game.js  (entry point)

   Load order (see index.html):
     js/core.js        engine: state, save, progression, FX, nav
     js/screens.js     title, creator, map, tree, profile, parent
     js/worlds/*.js    one module per world
     game.js           this file — boots everything

   Everything is vanilla JS. No build step, no server, no network.
   ============================================================= */
(function () {
  'use strict';

  var WW = window.WW;

  function boot() {
    /* 1. Load the save (or create a fresh one) */
    WW.State.load();
    WW.State.data.stats.sessions++;

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
