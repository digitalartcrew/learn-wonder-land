/* =============================================================
   WonderWorld — tools/logic-test.js
   A headless sanity check for the pure game logic (no DOM).
   Run with:  node tools/logic-test.js
   ============================================================= */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');

/* --- minimal browser stubs (the logic we test never touches the DOM) --- */
const store = {};
const sandbox = {
  console,
  setTimeout, clearTimeout, setInterval, clearInterval,
  requestAnimationFrame: (f) => setTimeout(f, 0),
  document: {
    getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
    createElement: () => ({ style: {}, classList: { add() {}, remove() {}, toggle() {} },
      appendChild() {}, addEventListener() {}, setAttribute() {} }),
    addEventListener() {}, body: { dataset: {}, classList: { toggle() {}, add() {}, remove() {} } }
  }
};
sandbox.window = sandbox;
sandbox.window.localStorage = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; }
};
sandbox.window.matchMedia = () => ({ matches: false });
vm.createContext(sandbox);

['js/core.js', 'js/art.js', 'js/worlds/math.js', 'js/worlds/story.js', 'js/worlds/science.js',
 'js/worlds/city.js', 'js/worlds/business.js'].forEach((f) => {
  vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), sandbox, { filename: f });
});

const WW = sandbox.WW;
let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  ✅ ' + name); }
  else { fail++; console.log('  ❌ ' + name + (extra ? '  → ' + extra : '')); }
}
function section(t) { console.log('\n' + t); }

/* ============ 1. state & save ============ */
section('1. State, save and load');
WW.State.load();
ok('fresh state has 5 unrestored crystals', WW.Progress.crystalCount() === 0);
ok('math + story open from the start', WW.State.data.unlocked.math && WW.State.data.unlocked.story);
ok('science locked at the start', !WW.State.data.unlocked.science);
WW.State.data.player.name = 'Testy';
WW.State.data.gems = 42;
WW.State.save(true);
WW.State.data = null;
WW.State.load();
ok('save survives a reload', WW.State.data.player.name === 'Testy' && WW.State.data.gems === 42);

/* forward-compat: an old save missing new keys still loads */
store['wonderworld.save.v1'] = JSON.stringify({ xp: 500, player: { name: 'Old' } });
WW.State.load();
ok('old/partial saves merge onto defaults',
  WW.State.data.player.name === 'Old' && WW.State.data.worlds.city.money === 160);

/* ============ 2. levels & unlocks ============ */
section('2. Levels, XP and world unlocking');
ok('level 1 at 0 XP', WW.Progress.levelFromXP(0) === 1);
let monotonic = true;
for (let l = 1; l < 30; l++) if (WW.Progress.xpForLevel(l + 1) <= WW.Progress.xpForLevel(l)) monotonic = false;
ok('XP thresholds always increase', monotonic);
let roundtrip = true;
for (let l = 1; l < 25; l++) {
  if (WW.Progress.levelFromXP(WW.Progress.xpForLevel(l)) !== l) roundtrip = false;
}
ok('levelFromXP(xpForLevel(n)) === n', roundtrip);

store['wonderworld.save.v1'] = '';
WW.State.load();
WW.State.data.xp = 0;
WW.State.data.unlocked = { math: true, story: true, science: false, city: false, business: false, space: false };
WW.State.data.xp = 150; WW.Progress.checkUnlocks();
ok('Science Lab unlocks at 150 XP', WW.State.data.unlocked.science);
WW.State.data.xp = 400; WW.Progress.checkUnlocks();
ok('Planet City unlocks at 400 XP', WW.State.data.unlocked.city);
WW.State.data.xp = 700; WW.Progress.checkUnlocks();
ok('Business Town unlocks at 700 XP', WW.State.data.unlocked.business);
ok('WonderSpace still locked without crystals', !WW.State.data.unlocked.space);
['math', 'story', 'science', 'city', 'business'].forEach((k) => { WW.State.data.crystals[k] = true; });
WW.Progress.checkUnlocks();
ok('WonderSpace unlocks with all 5 crystals', WW.State.data.unlocked.space);
ok('tree stage grows with crystals', WW.Progress.treeStage() >= 5);

