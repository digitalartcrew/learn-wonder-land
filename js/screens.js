/* =============================================================
   WonderWorld — screens.js
   The non-world screens: Title, Character Creator, World Map,
   Knowledge Tree, Profile and the Parent Dashboard.
   ============================================================= */
(function (WW) {
  'use strict';

  var U = WW.Util, D = WW.Data, S = WW.State, P = WW.Progress,
      FX = WW.FX, UI = WW.UI, Nav = WW.Nav, Sound = WW.Sound, Avatar = WW.Avatar;

  /* ===========================================================
     TITLE
     =========================================================== */
  WW.Screens.title = {
    enter: function () {
      var tree = document.getElementById('title-tree');
      tree.innerHTML = Avatar.treeSVG(P.treeStage(), S.data.crystals, { label: 'The Knowledge Tree' });

      var hero = document.getElementById('title-hero');
      hero.innerHTML = Avatar.svg(S.data.player, { label: 'Your explorer' });

      document.getElementById('title-buddy').textContent = S.companion().emoji;

      var box = document.getElementById('title-buttons');
      box.innerHTML = '';

      if (S.data.hasCharacter) {
        box.appendChild(UI.bigButton('▶️ Continue — ' + U.esc(S.name()), function () {
          Nav.go('map');
        }, 'primary big'));
        box.appendChild(UI.bigButton('🎨 Change my look', function () {
          WW.Screens.create.editing = true;
          Nav.go('create');
        }, 'secondary'));
      } else {
        box.appendChild(UI.bigButton('✨ Start a New Adventure', function () {
          WW.Screens.create.editing = false;
          Nav.go('create');
        }, 'primary big'));
        if (S.hasSave()) {
          box.appendChild(UI.bigButton('▶️ Continue', function () { Nav.go('map'); }, 'secondary'));
        }
      }
    }
  };

  /* ===========================================================
     CHARACTER CREATOR
     =========================================================== */
  WW.Screens.create = {
    editing: false,
    draft: null,

    enter: function () {
      var self = this;
      this.draft = JSON.parse(JSON.stringify(S.data.player));
      if (!this.editing && !this.draft.name) this.draft.name = '';

      var nameInput = document.getElementById('input-name');
      nameInput.value = this.draft.name;
      nameInput.oninput = function () {
        self.draft.name = nameInput.value.replace(/[^\p{L}\p{N} '\-]/gu, '').slice(0, 12);
        if (nameInput.value !== self.draft.name) nameInput.value = self.draft.name;
        self.refresh();
      };

      /* ---- skin swatches ---- */
      var skinBox = document.getElementById('opt-skin');
      skinBox.innerHTML = '';
      D.skins.forEach(function (c, i) {
        skinBox.appendChild(U.el('button', {
          class: 'swatch' + (self.draft.skin === i ? ' sel' : ''),
          'aria-label': 'Skin tone ' + (i + 1), 'aria-pressed': self.draft.skin === i ? 'true' : 'false',
          style: 'background:' + c,
          onclick: function () { self.draft.skin = i; Sound.play('tap'); self.enterRefresh(); }
        }, [U.el('span', { class: 'swatch-check', text: '✓', 'aria-hidden': 'true' })]));
      });

      /* ---- hair styles ---- */
      var hairBox = document.getElementById('opt-hair');
      hairBox.innerHTML = '';
      D.hairStyles.forEach(function (h, i) {
        hairBox.appendChild(U.el('button', {
          class: 'chip' + (self.draft.hair === i ? ' sel' : ''),
          'aria-pressed': self.draft.hair === i ? 'true' : 'false',
          text: h.name,
          onclick: function () { self.draft.hair = i; Sound.play('tap'); self.enterRefresh(); }
        }));
      });

      /* ---- hair colours ---- */
      var hcBox = document.getElementById('opt-haircolor');
      hcBox.innerHTML = '';
      D.hairColors.forEach(function (c, i) {
        hcBox.appendChild(U.el('button', {
          class: 'swatch' + (self.draft.hairColor === i ? ' sel' : ''),
          'aria-label': 'Hair colour ' + (i + 1), 'aria-pressed': self.draft.hairColor === i ? 'true' : 'false',
          style: 'background:' + c,
          onclick: function () { self.draft.hairColor = i; Sound.play('tap'); self.enterRefresh(); }
        }, [U.el('span', { class: 'swatch-check', text: '✓', 'aria-hidden': 'true' })]));
      });

      /* ---- outfits ---- */
      var fitBox = document.getElementById('opt-outfit');
      fitBox.innerHTML = '';
      D.outfits.forEach(function (o, i) {
        fitBox.appendChild(U.el('button', {
          class: 'chip chip-fit' + (self.draft.outfit === i ? ' sel' : ''),
          'aria-pressed': self.draft.outfit === i ? 'true' : 'false',
          onclick: function () { self.draft.outfit = i; Sound.play('tap'); self.enterRefresh(); }
        }, [
          U.el('i', { class: 'fit-dot', style: 'background:' + o.top + ';border-color:' + o.trim }),
          U.el('span', { text: o.name })
        ]));
      });

      /* ---- companions ---- */
      var compBox = document.getElementById('opt-companion');
      compBox.innerHTML = '';
      D.companions.forEach(function (c) {
        compBox.appendChild(U.el('button', {
          class: 'companion-card' + (self.draft.companion === c.id ? ' sel' : ''),
          'aria-pressed': self.draft.companion === c.id ? 'true' : 'false',
          style: '--cc:' + c.color,
          onclick: function () {
            self.draft.companion = c.id; Sound.play('good'); self.enterRefresh();
          }
        }, [
          U.el('span', { class: 'companion-emoji', text: c.emoji, 'aria-hidden': 'true' }),
          U.el('b', { text: c.name }),
          U.el('small', { text: c.kind })
        ]));
      });

      var start = document.getElementById('btn-start-adventure');
      start.textContent = this.editing ? 'Save my look ✨' : 'Start the Adventure ✨';
      start.onclick = function () { self.finish(); };

      this.refresh();
    },

    /* re-render options + preview after a choice */
    enterRefresh: function () {
      var keepName = this.draft.name;
      var editing = this.editing;
      var draft = this.draft;
      this.enter();
      this.draft = draft; this.draft.name = keepName; this.editing = editing;
      document.getElementById('input-name').value = keepName;
      this.refresh();
    },

    refresh: function () {
      document.getElementById('create-avatar').innerHTML =
        Avatar.svg(this.draft, { label: 'Preview of your explorer' });
      document.getElementById('create-buddy').textContent =
        (D.companions.filter(function (c) { return c.id === this.draft.companion; }.bind(this))[0] || D.companions[0]).emoji;
      document.getElementById('create-previewname').textContent = this.draft.name || 'Explorer';
    },

    finish: function () {
      var name = (this.draft.name || '').trim();
      if (!name) {
        Sound.play('oops');
        FX.toast('Please pick an explorer name first! ✏️');
        var input = document.getElementById('input-name');
        FX.pulse(input, 'shake');
        input.focus();
        return;
      }
      S.data.player = JSON.parse(JSON.stringify(this.draft));
      S.data.player.name = name;
      var isNew = !S.data.hasCharacter;
      S.data.hasCharacter = true;
      S.save(true);
      WW.HUD.update();
      /* No nickname, no avatar — just the fact that an Explorer now exists. */
      if (isNew && WW.events) WW.events.track('explorer_created');

      if (isNew) {
        var c = S.companion();
        FX.celebrate({
          emoji: c.emoji,
          title: 'Welcome, ' + name + '!',
          lines: [c.name + ' the ' + c.kind.toLowerCase() + ' will travel with you.',
                  'The Knowledge Tree needs 5 crystals. Let\'s find them!'],
          rewards: [{ emoji: '💎', text: '10 starter gems' }],
          actionText: 'To the map!',
          onAction: function () { Nav.go('map', { replace: true }); }
        });
        S.data.gems += 10;
        S.save(true);
      } else {
        FX.toast('Looking great! ✨');
        Nav.go('map', { replace: true });
      }
    }
  };

  /* ===========================================================
     WORLD MAP
     =========================================================== */
  WW.Screens.map = {
    enter: function () {
      var nodes = document.getElementById('map-nodes');
      nodes.innerHTML = '';

      D.worlds.forEach(function (w) {
        /* Two independent axes — see js/entitlements.js.
             learningMet  earned by playing
             tierMet      satisfied by WonderWorld+
           A world the child has not earned shows a padlock, exactly as it
           always has. A world they HAVE earned but that belongs to
           WonderWorld+ shows a sparkle instead — never a padlock, and never
           anything that reads as "you lost". */
        var v = WW.entitlements.check(w.id);
        var learned = v.learningMet, entitled = v.tierMet;
        var crystal = S.data.crystals[w.id];
        var prog = S.data.worlds[w.id] ? S.data.worlds[w.id].progress : 0;

        /* Keep sub-labels short — long ones wrap and collide on a phone map */
        var sub, spoken;
        if (!learned) {
          sub = w.requiresCrystals ? '🔒 All 5 crystals' : '🔒 ' + w.unlockXP + ' XP';
          spoken = w.name + '. Locked. ' + (w.requiresCrystals
            ? 'Opens when all five crystals are restored.'
            : 'Opens at ' + w.unlockXP + ' XP.');
        } else if (!entitled) {
          sub = '✨ WonderWorld+';
          spoken = w.name + '. Part of WonderWorld Plus. Ask a grown-up.';
        } else {
          sub = crystal ? 'Crystal restored ✅' : prog + '% explored';
          spoken = w.name + '. ' + (crystal ? 'Crystal restored.' : prog + ' percent explored.');
        }

        var btn = U.el('button', {
          class: 'map-node' + (learned ? '' : ' locked') +
                 (learned && !entitled ? ' premium' : '') + (crystal ? ' done' : ''),
          'data-world': w.id,
          style: '--wc:' + w.color,
          'aria-label': spoken,
          onclick: function () { WW.Screens.map.tap(w); }
        }, [
          U.el('span', { class: 'node-orb' }, [
            U.el('span', { class: 'node-emoji', text: learned ? w.emoji : '🔒', 'aria-hidden': 'true' }),
            crystal ? U.el('span', { class: 'node-crystal', text: '🔮', 'aria-hidden': 'true' }) : null,
            (learned && !entitled)
              ? U.el('span', { class: 'node-plus', text: '✨', 'aria-hidden': 'true' }) : null
          ]),
          U.el('span', { class: 'node-label' }, [
            U.el('b', { text: w.name }),
            U.el('small', { text: sub })
          ])
        ]);
        nodes.appendChild(btn);
      });

      /* Knowledge Tree node sits in the middle of the map */
      var treeBtn = U.el('button', {
        class: 'map-node map-tree', 'data-world': 'tree',
        style: '--wc:#8fe06a',
        'aria-label': 'Knowledge Tree. ' + P.crystalCount() + ' of 5 crystals restored.',
        onclick: function () { Sound.play('tap'); Nav.go('tree'); }
      }, [
        U.el('span', { class: 'node-orb tree-orb' }, [
          U.el('span', { class: 'node-emoji', text: '🌳', 'aria-hidden': 'true' })
        ]),
        U.el('span', { class: 'node-label' }, [
          U.el('b', { text: 'Knowledge Tree' }),
          U.el('small', { text: P.crystalCount() + ' / 5 crystals' })
        ])
      ]);
      nodes.appendChild(treeBtn);

      var cap = document.getElementById('map-caption');
      var found = P.crystalCount(), left = 5 - found;
      cap.innerHTML = left === 0
        ? '<b>Quest complete!</b> The Knowledge Tree shines again. 🌳✨'
        : (found === 0
            ? '<b>Quest:</b> find all 5 Knowledge Crystals and heal the tree.'
            : '<b>Quest:</b> ' + found + ' crystal' + (found === 1 ? '' : 's') + ' home, ' +
              left + ' to go!');

      this.drawPaths();
      WW.Buddy.show(true);
      if (!this._greeted) {
        this._greeted = true;
        setTimeout(function () {
          WW.Buddy.say('Pick a world, ' + S.name() + '!');
        }, 700);
      }
    },

    tap: function (w) {
      var v = WW.entitlements.check(w.id);

      /* Not earned yet — the learning message, with no mention of money. */
      if (!v.learningMet) {
        Sound.play('oops');
        var msg = w.requiresCrystals
          ? 'Restore all 5 Knowledge Crystals and WonderSpace will open! 🚀'
          : 'Keep learning! ' + w.name + ' opens at ' + w.unlockXP + ' XP. You have ' + S.data.xp + ' XP.';
        WW.Modal.open({
          title: '🔒 Not open yet',
          body: U.el('p', { class: 'modal-text', text: msg })
        });
        return;
      }

      /* Earned, but part of WonderWorld+. A friendly handover, never a sale. */
      if (!v.tierMet) {
        if (WW.events) WW.events.track('premium_content_viewed', { world: w.id, contentId: w.id });
        WW.Premium.childPrompt(w.id);
        return;
      }

      if (w.id === 'space') {
        /* Earned AND entitled — but the world itself is not built yet, so we
           say so plainly rather than opening an empty room. */
        Sound.play('reward');
        WW.Modal.open({
          title: '🚀 WonderSpace',
          body: U.el('div', {}, [
            U.el('p', { class: 'modal-text', text: 'You did it! The rocket is fuelled and the stars are waiting.' }),
            U.el('p', { class: 'modal-text', text: 'WonderSpace is the next big adventure — coming in the next update. For now, enjoy your glowing Knowledge Tree!' })
          ])
        });
        return;
      }

      Sound.play('tap');
      S.data.visited[w.id] = true;
      P.checkExplorer();
      S.save();
      if (WW.events) WW.events.track('world_entered', { world: w.id });
      Nav.go(w.id);
    },

    /* Draw the winding path that connects the worlds */
    drawPaths: function () {
      var stage = document.getElementById('map-stage');
      var svg = document.getElementById('map-paths');
      if (!stage || !svg) return;
      var r = stage.getBoundingClientRect();
      if (!r.width) return;
      svg.setAttribute('viewBox', '0 0 ' + r.width + ' ' + r.height);

      function center(id) {
        var n = stage.querySelector('.map-node[data-world="' + id + '"] .node-orb');
        if (!n) return null;
        var b = n.getBoundingClientRect();
        return { x: b.left - r.left + b.width / 2, y: b.top - r.top + b.height / 2 };
      }

      var order = ['math', 'story', 'science', 'city', 'business', 'space'];
      var pts = order.map(center).filter(Boolean);
      var html = '';

      /* faint links from the tree to every world */
      var tree = center('tree');
      if (tree) {
        order.forEach(function (id) {
          var p = center(id);
          if (!p) return;
          html += '<line x1="' + tree.x + '" y1="' + tree.y + '" x2="' + p.x + '" y2="' + p.y +
            '" stroke="rgba(255,255,255,.14)" stroke-width="2" stroke-dasharray="4 8"/>';
        });
      }
      /* the adventure trail */
      if (pts.length > 1) {
        var d = 'M' + pts[0].x + ' ' + pts[0].y;
        for (var i = 1; i < pts.length; i++) {
          var a = pts[i - 1], b = pts[i];
          var mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2 - 24;
          d += ' Q' + mx + ' ' + my + ' ' + b.x + ' ' + b.y;
        }
        html += '<path d="' + d + '" fill="none" stroke="rgba(255,225,150,.35)" stroke-width="7" ' +
          'stroke-linecap="round" stroke-dasharray="2 16"/>';
      }
      svg.innerHTML = html;
    }
  };

  /* ===========================================================
     KNOWLEDGE TREE
     =========================================================== */
  WW.Screens.tree = {
    enter: function () {
      var body = document.getElementById('tree-body');
      body.innerHTML = '';

      var stage = P.treeStage(), count = P.crystalCount();

      var art = U.el('div', { class: 'tree-stage' });
      art.innerHTML = Avatar.treeSVG(stage, S.data.crystals);
      body.appendChild(art);

      var head = UI.card('tree-head', [
        U.el('h3', { text: count >= 5 ? 'The tree is fully restored! 🌳✨' : 'The tree is healing…' }),
        U.el('p', { class: 'muted', text: count >= 5
          ? 'Every crystal is home. Thank you, ' + S.name() + '!'
          : 'Each thing you learn makes a new branch grow. ' + count + ' of 5 crystals are back.' }),
        UI.meter('Tree growth', stage * 10, 100, '#8fe06a', '🌿')
      ]);
      body.appendChild(head);

      var grid = U.el('div', { class: 'crystal-grid' });
      D.crystals.forEach(function (c) {
        var has = S.data.crystals[c.id];
        var w = S.data.worlds[c.id];
        var world = D.worlds.filter(function (x) { return x.id === c.id; })[0];
        grid.appendChild(U.el('button', {
          class: 'crystal-card' + (has ? ' on' : ''),
          style: '--c:' + c.color,
          'aria-label': c.name + ', ' + (has ? 'restored' : w.progress + ' percent complete') + '. Go to ' + world.name,
          onclick: function () {
            Sound.play('tap');
            if (P.worldUnlocked(c.id)) Nav.go(c.id);
            else FX.toast('That world opens at ' + world.unlockXP + ' XP');
          }
        }, [
          U.el('span', { class: 'crystal-emoji', text: has ? c.emoji : '⬡', 'aria-hidden': 'true' }),
          U.el('b', { text: c.name }),
          U.el('small', { text: has ? 'Restored ✅' : w.progress + '% there' }),
          U.el('span', { class: 'mini-track' }, [
            (function () { var i = U.el('i'); i.style.width = w.progress + '%'; i.style.background = c.color; return i; })()
          ]),
          U.el('small', { class: 'muted', text: world.emoji + ' ' + world.name })
        ]));
      });
      body.appendChild(grid);

      body.appendChild(UI.card('', [
        U.el('h4', { text: '🌱 How the tree grows' }),
        U.el('ul', { class: 'bullets' }, [
          U.el('li', { text: 'Every activity you finish gives XP — the trunk grows taller.' }),
          U.el('li', { text: 'Fill a world to 100% and its crystal flies home.' }),
          U.el('li', { text: 'All 5 crystals open WonderSpace. 🚀' })
        ])
      ]));

      if (!FX.reduced()) {
        var slots = body.querySelectorAll('.tree-slot.on circle');
        Array.prototype.forEach.call(slots, function (s, i) {
          s.style.animationDelay = (i * 0.25) + 's';
        });
      }
    }
  };

  /* ===========================================================
     PROFILE
     =========================================================== */
  WW.Screens.profile = {
    enter: function () {
      var body = document.getElementById('profile-body');
      body.innerHTML = '';
      var info = P.levelInfo();

      var head = UI.card('profile-head', []);
      var av = U.el('div', { class: 'profile-avatar' });
      av.innerHTML = Avatar.svg(S.data.player, { label: S.name() });
      head.appendChild(av);
      head.appendChild(U.el('div', { class: 'profile-meta' }, [
        U.el('h3', { text: S.name() }),
        U.el('p', { class: 'muted', text: 'Level ' + info.level + ' Explorer · travelling with ' +
          S.companion().name + ' ' + S.companion().emoji }),
        UI.meter('XP to level ' + (info.level + 1), info.into, info.need, '#ffd34d', '⭐'),
        U.el('div', { class: 'stat-row' }, [
          U.el('div', { class: 'stat-pill' }, [U.el('b', { text: '💎 ' + S.data.gems }), U.el('small', { text: 'gems' })]),
          U.el('div', { class: 'stat-pill' }, [U.el('b', { text: '🔮 ' + P.crystalCount() + '/5' }), U.el('small', { text: 'crystals' })]),
          U.el('div', { class: 'stat-pill' }, [U.el('b', { text: '🏆 ' + S.data.badges.length }), U.el('small', { text: 'badges' })]),
          U.el('div', { class: 'stat-pill' }, [U.el('b', { text: '🎯 ' + S.data.stats.activitiesDone }), U.el('small', { text: 'activities' })])
        ])
      ]));
      body.appendChild(head);
      head.appendChild(UI.bigButton('🎨 Change my look', function () {
        WW.Screens.create.editing = true; Nav.go('create');
      }, 'secondary wide'));

      /* subject progress */
      var subj = UI.card('', [U.el('h4', { text: '📊 My learning journey' })]);
      D.worlds.filter(function (w) { return w.id !== 'space'; }).forEach(function (w) {
        var st = S.data.worlds[w.id];
        subj.appendChild(UI.meter(w.emoji + ' ' + w.subject, st.progress, 100, w.color, ''));
      });
      body.appendChild(subj);

      /* badges */
      var badgeCard = UI.card('', [U.el('h4', { text: '🏆 Badges' })]);
      var bg = U.el('div', { class: 'badge-grid' });
      Object.keys(D.badges).forEach(function (id) {
        var b = D.badges[id], got = S.data.badges.indexOf(id) !== -1;
        bg.appendChild(U.el('div', {
          class: 'badge' + (got ? ' got' : ''),
          title: b.name + ' — ' + b.desc,
          'aria-label': b.name + '. ' + b.desc + '. ' + (got ? 'Earned' : 'Not earned yet')
        }, [
          U.el('span', { class: 'badge-emoji', text: got ? b.emoji : '❔', 'aria-hidden': 'true' }),
          U.el('b', { text: b.name }),
          U.el('small', { text: got ? b.desc : 'Keep playing!' })
        ]));
      });
      badgeCard.appendChild(bg);
      body.appendChild(badgeCard);
    }
  };

  /* ===========================================================
     PARENT DASHBOARD
     =========================================================== */
  WW.Screens.parent = {

    /* Cleared on every reload: a grown-up has to pass the gate each session. */
    unlocked: false,

    /* ---------------------------------------------------------
       ADULT GATE
       The dashboard holds an email field and "reset all progress",
       so a child must not be able to walk into it. COPPA treats an
       email address as personal information, and a tick-box saying
       "I am the parent" is not verification — this is.

       The challenge itself now lives in WW.parentGate so that the
       purchase flow uses exactly the same, tested implementation
       rather than a second copy of it. This door keeps the plain
       two-digit multiplication it has always had; the door in front
       of money uses the stricter read-and-calculate variant.
       --------------------------------------------------------- */
    renderGate: function () {
      var self = this;
      WW.parentGate.render(document.getElementById('parent-body'), {
        kind: 'multiply',
        scope: 'dashboard',
        onPass: function () { self.unlocked = true; self.enter(); },
        onCancel: function () { Nav.go('map'); }
      });
    },

    enter: function () {
      if (!this.unlocked) { this.renderGate(); return; }
      if (WW.events) WW.events.track('parent_dashboard_viewed', { status: WW.entitlements.status() });

      var body = document.getElementById('parent-body');
      body.innerHTML = '';

      body.appendChild(this.privacyNote());

      /* ---------- LEARNING PROGRESS ---------- */
      body.appendChild(U.el('h3', { class: 'parent-section', text: '📈 Learning progress' }));
      body.appendChild(this.glanceCard());
      body.appendChild(this.subjectsCard());
      body.appendChild(this.deepDiveCard());
      body.appendChild(this.practiceCard());
      body.appendChild(this.recentCard());
      body.appendChild(this.badgesCard());
      body.appendChild(this.teachesCard());

      /* ---------- FAMILY PLAN ---------- */
      body.appendChild(U.el('h3', { class: 'parent-section', text: '👨‍👩‍👧 Your family plan' }));
      body.appendChild(this.plusCard());
      body.appendChild(this.explorersCard());
      body.appendChild(this.trustCard());
      body.appendChild(this.betaCard());

      /* ---------- SETTINGS & DATA ---------- */
      body.appendChild(U.el('h3', { class: 'parent-section', text: '⚙️ Settings & data' }));
      body.appendChild(this.settingsCard());

      /* Development only — returns null in production. */
      var dev = WW.dev.panel(function () { WW.Screens.parent.enter(); });
      if (dev) body.appendChild(dev);
    },

    /* ---------------------------------------------------------
       Everything below reports only what the save file actually
       contains. Where a number cannot be calculated we say so,
       rather than inventing one.
       --------------------------------------------------------- */

    /* Shared derived figures, computed once per render. */
    metrics: function () {
      var st = S.data.stats;
      var answered = st.answers.correct + st.answers.wrong;
      var accuracy = answered ? Math.round((st.answers.correct / answered) * 100) : null;

      var subjects = D.worlds.filter(function (w) { return w.id !== 'space'; }).map(function (w) {
        var s = S.data.worlds[w.id];
        var tries = s.correct + s.wrong;
        return {
          world: w, state: s, tries: tries,
          accuracy: tries ? Math.round((s.correct / tries) * 100) : null
        };
      });

      /* A subject only counts as a strength or a struggle once there is
         enough of it to mean anything. Five questions is that threshold. */
      var rated = subjects.filter(function (s) { return s.tries >= 5; });
      var strongest = null, weakest = null;
      rated.forEach(function (s) {
        if (!strongest || s.accuracy > strongest.accuracy) strongest = s;
        if (!weakest || s.accuracy < weakest.accuracy) weakest = s;
      });

      return {
        stats: st, answered: answered, accuracy: accuracy,
        subjects: subjects, rated: rated, strongest: strongest, weakest: weakest
      };
    },

    privacyNote: function () {
      return U.el('p', { class: 'parent-note', html:
        '<b>Private by design.</b> All of your child\'s progress lives only in this browser ' +
        '(localStorage) and is never uploaded. No account is needed, there are no ads, and ' +
        'nothing is ever sold to a child. The only thing that ever leaves this device is the ' +
        'mailing-list form below, if you choose to use it.' });
    },

    glanceCard: function () {
      var m = this.metrics();
      var card = UI.card('', [U.el('h3', { text: 'At a glance' })]);
      var g = U.el('div', { class: 'parent-stats' });
      [
        { k: 'Learning time', v: U.fmtDuration(m.stats.timeMs), e: '⏱️' },
        { k: 'Activities finished', v: m.stats.activitiesDone, e: '✅' },
        { k: 'Questions answered', v: m.answered, e: '❓' },
        { k: 'Correct first time', v: m.accuracy === null ? '—' : m.accuracy + '%', e: '🎯' },
        { k: 'Level', v: S.data.level, e: '⭐' },
        { k: 'Crystals restored', v: P.crystalCount() + ' / 5', e: '🔮' }
      ].forEach(function (s) {
        g.appendChild(U.el('div', { class: 'parent-stat' }, [
          U.el('span', { class: 'ps-emoji', text: s.e, 'aria-hidden': 'true' }),
          U.el('b', { text: String(s.v) }),
          U.el('small', { text: s.k })
        ]));
      });
      card.appendChild(g);
      return card;
    },

    subjectsCard: function () {
      var m = this.metrics();
      var card = UI.card('', [U.el('h3', { text: 'Subject progress' })]);
      m.subjects.forEach(function (s) {
        card.appendChild(U.el('div', { class: 'subject-row' }, [
          U.el('div', { class: 'subject-head' }, [
            U.el('b', { text: s.world.emoji + ' ' + s.world.subject }),
            U.el('span', { class: 'muted', text: s.accuracy === null
              ? 'not started yet'
              : s.accuracy + '% correct · ' + s.tries + ' questions' })
          ]),
          UI.meter('World completion', s.state.progress, 100, s.world.color, '')
        ]));
      });
      return card;
    },

    /* ---------------------------------------------------------
       ADVANCED REPORT — a WonderWorld+ feature.

       Every figure here is read straight out of the save. Free
       players see an honest description of what it contains, with
       no price and no pressure; the price lives one gate away.
       --------------------------------------------------------- */
    deepDiveCard: function () {
      if (!WW.entitlements.hasFeature('advanced-parent-reports')) {
        var teaser = UI.card('plus-teaser', [
          U.el('h3', {}, [
            U.el('span', { class: 'plus-mark', text: '✨', 'aria-hidden': 'true' }),
            'Advanced learning report'
          ]),
          U.el('p', { class: 'muted', text:
            'A per-subject breakdown — discoveries made in the Science Lab, chapters read, ' +
            'words spelled, days traded, strengths and what to practise — plus a longer ' +
            'history of what your child has done.' }),
          U.el('p', { class: 'chip-soft chip plan-tag', text: 'Part of WonderWorld+' })
        ]);
        teaser.appendChild(UI.bigButton('See what WonderWorld+ includes', function () {
          WW.Screens.parent.openPlus();
        }, 'secondary wide'));
        return teaser;
      }

      var m = this.metrics();
      var card = UI.card('', [
        U.el('h3', {}, [
          U.el('span', { class: 'plus-mark', text: '✨', 'aria-hidden': 'true' }),
          'Advanced learning report'
        ])
      ]);

      /* strengths — only stated when there is enough evidence for it */
      var strengths = U.el('div', { class: 'subject-row' });
      if (m.strongest) {
        strengths.appendChild(U.el('p', { class: 'report-line', text:
          '💪 Strongest right now: ' + m.strongest.world.emoji + ' ' + m.strongest.world.subject +
          ' (' + m.strongest.accuracy + '% correct over ' + m.strongest.tries + ' questions).' }));
      }
      if (m.weakest && m.strongest && m.weakest.world.id !== m.strongest.world.id) {
        strengths.appendChild(U.el('p', { class: 'report-line', text:
          '🎯 Most room to grow: ' + m.weakest.world.emoji + ' ' + m.weakest.world.subject +
          ' (' + m.weakest.accuracy + '% correct over ' + m.weakest.tries + ' questions).' }));
      }
      if (!m.rated.length) {
        strengths.appendChild(U.el('p', { class: 'muted', text:
          'Strengths appear once your child has answered at least five questions in a subject.' }));
      }
      card.appendChild(strengths);

      /* per-world detail, all of it read from the save */
      var rows = this.worldDetail();
      rows.forEach(function (r) {
        var row = U.el('div', { class: 'subject-row' }, [
          U.el('b', { class: 'report-head', text: r.emoji + ' ' + r.name })
        ]);
        var ul = U.el('ul', { class: 'bullets report-facts' });
        r.facts.forEach(function (f) { ul.appendChild(U.el('li', { text: f })); });
        row.appendChild(ul);
        card.appendChild(row);
      });

      card.appendChild(U.el('p', { class: 'muted small', text:
        'Kept history: ' + S.data.activities.length + ' of ' + WW.entitlements.historyLimit() +
        ' activities.' }));
      return card;
    },

    /* Real figures only. Anything the game does not record is simply absent. */
    worldDetail: function () {
      var w = S.data.worlds;
      var out = [];

      var mathFacts = [
        'Bridge crossings completed: ' + (w.math.runs || 0),
        'Best result: ' + (w.math.bestStars ? w.math.bestStars + ' of 3 stars' : 'no full crossing yet'),
        'Questions: ' + w.math.correct + ' right, ' + w.math.wrong + ' to try again',
        'Difficulty the game has settled on: level ' + (Math.round((w.math.diff || 1) * 10) / 10) + ' of 6'
      ];
      out.push({ emoji: '🧮', name: 'Math Island', facts: mathFacts });

      var chapters = (WW.Worlds.story && WW.Worlds.story.CHAPTERS)
        ? WW.Worlds.story.CHAPTERS.length : null;
      out.push({ emoji: '📚', name: 'Story Forest', facts: [
        'Chapters finished: ' + (w.story.done || []).length + (chapters ? ' of ' + chapters : ''),
        'Words spelled correctly: ' + (w.story.spelled || 0),
        'Reading questions: ' + w.story.correct + ' right, ' + w.story.wrong + ' to try again'
      ] });

      var magnets = (WW.Worlds.science && WW.Worlds.science.MAGNET_OBJECTS)
        ? WW.Worlds.science.MAGNET_OBJECTS.length : null;
      out.push({ emoji: '🧪', name: 'Science Lab', facts: [
        'Plant discoveries: ' + (w.science.plant || []).length + ' of 7',
        'Objects tested with the magnet: ' + Object.keys(w.science.magnet || {}).length +
          (magnets ? ' of ' + magnets : ''),
        'Kinds of weather created: ' + (w.science.weather || []).length + ' of 6'
      ] });

      out.push({ emoji: '🌎', name: 'Planet City', facts: [
        'Seasons played: ' + (w.city.season || 1),
        'Best result: ' + (w.city.bestGoals || 0) + ' of 5 city goals met',
        'City budget: ' + U.money(w.city.money || 0)
      ] });

      var hist = w.business.history || [];
      var totalProfit = hist.reduce(function (n, d) { return n + (d.profit || 0); }, 0);
      out.push({ emoji: '💰', name: 'Business Town', facts: [
        'Days traded: ' + hist.length + ' of 7',
        'Profit across those days: ' + U.money(U.round(totalProfit, 2)),
        'In the piggy bank: ' + U.money(w.business.savings || 0)
      ] });

      return out;
    },

    practiceCard: function () {
      var m = this.metrics();
      var card = UI.card('', [U.el('h3', { text: 'Ideas for practice' })]);
      if (!m.answered) {
        card.appendChild(U.el('p', { class: 'muted', text:
          'Once your child plays a few activities, personalised suggestions appear here.' }));
        return card;
      }
      var tips = [];
      if (m.weakest && m.weakest.accuracy < 70) {
        tips.push('⭐ ' + m.weakest.world.subject + ' is the trickiest right now (' + m.weakest.accuracy +
          '% correct). Playing ' + m.weakest.world.name + ' together for 5 minutes would help a lot.');
      }
      m.subjects.forEach(function (s) {
        if (s.tries === 0 && P.worldUnlocked(s.world.id)) {
          tips.push(s.world.emoji + ' ' + s.world.name + ' hasn\'t been tried yet — it covers ' +
            s.world.subject.toLowerCase() + '.');
        }
      });
      if (S.data.worlds.math.diff >= 3.5) {
        tips.push('🧮 Math Island has adapted to harder questions — multiplication and fractions are in play.');
      }
      if (!tips.length) tips.push('🎉 Everything looks strong. Keep the sessions short and fun!');
      var ul = U.el('ul', { class: 'bullets' });
      tips.forEach(function (t) { ul.appendChild(U.el('li', { text: t })); });
      card.appendChild(ul);
      return card;
    },

    recentCard: function () {
      var card = UI.card('', [U.el('h3', { text: 'Recent accomplishments' })]);
      if (!S.data.activities.length) {
        card.appendChild(U.el('p', { class: 'muted', text: 'Nothing yet — the adventure is just starting.' }));
        return card;
      }
      /* WonderWorld+ keeps and shows a longer run of history. */
      var show = WW.entitlements.hasFeature('long-history') ? 40 : 12;
      var list = U.el('ul', { class: 'activity-list' });
      S.data.activities.slice(0, show).forEach(function (a) {
        var w = D.worlds.filter(function (x) { return x.id === a.world; })[0] || { emoji: '✨' };
        list.appendChild(U.el('li', {}, [
          U.el('span', { class: 'act-emoji', text: w.emoji, 'aria-hidden': 'true' }),
          U.el('div', {}, [
            U.el('b', { text: a.name }),
            U.el('small', { class: 'muted', text: (a.detail ? a.detail + ' · ' : '') +
              '+' + a.xp + ' XP · ' + U.fmtDate(a.at) })
          ]),
          a.stars !== null && a.stars !== undefined
            ? U.el('span', { class: 'act-stars', text: '⭐'.repeat(a.stars) || '—' }) : null
        ]));
      });
      card.appendChild(list);
      return card;
    },

    badgesCard: function () {
      var earned = S.data.badges.map(function (id) { return D.badges[id]; }).filter(Boolean);
      var card = UI.card('', [U.el('h3', { text: 'Badges earned (' + earned.length + ')' })]);
      if (!earned.length) {
        card.appendChild(U.el('p', { class: 'muted', text: 'None yet.' }));
        return card;
      }
      var bl = U.el('div', { class: 'parent-badges' });
      earned.forEach(function (b) {
        bl.appendChild(U.el('span', { class: 'parent-badge', text: b.emoji + ' ' + b.name }));
      });
      card.appendChild(bl);
      return card;
    },

    teachesCard: function () {
      return UI.card('', [
        U.el('h3', { text: 'What WonderWorld teaches' }),
        U.el('ul', { class: 'bullets' }, [
          U.el('li', { text: '🧮 Math Island — addition, subtraction, multiplication, division, comparing, fractions, money and word problems. Difficulty adapts automatically to your child.' }),
          U.el('li', { text: '📚 Story Forest — phonics, vocabulary, spelling, sentence building and reading comprehension inside a real story.' }),
          U.el('li', { text: '🧪 Science Lab — cause and effect through plant, magnet and weather experiments.' }),
          U.el('li', { text: '🌎 Planet City — sustainability, renewable energy, recycling and trade-offs.' }),
          U.el('li', { text: '💰 Business Town — costs, pricing, revenue, profit, saving and budgeting.' })
        ])
      ]);
    },

    /* ---------------------------------------------------------
       WONDERWORLD+ ENTRY
       Describes the plan but NEVER prices it. The price lives on
       the WonderWorld+ page, behind the stricter gate.
       --------------------------------------------------------- */
    plusCard: function () {
      var E = WW.entitlements, status = E.status();
      var card = UI.card('plus-entry');

      if (status === 'trial') {
        var left = E.trialDaysLeft();
        card.appendChild(U.el('h3', { text: '✨ WonderWorld+ free trial' }));
        card.appendChild(U.el('p', { class: 'muted', text:
          left + (left === 1 ? ' day' : ' days') + ' of the trial left.' }));
      } else if (status === 'plus') {
        card.appendChild(U.el('h3', { text: '✨ WonderWorld+ is active' }));
        card.appendChild(U.el('p', { class: 'muted', text: 'Thank you for supporting WonderWorld.' }));
      } else if (status === 'expired') {
        card.appendChild(U.el('h3', { text: 'WonderWorld+ has ended' }));
        card.appendChild(U.el('p', { class: 'muted', text:
          'Your child\'s progress is untouched and the free adventure is still complete.' }));
      } else {
        card.appendChild(U.el('h3', { text: 'Take the adventure even further' }));
        card.appendChild(U.el('p', { class: 'muted', text:
          'The core WonderWorld adventure is free. Optional WonderWorld+ adds WonderSpace, ' +
          'new stories, more Explorer profiles, advanced reports and progress backup.' }));
      }

      if (E.isSimulated()) {
        card.appendChild(U.el('p', { class: 'dev-note', text:
          '⚠️ DEVELOPMENT ONLY — simulated subscription state, not a real one.' }));
      }

      card.appendChild(UI.bigButton(
        E.isPlus() ? 'Manage WonderWorld+' : 'See what WonderWorld+ includes',
        function () { WW.Screens.parent.openPlus(); }, 'primary wide'));
      return card;
    },

    /* The ONLY route from the dashboard to anything with a price on it. */
    openPlus: function () {
      WW.parentGate.require({
        kind: 'multiply-adjust',
        scope: 'purchase',
        title: 'One more check',
        blurb: 'The next page has subscription details and prices on it. Please answer:',
        onPass: function () { Nav.go('plus'); }
      });
    },

    /* ---------------------------------------------------------
       EXPLORER PROFILES
       The roster is real; the switcher is not built yet, so this
       reports the architecture honestly rather than offering a
       button that does nothing.
       --------------------------------------------------------- */
    explorersCard: function () {
      var used = WW.profiles.usedSlots(), max = WW.profiles.maxSlots();
      var card = UI.card('', [
        U.el('h3', { text: 'Explorers' }),
        U.el('p', { class: 'muted', text: used + ' of ' + max +
          (max === 1 ? ' Explorer profile in use.' : ' Explorer profiles in use.') })
      ]);
      var list = U.el('div', { class: 'parent-badges' });
      WW.profiles.list().forEach(function (p) {
        list.appendChild(U.el('span', { class: 'parent-badge', text: '🎒 ' + p.label }));
      });
      card.appendChild(list);
      card.appendChild(U.el('p', { class: 'muted small', text: max > 1
        ? 'Up to four Explorers are included with WonderWorld+. Switching between them arrives ' +
          'in a coming update; the profiles are already kept separately.'
        : 'WonderWorld+ raises this to four Explorers, each with their own progress.' }));
      return card;
    },

    /* ---------------------------------------------------------
       TRUST
       Only claims we can point at code for.
       --------------------------------------------------------- */
    trustCard: function () {
      var card = UI.card('trust-card', [U.el('h3', { text: 'Built for kids, not advertisers' })]);
      var list = U.el('ul', { class: 'trust-list' });
      [
        'No ads',
        'No chat',
        'No selling children\'s data',
        'No loot boxes',
        'No pay-to-win',
        'No child email required'
      ].forEach(function (t) {
        list.appendChild(U.el('li', {}, [
          U.el('span', { class: 'trust-tick', text: '✓', 'aria-hidden': 'true' }),
          U.el('span', { text: t })
        ]));
      });
      card.appendChild(list);
      card.appendChild(U.el('p', { class: 'muted small', text:
        'Worlds open by learning, never by paying. A subscription adds new content — it never ' +
        'grants XP, gems, crystals or answers, and never skips a learning requirement.' }));
      return card;
    },

    settingsCard: function () {
      var card = UI.card('', []);
      card.appendChild(U.el('div', { class: 'parent-actions' }, [
        UI.bigButton('⚙️ Game settings', function () { WW.Settings.openPanel(); }, 'secondary'),
        UI.bigButton('💾 Export progress', function () { WW.Screens.parent.exportData(); }, 'secondary'),
        UI.bigButton('🗑️ Reset all progress', function () { WW.Screens.parent.confirmReset(); }, 'danger')
      ]));
      card.appendChild(U.el('p', { class: 'muted small', text:
        'Progress is saved automatically in this browser. Clearing browser data (or using ' +
        'Private Browsing) will remove it.' }));
      card.appendChild(U.el('p', { class: 'muted small', text:
        '☁️ ' + WW.sync.describe().text }));
      return card;
    },

    /* ---------------------------------------------------------
       Family beta signup.
       Lives only in the grown-ups area — a child never sees it.
       Collects the PARENT's email, nothing about the child, and
       only after an explicit consent tick.
       --------------------------------------------------------- */
    betaCard: function () {
      var card = UI.card('beta-card', []);
      S.data.flags = S.data.flags || {};

      if (S.data.flags.betaSignedUp) {
        card.appendChild(U.el('h3', { text: '💌 You\'re on the list' }));
        card.appendChild(U.el('p', { class: 'muted', text:
          'Thank you! We\'ll email you when the next worlds and the family features are ready. ' +
          'No more than one email a month, and you can unsubscribe from any of them.' }));
        card.appendChild(U.el('button', {
          class: 'ghost-btn', text: 'Use a different email',
          onclick: function () {
            S.data.flags.betaSignedUp = false; S.save(true);
            WW.Screens.parent.enter();
          }
        }));
        return card;
      }

      card.appendChild(U.el('h3', { text: '💌 Join the family beta' }));
      /* Deliberately precise. "WonderWorld is free" was a broader promise than
         we can keep now that WonderWorld+ exists — but the part that matters
         to a parent, that learning is never sold, is stated plainly and is
         still true. Nothing a player has today is being taken away. */
      card.appendChild(U.el('p', { class: 'muted', text:
        'The core WonderWorld adventure is free. Educational progress is earned through ' +
        'learning — not purchases. Optional WonderWorld+ expands the adventure with new ' +
        'worlds, family features and additional content.' }));
      card.appendChild(U.el('p', { class: 'muted', text:
        'Leave your email and we\'ll tell you when new worlds and extra chapters land — and ' +
        'we\'ll ask what your family actually wants next.' }));

      var form = U.el('form', { class: 'beta-form', novalidate: true });

      var email = U.el('input', {
        type: 'email', class: 'name-input', id: 'beta-email',
        placeholder: 'grown-up@example.com', autocomplete: 'email',
        inputmode: 'email', required: true, 'aria-label': 'Your email address'
      });

      /* honeypot — hidden from people, irresistible to bots */
      var hp = U.el('input', {
        type: 'text', name: 'website', class: 'hp-field',
        tabindex: '-1', autocomplete: 'off', 'aria-hidden': 'true'
      });

      var kids = U.el('select', { class: 'beta-select', 'aria-label': 'How many children' }, [
        U.el('option', { value: '', text: 'How many children? (optional)' }),
        U.el('option', { value: '1', text: '1 child' }),
        U.el('option', { value: '2', text: '2 children' }),
        U.el('option', { value: '3+', text: '3 or more' })
      ]);

      var consentBox = U.el('input', { type: 'checkbox', id: 'beta-consent' });
      var consent = U.el('label', { class: 'beta-consent', for: 'beta-consent' }, [
        consentBox,
        U.el('span', { text: 'Email me occasional WonderWorld updates. I am this child\'s parent or guardian.' })
      ]);

      var status = U.el('p', { class: 'beta-status', role: 'status' });
      var submit = UI.bigButton('Keep me posted ✉️', function () { send(); }, 'primary wide');

      form.appendChild(email);
      form.appendChild(hp);
      form.appendChild(kids);
      form.appendChild(consent);
      form.appendChild(submit);
      form.appendChild(status);
      form.addEventListener('submit', function (e) { e.preventDefault(); send(); });
      card.appendChild(form);

      card.appendChild(U.el('p', { class: 'muted small', html:
        'We store your email address, how many children you told us about, and the date and ' +
        'country of your sign-up. Never your child\'s name or age, and never anything from ' +
        'the game. We don\'t sell or share any of it. ' +
        '<a href="privacy.html" target="_blank" rel="noopener">Privacy policy</a>.' }));

      function setStatus(msg, kind) {
        status.textContent = msg;
        status.className = 'beta-status ' + (kind || '');
      }

      function send() {
        var value = (email.value || '').trim();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) {
          setStatus('That email doesn\'t look right — please check it.', 'bad');
          FX.pulse(email, 'shake'); email.focus();
          return;
        }
        if (!consentBox.checked) {
          setStatus('Please tick the box so we know it\'s okay to email you.', 'bad');
          FX.pulse(consent, 'shake');
          return;
        }
        submit.disabled = true;
        setStatus('Sending…');

        fetch('api/subscribe', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            email: value,
            kids: kids.value,
            consent: true,
            website: hp.value,
            source: 'parent-dashboard'
          })
        }).then(function (r) {
          return r.json().then(function (d) { return { status: r.status, data: d }; });
        }).then(function (res) {
          if (res.data && res.data.ok) {
            S.data.flags.betaSignedUp = true;
            S.save(true);
            Sound.play('reward');
            FX.toast('💌 You\'re on the list — thank you!');
            WW.Screens.parent.enter();
            return;
          }
          submit.disabled = false;
          var err = (res.data && res.data.error) || 'failed';
          if (err === 'rate_limited') setStatus('Too many signups from this network just now — please try again shortly.', 'bad');
          else if (err === 'not_configured') fallback();
          else if (err === 'bad_email') setStatus('That email doesn\'t look right — please check it.', 'bad');
          else setStatus('Something went wrong. Please try again in a moment.', 'bad');
        }).catch(function () {
          submit.disabled = false;
          fallback();
        });
      }

      /* Runs locally (file://) or before the KV binding is set up */
      function fallback() {
        setStatus('The signup server isn\'t reachable from here. You can email us directly instead.', 'bad');
        if (!card.querySelector('.beta-fallback')) {
          card.appendChild(U.el('a', {
            class: 'ghost-btn beta-fallback',
            href: 'mailto:hello@wonderworld.game?subject=' +
              encodeURIComponent('Family beta') + '&body=' +
              encodeURIComponent('Please add me to the WonderWorld family beta list.'),
            text: '✉️ Email us instead'
          }));
        }
      }

      return card;
    },

    exportData: function () {
      var txt = JSON.stringify(S.data, null, 2);
      var box = U.el('div', {}, [
        U.el('p', { class: 'modal-text', text: 'Copy this text to keep a backup of the save file.' }),
        U.el('textarea', { class: 'export-box', readonly: true, rows: '8', text: txt })
      ]);
      WW.Modal.open({
        title: '💾 Progress backup', body: box,
        actions: [
          { text: 'Copy', primary: true, onClick: function () {
              var ta = box.querySelector('textarea');
              ta.select();
              try { document.execCommand('copy'); FX.toast('Copied to clipboard'); }
              catch (e) { FX.toast('Select the text and copy it'); }
            } },
          { text: 'Close', onClick: function () { WW.Modal.close(); } }
        ]
      });
    },

    /* Leaving the grown-ups area re-locks every door behind it, including
       the stricter one in front of the subscription page. */
    lock: function () {
      this.unlocked = false;
      if (WW.parentGate) WW.parentGate.reset();
    },

    confirmReset: function () {
      WW.Modal.open({
        title: 'Reset everything?',
        body: U.el('p', { class: 'modal-text', text:
          'This permanently deletes the character, XP, gems, badges and all world progress on this device. This cannot be undone.' }),
        actions: [
          { text: 'Cancel', onClick: function () { WW.Modal.close(); } },
          { text: 'Yes, reset', primary: true, onClick: function () {
              S.wipe();
              WW.Modal.close();
              WW.Settings.apply();
              WW.HUD.update();
              FX.toast('Progress reset.');
              Nav.go('title', { replace: true });
            } }
        ]
      });
    }
  };

  /* keep the map trail aligned when the device rotates */
  window.addEventListener('resize', function () {
    if (Nav.current === 'map') WW.Screens.map.drawPaths();
  });
  window.addEventListener('orientationchange', function () {
    setTimeout(function () { if (Nav.current === 'map') WW.Screens.map.drawPaths(); }, 300);
  });

})(window.WW);
