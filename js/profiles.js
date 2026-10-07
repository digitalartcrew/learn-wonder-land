/* =============================================================
   WonderWorld — profiles.js
   Architecture for several Explorers under one grown-up.

        Parent / device
            ├── Explorer 1   ← the existing save, untouched
            ├── Explorer 2   ┐
            ├── Explorer 3   ├ WonderWorld+ only
            └── Explorer 4   ┘

   THE ONE RULE: DO NOT TOUCH `wonderworld.save.v1`
   ------------------------------------------------
   Every player who already has progress has it under that exact
   key. So the migration is not a migration at all — it is a
   roster that POINTS AT the key that is already there:

       explorer-1.saveKey === 'wonderworld.save.v1'

   No data is copied, moved, rewritten or deleted. If this whole
   file were removed tomorrow, core.js falls back to the same key
   and every save still loads. That is the point.

   Additional Explorers get their own keys, derived and suffixed:

       wonderworld.save.v1.explorer-2

   WHAT IS WIRED UP TODAY
   ----------------------
   The roster, the migration, slot accounting against the
   entitlement, and the `activeSaveKey()` seam that core.js reads.
   Creating and switching Explorers is implemented but is NOT
   exposed in the UI yet — the grown-ups area lists the roster
   read-only. Shipping the switcher needs a child-facing "who is
   playing?" screen, which is its own piece of design work.
   See docs/MONETIZATION.md, "Multiple Explorer profiles".
   ============================================================= */
(function (WW) {
  'use strict';

  var ROSTER_KEY = 'wonderworld.profiles.v1';

  /* The key the game has always used. Explorer 1 keeps it forever. */
  var LEGACY_SAVE_KEY = 'wonderworld.save.v1';

  var FIRST_ID = 'explorer-1';

  function read(key) {
    try { return window.localStorage.getItem(key); } catch (e) { return null; }
  }
  function write(key, value) {
    try { window.localStorage.setItem(key, value); return true; } catch (e) { return false; }
  }

  function freshRoster() {
    var now = Date.now();
    var roster = { version: 1, activeId: FIRST_ID, order: [FIRST_ID], profiles: {} };
    roster.profiles[FIRST_ID] = {
      id: FIRST_ID,
      label: 'Explorer 1',
      saveKey: LEGACY_SAVE_KEY,     /* <- the existing save, in place */
      legacy: true,
      createdAt: now
    };
    return roster;
  }

  var Profiles = WW.profiles = {
    ROSTER_KEY: ROSTER_KEY,
    LEGACY_SAVE_KEY: LEGACY_SAVE_KEY,

    _roster: null,

    /* ---------- roster ---------- */

    /* Create the roster if it does not exist. Never destructive: an existing
       save is adopted by Explorer 1 exactly where it already lives. */
    ensure: function () {
      if (Profiles._roster) return Profiles._roster;
      var raw = read(ROSTER_KEY), roster = null;
      if (raw) {
        try {
          var parsed = JSON.parse(raw);
          if (parsed && parsed.profiles && parsed.profiles[parsed.activeId]) roster = parsed;
        } catch (e) { roster = null; }
      }
      if (!roster) {
        roster = freshRoster();
        write(ROSTER_KEY, JSON.stringify(roster));
      }
      /* Explorer 1 must always point at the legacy key, whatever else happens. */
      if (roster.profiles[FIRST_ID]) roster.profiles[FIRST_ID].saveKey = LEGACY_SAVE_KEY;
      Profiles._roster = roster;
      return roster;
    },

    persist: function () {
      if (Profiles._roster) write(ROSTER_KEY, JSON.stringify(Profiles._roster));
    },

    list: function () {
      var r = Profiles.ensure();
      return r.order.map(function (id) { return r.profiles[id]; }).filter(Boolean);
    },

    active: function () {
      var r = Profiles.ensure();
      return r.profiles[r.activeId] || r.profiles[FIRST_ID] || null;
    },

    /* ---------- the seam core.js reads ----------
       Wrapped in a belt-and-braces try/catch: a bug in this file must never
       be able to lose a child's progress. The worst case is the key the game
       has always used. */
    activeSaveKey: function () {
      try {
        var p = Profiles.active();
        if (p && typeof p.saveKey === 'string' && p.saveKey) return p.saveKey;
      } catch (e) { /* fall through */ }
      return LEGACY_SAVE_KEY;
    },

    /* ---------- slots ---------- */

    maxSlots: function () {
      return (WW.entitlements && WW.entitlements.maxProfiles) ? WW.entitlements.maxProfiles() : 1;
    },
    usedSlots: function () { return Profiles.list().length; },
    slotsLeft: function () { return Math.max(0, Profiles.maxSlots() - Profiles.usedSlots()); },
    canCreate: function () { return Profiles.slotsLeft() > 0; },

    /* ---------- create / switch ----------
       Implemented, deliberately not yet reachable from the UI. */

    create: function (label) {
      if (!Profiles.canCreate()) return { ok: false, reason: 'no_slots' };
      var r = Profiles.ensure();
      var n = 2;
      while (r.profiles['explorer-' + n]) n++;
      var id = 'explorer-' + n;
      r.profiles[id] = {
        id: id,
        label: (label && String(label).slice(0, 20)) || ('Explorer ' + n),
        saveKey: LEGACY_SAVE_KEY + '.' + id,
        legacy: false,
        createdAt: Date.now()
      };
      r.order.push(id);
      Profiles.persist();
      return { ok: true, profile: r.profiles[id] };
    },

    /* Switching rebinds the save key and reloads state from it. The caller is
       responsible for sending the player back to the title screen. */
    switchTo: function (id) {
      var r = Profiles.ensure();
      if (!r.profiles[id]) return { ok: false, reason: 'unknown_profile' };
      r.activeId = id;
      Profiles.persist();
      if (WW.State && WW.State.load) {
        WW.State.load();
        if (WW.Settings) WW.Settings.apply();
        if (WW.HUD) WW.HUD.update();
      }
      return { ok: true, profile: r.profiles[id] };
    },

    /* Removing an Explorer deletes that Explorer's save. Explorer 1 cannot be
       removed, because that would delete the original game. */
    remove: function (id) {
      if (id === FIRST_ID) return { ok: false, reason: 'cannot_remove_first' };
      var r = Profiles.ensure();
      var p = r.profiles[id];
      if (!p) return { ok: false, reason: 'unknown_profile' };
      try { window.localStorage.removeItem(p.saveKey); } catch (e) {}
      delete r.profiles[id];
      r.order = r.order.filter(function (x) { return x !== id; });
      if (r.activeId === id) r.activeId = FIRST_ID;
      Profiles.persist();
      return { ok: true };
    },

    /* If a subscription lapses, extra Explorers are NOT deleted. They become
       read-only: the roster keeps them, and switching back is blocked until
       Plus returns. Deleting a child's progress because a card expired would
       be indefensible. */
    lockedProfiles: function () {
      if (Profiles.maxSlots() >= Profiles.usedSlots()) return [];
      return Profiles.list().slice(Profiles.maxSlots());
    }
  };

})(window.WW);
