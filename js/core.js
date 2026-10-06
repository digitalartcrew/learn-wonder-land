/* =============================================================
   WonderWorld — core.js
   Engine foundation: utilities, game data, audio, save/load,
   player state, progression & rewards, visual FX, avatar art,
   companion buddy, HUD and screen navigation.

   Everything hangs off one global namespace: window.WW
   No DOM work happens at load time — WW.bootCore() wires the DOM.
   (That keeps the pure logic testable outside a browser.)
   ============================================================= */
window.WW = window.WW || {};

(function (WW) {
  'use strict';

  /* ===========================================================
     1. UTILITIES
     =========================================================== */
  var U = WW.Util = {
    $: function (sel, root) { return (root || document).querySelector(sel); },
    $$: function (sel, root) {
      return Array.prototype.slice.call((root || document).querySelectorAll(sel));
    },
    /* Tiny element builder: el('div', {class:'x', onclick:fn}, [child, 'text']) */
    el: function (tag, attrs, kids) {
      var n = document.createElement(tag), k;
      if (attrs) for (k in attrs) {
        if (!Object.prototype.hasOwnProperty.call(attrs, k)) continue;
        var v = attrs[k];
        if (v === null || v === undefined || v === false) continue;
        if (k === 'class') n.className = v;
        else if (k === 'html') n.innerHTML = v;
        else if (k === 'text') n.textContent = v;
        else if (k.indexOf('on') === 0 && typeof v === 'function') n.addEventListener(k.slice(2), v);
        else if (k === 'dataset') { for (var d in v) n.dataset[d] = v[d]; }
        else n.setAttribute(k, v === true ? '' : v);
      }
      (kids || []).forEach(function (c) {
        if (c === null || c === undefined || c === false) return;
        n.appendChild(typeof c === 'object' ? c : document.createTextNode(String(c)));
      });
      return n;
    },
    rnd: function (a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; },
    pick: function (arr) { return arr[Math.floor(Math.random() * arr.length)]; },
    shuffle: function (arr) {
      var a = arr.slice(), i, j, t;
      for (i = a.length - 1; i > 0; i--) {
        j = Math.floor(Math.random() * (i + 1)); t = a[i]; a[i] = a[j]; a[j] = t;
      }
      return a;
    },
    clamp: function (v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); },
    round: function (v, places) { var p = Math.pow(10, places || 0); return Math.round(v * p) / p; },
    /* Money is always shown the same friendly way: $1.25 */
    money: function (v) {
      var neg = v < 0 ? '-' : '';
      return neg + '$' + Math.abs(v).toFixed(2);
    },
    esc: function (s) {
      return String(s).replace(/[&<>"']/g, function (c) {
        return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
      });
    },
    fmtDuration: function (ms) {
      var mins = Math.round(ms / 60000);
      if (mins < 1) return 'less than a minute';
      if (mins < 60) return mins + ' min';
      return Math.floor(mins / 60) + ' hr ' + (mins % 60) + ' min';
    },
    fmtDate: function (ts) {
      try {
        return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      } catch (e) { return ''; }
    },
    /* Event delegation helper */
    on: function (root, type, selector, fn) {
      root.addEventListener(type, function (e) {
        var t = e.target.closest(selector);
        if (t && root.contains(t)) fn(e, t);
      });
    },
    /* Deep-merge saved data onto defaults so old saves keep working */
    merge: function (base, extra) {
      if (!extra || typeof extra !== 'object') return base;
      var out = Array.isArray(base) ? base.slice() : Object.assign({}, base);
      for (var k in extra) {
        if (!Object.prototype.hasOwnProperty.call(extra, k)) continue;
        var bv = out[k], ev = extra[k];
        if (bv && ev && typeof bv === 'object' && typeof ev === 'object' && !Array.isArray(bv) && !Array.isArray(ev)) {
          out[k] = U.merge(bv, ev);
        } else if (ev !== undefined) {
          out[k] = ev;
        }
      }
      return out;
    }
  };

  /* ===========================================================
     2. GAME DATA (content tables — safe to extend)
     =========================================================== */
  var D = WW.Data = {

    companions: [
      { id: 'spark', emoji: '🐉', name: 'Spark', kind: 'Dragon', color: '#ff8a5c',
        lines: ['Whoa! That was brilliant!', 'You have fire in your brain!', 'Let\'s go, hero!'] },
      { id: 'pip', emoji: '🤖', name: 'Pip', kind: 'Robot', color: '#7bd3ff',
        lines: ['Beep! Calculating... you rock!', 'Data confirms: you are smart.', 'Systems happy!'] },
      { id: 'luna', emoji: '🦊', name: 'Luna', kind: 'Fox', color: '#ffb347',
        lines: ['Clever, clever!', 'My tail is wagging for you!', 'You found the trick!'] },
      { id: 'bubbles', emoji: '👽', name: 'Bubbles', kind: 'Alien', color: '#a98bff',
        lines: ['On my planet, that is GENIUS.', 'Blorp! Amazing!', 'Earth brains are strong!'] },
      { id: 'toby', emoji: '🐢', name: 'Toby', kind: 'Turtle', color: '#6fd68a',
        lines: ['Slow and steady — and smart!', 'Nice and careful. Perfect.', 'I knew you could!'] }
    ],

    skins: ['#fadcc0', '#f3c395', '#dfa36a', '#bd7f4c', '#8d5a30', '#5d3a1f'],

    hairStyles: [
      { id: 'short', name: 'Short' }, { id: 'curly', name: 'Curly' },
      { id: 'long', name: 'Long' }, { id: 'ponytail', name: 'Ponytail' },
      { id: 'bun', name: 'Bun' }, { id: 'cap', name: 'Cap' }
    ],
    hairColors: ['#2a2018', '#6b3f22', '#c9833a', '#f0d07a', '#e2675a', '#7a5cff', '#3fc8e8'],

    outfits: [
      { name: 'Sunbeam', top: '#ffd34d', trim: '#ff9f45' },
      { name: 'Ocean', top: '#3fb6ff', trim: '#1f78c8' },
      { name: 'Meadow', top: '#5fd68a', trim: '#2f9f5c' },
      { name: 'Berry', top: '#ff6f9c', trim: '#d13a6c' },
      { name: 'Cosmic', top: '#9a7bff', trim: '#6243d0' },
      { name: 'Sunset', top: '#ff8a5c', trim: '#e0542a' }
    ],

    /* Worlds. unlockXP = total XP needed. Education is never paywalled. */
    worlds: [
      { id: 'math', name: 'Math Island', emoji: '🧮', color: '#45c8ff', unlockXP: 0,
        subject: 'Math', blurb: 'Build the rainbow bridge with number power.' },
      { id: 'story', name: 'Story Forest', emoji: '📚', color: '#63d68d', unlockXP: 0,
        subject: 'Reading', blurb: 'Read, spell and help Luna find the missing star.' },
      { id: 'science', name: 'Science Lab', emoji: '🧪', color: '#bb8bff', unlockXP: 150,
        subject: 'Science', blurb: 'Grow plants, test magnets, make the weather.' },
      { id: 'city', name: 'Planet City', emoji: '🌎', color: '#4fd6b8', unlockXP: 400,
        subject: 'Our Planet', blurb: 'Build a green city that people love.' },
      { id: 'business', name: 'Business Town', emoji: '💰', color: '#ffc93c', unlockXP: 700,
        subject: 'Money', blurb: 'Run a lemonade stand and learn about profit.' },
      { id: 'space', name: 'WonderSpace', emoji: '🚀', color: '#ff8ad1', unlockXP: null,
        subject: 'Space', blurb: 'Opens when all 5 crystals are restored.', requiresCrystals: true }
    ],

    crystals: [
      { id: 'math', name: 'Number Crystal', emoji: '🔷', color: '#45c8ff' },
      { id: 'story', name: 'Word Crystal', emoji: '💚', color: '#63d68d' },
      { id: 'science', name: 'Spark Crystal', emoji: '💜', color: '#bb8bff' },
      { id: 'city', name: 'Earth Crystal', emoji: '💠', color: '#4fd6b8' },
      { id: 'business', name: 'Gold Crystal', emoji: '🔶', color: '#ffc93c' }
    ],

    badges: {
      first_step:    { emoji: '👣', name: 'First Steps',    desc: 'Finished your very first activity' },
      bridge_master: { emoji: '🌈', name: 'Bridge Master',  desc: 'Crossed a bridge with no mistakes' },
      quick_thinker: { emoji: '⚡', name: 'Quick Thinker',  desc: 'Answered 50 questions correctly' },
      story_reader:  { emoji: '📖', name: 'Story Reader',   desc: 'Finished a whole story chapter' },
      super_speller: { emoji: '🔤', name: 'Super Speller',  desc: 'Spelled 10 words correctly' },
      green_thumb:   { emoji: '🌱', name: 'Green Thumb',    desc: 'Grew a perfect plant in the lab' },
      magnet_master: { emoji: '🧲', name: 'Magnet Master',  desc: 'Tested every object with the magnet' },
      weather_maker: { emoji: '🌦️', name: 'Weather Maker',  desc: 'Created every kind of weather' },
      eco_hero:      { emoji: '♻️', name: 'Eco Hero',       desc: 'Built a city with a green score of 70+' },
      city_planner:  { emoji: '🏙️', name: 'City Planner',   desc: 'Met every city goal' },
      first_profit:  { emoji: '🪙', name: 'First Profit',   desc: 'Made money on your first day of business' },
      super_saver:   { emoji: '🏦', name: 'Super Saver',    desc: 'Saved $10 in the piggy bank' },
      level_5:       { emoji: '⭐', name: 'Rising Star',    desc: 'Reached level 5' },
      level_10:      { emoji: '🌟', name: 'Shining Star',   desc: 'Reached level 10' },
      explorer:      { emoji: '🧭', name: 'Explorer',       desc: 'Visited all five worlds' },
      tree_restored: { emoji: '🌳', name: 'Tree Healer',    desc: 'Restored the whole Knowledge Tree' }
    },

    /* Friendly encouragement — never shaming */
    cheers: ['Yes!', 'Brilliant!', 'You got it!', 'Super!', 'Amazing!', 'Nice thinking!', 'Wonderful!', 'Great job!'],
    nudges: ['Not quite — try once more!', 'Close! Have another go.', 'Good try! Let\'s think again.',
             'Almost! Here\'s a hint.', 'Keep going, you\'ve got this!']
  };

  /* ===========================================================
     3. SOUND — generated with Web Audio, no files needed
     =========================================================== */
  var Sound = WW.Sound = {
    ctx: null,
    ready: false,

    init: function () {
      if (this.ctx) return;
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try { this.ctx = new AC(); this.ready = true; } catch (e) { this.ready = false; }
    },
    /* iOS requires audio to start from a user gesture */
    unlock: function () {
      this.init();
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    },
    enabled: function () {
      return !!(WW.State.data && WW.State.data.settings.sound);
    },
    tone: function (o) {
      if (!this.ready || !this.enabled()) return;
      var ctx = this.ctx, t0 = ctx.currentTime + (o.delay || 0);
      var osc = ctx.createOscillator(), gain = ctx.createGain();
      osc.type = o.type || 'sine';
      osc.frequency.setValueAtTime(o.freq, t0);
      if (o.to) osc.frequency.exponentialRampToValueAtTime(Math.max(40, o.to), t0 + o.dur);
      var vol = (o.vol === undefined ? 0.18 : o.vol);
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(t0); osc.stop(t0 + o.dur + 0.04);
    },
    play: function (name) {
      if (!this.ready || !this.enabled()) return;
      var s = this;
      switch (name) {
        case 'tap':
          s.tone({ freq: 520, dur: 0.07, type: 'triangle', vol: 0.10 }); break;
        case 'good':
          [660, 880, 1320].forEach(function (f, i) {
            s.tone({ freq: f, dur: 0.16, type: 'triangle', vol: 0.14, delay: i * 0.07 });
          }); break;
        case 'oops': /* gentle, never harsh */
          s.tone({ freq: 400, to: 300, dur: 0.22, type: 'sine', vol: 0.11 }); break;
        case 'reward':
          [523, 659, 784, 1046].forEach(function (f, i) {
            s.tone({ freq: f, dur: 0.22, type: 'triangle', vol: 0.13, delay: i * 0.08 });
          }); break;
        case 'coin':
          s.tone({ freq: 1180, dur: 0.08, type: 'square', vol: 0.07 });
          s.tone({ freq: 1560, dur: 0.12, type: 'square', vol: 0.06, delay: 0.06 }); break;
        case 'crystal':
          [392, 523, 659, 784, 1046, 1318].forEach(function (f, i) {
            s.tone({ freq: f, dur: 0.6, type: 'sine', vol: 0.12, delay: i * 0.10 });
          }); break;
        case 'grow':
          s.tone({ freq: 220, to: 660, dur: 0.8, type: 'sine', vol: 0.12 }); break;
        case 'unlock':
          s.tone({ freq: 330, to: 990, dur: 0.45, type: 'triangle', vol: 0.14 }); break;
        case 'place':
          s.tone({ freq: 300, to: 420, dur: 0.1, type: 'square', vol: 0.07 }); break;
        case 'levelup':
          [523, 659, 784, 1046, 1318].forEach(function (f, i) {
            s.tone({ freq: f, dur: 0.3, type: 'triangle', vol: 0.14, delay: i * 0.09 });
          }); break;
        case 'whoosh':
          s.tone({ freq: 800, to: 200, dur: 0.22, type: 'sine', vol: 0.07 }); break;
      }
    },

    /* ---------- APPLAUSE -------------------------------------
       A clap is a very short burst of filtered noise. Scatter a
       few dozen of them and you get a small crowd clapping. */
    _noise: null,
    noiseBuffer: function () {
      if (this._noise) return this._noise;
      var ctx = this.ctx, len = Math.floor(ctx.sampleRate * 0.4);
      var buf = ctx.createBuffer(1, len, ctx.sampleRate);
      var d = buf.getChannelData(0);
      for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this._noise = buf;
      return buf;
    },

    clap: function (at, vol) {
      var ctx = this.ctx, t = ctx.currentTime + at;
      var src = ctx.createBufferSource();
      src.buffer = this.noiseBuffer();
      src.playbackRate.value = 0.8 + Math.random() * 0.7;
      var bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 1100 + Math.random() * 2200;
      bp.Q.value = 0.7;
      var hp = ctx.createBiquadFilter();
      hp.type = 'highpass'; hp.frequency.value = 700;
      var g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07 + Math.random() * 0.07);
      src.connect(bp); bp.connect(hp); hp.connect(g); g.connect(ctx.destination);
      src.start(t); src.stop(t + 0.3);
    },

    applause: function (dur) {
      if (!this.ready || !this.enabled()) return;
      dur = dur || 1.9;
      var claps = Math.round(dur * 20), i, at;
      for (i = 0; i < claps; i++) {
        /* denser at the front so it sounds like a crowd starting up */
        at = Math.pow(Math.random(), 0.75) * dur;
        this.clap(at, 0.02 + Math.random() * 0.03);
      }
      /* a couple of louder front claps to give it a clear attack */
      this.clap(0.02, 0.07); this.clap(0.11, 0.06); this.clap(0.19, 0.055);
    },

    /* ---------- FANFARES — three of them, picked at random ---- */
    _lastFanfare: -1,
    fanfare: function () {
      if (!this.ready || !this.enabled()) return;
      var tunes = [
        /* [freq, startTime, duration] */
        [[523, 0, .18], [659, .1, .18], [784, .2, .18], [1046, .32, .55]],
        [[392, 0, .14], [523, .09, .14], [659, .18, .14], [784, .27, .14], [1318, .38, .6]],
        [[659, 0, .14], [659, .13, .12], [880, .25, .16], [784, .4, .14], [1046, .52, .55]],
        [[523, 0, .12], [784, .1, .12], [1046, .2, .12], [784, .3, .12], [1046, .4, .2], [1318, .55, .5]]
      ];
      var i = U.rnd(0, tunes.length - 1);
      if (i === this._lastFanfare) i = (i + 1) % tunes.length;
      this._lastFanfare = i;
      var self = this;
      tunes[i].forEach(function (n) {
        self.tone({ freq: n[0], dur: n[2], type: 'triangle', vol: 0.14, delay: n[1] });
        self.tone({ freq: n[0] * 2, dur: n[2], type: 'sine', vol: 0.05, delay: n[1] });
      });
    },

    /* ---------- SPOKEN PRAISE --------------------------------
       Uses the device's own speech synthesiser — no audio files,
       no network, and parents can switch it off on its own. */
    BIG_PRAISE: [
      'Great job', 'You did amazing', 'Wow, fantastic work', 'Brilliant',
      'You are a superstar', 'Incredible', 'Way to go', 'That was awesome',
      'Super work', 'You did it', 'Outstanding', 'Amazing thinking',
      'Fantastic', 'You are brilliant', 'What a champion'
    ],
    SMALL_PRAISE: ['Nice', 'Yes', 'Awesome', 'Wonderful', 'Great', 'Lovely', 'Superb', 'Keep going'],
    _lastSaid: '',

    voiceOn: function () {
      return this.enabled() && !!(State.data && State.data.settings.voice) &&
        ('speechSynthesis' in window);
    },

    /* ---------------------------------------------------------
       Pick an on-device voice.

       SpeechSynthesisUtterance is NOT guaranteed to be local. Edge's
       "Natural" voices and Chrome's default Google voices synthesise
       in the cloud, which would send the spoken sentence — sometimes
       containing the child's nickname — to a third party we have no
       relationship with. `localService === true` is the standard flag
       for voices that run entirely on the device, so we require one.
       If the device has no local voice, we stay silent rather than
       leak text off it. The chimes and applause still play.
       --------------------------------------------------------- */
    localVoice: function () {
      if (this._voice !== undefined) return this._voice;
      var voices = [];
      try { voices = window.speechSynthesis.getVoices() || []; } catch (e) { voices = []; }
      if (!voices.length) return undefined;          /* not loaded yet — try again later */
      var lang = (navigator.language || 'en').toLowerCase();
      var local = voices.filter(function (v) { return v.localService; });
      var pick =
        local.filter(function (v) { return (v.lang || '').toLowerCase() === lang; })[0] ||
        local.filter(function (v) { return (v.lang || '').toLowerCase().indexOf(lang.slice(0, 2)) === 0; })[0] ||
        local[0] || null;
      this._voice = pick;
      return pick;
    },

    /* "Read it to me" is an accessibility feature, so it follows the master
       sound switch but not the separate "cheering voice" switch. */
    readAloud: function (text) {
      if (!this.enabled() || !text) return false;
      this._speak(text, { rate: 0.92, pitch: 1.1 });
      return true;
    },

    say: function (text, opts) {
      if (!this.voiceOn() || !text) return;
      this._speak(text, opts);
    },

    _speak: function (text, opts) {
      opts = opts || {};
      var voice = this.localVoice();
      if (voice === undefined) {
        /* Voice list loads asynchronously in some browsers — retry once. */
        var self = this;
        setTimeout(function () {
          if (self.localVoice()) self.say(text, opts);
        }, 350);
        return;
      }
      if (!voice) return;                            /* no on-device voice: stay quiet */
      try {
        /* don't let praise talk over a story passage being read aloud */
        window.speechSynthesis.cancel();
        var u = new window.SpeechSynthesisUtterance(text);
        u.voice = voice;
        u.lang = voice.lang;
        u.rate = opts.rate || 1.05;
        u.pitch = opts.pitch === undefined ? 1.35 : opts.pitch;
        u.volume = opts.volume === undefined ? 1 : opts.volume;
        window.speechSynthesis.speak(u);
      } catch (e) { /* speech not available — the chimes still play */ }
    },

    /* Pick a phrase, never the same one twice in a row, and sometimes
       use the child's name so it feels personal. */
    praise: function (small) {
      if (!this.voiceOn()) return;
      var list = small ? this.SMALL_PRAISE : this.BIG_PRAISE;
      var phrase = U.pick(list), guard = 0;
      while (phrase === this._lastSaid && guard++ < 8) phrase = U.pick(list);
      this._lastSaid = phrase;
      var name = State.data && State.data.player ? State.data.player.name : '';
      var text = (!small && name && Math.random() < 0.45)
        ? phrase + ', ' + name + '!'
        : phrase + '!';
      this.say(text, { rate: small ? 1.15 : 1.02, pitch: small ? 1.45 : 1.3 });
    },

    /* One call for every "you won" moment. kind: 'big' | 'small' */
    win: function (kind) {
      if (!this.ready || !this.enabled()) return;
      var self = this;
      if (kind === 'small') {
        this.fanfare();
        this.applause(0.9);
        setTimeout(function () { self.praise(true); }, 420);
      } else {
        this.fanfare();
        setTimeout(function () { self.applause(2.1); }, 180);
        setTimeout(function () { self.praise(false); }, 900);
      }
    }
  };

  /* ===========================================================
     4. SAVE / LOAD  (localStorage only — nothing leaves the device)
     =========================================================== */
  var SAVE_KEY = 'wonderworld.save.v1';

  var State = WW.State = {
    data: null,
    _timer: null,

    defaults: function () {
      return {
        version: 1,
        createdAt: Date.now(),
        hasCharacter: false,
        player: { name: '', skin: 0, hair: 0, hairColor: 0, outfit: 0, companion: 'spark' },
        xp: 0, gems: 0, level: 1,
        crystals: { math: false, story: false, science: false, city: false, business: false },
        unlocked: { math: true, story: true, science: false, city: false, business: false, space: false },
        visited: {},
        badges: [],
        flags: {},                 /* small one-off UI flags, e.g. beta signup done */
        activities: [],            /* most-recent-first log for the parent dashboard */
        worlds: {
          math:     { progress: 0, diff: 1.2, runs: 0, bestStars: 0, correct: 0, wrong: 0 },
          story:    { progress: 0, chapter: 0, done: [], correct: 0, wrong: 0, spelled: 0 },
          science:  { progress: 0, plant: [], magnet: {}, weather: [], correct: 0, wrong: 0 },
          city:     { progress: 0, grid: null, money: 160, season: 1, bestGoals: 0, correct: 0, wrong: 0 },
          business: { progress: 0, day: 1, cash: 20, savings: 0, rep: 50, history: [], upgrades: [], correct: 0, wrong: 0 }
        },
        stats: { timeMs: 0, sessions: 0, lastPlayed: 0, answers: { correct: 0, wrong: 0 }, activitiesDone: 0 },
        settings: { sound: true, voice: true, reduceMotion: false, bigText: false }
      };
    },

    load: function () {
      var raw = null;
      try { raw = window.localStorage.getItem(SAVE_KEY); } catch (e) { raw = null; }
      var base = this.defaults();
      if (raw) {
        try { base = U.merge(base, JSON.parse(raw)); } catch (e) { /* corrupt save → fresh start */ }
      }
      this.data = base;
      this.data.level = Progress.levelFromXP(this.data.xp);
      return this.data;
    },

    hasSave: function () {
      try { return !!window.localStorage.getItem(SAVE_KEY); } catch (e) { return false; }
    },

    /* Debounced so rapid taps don't thrash storage */
    save: function (immediate) {
      var self = this;
      if (this._timer) { clearTimeout(this._timer); this._timer = null; }
      var write = function () {
        try {
          self.data.stats.lastPlayed = Date.now();
          window.localStorage.setItem(SAVE_KEY, JSON.stringify(self.data));
        } catch (e) { /* private mode / full disk — game still playable this session */ }
      };
      if (immediate) write(); else this._timer = setTimeout(write, 400);
    },

    wipe: function () {
      try { window.localStorage.removeItem(SAVE_KEY); } catch (e) {}
      this.data = this.defaults();
    },

    world: function (id) { return this.data.worlds[id]; },
    companion: function () {
      var id = this.data.player.companion;
      return D.companions.filter(function (c) { return c.id === id; })[0] || D.companions[0];
    },
    name: function () { return this.data.player.name || 'Explorer'; }
  };

  /* ===========================================================
     5. PROGRESSION & REWARDS
     =========================================================== */
  var Progress = WW.Progress = {

    /* Cumulative XP required to REACH a level. L1=0, L2=105, L3=240, L4=405 ... */
    xpForLevel: function (level) {
      var l = level - 1;
      return Math.round(90 * l + 15 * l * l);
    },
    levelFromXP: function (xp) {
      var l = 1;
      while (l < 99 && this.xpForLevel(l + 1) <= xp) l++;
      return l;
    },
    levelInfo: function () {
      var xp = State.data.xp, lvl = this.levelFromXP(xp);
      var cur = this.xpForLevel(lvl), next = this.xpForLevel(lvl + 1);
      return {
        level: lvl, into: xp - cur, need: next - cur,
        pct: U.clamp(Math.round(((xp - cur) / (next - cur)) * 100), 0, 100)
      };
    },

    addXP: function (amount, opts) {
      opts = opts || {};
      if (amount <= 0) return;
      var before = State.data.level;
      State.data.xp += amount;
      var after = this.levelFromXP(State.data.xp);
      State.data.level = after;
      FX.gain('+' + amount + ' XP', 'xp', opts.from);
      if (after > before) {
        Sound.play('levelup');
        FX.celebrate({
          emoji: '🌟', title: 'Level ' + after + '!',
          lines: ['Your Knowledge Tree grew a little taller.'],
          rewards: [{ emoji: '💎', text: '+' + (after * 3) + ' gems' }]
        });
        State.data.gems += after * 3;
        if (after >= 5) this.badge('level_5');
        if (after >= 10) this.badge('level_10');
      }
      this.checkUnlocks();
      HUD.update();
      State.save();
    },

    addGems: function (n, from) {
      if (n <= 0) return;
      State.data.gems += n;
      Sound.play('coin');
      FX.gain('+' + n + ' 💎', 'gem', from);
      HUD.update();
      State.save();
    },

    spendGems: function (n) {
      if (State.data.gems < n) return false;
      State.data.gems -= n;
      HUD.update(); State.save();
      return true;
    },

    /* Track answers per subject so the parent dashboard is honest */
    answer: function (worldId, correct) {
      var w = State.world(worldId);
      if (w) { if (correct) w.correct++; else w.wrong++; }
      var a = State.data.stats.answers;
      if (correct) a.correct++; else a.wrong++;
      if (a.correct >= 50) this.badge('quick_thinker');
      State.save();
    },

    /* World progress 0–100. Hitting 100 restores that world's crystal. */
    addWorldProgress: function (worldId, amount) {
      var w = State.world(worldId);
      if (!w) return;
      var before = w.progress;
      w.progress = U.clamp(Math.round(w.progress + amount), 0, 100);
      if (w.progress >= 100 && !State.data.crystals[worldId]) {
        State.data.crystals[worldId] = true;
        setTimeout(function () { FX.crystalRestored(worldId); }, 700);
      }
      if (w.progress !== before) { HUD.update(); State.save(); }
    },

    badge: function (id) {
      if (!D.badges[id]) return false;
      if (State.data.badges.indexOf(id) !== -1) return false;
      State.data.badges.push(id);
      var b = D.badges[id];
      Sound.play('reward');
      FX.toast(b.emoji + ' Badge earned: ' + b.name);
      State.save();
      return true;
    },

    /* Called when any activity finishes — feeds the parent dashboard */
    logActivity: function (info) {
      State.data.stats.activitiesDone++;
      State.data.activities.unshift({
        world: info.world, name: info.name, detail: info.detail || '',
        stars: info.stars === undefined ? null : info.stars,
        xp: info.xp || 0, at: Date.now()
      });
      if (State.data.activities.length > 60) State.data.activities.length = 60;
      this.badge('first_step');
      State.save();
    },

    crystalCount: function () {
      var c = State.data.crystals, n = 0;
      for (var k in c) if (c[k]) n++;
      return n;
    },

    /* Tree growth stage 0–10, from level + crystals.
       Restoring all five crystals always completes the tree — that is the
       whole quest — and is capped at 9 before then so the finish is visible. */
    treeStage: function () {
      var crystals = this.crystalCount();
      if (crystals >= 5) return 10;
      return U.clamp(Math.floor(State.data.level / 2) + crystals, 0, 9);
    },

    worldUnlocked: function (id) { return !!State.data.unlocked[id]; },

    checkUnlocks: function () {
      var newly = [];
      D.worlds.forEach(function (w) {
        if (State.data.unlocked[w.id]) return;
        if (w.requiresCrystals) {
          if (Progress.crystalCount() >= 5) { State.data.unlocked[w.id] = true; newly.push(w); }
        } else if (w.unlockXP !== null && State.data.xp >= w.unlockXP) {
          State.data.unlocked[w.id] = true; newly.push(w);
        }
      });
      if (newly.length) {
        State.save();
        newly.forEach(function (w, i) {
          setTimeout(function () {
            Sound.play('unlock');
            FX.celebrate({
              emoji: w.emoji, title: 'New world unlocked!',
              lines: [w.name + ' is open.', w.blurb,
                      'It will be waiting for you on the map.'],
              actionText: 'Awesome!',
              /* Secondary, never primary — the child stays wherever they are
                 unless they choose to leave. */
              secondary: { text: '🗺️ Go to the map', onClick: function () { Nav.go('map'); } }
            });
          }, 500 + i * 400);
        });
      }
      return newly;
    },

    /* How many of the 5 worlds have been visited (for the Explorer badge) */
    checkExplorer: function () {
      var ids = ['math', 'story', 'science', 'city', 'business'], all = true;
      ids.forEach(function (id) { if (!State.data.visited[id]) all = false; });
      if (all) this.badge('explorer');
    }
  };

  /* ===========================================================
     6. VISUAL FX
     =========================================================== */
  var FX = WW.FX = {
    layer: function () { return document.getElementById('fx-layer'); },

    reduced: function () {
      return !!(State.data && State.data.settings.reduceMotion) ||
        (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    },

    toast: function (msg, ms) {
      var layer = document.getElementById('toast-layer');
      if (!layer) return;
      var t = U.el('div', { class: 'toast', text: msg });
      layer.appendChild(t);
      setTimeout(function () { t.classList.add('out'); }, ms || 2200);
      setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, (ms || 2200) + 500);
    },

    /* Floating "+12 XP" text */
    gain: function (text, kind, fromEl) {
      var layer = this.layer();
      if (!layer) return;
      var x = window.innerWidth / 2, y = window.innerHeight * 0.4;
      if (fromEl && fromEl.getBoundingClientRect) {
        var r = fromEl.getBoundingClientRect();
        x = r.left + r.width / 2; y = r.top + r.height / 2;
      }
      var n = U.el('div', { class: 'gain gain-' + kind, text: text });
      n.style.left = x + 'px'; n.style.top = y + 'px';
      layer.appendChild(n);
      setTimeout(function () { if (n.parentNode) n.parentNode.removeChild(n); }, 1400);
    },

    burst: function (fromEl, emoji, count) {
      if (this.reduced()) return;
      var layer = this.layer();
      if (!layer) return;
      var r = fromEl && fromEl.getBoundingClientRect
        ? fromEl.getBoundingClientRect()
        : { left: window.innerWidth / 2, top: window.innerHeight / 2, width: 0, height: 0 };
      var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      for (var i = 0; i < (count || 8); i++) {
        var p = U.el('div', { class: 'spark', text: emoji || '✨' });
        p.style.left = cx + 'px'; p.style.top = cy + 'px';
        p.style.setProperty('--dx', (U.rnd(-90, 90)) + 'px');
        p.style.setProperty('--dy', (U.rnd(-120, -30)) + 'px');
        p.style.animationDelay = (i * 0.03) + 's';
        layer.appendChild(p);
        (function (node) {
          setTimeout(function () { if (node.parentNode) node.parentNode.removeChild(node); }, 1200);
        })(p);
      }
    },

    confetti: function () {
      if (this.reduced()) return;
      var layer = this.layer();
      if (!layer) return;
      var colors = ['#ffd34d', '#45c8ff', '#ff6f9c', '#63d68d', '#bb8bff', '#ff8a5c'];
      for (var i = 0; i < 36; i++) {
        var c = U.el('div', { class: 'confetti' });
        c.style.left = U.rnd(0, 100) + 'vw';
        c.style.background = colors[i % colors.length];
        c.style.animationDelay = (Math.random() * 0.6) + 's';
        c.style.setProperty('--spin', U.rnd(-360, 360) + 'deg');
        layer.appendChild(c);
        (function (node) {
          setTimeout(function () { if (node.parentNode) node.parentNode.removeChild(node); }, 3200);
        })(c);
      }
    },

    /* Reward / celebration modal */
    celebrate: function (o) {
      if (o.sound) Sound.play(o.sound);
      /* fanfare + applause + a spoken "Great job!" — varied every time */
      Sound.win(o.cheer === 'small' ? 'small' : 'big');
      this.confetti();
      var body = U.el('div', { class: 'celebrate' });
      body.appendChild(U.el('div', { class: 'celebrate-emoji', text: o.emoji || '🎉' }));
      (o.lines || []).forEach(function (l) {
        body.appendChild(U.el('p', { class: 'celebrate-line', text: l }));
      });
      if (o.rewards && o.rewards.length) {
        var row = U.el('div', { class: 'reward-row' });
        o.rewards.forEach(function (r) {
          row.appendChild(U.el('div', { class: 'reward-pill' }, [
            U.el('span', { class: 'reward-emoji', text: r.emoji }),
            U.el('span', { text: r.text })
          ]));
        });
        body.appendChild(row);
      }
      if (o.extra) body.appendChild(o.extra);
      var actions = [{
        text: o.actionText || 'Yay!', primary: true,
        onClick: function () { Modal.close(); if (o.onAction) o.onAction(); }
      }];
      /* An optional extra button — e.g. "Show me the map". Never the primary
         action, so a celebration can't yank a child out of what they're doing. */
      if (o.secondary) {
        actions.push({
          text: o.secondary.text,
          onClick: function () { Modal.close(); o.secondary.onClick(); }
        });
      }
      Modal.open({ title: o.title || 'Great work!', body: body, actions: actions });
    },

    crystalRestored: function (worldId) {
      var crystal = D.crystals.filter(function (c) { return c.id === worldId; })[0];
      if (!crystal) return;
      Sound.play('crystal');
      Progress.addGems(25);
      var all = Progress.crystalCount() >= 5;
      if (all) Progress.badge('tree_restored');
      var art = U.el('div', { class: 'crystal-show' });
      art.innerHTML = '<div class="crystal-big" style="--c:' + crystal.color + '">' + crystal.emoji + '</div>';
      FX.celebrate({
        emoji: '🌳', sound: 'grow',
        title: crystal.name + ' restored!',
        lines: all
          ? ['Every crystal is home. The Knowledge Tree is GLOWING!', 'WonderSpace has opened above the clouds. 🚀']
          : ['You returned a crystal to the Knowledge Tree.', 'It grew new branches and leaves!'],
        rewards: [{ emoji: '💎', text: '+25 gems' }, { emoji: '🌳', text: 'Tree grew!' }],
        extra: art,
        actionText: 'Wonderful!',
        secondary: { text: '🌳 See the tree', onClick: function () { Nav.go('tree'); } }
      });
      Progress.checkUnlocks();
      State.save(true);
    },

    pulse: function (el, cls) {
      if (!el || this.reduced()) return;
      cls = cls || 'pop';
      el.classList.remove(cls);
      void el.offsetWidth;            /* restart the animation */
      el.classList.add(cls);
    }
  };

  /* ===========================================================
     7. MODAL
     =========================================================== */
  var Modal = WW.Modal = {
    _onClose: null,
    open: function (o) {
      var layer = document.getElementById('modal-layer');
      var title = document.getElementById('modal-title');
      var body = document.getElementById('modal-body');
      var actions = document.getElementById('modal-actions');
      if (!layer) return;
      title.textContent = o.title || '';
      title.hidden = !o.title;
      body.innerHTML = '';
      if (o.body) {
        if (typeof o.body === 'string') body.innerHTML = o.body;
        else body.appendChild(o.body);
      }
      actions.innerHTML = '';
      (o.actions || [{ text: 'OK', primary: true, onClick: function () { Modal.close(); } }]).forEach(function (a) {
        actions.appendChild(U.el('button', {
          class: 'big-btn ' + (a.primary ? 'primary' : 'secondary'),
          text: a.text,
          onclick: function () { Sound.play('tap'); if (a.onClick) a.onClick(); else Modal.close(); }
        }));
      });
      this._onClose = o.onClose || null;
      this._dismissable = o.dismissable !== false;
      layer.hidden = false;
      requestAnimationFrame(function () { layer.classList.add('show'); });
      var first = actions.querySelector('button');
      if (first) setTimeout(function () { first.focus(); }, 60);
    },
    close: function () {
      var layer = document.getElementById('modal-layer');
      if (!layer || layer.hidden) return;
      layer.classList.remove('show');
      setTimeout(function () { layer.hidden = true; }, 220);
      if (this._onClose) { var f = this._onClose; this._onClose = null; f(); }
    },
    isOpen: function () {
      var layer = document.getElementById('modal-layer');
      return layer && !layer.hidden;
    }
  };

  /* ===========================================================
     8. AVATAR ART (pure SVG — no image files to break)
     =========================================================== */
  var Avatar = WW.Avatar = {
    svg: function (player, opts) {
      opts = opts || {};
      var skin = D.skins[player.skin % D.skins.length];
      var hair = D.hairColors[player.hairColor % D.hairColors.length];
      var style = D.hairStyles[player.hair % D.hairStyles.length].id;
      var fit = D.outfits[player.outfit % D.outfits.length];
      var hairArt = '';

      switch (style) {
        case 'short':
          hairArt = '<path d="M30 40 Q50 18 70 40 Q70 28 50 24 Q30 28 30 40Z" fill="' + hair + '"/>'; break;
        case 'curly':
          hairArt = '<g fill="' + hair + '">' +
            '<circle cx="34" cy="34" r="10"/><circle cx="50" cy="27" r="11"/><circle cx="66" cy="34" r="10"/>' +
            '<circle cx="28" cy="46" r="8"/><circle cx="72" cy="46" r="8"/></g>'; break;
        case 'long':
          hairArt = '<path d="M27 42 Q27 22 50 22 Q73 22 73 42 L73 68 Q73 60 66 58 L66 40 Q50 32 34 40 L34 58 Q27 60 27 68Z" fill="' + hair + '"/>'; break;
        case 'ponytail':
          hairArt = '<path d="M30 40 Q50 18 70 40 Q70 28 50 24 Q30 28 30 40Z" fill="' + hair + '"/>' +
            '<path d="M70 36 Q84 42 80 62 Q76 70 70 66 Q76 52 66 42Z" fill="' + hair + '"/>'; break;
        case 'bun':
          hairArt = '<circle cx="50" cy="18" r="9" fill="' + hair + '"/>' +
            '<path d="M30 40 Q50 18 70 40 Q70 28 50 24 Q30 28 30 40Z" fill="' + hair + '"/>'; break;
        case 'cap':
          hairArt = '<path d="M28 38 Q50 16 72 38 L72 41 L28 41Z" fill="' + hair + '"/>' +
            '<rect x="20" y="39" width="44" height="6" rx="3" fill="' + hair + '" opacity=".85"/>'; break;
      }

      return '' +
        '<svg class="avatar-svg" viewBox="0 0 100 124" role="img" aria-label="' +
          U.esc(opts.label || 'Your explorer character') + '">' +
          '<ellipse cx="50" cy="119" rx="24" ry="4.5" fill="rgba(0,0,0,.18)"/>' +
          /* legs & shoes (drawn first so the body overlaps them) */
          '<rect x="40.5" y="96" width="8" height="18" rx="4" fill="' + skin + '"/>' +
          '<rect x="51.5" y="96" width="8" height="18" rx="4" fill="' + skin + '"/>' +
          '<ellipse cx="43.5" cy="114" rx="8.5" ry="5" fill="#3c3357"/>' +
          '<ellipse cx="56.5" cy="114" rx="8.5" ry="5" fill="#3c3357"/>' +
          /* body */
          '<path d="M28 102 Q28 72 50 70 Q72 72 72 102 Z" fill="' + fit.top + '"/>' +
          '<path d="M28 102 Q28 94 30 90 L70 90 Q72 94 72 102 Z" fill="' + fit.trim + '"/>' +
          '<circle cx="50" cy="78" r="5" fill="' + fit.trim + '"/>' +
          /* arms */
          '<circle cx="25" cy="86" r="7" fill="' + skin + '"/>' +
          '<circle cx="75" cy="86" r="7" fill="' + skin + '"/>' +
          /* head */
          '<circle cx="50" cy="48" r="23" fill="' + skin + '"/>' +
          '<ellipse cx="29" cy="50" rx="4" ry="5" fill="' + skin + '"/>' +
          '<ellipse cx="71" cy="50" rx="4" ry="5" fill="' + skin + '"/>' +
          hairArt +
          /* face */
          '<circle cx="42" cy="49" r="3.1" fill="#2a2140"/>' +
          '<circle cx="58" cy="49" r="3.1" fill="#2a2140"/>' +
          '<circle cx="43.2" cy="47.8" r="1.1" fill="#fff"/>' +
          '<circle cx="59.2" cy="47.8" r="1.1" fill="#fff"/>' +
          '<path d="M43 57 Q50 63 57 57" stroke="#2a2140" stroke-width="2.4" fill="none" stroke-linecap="round"/>' +
          '<circle cx="35" cy="56" r="3.4" fill="#ff8aa8" opacity=".45"/>' +
          '<circle cx="65" cy="56" r="3.4" fill="#ff8aa8" opacity=".45"/>' +
        '</svg>';
    },

    /* Knowledge Tree art. stage 0–10, crystals = {math:true,...} */
    treeSVG: function (stage, crystals, opts) {
      opts = opts || {};
      var s = U.clamp(stage, 0, 10);
      var leafColor = ['#4f6b3a', '#5a7d3f', '#64903f', '#6fa544', '#79b94a'];
      var parts = [];

      /* ground */
      parts.push('<ellipse cx="150" cy="268" rx="118" ry="18" fill="rgba(90,200,140,.28)"/>');
      parts.push('<ellipse cx="150" cy="270" rx="86" ry="12" fill="rgba(90,200,140,.4)"/>');

      /* trunk grows taller with stage */
      var trunkTop = 180 - s * 9;                      /* stage 0 → 180, stage 10 → 90 */
      var trunkW = 9 + s * 1.3;
      parts.push('<path d="M' + (150 - trunkW) + ' 268 Q' + (150 - trunkW * 0.6) + ' ' + (trunkTop + 40) +
        ' ' + (150 - trunkW * 0.45) + ' ' + trunkTop + ' L' + (150 + trunkW * 0.45) + ' ' + trunkTop +
        ' Q' + (150 + trunkW * 0.6) + ' ' + (trunkTop + 40) + ' ' + (150 + trunkW) + ' 268 Z" fill="#7a5230"/>');
      parts.push('<path d="M150 268 L150 ' + trunkTop + '" stroke="#8d6137" stroke-width="3" opacity=".6"/>');

      /* branches appear from stage 2 */
      var branches = [
        { x: -46, y: 22, s: 1 }, { x: 46, y: 22, s: 1 },
        { x: -66, y: 54, s: 3 }, { x: 66, y: 54, s: 3 },
        { x: -34, y: 76, s: 5 }, { x: 34, y: 76, s: 5 }
      ];
      branches.forEach(function (b) {
        if (s < b.s) return;
        parts.push('<path d="M150 ' + (trunkTop + b.y + 30) + ' Q' + (150 + b.x * 0.5) + ' ' +
          (trunkTop + b.y + 14) + ' ' + (150 + b.x) + ' ' + (trunkTop + b.y) +
          '" stroke="#7a5230" stroke-width="' + (5 + s * 0.3) + '" fill="none" stroke-linecap="round"/>');
      });

      /* canopy — more and bigger blobs as the tree heals */
      if (s === 0) {
        parts.push('<circle cx="150" cy="' + (trunkTop - 4) + '" r="16" fill="#4f6b3a" opacity=".85"/>');
      } else {
        var blobs = [
          { x: 0, y: -14, r: 34 }, { x: -38, y: 6, r: 27 }, { x: 38, y: 6, r: 27 },
          { x: -22, y: -36, r: 24 }, { x: 24, y: -36, r: 24 },
          { x: -62, y: 30, r: 20 }, { x: 62, y: 30, r: 20 },
          { x: 0, y: -52, r: 22 }, { x: -44, y: -20, r: 20 }, { x: 44, y: -20, r: 20 }
        ];
        var count = Math.min(blobs.length, 2 + s);
        for (var i = 0; i < count; i++) {
          var b2 = blobs[i];
          var r = b2.r * (0.55 + s * 0.045);
          parts.push('<circle cx="' + (150 + b2.x) + '" cy="' + (trunkTop + b2.y) + '" r="' + r.toFixed(1) +
            '" fill="' + leafColor[i % leafColor.length] + '" opacity="' + (0.72 + s * 0.025).toFixed(2) + '"/>');
        }
        /* sparkle leaves */
        for (var j = 0; j < Math.min(s, 7); j++) {
          var ang = (j / 7) * Math.PI * 2;
          parts.push('<circle cx="' + (150 + Math.cos(ang) * (46 + s)) + '" cy="' +
            (trunkTop + Math.sin(ang) * (30 + s * 0.6)) + '" r="3.4" fill="#d6ff9b" opacity=".9"/>');
        }
      }

      /* Five crystal sockets sit on an arc that hugs the canopy, so they stay
         close to the tree as it grows instead of floating off in the sky. */
      var slots = [
        { id: 'math', a: -172 }, { id: 'story', a: -136 }, { id: 'science', a: -90 },
        { id: 'city', a: -44 }, { id: 'business', a: -8 }
      ];
      var arcRx = 70 + s * 4, arcRy = 40 + s * 2, arcCy = trunkTop - 4;
      slots.forEach(function (slot) {
        var c = D.crystals.filter(function (x) { return x.id === slot.id; })[0];
        var on = crystals && crystals[slot.id];
        var rad = slot.a * Math.PI / 180;
        var cx = 150 + arcRx * Math.cos(rad);
        var cy = U.clamp(arcCy + arcRy * Math.sin(rad), 22, 250);
        parts.push('<g class="tree-slot ' + (on ? 'on' : 'off') + '" data-crystal="' + slot.id + '">' +
          '<circle cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) + '" r="17"' +
            (on
              ? ' fill="' + c.color + '" opacity=".92" class="glow"'
              : ' fill="rgba(255,255,255,.12)" stroke="rgba(255,255,255,.5)" stroke-width="2" stroke-dasharray="5 4"') +
            '/>' +
          '<text x="' + cx.toFixed(1) + '" y="' + (cy + 7).toFixed(1) + '" text-anchor="middle" font-size="20"' +
            (on ? '' : ' fill="#e4dfff" opacity=".8"') + '>' + (on ? c.emoji : '⬡') + '</text>' +
          '</g>');
      });

      return '<svg class="tree-svg" viewBox="0 0 300 290" role="img" aria-label="' +
        U.esc(opts.label || ('Knowledge Tree, growth stage ' + s + ' of 10, ' +
          (crystals ? Object.keys(crystals).filter(function (k) { return crystals[k]; }).length : 0) +
          ' of 5 crystals restored')) + '">' + parts.join('') + '</svg>';
    }
  };

  /* ===========================================================
     9. COMPANION BUDDY
     =========================================================== */
  var Buddy = WW.Buddy = {
    _timer: null,
    show: function (visible) {
      var b = document.getElementById('buddy');
      if (!b) return;
      b.hidden = !visible;
      if (visible) {
        document.getElementById('buddy-face').textContent = State.companion().emoji;
      }
    },
    say: function (text, ms) {
      var b = document.getElementById('buddy'), bub = document.getElementById('buddy-bubble');
      if (!b || b.hidden) return;
      bub.textContent = text;
      b.classList.add('talking');
      FX.pulse(document.getElementById('buddy-face'), 'bounce');
      if (this._timer) clearTimeout(this._timer);
      this._timer = setTimeout(function () { b.classList.remove('talking'); }, ms || 3400);
    },
    cheer: function () {
      var c = State.companion();
      this.say(U.pick(c.lines));
    },
    tip: function (text) { this.say(text, 5200); }
  };

  /* ===========================================================
     10. HUD
     =========================================================== */
  var HUD = WW.HUD = {
    show: function (visible) {
      var h = document.getElementById('hud');
      if (h) h.hidden = !visible;
    },
    update: function () {
      if (!State.data) return;
      var info = Progress.levelInfo();
      var av = document.getElementById('hud-avatar');
      if (av) av.innerHTML = Avatar.svg(State.data.player, { label: 'My profile' });
      var nameEl = document.getElementById('hud-playername');
      if (nameEl) nameEl.textContent = State.name();
      var lvl = document.getElementById('hud-level');
      if (lvl) lvl.textContent = 'Lv ' + info.level;
      var fill = document.getElementById('hud-xpfill');
      if (fill) fill.style.width = info.pct + '%';
      var txt = document.getElementById('hud-xptext');
      if (txt) txt.textContent = info.into + ' / ' + info.need + ' XP';
      var bar = document.getElementById('hud-xpbar');
      if (bar) bar.setAttribute('aria-valuenow', info.pct);
      var gems = document.getElementById('hud-gems');
      if (gems) {
        gems.querySelector('b').textContent = State.data.gems;
        gems.setAttribute('aria-label', 'Gems: ' + State.data.gems);
      }
      var snd = document.getElementById('btn-sound');
      if (snd) {
        var on = State.data.settings.sound;
        snd.firstElementChild.textContent = on ? '🔊' : '🔇';
        snd.setAttribute('aria-pressed', on ? 'true' : 'false');
        snd.setAttribute('aria-label', 'Sound: ' + (on ? 'on' : 'off'));
      }
    }
  };

  /* ===========================================================
     11. NAVIGATION / SCREEN ROUTER
     =========================================================== */
  var Nav = WW.Nav = {
    current: null,
    history: [],

    go: function (name, opts) {
      opts = opts || {};
      var target = document.getElementById('screen-' + name);
      if (!target) return;
      if (this.current && this.current !== name && !opts.replace) this.history.push(this.current);

      U.$$('.screen').forEach(function (s) {
        if (s === target) return;
        s.classList.remove('active');
        s.hidden = true;
      });
      target.hidden = false;
      /* next frame so the enter animation runs */
      requestAnimationFrame(function () { target.classList.add('active'); });
      target.scrollTop = 0;

      var prev = this.current;
      this.current = name;
      /* Walking out of the grown-ups area closes it again, so a child who
         picks the device up afterwards still meets the gate. */
      if (prev === 'parent' && name !== 'parent' && WW.Screens.parent) {
        WW.Screens.parent.lock();
      }

      var chrome = (name !== 'title' && name !== 'create' && name !== 'parent');
      HUD.show(chrome && State.data.hasCharacter);
      Buddy.show(chrome && State.data.hasCharacter);
      document.body.dataset.screen = name;

      if (prev !== name) Sound.play('whoosh');
      HUD.update();

      var scr = WW.Screens[name];
      if (scr && scr.enter) scr.enter(opts);
      Clock.onScreen(name);
    },

    back: function () {
      var prev = this.history.pop();
      this.go(prev || 'map', { replace: true });
    }
  };

  /* ===========================================================
     12. PLAY CLOCK (for the parent dashboard)
     =========================================================== */
  var Clock = WW.Clock = {
    active: false,
    last: 0,
    tick: null,
    onScreen: function (name) {
      var playing = (name !== 'title' && name !== 'parent');
      if (playing) this.start(); else this.stop();
    },
    start: function () {
      if (this.active) return;
      this.active = true; this.last = Date.now();
      var self = this;
      this.tick = setInterval(function () { self.accrue(); }, 5000);
    },
    accrue: function () {
      if (!this.active || !State.data) return;
      var now = Date.now(), dt = now - this.last;
      this.last = now;
      if (dt > 0 && dt < 120000) {       /* ignore sleep/background gaps */
        State.data.stats.timeMs += dt;
        State.save();
      }
    },
    stop: function () {
      if (!this.active) return;
      this.accrue();
      this.active = false;
      if (this.tick) { clearInterval(this.tick); this.tick = null; }
    }
  };

  /* ===========================================================
     13. SHARED UI BUILDERS used by every world
     =========================================================== */
  var UI = WW.UI = {
    card: function (cls, kids) { return U.el('div', { class: 'card ' + (cls || '') }, kids || []); },

    bigButton: function (text, onClick, cls) {
      return U.el('button', {
        class: 'big-btn ' + (cls || 'primary'),
        html: text,
        onclick: function (e) { Sound.play('tap'); onClick(e); }
      });
    },

    meter: function (label, value, max, color, emoji) {
      var pct = U.clamp(Math.round((value / max) * 100), 0, 100);
      var wrap = U.el('div', { class: 'meter' });
      wrap.appendChild(U.el('div', { class: 'meter-top' }, [
        U.el('span', { class: 'meter-label' }, [U.el('span', { 'aria-hidden': 'true', text: emoji || '' }), ' ' + label]),
        U.el('b', { class: 'meter-val', text: Math.round(value) + (max === 100 ? '%' : '') })
      ]));
      var track = U.el('div', {
        class: 'meter-track', role: 'progressbar',
        'aria-label': label, 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': pct
      });
      var fill = U.el('i');
      fill.style.width = pct + '%';
      fill.style.background = color;
      track.appendChild(fill);
      wrap.appendChild(track);
      return wrap;
    },

    progressRow: function (worldId) {
      var w = State.world(worldId);
      var world = D.worlds.filter(function (x) { return x.id === worldId; })[0];
      var done = State.data.crystals[worldId];
      var row = U.el('div', { class: 'world-progress' });
      row.appendChild(UI.meter(done ? 'Crystal restored!' : 'Crystal progress',
        w.progress, 100, world.color, done ? '✅' : '🔮'));
      return row;
    },

    /* A labelled stepper that is finger-friendly (no tiny slider thumbs required) */
    stepper: function (o) {
      var value = o.value;
      var out = U.el('b', { class: 'stepper-val', text: o.format ? o.format(value) : value });
      function set(v) {
        value = U.clamp(v, o.min, o.max);
        out.textContent = o.format ? o.format(value) : value;
        FX.pulse(out, 'pop');
        Sound.play('tap');
        if (o.onChange) o.onChange(value);
      }
      var wrap = U.el('div', { class: 'stepper' }, [
        U.el('span', { class: 'stepper-label', text: o.label }),
        U.el('div', { class: 'stepper-ctl' }, [
          U.el('button', { class: 'round-btn', 'aria-label': 'Less ' + o.label,
            onclick: function () { set(value - o.step); }, text: '−' }),
          out,
          U.el('button', { class: 'round-btn', 'aria-label': 'More ' + o.label,
            onclick: function () { set(value + o.step); }, text: '+' })
        ])
      ]);
      wrap.getValue = function () { return value; };
      return wrap;
    },

    backTo: function (fn) { return fn; },

    /* Standard world intro header */
    worldHero: function (worldId, titleText, subtitle) {
      var world = D.worlds.filter(function (x) { return x.id === worldId; })[0];
      var hero = U.el('div', { class: 'world-hero' });
      hero.style.setProperty('--wc', world.color);
      hero.appendChild(U.el('div', { class: 'world-hero-emoji', text: world.emoji, 'aria-hidden': 'true' }));
      hero.appendChild(U.el('div', { class: 'world-hero-text' }, [
        U.el('h3', { text: titleText || world.name }),
        U.el('p', { text: subtitle || world.blurb })
      ]));
      return hero;
    }
  };

  /* Screens registry — filled by screens.js and the world modules */
  WW.Screens = WW.Screens || {};
  WW.Worlds = WW.Worlds || {};

  /* ===========================================================
     14. SETTINGS
     =========================================================== */
  WW.Settings = {
    apply: function () {
      var s = State.data.settings;
      document.body.classList.toggle('reduce-motion', !!s.reduceMotion);
      document.body.classList.toggle('big-text', !!s.bigText);
    },
    toggle: function (key) {
      State.data.settings[key] = !State.data.settings[key];
      this.apply();
      HUD.update();
      State.save(true);
      return State.data.settings[key];
    },
    openPanel: function () {
      var s = State.data.settings;
      var body = U.el('div', { class: 'settings-panel' });
      function row(label, key, note) {
        var btn = U.el('button', {
          class: 'toggle-row' + (s[key] ? ' on' : ''),
          'aria-pressed': s[key] ? 'true' : 'false',
          onclick: function () {
            var on = WW.Settings.toggle(key);
            btn.classList.toggle('on', on);
            btn.setAttribute('aria-pressed', on ? 'true' : 'false');
            btn.querySelector('.toggle-state').textContent = on ? 'ON' : 'OFF';
            Sound.play('tap');
          }
        }, [
          U.el('span', { class: 'toggle-text' }, [
            U.el('b', { text: label }),
            note ? U.el('small', { text: note }) : null
          ]),
          U.el('span', { class: 'toggle-state', text: s[key] ? 'ON' : 'OFF' })
        ]);
        return btn;
      }
      body.appendChild(row('Sound effects', 'sound', 'Chimes, applause and happy noises'));
      body.appendChild(row('Cheering voice', 'voice', 'Says "Great job!" when you win'));
      body.appendChild(row('Reduce motion', 'reduceMotion', 'Fewer animations and effects'));
      body.appendChild(row('Bigger text', 'bigText', 'Larger words everywhere'));
      Modal.open({ title: '⚙️ Settings', body: body });
    }
  };

  /* ===========================================================
     15. CORE BOOT (DOM wiring)
     =========================================================== */
  WW.bootCore = function () {
    /* starfield background */
    var sky = document.getElementById('sky');
    if (sky) {
      var html = '';
      for (var i = 0; i < 48; i++) {
        html += '<i style="left:' + U.rnd(0, 100) + '%;top:' + U.rnd(0, 100) + '%;--d:' +
          (U.rnd(18, 50) / 10) + 's;--s:' + (U.rnd(2, 5)) + 'px"></i>';
      }
      sky.innerHTML = html;
    }

    /* global nav delegation */
    document.addEventListener('click', function (e) {
      var navBtn = e.target.closest('[data-nav]');
      if (navBtn) {
        Sound.unlock(); Sound.play('tap');
        Nav.go(navBtn.getAttribute('data-nav'));
      }
    });

    /* any tap unlocks audio on iOS */
    document.addEventListener('pointerdown', function () { Sound.unlock(); }, { once: true });

    var snd = document.getElementById('btn-sound');
    if (snd) snd.addEventListener('click', function () {
      Sound.unlock();
      var on = WW.Settings.toggle('sound');
      if (on) Sound.play('good');
      FX.toast(on ? '🔊 Sound on' : '🔇 Sound off', 1200);
    });

    var setBtn = document.getElementById('btn-settings');
    if (setBtn) setBtn.addEventListener('click', function () { Sound.play('tap'); WW.Settings.openPanel(); });

    var buddy = document.getElementById('buddy');
    if (buddy) buddy.addEventListener('click', function () {
      Sound.play('tap');
      var hints = [
        'Tap a world on the map to play!',
        'Every answer makes the Knowledge Tree grow.',
        'Mistakes are how brains get stronger.',
        'Gems are for fun — learning is the real prize!',
        'Try the Science Lab — you can make it snow! ❄️'
      ];
      Buddy.say(U.pick(hints), 4200);
    });

    /* back buttons on each world screen */
    ['math', 'story', 'science', 'city', 'business', 'parent'].forEach(function (id) {
      var b = document.getElementById(id + '-back');
      if (b) b.addEventListener('click', function () {
        Sound.play('tap');
        var w = WW.Worlds[id];
        if (w && w.back) w.back(); else Nav.go(id === 'parent' ? 'title' : 'map');
      });
    });

    document.getElementById('modal-backdrop').addEventListener('click', function () {
      if (Modal._dismissable !== false) { Sound.play('tap'); Modal.close(); }
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && Modal.isOpen()) Modal.close();
    });

    /* pause the play clock when the tab/app is hidden */
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) { Clock.stop(); State.save(true); }
      else Clock.onScreen(Nav.current);
    });
    window.addEventListener('pagehide', function () { Clock.stop(); State.save(true); });
  };

})(window.WW);