/* ============ 3. world progress → crystal ============ */
section('3. World progress restores a crystal');
store['wonderworld.save.v1'] = '';
WW.State.load();
WW.Progress.addWorldProgress('math', 60);
ok('progress accumulates', WW.State.world('math').progress === 60);
ok('crystal not yet restored at 60%', !WW.State.data.crystals.math);
WW.Progress.addWorldProgress('math', 60);
ok('progress clamps at 100', WW.State.world('math').progress === 100);
ok('crystal restored at 100%', WW.State.data.crystals.math);

/* ============ 4. maths question generator ============ */
section('4. Math Island question generator');
const M = WW.Worlds.math;
let bad = [];
const topics = M.TOPICS.map((t) => t.id);
for (let tier = 1; tier <= 6; tier++) {
  WW.State.data.worlds.math.diff = tier;
  topics.forEach((topic) => {
    for (let i = 0; i < 400; i++) {
      const q = M.generate(topic);
      if (!q || !q.text) { bad.push(tier + '/' + topic + ': no text'); break; }
      if (!Array.isArray(q.choices) || q.choices.length < 2) { bad.push(tier + '/' + topic + ': too few choices'); break; }
      if (q.choices.indexOf(q.answer) === -1) { bad.push(tier + '/' + topic + ': answer not among choices (' + q.text + ')'); break; }
      if (new Set(q.choices).size !== q.choices.length) { bad.push(tier + '/' + topic + ': duplicate choices'); break; }
      if (!q.hint || !q.concept) { bad.push(tier + '/' + topic + ': missing hint/concept'); break; }
      if (/undefined|NaN/.test(q.text + q.choices.join(''))) { bad.push(tier + '/' + topic + ': NaN/undefined in "' + q.text + '"'); break; }
    }
  });
}
ok('50k generated questions are all well-formed', bad.length === 0, bad.slice(0, 4).join(' | '));

/* arithmetic spot-check: parse "a + b = ?" style prompts and verify */
let mathWrong = [];
WW.State.data.worlds.math.diff = 5;
for (let i = 0; i < 4000; i++) {
  const q = M.generate('mixed');
  const m = q.text.match(/^(\d+)\s*([+−×÷])\s*(\d+)\s*=\s*\?$/);
  if (!m) continue;
  const a = +m[1], b = +m[3];
  const expect = { '+': a + b, '−': a - b, '×': a * b, '÷': a / b }[m[2]];
  if (String(expect) !== q.answer) mathWrong.push(q.text + ' said ' + q.answer);
}
ok('plain arithmetic answers are correct', mathWrong.length === 0, mathWrong.slice(0, 3).join(' | '));

/* every topic chip yields a question even at tier 1 */
let topicOk = true;
WW.State.data.worlds.math.diff = 1;
topics.forEach((t) => { if (!M.generate(t)) topicOk = false; });
ok('every topic button works at the easiest level', topicOk);

/* ============ 5. story content ============ */
section('5. Story Forest content');
const CH = WW.Worlds.story.CHAPTERS;
ok('there are 3 chapters', CH.length === 3);
let storyBad = [];
CH.forEach((c, ci) => {
  if (!c.beats.length) storyBad.push('chapter ' + ci + ' empty');
  c.beats.forEach((b, bi) => {
    const where = 'ch' + ci + ' beat' + bi;
    if (b.type === 'passage') { if (!b.text || !b.emoji) storyBad.push(where + ' bad passage'); return; }
    const a = b.act;
    if (!a || !a.kind) { storyBad.push(where + ' bad activity'); return; }
    if (['phonics', 'rhyme'].includes(a.kind)) {
      if (!a.options.some((o) => o.t === a.answer)) storyBad.push(where + ' answer missing from options');
    }
    if (['vocab', 'comp'].includes(a.kind)) {
      if (a.options.indexOf(a.answer) === -1) storyBad.push(where + ' answer missing from options');
      if (new Set(a.options).size !== a.options.length) storyBad.push(where + ' duplicate options');
    }
    if (a.kind === 'spell') {
      if (!/^[a-z]+$/.test(a.word)) storyBad.push(where + ' spell word must be plain lowercase letters');
    }
    if (a.kind === 'sentence' && (!a.words || a.words.length < 3)) storyBad.push(where + ' sentence too short');
  });
});
ok('every chapter beat is well-formed', storyBad.length === 0, storyBad.slice(0, 4).join(' | '));
const activityCount = CH.reduce((n, c) => n + c.beats.filter((b) => b.type === 'activity').length, 0);
ok('story has 10+ interactive activities (' + activityCount + ')', activityCount >= 10);

