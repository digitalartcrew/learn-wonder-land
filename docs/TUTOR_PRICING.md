# WonderTutor — cost model and pricing analysis

**Status: analysis only. No live price has been changed.** The UI still shows
$6.99/month and $39.99/year, exactly as before. A recommendation is at
[§8](#8-recommendation).

---

## 1. The headline finding

**There are two completely different answers here, and conflating them would
be the expensive mistake.**

### Typed tutoring: cost is a rounding error

| | Light | Average | Heavy |
|---|---|---|---|
| Text AI cost / subscriber / month | **$0.006** | **$0.021** | **$0.083** |
| As a share of a $6.99 subscription | 0.08% | 0.30% | 1.2% |

For typed tutoring the conclusion is clean: **a price increase is a
value-capture decision, not a cost-recovery one.** The reason is architectural
rather than luck — see [§4](#4-why-it-is-this-cheap).

### Spoken tutoring: cost can exceed the subscription

Real-time voice bills **$32 per 1M audio input tokens and $64 per 1M audio
output tokens** — roughly 3–4 cents per MINUTE of conversation, against
0.011 cents for a typed exchange. That is a factor of several hundred.

| | Light | Average | Heavy | Uncapped |
|---|---|---|---|---|
| Voice sessions / month | 4 | 12 | 40 | 80 |
| Voice cost / subscriber / month | **$1.20** | **$3.60** | **$12.00** | **$24.00** |
| vs $8.49 net on a $9.99 sub | 14% | 42% | **141%** 🚩 | **283%** 🚩 |

**A heavy voice user costs more than they pay.** This is not a tail risk to
monitor; at 40 sessions a month it is simply loss-making. Voice therefore ships
with a hard budget — see [§5a](#5a-the-voice-budget) — and it is the one place
in this product where usage limits are an economic necessity rather than an
abuse backstop.

So the revised conclusion:

> Typed tutoring is free to serve and should be priced on value.
> Spoken tutoring has a real marginal cost, must be capped, and is the
> strongest argument for raising the price.

[§5](#5-what-would-break-this) is still the most important section.

---

## 2. Input prices

Taken from OpenAI's current pricing (verified October 2026). Per 1M tokens:

| Model | Input | Cached input | Output | Notes |
|---|---|---|---|---|
| `gpt-6-luna` | $0.10 | $0.01 | $0.50 | Cheapest general-purpose text model |
| `gpt-6-luna` (Batch / Flex) | $0.05 | — | $0.25 | 50% off, not usable for interactive turns |
| `gpt-5.4-mini` | $0.75 | — | — | ~7.5× the input price; reference only |
| Decisions API (`gpt-6-luna`) | $0.10 | — | **$0** | **Input tokens only** — no output charge |

`gpt-6-luna` is the configured default for `/api/tutor` (`TUTOR_MODEL`
overrides it). Three or four warm sentences at a Grade 2 reading level does not
need a frontier model, and paying 7.5× for one would be the single largest
unforced error available here.

The Decisions API is the interesting one: it bills **input only**, so the
expression layer — the thing that fires most often — is close to free.

> ⚠️ Re-check these figures before committing to a price. Model pricing moves,
> and every number downstream is derived from this table. The spreadsheet is
> this document; there is nothing else to update.

---

## 3. Cost per interaction

### Token sizes, measured against the actual prompts

`functions/api/tutor.js` sends a fixed system prompt plus a small user prompt.

| Call | Input tokens | Output tokens |
|---|---|---|
| `lesson` / `answer` / `explain_again` / `encourage` | ~650 (system ~370 + user ~80 + bounded history ~200) | ~130 (capped at 220) |
| Decisions `expression` | ~400 (instructions ~300 + 8 choice descriptions + state line) | 0 |

### Cost per call

```
Generation call  = (650 / 1e6 × $0.10) + (130 / 1e6 × $0.50)
                 = $0.000065 + $0.000065
                 = $0.00013          ≈ 0.013 cents

Decision call    = (400 / 1e6 × $0.10)
                 = $0.00004          ≈ 0.004 cents
```

### Calls per lesson

This is where the architecture shows up. A lesson is: short explanation →
3 practice questions → 3 check questions → verdict. Of those steps, **only the
explanation can involve a model.**

| Step | AI calls | Why |
|---|---|---|
| Choosing the skill | 0 | `WW.tutor.nextSkill()` — deterministic |
| The lesson explanation | **1.0** | Every lesson is written for this child |
| Generating 6 questions | **0** | `WW.tutorContent` generates them locally |
| Scoring 6 answers | **0** | String and number comparison |
| Re-explaining after difficulty | 0.5 | Only when a child misses twice |
| Mastery / level / XP decisions | **0** | Arithmetic in `WW.learningProfile` |
| Child-initiated questions | ~2 | The genuinely valuable use |
| Expression decisions | ~6 | Decisions API, if enabled |

```
Per lesson = (1.0 × $0.00013)   lesson text
           + (0.5 × $0.00013)   re-explanation
           + (2.0 × $0.00013)   child questions
           + (6.0 × $0.00004)   expressions
           = $0.00013 + $0.000065 + $0.00026 + $0.00024
           = $0.00070            ≈ 0.07 cents per lesson
```

> An earlier version of this document had the lesson figure at **0.2** calls,
> because lessons only went to a model for four "prose" skills and the other
> thirty got a canned sentence. That was a cost decision taken before the cost
> was measured. It saved about two cents a month and made the tutor sound like
> a worksheet, so it was removed. Writing every lesson for the child in front
> of it costs **five hundredths of a cent** more per lesson.

### Per subscriber per month

| Profile | Lessons/month | AI cost | Notes |
|---|---|---|---|
| **Light** | 8 | $0.006 | Twice a week |
| **Average** | 30 | $0.021 | Most school nights |
| **Heavy** | 120 | $0.083 | Several lessons a day, every day |
| **Pathological** | 1,200 | $0.83 | The fair-use ceiling, every day, all month |

Even the pathological case — a device hammering the 40-lessons-per-day ceiling
for 30 straight days — costs **83 cents**, around 12% of one month's
subscription. The fair-use limit in `WW.tutor.ACCESS.plusLessonsPerDay`
therefore exists to stop automated abuse, **not** to control cost.

### A family of four

Profiles are per Explorer, and WonderWorld+ allows four. Four average children
on one subscription is **$0.084/month** — still under 1% of $6.99. Multi-child
usage does not change the picture, which is worth knowing because it means the
4-Explorer allowance costs nothing to honour.

---

## 4. Why it is this cheap

Four decisions, each of which could have gone the other way:

1. **Questions are generated locally, not by a model.** `js/tutor/content.js`
   produces arithmetic, money, geometry and word problems from a few lines of
   JavaScript. Six questions per lesson generated by a model would be 6 calls
   instead of 0.2 — roughly **11× the total cost** on its own.

2. **Scoring is a comparison, not a judgement.** Asking a model whether `42`
   equals `42` would be slower, less reliable, and would add another 6 calls
   per lesson.

3. **Mastery is arithmetic.** The weighted-recency score, the level moves, the
   spaced-review schedule and every XP figure are plain functions. A model
   asked "has this child mastered addition?" would be both expensive and worse.

4. **History is bounded, not unbounded.** The tutor does carry a short memory
   of the current lesson — six turns and 700 characters, hard-capped on the
   client AND re-capped on the server — so it can say "like we did a moment
   ago" instead of restarting every turn. What it never does is send a growing
   transcript. That distinction is the whole cost story for a chat-shaped
   product: unbounded history grows input tokens linearly with session length,
   so turn 20 costs 20× turn 1. Bounded history costs a flat ~200 tokens
   forever. It is also, separately, the right call for a child's words.

The expensive thing in an AI tutor is not the AI. It is calling the AI for
things a computer can already do.

---

## 5. What would break this

Costs below are per average subscriber per month, against the $0.016 baseline.

| Change | New cost | Multiplier |
|---|---|---|
| Generate all questions with a model | $0.23 | 11× |
| Send UNBOUNDED conversation history | $0.84 | 40× |
| Switch to `gpt-5.4-mini` | $0.13 | 6× |
| Cloud text-to-speech (~500 words/lesson) | **$1–5** | **60–300×** |
| Child asks 30 questions/session, not 2 | $0.11 | 7× |
| All four of the above together | ~$8 | ~500× |

**Voice was the predicted risk, and it arrived.** An earlier version of this
section warned that cloud audio would be "the one change that would genuinely
force a price increase". Real-time voice has since shipped, and the warning was
correct — see §5a.

The read-aloud path is still free: `js/tutor/voice.js` uses on-device
`speechSynthesis` only and refuses any voice without `localService === true`.
That is unchanged and costs nothing. What is new is **conversational** voice,
which is a different thing with a different bill.

---

## 5a. The voice budget

### What a spoken session actually costs

Audio token rates for `gpt-realtime-2.1`:

| | Per 1M tokens |
|---|---|
| Audio input | **$32.00** |
| Cached audio input | $0.40 |
| Audio output | **$64.00** |
| Text input / output | $4.00 / $24.00 |

> ⚠️ **Assumption that needs verifying:** OpenAI does not publish audio tokens
> per minute of speech. The figures below assume **600–800 tokens per minute**,
> which is the commonly cited range, and a 35/65 split between child and tutor
> talking. Measure `usage.voiceSeconds` against the real invoice in the first
> month and correct this table. Everything in §5a scales linearly with that
> number, so if it is 2× out, so is the budget.

```
10-minute session, 700 tok/min, 35% child / 65% tutor:

  child audio in  = 10 × 0.35 × 700 = 2,450 tok → $0.078
  tutor audio out = 10 × 0.65 × 700 = 4,550 tok → $0.291
                                              ≈ $0.37 per session
```

Sensitivity across the assumed range: **$0.32–$0.42** for ten minutes, or
roughly **3–4 cents per minute**. A typed exchange is 0.013 cents. Voice is
about **250× more expensive per interaction**.

### Why that needs a hard cap

| Voice sessions / month | Cost | vs $8.49 net on $9.99 |
|---|---|---|
| 4 | $1.20 | 14% |
| 12 | $3.60 | 42% |
| 40 | $12.00 | **141%** 🚩 |
| 80 | $24.00 | **283%** 🚩 |

Past roughly 28 sessions a month a subscriber is costing more than they pay.
There is no pricing level that fixes this on its own — at $12.99 the breakeven
only moves to ~37 sessions — because the cost is unbounded and the price is
not. **It has to be capped.**

### The shipped budget

`WW.tutor.ACCESS`, configurable:

```js
plusVoiceMinutesPerDay:   20,    // stops a binge
plusVoiceMinutesPerMonth: 120,   // stops sustained use going underwater
freeVoiceMinutes:         0      // voice is never in the free demo
```

Both windows apply; whichever is tighter wins. Worst case at the monthly
ceiling:

```
120 min × $0.037/min = $4.44/month
      against $8.49 net on a $9.99 subscription  →  48% of revenue
```

That is a ceiling, not an expectation. A child doing two 10-minute spoken
sessions a week uses 80 minutes a month and costs **$2.96**; most will use far
less, because talking is tiring and typing is faster for arithmetic.

### How it is enforced

- **Metered, not trusted.** `js/tutor/realtime.js` times the session from the
  moment the data channel opens, not from when the talk button is held,
  because the model streams audio back during the gaps too.
- **Checked every 5 seconds** while open, so an overrun is seconds rather than
  minutes.
- **Counted on teardown first**, so a crash or a navigation still bills the
  seconds that were used.
- **Durations only** — `voiceLog` entries are `{ at, sec }` and nothing else.
- **The child never sees a number.** Out of allowance reads as *"My talking
  voice needs a rest for now — but I can still teach you here!"*. The minutes
  appear only in the grown-ups dashboard.

A free Explorer whose parent consented gets a *different* message — the
WonderWorld+ handover — because "needs a rest" would be a small lie about
something that is actually a plan boundary.

The architecture is what makes the margin, so the margin is only as durable as
the architecture. `WW.tutorProvider.WORTH_ASKING` and `shouldAsk()` are the
guardrails; both are tested.

---

## 6. Non-AI costs

| Item | Cost |
|---|---|
| Cloudflare Pages (static hosting, unlimited requests) | $0 |
| Pages Functions — free tier 100k req/day | $0 up to ~3M/month |
| Workers Paid, if exceeded | $5/month + $0.30/M requests |
| KV (rate-limit counters) | within free tier at this volume |
| Current signup KV | unchanged |

At average usage a subscriber generates roughly 250 function calls/month, so
the free tier covers about **12,000 subscribers** before the $5 plan is needed.
Infrastructure is effectively a rounding error until well past product-market
fit.

**Server cost per subscriber: ~$0.00** at current scale.

---

## 7. Margin after Apple

Apple's commission is **15%** under the Small Business Program (under $1M/year
proceeds) and **30%** above it. Most relevant case is 15%.

### At today's $6.99/month, text only

| | 15% | 30% |
|---|---|---|
| Gross | $6.99 | $6.99 |
| Apple commission | −$1.05 | −$2.10 |
| Text AI (average) | −$0.021 | −$0.021 |
| Infrastructure | −$0.00 | −$0.00 |
| **Net** | **$5.92** | **$4.87** |
| **Gross margin** | **84.7%** | **69.6%** |

### The same subscriber, with voice

This is the table that matters now. At 15% commission:

| Voice usage | $6.99 | $9.99 | $12.99 |
|---|---|---|---|
| None | $5.92 (85%) | $8.47 (85%) | $11.02 (85%) |
| Light (4 sessions) | $4.72 (68%) | $7.27 (73%) | $9.82 (76%) |
| Average (12) | $2.32 (33%) | $4.87 (49%) | $7.42 (57%) |
| At the 120-min cap | $1.48 (21%) | $4.03 (40%) | $6.58 (51%) |
| **Uncapped heavy (40)** | **−$6.08** 🚩 | **−$3.53** 🚩 | **−$0.98** 🚩 |

Two things fall out of this:

1. **The cap is doing the work, not the price.** Without it, every price point
   in the table goes negative for a heavy user.
2. **$6.99 is too low once voice exists.** An average voice user at $6.99
   leaves 33% margin before any support, refund or acquisition cost. At $9.99
   the same user leaves 49%, which is a business.

### At the price points the brief asked about

Monthly, at 15% commission, **text-only** usage:

| Price | Net after Apple | Net after AI | Margin |
|---|---|---|---|
| $6.99 | $5.94 | $5.92 | 84.7% |
| $7.99 | $6.79 | $6.77 | 84.7% |
| $9.99 | $8.49 | $8.47 | 84.8% |
| $12.99 | $11.04 | $11.02 | 84.8% |

Annual, at 15%, average usage (12 months of AI):

| Price | Net after Apple | Net after AI | Effective /month | Margin |
|---|---|---|---|---|
| $39.99 | $33.99 | $33.80 | $2.82 | 84.5% |
| $59.99 | $50.99 | $50.80 | $4.23 | 84.7% |
| $79.99 | $67.99 | $67.80 | $5.65 | 84.8% |
| $99.99 | $84.99 | $84.80 | $7.07 | 84.8% |

**For text, the margin column barely moves.** Apple's commission is ~400×
larger than the text inference bill and proportional, so every price point
lands at the same margin. Text cost is not a variable price has to solve for.

**For voice it is the opposite.** The cost is per-minute and absolute, not
proportional, so it hits a cheap plan far harder than an expensive one. That
asymmetry — not the headline AI bill — is the actual argument for raising the
price.

---

## 8. Recommendation

### Tier structure: two tiers, not three

**FREE + WONDERWORLD+.** Do not add a separate WonderTutor tier.

The economics permit the simple structure you preferred, so take it. A third
tier would cost real things — a more confusing parent decision, a second
upgrade path to build and test, and a weaker WonderWorld+ proposition — to
recover a cost of 1.6 cents. Put the tutor **in** WonderWorld+ and let it be
the reason to subscribe.

```
FREE WONDERWORLD                 WONDERWORLD+
the five-world adventure         everything free, plus
all five crystals                WonderTutor
one Explorer                     WonderSpace + future worlds
local save                       up to 4 Explorers
basic progress summary           advanced learning reports
WonderTutor demo                 progress backup
```

### Price: $9.99/month and $79.99/year

| | Recommended | Today |
|---|---|---|
| Monthly | **$9.99** | $6.99 |
| Annual | **$79.99** (≈ $6.67/mo, 33% off) | $39.99 |
| Trial | 7 days free, on annual | same |

**Why $9.99 rather than keeping $6.99:** two reasons, and the second one is
new. First, an AI tutor that assesses a child, builds a learning path and
teaches in their own language is a different product from a world map with five
games — families judge a tutor against tutoring. Second, and more concretely:
**voice makes $6.99 structurally thin.** An average voice user at $6.99 leaves
33% margin; at $9.99 they leave 49%. That is the difference between a product
that absorbs a support ticket and one that does not.

**Why not $12.99:** it starts to invite comparison with human tutoring and with
full curriculum products, and WonderTutor is neither yet — the content bank is
English-only, eleven languages are unvalidated, and WonderSpace is not built.
Price for what exists. ($12.99 is, however, the right number to revisit once a
second language is validated and voice has real usage data behind it.)

**Why $79.99 annual rather than $59.99:** a 33% discount against monthly is the
conventional and defensible ratio, and annual is where the trial converts.
$59.99 would be a 50% discount, which trains buyers to wait for annual and
leaves money on the table at identical margin.

### The counter-argument, and how voice changes it

The case for **keeping $6.99/$39.99** was strong when this document only
covered text: margin was ~85% either way, so the whole question was volume
versus ARPU, and a cheap beta buys adoption at no cost.

Voice weakens that argument but does not kill it. You could hold $6.99 **and**
tighten the voice budget — say 60 minutes a month instead of 120 — which puts
worst-case voice cost at $2.22 and keeps margin above 65% even for a heavy
user. That is a legitimate strategy: cheaper plan, less talking.

**My recommendation is $9.99/$79.99 for new subscribers, with existing
subscribers grandfathered**, and the 120-minute voice budget. The alternative
I would actually defend is $6.99 with a 60-minute budget. What I would *not*
do is hold $6.99 with generous voice — that is the one combination the numbers
genuinely reject.

### Free trial: keep 7 days, unchanged

7 days is enough for the thing that actually sells this: the child completes the
Initial Skills Assessment, gets a learning path, does several lessons, and the
parent opens the dashboard and sees per-subject levels for their own child.
That report is the conversion event. A trial costs about **$0.004** in
inference, so there is no reason to shorten it and no reason to gate the tutor
during it.

### Voice in the free demo: no

`freeVoiceMinutes` is `0` and should stay there. Voice is the most expensive
thing in the product, a free Explorer's grown-up has agreed to nothing, and the
demo already has a far better conversion artefact in the skills report. A free
voice minute costs more than a free Explorer's entire typed demo.

### Free demo: assessment + 3 lessons

Currently `WW.tutor.ACCESS.freeLessons = 1`. **Recommend 3.**

A single lesson shows that the tutor works. Three shows that it *adapts* —
which is the part worth paying for, and which one lesson cannot demonstrate.
The full assessment should stay free regardless: it is the most persuasive
artefact in the product, it costs nothing to run, and a parent who sees a real
skill profile for their child has already understood the value.

Cost of a generous demo, per free Explorer who never converts: **$0.0016.**
Both numbers are one-line config changes in `js/tutor/engine.js`.

### Usage controls: keep, but keep them invisible to the child

Keep `plusLessonsPerDay: 40` as an abuse backstop. It is roughly 10× any real
child's usage and would cost 65 cents/month to hit every day.

The child must never see a counter, a quota or a token balance. When the
ceiling is reached the child gets *"That's a lot of learning for one day —
brilliant work! See you tomorrow!"*, and the number appears only in the parent
dashboard, with an explicit note that the child is not shown it. That is
implemented and tested.

---

## 9. What to watch once it is live

The cost model above is derived from prompt sizes and assumed call rates. Two
of those assumptions are worth measuring rather than trusting:

| Assumption | How to check |
|---|---|
| **~700 audio tokens per minute of speech** 🚩 | `usage.voiceSeconds` against the real invoice. This is the least certain number in the document and the budget scales linearly with it. |
| ~$0.037 per voice minute | invoice ÷ (`usage.voiceSeconds` ÷ 60) |
| Most subscribers never approach the voice cap | distribution of `usage.voiceSeconds`, not the mean |
| ~2 child questions per lesson | `WW.learningProfile.data().usage.aiCalls` ÷ lessons |
| ~130 output tokens per call | `usage.aiTokensOut` ÷ `usage.aiCalls` |
| Offline bank handles most lessons | `usage.offlineFallbacks` vs `aiCalls` |
| Expression decisions per lesson | `usage.decisionCalls` ÷ lessons |

`WW.learningProfile.countUsage()` already records all four, per Explorer, with
no identifier attached — counts and token totals only, no content and no
per-call timestamps. That is enough to validate this model and not enough to
profile a child.

If `aiTokensOut ÷ aiCalls` comes in much above 130, the `TUTOR_MAX_OUTPUT` cap
(220) is doing less work than assumed and should come down — shorter answers
are better pedagogy for this age anyway.
