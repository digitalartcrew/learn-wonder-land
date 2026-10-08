# WonderTutor — cost model and pricing analysis

**Status: analysis only. No live price has been changed.** The UI still shows
$6.99/month and $39.99/year, exactly as before. A recommendation is at
[§8](#8-recommendation).

---

## 1. The headline finding

The brief assumed WonderTutor "introduces recurring AI costs" and that pricing
therefore needs recalculating. **The first half is true and the second half is
not.** WonderTutor does add a marginal cost per subscriber, but at the measured
architecture it is on the order of **one to seven cents per subscriber per
month** — three to four orders of magnitude below the subscription price.

| | Light | Average | Heavy |
|---|---|---|---|
| AI cost / subscriber / month | **$0.004** | **$0.016** | **$0.065** |
| As a share of a $6.99 subscription | 0.06% | 0.23% | 0.93% |

So the honest conclusion is: **a price increase is a value-capture decision,
not a cost-recovery one.** If WonderWorld+ moves from $6.99 to $9.99 it should
be because an AI tutor is worth more to a family, not because the inference
bill demands it. That distinction matters, because the two arguments lead to
different places — cost-recovery pricing would also imply usage metering, and
the numbers do not support metering a child's learning.

The reason the cost is this low is architectural, not luck. See
[§4](#4-why-it-is-this-cheap) — and [§5](#5-what-would-break-this), which is the
more important section.

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
| `lesson` / `answer` / `explain_again` | ~450 (system ~370 + user ~80) | ~130 (capped at 220) |
| Decisions `expression` | ~400 (instructions ~300 + 8 choice descriptions + state line) | 0 |

### Cost per call

```
Generation call  = (450 / 1e6 × $0.10) + (130 / 1e6 × $0.50)
                 = $0.000045 + $0.000065
                 = $0.00011          ≈ 0.011 cents

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
| The lesson explanation | 0.2 | Only for `AI_PREFERRED` skills (4 of 34) |
| Generating 6 questions | **0** | `WW.tutorContent` generates them locally |
| Scoring 6 answers | **0** | String and number comparison |
| Re-explaining after difficulty | 0.5 | Only when a child misses twice |
| Mastery / level / XP decisions | **0** | Arithmetic in `WW.learningProfile` |
| Child-initiated questions | ~2 | The genuinely valuable use |
| Expression decisions | ~6 | Decisions API, if enabled |

```
Per lesson = (0.2 × $0.00011)   lesson text
           + (0.5 × $0.00011)   re-explanation
           + (2.0 × $0.00011)   child questions
           + (6.0 × $0.00004)   expressions
           = $0.000022 + $0.000055 + $0.00022 + $0.00024
           = $0.00054            ≈ 0.054 cents per lesson
```

### Per subscriber per month

| Profile | Lessons/month | AI cost | Notes |
|---|---|---|---|
| **Light** | 8 | $0.004 | Twice a week |
| **Average** | 30 | $0.016 | Most school nights |
| **Heavy** | 120 | $0.065 | Several lessons a day, every day |
| **Pathological** | 1,200 | $0.65 | The fair-use ceiling, every day, all month |

Even the pathological case — a device hammering the 40-lessons-per-day ceiling
for 30 straight days — costs **65 cents**, under 10% of one month's
subscription. The fair-use limit in `WW.tutor.ACCESS.plusLessonsPerDay`
therefore exists to stop automated abuse, **not** to control cost.

### A family of four

Profiles are per Explorer, and WonderWorld+ allows four. Four average children
on one subscription is **$0.064/month** — still under 1% of $6.99. Multi-child
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

4. **No conversation history is sent.** Each call carries a small structured
   context, not a transcript. This is the big one for a chat-shaped product:
   history-passing grows input tokens linearly with session length, so turn 20
   costs 20× turn 1. A 20-turn session with history would run roughly
   **$0.02 instead of $0.0005** — a 40× multiplier — and would also be the
   single worst thing to do with a child's words from a privacy standpoint.

The expensive thing in an AI tutor is not the AI. It is calling the AI for
things a computer can already do.

---

## 5. What would break this

Costs below are per average subscriber per month, against the $0.016 baseline.

| Change | New cost | Multiplier |
|---|---|---|
| Generate all questions with a model | $0.18 | 11× |
| Send conversation history each turn | $0.64 | 40× |
| Switch to `gpt-5.4-mini` | $0.10 | 6× |
| Cloud text-to-speech (~500 words/lesson) | **$1–5** | **60–300×** |
| Child asks 30 questions/session, not 2 | $0.11 | 7× |
| All four of the above together | ~$8 | ~500× |

**Voice is the real risk.** WonderTutor currently uses on-device
`speechSynthesis` only — `js/tutor/voice.js` refuses any voice without
`localService === true`, which costs nothing and sends nothing. Moving to cloud
TTS would make audio the dominant line item by a wide margin *and* would post
the tutor's sentences to a third party. It is the one change that would
genuinely force a price increase, and it should be treated as a pricing
decision rather than a quality improvement.

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

### At today's $6.99/month

| | 15% | 30% |
|---|---|---|
| Gross | $6.99 | $6.99 |
| Apple commission | −$1.05 | −$2.10 |
| AI (average) | −$0.016 | −$0.016 |
| Infrastructure | −$0.00 | −$0.00 |
| **Net** | **$5.92** | **$4.87** |
| **Gross margin** | **84.7%** | **69.7%** |
| Margin after AI only (pre-Apple) | 99.8% | 99.8% |

### At the price points the brief asked about

Monthly, at 15% commission, average usage:

| Price | Net after Apple | Net after AI | Margin |
|---|---|---|---|
| $6.99 | $5.94 | $5.92 | 84.7% |
| $7.99 | $6.79 | $6.78 | 84.8% |
| $9.99 | $8.49 | $8.48 | 84.8% |
| $12.99 | $11.04 | $11.03 | 84.9% |

Annual, at 15%, average usage (12 months of AI):

| Price | Net after Apple | Net after AI | Effective /month | Margin |
|---|---|---|---|---|
| $39.99 | $33.99 | $33.80 | $2.82 | 84.5% |
| $59.99 | $50.99 | $50.80 | $4.23 | 84.7% |
| $79.99 | $67.99 | $67.80 | $5.65 | 84.8% |
| $99.99 | $84.99 | $84.80 | $7.07 | 84.8% |

**The margin column barely moves.** That is the whole analysis in one
observation: at this architecture, AI cost is not a variable that price has to
solve for. Apple's commission is 65× larger than the inference bill, and it is
proportional, so every price point lands at essentially the same margin.

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

**Why $9.99 rather than keeping $6.99:** an AI tutor that assesses a child,
builds a learning path and teaches in their own language is a different product
from a world map with five games. $6.99 now undersells it. Comparable
children's education subscriptions sit at $9.99–$12.99/month, and families
judge a tutor against tutoring, not against games.

**Why not $12.99:** it starts to invite comparison with human tutoring and with
full curriculum products, and WonderTutor is neither yet — the content bank is
English-only, eleven languages are unvalidated, and WonderSpace is not built.
Price for what exists.

**Why $79.99 annual rather than $59.99:** a 33% discount against monthly is the
conventional and defensible ratio, and annual is where the trial converts.
$59.99 would be a 50% discount, which trains buyers to wait for annual and
leaves money on the table at identical margin.

### The counter-argument, stated fairly

There is a real case for **keeping $6.99/$39.99**: margin is ~85% either way,
so the entire question is volume versus ARPU, and a cheaper price during a beta
buys adoption, reviews and word of mouth at a cost of nothing. If growth
matters more than revenue in the next two quarters, hold the price and raise it
at a natural moment — when WonderSpace ships, or when a second language is
validated. Raising later is easier than cutting later.

**My recommendation is $9.99/$79.99 for new subscribers, with existing
subscribers grandfathered.** But this is a judgement about positioning, and the
numbers genuinely do not force it. If you prefer to hold at $6.99, nothing in
the cost model argues against you.

### Free trial: keep 7 days, unchanged

7 days is enough for the thing that actually sells this: the child completes the
Initial Skills Assessment, gets a learning path, does several lessons, and the
parent opens the dashboard and sees per-subject levels for their own child.
That report is the conversion event. A trial costs about **$0.004** in
inference, so there is no reason to shorten it and no reason to gate the tutor
during it.

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