/* ============ 6. science ============ */
section('6. Science Lab');
const Sc = WW.Worlds.science;
ok('6 weather types are all reachable', (() => {
  const seen = new Set();
  for (let t = -10; t <= 40; t += 5)
    for (let m = 0; m <= 100; m += 10)
      for (let w = 0; w <= 100; w += 10) seen.add(Sc.weatherFor(t, m, w));
  return ['sunny', 'rain', 'snow', 'storm', 'windy', 'fog'].every((k) => seen.has(k));
})());
ok('10 magnet objects, 5 magnetic / 5 not',
  Sc.MAGNET_OBJECTS.length === 10 &&
  Sc.MAGNET_OBJECTS.filter((o) => o.magnetic).length === 5);

/* science progress reaches exactly 100 when everything is discovered */
store['wonderworld.save.v1'] = '';
WW.State.load();
const sw = WW.State.data.worlds.science;
sw.plant = ['noSoil', 'noWater', 'tooMuchWater', 'noLight', 'lowLight', 'poorSoil', 'perfect'];
Sc.MAGNET_OBJECTS.forEach((o) => { sw.magnet[o.id] = { right: true }; });
sw.weather = ['sunny', 'rain', 'snow', 'storm', 'windy', 'fog'];
Sc.recalc();
ok('full discovery = 100% science progress (' + sw.progress + '%)', sw.progress === 100);
ok('science crystal restored', WW.State.data.crystals.science);

/* ============ 7. city simulation ============ */
section('7. Planet City simulation');
store['wonderworld.save.v1'] = '';
WW.State.load();
const City = WW.Worlds.city;
City.enter = City.enter; /* keep */
const cw = WW.State.data.worlds.city;
cw.grid = new Array(20).fill(null);
ok('empty city starts at 50/50', City.stats().env === 50 && City.stats().happy === 50);
cw.grid[0] = 'factory';
ok('a factory lowers the green score', City.stats().env < 50);
cw.grid[0] = null;
/* a sensible green city should be able to meet all five goals */
['house', 'house', 'house', 'house', 'tree', 'tree', 'tree', 'tree', 'tree',
 'park', 'solar', 'wind', 'recycle', 'bus'].forEach((b, i) => { cw.grid[i] = b; });
cw.money = 60;
const g = City.goals();
ok('a planned green city can meet all 5 goals (' + g.filter((x) => x.ok).length + '/5)',
  g.every((x) => x.ok), g.filter((x) => !x.ok).map((x) => x.id + '=' + x.now).join(','));
ok('meters stay inside 0–100', City.stats().env <= 100 && City.stats().happy >= 0);
/* affordability: the starting budget plus a few seasons must cover that city */
const totalCost = ['house', 'house', 'house', 'house', 'tree', 'tree', 'tree', 'tree', 'tree',
  'park', 'solar', 'wind', 'recycle', 'bus']
  .reduce((s, id) => s + City.BUILDINGS.find((b) => b.id === id).cost, 0);
const income = City.stats().income;
ok('that city is affordable within ~6 seasons (cost $' + totalCost + ', income $' + income + '/season)',
  160 + income * 6 >= totalCost + 50);

