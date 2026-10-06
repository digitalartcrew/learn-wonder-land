/* =============================================================
   WonderWorld — tools/browser-test.js
   Drives the real game in a headless browser the way a child
   would: tapping buttons, answering questions, building things.

   Usage:
     npx http-server -p 8111 .        (or any static server)
     node tools/browser-test.js http://localhost:8111
   ============================================================= */
'use strict';
const path = require('path');
const { chromium } = require(process.env.PW || '/tmp/node_modules/playwright-core');

const BASE = process.argv[2] || 'http://localhost:8111';
const SHOTS = path.join(__dirname, '..', '.shots');
let pass = 0, fail = 0;
const errors = [];

function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  ✅ ' + name); }
  else { fail++; console.log('  ❌ ' + name + (extra ? '  → ' + extra : '')); }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch(
    process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});

  /* iPhone 13-ish viewport, touch enabled */
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3, isMobile: true, hasTouch: true
  });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

  /* Celebration modals (level up, new world, teaching cards) can stack on top
     of the screen. A child taps them away; so does the test. */
  const clearModals = async () => {
    for (let i = 0; i < 6; i++) {
      const open = await page.locator('#modal-layer.show').isVisible().catch(() => false);
      if (!open) return;
      await page.locator('#modal-actions button').first().click();
      await sleep(320);
    }
  };
  const tapText = async (text, insideModal) => {
    if (!insideModal) await clearModals();
    const el = page.locator(`button:has-text("${text}")`).first();
    await el.waitFor({ state: 'visible', timeout: 5000 });
    await el.click();
    await sleep(140);
  };

  /* The grown-ups area sits behind an adult check now. Solve it the way a
     parent would: read the sum off the screen and type the answer. */
  const passAdultGate = async () => {
    const sum = await page.locator('.gate-sum').textContent().catch(() => null);
    if (!sum) return false;
    const m = sum.match(/(\d+)\s*×\s*(\d+)/);
    await page.fill('.gate-input', String(+m[1] * +m[2]));
    await page.locator('.gate-card button:has-text("Enter")').click();
    await sleep(500);
    return true;
  };

  console.log('\n— Boot & title —');
  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  await sleep(600);
  ok('title screen is visible', await page.locator('#screen-title.active').isVisible());
  ok('logo renders', (await page.locator('.logo').textContent()).includes('WonderWorld'));
  ok('Knowledge Tree art drew on the title', await page.locator('#title-tree svg').count() === 1);
  ok('a start button is offered', await page.locator('#title-buttons button').count() >= 1);
  await page.screenshot({ path: path.join(SHOTS, '01-title-iphone.png') });

  console.log('\n— Character creator —');
  await tapText('Start a New Adventure');
  await sleep(400);
  ok('creator screen opened', await page.locator('#screen-create.active').isVisible());
  ok('6 skin tones offered', await page.locator('#opt-skin .swatch').count() === 6);
  ok('6 hair styles offered', await page.locator('#opt-hair .chip').count() === 6);
  ok('5 companions offered', await page.locator('#opt-companion .companion-card').count() === 5);

  /* try to start with no name — should be blocked kindly */
  await tapText('Start the Adventure');
  await sleep(300);
  ok('empty name is refused (no crash, stays on creator)',
    await page.locator('#screen-create.active').isVisible());

  await page.fill('#input-name', 'Ada');
  await page.locator('#opt-skin .swatch').nth(3).click(); await sleep(150);
  await page.locator('#opt-hair .chip').nth(2).click(); await sleep(150);
  await page.locator('#opt-haircolor .swatch').nth(5).click(); await sleep(150);
  await page.locator('#opt-outfit .chip').nth(4).click(); await sleep(150);
  await page.locator('#opt-companion .companion-card').nth(1).click(); await sleep(150);
  ok('name survived the option re-renders', await page.inputValue('#input-name') === 'Ada');
  ok('preview name updated', (await page.locator('#create-previewname').textContent()) === 'Ada');
  await page.screenshot({ path: path.join(SHOTS, '02-creator-iphone.png') });

  await tapText('Start the Adventure');
  await sleep(500);
  ok('welcome celebration appeared', await page.locator('#modal-layer.show').isVisible());
  await tapText('To the map!', true);
  await sleep(600);

  console.log('\n— World map —');
  ok('map is showing', await page.locator('#screen-map.active').isVisible());
  ok('7 map nodes (5 worlds + space + tree)', await page.locator('.map-node').count() === 7);
  ok('HUD is visible with the player name',
    (await page.locator('#hud-playername').textContent()) === 'Ada');
  ok('adventure trail was drawn', await page.locator('#map-paths path').count() >= 1);
  ok('locked worlds are marked', await page.locator('.map-node.locked').count() >= 3);
  await page.screenshot({ path: path.join(SHOTS, '03-map-iphone.png') });

  /* locked world should explain itself, not just do nothing */
  await page.locator('.map-node.locked').first().click();
  await sleep(350);
  ok('tapping a locked world explains why', await page.locator('#modal-layer.show').isVisible());
  await page.locator('#modal-actions button').first().click();
  await sleep(300);

  console.log('\n— Math Island —');
  await page.locator('.map-node[data-world="math"]').click();
  await sleep(500);
  ok('Math Island opened', await page.locator('#screen-math.active').isVisible());
  ok('topic chips offered', await page.locator('.topic-chip').count() === 9);
  await tapText('Start the bridge!');
  await sleep(500);
  ok('bridge scene rendered', await page.locator('.bridge-scene').isVisible());
  ok('8 planks laid out', await page.locator('.plank').count() === 8);

  /* answer all 8 correctly, reading the answer from game state */
  let visualCount = 0;
  for (let i = 0; i < 8; i++) {
    await page.waitForSelector('.choice:not([disabled])', { timeout: 5000 });
    const info = await page.evaluate(() => ({
      answer: WW.Worlds.math.run.q.answer,
      hasVisual: !!WW.Worlds.math.run.q.visual,
      text: WW.Worlds.math.run.q.text
    }));
    if (info.hasVisual) visualCount++;
    const btn = page.locator(`.choice[data-val="${info.answer.replace(/"/g, '\\"')}"]`).first();
    await btn.click();
    await sleep(1150);
  }
  ok('every question had a visible answer button', true);
  ok('some questions used pictures, not just digits', visualCount > 0);
  await sleep(600);
  await clearModals();
  ok('bridge completed and results shown', await page.locator('.result-card').isVisible());
  const afterMath = await page.evaluate(() => ({
    xp: WW.State.data.xp, gems: WW.State.data.gems,
    progress: WW.State.data.worlds.math.progress,
    diff: WW.State.data.worlds.math.diff,
    stars: WW.State.data.worlds.math.bestStars,
    badges: WW.State.data.badges.slice()
  }));
  ok('XP was earned (' + afterMath.xp + ')', afterMath.xp > 0);
  ok('gems were earned (' + afterMath.gems + ')', afterMath.gems > 0);
  ok('math progress advanced to ' + afterMath.progress + '%', afterMath.progress === 25);
  ok('difficulty adapted upward (' + afterMath.diff.toFixed(2) + ')', afterMath.diff > 1.2);
  ok('3 stars for a perfect run', afterMath.stars === 3);
  ok('Bridge Master badge awarded', afterMath.badges.includes('bridge_master'));
  await page.screenshot({ path: path.join(SHOTS, '04-math-result-iphone.png') });

  /* wrong answers must hint, never fail the child */
  await tapText('Cross again');
  await sleep(500);
  const wrongVal = await page.evaluate(() => {
    const q = WW.Worlds.math.run.q;
    return q.choices.find((c) => c !== q.answer);
  });
  await page.locator(`.choice[data-val="${wrongVal}"]`).first().click();
  await sleep(300);
  ok('a wrong answer shows a friendly hint', await page.locator('.hint-note').isVisible());
  ok('the run continues (no game over)', await page.locator('.bridge-scene').isVisible());
  const wrong2 = await page.evaluate(() => {
    const q = WW.Worlds.math.run.q;
    return q.choices.filter((c) => c !== q.answer)[1];
  });
  if (wrong2) {
    await page.locator(`.choice[data-val="${wrong2}"]`).first().click();
    await sleep(300);
    ok('after a second miss the answer is revealed to tap', await page.locator('.choice.reveal').count() === 1);
  }

  console.log('\n— Story Forest —');
  await page.evaluate(() => { WW.Worlds.math.run = null; WW.Nav.go('story'); });
  await sleep(500);
  await clearModals();
  ok('Story Forest opened', await page.locator('#screen-story.active').isVisible());
  ok('3 chapters listed', await page.locator('.chapter-row').count() === 3);
  ok('chapters 2 & 3 start locked', await page.locator('.chapter-row.locked').count() === 2);
  await page.locator('.chapter-row').first().click();
  await sleep(400);

  /* play the whole chapter: passages + every activity kind */
  const kindsSeen = new Set();
  let storyArtSeen = 0;
  for (let step = 0; step < 40; step++) {
    const state = await page.evaluate(() => {
      const se = WW.Worlds.story.session;
      if (!se) return { done: true };
      const ch = WW.Worlds.story.CHAPTERS[se.chapter];
      const beat = ch.beats[se.beat];
      if (!beat) return { done: true };
      return { done: false, type: beat.type, act: beat.act || null };
    });
    if (state.done) break;

    if (state.type === 'passage') {
      if (await page.locator('.story-art .art-svg').count()) storyArtSeen++;
      await tapText('Next');
      await sleep(250);
      continue;
    }
    kindsSeen.add(state.act.kind);
    const a = state.act;
    if (a.kind === 'phonics' || a.kind === 'rhyme') {
      await page.locator('.choice-word').filter({ hasText: a.answer }).first().click();
    } else if (a.kind === 'vocab' || a.kind === 'comp') {
      await page.locator('.choice-long').filter({ hasText: a.answer }).first().click();
    } else if (a.kind === 'spell') {
      for (const ch of a.word.split('')) {
        await page.locator(`.tile:not(.used):text-is("${ch}")`).first().click();
        await sleep(90);
      }
    } else if (a.kind === 'sentence') {
      for (const w of a.words) {
        await page.locator(`.word-bank .word-chip:not(.used):text-is("${w}")`).first().click();
        await sleep(90);
      }
    }
    await sleep(400);
    await tapText('Keep reading');
    await sleep(250);
  }
  await clearModals();
  ok('chapter 1 played through to the end', await page.locator('.result-card').isVisible());
  ok('spelling, sentence building and comprehension all appeared',
    kindsSeen.has('spell') && kindsSeen.has('sentence') && kindsSeen.has('comp'),
    [...kindsSeen].join(','));
  const storyState = await page.evaluate(() => WW.State.data.worlds.story);
  ok('chapter 1 recorded as finished', storyState.done.includes(0));
  ok('passages were illustrated', storyArtSeen >= 4, 'saw ' + storyArtSeen);
  ok('story progress advanced (' + storyState.progress + '%)', storyState.progress > 30);
  ok('a word was spelled correctly', storyState.spelled >= 1);
  await page.screenshot({ path: path.join(SHOTS, '05-story-iphone.png') });

  /* re-open chapter 1 purely to capture an illustrated passage */
  await page.evaluate(() => WW.Worlds.story.start(0));
  await sleep(500);
  ok('story illustration renders on screen', await page.locator('.story-art .art-svg').isVisible());
  ok('illustration has a screen-reader description',
    ((await page.locator('.story-art .art-svg').getAttribute('aria-label')) || '').length > 25);
  await page.screenshot({ path: path.join(SHOTS, '17-story-art-iphone.png') });
  await page.evaluate(() => { WW.Worlds.story.session = null; WW.Worlds.story.renderHub(); });
  await sleep(300);

  console.log('\n— Science Lab —');
  await page.evaluate(() => { WW.State.data.unlocked.science = true; WW.Nav.go('science'); });
  await sleep(400);
  await clearModals();
  ok('Science Lab opened', await page.locator('#screen-science.active').isVisible());
  ok('3 experiments offered', await page.locator('.lab-row').count() === 3);

  /* plant */
  await page.locator('.lab-row').first().click();
  await sleep(300);
  ok('plant experiment has 3 controls', await page.locator('.stepper').count() === 3);
  await tapText('Grow!');
  await sleep(2600);
  await clearModals();
  ok('plant grew and a finding was recorded', await page.locator('.finding').count() >= 1);
  const plantFound = await page.evaluate(() => WW.State.data.worlds.science.plant.slice());
  ok('a plant discovery was logged (' + plantFound.join(',') + ')', plantFound.length === 1);
  /* change a variable → different outcome */
  await clearModals();
  await page.locator('.stepper').first().locator('.round-btn').first().click(); /* water down */
  await sleep(150);
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('.big-btn')].find(x => x.textContent.includes('Grow'));
    b.click();
  });
  await sleep(2600);
  const plantFound2 = await page.evaluate(() => WW.State.data.worlds.science.plant.slice());
  ok('changing a variable changes the result', plantFound2.length === 2, plantFound2.join(','));
  await page.screenshot({ path: path.join(SHOTS, '06-science-plant-iphone.png') });

  /* magnet */
  await page.evaluate(() => { WW.Worlds.science.open('magnet'); });
  await sleep(300);
  await clearModals();
  ok('10 objects in the magnet tray', await page.locator('.object-cell').count() === 10);
  await page.locator('.object-cell').first().click();
  await sleep(300);
  ok('it asks for a prediction first', await page.locator('#modal-layer.show').isVisible());
  await page.locator('#modal-actions button').first().click();
  await sleep(900);
  ok('magnet result explained', (await page.locator('#magnet-result').textContent()).length > 20);
  ok('object marked as tested', await page.locator('.object-cell.tested').count() === 1);

  /* weather */
  await page.evaluate(() => { WW.Worlds.science.open('weather'); });
  await sleep(300);
  await clearModals();
  ok('weather machine has 3 sliders', await page.locator('.big-slider').count() === 3);
  const weatherMade = await page.evaluate(async () => {
    const setSlider = (i, v) => {
      const el = document.querySelectorAll('.big-slider')[i];
      el.value = v;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    };
    setSlider(0, 30); setSlider(1, 0); setSlider(2, 0);     /* sunny */
    await new Promise(r => setTimeout(r, 60));
    setSlider(1, 80); setSlider(2, 20);                      /* rain */
    await new Promise(r => setTimeout(r, 60));
    setSlider(0, -10); setSlider(1, 60);                     /* snow */
    await new Promise(r => setTimeout(r, 60));
    setSlider(0, 25); setSlider(1, 90); setSlider(2, 80);    /* storm */
    await new Promise(r => setTimeout(r, 60));
    return WW.State.data.worlds.science.weather.slice();
  });
  ok('sun, rain, snow and storm all created', ['sunny', 'rain', 'snow', 'storm']
    .every((k) => weatherMade.includes(k)), weatherMade.join(','));
  await page.screenshot({ path: path.join(SHOTS, '07-science-weather-iphone.png') });

  console.log('\n— Planet City —');
  await page.evaluate(() => { WW.State.data.unlocked.city = true; WW.Nav.go('city'); });
  await sleep(400);
  await clearModals();
  ok('city grid has 20 plots', await page.locator('.city-cell').count() === 20);
  ok('8 building types offered', await page.locator('.build-btn').count() === 8);

  /* tapping a plot with nothing selected should guide, not crash */
  await page.locator('.city-cell').first().click();
  await sleep(200);
  ok('tapping an empty plot with no selection is handled', !errors.length);

  const cityBefore = await page.evaluate(() => WW.Worlds.city.stats());
  await page.locator('.build-btn').first().click();     /* tree */
  await sleep(200);
  await page.locator('.city-cell').first().click();
  await sleep(500);
  ok('first build shows a teaching card', await page.locator('#modal-layer.show').isVisible());
  await page.locator('#modal-actions button').first().click();
  await sleep(400);
  const cityAfter = await page.evaluate(() => WW.Worlds.city.stats());
  ok('a tree raised the green score (' + cityBefore.env + ' → ' + cityAfter.env + ')',
    cityAfter.env > cityBefore.env);

  /* build a factory and show the trade-off */
  await page.evaluate(() => {
    const w = WW.State.world('city');
    w.money = 999;
    WW.Worlds.city.selected = 'factory';
    WW.Worlds.city.tapCell(5);
  });
  await sleep(500);
  await page.evaluate(() => WW.Modal.close());
  await sleep(300);
  const cityFactory = await page.evaluate(() => WW.Worlds.city.stats());
  ok('a factory lowered the green score (' + cityAfter.env + ' → ' + cityFactory.env + ')',
    cityFactory.env < cityAfter.env);
  await page.evaluate(() => WW.Worlds.city.nextSeason());
  await sleep(400);
  ok('next season gives income and a tip', await page.locator('#modal-layer.show').isVisible());
  await page.locator('#modal-actions button').first().click();
  await sleep(300);
  await page.screenshot({ path: path.join(SHOTS, '08-city-iphone.png') });

  console.log('\n— Business Town —');
  await page.evaluate(() => { WW.State.data.unlocked.business = true; WW.Nav.go('business'); });
  await sleep(400);
  await clearModals();
  ok('lemonade stand opened', await page.locator('.stand-scene').isVisible());
  ok('3 planning controls (price, cups, ads)', await page.locator('.stepper').count() === 3);
  ok('the profit formula is explained', (await page.locator('.formula').textContent()).includes('Profit'));
  const cashBefore = await page.evaluate(() => WW.State.data.worlds.business.cash);
  await tapText('Open the stand!');
  await sleep(600);
  await clearModals();
  ok('day results shown with the maths written out', await page.locator('.calc-row.profit, .calc-row.loss').count() === 1);
  const biz = await page.evaluate(() => ({
    day: WW.State.data.worlds.business.day,
    cash: WW.State.data.worlds.business.cash,
    hist: WW.State.data.worlds.business.history.slice(),
    progress: WW.State.data.worlds.business.progress
  }));
  ok('a day was recorded in the ledger', biz.hist.length === 1);
  ok('cash changed by exactly the profit',
    Math.abs((biz.cash - cashBefore) - biz.hist[0].profit) < 0.011,
    'cash Δ ' + (biz.cash - cashBefore).toFixed(2) + ' vs profit ' + biz.hist[0].profit);
  ok('business progress advanced (' + biz.progress + '%)', biz.progress > 0);
  await tapText('Save $1');
  await sleep(300);
  ok('money can be moved to the piggy bank',
    await page.evaluate(() => WW.State.data.worlds.business.savings) === 1);
  await page.screenshot({ path: path.join(SHOTS, '09-business-iphone.png') });

  console.log('\n— Knowledge Tree, profile & parents —');
  await page.evaluate(() => WW.Nav.go('tree'));
  await sleep(400);
  await clearModals();
  ok('tree screen draws the tree', await page.locator('#tree-body .tree-svg').count() === 1);
  ok('5 crystal cards shown', await page.locator('.crystal-card').count() === 5);
  await page.screenshot({ path: path.join(SHOTS, '10-tree-iphone.png') });

  await page.evaluate(() => WW.Nav.go('profile'));
  await sleep(400);
  await clearModals();
  ok('profile shows badges', await page.locator('.badge').count() >= 10);
  ok('profile shows earned badges', await page.locator('.badge.got').count() >= 1);

  await page.evaluate(() => WW.Nav.go('parent'));
  await sleep(400);
  await clearModals();
  ok('grown-ups area is gated behind an adult check',
    await page.locator('.gate-card').isVisible());
  ok('the email form is NOT reachable before the gate is passed',
    !(await page.locator('.beta-card').isVisible()));

  /* a wrong answer must not let you in */
  await page.fill('.gate-input', '3');
  await page.locator('.gate-card button:has-text("Enter")').click();
  await sleep(400);
  ok('a wrong answer keeps the gate closed', await page.locator('.gate-card').isVisible());

  await passAdultGate();
  ok('a correct answer opens the dashboard', await page.locator('#screen-parent.active').isVisible());
  const parentTxt = await page.locator('#parent-body').textContent();
  ok('the signup form appears once unlocked', await page.locator('.beta-card').isVisible());
  ok('parent dashboard reports learning time', /Learning time/.test(parentTxt));
  ok('parent dashboard lists recent accomplishments', await page.locator('.activity-list li').count() >= 3);
  ok('parent dashboard explains privacy', /Private by design/.test(parentTxt));
  ok('HUD hidden on the parent screen', await page.locator('#hud').isHidden());
  await page.screenshot({ path: path.join(SHOTS, '11-parent-iphone.png') });

  await page.evaluate(() => WW.Nav.go('map'));
  await sleep(400);
  await page.evaluate(() => WW.Nav.go('parent'));
  await sleep(500);
  ok('leaving and returning re-locks the gate', await page.locator('.gate-card').isVisible());
  await passAdultGate();

  console.log('\n— Save / reload —');
  const before = await page.evaluate(() => {
    WW.State.save(true);
    return { xp: WW.State.data.xp, gems: WW.State.data.gems, name: WW.State.data.player.name,
      math: WW.State.data.worlds.math.progress, badges: WW.State.data.badges.length,
      activities: WW.State.data.stats.activitiesDone };
  });
  await page.reload({ waitUntil: 'load' });
  await sleep(700);
  const after = await page.evaluate(() => ({
    xp: WW.State.data.xp, gems: WW.State.data.gems, name: WW.State.data.player.name,
    math: WW.State.data.worlds.math.progress, badges: WW.State.data.badges.length,
    activities: WW.State.data.stats.activitiesDone
  }));
  ok('XP, gems, name, progress and badges all survived a reload',
    JSON.stringify(before) === JSON.stringify(after),
    JSON.stringify(before) + ' vs ' + JSON.stringify(after));
  ok('returning player is offered Continue',
    (await page.locator('#title-buttons').textContent()).includes('Continue'));

  console.log('\n— Touch-target audit (Apple HIG: 44pt minimum) —');
  await page.evaluate(() => WW.Nav.go('map'));
  await sleep(400);
  const smallTargets = await page.evaluate(() => {
    const bad = [];
    document.querySelectorAll('.screen:not([hidden]) button, #hud button').forEach((b) => {
      const r = b.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) return;
      if (r.width < 44 || r.height < 44) {
        bad.push((b.className || b.id) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height));
      }
    });
    return bad;
  });
  await clearModals();
  ok('all visible buttons are at least 44×44pt', smallTargets.length === 0, smallTargets.join(' | '));

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  ok('no horizontal overflow on a 390pt phone', !overflow);

  console.log('\n— iPad portrait & landscape —');
  const ipadP = await browser.newContext({ viewport: { width: 820, height: 1180 }, isMobile: true, hasTouch: true });
  const p2 = await ipadP.newPage();
  p2.on('pageerror', (e) => errors.push('ipad pageerror: ' + e.message));
  await p2.goto(BASE + '/index.html'); await sleep(700);
  await p2.evaluate(() => { WW.State.data.hasCharacter = true; WW.State.data.player.name = 'Ada'; WW.Nav.go('map'); });
  await sleep(600);
  ok('iPad portrait: map laid out', await p2.locator('.map-node').count() === 7);
  ok('iPad portrait: no horizontal overflow',
    !(await p2.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)));
  await p2.screenshot({ path: path.join(SHOTS, '12-map-ipad-portrait.png') });

  const ipadL = await browser.newContext({ viewport: { width: 1180, height: 820 }, isMobile: true, hasTouch: true });
  const p3 = await ipadL.newPage();
  p3.on('pageerror', (e) => errors.push('ipad-l pageerror: ' + e.message));
  await p3.goto(BASE + '/index.html'); await sleep(700);
  await p3.evaluate(() => { WW.State.data.hasCharacter = true; WW.Nav.go('math'); });
  await sleep(500);
  await p3.locator('button:has-text("Start the bridge!")').click();
  await sleep(600);
  ok('iPad landscape: bridge game renders', await p3.locator('.bridge-scene').isVisible());
  ok('iPad landscape: no horizontal overflow',
    !(await p3.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)));
  await p3.screenshot({ path: path.join(SHOTS, '13-math-ipad-landscape.png') });

  console.log('\n— Reduced motion & mute —');
  await page.evaluate(() => { WW.State.data.settings.reduceMotion = true; WW.Settings.apply(); });
  ok('reduce-motion class applied',
    await page.evaluate(() => document.body.classList.contains('reduce-motion')));
  await page.evaluate(() => { WW.Settings.toggle('sound'); });
  ok('sound can be muted',
    await page.evaluate(() => WW.State.data.settings.sound === false));

  console.log('\n— End game: all five crystals —');
  await page.evaluate(() => {
    ['math', 'story', 'science', 'city', 'business'].forEach((k) => {
      WW.State.data.crystals[k] = true;
      WW.State.data.worlds[k].progress = 100;
      WW.State.data.unlocked[k] = true;
    });
    WW.State.data.xp = 2000;
    WW.State.data.level = WW.Progress.levelFromXP(2000);
    WW.Progress.checkUnlocks();
    WW.State.save(true);
    WW.Nav.go('tree');
  });
  await sleep(600);
  await clearModals();
  await page.evaluate(() => WW.Nav.go('tree'));
  await sleep(500);
  ok('tree reaches full growth', await page.evaluate(() => WW.Progress.treeStage()) === 10);
  ok('all 5 crystal sockets are lit', await page.locator('#tree-body .tree-slot.on').count() === 5);
  ok('tree screen celebrates completion',
    /fully restored/.test(await page.locator('#tree-body').textContent()));
  await page.screenshot({ path: path.join(SHOTS, '14-tree-complete-iphone.png') });

  await page.evaluate(() => WW.Nav.go('map'));
  await sleep(500);
  ok('WonderSpace is unlocked on the map', await page.locator('.map-node.locked').count() === 0);
  await page.locator('.map-node[data-world="space"]').click();
  await sleep(400);
  ok('WonderSpace gives a proper reward message', await page.locator('#modal-layer.show').isVisible());
  await page.locator('#modal-actions button').first().click();
  await sleep(300);
  await page.screenshot({ path: path.join(SHOTS, '15-map-complete-iphone.png') });

  console.log('\n— Bigger-text accessibility mode —');
  await page.evaluate(() => { WW.State.data.settings.bigText = true; WW.Settings.apply(); WW.Nav.go('math'); });
  await sleep(500);
  await page.locator('button:has-text("Start the bridge!")').click();
  await sleep(600);
  ok('big-text mode still fits a 390pt phone',
    !(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)));
  const smallBig = await page.evaluate(() => {
    const bad = [];
    document.querySelectorAll('.screen:not([hidden]) button').forEach((b) => {
      const r = b.getBoundingClientRect();
      if (r.width && (r.width < 44 || r.height < 44)) bad.push(b.className);
    });
    return bad;
  });
  ok('big-text mode keeps 44pt touch targets', smallBig.length === 0, smallBig.join(' | '));
  await page.screenshot({ path: path.join(SHOTS, '16-bigtext-iphone.png') });
  await page.evaluate(() => { WW.State.data.settings.bigText = false; WW.Settings.apply(); });

  console.log('\n— Celebration audio —');
  const audio = await page.evaluate(() => {
    const calls = [];
    const realWin = WW.Sound.win, realPraise = WW.Sound.praise, realApplause = WW.Sound.applause;
    WW.Sound.win = function (k) { calls.push('win:' + k); };
    WW.Sound.praise = function (s) { calls.push('praise:' + (s ? 'small' : 'big')); };
    WW.Sound.applause = function () { calls.push('applause'); };
    WW.FX.celebrate({ emoji: '🎉', title: 'Test', lines: ['x'] });
    WW.Modal.close();
    const afterCelebrate = calls.slice();
    WW.Sound.win = realWin; WW.Sound.praise = realPraise; WW.Sound.applause = realApplause;
    return { afterCelebrate, hasCtx: !!WW.Sound.ctx, ready: WW.Sound.ready };
  });
  ok('every celebration triggers the cheer package',
    audio.afterCelebrate.indexOf('win:big') !== -1, audio.afterCelebrate.join(','));
  ok('Web Audio context was created on first tap', audio.hasCtx && audio.ready);
  const voiceWired = await page.evaluate(() => {
    WW.State.data.settings.sound = true;      /* an earlier test muted everything */
    WW.State.data.settings.voice = false;
    const off = WW.Sound.voiceOn();
    WW.State.data.settings.voice = true;
    const on = WW.Sound.voiceOn();
    return { off, on, speech: 'speechSynthesis' in window };
  });
  ok('spoken praise can be turned off on its own', voiceWired.off === false && voiceWired.on === true);
  ok('the master mute also silences the voice', await page.evaluate(() => {
    WW.State.data.settings.sound = false;
    const quiet = WW.Sound.voiceOn() === false;
    WW.State.data.settings.sound = true;
    return quiet;
  }));
  ok('settings panel exposes the voice toggle', await page.evaluate(() => {
    WW.Settings.openPanel();
    const txt = document.getElementById('modal-body').textContent;
    WW.Modal.close();
    return /Cheering voice/.test(txt) && /Sound effects/.test(txt);
  }));

  console.log('\n— Errors —');
  ok('no console or page errors during the whole playthrough', errors.length === 0,
    errors.slice(0, 6).join(' | '));

  await browser.close();
  console.log('\n' + (fail ? '❌' : '✅') + '  ' + pass + ' passed, ' + fail + ' failed');
  console.log('   screenshots → .shots/\n');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
