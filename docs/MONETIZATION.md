# WonderWorld — Monetization architecture

The detailed reference for how WonderWorld+ works. The README has a summary in
[§9](../README.md#9-monetization-architecture); this is the long version,
written so another developer can connect Apple StoreKit — or a web payment
processor — **without redesigning the application**.

Nothing can be bought today. No billing provider is connected, and there is
deliberately no fake production purchase path anywhere in the codebase.

**Contents**

1. [The principle](#1-the-principle)
2. [Free vs WonderWorld+](#2-free-vs-wonderworld)
3. [Two axes: learning and tier](#3-two-axes-learning-and-tier)
4. [Trust model](#4-trust-model)
5. [The modules](#5-the-modules)
6. [Entitlement system](#6-entitlement-system)
7. [Marking content free or plus](#7-marking-content-free-or-plus)
8. [Billing abstraction](#8-billing-abstraction)
9. [Trial and subscription state](#9-trial-and-subscription-state)
10. [Mock billing and the tier simulator](#10-mock-billing-and-the-tier-simulator)
11. [Parental gate](#11-parental-gate)
12. [The child experience](#12-the-child-experience)
13. [The grown-ups experience](#13-the-grown-ups-experience)
14. [Multiple Explorer profiles](#14-multiple-explorer-profiles)
15. [Cloud backup](#15-cloud-backup)
16. [Events](#16-events)
17. [Privacy considerations](#17-privacy-considerations)
18. [Apple StoreKit integration path](#18-apple-storekit-integration-path)
19. [Web billing integration path](#19-web-billing-integration-path)
20. [How to test free / trial / plus / expired](#20-how-to-test-free--trial--plus--expired)
21. [What the tests assert](#21-what-the-tests-assert)
22. [Before real payments: the checklist](#22-before-real-payments-the-checklist)

---

## 1. The principle

> Educational progress is **earned by learning**, never bought.

Three rules follow, and every decision below defers to them.

1. **The existing five-crystal adventure is free and stays free.** Math Island,
   Story Forest, Science Lab, Planet City, Business Town, all five Knowledge
   Crystals and the complete Knowledge Tree quest are `tier: 'free'`. A child can
   finish the whole game without anyone paying anything.
2. **Money cannot satisfy a learning requirement.** A subscriber with zero
   crystals cannot open WonderSpace. Enforced in
   `WW.entitlements.learningMet()`, with its own tests.
3. **The child is never sold to.** Prices, the words *buy* / *subscribe* /
   *trial*, and card details all live behind the parental gate. A child who
   reaches premium content sees one friendly sentence and a way to fetch a
   grown-up.

Not sold, ever: XP, gems, crystals, answers, hints, lives, energy, or anything
randomised. No ads, no loot boxes, no countdowns, no fake scarcity, no
pay-to-win.

---

## 2. Free vs WonderWorld+

| | Free | WonderWorld+ |
|---|---|---|
| Character creation and companions | ✅ | ✅ |
| Math Island, Story Forest, Science Lab, Planet City, Business Town | ✅ | ✅ |
| All five Knowledge Crystals and the Knowledge Tree quest | ✅ | ✅ |
| XP, gems, levels, badges | ✅ | ✅ |
| One Explorer, saved locally | ✅ | up to 4 |
| Progress summary for grown-ups | ✅ | plus the advanced report |
| Activity history kept | 60 | 400 |
| Accessibility, audio, read-aloud | ✅ | ✅ |
| WonderSpace and future premium worlds | — | ✅ |
| Extra Story Forest chapters, extra Math modes | — | ✅ |
| Progress backup / cloud sync | — | ✅ (interface only so far) |
| Extra Explorer customisation | — | ✅ (never sold separately) |

Free players lose nothing that existed before WonderWorld+ was designed. The
60-activity history cap, for instance, is exactly the cap the game has always
had — Plus raises it rather than free being lowered to manufacture a gap.

### Prices prepared in the UI

| Product id | Apple product id | Price | Trial |
|---|---|---|---|
| `plus_annual` | `com.wonderworld.plus.annual` | `$39.99/year` (≈ `$3.33/month`) | 7 days |
| `plus_monthly` | `com.wonderworld.plus.monthly` | `$6.99/month` | — |

Annual is flagged `recommended: true` with a `BEST VALUE` badge and shows
*"7 Days Free"* then *"$39.99/year after your free trial"*. Every pricing
surface carries **"Cancel anytime."**

These strings live in exactly one place — `PRODUCTS` in `js/billing.js` — and a
test asserts no file except the Plus page renders a price.

---

## 3. Two axes: learning and tier

Every piece of content has two independent requirements:

```
LEARNING   earned by playing — XP thresholds, restored crystals.
           Money can NEVER satisfy this.

TIER       'free' or 'plus'. A subscription satisfies this.
           Learning can NEVER satisfy it.
```

Both must pass. WonderSpace is the first content needing both:

```
WonderSpace  =  all five crystals  AND  WonderWorld+
```

**The ordering matters.** `check()` evaluates learning first and reports it
first, so a subscriber who has not earned the content sees the learning message,
never a sales message:

```js
var blockedBy = null;
if (!learnOk)      blockedBy = 'learning';
else if (!tierOk)  blockedBy = 'plus';
```

A crystal requirement is **recomputed from the crystals themselves on every
check**, never satisfied by the persisted `unlocked` flag:

```js
if (world.requiresCrystals) {
  return !!(WW.Progress && WW.Progress.crystalCount() >= 5);
}
```

That is the specific guard that stops a forged `unlocked.space` flag in
localStorage from skipping the adventure. There is a test for exactly that.

---

## 4. Trust model

*Referenced from `js/env.js` and `js/entitlements.js`.*

The browser is **not** the authority on whether someone has paid. It holds a
cached answer; the authority is receipt verification by Apple, or by our own
server for web billing. The layers below are guard-rails that keep development
tooling from ever becoming a free unlock — they are not a security boundary, and
are not intended as one.

### Three independent layers

**Layer 1 — `WW.env.isDev()` is biased towards "no".** Evaluated in order:

```
1. A host in PRODUCTION_HOSTS is NEVER dev.   ← hard stop, nothing overrides it
2. window.WW_DEV === true                     ← CI, native debug builds
3. file://                                    ← building content off disk
4. localhost / 127.0.0.1 / *.local / private LAN ranges
5. anything else, including unknown public domains → production
```

With no `location` at all (the headless logic tests run in a bare VM context)
the answer is **production**. Tests opt *into* development explicitly; they never
fall into it by accident.

> ⚠️ **`PRODUCTION_HOSTS` must be updated at the moment a custom domain is
> pointed at the site.** Until a hostname is listed, it is merely "an unknown
> public domain" — still production by rule 5, so the mock stays unavailable, but
> listing it makes the hard stop explicit and survives future edits to the
> heuristics.

**Layer 2 — the mock adapter re-checks.** `mock.isAvailable()` is false unless
`WW.env.isDev()`, so calling `WW.billing.providers.mock.purchase()` directly in
production does nothing.

**Layer 3 — provider provenance on the record.**

```js
var TRUSTED_PROVIDERS = ['apple', 'web'];

recordIsTrusted: function () {
  var rec = Ent.record();
  if (TRUSTED_PROVIDERS.indexOf(rec.provider) !== -1) return true;
  if (rec.provider === 'mock') return !!(WW.env && WW.env.isDev());
  return false;
}
```

An untrusted record reads as `'free'`. So a `provider: 'mock'` record copied by
hand into localStorage on the live site grants nothing. A corrupt or unparseable
record also falls back to `free` — never to paid.

### What this does *not* claim

A determined adult can open devtools and write `provider: 'apple'` into
localStorage on their own device. That is true of every client-side cache of an
entitlement, and it is why **`verify()` exists**: once a real provider is
connected, the app re-asks the source of truth on launch and a forged record is
corrected the first time the device is online. The bar is "a child cannot unlock
this, and a forged record does not survive verification" — not "uncrackable".

---

## 5. The modules

Load order is fixed in `index.html`, all before `js/screens.js` and
`js/plus.js`, which consume them:

| File | Responsibility |
|---|---|
| `js/env.js` | Is this development or production? Hard-stops on `PRODUCTION_HOSTS`. |
| `js/events.js` | First-party-only event interface. Allow-listed props, no network. |
| `js/entitlements.js` | Content registry + `isPlus()`, `canAccess()`, `hasFeature()`, `check()`. |
| `js/billing.js` | `WW.billing` facade and the `mock` / `apple` / `web` adapters. |
| `js/profiles.js` | Explorer roster and the `activeSaveKey()` seam. |
| `js/sync.js` | Cloud-backup interface. No backend; reports so honestly. |
| `js/parentgate.js` | One reusable adult check, used by every adult-only door. |
| `js/plus.js` | `WW.Premium` (child prompt) and `WW.Screens.plus` (grown-ups page). |
| `js/devtools.js` | Development-only tier simulator. |

All plain IIFE-wrapped vanilla JS hanging off `window.WW`, exactly like the rest
of the game. **No build step, no bundler, no npm dependency was added**, and
`file://` development still works.

Changes to pre-existing files are additive seams only:

- `js/core.js` — `tier` and `slug` on each world; a `saveKey()` indirection; the
  activity-history cap reads `WW.entitlements.historyLimit()`.
- `js/screens.js` — the map and grown-ups dashboard consult `WW.entitlements`;
  the gate challenge moved into `WW.parentGate`.
- `index.html`, `sw.js` — the new scripts, pre-cached for offline.

---

## 6. Entitlement system

### Public API

```js
WW.entitlements.isPlus()                       // true for 'plus' and 'trial'
WW.entitlements.status()                       // 'free' | 'trial' | 'plus' | 'expired'
WW.entitlements.isTrial()
WW.entitlements.isExpired()
WW.entitlements.isSimulated()                  // Plus only because of the dev mock
WW.entitlements.trialDaysLeft()

WW.entitlements.canAccess('math-island')       // true for everyone who earned it
WW.entitlements.canAccess('wonder-space')      // crystals AND Plus
WW.entitlements.check('wonder-space')          // the full answer, with the reason

WW.entitlements.hasFeature('multi-profile')
WW.entitlements.hasFeature('advanced-parent-reports')
WW.entitlements.hasFeature('cloud-sync')

WW.entitlements.maxProfiles()                  // 1 free, 4 on Plus
WW.entitlements.historyLimit()                 // 60 free, 400 on Plus

WW.entitlements.onChange(fn)                   // re-render when the tier changes
```

`canAccess()` takes either a friendly slug (`'math-island'`) or the internal
world id (`'math'`).

### `check()` is what UI should call

```js
{
  id: 'wonder-space',
  known: true,
  world: 'space',
  tier: 'plus',
  allowed: false,
  learningMet: false,
  tierMet: true,
  needsPlus: true,
  blockedBy: 'learning',          // 'learning' | 'plus' | 'unknown' | null
  learningHint: 'Restore all 5 Knowledge Crystals first.'
}
```

`blockedBy` is the difference between showing a child a *learning* message and
showing them the *premium* prompt. `learningHint` is deliberately a child-safe
sentence that never mentions money.

Unknown content ids return `{ known: false, allowed: false, blockedBy:
'unknown' }` and `console.warn` in development — refusing, loudly, rather than
failing open.

### The content registry

```js
WW.Content.world('math-island')   // the WW.Data.worlds entry
WW.Content.feature('cloud-sync')  // the FEATURES entry
WW.Content.tierOf(id)             // 'free' | 'plus' | null
WW.Content.plusCatalogue()        // everything Plus includes, for the parent page
WW.Content.register(id, def)      // runtime registration by a future module
```

Content with no `tier` is treated as **free**. Free is the safe default: a world
added without thinking about monetization stays open to everyone rather than
silently locking itself.

---

## 7. Marking content free or plus

### A world

Add `tier` to the world's entry in `WW.Data.worlds` (`js/core.js`). That is the
whole job — the map, the entitlement check, the child prompt and the Plus page
catalogue all read it.

```js
{ id: 'ocean', name: 'Ocean Deep', emoji: '🐙', color: '#3bb0e8',
  unlockXP: 900,              // the LEARNING requirement
  tier: 'plus',               // the SUBSCRIPTION requirement
  slug: 'ocean-deep',
  subject: 'Biology', blurb: 'Dive deep and meet the creatures of the reef.' }
```

If the world needs the full adventure first, use `requiresCrystals: true`
instead of `unlockXP` — that is how WonderSpace is declared. Add the slug to
`SLUGS` in `js/entitlements.js` if you want the friendly id to resolve, and
register the world module the normal way (README §6).

### A non-world capability

Add it to `FEATURES` in `js/entitlements.js`:

```js
'extra-companions': { tier: 'plus', name: 'More companions',
                      blurb: 'Included with WonderWorld+ — never sold separately.' }
```

Then gate the UI with `WW.entitlements.hasFeature('extra-companions')`.

### From a future world module, without editing this file

```js
WW.Content.register('ocean-bonus-chapter', { tier: 'plus', name: 'The Deep Trench' });
```

### The rule for new content

Ask: *does this gate learning?* If a child needs it to finish the five-crystal
adventure, or to progress along any path the free game sets them on, it is
`free`. Plus is for **expansion** — new worlds, new chapters, new modes, family
features — never for carving pieces out of what already exists.

---

## 8. Billing abstraction

Application code calls `WW.billing` and nothing else. No StoreKit-specific
logic, no payment SDK, no checkout URL appears anywhere else in the game.

```js
WW.billing.startTrial('plus_annual')     // -> Promise<Result>
WW.billing.purchase('plus_monthly')      // -> Promise<Result>
WW.billing.restorePurchases()            // -> Promise<Result>
WW.billing.manageSubscription()          // -> Promise<Result>
WW.billing.verify()                      // -> Promise<Result>

WW.billing.productList()                 // [plus_annual, plus_monthly]
WW.billing.product('plus_annual')
WW.billing.isAvailable()                 // can anything be bought from here?
WW.billing.isSimulatedOnly()             // the only provider is the dev mock
WW.billing.providerName()                // 'apple' | 'web' | 'mock' | null
```

`Result` is always the same shape:

```js
{ ok: boolean, reason: string|null, status: string|null }
```

Known reasons: `not_connected`, `not_available`, `unknown_product`,
`nothing_to_restore`, `provider_error`, `simulated`.

### The provider interface

Every adapter implements exactly this:

| Member | Returns |
|---|---|
| `name` | string |
| `isAvailable()` | boolean — can this provider transact *here*? |
| `products()` | array of `PRODUCTS` entries it can sell |
| `startTrial(productId)` | `Promise<Result>` |
| `purchase(productId)` | `Promise<Result>` |
| `restorePurchases()` | `Promise<Result>` |
| `manageSubscription()` | `Promise<Result>` |
| `verify()` | `Promise<Result>` — re-check with the source of truth |

**A provider never writes to localStorage itself.** It verifies, then hands a
record to `WW.entitlements.apply()`. That keeps *what the player is entitled to*
in one module and *how we found out* in another.

### Provider selection

```js
autoSelect: function () {
  if (apple.isAvailable()) return 'apple';   // a real native store
  if (web.isAvailable())   return 'web';     // a real web processor
  if (mock.isAvailable())  return 'mock';    // the dev simulator, last
  return null;                               // nothing can be bought here
}
```

The mock is last and only ever in development. When `providerName()` is `null`,
the Plus page says plainly that WonderWorld+ is not on sale yet rather than
showing a dead button.

### Current state of the three adapters

| Adapter | State |
|---|---|
| `mock` | Implemented. Development only. See §10. |
| `apple` | Documented stub. `_send()` resolves `{ ok: false, reason: 'not_connected' }`. `_receive()` is **already written** — see §18. |
| `web` | Documented stub. `isAvailable()` hard-coded `false`. See §19. |

---

## 9. Trial and subscription state

### Where it lives

Its own localStorage key — **never** inside the child's save:

```
wonderworld.entitlement.v1
```

Two reasons. The child's save stays byte-for-byte what it has always been, so
nothing in the monetization layer can corrupt a game in progress; and a
subscription is a property of the *grown-up's account*, not of any one Explorer
— when the profile switcher ships, all four Explorers share one subscription.

### The record

```js
{
  version: 1,
  status: 'free',              // free | trial | plus | expired
  productId: null,             // 'plus_annual' | 'plus_monthly'
  provider: 'none',            // none | mock | apple | web
  trialStartedAt: null,
  trialEndsAt: null,
  renewsAt: null,
  entitlementVerifiedAt: null,
  updatedAt: null
}
```

### The four states

| Status | `isPlus()` | Meaning |
|---|---|---|
| `free` | false | No subscription, or an untrusted/corrupt record. |
| `trial` | **true** | Inside the 7-day free trial. Full Plus access. |
| `plus` | **true** | Active paid subscription. |
| `expired` | false | Trial elapsed or subscription lapsed. |

### Self-downgrading

`status()` is computed, not merely read. An elapsed `trialEndsAt` reads as
`expired` without anything having to run:

```js
if (rec.status === 'trial') {
  if (rec.trialEndsAt && Date.now() > rec.trialEndsAt) return 'expired';
  return 'trial';
}
```

This matters because the device may be offline for the whole trial.

### What `expired` must never do

Lapsing **never deletes anything**. Extra Explorers become read-only rather than
removed (`WW.profiles.lockedProfiles()`); history already recorded is not
truncated; and every crystal, badge and XP point the child earned stays theirs
forever. Deleting a child's progress because a card expired would be
indefensible.

### Reacting to changes

```js
WW.entitlements.onChange(function (rec) { /* re-render */ });
```

`apply()` fires listeners and emits an `entitlement_changed` event.

---

## 10. Mock billing and the tier simulator

### Why it exists

The complete WonderWorld+ experience — the child prompt, the gate, the parent
page, the trial banner, what an expired subscription looks like — has to be
designed, reviewed and tested *before* StoreKit is connected. The mock makes
that possible without inventing a fake payment path.

### Why it cannot leak into production

Three independent layers must fail at once; see [§4](#4-trust-model).
`WW.dev.available()` → `mock.isAvailable()` → `provider: 'mock'` rejected by
`recordIsTrusted()`.

### Using it

From the console:

```js
WW.dev.setTier('free');
WW.dev.setTier('trial');     // 7-day trial on plus_annual
WW.dev.setTier('plus');
WW.dev.setTier('expired');   // a trial that ended yesterday

WW.dev.state();              // env, status, provider, profile slots
```

From the UI: **Grown-Ups → Developer tools**. `WW.dev.panel()` returns `null` in
production, so the caller appends it unconditionally and nothing appears.

In production `WW.dev.setTier()` returns `{ ok: false, reason: 'not_available' }`
and logs a warning. It is inert, not absent — the file still loads, which keeps
the offline shell and the script list identical across environments.

### Honest labelling

When the mock is the only available provider, the Plus page says so.
`WW.entitlements.isSimulated()` is true whenever Plus is active *because of* a
mock record; `WW.billing.isSimulatedOnly()` is true when `autoSelect()` fell all
the way through to `mock`. Neither is ever true in production.

---

## 11. Parental gate

`WW.parentGate` is the single implementation. Nothing duplicates it.

### What it guards

- The Grown-Ups dashboard (settings, progress report, email sign-up, reset)
- The WonderWorld+ page, **including a direct `Nav.go('plus')`** — the screen
  re-checks on entry, so the gate protects the purchase UI rather than relying on
  every caller to remember
- The child-facing "Ask a Grown-Up" handover
- Anything added later involving money, email, external links or deletion

### The two challenges

Both are **typed**, not tapped, and both are deliberately above the 12 × 12 the
game itself teaches.

| Kind | Challenge | Used for |
|---|---|---|
| `multiply` | `17 × 23 = ?` | The Grown-Ups dashboard |
| `multiply-adjust` | *"Read carefully: work out 17 × 23, then subtract 6. Type the result."* | Anything involving money |

`multiply-adjust` adds reading comprehension to adult arithmetic in a single
field, and that is what sits in front of pricing.

### API

```js
WW.parentGate.isOpen('purchase')        // has this scope been passed recently?
WW.parentGate.markPassed('purchase')
WW.parentGate.reset()                   // close every gate
WW.parentGate.reset('purchase')         // close just one
WW.parentGate.challenge(kind)           // { instruction, sum, spoken, verify }

WW.parentGate.render(container, opts)   // inline: fill a screen's body
WW.parentGate.require(opts)             // modal: don't leave the current screen
```

`opts`: `{ kind, scope, title, blurb, onPass, onCancel, cancelText }`.

A pass lasts **5 minutes** and is scoped, so reading a report does not open the
purchase door, and a device put down on the sofa re-locks itself. Passes live in
memory only — a reload closes every gate.

### Accessibility

One labelled numeric field (`inputmode="numeric"`, `aria-label` carrying the sum
spoken in words), the instruction wired up with `aria-describedby`, errors
announced through `role="status"`, a visible focus ring, and a way out that does
not require solving anything. Nothing depends on color or hover.

> **Tight on a sideways phone.** At 844×390 the gate card is ~569pt of content in
> a ~335pt window, so a grown-up scrolls. The instruction and the answer field do
> fit on screen together (~263pt of the ~335pt available), which matters because
> they would otherwise have to memorise the sentence while scrolling to type. The
> margin is about 70pt, so a longer instruction would break it — there is a test
> pinning that relationship.

### What this is not

Not authentication, and not a claim that the person is a parent. It is a speed
bump sized for a 6–8 year old, which is what the App Store asks for in front of
purchase UI.

---

## 12. The child experience

### The one entry point

```js
WW.Premium.blocked(contentId)   // -> true if it handled the block
```

Called when a child taps something they cannot open. It consults `check()` and
branches on `blockedBy`:

- **`'learning'`** → *"🔒 Not open yet — WonderSpace. Restore all 5 Knowledge
  Crystals first. Keep learning — you are getting closer!"* No mention of money,
  ever, even for a `tier: 'plus'` world.
- **`'plus'`** → the premium prompt below.
- **`'unknown'`** → a quiet toast. Nothing clever, just don't open it.

### The premium prompt

```
🚀 A New Adventure!

WonderSpace is part of WonderWorld+.
Ask a grown-up to help you explore this world.

Everything you have already unlocked is still yours. Keep exploring! 🌳

[ Ask a Grown-Up ]   [ Keep Exploring ]
```

No price. No *buy*, *subscribe*, *trial*, *card* or *upgrade*. No countdown. No
"you are missing out". The last line exists specifically so the child does not
feel they lost something.

**"Ask a Grown-Up"** triggers the `multiply-adjust` gate at scope `purchase`.
Only on a pass does `Nav.go('plus')` run.

### On the map

A Plus world is labelled by name — *"Part of WonderWorld+"* — never by price,
and the label is text as well as color. The map shows its learning requirement
the same way as every other world, because that is what the child is working
towards.

Tests assert that no price string and no purchase call-to-action exists in any
child-facing file, at phone portrait, phone landscape and both iPad
orientations.

---

## 13. The grown-ups experience

The existing Grown-Ups dashboard was preserved and extended, not replaced. After
the `multiply` gate it shows:

- **Learning progress** — only metrics genuinely computable from existing game
  state: activities completed, per-world progress, crystals earned, accuracy
  where it is actually recorded, badges. Nothing is fabricated; metrics that
  would need tracking the game does not yet do are omitted rather than faked.
- **Advanced report** — gated on `hasFeature('advanced-parent-reports')`.
- **Activity history** — 12 rows free, 40 on Plus, backed by the 60/400 cap.
- **Explorers** — the roster, read-only for now (§14).
- **Progress backup** — `WW.sync.describe()` reports honestly (§15).
- **Trust section** — the six claims in §17.
- **Developer tools** — development only, `null` in production.

### The Plus page

`WW.Screens.plus` is the **only screen in the game allowed to contain a price**.
It re-checks the `purchase` gate on entry, then renders:

`statusCard()` → `pitchCard()` → `pricingCard()` → `accountCard()` →
`trustCard()` → `legalCard()`

- **statusCard** adapts to `free` / `trial` (with days left) / `plus` / `expired`.
- **pitchCard** — *"Take the adventure even further."* plus the feature list,
  built from `WW.Content.plusCatalogue()` so it cannot drift from what is
  actually gated.
- **pricingCard** reads `WW.billing.PRODUCTS` — annual recommended with
  **BEST VALUE**, *7 Days Free*, *$39.99/year after your free trial*,
  ≈ *$3.33/month*; then monthly at *$6.99/month*; and **Cancel anytime.**
- **accountCard** — Restore Purchases, Manage Subscription.
- **legalCard** — Terms, Privacy.

Every button calls `WW.billing.*`. When no provider is connected the page says
so instead of offering a button that silently fails.

The page lives in `.world-body`, which caps at `max-width: 980px` like every
world and the parent dashboard, so it stays a readable column on a tablet. Tests
confirm the trial button and the Terms link are reachable at 844×390, where six
stacked cards have only 390pt of height to work with.

---

## 14. Multiple Explorer profiles

*Referenced from `js/profiles.js`.*

```
Parent / device
    ├── Explorer 1   ← the existing save, untouched
    ├── Explorer 2   ┐
    ├── Explorer 3   ├ WonderWorld+ only
    └── Explorer 4   ┘
```

### The one rule: do not touch `wonderworld.save.v1`

Every player who already has progress has it under that exact key. So the
migration **is not a migration at all** — it is a roster that *points at* the key
already there:

```js
explorer-1.saveKey === 'wonderworld.save.v1'
```

No data is copied, moved, rewritten or deleted. Additional Explorers get derived
keys:

```
wonderworld.save.v1.explorer-2
```

The roster itself lives in `wonderworld.profiles.v1`.

### The seam in `core.js`

```js
function saveKey() {
  try {
    var p = WW.profiles;
    if (p && typeof p.activeSaveKey === 'function') {
      var k = p.activeSaveKey();
      if (typeof k === 'string' && k) return k;
    }
  } catch (e) { /* fall through */ }
  return SAVE_KEY;   // 'wonderworld.save.v1'
}
```

Belt and braces in both directions: `activeSaveKey()` has its own try/catch and
also returns the legacy key on any failure. **If `js/profiles.js` were deleted
tomorrow, every existing save would still load.** That is the point of the
design.

### API

```js
WW.profiles.list()            // ordered roster
WW.profiles.active()
WW.profiles.activeSaveKey()   // what core.js reads
WW.profiles.maxSlots()        // 1 free, 4 on Plus
WW.profiles.usedSlots()
WW.profiles.slotsLeft()
WW.profiles.canCreate()
WW.profiles.create(label)     // { ok, profile } | { ok: false, reason: 'no_slots' }
WW.profiles.switchTo(id)      // rebinds the key and reloads state
WW.profiles.remove(id)        // Explorer 1 can never be removed
WW.profiles.lockedProfiles()  // extras that are read-only while not Plus
```

### What is wired up today

The roster, the non-destructive adoption of the existing save, slot accounting
against the entitlement, and the `activeSaveKey()` seam. `create()` and
`switchTo()` are implemented and tested but **deliberately not reachable from
the UI** — the grown-ups area lists the roster read-only.

### What shipping the switcher needs

1. A child-facing **"Who is playing?"** screen — large avatar tiles, no reading
   required, reachable from the title screen. This is design work in its own
   right and is why the switcher is not live.
2. A create-Explorer flow behind the parental gate, routing into the existing
   character creator writing to the *new* key.
3. A decision on what the HUD shows when more than one Explorer exists.
4. On lapse: `lockedProfiles()` already returns the extras; the UI needs to show
   them as locked-but-safe, with copy making clear nothing was deleted.

---

## 15. Cloud backup

*Referenced from `js/sync.js`.*

### Offline-first, always

localStorage stays the source of truth on the device. Sync is a **backup and a
transport between a family's own devices** — never a dependency. Nothing in the
game ever awaits a sync call. Pulling the plug on the server must leave the game
exactly as playable as it is today.

### Why there is no implementation

Uploading a child's save means uploading their nickname, their avatar and their
answer history. That needs a privacy review, a data-retention policy, a deletion
path and a **published update to `privacy.html`** before a single byte leaves the
device. None of that is done, so `providers.none` is the only provider and it
reports honestly that there is nowhere to sync to.

A stub that pretended to work would be worse than none.

### The interface a provider must implement

| Member | Returns |
|---|---|
| `name` | string |
| `isAvailable()` | boolean |
| `push(payload)` | `Promise<{ ok, reason, at }>` |
| `pull()` | `Promise<{ ok, reason, payload }>` |
| `status()` | `Promise<{ ok, state, lastPushedAt, lastPulledAt }>` |

### Facade

```js
WW.sync.push()         // no-ops unless Plus AND a provider exists
WW.sync.pull()
WW.sync.status()
WW.sync.payload()      // exactly what would be uploaded — reviewable in one place
WW.sync.describe()     // synchronous summary for the UI
WW.sync.use('firstParty')
```

`isAvailable()` requires **both** `hasFeature('cloud-sync')` and a working
provider. Neither alone is enough.

The payload is assembled in one place precisely so it is reviewable:

```js
{ schema: 'wonderworld.save.v1', profileId: 'explorer-1', savedAt: <ms>, data: <save> }
```

### Non-negotiables when it is built

- **First-party endpoint on our own origin.** No third-party storage SDK in the
  client.
- **Opt-in by a grown-up**, behind the parental gate.
- **A visible delete-everything control** that actually deletes server-side.
- **Minimised payload**: progress only. No free text beyond the nickname the
  child chose, which the character creator already warns about.
- Privacy policy updated and published **before** the feature ships, not with it.

---

## 16. Events

`WW.events` is **not analytics**. Nothing here touches the network, and there is
no third-party SDK anywhere in the project. It exists so product questions ("do
grown-ups find the Plus page?") can one day be answered by a first-party
endpoint *we* write and *we* document in the privacy policy — without having to
retro-fit instrumentation through the whole game at that point.

```js
WW.events.track('world_entered', { world: 'math' });
WW.events.recent(20);
WW.events.clear();
WW.events.sinks        // the single seam for a future first-party transport
```

Today every event lands in a 200-entry in-memory ring buffer and, in development
only, `console.debug`.

### Safety rules baked in

- **Event names are allow-listed** (`NAMES`). An unknown name warns in
  development and is dropped — it never crashes a child's game.
- **Property keys are allow-listed** (`ALLOWED_PROPS`), so a careless caller
  cannot leak a new field.
- Values are coerced to string/number/boolean and truncated to 64 characters.
- **Any string value matching the child's nickname is redacted**, as a backstop
  against the most likely mistake.
- No device ids, no IP, no session stitching, no timestamps finer than the event.

### The vocabulary

```
game_started  explorer_created  world_entered
activity_started  activity_completed  level_up  crystal_earned

premium_content_viewed  premium_prompt_shown  premium_help_requested
parent_gate_started  parent_gate_completed  parent_gate_failed
parent_dashboard_viewed  plus_page_viewed

trial_started  subscription_started  subscription_restored
subscription_manage_opened  entitlement_changed

dev_tier_simulated
```

Adding a name is a deliberate act — edit `NAMES` in `js/events.js`.

---

## 17. Privacy considerations

The privacy-first architecture is unchanged. The monetization layer added
**zero** network calls: there is still exactly one `fetch` in the entire client,
the parent mailing-list signup, and a test asserts it.

### Still true, and tested

- No Google Analytics, no Meta Pixel, no advertising SDK, no tracking SDK.
- No payment SDK in the client.
- No social login, no chat, no leaderboards, no public profiles.
- No cookies, no IndexedDB.
- No off-origin `<script>` tag.
- Child nickname, avatar, answers and behavioural data never leave the device.
- Parent email stays entirely separate from child game state — different key,
  different flow, behind the gate.

### The entitlement record

`wonderworld.entitlement.v1` contains no personal data: a status, a product id,
a provider name and timestamps. It is intentionally separate from the save so
neither can contaminate the other.

### Parent-facing trust section

Rendered on the Plus page and the dashboard:

```
✓ No ads
✓ No chat
✓ No selling children's data
✓ No loot boxes
✓ No pay-to-win
✓ No child email required
```

Each is a statement we can substantiate from the codebase, which is the bar.
Nothing claims a certification we do not hold.

### When billing connects

- Apple handles payment entirely; no card data touches our code.
- A web processor must use **hosted checkout** — card fields never render in our
  DOM — and the entitlement must be written server-side from the webhook.
- `privacy.html` and `terms.html` need review *before* the first real charge.
- An App Store subscription makes the grown-up an Apple customer, not ours; the
  privacy policy should say what we do and do not receive.

---

## 18. Apple StoreKit integration path

*Referenced from `js/env.js` and `js/billing.js`.* **This is the step-by-step.**

When this is done, **exactly one file in the web app changes**: the `apple`
provider in `js/billing.js`. Nothing else in the game knows what StoreKit is.

### Step 0 — prerequisites

- Apple Developer Program membership.
- An App ID and bundle identifier, e.g. `com.wonderworld.app`.
- Xcode 15+. StoreKit 2 requires iOS 15+, so target iOS 15 or later.

### Step 1 — wrap the web app

The game is already PWA-ready and makes no assumptions that break in a web view.
Two options, both in README §13:

- **WKWebView shell** (~an hour) — a single `WKWebView` loading the bundled
  `index.html` from the app bundle. Simplest, and the bridge below is written for
  it.
- **Capacitor** — `npx cap init`, `npx cap add ios`, copy the site into `www/`.
  Adds native APIs and an Android path later.

Ship the site **bundled into the app**, not loaded from the network, so it works
offline and passes review without a network dependency.

### Step 2 — create the products in App Store Connect

Auto-renewable subscriptions in **one subscription group**, so moving between
them is a plan change rather than a double charge:

| Product id | Duration | Price | Introductory offer |
|---|---|---|---|
| `com.wonderworld.plus.annual` | 1 year | $39.99 | 7 days free |
| `com.wonderworld.plus.monthly` | 1 month | $6.99 | — |

These must match `appleProductId` in `PRODUCTS` (`js/billing.js`) **exactly**.

Configure a `.storekit` file in Xcode for local testing before any sandbox
account exists.

### Step 3 — the native bridge contract

This contract is **already fixed** on the web side, so the Swift can be written
against it today.

**Web → native.** The web view posts to a message handler with this exact name:

```js
window.webkit.messageHandlers.wonderworldBilling.postMessage({
  action: 'purchase' | 'startTrial' | 'restore' | 'manage' | 'verify',
  productId: 'com.wonderworld.plus.annual',   // omitted for restore/manage/verify
  requestId: '<uuid>'
});
```

`WW.env.nativeBridge()` already detects this handler (and Capacitor's
`isNativePlatform()`) and returns `'apple'`, which is what makes
`apple.isAvailable()` true and `autoSelect()` choose it over the mock.

**Native → web.** After StoreKit has verified the transaction, the native layer
calls back into:

```js
WW.billing.providers.apple._receive({
  requestId: '<the same uuid>',
  ok: true,
  status: 'plus' | 'trial' | 'expired',
  productId: 'plus_annual',          // OUR id, not the Apple id
  trialStartedAt: <ms epoch> | null,
  trialEndsAt:    <ms epoch> | null,
  expiresAt:      <ms epoch> | null, // renewal date -> renewsAt
  reason: null                       // a string when ok is false
});
```

`_receive()` **is already written** and is the only trusted path to a real
entitlement on iOS. It writes `provider: 'apple'`, which `recordIsTrusted()`
accepts in production.

### Step 4 — the two edits in `js/billing.js`

**(a) Implement `apple._send()`** — post the message and resolve the promise when
`_receive()` arrives. `apple._pending` already exists for exactly this:

```js
_send: function (action, productId) {
  if (!apple.isAvailable()) return settled(result(false, 'not_connected'));
  var p = PRODUCTS[productId];
  var requestId = String(Date.now()) + '-' + Math.random().toString(36).slice(2);
  return new Promise(function (resolve) {
    apple._pending[requestId] = resolve;
    apple._bridge().postMessage({
      action: action,
      productId: p ? p.appleProductId : null,
      requestId: requestId
    });
    /* Never leave the UI spinning if the native side goes quiet. */
    setTimeout(function () {
      if (apple._pending[requestId]) {
        delete apple._pending[requestId];
        resolve(result(false, 'timeout'));
      }
    }, 60000);
  });
}
```

**(b) Have `_receive()` settle the pending promise** — keep the existing
`WW.entitlements.apply()` body and add at the end:

```js
var done = msg.requestId && apple._pending[msg.requestId];
if (done) { delete apple._pending[msg.requestId]; done(res); }
```

Nothing else in the web app changes. `manageSubscription` maps to
`showManageSubscriptions(in:)`; it has no entitlement result to deliver, so it
can resolve `{ ok: true }` as soon as the sheet is presented.

### Step 5 — the Swift side (StoreKit 2)

```swift
import StoreKit
import WebKit

final class BillingBridge: NSObject, WKScriptMessageHandler {
    weak var webView: WKWebView?
    private var updates: Task<Void, Never>?

    /// Map App Store product ids back to the ids the web app uses.
    private let ourId: [String: String] = [
        "com.wonderworld.plus.annual":  "plus_annual",
        "com.wonderworld.plus.monthly": "plus_monthly"
    ]

    override init() {
        super.init()
        // Transactions can arrive outside a purchase: a renewal, Ask to Buy
        // approval, or a purchase made on another device. Always listen.
        updates = Task.detached { [weak self] in
            for await update in Transaction.updates {
                guard case .verified(let t) = update else { continue }
                await t.finish()
                await self?.pushEntitlement(requestId: nil)
            }
        }
    }

    func userContentController(_ c: WKUserContentController,
                               didReceive message: WKScriptMessage) {
        guard let body = message.body as? [String: Any],
              let action = body["action"] as? String else { return }
        let requestId = body["requestId"] as? String
        let productId = body["productId"] as? String

        Task {
            switch action {
            case "purchase", "startTrial":
                // StoreKit applies the introductory offer automatically when the
                // account is eligible — there is no separate "start trial" call.
                await purchase(productId, requestId: requestId)
            case "restore":
                try? await AppStore.sync()
                await pushEntitlement(requestId: requestId)
            case "verify":
                await pushEntitlement(requestId: requestId)
            case "manage":
                await showManageSubscriptions(requestId: requestId)
            default:
                send(["requestId": requestId as Any, "ok": false,
                      "reason": "unknown_action"])
            }
        }
    }

    private func purchase(_ appleId: String?, requestId: String?) async {
        guard let appleId,
              let product = try? await Product.products(for: [appleId]).first else {
            send(["requestId": requestId as Any, "ok": false,
                  "reason": "unknown_product"]); return
        }
        do {
            switch try await product.purchase() {
            case .success(let verification):
                guard case .verified(let t) = verification else {
                    send(["requestId": requestId as Any, "ok": false,
                          "reason": "unverified"]); return
                }
                await t.finish()
                await pushEntitlement(requestId: requestId)
            case .userCancelled:
                send(["requestId": requestId as Any, "ok": false,
                      "reason": "cancelled"])
            case .pending:
                // Ask to Buy: a parent still has to approve. Transaction.updates
                // delivers it later.
                send(["requestId": requestId as Any, "ok": false,
                      "reason": "pending"])
            @unknown default:
                send(["requestId": requestId as Any, "ok": false, "reason": "failed"])
            }
        } catch {
            send(["requestId": requestId as Any, "ok": false, "reason": "failed"])
        }
    }

    /// The single source of truth: what does StoreKit say we are entitled to
    /// right now? Called after a purchase, a restore, a renewal, and on launch.
    private func pushEntitlement(requestId: String?) async {
        for await entitlement in Transaction.currentEntitlements {
            guard case .verified(let t) = entitlement,
                  let mapped = ourId[t.productID] else { continue }

            let expired = t.expirationDate.map { $0 < Date() } ?? false
            let isTrial = t.offer?.type == .introductory

            send([
                "requestId": requestId as Any,
                "ok": true,
                "status": expired ? "expired" : (isTrial ? "trial" : "plus"),
                "productId": mapped,
                "trialStartedAt": isTrial ? t.purchaseDate.ms : NSNull(),
                "trialEndsAt":    isTrial ? (t.expirationDate?.ms ?? NSNull()) : NSNull(),
                "expiresAt":      t.expirationDate?.ms ?? NSNull()
            ])
            return
        }
        // Nothing active. Say so — the web layer downgrades itself.
        send(["requestId": requestId as Any, "ok": true, "status": "expired",
              "productId": NSNull(), "expiresAt": NSNull()])
    }

    @MainActor
    private func showManageSubscriptions(requestId: String?) async {
        if let scene = webView?.window?.windowScene {
            try? await AppStore.showManageSubscriptions(in: scene)
        }
        send(["requestId": requestId as Any, "ok": true, "status": NSNull()])
    }

    private func send(_ payload: [String: Any]) {
        guard let data = try? JSONSerialization.data(withJSONObject: payload),
              let json = String(data: data, encoding: .utf8) else { return }
        DispatchQueue.main.async { [weak webView] in
            webView?.evaluateJavaScript(
                "WW.billing.providers.apple._receive(\(json))", completionHandler: nil)
        }
    }
}

private extension Date {
    /// The web layer works in milliseconds since epoch.
    var ms: Double { timeIntervalSince1970 * 1000 }
}
```

Register the handler when building the web view — the name must be exactly
`wonderworldBilling`:

```swift
let config = WKWebViewConfiguration()
let bridge = BillingBridge()
config.userContentController.add(bridge, name: "wonderworldBilling")
let webView = WKWebView(frame: .zero, configuration: config)
bridge.webView = webView
```

### Step 6 — verify on launch

Once a real provider exists, call `WW.billing.verify()` on startup so a
cancelled or lapsed subscription is noticed. A good place is after
`WW.entitlements.load()` in `game.js`:

```js
if (WW.billing.providerName() === 'apple' || WW.billing.providerName() === 'web') {
  WW.billing.verify();
}
```

Deliberately not awaited — the game must start instantly and offline.

### Step 7 — the `file://` trap

> 🚩 **Required pre-ship task.** A bundled WKWebView build is typically served
> over `file:`, and **rule 3 of `isDev()` treats `file:` as development**. That
> would make the mock adapter available inside the shipped app.

Note that setting `window.WW_DEV = false` does **not** help: rule 2 only tests
for `=== true`, and rule 3 is evaluated after it. So pick one:

- Serve the bundled site over a custom scheme or local origin and add that
  hostname to `PRODUCTION_HOSTS`; or
- Guard rule 3 in `js/env.js` behind a release build flag.

Verify in the release build's Web Inspector that `WW.env.describe()` reports
`dev: false`, and that `WW.dev.setTier('plus')` returns
`{ ok: false, reason: 'not_available' }`.

### Step 8 — TestFlight and review

1. Test against the local `.storekit` file first, then a sandbox account.
2. Verify: purchase; trial start; restore on a second device; cancel in Settings
   → entitlement downgrades on the next `verify()`; Ask to Buy approval.
3. Archive → upload → TestFlight internal testing.
4. Submit with review notes explaining the parental gate and that WonderWorld+
   is additive.

### App Store review risks to pre-empt

| Risk | Mitigation already in place |
|---|---|
| **Kids Category** — purchase UI must sit behind a parental gate | `multiply-adjust` gate at scope `purchase`, enforced on the screen itself |
| Kids Category forbids third-party analytics and advertising | There are none; tested |
| External purchase links are not permitted in-app | Nothing links out to a web checkout |
| Guideline 3.1.1 — subscriptions must use IAP | The `web` provider is inert, and `autoSelect()` prefers `apple` whenever the bridge exists |
| Subscription metadata must be visible before purchase | Price, period, trial length, post-trial price and "Cancel anytime" are all on the pricing card, with Terms and Privacy linked on the same page |
| Restore must be available | Restore Purchases on the account card |
| Review account needed | The free game is fully playable with no account — say so in the notes |

One residual risk worth naming: a reviewer who answers the gate's arithmetic
incorrectly may report the purchase page as unreachable. The review notes should
state that the gate is deliberate for the Kids Category and explain how to pass
it.

---

## 19. Web billing integration path

For selling outside the App Store. **No processor has been chosen**, and nothing
in `providers.web` transacts — `isAvailable()` is hard-coded `false`.

### The intended shape

1. A first-party endpoint **on this same origin** (a Cloudflare Pages Function,
   alongside the existing signup function) starts a hosted checkout. Card fields
   never render in our DOM.
2. The processor's **webhook** writes the subscription server-side. The browser
   is never told "you paid" by a checkout redirect.
3. `web.verify()` asks **our** server — never the processor directly from the
   browser — for the current entitlement, and feeds the answer to
   `WW.entitlements.apply({ provider: 'web', ... })`.

### Constraints

- The browser is never the authority. A `provider: 'web'` record is only ever
  written from a server response.
- This needs an account system, which the game does not have, and which would be
  the first thing to require a grown-up's email as a *credential* rather than a
  mailing-list opt-in. That is a privacy decision, not just an engineering one.
- If the iOS app ships first, cross-platform entitlement means the account
  system has to exist anyway for Plus bought on iOS to appear on the web. Decide
  deliberately whether that is in scope.

### Order of work

Apple first, web second. Apple needs no account system, and the `apple` path
proves the whole abstraction end to end before the harder identity questions are
opened.

---

## 20. How to test free / trial / plus / expired

Billing is not connected, so all four states are simulated. **This only works in
development** — see [§4](#4-trust-model).

### From the console

```js
WW.dev.setTier('free');
WW.dev.setTier('trial');
WW.dev.setTier('plus');
WW.dev.setTier('expired');

WW.dev.state();                  // confirm what is actually in effect
WW.entitlements.status();
```

### From the UI

**Grown-Ups → Developer tools** → the `free` / `trial` / `plus` / `expired`
chips. The panel re-renders the dashboard on change and shows the current host,
so it is obvious when you are looking at a simulated state.

### Confirming the production guard

```js
WW.env.describe();      // { host, protocol, productionHost, dev, nativeBridge }
```

On a production host `dev` is `false`, the developer panel does not render, and
`WW.dev.setTier('plus')` returns `{ ok: false, reason: 'not_available' }`. To
prove the third layer, paste a `provider: 'mock'` record into localStorage on
production and reload — `WW.entitlements.status()` still reads `'free'`.

### Flows worth walking manually

| Flow | What to look for |
|---|---|
| Free child taps WonderSpace with < 5 crystals | **Learning** message. No mention of money. |
| Plus child taps WonderSpace with < 5 crystals | Still the learning message. Paying bought nothing here. |
| Free child with all 5 crystals taps WonderSpace | 🚀 A New Adventure! No price anywhere. |
| "Ask a Grown-Up" | `multiply-adjust` gate, then the Plus page. |
| Direct `WW.Nav.go('plus')` | The gate still appears. |
| Plus page as `free` | Pricing, BEST VALUE, 7 Days Free, Cancel anytime, and an honest "not on sale yet". |
| Plus page as `trial` | Days-left banner. |
| Plus page as `expired` | Nothing deleted; re-subscribe offered calmly. |
| Grown-ups dashboard, free vs plus | Advanced report gated; history 12 vs 40 rows. |
| Restore Purchases | Reports honestly rather than inventing a subscription. |
| Reload with an existing save | Progress intact, under `wonderworld.save.v1`. |
| Airplane mode | Everything above still works. |
| Rotate the phone on the gate | Instruction, field and Enter all still gettable to. |

---

## 21. What the tests assert

```bash
node tools/logic-test.js                            # 183 assertions, 21 suites
node tools/browser-test.js http://localhost:8111    # 244 assertions, real browser
```

> If the browser run fails with *"Executable doesn't exist"*, the pinned
> `playwright-core` wants a newer browser build than the local cache has. Either
> `npx playwright install`, or point it at an installed Chrome:
>
> ```bash
> CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
>   node tools/browser-test.js http://localhost:8111
> ```

Suites 10–21 of the logic tests are the monetization ones. They exist so the
rules above are mechanically enforced rather than merely documented:

| Suite | Asserts |
|---|---|
| 10. Entitlements — free content stays free | All five worlds are `tier: 'free'` and reachable by XP exactly as before. |
| 11. Paying never bypasses learning | A `plus` subscriber with 0 crystals cannot open WonderSpace, and a forged `unlocked.space` flag does not help. |
| 12. WonderSpace = five crystals AND Plus | Every combination of the two axes. |
| 13. Billing abstraction | The facade, every adapter's interface shape, Restore exists, stubs report `not_connected`. |
| 14. The development mock is inert in production | All three trust layers, including a hand-copied mock record. |
| 15. Existing saves survive all of this | `wonderworld.save.v1` loads unchanged; the roster adopts it in place. |
| 16. Profiles, cloud-sync interface and events | Slot limits, `activeSaveKey()` fallback, sync honesty, event allow-lists. |
| 17. Parental gate | Both challenges, TTL, scoping, and that the Plus screen self-gates. |
| 18. Prices live in exactly one place | No price string in any child-facing file; only the Plus page renders one. |
| 19. Beta signup copy | The over-broad "WonderWorld is free" promise is gone and nothing implies content was removed. |
| 20. Offline support still covers everything | All 18 scripts pre-cached; service worker VERSION bumped. |
| 21. No new network surface | Still exactly one `fetch`; no third-party SDK, cookie or IndexedDB use. |

The browser suite drives the real game and additionally covers the monetization
screens at four viewports: iPhone portrait (390×844), iPad portrait (820×1180),
iPad landscape (1180×820) and **phone landscape (844×390)**, the one size with a
media query written specially for it. At each it re-checks that the child sees no
price, that the purchase gate cannot be walked past, that every control keeps a
44pt target, and — using an occlusion-aware reachability check — that the trial
button, the gate's Enter button and the Terms link can actually be gotten to.

Run both before shipping any change to this layer.

---

## 22. Before real payments: the checklist

Nothing can be bought today. These must be true first.

**Required**

- [ ] Apple Developer Program membership and App ID.
- [ ] Both subscription products created in App Store Connect, in one
      subscription group, ids matching `appleProductId` exactly.
- [ ] `apple._send()` implemented and `_receive()` settling pending promises
      (§18 step 4).
- [ ] The Swift bridge built and registered as `wonderworldBilling` (§18 step 5).
- [ ] `WW.billing.verify()` called on launch (§18 step 6).
- [ ] **The `file://` trap closed and the release build confirmed to report
      `dev: false`** (§18 step 7). This is the one that silently breaks the trust
      model if missed.
- [ ] `terms.html` reviewed for subscription terms: price, period, renewal,
      trial length, cancellation.
- [ ] `privacy.html` reviewed for what Apple sends us about a subscriber.
- [ ] Sandbox-tested: purchase, trial, restore on a second device, cancellation
      downgrade, Ask to Buy.
- [ ] Both test suites passing.

**Required before cloud sync specifically** (§15)

- [ ] Privacy review of the payload.
- [ ] Data-retention policy and a working deletion path.
- [ ] `privacy.html` updated and **published** before the feature ships.

**Required before the profile switcher** (§14)

- [ ] The "Who is playing?" screen designed.
- [ ] Lapse behaviour visible in the UI as locked-but-safe.

**Explicitly out of scope until someone decides otherwise**

- Web billing (§19) — needs an account system.
- Android / Google Play billing — a fourth adapter, same interface.
- Family Sharing — Apple supports it for subscriptions; decide deliberately.