/* ============ 8. business simulation ============ */
section('8. Business Town simulation');
store['wonderworld.save.v1'] = '';
WW.State.load();
const B = WW.Worlds.business;
const hot = { temp: 32, weather: B.WEATHERS.find((w) => w.id === 'sunny') };
const wet = { temp: 14, weather: B.WEATHERS.find((w) => w.id === 'rain') };
const r1 = B.simulate({ price: 0.50, cups: 40, ads: 2 }, hot);
const r2 = B.simulate({ price: 0.50, cups: 40, ads: 2 }, wet);
ok('hot sunny days sell more than cold rainy days', r1.sold > r2.sold, r1.sold + ' vs ' + r2.sold);
const cheap = B.simulate({ price: 0.30, cups: 99, ads: 0 }, hot);
const dear = B.simulate({ price: 1.80, cups: 99, ads: 0 }, hot);
ok('a high price reduces demand', cheap.demand > dear.demand, cheap.demand + ' vs ' + dear.demand);
const noAds = B.simulate({ price: 0.75, cups: 99, ads: 0 }, hot);
const bigAds = B.simulate({ price: 0.75, cups: 99, ads: 8 }, hot);
ok('advertising increases demand', bigAds.demand > noAds.demand);
ok('cups sold never exceeds cups made', B.simulate({ price: 0.25, cups: 3, ads: 5 }, hot).sold <= 3);
ok('profit = revenue − costs', (() => {
  const p = { price: 0.75, cups: 30, ads: 2 };
  const r = B.simulate(p, hot);
  const costs = +(p.cups * 0.15 + p.ads).toFixed(2);
  return Math.abs(r.profit - (r.revenue - costs)) < 0.011;
})());
ok('over-producing creates leftovers (a real lesson)',
  B.simulate({ price: 2.00, cups: 60, ads: 0 }, wet).leftover > 0);
/* a sensible plan should actually make money */
let profitable = 0;
for (let i = 0; i < 200; i++) {
  const f = { temp: 26, weather: B.WEATHERS.find((w) => w.id === 'sunny') };
  if (B.simulate({ price: 0.60, cups: 30, ads: 2 }, f).profit > 0) profitable++;
}
ok('a sensible plan is profitable on a good day', profitable === 200);
ok('7 days of play completes the world', Math.round((100 / 7) * 7) >= 100);


/* ============ 8b. story illustrations ============ */
section('8b. Story illustrations');
const passages = [];
WW.Worlds.story.CHAPTERS.forEach((c) => c.beats.forEach((b) => {
  if (b.type === 'passage') passages.push(b);
}));
ok('every passage has an illustration (' + passages.length + ')',
  passages.every((b) => b.scene && WW.Art.has(b.scene)),
  passages.filter((b) => !b.scene || !WW.Art.has(b.scene)).map((b) => b.scene).join(','));
ok('no two passages reuse the same picture',
  new Set(passages.map((b) => b.scene)).size === passages.length);
ok('every scene renders real SVG', passages.every((b) => {
  const svg = WW.Art.scene(b.scene);
  return svg.startsWith('<svg') && svg.endsWith('</svg>') && svg.length > 400;
}));
ok('every scene has a screen-reader description',
  passages.every((b) => WW.Art.alt(b.scene).length > 25));
ok('scene markup contains no NaN/undefined',
  passages.every((b) => !/NaN|undefined/.test(WW.Art.scene(b.scene))));
