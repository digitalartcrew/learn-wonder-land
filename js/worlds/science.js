/* =============================================================
   WonderWorld — worlds/science.js
   SCIENCE LAB: three hands-on experiments.
     🌱 Plant     — change water / light / soil, watch what happens
     🧲 Magnets   — predict, then test every object
     🌦️ Weather   — move temperature, moisture and wind, make weather

   Progress is recomputed from what the child has DISCOVERED, so
   it rewards exploring rather than repeating.
   ============================================================= */
(function (WW) {
  'use strict';

  var U = WW.Util, S = WW.State, P = WW.Progress, FX = WW.FX,
      UI = WW.UI, Nav = WW.Nav, Sound = WW.Sound;

  /* ---------------- PLANT ---------------- */
  var PLANT_RESULTS = {
    noSoil:        { emoji: '😟', title: 'No soil, no home', stage: 0,
      text: 'Without soil the roots have nothing to hold on to and no minerals to drink. Roots are a plant\'s anchor AND its straw.' },
    noWater:       { emoji: '🥀', title: 'Too dry', stage: 1,
      text: 'Plants drink water through their roots. With no water the leaves droop and go crispy.' },
    tooMuchWater:  { emoji: '🫧', title: 'Too much water', stage: 1,
      text: 'Surprise! Roots need air as well as water. Soaking soil drowns them. A little water often is best.' },
    noLight:       { emoji: '🌑', title: 'Too dark', stage: 2,
      text: 'Leaves use sunlight to make their own food. That is called photosynthesis. In the dark the plant turns pale and stretchy.' },
    lowLight:      { emoji: '🌤️', title: 'A little light', stage: 3,
      text: 'Some light means some food, so the plant grows — just small and slow. More light would help!' },
    poorSoil:      { emoji: '🏜️', title: 'Sandy soil', stage: 3,
      text: 'Sand drains too fast and has few minerals. Rich dark soil holds water and feeds the roots.' },
    perfect:       { emoji: '🌻', title: 'A perfect plant!', stage: 5,
      text: 'Water + light + good soil = a healthy plant. Roots drink, leaves catch sunlight, and the stem carries it all.' }
  };
  var PLANT_KEYS = Object.keys(PLANT_RESULTS);

  /* ---------------- MAGNETS ---------------- */
  var MAGNET_OBJECTS = [
    { id: 'clip', emoji: '📎', name: 'paper clip', magnetic: true,  made: 'steel' },
    { id: 'wood', emoji: '🪵', name: 'wooden block', magnetic: false, made: 'wood' },
    { id: 'bolt', emoji: '🔩', name: 'iron bolt', magnetic: true,  made: 'iron' },
    { id: 'cup', emoji: '🥤', name: 'plastic cup', magnetic: false, made: 'plastic' },
    { id: 'duck', emoji: '🦆', name: 'rubber duck', magnetic: false, made: 'rubber' },
    { id: 'scissors', emoji: '✂️', name: 'steel scissors', magnetic: true, made: 'steel' },
    { id: 'can', emoji: '🥫', name: 'steel can', magnetic: true, made: 'steel' },
    { id: 'coin', emoji: '🪙', name: 'copper coin', magnetic: false, made: 'copper' },
    { id: 'fork', emoji: '🍴', name: 'steel fork', magnetic: true, made: 'steel' },
    { id: 'sponge', emoji: '🧽', name: 'sponge', magnetic: false, made: 'foam' }
  ];

  /* ---------------- WEATHER ---------------- */
  var WEATHER_TYPES = {
    sunny:  { emoji: '☀️', name: 'Sunny', text: 'Warm air, dry air and calm wind. The sun heats the ground and we get a clear bright day.' },
    cloudy: { emoji: '☁️', name: 'Cloudy', text: 'Water vapour cooled down and stuck to dust in the air. Billions of tiny droplets make a cloud.' },
    rain:   { emoji: '🌧️', name: 'Rain', text: 'When cloud droplets bump together they get heavy and fall as rain. That is part of the water cycle.' },
    snow:   { emoji: '❄️', name: 'Snow', text: 'Below freezing (0°C), water droplets turn into ice crystals. Every snowflake has six sides!' },
    storm:  { emoji: '⛈️', name: 'Thunderstorm', text: 'Lots of moisture plus strong wind makes tall clouds. Ice bumping inside them creates lightning.' },
    windy:  { emoji: '🌬️', name: 'Windy', text: 'Wind is air moving from high pressure to low pressure. Warm air rises and cooler air rushes in.' },
    fog:    { emoji: '🌫️', name: 'Fog', text: 'Fog is a cloud that forms right at the ground, when damp air cools on a still day.' }
  };
  var WEATHER_GOALS = ['sunny', 'rain', 'snow', 'storm', 'windy', 'fog'];

  function weatherFor(temp, moisture, wind) {
    if (temp <= 0 && moisture >= 40) return 'snow';
    if (moisture >= 70 && wind >= 60) return 'storm';
    if (moisture >= 60) return 'rain';
    if (moisture >= 35 && temp < 12 && wind < 30) return 'fog';
    if (wind >= 60) return 'windy';
    if (moisture >= 35) return 'cloudy';
    return 'sunny';
  }

  /* =========================================================== */
  var Science = WW.Worlds.science = {
    view: null,

    back: function () {
      if (this.view) { this.view = null; this.renderHub(); return; }
      Nav.go('map');
    },

    enter: function () { this.view = null; this.renderHub(); },

    /* Recompute science progress from discoveries */
    recalc: function () {
      var w = S.world('science');
      var plant = (w.plant.length / PLANT_KEYS.length) * 34;
      var testedCount = Object.keys(w.magnet).length;
      var magnet = (testedCount / MAGNET_OBJECTS.length) * 33;
      var weather = (w.weather.length / WEATHER_GOALS.length) * 33;
      var target = Math.min(100, Math.round(plant + magnet + weather));
      var delta = target - w.progress;
      if (delta > 0) P.addWorldProgress('science', delta);
    },

    discover: function (bucket, key, xp) {
      var w = S.world('science');
      if (w[bucket].indexOf(key) !== -1) return false;
      w[bucket].push(key);
      P.addXP(xp || 15);
      P.addGems(2);
      FX.toast('🔬 New discovery recorded!');
      this.recalc();
      S.save(true);
      return true;
    },

    /* ---------------- HUB ---------------- */
    renderHub: function () {
      var self = this, body = document.getElementById('science-body');
      var w = S.world('science');
      body.innerHTML = '';
      document.getElementById('science-bar').innerHTML = '';

      body.appendChild(UI.worldHero('science', 'Science Lab',
        'Try things, change things, and find out WHY. Nothing can break!'));

      var labs = [
        { id: 'plant', emoji: '🌱', name: 'Plant Experiment',
          sub: 'What do plants really need?',
          done: w.plant.length, total: PLANT_KEYS.length },
        { id: 'magnet', emoji: '🧲', name: 'Magnet Experiment',
          sub: 'Guess first, then test it!',
          done: Object.keys(w.magnet).length, total: MAGNET_OBJECTS.length },
        { id: 'weather', emoji: '🌦️', name: 'Weather Machine',
          sub: 'Make sun, rain, snow and storms',
          done: w.weather.length, total: WEATHER_GOALS.length }
      ];

      var card = UI.card('', [U.el('h3', { text: '🧪 Pick an experiment' }), UI.progressRow('science')]);
      labs.forEach(function (l) {
        card.appendChild(U.el('button', {
          class: 'lab-row' + (l.done >= l.total ? ' done' : ''),
          'aria-label': l.name + '. ' + l.sub + '. ' + l.done + ' of ' + l.total + ' discoveries found.',
          onclick: function () { Sound.play('tap'); self.open(l.id); }
        }, [
          U.el('span', { class: 'lab-emoji', text: l.emoji, 'aria-hidden': 'true' }),
          U.el('span', { class: 'lab-text' }, [
            U.el('b', { text: l.name }), U.el('small', { text: l.sub }),
            U.el('span', { class: 'mini-track' }, [
              (function () { var i = U.el('i'); i.style.width = (l.done / l.total * 100) + '%'; i.style.background = '#bb8bff'; return i; })()
            ])
          ]),
          U.el('span', { class: 'lab-count', text: l.done + '/' + l.total })
        ]));
      });
      body.appendChild(card);

      /* Lab notebook of everything learned so far */
      var note = UI.card('', [U.el('h4', { text: '📓 My lab notebook' })]);
      var found = [];
      w.plant.forEach(function (k) { found.push(PLANT_RESULTS[k].emoji + ' ' + PLANT_RESULTS[k].text); });
      w.weather.forEach(function (k) { found.push(WEATHER_TYPES[k].emoji + ' ' + WEATHER_TYPES[k].text); });
      if (Object.keys(w.magnet).length) {
        found.push('🧲 Magnets pull on iron, steel, nickel and cobalt — not wood, plastic, rubber, copper or foam.');
      }
      if (!found.length) note.appendChild(U.el('p', { class: 'muted', text: 'Empty so far. Run an experiment to write your first note!' }));
      else {
        var ul = U.el('ul', { class: 'bullets' });
        found.forEach(function (f) { ul.appendChild(U.el('li', { text: f })); });
        note.appendChild(ul);
      }
      body.appendChild(note);
    },

    open: function (id) {
      this.view = id;
      document.getElementById('science-body').innerHTML = '';
      if (id === 'plant') this.renderPlant();
      if (id === 'magnet') this.renderMagnet();
      if (id === 'weather') this.renderWeather();
    },

    /* ===========================================================
       🌱 PLANT
       =========================================================== */
    plantSVG: function (stage, pale) {
      var s = U.clamp(stage, 0, 5);
      var green = pale ? '#c9e3a0' : '#4caf50';
      var dark = pale ? '#a9cf86' : '#2e7d32';
      var h = 10 + s * 26;                       /* stem height */
      var top = 210 - h;
      var parts = '';
      /* pot */
      parts += '<path d="M60 212 L140 212 L132 268 L68 268 Z" fill="#c96f4a"/>';
      parts += '<rect x="55" y="202" width="90" height="14" rx="5" fill="#e07a52"/>';
      /* soil */
      parts += '<ellipse cx="100" cy="209" rx="41" ry="7" fill="#5b4433"/>';
      /* roots (visible through a cutaway) */
      if (s > 0) {
        parts += '<path d="M100 212 L100 246 M100 226 L84 244 M100 226 L116 244" stroke="#d8c39a" stroke-width="3" fill="none" stroke-linecap="round" opacity=".85"/>';
      }
      if (s === 0) {
        parts += '<circle cx="100" cy="206" r="6" fill="#8d6e63"/>';   /* just a seed */
      } else {
        parts += '<path d="M100 210 Q' + (100 + (s % 2 ? 8 : -8)) + ' ' + (top + h / 2) + ' 100 ' + top +
          '" stroke="' + dark + '" stroke-width="' + (4 + s) + '" fill="none" stroke-linecap="round"/>';
        for (var i = 1; i <= s; i++) {
          var ly = 210 - (h * i) / (s + 0.5);
          var dir = i % 2 ? 1 : -1;
          parts += '<ellipse cx="' + (100 + dir * (14 + i * 3)) + '" cy="' + ly + '" rx="' + (13 + i) +
            '" ry="' + (7 + i * 0.6) + '" fill="' + green + '" transform="rotate(' + (dir * -18) + ' ' +
            (100 + dir * (14 + i * 3)) + ' ' + ly + ')"/>';
        }
        if (s >= 5) {
          parts += '<circle cx="100" cy="' + (top - 6) + '" r="15" fill="#ffd34d"/>';
          for (var p = 0; p < 8; p++) {
            var a = (p / 8) * Math.PI * 2;
            parts += '<ellipse cx="' + (100 + Math.cos(a) * 20) + '" cy="' + (top - 6 + Math.sin(a) * 20) +
              '" rx="9" ry="6" fill="#ffb347" transform="rotate(' + (a * 57) + ' ' +
              (100 + Math.cos(a) * 20) + ' ' + (top - 6 + Math.sin(a) * 20) + ')"/>';
          }
          parts += '<circle cx="100" cy="' + (top - 6) + '" r="11" fill="#7a4a1e"/>';
        }
      }
      return '<svg class="plant-svg" viewBox="0 0 200 280" role="img" aria-label="Plant at growth stage ' +
        s + ' of 5">' + parts + '</svg>';
    },

    renderPlant: function () {
      var self = this, body = document.getElementById('science-body');
      var w = S.world('science');
      var cfg = { water: 1, light: 2, soil: 2 };

      body.appendChild(UI.bigButton('← Back to the lab', function () { self.view = null; self.renderHub(); }, 'secondary slim'));

      var stageCard = UI.card('plant-stage', []);
      var art = U.el('div', { class: 'plant-art', id: 'plant-art' });
      art.innerHTML = this.plantSVG(0, false);
      stageCard.appendChild(art);
      var say = U.el('p', { class: 'plant-say', id: 'plant-say', role: 'status',
        text: 'Choose water, light and soil — then press Grow!' });
      stageCard.appendChild(say);
      body.appendChild(stageCard);

      var controls = UI.card('', [U.el('h3', { text: '🌱 Set up the experiment' })]);
      var labels = {
        water: ['none 🚫', 'a little 💧', 'just right 💧💧', 'flooded 🌊'],
        light: ['dark 🌑', 'dim 🌥️', 'bright ☀️', 'very bright 🔆'],
        soil:  ['no soil 🚫', 'sand 🏜️', 'rich soil 🟤']
      };
      ['water', 'light', 'soil'].forEach(function (key) {
        var max = key === 'soil' ? 2 : 3;
        controls.appendChild(UI.stepper({
          label: key.charAt(0).toUpperCase() + key.slice(1),
          value: cfg[key], min: 0, max: max, step: 1,
          format: function (v) { return labels[key][v]; },
          onChange: function (v) { cfg[key] = v; }
        }));
      });
      controls.appendChild(UI.bigButton('🌱 Grow!', function () { run(); }, 'primary wide'));
      body.appendChild(controls);

      var result = UI.card('', [U.el('h4', { text: '📓 What I found out' }),
        U.el('div', { id: 'plant-result' })]);
      body.appendChild(result);
      showFound();

      function outcomeKey() {
        if (cfg.soil === 0) return 'noSoil';
        if (cfg.water === 0) return 'noWater';
        if (cfg.water === 3) return 'tooMuchWater';
        if (cfg.light === 0) return 'noLight';
        if (cfg.light === 1) return 'lowLight';
        if (cfg.soil === 1) return 'poorSoil';
        return 'perfect';
      }

      function run() {
        var key = outcomeKey(), res = PLANT_RESULTS[key];
        var pale = (key === 'noLight');
        var day = 0;
        say.textContent = 'Day 1…';
        var steps = FX.reduced() ? 1 : 3;
        var timer = setInterval(function () {
          day++;
          var stage = Math.round((res.stage * day) / steps);
          art.innerHTML = self.plantSVG(stage, pale);
          say.textContent = day < steps ? 'Day ' + (day + 1) + '…' : res.emoji + ' ' + res.title;
          Sound.play('place');
          if (day >= steps) {
            clearInterval(timer);
            art.innerHTML = self.plantSVG(res.stage, pale);
            finish(key, res);
          }
        }, FX.reduced() ? 10 : 550);
      }

      function finish(key, res) {
        var box = document.getElementById('plant-result');
        var isNew = w.plant.indexOf(key) === -1;
        if (isNew) {
          self.discover('plant', key, 18);
          Sound.play('reward');
          FX.burst(art, '🌟', 8);
          if (key === 'perfect') P.badge('green_thumb');
          P.logActivity({ world: 'science', name: 'Plant experiment', detail: res.title, xp: 18, stars: null });
        } else {
          Sound.play('good');
        }
        if (w.plant.length >= PLANT_KEYS.length) {
          FX.toast('🌱 You found every plant result!');
          Sound.win('big');
        }
        box.innerHTML = '';
        box.appendChild(U.el('div', { class: 'finding' + (isNew ? ' new' : '') }, [
          U.el('span', { class: 'finding-emoji', text: res.emoji, 'aria-hidden': 'true' }),
          U.el('div', {}, [U.el('b', { text: res.title + (isNew ? ' — NEW!' : '') }),
            U.el('p', { text: res.text })])
        ]));
        showFound(box);
        WW.Buddy.say(isNew ? 'Ooh! Write that in the notebook!' : 'We already knew that one — try something different!');
      }

      function showFound(afterNode) {
        var box = afterNode || document.getElementById('plant-result');
        var list = U.el('div', { class: 'found-list' });
        list.appendChild(U.el('p', { class: 'muted small',
          text: 'Discoveries found: ' + w.plant.length + ' of ' + PLANT_KEYS.length }));
        var chips = U.el('div', { class: 'chips' });
        PLANT_KEYS.forEach(function (k) {
          var got = w.plant.indexOf(k) !== -1;
          chips.appendChild(U.el('span', { class: 'chip chip-soft' + (got ? ' sel' : ''),
            text: got ? PLANT_RESULTS[k].emoji + ' ' + PLANT_RESULTS[k].title : '❔ ? ? ?' }));
        });
        list.appendChild(chips);
        box.appendChild(list);
      }
    },

    /* ===========================================================
       🧲 MAGNETS
       =========================================================== */
    renderMagnet: function () {
      var self = this, body = document.getElementById('science-body');
      var w = S.world('science');
      body.appendChild(UI.bigButton('← Back to the lab', function () { self.view = null; self.renderHub(); }, 'secondary slim'));

      var stage = UI.card('magnet-stage', []);
      stage.innerHTML = '<div class="magnet-scene"><div class="magnet" aria-hidden="true">🧲</div>' +
        '<div class="magnet-test" id="magnet-test" aria-hidden="true"></div></div>' +
        '<p class="plant-say" id="magnet-say" role="status">Pick an object. Guess first — then test it!</p>';
      body.appendChild(stage);

      var card = UI.card('', [U.el('h3', { text: '🧲 The object tray' }),
        U.el('p', { class: 'muted', text: 'Tap an object, make your prediction, and watch what the magnet does.' })]);
      var grid = U.el('div', { class: 'object-grid' });

      MAGNET_OBJECTS.forEach(function (o) {
        var rec = w.magnet[o.id];
        var btn = U.el('button', {
          class: 'object-cell' + (rec ? ' tested' : ''),
          'aria-label': o.name + (rec ? (o.magnetic ? ', magnetic' : ', not magnetic') : ', not tested yet'),
          onclick: function () { Sound.play('tap'); predict(o, btn); }
        }, [
          U.el('span', { class: 'obj-emoji', text: o.emoji, 'aria-hidden': 'true' }),
          U.el('small', { text: o.name }),
          U.el('span', { class: 'obj-flag', text: rec ? (o.magnetic ? '🧲 yes' : '✖︎ no') : '❔' })
        ]);
        grid.appendChild(btn);
      });
      card.appendChild(grid);
      body.appendChild(card);

      var out = UI.card('', [U.el('h4', { text: '📓 Results' }), U.el('div', { id: 'magnet-result' })]);
      body.appendChild(out);
      summary();

      function predict(o, btn) {
        var body2 = U.el('div', {}, [
          U.el('div', { class: 'predict-emoji', text: o.emoji, 'aria-hidden': 'true' }),
          U.el('p', { class: 'modal-text', text: 'Will the magnet pull the ' + o.name + '?' })
        ]);
        WW.Modal.open({
          title: '🤔 Make a prediction',
          body: body2,
          actions: [
            { text: '🧲 Yes, it will stick', primary: true, onClick: function () { WW.Modal.close(); test(o, true, btn); } },
            { text: '✖︎ No, it won\'t', onClick: function () { WW.Modal.close(); test(o, false, btn); } }
          ]
        });
      }

      function test(o, guess, btn) {
        var testBox = document.getElementById('magnet-test');
        var say = document.getElementById('magnet-say');
        testBox.innerHTML = '<span class="flying">' + o.emoji + '</span>';
        var fly = testBox.querySelector('.flying');
        say.textContent = 'Testing the ' + o.name + '…';
        setTimeout(function () {
          fly.classList.add(o.magnetic ? 'attracted' : 'stuck');
          Sound.play(o.magnetic ? 'coin' : 'oops');
          var right = (guess === o.magnetic);
          var first = !w.magnet[o.id];
          w.magnet[o.id] = { predicted: guess, right: right };
          P.answer('science', right);
          if (first) {
            P.addXP(right ? 14 : 8);
            P.addGems(right ? 2 : 1);
            self.recalc();
            P.logActivity({ world: 'science', name: 'Magnet test: ' + o.name,
              detail: right ? 'prediction correct' : 'prediction changed their mind', xp: right ? 14 : 8 });
          }
          S.save(true);

          say.textContent = (o.magnetic ? '🧲 It stuck!' : '✖︎ It did not stick.') +
            ' ' + o.name + ' is made of ' + o.made + '.';
          btn.classList.add('tested');
          btn.querySelector('.obj-flag').textContent = o.magnetic ? '🧲 yes' : '✖︎ no';
          btn.setAttribute('aria-label', o.name + (o.magnetic ? ', magnetic' : ', not magnetic'));

          var res = document.getElementById('magnet-result');
          res.innerHTML = '';
          res.appendChild(U.el('div', { class: 'finding' + (right ? ' new' : '') }, [
            U.el('span', { class: 'finding-emoji', text: right ? '🎯' : '🔍', 'aria-hidden': 'true' }),
            U.el('div', {}, [
              U.el('b', { text: right ? 'Your prediction was right!' : 'Surprise! Now you know.' }),
              U.el('p', { text: o.magnetic
                ? o.made.charAt(0).toUpperCase() + o.made.slice(1) + ' contains iron, and magnets pull on iron.'
                : o.made.charAt(0).toUpperCase() + o.made.slice(1) + ' has no iron in it, so the magnet does nothing.' })
            ])
          ]));
          summary(res);
          if (right) { FX.burst(testBox, '✨', 6); WW.Buddy.cheer(); }
          else WW.Buddy.say('Scientists love surprises — that is how we learn!');

          if (Object.keys(w.magnet).length >= MAGNET_OBJECTS.length) {
            P.badge('magnet_master');
            FX.toast('🧲 Every object tested!');
            Sound.win('big');
          }
        }, FX.reduced() ? 10 : 650);
      }

      function summary(node) {
        var res = node || document.getElementById('magnet-result');
        var tested = Object.keys(w.magnet).length;
        var rightCount = 0;
        for (var k in w.magnet) if (w.magnet[k].right) rightCount++;
        res.appendChild(U.el('p', { class: 'muted small',
          text: 'Tested ' + tested + ' of ' + MAGNET_OBJECTS.length + ' objects · ' +
            rightCount + ' prediction' + (rightCount === 1 ? '' : 's') + ' correct.' }));
        if (tested >= MAGNET_OBJECTS.length) {
          res.appendChild(U.el('div', { class: 'teach-note', text:
            'BIG IDEA: magnets attract iron, steel, nickel and cobalt. They do not attract wood, plastic, rubber, foam, copper or aluminium — even though some of those are shiny metals!' }));
        }
      }
    },

    /* ===========================================================
       🌦️ WEATHER
       =========================================================== */
    renderWeather: function () {
      var self = this, body = document.getElementById('science-body');
      var w = S.world('science');
      var cfg = { temp: 20, moisture: 20, wind: 10 };

      body.appendChild(UI.bigButton('← Back to the lab', function () { self.view = null; self.renderHub(); }, 'secondary slim'));

      var sky = U.el('div', { class: 'weather-sky', id: 'weather-sky' });
      var stage = UI.card('weather-stage', [sky,
        U.el('p', { class: 'plant-say', id: 'weather-say', role: 'status' })]);
      body.appendChild(stage);

      var controls = UI.card('', [U.el('h3', { text: '🎛️ Weather controls' })]);
      var sliders = [
        { key: 'temp', label: 'Temperature', min: -10, max: 40, step: 5, fmt: function (v) { return v + '°C'; }, emoji: '🌡️' },
        { key: 'moisture', label: 'Moisture in the air', min: 0, max: 100, step: 10, fmt: function (v) { return v + '%'; }, emoji: '💧' },
        { key: 'wind', label: 'Wind', min: 0, max: 100, step: 10, fmt: function (v) { return v + ' km/h'; }, emoji: '🌬️' }
      ];
      sliders.forEach(function (sl) {
        var val = U.el('b', { class: 'slider-val', text: sl.fmt(cfg[sl.key]) });
        var input = U.el('input', {
          type: 'range', class: 'big-slider', min: sl.min, max: sl.max, step: sl.step,
          value: cfg[sl.key], 'aria-label': sl.label
        });
        input.addEventListener('input', function () {
          cfg[sl.key] = parseInt(input.value, 10);
          val.textContent = sl.fmt(cfg[sl.key]);
          update();
        });
        input.addEventListener('change', function () { Sound.play('tap'); });
        controls.appendChild(U.el('div', { class: 'slider-row' }, [
          U.el('div', { class: 'slider-top' }, [
            U.el('span', { text: sl.emoji + ' ' + sl.label }), val
          ]), input
        ]));
      });
      body.appendChild(controls);

      var goals = UI.card('', [U.el('h4', { text: '🎯 Weather challenges' }),
        U.el('p', { class: 'muted small', text: 'Move the controls until you make each kind of weather.' }),
        U.el('div', { class: 'chips', id: 'weather-goals' })]);
      body.appendChild(goals);

      var info = UI.card('', [U.el('h4', { text: '📓 What is happening?' }), U.el('div', { id: 'weather-info' })]);
      body.appendChild(info);

      function drawGoals() {
        var box = document.getElementById('weather-goals');
        box.innerHTML = '';
        WEATHER_GOALS.forEach(function (g) {
          var got = w.weather.indexOf(g) !== -1;
          box.appendChild(U.el('span', { class: 'chip chip-soft' + (got ? ' sel' : ''),
            text: (got ? '✅ ' : '⬜ ') + WEATHER_TYPES[g].emoji + ' ' + WEATHER_TYPES[g].name }));
        });
      }

      function update() {
        var kind = weatherFor(cfg.temp, cfg.moisture, cfg.wind);
        var wt = WEATHER_TYPES[kind];

        /* sky colour from temperature */
        var warm = U.clamp((cfg.temp + 10) / 50, 0, 1);
        var top = kind === 'storm' ? '#39405e' : (kind === 'snow' ? '#b7c7e0' : (kind === 'rain' ? '#6d7f99' : (kind === 'fog' ? '#9aa3ad' : '#59b6ff')));
        var bot = kind === 'storm' ? '#5a6180' : (kind === 'snow' ? '#e7eef8' : (kind === 'rain' ? '#9fb0c4' : (kind === 'fog' ? '#cfd5da' : (warm > 0.65 ? '#ffd9a0' : '#bfe6ff'))));
        sky.style.background = 'linear-gradient(180deg,' + top + ',' + bot + ')';

        var html = '<div class="w-sun" style="opacity:' + (kind === 'sunny' ? 1 : 0.15) + '">☀️</div>';
        var clouds = cfg.moisture >= 35 ? Math.min(4, Math.round(cfg.moisture / 25)) : 0;
        for (var c = 0; c < clouds; c++) {
          html += '<div class="w-cloud" style="left:' + (8 + c * 23) + '%;top:' + (10 + (c % 2) * 14) +
            '%;animation-duration:' + Math.max(3, 22 - cfg.wind / 6) + 's">' +
            (kind === 'storm' ? '🌩️' : '☁️') + '</div>';
        }
        if (kind === 'rain' || kind === 'storm') {
          for (var d = 0; d < 16; d++) {
            html += '<i class="w-drop" style="left:' + (d * 6 + 3) + '%;animation-delay:' + (d * 0.08) + 's"></i>';
          }
        }
        if (kind === 'snow') {
          for (var f = 0; f < 14; f++) {
            html += '<i class="w-flake" style="left:' + (f * 7 + 2) + '%;animation-delay:' + (f * 0.17) + 's">❄</i>';
          }
        }
        if (kind === 'windy' || cfg.wind >= 60) {
          for (var g2 = 0; g2 < 4; g2++) {
            html += '<i class="w-gust" style="top:' + (26 + g2 * 14) + '%;animation-delay:' + (g2 * 0.3) + 's"></i>';
          }
        }
        if (kind === 'fog') html += '<div class="w-fog"></div>';
        html += '<div class="w-ground"></div>';
        html += '<div class="w-label">' + wt.emoji + ' ' + wt.name + '</div>';
        sky.innerHTML = html;
        sky.setAttribute('role', 'img');
        sky.setAttribute('aria-label', 'Weather scene showing ' + wt.name);

        document.getElementById('weather-say').textContent =
          wt.emoji + ' ' + cfg.temp + '°C · ' + cfg.moisture + '% moisture · ' + cfg.wind + ' km/h wind → ' + wt.name;

        var infoBox = document.getElementById('weather-info');
        infoBox.innerHTML = '';
        infoBox.appendChild(U.el('div', { class: 'finding' }, [
          U.el('span', { class: 'finding-emoji', text: wt.emoji, 'aria-hidden': 'true' }),
          U.el('div', {}, [U.el('b', { text: wt.name }), U.el('p', { text: wt.text })])
        ]));

        if (WEATHER_GOALS.indexOf(kind) !== -1 && w.weather.indexOf(kind) === -1) {
          self.discover('weather', kind, 16);
          Sound.play('reward');
          FX.burst(sky, wt.emoji, 8);
          P.logActivity({ world: 'science', name: 'Weather machine', detail: 'created ' + wt.name, xp: 16 });
          WW.Buddy.say('You made ' + wt.name.toLowerCase() + '! 🌈');
          if (w.weather.length >= WEATHER_GOALS.length) {
            P.badge('weather_maker');
            Sound.win('big');
          }
          drawGoals();
        }
      }

      drawGoals();
      update();
    }
  };

  Science.MAGNET_OBJECTS = MAGNET_OBJECTS;
  Science.weatherFor = weatherFor;
  WW.Screens.science = Science;

})(window.WW);
