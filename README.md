# 🌳 WonderWorld — A Magical Learning Adventure

An educational adventure game for children roughly **ages 5–12**, built in plain
HTML5, CSS3 and vanilla JavaScript. No build step, no database, no accounts, no
ads, no tracking.

The complete five-crystal adventure is **free**, and worlds open by learning
rather than by paying. An optional subscription, **WonderWorld+**, adds content
on top of it — see [§9 Monetization architecture](#9-monetization-architecture).
It is not on sale yet: no billing provider is connected.

> The ancient **Knowledge Tree** has lost its power. Five Knowledge Crystals are
> scattered across WonderWorld. Explore five worlds, learn, and bring them home.

**Core loop:** Explore → Play → Learn → Earn → Build → Discover → Unlock

---

## 1. How to run it

### The fastest way
Double-click **`index.html`**. That's it — the whole game runs from the file system.

> ⚠️ One caveat: some browsers block `localStorage` on `file://` URLs in private
> mode. If progress isn't saving, use the local-server method below.

### The recommended way (and the only way to test on a phone)
From the project folder, start any static server:

```bash
# Python (pre-installed on macOS/Linux)
python3 -m http.server 8111

# or Node
npx http-server -p 8111 .
```

Then open <http://localhost:8111>.

---

## 2. Testing on an iPhone or iPad

1. Put the computer and the iPad/iPhone **on the same Wi-Fi network**.
2. Find your computer's local IP:
   - macOS: `ipconfig getifaddr en0`
   - Windows: `ipconfig` → "IPv4 Address"
3. Start the server as above, then on the device open
   `http://<your-ip>:8111` — e.g. `http://192.168.1.24:8111`.
4. **Install it like a real app:** in Safari tap **Share → Add to Home Screen**.
   It then launches full-screen with no browser chrome, thanks to the web app
   manifest in `assets/manifest.webmanifest`.

### What's already handled for iOS
| Concern | How it's handled |
|---|---|
| Notches / Dynamic Island | `viewport-fit=cover` + `env(safe-area-inset-*)` on the HUD, world bars and screens |
| Address-bar resize jump | A `--vh` custom property recalculated on `resize`/`orientationchange` |
| 300 ms tap delay | `width=device-width` + `touch-action: manipulation` |
| Rubber-band scroll | `overscroll-behavior: none`, with scrolling confined to `.screen` |
| Audio autoplay policy | Web Audio is created lazily and unlocked on the first `pointerdown` |
| Touch targets | Every control is ≥ 44×44 pt (verified automatically — see §7) |
| Hover | Nothing depends on hover; every state is driven by taps |
| Rotation | Portrait and landscape layouts for both phone and tablet |

### Desktop
Works in any modern browser. Keyboard: `Tab` to move, `Enter`/`Space` to
activate, `Esc` to close a dialog. Focus rings are high-contrast gold.

---

## 3. Project structure

```
WonderWorld/
├── index.html                 screen shells + script loading order
├── style.css                  all styling, 16 labelled sections
├── game.js                    entry point — boots everything
├── js/
│   ├── core.js                engine: utilities, game data, audio, save/load,
│   │                          player state, progression, rewards, FX, avatar
│   │                          art, companion, HUD, screen router, settings
│   ├── env.js                 development vs production (gates the dev mock)
│   ├── events.js              first-party-only event interface (no network)
│   ├── entitlements.js        content tiers + free / WonderWorld+ access
│   ├── billing.js             WW.billing facade + mock/apple/web adapters
│   ├── profiles.js            Explorer roster + the save-key seam
│   ├── sync.js                cloud-backup interface (no backend yet)
│   ├── parentgate.js          the one reusable adult check
│   ├── art.js                 hand-drawn SVG illustrations for the story
│   ├── screens.js             title, character creator, world map,
│   │                          Knowledge Tree, profile, parent dashboard
│   ├── plus.js                child premium prompt + grown-ups WonderWorld+ page
│   ├── devtools.js            development-only tier simulator
│   ├── tutor/                 WonderTutor (see §10)
│   │   ├── languages.js       the 12 supported languages + capability states
│   │   ├── taxonomy.js        domains, skills, grade bands, prerequisites
│   │   ├── profile.js         WW.learningProfile — grade, language, mastery
│   │   ├── content.js         offline lesson/question bank + scoring
│   │   ├── safety.js          outbound allow-list, input/output screening
│   │   ├── emotion.js         expression allow-list + deterministic rules
│   │   ├── avatar.js          the animated SVG character
│   │   ├── voice.js           on-device speech only
│   │   ├── realtime.js        spoken conversation (off by default)
│   │   ├── provider.js        offline + server adapters (no key in client)
│   │   ├── assessment.js      the adaptive diagnostic
│   │   ├── engine.js          skill choice, rewards, access
│   │   ├── session.js         one running lesson
│   │   └── screen.js          the WonderTutor UI
│   └── worlds/
│       ├── math.js            Math Island — adaptive question engine + bridge
│       ├── story.js           Story Forest — interactive story + reading games
│       ├── science.js         Science Lab — plant, magnet, weather experiments
│       ├── city.js            Planet City — sustainable city builder
│       └── business.js        Business Town — lemonade stand simulation
├── privacy.html               privacy policy (linked from the signup form)
├── terms.html                 terms of use (linked from the WonderWorld+ page)
├── 404.html                   disables Cloudflare's SPA fallback
├── sw.js                      service worker — offline play
├── _headers                   Cloudflare Pages security + caching headers
├── functions/
│   └── api/
│       ├── subscribe.js       POST — stores a parent signup in Cloudflare KV
│       ├── subscribers.js     GET  — token-protected CSV export
│       ├── tutor.js           POST — the only path to a text model
│       ├── tutor-emotion.js   POST — Decisions API, picks the tutor's face
│       └── tutor-realtime.js  POST — mints ephemeral voice-session tokens
├── assets/
│   ├── icon.svg               app icon (pure SVG — nothing to break)
│   ├── apple-touch-icon.png   iOS home-screen icon (iOS ignores SVG here)
│   ├── icon-192/512*.png      PWA + maskable icons
│   └── manifest.webmanifest   installable web app metadata
├── tools/
│   ├── logic-test.js          headless game-logic tests (node)
│   └── browser-test.js        full automated playthrough (headless browser)
├── docs/
│   ├── MONETIZATION.md        free vs Plus, billing, StoreKit integration path
│   ├── WONDERTUTOR.md         tutor architecture, safety, multilingual plan
│   └── TUTOR_PRICING.md       AI cost model and pricing analysis
└── README.md
```

Everything hangs off a single global namespace, `window.WW`:

```js
WW.Util       // helpers (el, rnd, pick, shuffle, clamp, money, merge…)
WW.Data       // content tables: companions, outfits, worlds, crystals, badges
WW.Sound      // generated Web Audio effects — no audio files
WW.State      // the save object + load/save/wipe
WW.Progress   // XP, levels, gems, world progress, crystals, badges, unlocks
WW.FX         // toasts, floating gains, confetti, celebrations
WW.Modal      // dialogs
WW.Avatar     // SVG character art + Knowledge Tree art
WW.Art        // story illustrations (11 scenes, all SVG)
WW.Buddy      // the floating companion
WW.HUD        // top bar
WW.Nav        // screen router
WW.UI         // shared builders: cards, meters, steppers, buttons
WW.Screens    // non-world screens
WW.Worlds     // one module per world

// --- monetization layer (see §9) ---
WW.env           // isDev() / isProductionHost() — gates the development mock
WW.events        // first-party event buffer; nothing is transmitted
WW.Content       // content registry: tiers, slugs, the WonderWorld+ catalogue
WW.entitlements  // isPlus(), canAccess(), hasFeature(), check()
WW.billing       // startTrial/purchase/restorePurchases/manageSubscription
WW.profiles      // Explorer roster, slot limits, activeSaveKey()
WW.sync          // push/pull/status — interface only, no backend
WW.parentGate    // the reusable adult check
WW.Premium       // the child-facing "ask a grown-up" prompt
WW.dev           // tier simulator — inert outside development

// --- WonderTutor (see §10) ---
WW.tutorLanguages  // the 12 supported languages + what we will claim about each
WW.tutorTaxonomy   // domains, skills, grade bands, prerequisites
WW.learningProfile // grade, tutoring language, per-skill mastery
WW.tutorContent    // offline lessons/questions + deterministic scoring
WW.tutorSafety     // outbound allow-list, input/output screening
WW.tutorEmotion    // expression allow-list + deterministic rules
WW.tutorAvatar     // the animated SVG character
WW.tutorVoice      // speak/stop/pause/resume — on-device voices only
WW.tutorVoiceChat  // spoken conversation — consent-gated, push-to-talk, off by default
WW.tutorProvider   // generate() — offline bank or first-party endpoint
WW.tutorAssessment // the adaptive diagnostic
WW.tutor           // nextSkill(), access(), rewards
WW.tutorSession    // one running lesson
```

No module reaches into another's internals — worlds only talk to
`WW.Progress`, `WW.State` and `WW.UI`, nothing anywhere talks to a store
SDK except `WW.billing`, and nothing talks to a language model except
`WW.tutorProvider`. That's what keeps a port to Unity/Godot
or a native rewrite tractable.

---

## 4. The save system

| | |
|---|---|
| **Where** | `localStorage`, key `wonderworld.save.v1` |
| **What** | One JSON object: character, XP, level, gems, crystals, unlocked worlds, per-world state, badges, activity log, play-time stats, settings |
| **When** | Debounced ~400 ms after any change; immediately on level-up, crystal restoration, tab hide and page unload |
| **Leaves the device?** | Never. The only network call in the client is the parent mailing-list signup, which carries nothing from the save |

### Other localStorage keys

Both are kept **outside** the save on purpose, so a subscription can never
corrupt a game in progress and a child's progress is never mixed up with a
grown-up's billing state.

| Key | Written by | Holds |
|---|---|---|
| `wonderworld.save.v1` | `js/core.js` | the Explorer's game, unchanged since v1 |
| `wonderworld.entitlement.v1` | `js/entitlements.js` | subscription status, product, provider, trial dates |
| `wonderworld.profiles.v1` | `js/profiles.js` | the Explorer roster; Explorer 1 *points at* the key above |

`WW.State` resolves its key through `WW.profiles.activeSaveKey()`, which returns
`wonderworld.save.v1` for Explorer 1 and falls back to that same key if the
profiles module is missing or throws. Existing saves are never moved or copied.

### Forward compatibility
`WW.State.load()` deep-merges the stored object onto a fresh `defaults()`
object. Add a new field to `defaults()` and old saves pick it up automatically
with the default value — existing players lose nothing.

### Resetting
Grown-Ups → **Reset all progress**, or in the console:

```js
localStorage.removeItem('wonderworld.save.v1'); location.reload();
```

Grown-Ups → **Export progress** dumps the raw JSON for a manual backup.

---

## 5. Adding content

### New maths questions — `js/worlds/math.js`
Push an object onto `GENERATORS`:

```js
{
  id: 'perimeter',          // unique
  topic: 'word',            // mixed|add|sub|mul|div|compare|fraction|money|word
  minTier: 5,               // 1 (easiest) … 6 (hardest)
  make: function (tier) {
    var side = U.rnd(3, 9);
    var c = numChoices(side * 4, [1, -1, 4, -4, side]);   // builds 4 options
    return {
      text: 'A square garden has sides of ' + side + ' m. What is the perimeter?',
      visual: '<div class="q-story">🌻</div>',  // optional HTML, or null
      answer: c.correct,
      choices: c.choices,
      hint: 'Add all four sides: ' + side + ' + ' + side + ' + ' + side + ' + ' + side,
      concept: 'Perimeter'
    };
  }
}
```

Helpers already available inside that file: `numChoices`, `emojiRow`,
`emojiSum`, `emojiTakeaway`, `pieSVG`, `coinRow`, `fmtCents`, `who()` (returns
the player's or companion's name so word problems feel personal).

To add a new **topic button**, add an entry to `TOPICS` with a matching
`topic` on at least one generator.

**Difficulty is adaptive:** a first-try correct answer nudges
`State.world('math').diff` up by 0.18, a miss nudges it down by 0.3, clamped to
1–6. `minTier` controls when a generator enters the pool.

### New story chapters — `js/worlds/story.js`
Push onto `CHAPTERS`. A chapter is a list of *beats*:

```js
{ type: 'passage', emoji: '🦊', text: 'Luna walked into the woods…' }
{ type: 'activity', act: { kind: 'spell', word: 'moon', emoji: '🌙',
                           clue: 'It glows at night. Spell it!',
                           teach: 'm-o-o-n spells moon.' } }
```

Activity `kind` values and their shapes:

| kind | fields |
|---|---|
| `phonics` / `rhyme` | `q`, `options:[{t,e}]`, `answer`, `hint`, `teach` |
| `vocab` / `comp` | `q`, `options:[string]`, `answer`, `hint`, `teach` |
| `spell` | `word` (lowercase letters only), `emoji`, `clue`, `teach` |
| `sentence` | `words:[string]` in the correct order, `hint`, `teach` |

Chapters unlock in order and each is worth `100 / CHAPTERS.length` percent of
the Word Crystal, so adding a chapter rebalances progress automatically.

### New story illustrations — `js/art.js`
Every passage is illustrated. Scenes are pure SVG built from reusable pieces
(`fox`, `owl`, `tree`, `littleStar`, `moon`, `stars`, `ground`, `tufts`, `mist`,
`swirl`, `sparkles`), drawn on a shared 320 × 180 canvas.

```js
// 1. add a builder
'luna-sleeps': function () {
  return nightSky('skL', '#121a46', '#2e2a63') + stars(14) + moon(40, 30, 12) +
         ground(130, '#3f7d4a', '#2f6239') + tufts(138) +
         fox(160, 140, 1.2, 1, true);
},

// 2. add a screen-reader description (required — the picture is never the
//    only channel of information)
'luna-sleeps': 'Luna the fox curls up asleep on the hill under a bright moon.',

// 3. point a passage at it
{ type: 'passage', scene: 'luna-sleeps', emoji: '😴', text: '…' }
```

A passage with no `scene` (or an unknown one) falls back to the big emoji, so
nothing breaks if you add a chapter before you've drawn its pictures.

### New experiments, buildings, upgrades
- **Science** — `PLANT_RESULTS`, `MAGNET_OBJECTS`, `WEATHER_TYPES` /
  `weatherFor()` in `js/worlds/science.js`. `Science.recalc()` derives progress
  from how many discoveries exist, so new entries rebalance automatically.
- **City** — add to `BUILDINGS` in `js/worlds/city.js` with `cost`, `env`,
  `happy`, `energy`, `income` and a child-friendly `fact`. Goals live in
  `City.goals()`.
- **Business** — add to `UPGRADES` in `js/worlds/business.js`. The demand model
  is the single `Biz.simulate()` function — all the economics are in one place.

### New badges
Add an entry to `WW.Data.badges` in `js/core.js`, then call
`WW.Progress.badge('your_id')` wherever it's earned.

---

## 6. Adding a whole new world

1. **Register it** in `WW.Data.worlds` (`js/core.js`):
   ```js
   { id: 'music', name: 'Melody Meadow', emoji: '🎵', color: '#ff8ad1',
     unlockXP: 900, subject: 'Music', blurb: 'Find the rhythm!' }
   ```
2. **Add default state** in `State.defaults().worlds`:
   ```js
   music: { progress: 0, correct: 0, wrong: 0 }
   ```
3. **Add a crystal** (optional) to `WW.Data.crystals` and to
   `defaults().crystals` / `defaults().unlocked`.
4. **Add the screen shell** to `index.html`, copying an existing world block —
   you need `#screen-music`, a `.world-bar` with `id="music-back"`, and
   `#music-body`.
5. **Add a map position** in `style.css` (both the portrait rule and the
   `min-width: 820px` landscape rule):
   ```css
   .map-node[data-world="music"] { --x: 55%; --y: 45%; }
   ```
6. **Write `js/worlds/music.js`** exposing `enter()` (and optionally `back()`),
   and register it:
   ```js
   WW.Worlds.music = Music;  WW.Screens.music = Music;
   ```
7. **Load it** in `index.html` before `game.js`.
8. Award progress with `WW.Progress.addWorldProgress('music', pct)` — at 100 %
   the crystal restoration, tree growth and celebration all fire automatically.

---

## 7. Tests

Two automated suites ship with the project.

```bash
# 1. Pure game logic — no browser needed
node tools/logic-test.js

# 2. Full playthrough in a real browser
python3 -m http.server 8111 &
npm i playwright-core            # then point PW/CHROME_PATH at a Chromium
node tools/browser-test.js http://127.0.0.1:8111
```

> If the browser run fails with *"Executable doesn't exist"*, the pinned
> `playwright-core` wants a newer browser build than the local cache has.
> Either `npx playwright install`, or point it at an installed Chrome:
>
> ```bash
> CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
>   node tools/browser-test.js http://localhost:8111
> ```

**`logic-test.js` (393 checks)** verifies save/load round-trips and
forward-compatible merging, level curves, unlock thresholds, crystal
restoration, 50 000 generated maths questions (answer always present, no
duplicate options, arithmetic actually correct), story content integrity, that
all six weather types are reachable, that a well-planned green city can meet all
five goals within budget, that the lemonade economics behave (hot sells more
than wet, high price lowers demand, profit = revenue − costs), and that the
codebase contains no third-party network calls, no remote scripts, no gambling
mechanics and no timer gating. It also checks that every story passage has its own illustration,
that each one renders valid SVG with a screen-reader description and references
no external files, and that the celebration audio degrades safely when there is
no AudioContext.

**`browser-test.js` (362 checks)** plays the game: creates a character, crosses
the bridge, deliberately answers wrong to confirm hints appear and nothing
"fails" the child, reads a whole story chapter including spelling and sentence
building, runs the plant/magnet/weather experiments, builds a city and watches
the meters move, runs a day of business and checks the cash matches the stated
profit, reloads to confirm persistence, audits every visible button for the
44 pt minimum, confirms illustrations appear during the story, verifies the
cheer package fires on every celebration and that the voice can be muted
independently, and repeats key screens at iPhone portrait, **phone landscape
(844×390)**, iPad portrait and iPad landscape with big-text mode on.
Screenshots land in `.shots/`.

### What the monetization tests assert

Both suites were extended rather than replaced; every pre-existing check still
runs. The additions pin down the promises in §9:

| Promise | Where it is tested |
|---|---|
| Existing saves still load, untouched by any of this | logic §15, browser "Saves, offline and privacy" |
| The five worlds stay free and open on XP alone | logic §10 |
| Paying never bypasses a learning requirement | logic §11, browser "Paying never skips the learning" |
| A free player cannot reach Plus content | logic §10 |
| A Plus player can, once the learning is done | logic §12 |
| WonderSpace needs five crystals **and** Plus (all four combinations) | logic §12 |
| A forged `unlocked.space` flag does not help | logic §12 |
| The parental gate protects the purchase UI, including direct navigation | logic §17/§18, browser "the gate cannot be walked around" |
| The child-facing prompt contains no price and no purchase wording | logic §18, browser "what a child sees" |
| The grown-ups page contains the prices, the trial and "Cancel anytime." | browser "the grown-ups page" |
| Simulating free/trial/plus/expired works in development | logic §13/§14, browser "simulating the paid state" |
| **Production cannot be granted Plus by the mock adapter** | logic §14 |
| A Restore Purchases interface exists | logic §13 |
| Offline shell covers every new script; service worker unchanged in behaviour | logic §20 |
| No new network requests — nothing left the origin during the browser run | logic §21, browser "Saves, offline and privacy" |
| Reduced motion, big text and 44 pt targets hold on the new screens | browser, throughout |

### What the WonderTutor tests assert

Suites §22–§28 of the logic tests, plus a dedicated browser block that drives
the whole first-run flow. Full mapping in
[docs/WONDERTUTOR.md §24](docs/WONDERTUTOR.md#24-tests).

| Promise | Where it is tested |
|---|---|
| The tutor refuses to start without a grade a grown-up set | logic §22, browser |
| No age or birth-date field exists anywhere in setup | browser (inspects the DOM, not the copy) |
| The diagnostic adapts — up on success, **down** on repeated difficulty | logic §24 (all-right and all-wrong runs) |
| Skills in different subjects hold different levels | logic §25 |
| A level never rises without the mastery to back it | logic §25 |
| Foundations are taught before what sits on top of them | logic §26 |
| All 12 languages appear; Kosraean and Hawaiian are not teachable yet | logic §23, browser |
| Tutoring language and language-being-learned never bleed into each other | logic §23 |
| **An invented animation state cannot reach the renderer** | logic §28, browser |
| The expression layer has a deterministic answer for every signal | logic §28 |
| No API key, no model endpoint, nothing identifying in client code | logic §27 |
| The outbound context carries no nickname, email, avatar or save data | logic §27, browser |
| The tutor never asks a child for personal information | logic §27 |
| A child's own PII is stopped **on the device**, before any request | logic §27 |
| A wrong answer is met with encouragement and never with shaming | browser |
| No price, no purchase wording and no token counter is shown to a child | browser |
| **Killing `fetch` outright does not break the tutor or the game** | browser |
| Reduced motion stops the movement but the face still changes | browser |
| Existing saves, monetization, entitlements and free worlds are untouched | logic §28 |
| Tutoring rewards cannot be farmed by repeating one lesson | logic §28 |
| **Talking out loud is off until a grown-up consents, and is revocable** | logic §29, browser |
| A child with no consent is offered no microphone at all | browser |
| The microphone starts disabled and is push-to-talk only | logic §29 |
| Leaving the screen kills any live voice session | logic §29, browser |
| Spoken transcripts are screened like typed text | logic §29 |
| No audio is stored anywhere, and the API key never reaches the browser | logic §29 |
| The voice budget bites daily and monthly, and the child never sees a number | logic §29, browser |
| The privacy policy shipped with the feature, not after it | logic §29 |

---

## 8. Deploying to Cloudflare Pages

The game is static files plus one Pages Function, so there is no build step.

### First deploy
1. Push this repo to GitHub.
2. Cloudflare dashboard → **Workers & Pages → Create → Pages → Connect to Git**.
3. Build settings: **leave the build command empty**, set **Build output directory
   to `/`**. Save and deploy.

### Make the mailing list work (two dashboard settings)
The signup endpoint returns `503 not_configured` until both of these exist. The
form degrades to a "email us instead" link, so **it fails quietly** — set these
before you share the link.

1. **Workers & Pages → KV → Create namespace**, call it `wonderworld-subscribers`.
2. Your Pages project → **Settings → Functions → KV namespace bindings** →
   add `SUBSCRIBERS` → the namespace above.
3. Your Pages project → **Settings → Environment variables** → add
   `EXPORT_TOKEN`, set to a long random string (`openssl rand -hex 32`).
   Mark it **encrypted**.
4. Redeploy once so the bindings attach.

> ⚠️ **Do not add a `wrangler.toml` with `pages_build_output_dir`.** If that file
> exists, Cloudflare treats it as the source of truth and the dashboard bindings
> above become read-only — `SUBSCRIBERS` never binds and every signup silently
> fails. This repo deliberately has no `wrangler.toml` for that reason.

### Download the list
```bash
curl -H "Authorization: Bearer $EXPORT_TOKEN" \
     https://yourdomain.com/api/subscribers -o subscribers.csv
```
The token is header-only on purpose — a token in a query string ends up in server
logs, shell history and browser history. The endpoint fails closed: if
`EXPORT_TOKEN` is unset it refuses every request.

### Local development with the API working
```bash
npx wrangler pages dev . --kv SUBSCRIBERS --binding EXPORT_TOKEN=dev-token
```
Plain `python3 -m http.server` also works for everything except `/api/*`.

### Recommended hardening in the dashboard
- **Security → WAF → Rate limiting rules**: 5 requests / 10 min per IP on
  `/api/subscribe`. The in-code limiter is best-effort only — KV allows one write
  per second per key, so it cannot be relied on during an actual flood.
- **SSL/TLS → Edge Certificates → Enable HSTS** (off by default).
- Consider **Turnstile** on the form if bots find it.

### Every deploy
**Bump `VERSION` in `sw.js`.** Old caches are deleted on activate; that constant is
what triggers it. Forget, and returning visitors keep the previous version.

### After the first deploy, confirm nothing leaked
```bash
for p in /tools/browser-test.js /README.md /functions/api/subscribe.js /nonexistent; do
  curl -s -o /dev/null -w "%{http_code} $p\n" https://yourdomain.com$p
done
```
`/functions/*` and `/nonexistent` must be 404. `tools/` and `README.md` are
tracked files and *will* be served — harmless (no secrets), but if you'd rather
they weren't, move the eight shipping items into a `public/` directory and set the
build output directory to `public`.

### Cloudflare Pages specifics already handled
| Gotcha | How it's dealt with |
|---|---|
| `/index.html` 308-redirects to `/` | `sw.js` precaches canonical URLs (`./`, `privacy`) and refuses to cache any redirected response — a redirected response can never satisfy a navigation, which silently breaks offline launch |
| No `404.html` ⇒ SPA fallback | `404.html` exists, so unknown paths 404 instead of serving the game at a broken base URL |
| `_headers` ignores Functions | Both Functions set their own `cache-control`, `nosniff` and `referrer-policy` |
| No content hashing | Navigations and `.js`/`.css` are network-first, so new HTML can never run against old JavaScript |

---

## 9. Monetization architecture

Full detail, including the StoreKit integration steps, is in
**[docs/MONETIZATION.md](docs/MONETIZATION.md)**. This section is the summary.

### Free vs WonderWorld+

The free game is the whole game that exists today, and it stays that way.

| | Free | WonderWorld+ |
|---|---|---|
| Character creation and companions | ✅ | ✅ |
| Math Island, Story Forest, Science Lab, Planet City, Business Town | ✅ | ✅ |
| All five Knowledge Crystals and the complete Knowledge Tree quest | ✅ | ✅ |
| XP, gems, levels, badges | ✅ | ✅ |
| One Explorer, saved locally | ✅ | up to 4 |
| Progress summary for grown-ups | ✅ | plus the advanced report |
| Activity history kept | 60 | 400 |
| Accessibility, audio, read-aloud | ✅ | ✅ |
| WonderSpace and future premium worlds | — | ✅ |
| Extra story chapters and Math modes | — | ✅ |
| Progress backup / cloud sync | — | ✅ (interface only so far) |
| Extra Explorer customisation | — | ✅ (never sold separately) |

Prices prepared in the UI: **$39.99/year** (recommended, 7-day free trial, shown
as about $3.33/month) and **$6.99/month**. Nothing can be bought yet — no
provider is connected.

### Two axes: learning and tier

Every piece of content has a **learning** requirement (XP or crystals) and a
**tier** (`free` / `plus`). Both must pass, and learning is always checked and
reported first.

```
WonderSpace  =  all five crystals  AND  WonderWorld+
```

A subscriber with zero crystals cannot open WonderSpace. There is a test for
exactly that, and a second one proving a forged `unlocked.space` flag does not
help either.

### Marking content free or plus

Add `tier` to the world's entry in `WW.Data.worlds` (`js/core.js`). That is the
whole job — the map, the entitlement check and the child-facing prompt all read
it. Its learning requirement stays where it already is (`unlockXP` or
`requiresCrystals`), so there is one source of truth.

```js
{ id: 'ocean', name: 'Ocean Deep', emoji: '🐙', unlockXP: 900,
  tier: 'plus', slug: 'ocean-deep', subject: 'Biology', blurb: '…' }
```

Non-world capabilities go in `FEATURES` in `js/entitlements.js`.

### The modules

| File | Responsibility |
|---|---|
| `js/env.js` | Is this development or production? Hard-stops on `PRODUCTION_HOSTS`. |
| `js/events.js` | First-party-only event interface. Allow-listed props, no network. |
| `js/entitlements.js` | Content registry + `isPlus()`, `canAccess()`, `hasFeature()`. |
| `js/billing.js` | `WW.billing` facade and the `mock` / `apple` / `web` adapters. |
| `js/profiles.js` | Explorer roster and the save-key seam. |
| `js/sync.js` | Cloud-backup interface. No backend; reports so honestly. |
| `js/parentgate.js` | One reusable adult check, used by every adult-only door. |
| `js/plus.js` | `WW.Premium` (child prompt) and `WW.Screens.plus` (grown-ups page). |
| `js/devtools.js` | Development-only tier simulator. |

### Entitlement API

```js
WW.entitlements.isPlus()                            // free/expired → false
WW.entitlements.status()                            // 'free' | 'trial' | 'plus' | 'expired'
WW.entitlements.canAccess('math-island')            // true for everyone who earned it
WW.entitlements.canAccess('wonder-space')           // crystals AND Plus
WW.entitlements.hasFeature('multi-profile')
WW.entitlements.hasFeature('advanced-parent-reports')
WW.entitlements.hasFeature('cloud-sync')
WW.entitlements.check('wonder-space')               // { allowed, blockedBy: 'learning'|'plus', … }
```

`check()` is what UI should use — `blockedBy` is the difference between showing
a child a learning message and showing them the premium prompt.

### Billing abstraction

Application code calls `WW.billing`, never a store SDK:

```js
WW.billing.startTrial('plus_annual')
WW.billing.purchase('plus_monthly')
WW.billing.restorePurchases()
WW.billing.manageSubscription()
WW.billing.verify()
```

Three adapters. `mock` is implemented for development; `apple` and `web` are
documented stubs that resolve `{ ok: false, reason: 'not_connected' }`. There is
no fake production purchase path anywhere — if billing is not connected, the UI
says so.

### Trial and subscription state

Stored in its own key, `wonderworld.entitlement.v1`, **never** inside the
child's save:

```js
{ status, productId, provider, trialStartedAt, trialEndsAt,
  renewsAt, entitlementVerifiedAt, updatedAt }
```

A record is only honoured if `provider` is `apple` or `web`. A `mock` record is
honoured **only** in development, so one copied onto a production host reads as
`free`. An elapsed `trialEndsAt` downgrades to `expired` by itself.

### Parental gate

`WW.parentGate` is the single implementation. Two challenges, both typed rather
than tapped and both above the 12 × 12 the game itself teaches:

- `'multiply'` — `17 × 23 = ?`. The Grown-Ups dashboard, unchanged behaviour.
- `'multiply-adjust'` — read a sentence, multiply, then subtract. Used in front
  of anything involving money.

Passes are scoped (`dashboard`, `purchase`) and expire after five minutes.
Leaving the grown-ups area closes every door.

### Multiple Explorers

`wonderworld.save.v1` is **not** migrated. The roster in
`wonderworld.profiles.v1` points Explorer 1 at that exact key; additional
Explorers get `wonderworld.save.v1.explorer-N`. If `js/profiles.js` disappeared,
`js/core.js` falls back to the same key and every save still loads. The roster,
slot accounting and switch logic exist; the child-facing "who is playing?"
screen does not, so the UI lists the roster read-only.

### Cloud backup

`WW.sync.push() / .pull() / .status()` exist as an interface with a `none`
provider. Nothing is uploaded, local play is unaffected, and the grown-ups area
says plainly that backup is still being built.

### Privacy

No analytics SDK, no ad SDK, no tracking, no social login. `WW.events` buffers
in memory only, drops every property not on its allow-list, and redacts any
value matching the child's nickname. The parent's email stays in Cloudflare KV,
entirely separate from both the game save and the entitlement record. The
client still makes exactly **one** network call — the parent mailing-list
signup — and there is a test asserting it.

### Simulating free / trial / plus / expired

Only on a development host (`file://`, `localhost`, a `.local` or private-LAN
address, or `window.WW_DEV = true` — and never on a host in
`WW.env.PRODUCTION_HOSTS`):

```js
WW.dev.setTier('free')
WW.dev.setTier('trial')     // 7 days, counts as Plus
WW.dev.setTier('plus')
WW.dev.setTier('expired')
WW.dev.state()              // what the environment thinks is going on
```

Or use the **Developer tools** card at the bottom of the Grown-Ups dashboard,
which only renders in development.

---

## 10. WonderTutor

Full detail is in **[docs/WONDERTUTOR.md](docs/WONDERTUTOR.md)**; the cost model
and pricing analysis are in **[docs/TUTOR_PRICING.md](docs/TUTOR_PRICING.md)**.
This section is the summary.

WonderTutor is an animated AI tutor inside WonderWorld. It knows the child's
grade, works out their level in each skill separately, teaches short lessons,
sets practice, checks mastery, revisits what has gone stale, and advances on
evidence. It is a WonderWorld character — SVG, CSS and vanilla JS, no animation
library — not a chat window with a mascot beside it.

It is a **WonderWorld+ feature**, with a free demo. The five-world adventure is
unchanged and still free.

### It never opens with "what would you like to ask?"

```
Meet WonderTutor → Grade (a grown-up, behind the gate) → Tutoring language
  → "Let's see what you already know!" → Learning path → First lesson
```

The tutor refuses to start without a grade. We never ask for a birth date,
never ask a child's age, and never infer age from grade — there is no age field
anywhere in setup. The child's version is *"Let's see what you already know!"*;
the parent dashboard calls the same thing an **Initial Skills Assessment**.

### A child is not one number

Grade is what they are enrolled in; **level is per skill**. A Grade 2 child can
be at Grade 3 multiplication and Grade 1 spelling at once. Six domains, 34
skills, each with a grade range and prerequisites.

```js
WW.learningProfile.setGrade(2);
WW.learningProfile.band('multiplication');   // 'above'
WW.learningProfile.band('spelling');         // 'approaching'
```

Those four words — `below` / `approaching` / `on` / `above` grade level —
describe a **skill**. Nothing here diagnoses, rates or labels a child. See
[docs/WONDERTUTOR.md §2](docs/WONDERTUTOR.md#2-what-this-is-not).

**The grade is changeable at any time** — grown-ups dashboard, or the tutor
screen behind the gate. Changing it keeps everything the child has already
earned and only moves where the tutor pitches from. If questions feel too hard
or too easy, that is the dial.

### The loop

```
ASSESS → TEACH → PRACTISE → CHECK → ADAPT → REVIEW → ADVANCE
```

Practice gives help and lets the child retry; the check does not, and only the
check counts towards mastery. A missed answer gets *"Almost! Let's look at it
another way."* and a different explanation — never "wrong again".

### It works on a plane

Every question, every score, every mastery decision and every level move is
ordinary JavaScript. A model is asked only for the things it is genuinely
better at: explanations for prose skills, re-explaining after difficulty, and
answering a child's own question.

That is not only a robustness decision — it is most of the cost model. See
[§16 Cost controls](docs/WONDERTUTOR.md#16-cost-controls).

### No key in the browser

`WW.tutorProvider` talks to `/api/tutor`, a first-party Cloudflare Function on
our own origin. There is no OpenAI SDK in the client, no key, and no provider
URL — tests assert all three. **With no key configured the endpoint returns 503
and the tutor uses its offline bank, which is how this ships today.**

### Safety and privacy

The outbound context is built by **allow-list**: grade, language, skill, level,
band, small counters, world names, and one short screened question. Absent by
construction: the nickname, the avatar, the parent's email, the save file, and
any identifier. The child's own words are screened before they leave the
device, and the tutor's words are screened before the child sees them — from a
model or the offline bank alike.

The learning profile lives in its own key, `wonderworld.tutor.v1`, **never
inside the child's save**.

### The modules

| File | Responsibility |
|---|---|
| `js/tutor/languages.js` | The 12 supported languages and what we will claim about each |
| `js/tutor/taxonomy.js` | Domains, skills, grade bands, prerequisites |
| `js/tutor/profile.js` | `WW.learningProfile` — grade, language, per-skill mastery |
| `js/tutor/content.js` | Offline lesson and question bank; deterministic scoring |
| `js/tutor/safety.js` | Outbound allow-list, input and output screening |
| `js/tutor/emotion.js` | Expression allow-list + deterministic rules |
| `js/tutor/avatar.js` | `WW.tutorAvatar` — the SVG character |
| `js/tutor/voice.js` | On-device speech only |
| `js/tutor/realtime.js` | `WW.tutorVoiceChat` — spoken conversation, off by default |
| `js/tutor/provider.js` | Offline and server adapters |
| `js/tutor/assessment.js` | The adaptive diagnostic |
| `js/tutor/engine.js` | `WW.tutor` — skill choice, rewards, access |
| `js/tutor/session.js` | One running lesson |
| `js/tutor/screen.js` | The UI |

### Languages

Twelve **Supported Languages** — deliberately not called the world's most-spoken,
because rankings disagree. Quality is **not** claimed to be equal:

- **supported** — English. Human-written, reviewed content.
- **beta** — nine languages the model can tutor in, with no native-speaker
  review. The UI says so.
- **experimental** — Kosraean and Hawaiian. Listed and visible, but **not**
  offered as a teaching medium until a native speaker validates them.

Tutoring language (what the tutor *speaks*) and a language being learned (a
*subject*) are separate fields and neither is ever inferred from the other.

### Free vs WonderWorld+

```js
WW.tutor.ACCESS = {
  freeAssessment: true,    // the whole diagnostic, free
  freeLessons: 1,          // then the premium door
  plusLessonsPerDay: 40    // fair use, shown to parents only
};
```

A child never sees a price, a token counter or a quota. At the door they get
the same friendly handover as every other premium feature.

### Talking out loud

WonderTutor can hold a spoken conversation — the child holds a button, speaks,
and hears it answer. **This is the only feature in WonderWorld that sends
anything off the device from the microphone,** and it is gated three times:

1. **Server** — `TUTOR_REALTIME_ENABLED` must be explicitly `true`. Off until
   the privacy review is done, so the code can ship before the decision does.
2. **Parent** — the parental gate plus versioned, revocable consent on a page
   that says plainly what is being agreed to.
3. **Child** — push-to-talk. The microphone track is disabled between turns,
   genuinely off rather than live and ignored, with a red indicator and a
   written status line whenever it is on.

Nothing is recorded or stored by us; audio goes browser↔provider directly.
Transcripts are screened exactly like typed text, and unsafe speech is cut
mid-utterance.

It also carries a real budget, because unlike typed tutoring it costs about
3–4 cents a *minute*: 20 minutes a day and 120 a month for subscribers, none
for free Explorers. The child never sees a number — out of allowance reads as
*"My talking voice needs a rest."* See
[docs/TUTOR_PRICING.md §5a](docs/TUTOR_PRICING.md#5a-the-voice-budget).

### Failure mode

No internet, no key, a dead endpoint, a 503, no speech synthesis, a refused
microphone, a spent voice budget — the tutor keeps teaching from its offline
bank, and the rest of WonderWorld is untouched. When there is genuinely nothing
to do: *"WonderTutor is resting right now. You can keep exploring
WonderWorld!"*

---

## 11. Sound and celebrations

All audio is generated at runtime — there are no sound files to download.

| Sound | How it's made |
|---|---|
| Chimes (tap, correct, hint, coin, unlock, crystal) | Oscillators with short envelopes |
| **Applause** | ~40 short bursts of band-pass-filtered noise, scattered over ~2 s with random pitch and timing, so it sounds like a small crowd rather than one looped clip |
| **Fanfare** | Four different melodies, picked at random and never repeated back to back |
| **Spoken praise** | The device's own speech synthesiser: *"Great job!"*, *"You did amazing!"*, *"You're a superstar!"* — 15 phrases, never the same one twice in a row, and about 45% of the time it uses the child's name (*"Brilliant, Ada!"*) |

`WW.Sound.win('big')` fires the whole package — fanfare, then applause, then a
spoken cheer — and is called at every genuine completion: finishing a bridge,
finishing a story chapter, solving a whole experiment, meeting all five city
goals, finishing a business week, levelling up, and restoring a crystal.
`WW.Sound.win('small')` is a shorter version for a profitable business day. A
short *"Nice!"* also drops in on every third correct answer in a row.

Two independent switches in **Settings**:
- **Sound effects** — the master mute (silences the voice too)
- **Cheering voice** — turns off only the spoken praise, keeping the chimes and
  applause, for families who find text-to-speech distracting

## 12. What it teaches

| World | Skills |
|---|---|
| 🧮 **Math Island** | Addition, subtraction, multiplication, division, comparing, fractions, money and change, one- and two-step word problems. Difficulty adapts per child. |
| 📚 **Story Forest** | Phonics, rhyming, vocabulary in context, spelling, sentence construction, reading comprehension — inside a real three-chapter story, with an illustration and optional read-aloud on every page. |
| 🧪 **Science Lab** | Cause and effect. Plants need water, light and good soil (and can be over-watered); magnets attract iron/steel but not copper or aluminium; temperature, moisture and wind combine into weather. |
| 🌎 **Planet City** | Sustainability trade-offs: renewable energy, recycling, green space, public transport, pollution, and the tension between money and the environment. |
| 💰 **Business Town** | Costs, pricing, revenue, profit, over-production waste, reputation, saving, interest and investment — with the arithmetic written out every day. |

The **Grown-Ups dashboard** (title screen → *Grown-Ups*) shows total learning
time, activities completed, per-subject accuracy and completion, recent
accomplishments, and suggests what to practise next. It is visually distinct
from the child's game and needs no login.

---

## 13. Child-safety design

**Included:** XP, gems, badges, Knowledge Tree growth, world unlocking,
celebration animations, encouraging feedback, and hints instead of failure.

**Deliberately excluded:** loot boxes, gambling, randomised or paid rewards,
consumable purchases of any kind, advertising, manipulative timers, FOMO, fake
scarcity, energy/lives systems, autoplay, push notifications, leaderboards,
chat, social features, analytics, and any collection of personal information
from children.

**On the optional subscription.** WonderWorld+ sells *more content*, never an
advantage. XP, gems, crystals, answers and hints are not and will not be for
sale, and no purchase can satisfy a learning requirement — `WW.entitlements`
checks learning first and reports it first, and the test suite enforces it. The
child never sees a price: reaching premium content shows a friendly "ask a
grown-up" message, and every price sits behind a parental gate. See §9.

The five-world, five-crystal adventure is **never** locked behind payment — its
worlds unlock purely through learning, and always will. A wrong answer produces a hint and a second try; after a
second miss the game shows the answer and lets the child tap it, so no one ever
gets stuck or shamed.

Accessibility: 44 pt+ touch targets, a "bigger text" mode, a "reduce motion"
mode (which also respects `prefers-reduced-motion`), a mute button, ARIA labels
and live regions throughout, visible focus rings, text-and-icon labels so no
information is conveyed by colour alone, and optional read-aloud for story
passages via the device's speech synthesiser.

---

## 14. Packaging it as an iOS / iPadOS app

### Option A — Home Screen web app (zero work, available today)
Safari → **Share → Add to Home Screen**. Full-screen, offline-capable once
cached, own icon. Good for family use and for testing with real children.
Cannot be listed on the App Store.

### Option B — Native wrapper (App Store ready, ~an hour)
1. Xcode → **New Project → App → Interface: Storyboard**.
2. Drag the whole WonderWorld folder into the project, choosing
   **"Create folder references"** (blue folder, preserves `js/worlds/`).
3. Replace `ViewController.swift` with:

```swift
import UIKit
import WebKit

class ViewController: UIViewController {
    private var webView: WKWebView!

    override func viewDidLoad() {
        super.viewDidLoad()
        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []

        webView = WKWebView(frame: .zero, configuration: config)
        webView.scrollView.bounces = false
        webView.isOpaque = false
        webView.backgroundColor = UIColor(red: 0.11, green: 0.06, blue: 0.25, alpha: 1)
        view.addSubview(webView)
        webView.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            webView.topAnchor.constraint(equalTo: view.topAnchor),
            webView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            webView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: view.trailingAnchor)
        ])

        let root = Bundle.main.url(forResource: "index", withExtension: "html",
                                   subdirectory: "WonderWorld")!
        webView.loadFileURL(root, allowingReadAccessTo: root.deletingLastPathComponent())
    }

    override var prefersStatusBarHidden: Bool { true }
}
```

4. In **Info.plist** set `UIRequiresFullScreen` = YES and allow all
   orientations.
5. Produce PNG app icons from `assets/icon.svg` (1024×1024 for the App Store).
6. **App Store checklist for a kids' app:** choose the *Kids 5 and under* /
   *6–8* / *9–11* age band, declare **no data collected** in App Privacy (true —
   nothing leaves the device), confirm no third-party analytics or ads, and
   include a privacy policy URL stating that all data is stored locally.

### Option C — Capacitor (adds native APIs, iOS + Android from one codebase)
```bash
npm init -y
npm i @capacitor/core @capacitor/cli @capacitor/ios
npx cap init WonderWorld com.example.wonderworld --web-dir=.
npx cap add ios
npx cap open ios
```

### Option D — Unity / Godot rewrite
The content is already separated from the presentation, which makes this the
easy path: `WW.Data`, the `GENERATORS` array, `CHAPTERS`, `PLANT_RESULTS`,
`MAGNET_OBJECTS`, `BUILDINGS` and `UPGRADES` are plain data structures that port
directly to JSON/ScriptableObjects. `Biz.simulate()`, `City.stats()`,
`weatherFor()` and `Progress.*` are pure functions with no DOM dependency — port
them as-is and rebuild only the rendering layer.

---

## 15. Performance notes

No frameworks, no bundler, no fonts to download, no images to fetch. All art —
including the eleven story illustrations — is SVG, CSS gradients and emoji; all
sound, applause included, is generated at runtime with Web Audio.
Total payload is a few hundred kilobytes of text, so it loads instantly on a
phone and runs smoothly on older iPads. Animations are transform/opacity only,
and every one of them is disabled under `prefers-reduced-motion` or the in-game
"reduce motion" setting.

---

## 16. Roadmap

- 🚀 **WonderSpace** — the sixth world. Already declared `tier: 'plus'` and
  gated on all five crystals, but the world itself is not built: it still shows
  a "coming in the next update" message. The registration pattern in §6 is how
  it gets built.
- A cosmetic gem shop: outfits, companion accessories and tree decorations.
  Bought with gems that are **earned by learning** — gems are never sold.
- More story chapters and a second maths game mode (both `tier: 'plus'`).
- The "who is playing?" screen that turns the Explorer roster in §9 into a real
  multi-child switcher.
- A first-party backup service behind `WW.sync`, with the privacy review and
  policy update that has to come first.
- Connecting Apple StoreKit — step-by-step in
  [docs/MONETIZATION.md](docs/MONETIZATION.md).

**WonderTutor next steps** (detail in
[docs/WONDERTUTOR.md §25](docs/WONDERTUTOR.md#25-production-risks)):

- Decide the pricing question in
  [docs/TUTOR_PRICING.md §8](docs/TUTOR_PRICING.md#8-recommendation) — the AI
  cost turns out to be ~2 cents per subscriber per month, so a price change is
  a value decision, not a cost one.
- **Native-speaker validation for one beta language end to end** (Spanish
  first), including a per-language content pack. That turns the multilingual
  claim from architecture into product.
- A lesson-sampling review tool. Safety filters catch categories of bad output;
  they do not catch a confidently wrong explanation of fractions.
- Turn the Decisions API expression layer on behind a flag and measure whether
  anyone can tell it from the deterministic rules.

# learn-wonder-land