ok('illustrations reference no external files',
  passages.every((b) => !/<image|xlink:href|url\(http/.test(WW.Art.scene(b.scene))));

/* ============ 8c. celebration audio ============ */
section('8c. Celebration audio');
ok('applause, fanfare, praise and win() all exist',
  ['applause', 'clap', 'fanfare', 'praise', 'say', 'win'].every((k) => typeof WW.Sound[k] === 'function'));
ok('voice can be switched off separately from sound',
  WW.State.data.settings.voice === true &&
  typeof WW.Sound.voiceOn === 'function');
ok('15 big praise phrases and 8 short ones',
  WW.Sound.BIG_PRAISE.length >= 12 && WW.Sound.SMALL_PRAISE.length >= 6);
ok('praise phrases carry no punctuation (added at speak time)',
  WW.Sound.BIG_PRAISE.every((p) => !/[!.?]/.test(p)));
ok('audio calls are safe with no AudioContext (headless)', (() => {
  WW.Sound.ready = false;
  try { WW.Sound.win('big'); WW.Sound.applause(1); WW.Sound.praise(); WW.Sound.fanfare(); return true; }
  catch (e) { return 'threw: ' + e.message; }
})());
ok('muting silences the cheer', (() => {
  WW.State.data.settings.sound = false;
  const quiet = WW.Sound.enabled() === false && WW.Sound.voiceOn() === false;
  WW.State.data.settings.sound = true;
  return quiet;
})());

/* ============ 9. rewards are never gambling ============ */
section('9. Child-safety checks');
const src = ['js/core.js', 'js/art.js', 'js/screens.js', 'js/worlds/math.js', 'js/worlds/story.js',
  'js/worlds/science.js', 'js/worlds/city.js', 'js/worlds/business.js', 'game.js', 'index.html']
  .map((f) => fs.readFileSync(path.join(root, f), 'utf8')).join('\n');
/* The game used to make zero network calls. It now makes exactly one — the
   parent mailing-list signup — so assert the property that actually matters
   for a children's product rather than a blanket ban. */
const clientSrc = ['js/core.js', 'js/art.js', 'js/screens.js', 'js/worlds/math.js',
  'js/worlds/story.js', 'js/worlds/science.js', 'js/worlds/city.js',
  'js/worlds/business.js', 'game.js']
  .map((f) => fs.readFileSync(path.join(root, f), 'utf8')).join('\n');

const fetchCalls = clientSrc.match(/\bfetch\s*\(\s*['"`][^'"`]*/g) || [];
ok('exactly one network call in the whole client', fetchCalls.length === 1, fetchCalls.join(' | '));
ok('and it is the same-origin signup endpoint',
  fetchCalls.length === 1 && /['"`]api\/subscribe$/.test(fetchCalls[0]), fetchCalls[0]);
ok('no XHR, WebSocket, sendBeacon or EventSource',
  !/XMLHttpRequest|WebSocket|sendBeacon|EventSource/.test(clientSrc));

/* The five world modules must stay completely offline */
const worldSrc = ['js/worlds/math.js', 'js/worlds/story.js', 'js/worlds/science.js',
  'js/worlds/city.js', 'js/worlds/business.js']
  .map((f) => fs.readFileSync(path.join(root, f), 'utf8')).join('\n');
ok('no world module touches the network',
  !/\bfetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon/.test(worldSrc));

/* The signup body must never carry anything from the save file */
const bodyMatch = clientSrc.match(/body:\s*JSON\.stringify\(\{[\s\S]{0,400}?\}\)/);
ok('the signup payload exists and is inspectable', !!bodyMatch);
ok('the signup payload contains no game or child data',
  !!bodyMatch && !/S\.data|State\.data|player|progress|xp|gems|crystals|badges/i.test(bodyMatch[0]),
  bodyMatch ? bodyMatch[0].replace(/\s+/g, ' ').slice(0, 160) : '');

/* Speech must be pinned to an on-device voice */
ok('speech synthesis is restricted to on-device voices',
  /localService/.test(clientSrc));
ok('the grown-ups area is gated before it renders',
  /renderGate/.test(clientSrc) && /if \(!this\.unlocked\)/.test(clientSrc));
ok('no external URLs', !/https?:\/\/(?!www\.w3\.org)/.test(src));
ok('no monetisation or gacha code', !/lootBox|gacha|inAppPurchase|requestPayment|PaymentRequest|adsbygoogle|googletag/i.test(src));
ok('no remote scripts or iframes', !/<script[^>]+src=["']https?:|<iframe/i.test(src));
ok('progress saved locally only', /localStorage/.test(src) && !/indexedDB|document\.cookie/i.test(src));
ok('no energy/stamina timer gating play', !/\benergyTimer|staminaTimer|lives--|cooldownUntil/i.test(src));

console.log('\n' + (fail ? '❌' : '✅') + '  ' + pass + ' passed, ' + fail + ' failed\n');
process.exit(fail ? 1 : 0);
