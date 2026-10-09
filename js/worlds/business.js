/* =============================================================
   WonderWorld — worlds/business.js
   BUSINESS TOWN: run a lemonade stand for a 7-day week.

   Each day the child chooses price, how many cups to make and
   how much to spend on advertising. The result screen shows the
   real arithmetic:
       Revenue = price × cups sold
       Profit  = revenue − costs
   Saving money in the piggy bank earns interest at week's end.
   ============================================================= */
(function (WW) {
  'use strict';

  var U = WW.Util, S = WW.State, P = WW.Progress, FX = WW.FX,
      UI = WW.UI, Nav = WW.Nav, Sound = WW.Sound;

  var DAYS = 7;
  var BASE_CUP_COST = 0.15;

  var WEATHERS = [
    { id: 'heat', emoji: '🔥', name: 'Heat wave', mult: 1.40, note: 'Everybody is thirsty!' },
    { id: 'sunny', emoji: '☀️', name: 'Sunny', mult: 1.15, note: 'A lovely day for lemonade.' },
    { id: 'partly', emoji: '⛅', name: 'Partly cloudy', mult: 1.00, note: 'An ordinary day.' },
    { id: 'cloudy', emoji: '☁️', name: 'Cloudy', mult: 0.85, note: 'Fewer people out walking.' },
    { id: 'rain', emoji: '🌧️', name: 'Rainy', mult: 0.55, note: 'Hardly anyone wants a cold drink.' }
  ];

  var UPGRADES = [
    { id: 'sign', emoji: '🪧', name: 'Big colorful sign', cost: 10, day: 2,
      desc: 'Brings about 4 extra customers every single day — a one-off cost that keeps paying back.' },
    { id: 'cookies', emoji: '🍪', name: 'Add cookies to the menu', cost: 15, day: 3,
      desc: 'About 18% more customers, but each cup costs 10¢ more to make.' },
    { id: 'cart', emoji: '🛒', name: 'A second little cart', cost: 35, day: 4,
      desc: 'Reaches a whole new street: about 30% more customers.' }
  ];

  var LESSONS = [
    '💡 Revenue is all the money that comes IN. Profit is what is left after you pay your costs.',
    '💡 If you make too many cups, the extra ones are wasted money.',
    '💡 A low price brings more customers but earns less per cup. A high price does the opposite.',
    '💡 Advertising costs money today but can bring customers tomorrow.',
    '💡 Saving some profit means you can afford bigger things later.',
    '💡 Running out of cups makes customers sad — your reputation drops.'
  ];

  function dayForecast(day) {
    /* Deterministic-ish per day so the forecast doesn't flicker on re-render */
    var w = U.pick(WEATHERS);
    var temp = ({ heat: U.rnd(32, 38), sunny: U.rnd(24, 31), partly: U.rnd(19, 26),
                  cloudy: U.rnd(15, 22), rain: U.rnd(12, 20) })[w.id];
    return { weather: w, temp: temp, day: day };
  }

  var Biz = WW.Worlds.business = {
    phase: null,     /* 'plan' | 'result' | 'week' */
    plan: null,
    forecast: null,

    back: function () { Nav.go('map'); },

    enter: function () {
      var w = S.world('business');
      w.upgrades = w.upgrades || [];
      w.history = w.history || [];
      if (w.day > DAYS) w.day = DAYS;
      this.forecast = dayForecast(w.day);
      this.plan = { price: 0.50, cups: 20, ads: 1 };
      this.phase = 'plan';
      this.renderPlan();
    },

    cupCost: function () {
      var w = S.world('business');
      return BASE_CUP_COST + (w.upgrades.indexOf('cookies') !== -1 ? 0.10 : 0);
    },

    /* ---------- the model, in one honest little function ---------- */
    simulate: function (plan, forecast) {
      var w = S.world('business');
      var base = 14 + (forecast.temp - 15) * 1.3;
      var priceFactor = U.clamp(1.7 - plan.price * 0.9, 0.05, 1.5);
      var repFactor = 0.6 + (w.rep / 100) * 0.8;
      var demand = base * forecast.weather.mult * priceFactor * repFactor;
      demand += plan.ads * 2.2;
      if (w.upgrades.indexOf('sign') !== -1) demand += 4;
      if (w.upgrades.indexOf('cookies') !== -1) demand *= 1.18;
      if (w.upgrades.indexOf('cart') !== -1) demand *= 1.30;
      demand = Math.max(0, Math.round(demand));

      var sold = Math.min(demand, plan.cups);
      var revenue = U.round(sold * plan.price, 2);
      var costs = U.round(plan.cups * this.cupCost() + plan.ads, 2);
      var profit = U.round(revenue - costs, 2);

      return {
        demand: demand, sold: sold, leftover: plan.cups - sold,
        soldOut: demand > plan.cups,
        revenue: revenue, costs: costs, profit: profit
      };
    },

    /* ===========================================================
       PLAN THE DAY
       =========================================================== */
    renderPlan: function () {
      var self = this, body = document.getElementById('business-body');
      var w = S.world('business');
      var f = this.forecast;
      body.innerHTML = '';
      document.getElementById('business-bar').innerHTML =
        '<span class="chip">Day ' + w.day + '/' + DAYS + '</span>';

      body.appendChild(UI.worldHero('business', 'Lemonade Stand',
        'Day ' + w.day + ' of ' + DAYS + '. Choose your price, cups and advertising.'));

      /* stand scene */
      var stand = U.el('div', { class: 'stand-scene', 'aria-hidden': 'true' });
      stand.innerHTML =
        '<div class="stand-sky ' + f.weather.id + '"><span class="stand-weather">' + f.weather.emoji + '</span></div>' +
        '<div class="stand-table">🍋 LEMONADE 🍋</div>' +
        '<div class="stand-kid">' + WW.Avatar.svg(S.data.player, { label: 'You at the stand' }) + '</div>' +
        '<div class="stand-buddy">' + S.companion().emoji + '</div>';
      body.appendChild(stand);

      /* money bar */
      body.appendChild(UI.card('money-bar', [
        U.el('div', { class: 'stat-row' }, [
          U.el('div', { class: 'stat-pill' }, [U.el('b', { text: U.money(w.cash) }), U.el('small', { text: 'cash' })]),
          U.el('div', { class: 'stat-pill' }, [U.el('b', { text: U.money(w.savings) }), U.el('small', { text: 'piggy bank' })]),
          U.el('div', { class: 'stat-pill' }, [U.el('b', { text: w.rep + '%' }), U.el('small', { text: 'reputation' })]),
          U.el('div', { class: 'stat-pill' }, [U.el('b', { text: f.temp + '°C' }), U.el('small', { text: f.weather.name })])
        ])
      ]));

      /* forecast */
      body.appendChild(UI.card('', [
        U.el('h3', { text: '📰 Today\'s forecast' }),
        U.el('div', { class: 'forecast' }, [
          U.el('span', { class: 'forecast-emoji', text: f.weather.emoji, 'aria-hidden': 'true' }),
          U.el('div', {}, [
            U.el('b', { text: f.weather.name + ' · ' + f.temp + '°C' }),
            U.el('small', { text: f.weather.note })
          ])
        ])
      ]));

      /* controls */
      var cost = U.el('p', { class: 'cost-line', id: 'cost-line' });
      var ctrl = UI.card('', [U.el('h3', { text: '🧾 Your plan for today' })]);

      ctrl.appendChild(UI.stepper({
        label: 'Price per cup', value: Math.round(this.plan.price * 100), min: 25, max: 200, step: 5,
        format: function (v) { return v < 100 ? v + '¢' : '$' + (v / 100).toFixed(2); },
        onChange: function (v) { self.plan.price = v / 100; updateCost(); }
      }));
      ctrl.appendChild(UI.stepper({
        label: 'Cups to make', value: this.plan.cups, min: 0, max: 60, step: 5,
        format: function (v) { return v + ' cups'; },
        onChange: function (v) { self.plan.cups = v; updateCost(); }
      }));
      ctrl.appendChild(UI.stepper({
        label: 'Advertising', value: this.plan.ads, min: 0, max: 10, step: 1,
        format: function (v) { return v === 0 ? 'none' : '$' + v; },
        onChange: function (v) { self.plan.ads = v; updateCost(); }
      }));
      ctrl.appendChild(cost);
      ctrl.appendChild(UI.bigButton('🍋 Open the stand!', function () { self.openStand(); }, 'primary wide'));
      body.appendChild(ctrl);

      function updateCost() {
        var total = U.round(self.plan.cups * self.cupCost() + self.plan.ads, 2);
        var affordable = total <= w.cash;
        cost.innerHTML = 'Today\'s costs: <b>' + self.plan.cups + ' cups × ' +
          Math.round(self.cupCost() * 100) + '¢</b> + <b>' + U.money(self.plan.ads) +
          ' ads</b> = <b class="' + (affordable ? 'ok' : 'over') + '">' + U.money(total) + '</b>' +
          (affordable ? '' : ' — more than your ' + U.money(w.cash) + '!');
      }
      updateCost();

      /* upgrades */
      var avail = UPGRADES.filter(function (u) {
        return w.upgrades.indexOf(u.id) === -1 && w.day >= u.day;
      });
      if (avail.length || w.upgrades.length) {
        var up = UI.card('', [U.el('h3', { text: '🚀 Grow the business' })]);
        avail.forEach(function (u) {
          up.appendChild(U.el('button', {
            class: 'upgrade-row' + (w.cash >= u.cost ? '' : ' poor'),
            'aria-label': u.name + ', costs ' + U.money(u.cost) + '. ' + u.desc,
            onclick: function () { self.buyUpgrade(u); }
          }, [
            U.el('span', { class: 'lab-emoji', text: u.emoji, 'aria-hidden': 'true' }),
            U.el('span', { class: 'lab-text' }, [U.el('b', { text: u.name }), U.el('small', { text: u.desc })]),
            U.el('span', { class: 'lab-count', text: U.money(u.cost) })
          ]));
        });
        if (w.upgrades.length) {
          up.appendChild(U.el('p', { class: 'muted small', text: 'You own: ' +
            w.upgrades.map(function (id) {
              var u = UPGRADES.filter(function (x) { return x.id === id; })[0];
              return u ? u.emoji + ' ' + u.name : id;
            }).join(' · ') }));
        }
        body.appendChild(up);
      }

      /* teaching card */
      body.appendChild(UI.card('', [
        U.el('h4', { text: '📘 How money works here' }),
        U.el('div', { class: 'formula' }, [
          U.el('div', { class: 'formula-line' }, [U.el('b', { text: 'Revenue' }), U.el('span', { text: '= price × cups sold' })]),
          U.el('div', { class: 'formula-line' }, [U.el('b', { text: 'Costs' }), U.el('span', { text: '= cups made × cup cost + advertising' })]),
          U.el('div', { class: 'formula-line big' }, [U.el('b', { text: 'Profit' }), U.el('span', { text: '= revenue − costs' })])
        ]),
        U.el('p', { class: 'muted small', text: U.pick(LESSONS) })
      ]));

      body.appendChild(UI.card('', [UI.progressRow('business')]));
    },

    buyUpgrade: function (u) {
      var w = S.world('business');
      if (w.cash < u.cost) {
        Sound.play('oops');
        WW.Modal.open({ title: 'Not enough cash yet',
          body: U.el('p', { class: 'modal-text', text: u.name + ' costs ' + U.money(u.cost) +
            ' and you have ' + U.money(w.cash) + '. Sell a few more cups first!' }) });
        return;
      }
      w.cash = U.round(w.cash - u.cost, 2);
      w.upgrades.push(u.id);
      Sound.play('reward');
      P.addXP(18);
      P.logActivity({ world: 'business', name: 'Bought ' + u.name, detail: 'investment of ' + U.money(u.cost), xp: 18 });
      FX.celebrate({ emoji: u.emoji, title: u.name + ' bought!',
        lines: [u.desc, 'Spending money to earn more later is called an investment.'] });
      S.save(true);
      this.renderPlan();
    },

    /* ===========================================================
       RUN THE DAY
       =========================================================== */
    openStand: function () {
      var self = this, w = S.world('business');
      var costs = U.round(this.plan.cups * this.cupCost() + this.plan.ads, 2);
      if (costs > w.cash) {
        Sound.play('oops');
        WW.Modal.open({
          title: 'That costs too much',
          body: U.el('p', { class: 'modal-text', text: 'Your plan costs ' + U.money(costs) +
            ' but you only have ' + U.money(w.cash) + '. Make fewer cups or spend less on ads.' })
        });
        return;
      }
      if (this.plan.cups === 0) {
        Sound.play('oops');
        FX.toast('You need at least a few cups to sell! 🍋');
        return;
      }

      var r = this.simulate(this.plan, this.forecast);
      w.cash = U.round(w.cash - costs + r.revenue, 2);

      /* reputation reacts to the choices */
      var repBefore = w.rep;
      if (r.soldOut) w.rep -= 3;
      else if (this.plan.price <= 1.00) w.rep += 4;
      if (this.plan.price > 1.25) w.rep -= 3;
      if (this.plan.ads >= 3) w.rep += 1;
      w.rep = U.clamp(w.rep, 10, 100);

      w.history.push({
        day: w.day, price: this.plan.price, made: this.plan.cups, sold: r.sold,
        revenue: r.revenue, costs: costs, profit: r.profit, weather: this.forecast.weather.id
      });

      P.answer('business', r.profit > 0);
      P.addXP(18 + (r.profit > 0 ? 8 : 0));
      if (r.profit > 0) P.addGems(3);
      if (w.day === 1 && r.profit > 0) P.badge('first_profit');
      P.addWorldProgress('business', 100 / DAYS);
      P.logActivity({
        world: 'business', name: 'Lemonade day ' + w.day,
        detail: 'sold ' + r.sold + ' cups · profit ' + U.money(r.profit),
        stars: r.profit > 5 ? 3 : (r.profit > 0 ? 2 : 1), xp: 18
      });

      this.phase = 'result';
      this.renderResult(r, costs, repBefore);
      S.save(true);
    },

    renderResult: function (r, costs, repBefore) {
      var self = this, w = S.world('business');
      var body = document.getElementById('business-body');
      body.innerHTML = '';

      if (r.profit > 0) { Sound.win('small'); FX.confetti(); }
      else Sound.play('oops');

      var head = UI.card('result-card', [
        U.el('div', { class: 'result-emoji', text: r.profit > 0 ? '🎉' : '🤔' }),
        U.el('h3', { text: 'Day ' + w.day + ' is done!' }),
        U.el('p', { class: 'muted', text: r.sold + ' cups sold out of ' + this.plan.cups + ' made.' })
      ]);
      body.appendChild(head);

      /* the math, written out */
      var calc = UI.card('', [U.el('h3', { text: '🧮 Today\'s math' })]);
      calc.appendChild(this.calcRow('Revenue', U.money(this.plan.price) + ' × ' + r.sold + ' cups', U.money(r.revenue), 'in'));
      calc.appendChild(this.calcRow('Cost of lemonade', this.plan.cups + ' cups × ' +
        Math.round(this.cupCost() * 100) + '¢', '−' + U.money(U.round(this.plan.cups * this.cupCost(), 2)), 'out'));
      calc.appendChild(this.calcRow('Advertising', this.plan.ads ? 'you spent ' + U.money(this.plan.ads) : 'none', '−' + U.money(this.plan.ads), 'out'));
      calc.appendChild(this.calcRow('PROFIT', U.money(r.revenue) + ' − ' + U.money(costs),
        (r.profit >= 0 ? '' : '') + U.money(r.profit), r.profit >= 0 ? 'profit' : 'loss'));
      body.appendChild(calc);

      /* what we learned today */
      var notes = [];
      if (r.soldOut) notes.push('🥤 You sold out! ' + (r.demand - r.sold) +
        ' more customers wanted lemonade. Making more cups tomorrow could earn more.');
      if (r.leftover > 3) notes.push('🗑️ ' + r.leftover + ' cups were left over — that is ' +
        U.money(U.round(r.leftover * this.cupCost(), 2)) + ' of wasted money. Try making fewer.');
      if (this.plan.price > 1.25) notes.push('💸 Your price was quite high, so some people walked away.');
      if (this.plan.price <= 0.40) notes.push('🏷️ Your price was very low — lots of customers, but only a little money from each one.');
      if (this.plan.ads > 0) notes.push('📣 Advertising brought about ' + Math.round(this.plan.ads * 2.2) + ' extra customers.');
      if (w.rep > repBefore) notes.push('⭐ Your reputation went UP to ' + w.rep + '% — happy customers come back.');
      if (w.rep < repBefore) notes.push('😕 Your reputation dipped to ' + w.rep + '%. Fair prices and enough cups will fix it.');
      if (!notes.length) notes.push('👍 A steady day. Try changing one thing tomorrow and see what happens.');

      var learn = UI.card('', [U.el('h3', { text: '📘 What happened and why' })]);
      var ul = U.el('ul', { class: 'bullets' });
      notes.forEach(function (n) { ul.appendChild(U.el('li', { text: n })); });
      learn.appendChild(ul);
      body.appendChild(learn);

      /* saving */
      var saveCard = UI.card('', [
        U.el('h3', { text: '🏦 Piggy bank' }),
        U.el('p', { class: 'muted', text: 'Money you save is safe — and at the end of the week the bank adds 10% interest as a thank you.' }),
        U.el('div', { class: 'stat-row' }, [
          U.el('div', { class: 'stat-pill' }, [U.el('b', { id: 'biz-cash', text: U.money(w.cash) }), U.el('small', { text: 'cash' })]),
          U.el('div', { class: 'stat-pill' }, [U.el('b', { id: 'biz-save', text: U.money(w.savings) }), U.el('small', { text: 'saved' })])
        ])
      ]);
      var saveRow = U.el('div', { class: 'save-row' });
      [1, 5, 10].forEach(function (amt) {
        saveRow.appendChild(UI.bigButton('🏦 Save ' + U.money(amt), function () {
          if (w.cash < amt) { Sound.play('oops'); FX.toast('Not enough cash to save that much.'); return; }
          w.cash = U.round(w.cash - amt, 2);
          w.savings = U.round(w.savings + amt, 2);
          if (w.savings >= 10) P.badge('super_saver');
          Sound.play('coin');
          FX.toast('Saved ' + U.money(amt) + ' 🏦');
          document.getElementById('biz-cash').textContent = U.money(w.cash);
          document.getElementById('biz-save').textContent = U.money(w.savings);
          S.save();
        }, 'secondary slim'));
      });
      saveCard.appendChild(saveRow);
      body.appendChild(saveCard);

      body.appendChild(UI.card('', [UI.progressRow('business')]));

      var nextCard = UI.card('', []);
      if (w.day >= DAYS) {
        nextCard.appendChild(UI.bigButton('📊 See the week summary', function () { self.weekSummary(); }, 'primary wide'));
      } else {
        nextCard.appendChild(UI.bigButton('🌅 Start day ' + (w.day + 1), function () {
          w.day++;
          self.forecast = dayForecast(w.day);
          self.phase = 'plan';
          S.save(true);
          self.renderPlan();
        }, 'primary wide'));
      }
      nextCard.appendChild(UI.bigButton('🗺️ Back to the map', function () { Nav.go('map'); }, 'secondary wide'));
      body.appendChild(nextCard);

      WW.Buddy.say(r.profit > 0 ? 'We made a profit! 🤑' : 'Every business has slow days. Let\'s adjust!');
    },

    calcRow: function (label, detail, value, kind) {
      return U.el('div', { class: 'calc-row ' + kind }, [
        U.el('div', {}, [U.el('b', { text: label }), U.el('small', { text: detail })]),
        U.el('span', { class: 'calc-val', text: value })
      ]);
    },

    /* ===========================================================
       WEEK SUMMARY
       =========================================================== */
    weekSummary: function () {
      var self = this, w = S.world('business');
      var body = document.getElementById('business-body');
      body.innerHTML = '';

      var week = w.history.slice(-DAYS);
      var totalProfit = U.round(week.reduce(function (a, d) { return a + d.profit; }, 0), 2);
      var totalSold = week.reduce(function (a, d) { return a + d.sold; }, 0);
      var best = week.slice().sort(function (a, b) { return b.profit - a.profit; })[0];
      var interest = U.round(w.savings * 0.10, 2);
      w.savings = U.round(w.savings + interest, 2);

      P.addXP(50);
      P.addGems(10);
      P.logActivity({ world: 'business', name: 'Finished a business week',
        detail: 'total profit ' + U.money(totalProfit), stars: 3, xp: 50 });
      S.save(true);

      Sound.win('big');
      FX.confetti();

      var card = UI.card('result-card', [
        U.el('div', { class: 'result-emoji', text: '🏆' }),
        U.el('h3', { text: 'Week finished!' }),
        U.el('p', { class: 'muted', text: 'You sold ' + totalSold + ' cups in ' + DAYS + ' days.' })
      ]);
      body.appendChild(card);

      var chart = UI.card('', [U.el('h3', { text: '📊 Profit each day' })]);
      var maxAbs = Math.max(1, Math.max.apply(null, week.map(function (d) { return Math.abs(d.profit); })));
      var bars = U.el('div', { class: 'bar-chart' });
      week.forEach(function (d) {
        var h = U.clamp(Math.round((Math.abs(d.profit) / maxAbs) * 100), 4, 100);
        var col = U.el('div', { class: 'bar-col' }, [
          U.el('span', { class: 'bar-val', text: U.money(d.profit) }),
          (function () {
            var b = U.el('i', { class: 'bar' + (d.profit < 0 ? ' neg' : '') });
            b.style.height = h + '%';
            return b;
          })(),
          U.el('small', { text: 'Day ' + d.day })
        ]);
        bars.appendChild(col);
      });
      chart.appendChild(bars);
      body.appendChild(chart);

      var sum = UI.card('', [U.el('h3', { text: '🧾 The whole week' })]);
      sum.appendChild(this.calcRow('Total profit', 'all 7 days added up', U.money(totalProfit), totalProfit >= 0 ? 'profit' : 'loss'));
      sum.appendChild(this.calcRow('Best day', 'Day ' + best.day + ' — sold ' + best.sold + ' cups', U.money(best.profit), 'in'));
      sum.appendChild(this.calcRow('Piggy bank interest', '10% of ' + U.money(U.round(w.savings - interest, 2)), '+' + U.money(interest), 'in'));
      sum.appendChild(this.calcRow('Money you have now', 'cash + savings',
        U.money(U.round(w.cash + w.savings, 2)), 'profit'));
      body.appendChild(sum);

      var lesson = UI.card('', [U.el('h3', { text: '📘 Big ideas you used' }),
        U.el('ul', { class: 'bullets' }, [
          U.el('li', { text: '💵 Revenue is money coming in. Costs are money going out. Profit is what is left.' }),
          U.el('li', { text: '🏷️ Price changes how many people buy. Finding the "just right" price is a real business skill.' }),
          U.el('li', { text: '📦 Making more than you can sell wastes money. Planning matters.' }),
          U.el('li', { text: '🏦 Saving a little each day adds up — and the bank paid you ' + U.money(interest) + ' for saving.' }),
          U.el('li', { text: '🚀 Spending money on a sign or a cart is an investment: it costs now and earns later.' })
        ])]);
      body.appendChild(lesson);

      var actions = UI.card('', []);
      actions.appendChild(UI.bigButton('🔁 Start a new week', function () {
        w.day = 1;
        self.forecast = dayForecast(1);
        self.plan = { price: 0.50, cups: 20, ads: 1 };
        S.save(true);
        self.renderPlan();
      }, 'primary wide'));
      actions.appendChild(UI.bigButton('🗺️ Back to the map', function () { Nav.go('map'); }, 'secondary wide'));
      body.appendChild(actions);
    }
  };

  Biz.UPGRADES = UPGRADES;
  Biz.WEATHERS = WEATHERS;
  WW.Screens.business = Biz;

})(window.WW);
