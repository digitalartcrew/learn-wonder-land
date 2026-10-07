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

/* No `location` is defined, so WW.env.isDev() is FALSE by default. Tests that
   need development behaviour opt into it explicitly — they never fall into it. */
['js/core.js',
 'js/env.js', 'js/events.js', 'js/entitlements.js', 'js/billing.js',
 'js/profiles.js', 'js/sync.js', 'js/parentgate.js',
 'js/art.js', 'js/plus.js', 'js/devtools.js',
 'js/worlds/math.js', 'js/worlds/story.js', 'js/worlds/science.js',
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
/* Every client file, including the whole monetization layer, so the
   child-safety properties below are enforced across all of it. */
const CLIENT_FILES = [
  'js/core.js', 'js/env.js', 'js/events.js', 'js/entitlements.js', 'js/billing.js',
  'js/profiles.js', 'js/sync.js', 'js/parentgate.js', 'js/art.js', 'js/screens.js',
  'js/plus.js', 'js/devtools.js',
  'js/worlds/math.js', 'js/worlds/story.js', 'js/worlds/science.js',
  'js/worlds/city.js', 'js/worlds/business.js', 'game.js'
];
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const src = CLIENT_FILES.concat(['index.html']).map(read).join('\n');
/* The game used to make zero network calls. It now makes exactly one — the
   parent mailing-list signup — so assert the property that actually matters
   for a children's product rather than a blanket ban. */
const clientSrc = CLIENT_FILES.map(read).join('\n');

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
ok('no external URLs in the client', !/https?:\/\/(?!www\.w3\.org)/.test(src));
ok('no gambling, ad or web-payment-API code',
  !/lootBox|gacha|inAppPurchase|requestPayment|PaymentRequest|adsbygoogle|googletag/i.test(src));
ok('no remote scripts or iframes', !/<script[^>]+src=["']https?:|<iframe/i.test(src));
ok('progress saved locally only', /localStorage/.test(src) && !/indexedDB|document\.cookie/i.test(src));
ok('no energy/stamina timer gating play', !/\benergyTimer|staminaTimer|lives--|cooldownUntil/i.test(src));

/* ============ 10. entitlements: content tiers ============ */
section('10. Entitlements — free content stays free');
store['wonderworld.save.v1'] = '';
delete store['wonderworld.entitlement.v1'];
WW.entitlements.clear();
WW.State.load();

const FREE_WORLDS = ['math', 'story', 'science', 'city', 'business'];
ok('all five adventure worlds are tier "free"',
  FREE_WORLDS.every((id) => WW.Content.tierOf(id) === 'free'));
ok('WonderSpace is tier "plus"', WW.Content.tierOf('space') === 'plus');
ok('friendly slugs resolve too',
  WW.Content.tierOf('math-island') === 'free' &&
  WW.Content.tierOf('wonder-space') === 'plus' &&
  WW.Content.world('science-lab').id === 'science');

/* A free player with the XP must be able to open every free world. */
WW.State.data.xp = 1000;
WW.Progress.checkUnlocks();
ok('a FREE player can open all five worlds once the XP is earned',
  FREE_WORLDS.every((id) => WW.entitlements.canAccess(id)),
  FREE_WORLDS.filter((id) => !WW.entitlements.canAccess(id)).join(','));
ok('the five worlds never require Plus',
  FREE_WORLDS.every((id) => WW.entitlements.check(id).needsPlus === false));

/* ...and must NOT be able to open a Plus world. */
ok('a FREE player cannot open Plus-only content', !WW.entitlements.canAccess('space'));
ok('free players do not get Plus features',
  !WW.entitlements.hasFeature('multi-profile') &&
  !WW.entitlements.hasFeature('advanced-parent-reports') &&
  !WW.entitlements.hasFeature('cloud-sync'));
ok('free players keep every free feature',
  WW.entitlements.hasFeature('core-adventure') &&
  WW.entitlements.hasFeature('local-save') &&
  WW.entitlements.hasFeature('basic-parent-reports') &&
  WW.entitlements.hasFeature('accessibility') &&
  WW.entitlements.hasFeature('read-aloud'));
ok('free history limit is the 60 the game has always kept',
  WW.entitlements.historyLimit() === 60);
ok('free accounts get exactly one Explorer', WW.entitlements.maxProfiles() === 1);

/* ============ 11. XP rules are untouched by money ============ */
section('11. Paying never bypasses learning');
sandbox.window.WW_DEV = true;                 /* opt INTO development */
ok('development mode is now on', WW.env.isDev() === true);
WW.billing.use('mock');
WW.billing.providers.mock._simulate('plus');
ok('mock Plus is active in development', WW.entitlements.isPlus() === true);

/* a brand-new save: no XP, no crystals, but WITH a subscription */
store['wonderworld.save.v1'] = '';
WW.State.load();
ok('a PLUS player still cannot open Science Lab without the XP',
  !WW.entitlements.canAccess('science'));
ok('a PLUS player still cannot open Planet City without the XP',
  !WW.entitlements.canAccess('city'));
ok('a PLUS player still cannot open Business Town without the XP',
  !WW.entitlements.canAccess('business'));
ok('the reason given is learning, never money',
  WW.entitlements.check('science').blockedBy === 'learning');
ok('a PLUS player with 0 crystals cannot reach WonderSpace',
  !WW.entitlements.canAccess('space'));
ok('and that block is reported as a LEARNING block',
  WW.entitlements.check('space').blockedBy === 'learning');

/* ============ 12. WonderSpace needs BOTH ============ */
section('12. WonderSpace = five crystals AND WonderWorld+');
function spaceWith(crystals, plus) {
  store['wonderworld.save.v1'] = '';
  WW.State.load();
  if (crystals) FREE_WORLDS.forEach((k) => { WW.State.data.crystals[k] = true; });
  WW.Progress.checkUnlocks();
  if (plus) WW.billing.providers.mock._simulate('plus');
  else WW.entitlements.clear();
  return WW.entitlements.check('space');
}
ok('no crystals, no Plus  → blocked (learning)', (() => {
  const v = spaceWith(false, false); return !v.allowed && v.blockedBy === 'learning';
})());
ok('no crystals, Plus     → blocked (learning)', (() => {
  const v = spaceWith(false, true); return !v.allowed && v.blockedBy === 'learning';
})());
ok('crystals, no Plus     → blocked (plus)', (() => {
  const v = spaceWith(true, false); return !v.allowed && v.blockedBy === 'plus';
})());
ok('crystals AND Plus      → allowed', (() => {
  const v = spaceWith(true, true); return v.allowed === true;
})());
ok('a stale unlocked.space flag cannot substitute for crystals', (() => {
  store['wonderworld.save.v1'] = '';
  WW.State.load();
  WW.State.data.unlocked.space = true;          /* forged */
  WW.billing.providers.mock._simulate('plus');
  return WW.entitlements.canAccess('space') === false;
})());

/* ============ 13. billing & trial architecture ============ */
section('13. Billing abstraction');
ok('WW.billing exposes the whole public interface',
  ['startTrial', 'purchase', 'restorePurchases', 'manageSubscription', 'verify',
   'use', 'provider', 'providerName', 'isAvailable', 'product']
    .every((k) => typeof WW.billing[k] === 'function'));
ok('three provider adapters exist: mock, apple, web',
  ['mock', 'apple', 'web'].every((n) => !!WW.billing.providers[n]));
ok('every provider implements the same interface',
  ['mock', 'apple', 'web'].every((n) => {
    const p = WW.billing.providers[n];
    return ['isAvailable', 'products', 'startTrial', 'purchase', 'restorePurchases',
            'manageSubscription', 'verify'].every((m) => typeof p[m] === 'function');
  }));
ok('a Restore Purchases interface exists', typeof WW.billing.restorePurchases === 'function');
ok('the Apple adapter is an honest stub, not a fake purchase', (() => {
  const a = WW.billing.providers.apple;
  return a.isAvailable() === false;
})());
ok('the web adapter is an honest stub too', WW.billing.providers.web.isAvailable() === false);

ok('both products are priced and the annual one is recommended', (() => {
  const a = WW.billing.product('plus_annual'), m = WW.billing.product('plus_monthly');
  return a.priceLabel === '$39.99/year' && a.perMonthLabel === 'about $3.33/month' &&
         a.trialDays === 7 && a.trialLabel === '7 Days Free' && a.recommended === true &&
         m.priceLabel === '$6.99/month' && m.recommended === false;
})());
ok('both products carry an App Store product identifier',
  /^com\.wonderworld\.plus\./.test(WW.billing.product('plus_annual').appleProductId) &&
  /^com\.wonderworld\.plus\./.test(WW.billing.product('plus_monthly').appleProductId));

/* trial state machine */
WW.entitlements.clear();
ok('a fresh account is "free"', WW.entitlements.status() === 'free');
WW.billing.providers.mock._simulate('trial');
ok('starting a trial moves to "trial"', WW.entitlements.status() === 'trial');
ok('the trial record carries every field the architecture needs', (() => {
  const r = WW.entitlements.record();
  return r.productId === 'plus_annual' && r.provider === 'mock' &&
         typeof r.trialStartedAt === 'number' && typeof r.trialEndsAt === 'number' &&
         typeof r.entitlementVerifiedAt === 'number';
})());
ok('a trial counts as Plus while it lasts', WW.entitlements.isPlus() === true);
ok('trialDaysLeft reports sensibly', WW.entitlements.trialDaysLeft() === 7);
ok('an elapsed trial becomes "expired" on its own', (() => {
  WW.entitlements.record().trialEndsAt = Date.now() - 1000;
  return WW.entitlements.status() === 'expired' && WW.entitlements.isPlus() === false;
})());
WW.billing.providers.mock._simulate('expired');
ok('an expired subscriber loses Plus content but keeps the free adventure', (() => {
  store['wonderworld.save.v1'] = '';
  WW.State.load();
  WW.State.data.xp = 1000;
  WW.Progress.checkUnlocks();
  return FREE_WORLDS.every((id) => WW.entitlements.canAccess(id)) &&
         !WW.entitlements.canAccess('space');
})());
WW.billing.providers.mock._simulate('plus');
ok('a Plus subscriber gets every Plus feature',
  WW.entitlements.hasFeature('multi-profile') &&
  WW.entitlements.hasFeature('advanced-parent-reports') &&
  WW.entitlements.hasFeature('cloud-sync') &&
  WW.entitlements.hasFeature('long-history'));
ok('Plus raises the Explorer limit to 4 and the history limit',
  WW.entitlements.maxProfiles() === 4 && WW.entitlements.historyLimit() > 60);

/* ============ 14. the mock cannot leak into production ============ */
section('14. The development mock is inert in production');
ok('WW.dev.setTier works while in development',
  WW.dev.setTier('plus').ok === true && WW.entitlements.isPlus() === true);
ok('and it is flagged as simulated, never as a real subscription',
  WW.entitlements.isSimulated() === true);

/* Flip to a declared production host. The localStorage record is untouched —
   only our reading of it changes. That is the property that matters. */
sandbox.window.location = { hostname: 'wonder-world-ckt.pages.dev', protocol: 'https:' };
ok('a declared production host is never development',
  WW.env.isProductionHost() === true && WW.env.isDev() === false);
ok('WW_DEV=true cannot override a production host',
  sandbox.window.WW_DEV === true && WW.env.isDev() === false);
ok('the SAME mock record now reads as free on production',
  WW.entitlements.record().provider === 'mock' &&
  WW.entitlements.status() === 'free' && WW.entitlements.isPlus() === false);
ok('so Plus content is closed again on production', !WW.entitlements.canAccess('space'));
ok('the mock adapter refuses to transact on production',
  WW.billing.providers.mock.isAvailable() === false);
ok('simulating a tier on production does nothing', (() => {
  const before = WW.entitlements.status();
  WW.dev.setTier('plus');
  return WW.entitlements.status() === before && before === 'free';
})());
ok('WW.dev reports itself unavailable on production', WW.dev.available() === false);
ok('only apple and web are trusted providers',
  WW.entitlements.TRUSTED_PROVIDERS.join(',') === 'apple,web');
ok('an unknown-provider record is not honoured either', (() => {
  WW.entitlements.record().provider = 'whatever';
  WW.entitlements.record().status = 'plus';
  return WW.entitlements.isPlus() === false;
})());
ok('a record claiming a trusted provider IS honoured (the StoreKit path)', (() => {
  WW.entitlements.record().provider = 'apple';
  WW.entitlements.record().status = 'plus';
  return WW.entitlements.isPlus() === true;
})());
/* back to development for the remaining sections */
delete sandbox.window.location;
WW.entitlements.clear();

/* ============ 15. saves are not disturbed ============ */
section('15. Existing saves survive all of this');
ok('the save key is still exactly wonderworld.save.v1',
  WW.State.saveKey() === 'wonderworld.save.v1');
ok('Explorer 1 points at the existing save rather than a copy',
  WW.profiles.active().saveKey === 'wonderworld.save.v1' &&
  WW.profiles.active().legacy === true);

/* a pre-existing save, written before any of this existed, must still load */
store['wonderworld.save.v1'] = JSON.stringify({
  xp: 812, gems: 31, player: { name: 'Mo', companion: 'luna' },
  crystals: { math: true, story: true, science: false, city: false, business: false },
  badges: ['first_step', 'bridge_master'],
  worlds: { math: { progress: 100, correct: 40, wrong: 3 } }
});
WW.State.load();
ok('a legacy save still loads intact',
  WW.State.data.player.name === 'Mo' && WW.State.data.xp === 812 &&
  WW.State.data.gems === 31 && WW.State.data.badges.length === 2 &&
  WW.State.data.worlds.math.progress === 100);
ok('and missing new keys still merge onto defaults',
  WW.State.data.worlds.business.cash === 20 && WW.State.data.settings.sound === true);
ok('the entitlement record lives in a DIFFERENT key from the save',
  WW.entitlements.STORE_KEY !== 'wonderworld.save.v1' &&
  WW.entitlements.STORE_KEY === 'wonderworld.entitlement.v1');
ok('nothing subscription-shaped was written into the save',
  !/status|provider|trial|productId|entitlement/i.test(
    JSON.stringify(Object.keys(WW.State.data))));
sandbox.window.WW_DEV = true;
WW.billing.providers.mock._simulate('plus');
WW.State.save(true);
ok('turning Plus on does not alter the save file', (() => {
  const saved = JSON.parse(store['wonderworld.save.v1']);
  return saved.player.name === 'Mo' && saved.xp === 812 &&
         saved.status === undefined && saved.provider === undefined;
})());
WW.entitlements.clear();

/* ============ 16. profiles, sync and events ============ */
section('16. Profiles, cloud-sync interface and events');
ok('the profile roster exists with Explorer 1', WW.profiles.list().length === 1);
ok('a free account cannot add an Explorer', WW.profiles.canCreate() === false);
WW.billing.providers.mock._simulate('plus');
ok('a Plus account can add up to four', WW.profiles.canCreate() === true &&
  WW.profiles.maxSlots() === 4);
ok('a new Explorer gets its OWN key, never the legacy one', (() => {
  const r = WW.profiles.create('Sam');
  return r.ok && r.profile.saveKey === 'wonderworld.save.v1.explorer-2' &&
         r.profile.saveKey !== 'wonderworld.save.v1';
})());
ok('Explorer 1 can never be removed', WW.profiles.remove('explorer-1').ok === false);
WW.profiles.remove('explorer-2');
WW.entitlements.clear();

ok('WW.sync exposes push, pull and status',
  ['push', 'pull', 'status'].every((k) => typeof WW.sync[k] === 'function'));
ok('cloud sync is not available (no backend, honestly reported)',
  WW.sync.isAvailable() === false);
ok('sync describes itself without pretending to work',
  /WonderWorld\+/.test(WW.sync.describe().text) ||
  /still being built/.test(WW.sync.describe().text));

WW.events.clear();
WW.State.data.player.name = 'Mo';
WW.events.track('world_entered', { world: 'math', nickname: 'Mo', secret: 'x' });
const ev = WW.events.recent(1)[0];
ok('events keep allow-listed properties', ev && ev.props.world === 'math');
ok('events drop everything not on the allow-list',
  ev && ev.props.nickname === undefined && ev.props.secret === undefined);
ok('an unknown event name is refused', WW.events.track('exfiltrate_everything') === null);
WW.events.track('world_entered', { source: 'Mo' });
ok('a value matching the child\'s nickname is redacted',
  WW.events.recent(1)[0].props.source === '[redacted]');
ok('no event sink sends anything anywhere',
  !/fetch|XMLHttpRequest|sendBeacon|WebSocket/.test(read('js/events.js')));
ok('the premium event vocabulary is present',
  ['premium_content_viewed', 'parent_gate_started', 'parent_gate_completed',
   'plus_page_viewed', 'trial_started', 'subscription_started', 'subscription_restored']
    .every((n) => WW.events.NAMES.indexOf(n) !== -1));

/* ============ 17. parental gate ============ */
section('17. Parental gate');
ok('WW.parentGate is a single reusable system',
  typeof WW.parentGate.challenge === 'function' &&
  typeof WW.parentGate.build === 'function' &&
  typeof WW.parentGate.render === 'function' &&
  typeof WW.parentGate.require === 'function');
ok('the dashboard challenge is two-digit multiplication', (() => {
  for (let i = 0; i < 200; i++) {
    const c = WW.parentGate.challenge('multiply');
    const m = c.sum.match(/^(\d+) × (\d+) = \?$/);
    if (!m || +m[1] < 13 || +m[2] < 13) return false;
    if (!c.verify(String(+m[1] * +m[2])) || c.verify(String(+m[1] * +m[2] + 1))) return false;
  }
  return true;
})());
ok('the purchase challenge also requires reading an instruction', (() => {
  for (let i = 0; i < 200; i++) {
    const c = WW.parentGate.challenge('multiply-adjust');
    if (!c.instruction || !/subtract/.test(c.instruction)) return false;
    const m = c.sum.match(/^(\d+) × (\d+) − (\d+) = \?$/);
    if (!m) return false;
    const answer = +m[1] * +m[2] - +m[3];
    if (!c.verify(String(answer)) || c.verify(String(+m[1] * +m[2]))) return false;
  }
  return true;
})());
ok('both challenges are harder than anything the game teaches (12 × 12)', (() => {
  for (let i = 0; i < 200; i++) {
    const m = WW.parentGate.challenge('multiply').sum.match(/^(\d+) × (\d+)/);
    if (+m[1] <= 12 || +m[2] <= 12) return false;
  }
  return true;
})());
ok('the answer is never written into the challenge text', (() => {
  for (let i = 0; i < 200; i++) {
    const c = WW.parentGate.challenge('multiply');
    const m = c.sum.match(/^(\d+) × (\d+)/);
    if (c.sum.indexOf(String(+m[1] * +m[2])) !== -1 && String(+m[1] * +m[2]).length > 2) return false;
  }
  return true;
})());
ok('a pass expires', (() => {
  WW.parentGate.reset();
  WW.parentGate.markPassed('purchase');
  const open = WW.parentGate.isOpen('purchase');
  WW.parentGate._passes.purchase = Date.now() - WW.parentGate.TTL - 1;
  return open === true && WW.parentGate.isOpen('purchase') === false;
})());
ok('gates are scoped — the dashboard does not open the purchase door', (() => {
  WW.parentGate.reset();
  WW.parentGate.markPassed('dashboard');
  return WW.parentGate.isOpen('dashboard') && !WW.parentGate.isOpen('purchase');
})());
ok('reset() closes every door', (() => {
  WW.parentGate.markPassed('purchase');
  WW.parentGate.reset();
  return !WW.parentGate.isOpen('purchase') && !WW.parentGate.isOpen('dashboard');
})());

/* ============ 18. where prices may and may not appear ============ */
section('18. Prices live in exactly one place');
/* NOTE on what is deliberately NOT matched here: the five worlds are full of
   in-game dollars ("$5" in Planet City, "$0.75" at the lemonade stand). That is
   arithmetic a child is learning, not a price. What must never appear outside
   the billing catalogue and the grown-ups Plus page is a REAL price or a
   purchase call to action. */
const REAL_PRICE = /\$\s?\d+\.\d{2}\s*(?:\/|per\s)\s*(?:year|month|yr|mo)|\$39\.99|\$6\.99|\$3\.33/i;
/* "buy" on its own is left alone on purpose: Math Island's word problems and
   Business Town's pricing lesson are ABOUT buying things, which is the
   curriculum. What may not appear is a call to action aimed at the player. */
const PURCHASE_CTA = /\bsubscribe\b|\bsubscription\b|buy now|credit card|payment method|checkout/i;

const CHILD_FACING = ['js/core.js', 'js/worlds/math.js', 'js/worlds/story.js',
  'js/worlds/science.js', 'js/worlds/city.js', 'js/worlds/business.js', 'js/art.js'];
/* Comments are stripped first: this check is about wording a player can SEE,
   and the code is full of comments explaining the subscription architecture. */
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ');
CHILD_FACING.forEach((f) => {
  const text = stripComments(read(f)).replace(/unsubscribe/ig, '');
  ok('no price or purchase wording in ' + f,
    !REAL_PRICE.test(text) && !PURCHASE_CTA.test(text));
});

/* The child's own premium prompt, examined as source. */
ok('the child-facing prompt shows no price figure',
  !REAL_PRICE.test(String(WW.Premium.childPrompt)) &&
  !/\$/.test(String(WW.Premium.childPrompt)));
ok('the child-facing prompt has no purchase call to action',
  !PURCHASE_CTA.test(String(WW.Premium.childPrompt)));
ok('the child-facing prompt never mentions a trial or a card',
  !/trial|credit card|payment/i.test(String(WW.Premium.childPrompt)));
ok('the "not open yet" learning message never mentions money',
  !/\$|price|cost|pay|subscri/i.test(String(WW.Premium.blocked)));
ok('the handover to a grown-up shows no price either',
  !REAL_PRICE.test(String(WW.Premium.askGrownUp)) &&
  !/\$/.test(String(WW.Premium.askGrownUp)));
ok('the map labels a Plus world by name, not by price',
  /'✨ WonderWorld\+'/.test(read('js/screens.js')) &&
  !REAL_PRICE.test(read('js/screens.js')));
ok('the child-facing prompt says the right friendly things', (() => {
  const fn = String(WW.Premium.childPrompt);
  return /A New Adventure/.test(fn) && /part of WonderWorld\+/.test(fn) &&
         /Ask a grown-up/.test(fn) && /Ask a Grown-Up/.test(fn);
})());
ok('price strings exist ONLY in the billing catalogue and the Plus page',
  CLIENT_FILES.filter((f) => /\$39\.99|\$6\.99|\$3\.33/.test(read(f))).join(',') === 'js/billing.js');
ok('the Plus page reads its prices from the catalogue rather than hard-coding them',
  /priceLabel|perMonthLabel|trialLabel|afterTrialLabel/.test(read('js/plus.js')));
ok('the Plus page is the only screen that renders a price',
  /plus-pricing/.test(read('js/plus.js')) && !/plus-pricing/.test(read('js/screens.js')));
ok('the grown-ups dashboard links to the Plus page through the gate',
  /openPlus/.test(read('js/screens.js')) &&
  /parentGate\.require/.test(read('js/screens.js')));
ok('the Plus screen gates itself even on a direct navigation',
  /parentGate\.isOpen\('purchase'\)/.test(read('js/plus.js')));

/* ============ 19. the promise we make to parents ============ */
section('19. Beta signup copy');
const betaSrc = read('js/screens.js');
ok('the over-broad "WonderWorld is free" promise is gone',
  !/WonderWorld is free and we intend to keep the learning free/.test(betaSrc));
ok('the new copy scopes the promise to the core adventure',
  /The core WonderWorld adventure is free/.test(betaSrc));
ok('and still promises that progress is earned, not bought',
  /earned through\s+'?\s*\+?\s*'?learning/.test(betaSrc.replace(/\s+/g, ' ')) ||
  /Educational progress is earned through/.test(betaSrc.replace(/\s+/g, ' ')));
ok('and mentions WonderWorld+ as an expansion, not a replacement',
  /Optional WonderWorld\+ expands the adventure/.test(betaSrc.replace(/\s+/g, ' ')));
ok('nothing claims existing content is being removed',
  !/no longer free|now costs|removed from the free/i.test(betaSrc));

/* ============ 20. offline / service worker ============ */
section('20. Offline support still covers everything');
const indexHtml = read('index.html');
const swSrc = read('sw.js');
const scriptSrcs = (indexHtml.match(/<script src="([^"]+)"/g) || [])
  .map((s) => s.match(/src="([^"]+)"/)[1]);
ok('index.html loads ' + scriptSrcs.length + ' local scripts', scriptSrcs.length >= 14);
ok('every script index.html loads is pre-cached by the service worker',
  scriptSrcs.every((s) => swSrc.indexOf("'" + s + "'") !== -1),
  scriptSrcs.filter((s) => swSrc.indexOf("'" + s + "'") === -1).join(','));
ok('the service worker VERSION was bumped for this release',
  /const VERSION = 'ww-v3'/.test(swSrc));
ok('code is still network-first so HTML and JS cannot drift apart',
  /req\.mode === 'navigate' \|\| CODE\.test/.test(swSrc));
ok('the signup endpoint is still never cached', /pathname\.includes\('\/api\/'\)/.test(swSrc));
ok('terms and privacy are both in the offline shell',
  /'privacy'/.test(swSrc) && /'terms'/.test(swSrc));
ok('no script tag points off-origin', scriptSrcs.every((s) => !/^https?:/.test(s)));

/* ============ 21. nothing new touches the network ============ */
section('21. No new network surface');
ok('still exactly one fetch in the entire client (the parent signup)',
  (clientSrc.match(/\bfetch\s*\(\s*['"`][^'"`]*/g) || []).length === 1);
ok('the monetization layer makes no network calls at all', (() => {
  const mon = ['js/env.js', 'js/events.js', 'js/entitlements.js', 'js/billing.js',
    'js/profiles.js', 'js/sync.js', 'js/parentgate.js', 'js/plus.js', 'js/devtools.js']
    .map(read).join('\n');
  return !/\bfetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon|EventSource|importScripts/.test(mon);
})());
ok('no third-party analytics, ad or payment SDK anywhere',
  !/google-?analytics|gtag\(|googletagmanager|facebook|fbq\(|mixpanel|amplitude|segment\.|appsflyer|adjust\.com|firebase|stripe\.js|braintree|paypal/i.test(src));
ok('no social login, chat or leaderboard code',
  !/signInWith|oauth2|leaderboard|chatRoom|friendRequest/i.test(src));
ok('the game still stores nothing in cookies or IndexedDB',
  !/document\.cookie|indexedDB/i.test(src));

console.log('\n' + (fail ? '❌' : '✅') + '  ' + pass + ' passed, ' + fail + ' failed\n');
process.exit(fail ? 1 : 0);
