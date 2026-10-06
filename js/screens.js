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
        var unlocked = P.worldUnlocked(w.id);
        var crystal = S.data.crystals[w.id];
        var prog = S.data.worlds[w.id] ? S.data.worlds[w.id].progress : 0;

        /* Keep sub-labels short — long ones wrap and collide on a phone map */
        var sub = unlocked
          ? (crystal ? 'Crystal restored ✅' : prog + '% explored')
          : (w.requiresCrystals ? '🔒 All 5 crystals' : '🔒 ' + w.unlockXP + ' XP');
        var spoken = unlocked
          ? w.name + '. ' + (crystal ? 'Crystal restored.' : prog + ' percent explored.')
          : w.name + '. Locked. ' + (w.requiresCrystals
              ? 'Opens when all five crystals are restored.'
              : 'Opens at ' + w.unlockXP + ' XP.');

        var btn = U.el('button', {
          class: 'map-node' + (unlocked ? '' : ' locked') + (crystal ? ' done' : ''),
          'data-world': w.id,
          style: '--wc:' + w.color,
          'aria-label': spoken,
          onclick: function () { WW.Screens.map.tap(w, unlocked); }
        }, [
          U.el('span', { class: 'node-orb' }, [
            U.el('span', { class: 'node-emoji', text: unlocked ? w.emoji : '🔒', 'aria-hidden': 'true' }),
            crystal ? U.el('span', { class: 'node-crystal', text: '🔮', 'aria-hidden': 'true' }) : null
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

    tap: function (w, unlocked) {
      if (!unlocked) {
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
      if (w.id === 'space') {
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

       A two-digit multiplication, typed rather than tapped, is past
       what this game teaches (it tops out at 12 × 12) and past what
       most under-13s will do mentally.
       --------------------------------------------------------- */
    renderGate: function () {
      var self = this;
      var body = document.getElementById('parent-body');
      body.innerHTML = '';

      var a = U.rnd(13, 29), b = U.rnd(13, 29);
      var answer = a * b;

      var input = U.el('input', {
        type: 'text', inputmode: 'numeric', autocomplete: 'off',
        class: 'name-input gate-input', 'aria-label': 'Answer',
        placeholder: '?', maxlength: '4'
      });
      var status = U.el('p', { class: 'beta-status', role: 'status' });

      function check() {
        if (parseInt(input.value, 10) === answer) {
          self.unlocked = true;
          Sound.play('unlock');
          self.enter();
        } else {
          Sound.play('oops');
          status.textContent = 'That\'s not it. Have another go — or ask a grown-up.';
          status.className = 'beta-status bad';
          FX.pulse(input, 'shake');
          input.value = '';
          input.focus();
        }
      }
      input.addEventListener('keydown', function (e) { if (e.key === 'Enter') check(); });

      var card = UI.card('gate-card', [
        U.el('div', { class: 'gate-emoji', text: '🔒', 'aria-hidden': 'true' }),
        U.el('h3', { text: 'Grown-ups only' }),
        U.el('p', { class: 'muted', text:
          'This area has settings, your child\'s progress report and an email sign-up, ' +
          'so we check that a grown-up is here. Please answer:' }),
        U.el('p', { class: 'gate-sum', text: a + ' × ' + b + ' = ?' }),
        input,
        UI.bigButton('Enter', function () { check(); }, 'primary wide'),
        status,
        U.el('button', {
          class: 'ghost-btn', text: '← Back to the game',
          onclick: function () { Sound.play('tap'); Nav.go('map'); }
        })
      ]);
      body.appendChild(card);
      setTimeout(function () { input.focus(); }, 120);
    },

    enter: function () {
      if (!this.unlocked) { this.renderGate(); return; }
      var body = document.getElementById('parent-body');
      body.innerHTML = '';
      var st = S.data.stats;
      var totalAns = st.answers.correct + st.answers.wrong;
      var accuracy = totalAns ? Math.round((st.answers.correct / totalAns) * 100) : 0;

      body.appendChild(U.el('p', { class: 'parent-note', html:
        '<b>Private by design.</b> All of your child\'s progress lives only in this browser ' +
        '(localStorage) and is never uploaded. No account is needed, and there are no ads or ' +
        'purchases. The only thing that ever leaves this device is the mailing-list form below, ' +
        'if you choose to use it.' }));

      /* --- at a glance --- */
      var glance = UI.card('', [U.el('h3', { text: 'At a glance' })]);
      var g = U.el('div', { class: 'parent-stats' });
      [
        { k: 'Learning time', v: U.fmtDuration(st.timeMs), e: '⏱️' },
        { k: 'Activities finished', v: st.activitiesDone, e: '✅' },
        { k: 'Questions answered', v: totalAns, e: '❓' },
        { k: 'Correct first time', v: accuracy + '%', e: '🎯' },
        { k: 'Level', v: S.data.level, e: '⭐' },
        { k: 'Crystals restored', v: P.crystalCount() + ' / 5', e: '🔮' }
      ].forEach(function (s) {
        g.appendChild(U.el('div', { class: 'parent-stat' }, [
          U.el('span', { class: 'ps-emoji', text: s.e, 'aria-hidden': 'true' }),
          U.el('b', { text: String(s.v) }),
          U.el('small', { text: s.k })
        ]));
      });
      glance.appendChild(g);
      body.appendChild(glance);

      /* --- subject breakdown --- */
      var subjects = UI.card('', [U.el('h3', { text: 'Subject progress' })]);
      var weakest = null;
      D.worlds.filter(function (w) { return w.id !== 'space'; }).forEach(function (w) {
        var s = S.data.worlds[w.id];
        var tries = s.correct + s.wrong;
        var acc = tries ? Math.round((s.correct / tries) * 100) : null;
        if (tries >= 5 && (weakest === null || acc < weakest.acc)) weakest = { world: w, acc: acc };
        var row = U.el('div', { class: 'subject-row' }, [
          U.el('div', { class: 'subject-head' }, [
            U.el('b', { text: w.emoji + ' ' + w.subject }),
            U.el('span', { class: 'muted', text: acc === null
              ? 'not started yet'
              : acc + '% correct · ' + tries + ' questions' })
          ]),
          UI.meter('World completion', s.progress, 100, w.color, '')
        ]);
        subjects.appendChild(row);
      });
      body.appendChild(subjects);

      /* --- what to practise --- */
      var practice = UI.card('', [U.el('h3', { text: 'Ideas for practice' })]);
      if (!totalAns) {
        practice.appendChild(U.el('p', { class: 'muted', text:
          'Once your child plays a few activities, personalised suggestions appear here.' }));
      } else {
        var tips = [];
        if (weakest && weakest.acc < 70) {
          tips.push('⭐ ' + weakest.world.subject + ' is the trickiest right now (' + weakest.acc +
            '% correct). Playing ' + weakest.world.name + ' together for 5 minutes would help a lot.');
        }
        D.worlds.filter(function (w) { return w.id !== 'space'; }).forEach(function (w) {
          var s = S.data.worlds[w.id];
          if (s.correct + s.wrong === 0 && P.worldUnlocked(w.id)) {
            tips.push(w.emoji + ' ' + w.name + ' hasn\'t been tried yet — it covers ' + w.subject.toLowerCase() + '.');
          }
        });
        if (S.data.worlds.math.diff >= 3.5) {
          tips.push('🧮 Math Island has adapted to harder questions — multiplication and fractions are in play.');
        }
        if (!tips.length) tips.push('🎉 Everything looks strong. Keep the sessions short and fun!');
        var ul = U.el('ul', { class: 'bullets' });
        tips.forEach(function (t) { ul.appendChild(U.el('li', { text: t })); });
        practice.appendChild(ul);
      }
      body.appendChild(practice);

      /* --- recent accomplishments --- */
      var recent = UI.card('', [U.el('h3', { text: 'Recent accomplishments' })]);
      if (!S.data.activities.length) {
        recent.appendChild(U.el('p', { class: 'muted', text: 'Nothing yet — the adventure is just starting.' }));
      } else {
        var list = U.el('ul', { class: 'activity-list' });
        S.data.activities.slice(0, 12).forEach(function (a) {
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
        recent.appendChild(list);
      }
      body.appendChild(recent);

      /* --- badges earned --- */
      var earned = S.data.badges.map(function (id) { return D.badges[id]; }).filter(Boolean);
      var bcard = UI.card('', [U.el('h3', { text: 'Badges earned (' + earned.length + ')' })]);
      if (!earned.length) bcard.appendChild(U.el('p', { class: 'muted', text: 'None yet.' }));
      else {
        var bl = U.el('div', { class: 'parent-badges' });
        earned.forEach(function (b) {
          bl.appendChild(U.el('span', { class: 'parent-badge', text: b.emoji + ' ' + b.name }));
        });
        bcard.appendChild(bl);
      }
      body.appendChild(bcard);

      /* --- what the game teaches --- */
      body.appendChild(UI.card('', [
        U.el('h3', { text: 'What WonderWorld teaches' }),
        U.el('ul', { class: 'bullets' }, [
          U.el('li', { text: '🧮 Math Island — addition, subtraction, multiplication, division, comparing, fractions, money and word problems. Difficulty adapts automatically to your child.' }),
          U.el('li', { text: '📚 Story Forest — phonics, vocabulary, spelling, sentence building and reading comprehension inside a real story.' }),
          U.el('li', { text: '🧪 Science Lab — cause and effect through plant, magnet and weather experiments.' }),
          U.el('li', { text: '🌎 Planet City — sustainability, renewable energy, recycling and trade-offs.' }),
          U.el('li', { text: '💰 Business Town — costs, pricing, revenue, profit, saving and budgeting.' })
        ])
      ]));

      /* --- family beta signup (parent-facing only) --- */
      body.appendChild(this.betaCard());

      /* --- settings + data --- */
      var ctrl = UI.card('', [U.el('h3', { text: 'Settings & data' })]);
      ctrl.appendChild(U.el('div', { class: 'parent-actions' }, [
        UI.bigButton('⚙️ Game settings', function () { WW.Settings.openPanel(); }, 'secondary'),
        UI.bigButton('💾 Export progress', function () { WW.Screens.parent.exportData(); }, 'secondary'),
        UI.bigButton('🗑️ Reset all progress', function () { WW.Screens.parent.confirmReset(); }, 'danger')
      ]));
      ctrl.appendChild(U.el('p', { class: 'muted small', text:
        'Progress is saved automatically in this browser. Clearing browser data (or using Private Browsing) will remove it.' }));
      body.appendChild(ctrl);
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
      card.appendChild(U.el('p', { class: 'muted', text:
        'WonderWorld is free and we intend to keep the learning free. Leave your email and ' +
        'we\'ll tell you when new worlds, extra story chapters and multi-child profiles land — ' +
        'and we\'ll ask what your family actually wants next.' }));

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

    /* Leaving the grown-ups area re-locks it behind the gate */
    lock: function () { this.unlocked = false; },

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
