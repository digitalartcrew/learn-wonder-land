/* =============================================================
   WonderWorld — worlds/city.js
   PLANET CITY: build a small sustainable city.

   Every building changes four meters, immediately and visibly:
     🌱 Environment   😊 Happiness   ⚡ Energy   💰 Money
   The lesson is trade-offs: a factory earns a lot but pollutes,
   trees cost almost nothing but clean the air.

   ADDING A BUILDING: add an entry to BUILDINGS.
   ============================================================= */
(function (WW) {
  'use strict';

  var U = WW.Util, S = WW.State, P = WW.Progress, FX = WW.FX,
      UI = WW.UI, Nav = WW.Nav, Sound = WW.Sound;

  var COLS = 5, ROWS = 4, TILES = COLS * ROWS;

  var BUILDINGS = [
    { id: 'tree', emoji: '🌳', name: 'Tree', cost: 8,
      env: 7, happy: 2, energy: 0, income: 0,
      fact: 'Trees breathe in carbon dioxide and breathe out oxygen. They also give shade and homes for birds.' },
    { id: 'house', emoji: '🏠', name: 'House', cost: 24,
      env: -4, happy: 5, energy: -6, income: 9,
      fact: 'People need homes — and homes need energy. Every house uses electricity for lights and heat.' },
    { id: 'park', emoji: '🌷', name: 'Park', cost: 22,
      env: 5, happy: 9, energy: -1, income: 0,
      fact: 'Green spaces make people healthier and happier, and they soak up rain so streets do not flood.' },
    { id: 'solar', emoji: '☀️', name: 'Solar panels', cost: 38,
      env: 4, happy: 0, energy: 14, income: 0,
      fact: 'Solar panels turn sunlight into electricity. The fuel is free and never runs out — that is renewable energy.' },
    { id: 'wind', emoji: '🌬️', name: 'Wind turbine', cost: 52,
      env: 5, happy: -1, energy: 20, income: 0,
      fact: 'Wind turbines spin to make electricity with no smoke at all. Some people think they are noisy, though!' },
    { id: 'recycle', emoji: '♻️', name: 'Recycling centre', cost: 42,
      env: 11, happy: 2, energy: -3, income: 3,
      fact: 'Recycling turns old cans, paper and bottles into new ones. That means digging up fewer new materials.' },
    { id: 'bus', emoji: '🚌', name: 'Bus stop', cost: 32,
      env: 6, happy: 7, energy: -2, income: 2,
      fact: 'One bus can replace about 40 cars. Public transport cuts pollution AND traffic jams.' },
    { id: 'factory', emoji: '🏭', name: 'Factory', cost: 48,
      env: -14, happy: -5, energy: -12, income: 26,
      fact: 'Factories make money and jobs, but old ones burn fuel and pollute the air. Cities must balance both.' }
  ];

  function byId(id) {
    return BUILDINGS.filter(function (b) { return b.id === id; })[0];
  }

  var SEASON_TIPS = [
    '💡 Tip: trees are the cheapest way to lift your green score.',
    '💡 Tip: if ⚡ energy goes below zero, the lights flicker. Add solar or wind!',
    '💡 Tip: bus stops make people happy AND cut pollution.',
    '💡 Tip: a recycling centre saves materials and earns a little money.',
    '💡 Tip: factories earn the most money but hurt the air the most.',
    '💡 Tip: happiness goes up with parks, buses and homes.'
  ];

  var City = WW.Worlds.city = {
    selected: null,

    back: function () { Nav.go('map'); },

    enter: function () {
      var w = S.world('city');
      if (!w.grid || w.grid.length !== TILES) {
        w.grid = [];
        for (var i = 0; i < TILES; i++) w.grid.push(null);
      }
      w.learned = w.learned || [];
      this.selected = null;
      this.render();
    },

    /* ---------- simulation ---------- */
    stats: function () {
      var w = S.world('city');
      var env = 50, happy = 50, energy = 0, income = 15, counts = {};
      w.grid.forEach(function (id) {
        if (!id) return;
        var b = byId(id);
        if (!b) return;
        env += b.env; happy += b.happy; energy += b.energy; income += b.income;
        counts[id] = (counts[id] || 0) + 1;
      });
      /* an over-stretched power grid makes people grumpy */
      if (energy < 0) happy += energy;
      return {
        env: U.clamp(env, 0, 100), happy: U.clamp(happy, 0, 100),
        energy: energy, income: income, counts: counts,
        buildings: w.grid.filter(Boolean).length
      };
    },

    goals: function () {
      var st = this.stats(), w = S.world('city');
      return [
        { id: 'env', emoji: '🌱', text: 'Green score 70 or more', ok: st.env >= 70, now: st.env + '%' },
        { id: 'happy', emoji: '😊', text: 'Happiness 70 or more', ok: st.happy >= 70, now: st.happy + '%' },
        { id: 'energy', emoji: '⚡', text: 'Enough clean energy (0 or more)', ok: st.energy >= 0, now: (st.energy > 0 ? '+' : '') + st.energy },
        { id: 'homes', emoji: '🏠', text: 'At least 4 houses for people to live in', ok: (st.counts.house || 0) >= 4, now: (st.counts.house || 0) + ' houses' },
        { id: 'money', emoji: '💰', text: 'Keep $50 in the city savings', ok: w.money >= 50, now: U.money(w.money) }
      ];
    },

    syncProgress: function () {
      var w = S.world('city');
      var met = this.goals().filter(function (g) { return g.ok; }).length;
      if (met > w.bestGoals) {
        w.bestGoals = met;
        var target = Math.round((met / 5) * 100);
        var delta = target - w.progress;
        if (delta > 0) P.addWorldProgress('city', delta);
        if (met === 5) {
          Sound.win('big');
          P.badge('city_planner');
          P.logActivity({ world: 'city', name: 'Planet City', detail: 'all 5 city goals met', xp: 40, stars: 3 });
          P.addXP(40);
        }
      }
      if (this.stats().env >= 70) P.badge('eco_hero');
      S.save();
    },

    /* ---------- rendering ---------- */
    render: function () {
      var self = this, body = document.getElementById('city-body');
      var w = S.world('city');
      body.innerHTML = '';
      document.getElementById('city-bar').innerHTML =
        '<span class="chip">' + U.money(w.money) + '</span>';

      body.appendChild(UI.worldHero('city', 'Planet City',
        'You are the city planner. Every choice changes the city — watch the meters!'));

      /* meters */
      var st = this.stats();
      var meters = UI.card('meters-card', []);
      meters.appendChild(UI.meter('Environment', st.env, 100, '#4fd6b8', '🌱'));
      meters.appendChild(UI.meter('Happiness', st.happy, 100, '#ffb347', '😊'));
      var energyPct = U.clamp(50 + st.energy * 2, 0, 100);
      var em = UI.meter('Energy balance', energyPct, 100, st.energy >= 0 ? '#45c8ff' : '#ff8a5c', '⚡');
      em.querySelector('.meter-val').textContent = (st.energy > 0 ? '+' : '') + st.energy;
      meters.appendChild(em);
      meters.appendChild(U.el('div', { class: 'stat-row' }, [
        U.el('div', { class: 'stat-pill' }, [U.el('b', { text: U.money(w.money) }), U.el('small', { text: 'savings' })]),
        U.el('div', { class: 'stat-pill' }, [U.el('b', { text: '+' + U.money(st.income) }), U.el('small', { text: 'per season' })]),
        U.el('div', { class: 'stat-pill' }, [U.el('b', { text: 'Season ' + w.season }), U.el('small', { text: 'now' })]),
        U.el('div', { class: 'stat-pill' }, [U.el('b', { text: st.buildings + '/' + TILES }), U.el('small', { text: 'plots used' })])
      ]));
      body.appendChild(meters);

      /* the city grid */
      var gridCard = UI.card('grid-card', []);
      var grid = U.el('div', { class: 'city-grid', id: 'city-grid',
        style: '--cols:' + COLS, role: 'grid', 'aria-label': 'City map, ' + COLS + ' by ' + ROWS + ' plots' });
      w.grid.forEach(function (id, i) {
        var b = id ? byId(id) : null;
        var cell = U.el('button', {
          class: 'city-cell' + (b ? ' filled' : ''), 'data-i': i, role: 'gridcell',
          'aria-label': b ? b.name + ' at plot ' + (i + 1) + '. Tap to remove.' : 'Empty plot ' + (i + 1) + '. Tap to build.',
          onclick: function () { self.tapCell(i); }
        }, [U.el('span', { class: 'cell-emoji', text: b ? b.emoji : '', 'aria-hidden': 'true' })]);
        grid.appendChild(cell);
      });
      gridCard.appendChild(grid);
      gridCard.appendChild(U.el('p', { class: 'muted small', id: 'city-hint',
        text: 'Pick a building below, then tap an empty green plot.' }));
      body.appendChild(gridCard);

      /* palette */
      var pal = UI.card('', [U.el('h3', { text: '🏗️ Build something' })]);
      var row = U.el('div', { class: 'palette' });
      BUILDINGS.forEach(function (b) {
        var afford = w.money >= b.cost;
        row.appendChild(U.el('button', {
          class: 'build-btn' + (self.selected === b.id ? ' sel' : '') + (afford ? '' : ' poor'),
          'aria-pressed': self.selected === b.id ? 'true' : 'false',
          'aria-label': b.name + ', costs ' + U.money(b.cost) + '. ' + self.effectText(b),
          onclick: function () { self.select(b.id); }
        }, [
          U.el('span', { class: 'build-emoji', text: b.emoji, 'aria-hidden': 'true' }),
          U.el('b', { text: b.name }),
          U.el('small', { class: 'build-cost', text: U.money(b.cost) }),
          U.el('small', { class: 'build-effect', text: self.effectShort(b) })
        ]));
      });
      pal.appendChild(row);
      pal.appendChild(U.el('div', { class: 'city-actions' }, [
        UI.bigButton('⏭️ Next season (+' + U.money(st.income) + ')', function () { self.nextSeason(); }, 'primary'),
        UI.bigButton('🗑️ Clear a plot', function () {
          self.selected = 'remove';
          document.getElementById('city-hint').textContent = 'Tap a building to remove it. You get half the money back.';
          self.render();
        }, 'secondary')
      ]));
      body.appendChild(pal);

      /* goals */
      var goalCard = UI.card('', [U.el('h3', { text: '🎯 City goals' }), UI.progressRow('city')]);
      this.goals().forEach(function (g) {
        goalCard.appendChild(U.el('div', { class: 'goal-row' + (g.ok ? ' ok' : '') }, [
          U.el('span', { class: 'goal-mark', text: g.ok ? '✅' : '⬜', 'aria-hidden': 'true' }),
          U.el('span', { class: 'goal-text', text: g.emoji + ' ' + g.text }),
          U.el('b', { class: 'goal-now', text: g.now })
        ]));
      });
      body.appendChild(goalCard);

      /* what the city teaches */
      var facts = UI.card('', [U.el('h4', { text: '📘 City science' })]);
      var learned = w.learned || [];
      if (!learned.length) {
        facts.appendChild(U.el('p', { class: 'muted', text: 'Build something new and you will learn a fact about it here.' }));
      } else {
        var ul = U.el('ul', { class: 'bullets' });
        learned.forEach(function (id) {
          var b = byId(id);
          if (b) ul.appendChild(U.el('li', { text: b.emoji + ' ' + b.fact }));
        });
        facts.appendChild(ul);
      }
      body.appendChild(facts);
    },

    effectShort: function (b) {
      var bits = [];
      if (b.env) bits.push((b.env > 0 ? '+' : '') + b.env + '🌱');
      if (b.happy) bits.push((b.happy > 0 ? '+' : '') + b.happy + '😊');
      if (b.energy) bits.push((b.energy > 0 ? '+' : '') + b.energy + '⚡');
      if (b.income) bits.push('+' + b.income + '💰');
      return bits.join(' ');
    },
    effectText: function (b) {
      var bits = [];
      bits.push('Environment ' + (b.env >= 0 ? 'up ' : 'down ') + Math.abs(b.env));
      bits.push('happiness ' + (b.happy >= 0 ? 'up ' : 'down ') + Math.abs(b.happy));
      bits.push('energy ' + (b.energy >= 0 ? 'up ' : 'down ') + Math.abs(b.energy));
      if (b.income) bits.push('earns ' + b.income + ' dollars a season');
      return bits.join(', ') + '.';
    },

    select: function (id) {
      Sound.play('tap');
      this.selected = (this.selected === id) ? null : id;
      var b = byId(id);
      var hint = document.getElementById('city-hint');
      if (this.selected && b) {
        hint.textContent = b.emoji + ' ' + b.name + ' selected — tap an empty plot to build it.';
      }
      this.render();
      if (this.selected && b) WW.Buddy.say(b.fact, 5200);
    },

    tapCell: function (i) {
      var self = this, w = S.world('city');
      var existing = w.grid[i];

      if (this.selected === 'remove' || (existing && !this.selected)) {
        if (!existing) { Sound.play('oops'); FX.toast('That plot is already empty.'); return; }
        var b0 = byId(existing);
        var refund = Math.round(b0.cost / 2);
        w.grid[i] = null;
        w.money += refund;
        Sound.play('place');
        FX.toast('Removed ' + b0.name + ' · +' + U.money(refund) + ' back');
        this.selected = null;
        this.syncProgress();
        S.save();
        this.render();
        return;
      }

      if (!this.selected) {
        Sound.play('oops');
        FX.toast('Pick a building from the row below first 👇');
        return;
      }
      if (existing) {
        Sound.play('oops');
        FX.toast('That plot is taken. Try an empty one!');
        return;
      }

      var b = byId(this.selected);
      if (w.money < b.cost) {
        Sound.play('oops');
        WW.Modal.open({
          title: 'Not enough money yet',
          body: U.el('p', { class: 'modal-text', text: b.name + ' costs ' + U.money(b.cost) +
            ' and the city has ' + U.money(w.money) + '. Press "Next season" to collect taxes, or build something cheaper.' })
        });
        return;
      }

      var before = this.stats();
      w.grid[i] = b.id;
      w.money -= b.cost;
      var after = this.stats();

      Sound.play('place');
      var cell = document.querySelector('.city-cell[data-i="' + i + '"]');
      if (cell) FX.burst(cell, b.emoji, 5);

      /* teach the first time each building type is used */
      w.learned = w.learned || [];
      if (w.learned.indexOf(b.id) === -1) {
        w.learned.push(b.id);
        P.addXP(16);
        P.logActivity({ world: 'city', name: 'Built a ' + b.name, detail: 'first time', xp: 16 });
        setTimeout(function () {
          WW.Modal.open({
            title: b.emoji + ' ' + b.name,
            body: U.el('div', {}, [
              U.el('p', { class: 'modal-text', text: b.fact }),
              U.el('div', { class: 'delta-row' }, [
                self.deltaPill('🌱 Environment', after.env - before.env),
                self.deltaPill('😊 Happiness', after.happy - before.happy),
                self.deltaPill('⚡ Energy', after.energy - before.energy)
              ])
            ])
          });
        }, 350);
      } else {
        var msg = [];
        if (b.env) msg.push((b.env > 0 ? '+' : '') + b.env + ' 🌱');
        if (b.happy) msg.push((b.happy > 0 ? '+' : '') + b.happy + ' 😊');
        if (b.energy) msg.push((b.energy > 0 ? '+' : '') + b.energy + ' ⚡');
        FX.toast(b.emoji + ' ' + b.name + ' built · ' + msg.join('  '));
      }

      this.syncProgress();
      S.save();
      this.render();
    },

    deltaPill: function (label, v) {
      var sign = v > 0 ? '+' : '';
      return U.el('div', { class: 'delta-pill ' + (v > 0 ? 'up' : (v < 0 ? 'down' : 'flat')) }, [
        U.el('small', { text: label }), U.el('b', { text: sign + v })
      ]);
    },

    nextSeason: function () {
      var w = S.world('city'), st = this.stats();
      w.season++;
      w.money += st.income;
      P.addXP(6);

      var events = [];
      if (st.env >= 75) events.push('🦋 Butterflies returned to the parks! The air is lovely.');
      else if (st.env < 35) events.push('🌫️ The air is getting smoggy. More trees or fewer factories would help.');
      if (st.energy < 0) events.push('🔌 The city ran short of power this season. Clean energy would fix it.');
      if (st.happy >= 80) events.push('🎉 People love living here — a street party broke out!');
      var bonus = 0;
      if (st.env >= 70 && st.happy >= 70) {
        bonus = 12;
        w.money += bonus;
        events.push('🏅 Your city won a Green City award: +' + U.money(bonus) + '!');
      }
      events.push(U.pick(SEASON_TIPS));

      Sound.play('coin');
      var list = U.el('ul', { class: 'bullets' });
      events.forEach(function (e) { list.appendChild(U.el('li', { text: e })); });

      WW.Modal.open({
        title: '🍂 Season ' + w.season,
        body: U.el('div', {}, [
          U.el('p', { class: 'modal-text', text: 'The city collected ' + U.money(st.income) +
            ' in taxes' + (bonus ? ' plus a ' + U.money(bonus) + ' award' : '') + '.' }),
          list
        ])
      });

      this.syncProgress();
      S.save(true);
      this.render();
    }
  };

  City.BUILDINGS = BUILDINGS;
  WW.Screens.city = City;

})(window.WW);
