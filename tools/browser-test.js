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

  /* Every URL the page asks for, so the run can prove that adding a
     subscription layer added no network surface at all. */
  const requests = [];
  page.on('request', (r) => requests.push(r.url()));

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
     parent would: read the sum off the screen and type the answer.

     Two challenges exist. The dashboard uses "a × b"; anything involving money
     uses the stricter "a × b − c", which also carries a written instruction.
     This helper handles whichever one is on screen, inside a modal or not. */
  const passAdultGate = async (root) => {
    const scope = root || page;
    const sum = await scope.locator('.gate-sum').first().textContent().catch(() => null);
    if (!sum) return false;
    const strict = sum.match(/(\d+)\s*×\s*(\d+)\s*−\s*(\d+)/);
    const plain = sum.match(/(\d+)\s*×\s*(\d+)/);
    const answer = strict
      ? (+strict[1] * +strict[2] - +strict[3])
      : (+plain[1] * +plain[2]);
    await scope.locator('.gate-input').first().fill(String(answer));
    await scope.locator('.gate-card button:has-text("Enter")').first().click();
    await sleep(500);
    return true;
  };

  /* `.screen` is position:absolute; inset:0 with its own overflow, so the body
     never scrolls and Playwright's fullPage flag captures only the viewport —
     which is why two quite different dashboards used to produce byte-identical
     PNGs. Flatten the active screen for the length of the shot, then put it
     back, so a tall page is actually recorded in full. */
  const fullShot = async (pg, file) => {
    const flattened = await pg.addStyleTag({ content:
      'html, body { height: auto !important; overflow: visible !important; }' +
      '.screen.active { position: static !important; inset: auto !important;' +
      ' height: auto !important; overflow: visible !important; }' });
    await sleep(150);
    await pg.screenshot({ path: path.join(SHOTS, file), fullPage: true });
    await flattened.evaluate((el) => el.remove());
    await sleep(150);
  };

  /* Can a finger actually get to this control, or is it stranded outside the
     viewport with nothing to scroll? On a short screen that is the difference
     between a usable page and a dead end.

     Geometry alone is not enough — an element can sit inside the viewport and
     still be buried under the fixed world bar — so this also asks the browser
     what is actually on top at the middle of the control. */
  const reachable = async (pg, selector) => pg.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return { found: false };
    el.scrollIntoView({ block: 'center' });
    const r = el.getBoundingClientRect();
    const inView = r.top >= 0 && r.bottom <= window.innerHeight &&
                   r.left >= 0 && r.right <= window.innerWidth;
    const hit = document.elementFromPoint((r.left + r.right) / 2, (r.top + r.bottom) / 2);
    const onTop = !!hit && (hit === el || el.contains(hit) || hit.contains(el));
    return {
      found: true,
      ok: inView && onTop,
      inView: inView,
      onTop: onTop,
      box: Math.round(r.top) + '–' + Math.round(r.bottom) + ' of ' + window.innerHeight +
           (onTop ? '' : ', covered by ' + (hit ? (hit.className || hit.tagName) : 'nothing'))
    };
  }, selector);

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
  ok('nothing is learning-locked any more', await page.locator('.map-node.locked').count() === 0);
  await page.screenshot({ path: path.join(SHOTS, '15-map-complete-iphone.png') });

  /* =========================================================================
     WONDERWORLD+  —  the child's side
     State here: all five crystals restored, no subscription. This is exactly
     the moment the product has to behave well: the child has EARNED
     WonderSpace and must not be made to feel they lost it.
     ========================================================================= */
  console.log('\n— WonderWorld+ : what a child sees —');

  await page.evaluate(() => { WW.entitlements.clear(); WW.Nav.go('map'); });
  await sleep(450);
  ok('a Plus world is marked with a sparkle, not a padlock',
    await page.locator('.map-node[data-world="space"].premium').count() === 1 &&
    await page.locator('.map-node[data-world="space"].locked').count() === 0);
  ok('the premium mark is a label as well as a colour',
    (await page.locator('.map-node[data-world="space"] .node-label small').textContent())
      .includes('WonderWorld+'));
  ok('the map node still announces itself to a screen reader',
    ((await page.locator('.map-node[data-world="space"]').getAttribute('aria-label')) || '')
      .includes('Ask a grown-up'));

  await page.locator('.map-node[data-world="space"]').click();
  await sleep(400);
  ok('tapping it opens the friendly premium prompt',
    await page.locator('#modal-layer.show').isVisible());
  const childModal = (await page.locator('#modal').textContent()).replace(/\s+/g, ' ');
  ok('it is headed "A New Adventure!"', /A New Adventure/.test(childModal), childModal.slice(0, 90));
  ok('it names WonderWorld+ and asks for a grown-up',
    /part of WonderWorld\+/.test(childModal) && /Ask a grown-up/i.test(childModal));
  ok('it reassures rather than punishes',
    /still yours|Keep exploring/i.test(childModal), childModal.slice(0, 160));
  ok('THE CHILD IS SHOWN NO PRICE', !/\$/.test(childModal), childModal);
  ok('and no purchase wording of any kind',
    !/subscribe|buy|credit card|trial|payment|\bcost\b/i.test(childModal), childModal);
  ok('the buttons are "Ask a Grown-Up" and a way to carry on playing',
    /Ask a Grown-Up/.test(await page.locator('#modal-actions').textContent()) &&
    /Keep Exploring/.test(await page.locator('#modal-actions').textContent()));
  await page.screenshot({ path: path.join(SHOTS, '21-premium-child-prompt.png') });

  /* =========================================================================
     WONDERWORLD+  —  the parental gate in front of the money
     ========================================================================= */
  console.log('\n— WonderWorld+ : the parental gate —');

  ok('the Plus page is NOT reachable before the gate is passed',
    await page.evaluate(() => WW.parentGate.isOpen('purchase')) === false);

  await page.locator('#modal-actions button:has-text("Ask a Grown-Up")').click();
  await sleep(450);
  ok('"Ask a Grown-Up" opens an adult check', await page.locator('.gate-card').isVisible());
  ok('the purchase gate uses the stricter read-and-calculate challenge',
    await page.locator('.gate-instruction').isVisible() &&
    /×.*−/.test(await page.locator('.gate-sum').textContent()));
  ok('the gate explains itself to a screen reader',
    !!(await page.locator('.gate-input').getAttribute('aria-describedby')));
  ok('STILL no price while the gate is up',
    !/\$/.test(await page.locator('#modal').textContent()));

  /* a wrong answer must not open the door */
  await page.locator('.gate-input').fill('1');
  await page.locator('.gate-card button:has-text("Enter")').click();
  await sleep(400);
  ok('a wrong answer keeps the purchase gate closed',
    await page.locator('.gate-card').isVisible() &&
    await page.evaluate(() => WW.parentGate.isOpen('purchase')) === false);
  ok('and the Plus screen has not been opened',
    !(await page.locator('#screen-plus.active').isVisible()));
  await page.screenshot({ path: path.join(SHOTS, '22-purchase-gate.png') });

  await passAdultGate();
  await sleep(500);
  ok('a correct answer opens the WonderWorld+ page',
    await page.locator('#screen-plus.active').isVisible());

  /* =========================================================================
     WONDERWORLD+  —  the grown-ups page (the only place with a price)
     ========================================================================= */
  console.log('\n— WonderWorld+ : the grown-ups page —');
  const plusTxt = (await page.locator('#plus-body').textContent()).replace(/\s+/g, ' ');

  ok('it opens with the right message', /Take the adventure even further/.test(plusTxt));
  ok('it says the core adventure stays free',
    /core WonderWorld adventure is free/.test(plusTxt));
  ok('every promised benefit is listed',
    ['WonderSpace', 'New stories', 'More learning challenges', 'Multiple Explorer profiles',
     'Advanced learning reports', 'Progress backup', 'customize your Explorer']
      .every((t) => plusTxt.includes(t)),
    ['WonderSpace', 'New stories', 'More learning challenges', 'Multiple Explorer profiles',
     'Advanced learning reports', 'Progress backup', 'customize your Explorer']
      .filter((t) => !plusTxt.includes(t)).join(' | '));

  ok('THE PARENT PAGE SHOWS THE ANNUAL PRICE', plusTxt.includes('$39.99/year'));
  ok('the parent page shows the monthly price', plusTxt.includes('$6.99/month'));
  ok('the monthly equivalent of the annual plan is shown',
    plusTxt.includes('about $3.33/month'));
  ok('the trial is offered as "7 Days Free"', plusTxt.includes('7 Days Free'));
  ok('and what happens after the trial is spelled out',
    plusTxt.includes('$39.99/year after your free trial'));
  ok('"Cancel anytime." appears', plusTxt.includes('Cancel anytime.'));

  ok('the annual plan is the recommended one',
    await page.locator('.plan-card.recommended').count() === 1);
  ok('it is recommended by a text badge, not only by colour',
    (await page.locator('.plan-badge').textContent()) === 'BEST VALUE');
  ok('both purchase buttons are present',
    await page.locator('button:has-text("Start 7-Day Free Trial")').count() === 1 &&
    await page.locator('button:has-text("Choose Monthly")').count() === 1);
  ok('Restore Purchases is offered',
    await page.locator('button:has-text("Restore Purchases")').count() === 1);
  ok('Manage Subscription is offered',
    await page.locator('button:has-text("Manage Subscription")').count() === 1);
  ok('Terms and Privacy are linked',
    await page.locator('.legal-links a[href="terms.html"]').count() === 1 &&
    await page.locator('.legal-links a[href="privacy.html"]').count() === 1);
  ok('the trust list is shown in full',
    await page.locator('#plus-body .trust-list li').count() === 6);
  ok('trust claims are text, not just ticks',
    /No ads/.test(plusTxt) && /No selling children's data/.test(plusTxt) &&
    /No loot boxes/.test(plusTxt) && /No pay-to-win/.test(plusTxt) &&
    /No child email required/.test(plusTxt) && /No chat/.test(plusTxt));

  ok('the page is honest that billing is not connected yet',
    /not connected|DEVELOPMENT ONLY/i.test(plusTxt));
  ok('the HUD and companion stay out of the grown-ups area',
    await page.locator('#hud').isHidden() && await page.locator('#buddy').isHidden());

  const plusTargets = await page.evaluate(() => {
    const bad = [];
    document.querySelectorAll('#screen-plus button, #screen-plus a.ghost-btn').forEach((b) => {
      const r = b.getBoundingClientRect();
      if (r.width && (r.width < 44 || r.height < 44)) bad.push(b.className + ' ' +
        Math.round(r.width) + 'x' + Math.round(r.height));
    });
    return bad;
  });
  ok('every control on the Plus page keeps a 44pt target', plusTargets.length === 0,
    plusTargets.join(' | '));
  ok('no horizontal overflow on the Plus page',
    !(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)));
  await fullShot(page, '23-plus-page.png');

  /* Pressing a purchase button must either refuse honestly (no provider) or,
     on a development host, grant a state that is clearly marked as simulated.
     What it must never do is quietly look like a real purchase. */
  await page.locator('button:has-text("Choose Monthly")').click();
  await sleep(500);
  const buyResult = await page.evaluate(() => ({
    status: WW.entitlements.status(),
    simulated: WW.entitlements.isSimulated(),
    provider: WW.billing.providerName()
  }));
  ok('a purchase attempt is never passed off as a real subscription',
    buyResult.status === 'free' || buyResult.simulated === true,
    JSON.stringify(buyResult));
  ok('and on a dev host it is the mock adapter doing it, labelled as such',
    buyResult.provider === 'mock' &&
    /DEVELOPMENT ONLY/.test(await page.locator('#plus-body').textContent()));
  await clearModals();
  await page.evaluate(() => { WW.entitlements.clear(); WW.Screens.plus.enter(); });
  await sleep(300);

  /* =========================================================================
     Direct navigation must not get around the gate
     ========================================================================= */
  console.log('\n— WonderWorld+ : the gate cannot be walked around —');
  await page.evaluate(() => { WW.Nav.go('map'); });
  await sleep(400);
  ok('leaving the grown-ups area re-locks the purchase gate',
    await page.evaluate(() => WW.parentGate.isOpen('purchase')) === false);
  await page.evaluate(() => WW.Nav.go('plus'));
  await sleep(450);
  ok('navigating straight to the Plus screen shows the gate instead',
    await page.locator('#screen-plus.active .gate-card').isVisible());
  ok('and no price is rendered behind it',
    !/\$/.test(await page.locator('#plus-body').textContent()));

  /* =========================================================================
     Simulating WonderWorld+ in development
     ========================================================================= */
  console.log('\n— WonderWorld+ : simulating the paid state —');
  const devOn = await page.evaluate(() => ({
    available: WW.dev.available(),
    host: WW.env.host(),
    result: WW.dev.setTier('plus'),
    status: WW.entitlements.status(),
    simulated: WW.entitlements.isSimulated()
  }));
  ok('the dev simulator is available on localhost', devOn.available === true);
  ok("WW.dev.setTier('plus') turns WonderWorld+ on", devOn.status === 'plus');
  ok('and it is flagged as simulated, never as a real subscription',
    devOn.simulated === true);

  await page.evaluate(() => WW.Nav.go('map'));
  await sleep(450);
  ok('with Plus on, WonderSpace is no longer marked premium',
    await page.locator('.map-node[data-world="space"].premium').count() === 0);
  await page.locator('.map-node[data-world="space"]').click();
  await sleep(400);
  const spaceTxt = await page.locator('#modal').textContent();
  ok('a subscriber who earned it reaches WonderSpace itself',
    /rocket is fuelled/.test(spaceTxt), spaceTxt.slice(0, 80));
  ok('and is told honestly that the world is still being built',
    /coming in the next update/.test(spaceTxt));
  await clearModals();

  /* THE invariant: paying must never skip the learning. */
  console.log('\n— Paying never skips the learning —');
  const bypass = await page.evaluate(() => {
    const before = JSON.parse(JSON.stringify(WW.State.data.crystals));
    ['math', 'story', 'science', 'city', 'business'].forEach((k) => {
      WW.State.data.crystals[k] = false;
    });
    const out = {
      plus: WW.entitlements.isPlus(),
      canSpace: WW.entitlements.canAccess('space'),
      blockedBy: WW.entitlements.check('space').blockedBy
    };
    WW.State.data.crystals = before;
    return out;
  });
  ok('a paying subscriber with no crystals still cannot open WonderSpace',
    bypass.plus === true && bypass.canSpace === false);
  ok('and the block is reported as LEARNING, not as money',
    bypass.blockedBy === 'learning');

  const xpBypass = await page.evaluate(() => {
    const save = WW.State.data.xp, unlocked = JSON.parse(JSON.stringify(WW.State.data.unlocked));
    WW.State.data.xp = 0;
    WW.State.data.unlocked = { math: true, story: true, science: false, city: false,
                               business: false, space: false };
    const out = ['science', 'city', 'business'].map((id) => WW.entitlements.canAccess(id));
    WW.State.data.xp = save; WW.State.data.unlocked = unlocked;
    return out;
  });
  ok('a paying subscriber still has to earn the XP worlds',
    xpBypass.every((v) => v === false));

  /* =========================================================================
     The grown-ups dashboard, free and Plus
     ========================================================================= */
  console.log('\n— Grown-ups dashboard : learning progress —');
  await page.evaluate(() => { WW.dev.setTier('free'); WW.Nav.go('map'); });
  await sleep(300);
  await page.evaluate(() => WW.Nav.go('parent'));
  await sleep(400);
  await passAdultGate();
  const freeDash = (await page.locator('#parent-body').textContent()).replace(/\s+/g, ' ');
  ok('the dashboard is organised into sections',
    await page.locator('.parent-section').count() >= 3);
  ok('learning progress is still reported', /Learning time/.test(freeDash) &&
    /Subject progress/.test(freeDash) && /Ideas for practice/.test(freeDash));
  ok('a free parent sees the advanced report described, not hidden',
    /Advanced learning report/.test(freeDash) && /Part of WonderWorld\+/.test(freeDash));
  /* In-game money (a lemonade-stand profit, a city budget) is gameplay and is
     expected here. What must not appear is a SUBSCRIPTION price. */
  const SUB_PRICE = /\$39\.99|\$6\.99|\$3\.33|\/year|\/month|7 Days Free/;
  ok('NO SUBSCRIPTION PRICE appears in the dashboard itself', !SUB_PRICE.test(freeDash),
    (freeDash.match(SUB_PRICE) || []).join(','));
  ok('the trust list appears for grown-ups too',
    await page.locator('#parent-body .trust-list li').count() === 6);
  ok('the Explorer roster is reported honestly',
    /Explorers/.test(freeDash) && /1 of 1 Explorer/.test(freeDash));
  ok('the beta copy no longer over-promises',
    /The core WonderWorld adventure is free/.test(freeDash) &&
    !/WonderWorld is free and we intend to keep the learning free/.test(freeDash));
  ok('the signup form is still there and still behind the gate',
    await page.locator('.beta-card').isVisible());
  ok('the development panel is visible on localhost',
    await page.locator('.dev-card').isVisible());
  await fullShot(page, '24-parent-free.png');

  await page.evaluate(() => { WW.dev.setTier('plus'); WW.Screens.parent.enter(); });
  await sleep(450);
  const plusDash = (await page.locator('#parent-body').textContent()).replace(/\s+/g, ' ');
  ok('a Plus parent gets the advanced report itself',
    /Strongest right now|Strengths appear once/.test(plusDash));
  ok('the advanced report breaks every world down',
    ['Math Island', 'Story Forest', 'Science Lab', 'Planet City', 'Business Town']
      .every((n) => plusDash.includes(n)));
  ok('and reports only figures the save actually holds',
    /Bridge crossings completed/.test(plusDash) &&
    /Plant discoveries/.test(plusDash) &&
    /Days traded/.test(plusDash));
  ok('Plus raises the Explorer allowance to four', /1 of 4 Explorer/.test(plusDash));
  ok('still no subscription price in the dashboard', !SUB_PRICE.test(plusDash),
    (plusDash.match(SUB_PRICE) || []).join(','));
  await fullShot(page, '25-parent-plus.png');

  /* =========================================================================
     Nothing was broken on the way
     ========================================================================= */
  console.log('\n— Saves, offline and privacy are untouched —');
  const saveIntegrity = await page.evaluate(() => {
    const raw = window.localStorage.getItem('wonderworld.save.v1');
    const ent = window.localStorage.getItem('wonderworld.entitlement.v1');
    const save = JSON.parse(raw);
    return {
      saveExists: !!raw,
      saveKey: WW.State.saveKey(),
      name: save.player.name,
      xp: save.xp,
      crystals: Object.keys(save.crystals).filter((k) => save.crystals[k]).length,
      entitlementIsSeparate: !!ent && raw.indexOf('"provider"') === -1,
      profileOne: WW.profiles.active().saveKey
    };
  });
  ok('the save still lives under wonderworld.save.v1',
    saveIntegrity.saveExists && saveIntegrity.saveKey === 'wonderworld.save.v1');
  ok('Explorer 1 points at that same key, not a copy',
    saveIntegrity.profileOne === 'wonderworld.save.v1');
  ok('the child\'s progress survived the whole subscription flow',
    saveIntegrity.name === 'Ada' && saveIntegrity.xp > 0 && saveIntegrity.crystals === 5);
  ok('the subscription record is in a separate key and not inside the save',
    saveIntegrity.entitlementIsSeparate === true);

  ok('reduced motion still applies on the new screens', await page.evaluate(() => {
    WW.State.data.settings.reduceMotion = true;
    WW.Settings.apply();
    const on = document.body.classList.contains('reduce-motion');
    const sky = getComputedStyle(document.getElementById('sky')).display;
    WW.State.data.settings.reduceMotion = false;
    WW.Settings.apply();
    return on && sky === 'none';
  }));
  ok('big-text mode still fits the Plus page', await page.evaluate(async () => {
    WW.State.data.settings.bigText = true; WW.Settings.apply();
    WW.parentGate.markPassed('purchase'); WW.Nav.go('plus');
    await new Promise((r) => setTimeout(r, 300));
    const over = document.documentElement.scrollWidth > window.innerWidth + 1;
    WW.State.data.settings.bigText = false; WW.Settings.apply();
    return !over;
  }));

  ok('the service worker is registered and offline support is intact',
    await page.evaluate(() => navigator.serviceWorker.getRegistrations()
      .then((r) => r.length >= 1)));

  const offOrigin = requests.filter((u) => u.indexOf(BASE) !== 0 && u.indexOf('data:') !== 0);
  ok('not one request left this origin during the entire run',
    offOrigin.length === 0, offOrigin.slice(0, 5).join(' | '));
  ok('and no request looked like analytics, ads or a payment processor',
    !requests.some((u) => /analytics|googletag|doubleclick|facebook|stripe|paypal|braintree|mixpanel|segment|amplitude/i.test(u)));

  await page.evaluate(() => { WW.dev.setTier('free'); WW.Nav.go('map'); });
  await sleep(300);

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

  /* =========================================================================
     WONDERWORLD+ ON A TABLET
     The phone run above proves the monetization screens behave at 390pt. These
     are the same screens at iPad sizes, which is where they are most likely to
     go wrong: six stacked cards on a short landscape viewport, and a layout
     that was only ever designed one column wide stretched across 1180pt.
     ========================================================================= */
  console.log('\n— WonderWorld+ on a tablet —');

  const tabletPlus = async (pg, label, shotPrompt, shotPlus) => {
    await pg.goto(BASE + '/index.html', { waitUntil: 'load' });
    await sleep(700);

    /* A child who has earned everything, so WonderSpace is blocked by the
       subscription rather than by learning — which is the only way to reach
       the premium prompt at all. */
    await pg.evaluate(() => {
      WW.State.data.hasCharacter = true;
      WW.State.data.player.name = 'Ada';
      ['math', 'story', 'science', 'city', 'business'].forEach((k) => {
        WW.State.data.crystals[k] = true;
        WW.State.data.worlds[k].progress = 100;
        WW.State.data.unlocked[k] = true;
      });
      WW.State.save(true);
      WW.Modal.close();
      WW.Nav.go('map');
    });
    await sleep(600);

    const overflows = () => pg.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1);

    ok(label + ': the map still lays out', await pg.locator('.map-node').count() === 7);
    ok(label + ': WonderSpace is marked by name, not only by colour',
      ((await pg.locator('.map-node[data-world="space"] .node-label small')
        .textContent()) || '').includes('WonderWorld+'));

    await pg.locator('.map-node[data-world="space"]').click();
    await sleep(450);
    const childModalT = (await pg.locator('#modal').textContent()).replace(/\s+/g, ' ');
    ok(label + ': the friendly premium prompt opens',
      await pg.locator('#modal-layer.show').isVisible());
    ok(label + ': THE CHILD IS STILL SHOWN NO PRICE', !/\$/.test(childModalT), childModalT);
    ok(label + ': and still no purchase wording',
      !/subscribe|buy|credit card|trial|payment|\bcost\b/i.test(childModalT), childModalT);
    ok(label + ': the prompt does not overflow sideways', !(await overflows()));
    await pg.screenshot({ path: path.join(SHOTS, shotPrompt) });

    await pg.locator('#modal-actions button:has-text("Ask a Grown-Up")').click();
    await sleep(500);
    ok(label + ': the purchase gate still stands in the way',
      await pg.locator('.gate-card').isVisible() &&
      await pg.evaluate(() => WW.parentGate.isOpen('purchase')) === false);
    ok(label + ': no price while the gate is up',
      !/\$/.test(await pg.locator('#modal').textContent()));
    ok(label + ': the gate keeps a 44pt answer field',
      await pg.evaluate(() => {
        const r = document.querySelector('.gate-input').getBoundingClientRect();
        return r.height >= 44;
      }));

    await passAdultGate(pg);
    await sleep(600);
    ok(label + ': a correct answer opens the Plus page',
      await pg.locator('#screen-plus.active').isVisible());

    const plusT = (await pg.locator('#plus-body').textContent()).replace(/\s+/g, ' ');
    ok(label + ': the grown-up does see the price', plusT.includes('$39.99/year'));
    ok(label + ': the recommendation is still a text badge',
      (await pg.locator('.plan-badge').textContent()) === 'BEST VALUE');
    ok(label + ': no horizontal overflow on the Plus page', !(await overflows()));

    const plusTargetsT = await pg.evaluate(() => {
      const bad = [];
      document.querySelectorAll('#screen-plus button, #screen-plus a.ghost-btn').forEach((b) => {
        const r = b.getBoundingClientRect();
        if (r.width && (r.width < 44 || r.height < 44)) {
          bad.push(b.className + ' ' + Math.round(r.width) + 'x' + Math.round(r.height));
        }
      });
      return bad;
    });
    ok(label + ': every Plus control keeps a 44pt target',
      plusTargetsT.length === 0, plusTargetsT.join(' | '));

    /* The Plus page sits in .world-body, which caps at 980px like every world
       and the parent dashboard. This proves that cap is actually in effect:
       a card running the full width of a 1180pt iPad would be hard to read,
       and one squeezed to a hairline would be worse. */
    const plan = await pg.evaluate(() => {
      const c = document.querySelector('.plan-card');
      if (!c) return null;
      return { w: Math.round(c.getBoundingClientRect().width), vw: window.innerWidth };
    });
    ok(label + ': the pricing card stays within the 980pt reading column',
      !!plan && plan.w >= 260 && plan.w <= 940,
      plan ? plan.w + 'pt in a ' + plan.vw + 'pt viewport' : 'no .plan-card');

    await fullShot(pg, shotPlus);

    /* Six cards stack up on this page and Terms/Privacy are the last of them.
       On a short landscape viewport they are the first thing to be lost. */
    const legal = await pg.evaluate(() => {
      const a = document.querySelector('.legal-links a[href="terms.html"]');
      if (!a) return null;
      a.scrollIntoView({ block: 'center' });
      const r = a.getBoundingClientRect();
      return { top: Math.round(r.top), bottom: Math.round(r.bottom), h: window.innerHeight };
    });
    ok(label + ': Terms can actually be scrolled to',
      !!legal && legal.top >= 0 && legal.bottom <= legal.h,
      legal ? JSON.stringify(legal) : 'no terms link');
  };

  await tabletPlus(p2, 'iPad portrait',
    '26-premium-prompt-ipad-portrait.png', '27-plus-ipad-portrait.png');
  await tabletPlus(p3, 'iPad landscape',
    '28-premium-prompt-ipad-landscape.png', '29-plus-ipad-landscape.png');

  /* =========================================================================
     A PHONE HELD SIDEWAYS
     844×390 is the only viewport with a media query written specially for it
     (style.css: "orientation: landscape and max-height: 500px") and it had no
     coverage at all until now. 390pt of height is where a six-card page, and a
     gate card carrying an instruction, a sum, a field and a button, are most
     likely to come apart.
     ========================================================================= */
  console.log('\n— A phone held sideways (844×390) —');
  const phoneL = await browser.newContext({
    viewport: { width: 844, height: 390 },
    deviceScaleFactor: 3, isMobile: true, hasTouch: true
  });
  const p4 = await phoneL.newPage();
  p4.on('pageerror', (e) => errors.push('phone-landscape pageerror: ' + e.message));
  p4.on('console', (m) => {
    if (m.type() === 'error') errors.push('phone-landscape console: ' + m.text());
  });
  await p4.goto(BASE + '/index.html', { waitUntil: 'load' });
  await sleep(700);

  const sideways = () => p4.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1);

  ok('landscape: the short-viewport media query is the one in force',
    await p4.evaluate(() =>
      window.matchMedia('(orientation: landscape) and (max-height: 500px)').matches));
  ok('landscape: the title lays its art beside the buttons instead of above',
    await p4.evaluate(() =>
      getComputedStyle(document.querySelector('.title-wrap')).flexDirection === 'row'));
  ok('landscape: a start button is still reachable',
    (await reachable(p4, '#title-buttons button')).ok);
  ok('landscape: no horizontal overflow on the title', !(await sideways()));
  await p4.screenshot({ path: path.join(SHOTS, '30-title-phone-landscape.png') });

  /* Again a child who has earned everything, so WonderSpace is blocked by the
     subscription rather than by learning. */
  await p4.evaluate(() => {
    WW.State.data.hasCharacter = true;
    WW.State.data.player.name = 'Ada';
    ['math', 'story', 'science', 'city', 'business'].forEach((k) => {
      WW.State.data.crystals[k] = true;
      WW.State.data.worlds[k].progress = 100;
      WW.State.data.unlocked[k] = true;
    });
    WW.State.save(true);
    WW.Modal.close();
    WW.Nav.go('map');
  });
  await sleep(600);

  ok('landscape: the map still lays out all seven nodes',
    await p4.locator('.map-node').count() === 7);
  ok('landscape: the map stage flattens to the short-viewport aspect ratio',
    (await p4.evaluate(() =>
      getComputedStyle(document.querySelector('.map-stage')).aspectRatio))
      .replace(/\s/g, '') === '16/8');
  ok('landscape: the companion shrinks out of the way',
    await p4.evaluate(() => {
      const f = document.querySelector('.buddy-face');
      return !f || Math.round(f.getBoundingClientRect().width) <= 48;
    }));
  ok('landscape: no horizontal overflow on the map', !(await sideways()));
  await p4.screenshot({ path: path.join(SHOTS, '31-map-phone-landscape.png') });

  /* An actual activity, because the landscape rules shorten the play scenes. */
  await p4.evaluate(() => WW.Nav.go('math'));
  await sleep(500);
  await p4.locator('button:has-text("Start the bridge!")').click();
  await sleep(700);
  ok('landscape: the bridge game renders', await p4.locator('.bridge-scene').isVisible());
  ok('landscape: the bridge scene is shortened to fit the viewport',
    await p4.evaluate(() =>
      Math.round(document.querySelector('.bridge-scene').getBoundingClientRect().height)) <= 170);
  ok('landscape: an answer choice is reachable', (await reachable(p4, '.choices button')).ok);
  ok('landscape: no horizontal overflow mid-activity', !(await sideways()));
  await p4.screenshot({ path: path.join(SHOTS, '32-math-phone-landscape.png') });

  /* ---- the monetization screens, where height is tightest ---- */
  await p4.evaluate(() => { WW.Modal.close(); WW.Nav.go('map'); });
  await sleep(600);
  await p4.locator('.map-node[data-world="space"]').click();
  await sleep(500);
  const landModal = (await p4.locator('#modal').textContent()).replace(/\s+/g, ' ');
  ok('landscape: the friendly premium prompt opens',
    await p4.locator('#modal-layer.show').isVisible());
  ok('landscape: THE CHILD IS STILL SHOWN NO PRICE', !/\$/.test(landModal), landModal);
  ok('landscape: and still no purchase wording',
    !/subscribe|buy|credit card|trial|payment|\bcost\b/i.test(landModal), landModal);
  const askReach = await reachable(p4, '#modal-actions button');
  ok('landscape: "Ask a Grown-Up" is reachable in 390pt of height',
    askReach.found && askReach.ok, askReach.box);
  await p4.screenshot({ path: path.join(SHOTS, '33-premium-prompt-phone-landscape.png') });

  await p4.locator('#modal-actions button:has-text("Ask a Grown-Up")').click();
  await sleep(500);
  ok('landscape: the purchase gate still stands in the way',
    await p4.locator('.gate-card').isVisible() &&
    await p4.evaluate(() => WW.parentGate.isOpen('purchase')) === false);
  ok('landscape: no price while the gate is up',
    !/\$/.test(await p4.locator('#modal').textContent()));

  /* The gate is the tightest thing in the game on a short screen: emoji,
     heading, blurb, written instruction, sum, field, button, status line. All
     three of the parts a grown-up has to use must be gettable to. */
  const sumReach = await reachable(p4, '.gate-sum');
  ok('landscape: the sum can be read', sumReach.found && sumReach.ok, sumReach.box);
  const fieldReach = await reachable(p4, '.gate-input');
  ok('landscape: the answer field can be reached', fieldReach.found && fieldReach.ok,
    fieldReach.box);
  const enterReach = await reachable(p4, '.gate-card .big-btn');
  ok('landscape: the Enter button can be reached', enterReach.found && enterReach.ok,
    enterReach.box);

  /* The money gate asks the grown-up to read a sentence and then type the
     answer to it. If the instruction cannot be on screen at the same time as
     the field, they have to memorise it while scrolling — so this measures the
     two together rather than each on its own. It fits today with about 70pt to
     spare, which is little enough that a longer sentence would break it. */
  const gateFit = await p4.evaluate(() => {
    const instr = document.querySelector('.gate-instruction');
    const input = document.querySelector('.gate-input');
    const modal = document.querySelector('.modal');
    if (!instr || !input || !modal) return null;
    return {
      span: Math.round(input.getBoundingClientRect().bottom - instr.getBoundingClientRect().top),
      visible: Math.round(modal.clientHeight)
    };
  });
  ok('landscape: the instruction and the answer field fit on screen together',
    !!gateFit && gateFit.span <= gateFit.visible,
    gateFit ? gateFit.span + 'pt of instruction+field in ' + gateFit.visible + 'pt visible'
            : 'gate parts missing');
  await p4.screenshot({ path: path.join(SHOTS, '34-purchase-gate-phone-landscape.png') });

  await passAdultGate(p4);
  await sleep(700);
  ok('landscape: a grown-up can actually complete the gate sideways',
    await p4.locator('#screen-plus.active').isVisible());

  const landPlus = (await p4.locator('#plus-body').textContent()).replace(/\s+/g, ' ');
  ok('landscape: the grown-up does see the price', landPlus.includes('$39.99/year'));
  ok('landscape: no horizontal overflow on the Plus page', !(await sideways()));

  const landTargets = await p4.evaluate(() => {
    const bad = [];
    document.querySelectorAll('#screen-plus button, #screen-plus a.ghost-btn').forEach((b) => {
      const r = b.getBoundingClientRect();
      if (r.width && (r.width < 44 || r.height < 44)) {
        bad.push(b.className + ' ' + Math.round(r.width) + 'x' + Math.round(r.height));
      }
    });
    return bad;
  });
  ok('landscape: every Plus control keeps a 44pt target',
    landTargets.length === 0, landTargets.join(' | '));

  /* Six cards in 390pt of height. The trial button is the one that matters
     most, and Terms/Privacy are the furthest from the top. */
  const trialReach = await reachable(p4, '.plan-card.recommended .big-btn');
  ok('landscape: the trial button is reachable', trialReach.found && trialReach.ok,
    trialReach.box);
  const termsReach = await reachable(p4, '.legal-links a[href="terms.html"]');
  ok('landscape: Terms can still be scrolled to', termsReach.found && termsReach.ok,
    termsReach.box);
  await fullShot(p4, '35-plus-phone-landscape.png');

  console.log('\n— Errors —');
  ok('no console or page errors during the whole playthrough', errors.length === 0,
    errors.slice(0, 6).join(' | '));

  await browser.close();
  console.log('\n' + (fail ? '❌' : '✅') + '  ' + pass + ' passed, ' + fail + ' failed');
  console.log('   screenshots → .shots/\n');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
