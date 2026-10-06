# 🌳 WonderWorld — A Magical Learning Adventure

An educational adventure game for children roughly **ages 5–12**, built in plain
HTML5, CSS3 and vanilla JavaScript. No build step, no server, no database, no
accounts, no network calls, no ads and no purchases.

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
├── style.css                  all styling, 15 labelled sections
├── game.js                    entry point — boots everything
├── js/
│   ├── core.js                engine: utilities, game data, audio, save/load,
│   │                          player state, progression, rewards, FX, avatar
│   │                          art, companion, HUD, screen router, settings
│   ├── art.js                 hand-drawn SVG illustrations for the story
│   ├── screens.js             title, character creator, world map,
│   │                          Knowledge Tree, profile, parent dashboard
│   └── worlds/
│       ├── math.js            Math Island — adaptive question engine + bridge
│       ├── story.js           Story Forest — interactive story + reading games
│       ├── science.js         Science Lab — plant, magnet, weather experiments
│       ├── city.js            Planet City — sustainable city builder
│       └── business.js        Business Town — lemonade stand simulation
├── assets/
│   ├── icon.svg               app icon (pure SVG — nothing to break)
│   └── manifest.webmanifest   installable web app metadata
├── tools/
│   ├── logic-test.js          headless game-logic tests (node)
│   └── browser-test.js        full automated playthrough (headless browser)
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
```

No module reaches into another's internals — worlds only talk to
`WW.Progress`, `WW.State` and `WW.UI`. That's what keeps a port to Unity/Godot
or a native rewrite tractable.

---

## 4. The save system

| | |
|---|---|
| **Where** | `localStorage`, key `wonderworld.save.v1` |
| **What** | One JSON object: character, XP, level, gems, crystals, unlocked worlds, per-world state, badges, activity log, play-time stats, settings |
| **When** | Debounced ~400 ms after any change; immediately on level-up, crystal restoration, tab hide and page unload |
| **Leaves the device?** | Never. There is no network code anywhere in the project |

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

**`logic-test.js` (59 checks)** verifies save/load round-trips and
forward-compatible merging, level curves, unlock thresholds, crystal
restoration, 50 000 generated maths questions (answer always present, no
duplicate options, arithmetic actually correct), story content integrity, that
all six weather types are reachable, that a well-planned green city can meet all
five goals within budget, that the lemonade economics behave (hot sells more
than wet, high price lowers demand, profit = revenue − costs), and that the
codebase contains no network calls, no remote scripts, no monetisation and no
timer gating. It also checks that every story passage has its own illustration,
that each one renders valid SVG with a screen-reader description and references
no external files, and that the celebration audio degrades safely when there is
no AudioContext.

**`browser-test.js` (104 checks)** plays the game: creates a character, crosses
the bridge, deliberately answers wrong to confirm hints appear and nothing
"fails" the child, reads a whole story chapter including spelling and sentence
building, runs the plant/magnet/weather experiments, builds a city and watches
the meters move, runs a day of business and checks the cash matches the stated
profit, reloads to confirm persistence, audits every visible button for the
44 pt minimum, confirms illustrations appear during the story, verifies the
cheer package fires on every celebration and that the voice can be muted
independently, and repeats key screens at iPhone, iPad-portrait and
iPad-landscape sizes with big-text mode on. Screenshots land in `.shots/`.

---

## 8. Sound and celebrations

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

## 9. What it teaches

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

## 10. Child-safety design

**Included:** XP, gems, badges, Knowledge Tree growth, world unlocking,
celebration animations, encouraging feedback, and hints instead of failure.

**Deliberately excluded:** loot boxes, gambling, randomised or paid rewards,
in-app purchases, advertising, manipulative timers, FOMO, fake scarcity,
energy/lives systems, autoplay, push notifications, leaderboards, chat, social
features, analytics, and any collection of personal information.

Educational content is **never** locked behind payment — worlds unlock purely
through learning. A wrong answer produces a hint and a second try; after a
second miss the game shows the answer and lets the child tap it, so no one ever
gets stuck or shamed.

Accessibility: 44 pt+ touch targets, a "bigger text" mode, a "reduce motion"
mode (which also respects `prefers-reduced-motion`), a mute button, ARIA labels
and live regions throughout, visible focus rings, text-and-icon labels so no
information is conveyed by colour alone, and optional read-aloud for story
passages via the device's speech synthesiser.

---

## 11. Packaging it as an iOS / iPadOS app

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

## 12. Performance notes

No frameworks, no bundler, no fonts to download, no images to fetch. All art —
including the eleven story illustrations — is SVG, CSS gradients and emoji; all
sound, applause included, is generated at runtime with Web Audio.
Total payload is a few hundred kilobytes of text, so it loads instantly on a
phone and runs smoothly on older iPads. Animations are transform/opacity only,
and every one of them is disabled under `prefers-reduced-motion` or the in-game
"reduce motion" setting.

---

## 13. Roadmap

- 🚀 **WonderSpace** — the sixth world, unlocked when all five crystals are
  restored. It currently shows a completion message; the registration pattern in
  §6 is how it gets built.
- A gem shop for cosmetic items: outfits, companion accessories and tree
  decorations (cosmetic only, earned by learning — never purchasable).
- More story chapters and a second maths game mode.
- Offline Service Worker for true offline play as an installed web app.
# learn-wonder-land
