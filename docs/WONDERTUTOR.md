# WonderTutor — architecture

An interactive animated tutor for children, inside WonderWorld. Plain
HTML/CSS/SVG and vanilla JavaScript, no build step, no framework, no third-party
script. Costs and pricing are in **[TUTOR_PRICING.md](TUTOR_PRICING.md)**.

**Contents**

1. [What it is](#1-what-it-is)
2. [What this is not](#2-what-this-is-not)
3. [The modules](#3-the-modules)
4. [The first-run flow](#4-the-first-run-flow)
5. [Grade and skill levels](#5-grade-and-skill-levels)
6. [The adaptive diagnostic](#6-the-adaptive-diagnostic)
7. [The mastery model](#7-the-mastery-model)
8. [The tutoring loop](#8-the-tutoring-loop)
9. [Choosing what to teach](#9-choosing-what-to-teach)
10. [AI provider architecture](#10-ai-provider-architecture)
11. [Expressions and the Decisions API](#11-expressions-and-the-decisions-api)
12. [The animated character](#12-the-animated-character)
13. [Voice](#13-voice)
13a. [Real-time voice](#13a-real-time-voice)
14. [Child safety](#14-child-safety)
15. [Privacy](#15-privacy)
16. [Cost controls](#16-cost-controls)
17. [Failure mode](#17-failure-mode)
18. [Multilingual architecture](#18-multilingual-architecture)
19. [What needs native-speaker validation](#19-what-needs-native-speaker-validation)
20. [Free vs WonderWorld+](#20-free-vs-wonderworld)
21. [Rewards](#21-rewards)
22. [Parent reporting](#22-parent-reporting)
23. [What to configure in Cloudflare and OpenAI](#23-what-to-configure-in-cloudflare-and-openai)
24. [Tests](#24-tests)
25. [Production risks](#25-production-risks)

---

## 1. What it is

WonderTutor knows the child's grade, works out their level in each skill
separately, teaches short lessons, sets practice, checks mastery without help,
revisits what has gone stale, and advances when the evidence supports it. It
answers questions at the child's level and, when the child has nothing to ask,
proposes something specific rather than sitting idle.

It is a character in the WonderWorld universe — an SVG creature that blinks,
talks and reacts — not a chat window with a mascot next to it.

**The thing that makes it work offline:** every question, every score, every
mastery decision and every level move is ordinary JavaScript. A language model
is asked only for the things it is genuinely better at. See
[§16](#16-cost-controls).

---

## 2. What this is not

*Referenced from `js/tutor/taxonomy.js`.*

WonderTutor measures **skills**. A level is a statement about a skill, not about
a child.

It does **not**, anywhere, in any module:

- diagnose or screen for a learning disability, dyslexia, ADHD, autism, or any
  disorder
- estimate intelligence, IQ, aptitude or potential
- infer or record the child's emotional state, mood, personality or temperament
- produce anything that may be presented as a clinical, medical or
  psychological finding

Those categories do not exist in the code. `js/tutor/safety.js` rejects tutor
output that strays into them, `/api/tutor`'s system prompt forbids it, and
`/api/tutor-emotion` is never offered such a category to choose from — so none
can be returned. There are tests for each.

WonderTutor also does not present itself as a person. It is **"Your WonderWorld
learning guide."** Output claiming to be human, to be a best friend, a
therapist or a parent substitute is rejected before display.

The four words a parent report may use about a skill are `below`,
`approaching`, `on` and `above` grade level. They describe the skill.

---

## 3. The modules

Load order is fixed in `index.html` and mirrored in `tools/logic-test.js`:

| File | Responsibility |
|---|---|
| `js/tutor/languages.js` | The 12 supported languages and what we will claim about each |
| `js/tutor/taxonomy.js` | Domains, skills, grade bands, prerequisites |
| `js/tutor/profile.js` | `WW.learningProfile` — grade, language, per-skill mastery |
| `js/tutor/content.js` | The offline lesson and question bank; deterministic scoring |
| `js/tutor/safety.js` | Outbound allow-list, input screening, output screening |
| `js/tutor/emotion.js` | `WW.tutorEmotion` — expression allow-list + deterministic rules |
| `js/tutor/avatar.js` | `WW.tutorAvatar` — the SVG character and its states |
| `js/tutor/voice.js` | `WW.tutorVoice` — on-device speech only |
| `js/tutor/realtime.js` | `WW.tutorVoiceChat` — spoken conversation over WebRTC |
| `js/tutor/provider.js` | `WW.tutorProvider` — offline and server adapters |
| `js/tutor/assessment.js` | `WW.tutorAssessment` — the adaptive diagnostic |
| `js/tutor/engine.js` | `WW.tutor` — skill choice, rewards, access |
| `js/tutor/session.js` | `WW.tutorSession` — one running lesson |
| `js/tutor/screen.js` | `WW.Screens.tutor` — the UI |
| `functions/api/tutor.js` | The only path to a text model |
| `functions/api/tutor-emotion.js` | The Decisions API call for expressions |
| `functions/api/tutor-realtime.js` | Mints ephemeral tokens for voice sessions |

Changes to pre-existing files are additive only: a screen section and 14 script
tags in `index.html`, those scripts in the `sw.js` shell (VERSION → `ww-v5`), a
`wonder-tutor` entry in `FEATURES`, a map entry point and a report card in
`js/screens.js`, a `tutor-back` handler and a `leave()` call in `js/core.js`,
one profile load in `game.js`, and tutor styles appended to `style.css`.

---

## 4. The first-run flow

WonderTutor never opens with "What would you like to ask?". A tutor that does
not know who it is teaching is a chatbot.

```
Meet WonderTutor
      ↓
Grade          ← a grown-up, behind the parental gate
      ↓
Tutoring language
      ↓
"Let's see what you already know!"     ← never called a test
      ↓
Learning path
      ↓
First personalised lesson
```

`WW.tutor.setupNeeded()` reports what is missing; `WW.Screens.tutor.enter()`
routes on it. The tutor **refuses to start** without a grade —
`WW.tutorAssessment.start()` returns `{ ok: false, reason: 'no_grade' }`.

Grade sits behind the `multiply` parental gate at scope `tutor-setup`. We never
ask for a birth date, never ask the child's age, and never infer age from
grade. There is no age or date field anywhere in the setup screen, and a test
asserts it by inspecting the DOM rather than the copy.

The child-facing words are *"Let's see what you already know!"*. The parent
dashboard calls the same thing an **Initial Skills Assessment**, because a
grown-up is entitled to the real name for it. The words *test*, *exam*, *quiz*
and *score* never appear in the child's view.

---

## 5. Grade and skill levels

Kindergarten is `0` and Grade 6 is `6`, so the whole range is integer
arithmetic. Seven grades are supported.

**A child is not one number.** Grade is what they are enrolled in; level is per
skill. A Grade 2 child can be at Grade 3 multiplication and Grade 1 spelling,
and `WW.learningProfile` stores it that way:

```js
WW.learningProfile.setGrade(2);
WW.learningProfile.setLevel('multiplication', 3);
WW.learningProfile.setLevel('spelling', 1);
WW.learningProfile.band('multiplication');   // 'above'
WW.learningProfile.band('spelling');         // 'approaching'
```

### Pitching it right

A skill's grade range starts at the grade a child is normally **taught** it,
not the grade they first hear the word. The first draft was a year or two
optimistic at the bottom end, which made the early grades feel punishing — a
five-year-old was asked to spell *elephant* and to say how many tens are in 17.

When in doubt, **start later**. A child who is ahead is moved up by the
diagnostic within a couple of questions; a child who is behind just feels bad.
There are tests pinning the bottom end: Kindergarten addition stays within
single digits, K shapes are triangles and squares, Grade 2 multiplication stays
inside the small tables, and no place-value question ever has the answer zero.

**The grade is changeable at any time** — from the grown-ups dashboard, or from
the tutor screen behind the gate. Changing it keeps every skill level the child
has already earned; it only changes where the tutor pitches from. An earlier
version could only set the grade on the very first run, with no route back,
which left a parent who picked wrong with no way to say so.

### The taxonomy

Six domains, 39 skills, each with a grade range and prerequisites:

| Domain | Skills |
|---|---|
| Mathematics | counting, number sense, comparison, addition, subtraction, multiplication, division, fractions, money maths, measurement, geometry, word problems |
| Reading | phonics, vocabulary, comprehension, main idea, inference |
| Writing | spelling, sentences, grammar |
| Science | living things, plants, weather, matter, forces, earth and space |
| Social Studies | community, maps, environment |
| Financial Literacy | coins and notes, saving, spending choices, revenue/cost/profit |

Science aligns with Science Lab, financial literacy with Business Town, social
studies with Planet City — `WW.tutorTaxonomy.worldFor()` and `skillsForWorld()`
map both ways, which is what lets the tutor say something true about a world the
child has actually played.

**To add a skill:** one entry in `SKILLS` with a domain, a grade range and its
prerequisites. The diagnostic, the lesson picker and the parent report all read
that table.

---

## 6. The adaptive diagnostic

`WW.tutorAssessment`. No child gets a standardised battery.

It plans one skill per domain first (breadth before depth), then fills up to
`CONFIG.skillsTargeted`. Skills with no offline content are skipped, because
the diagnostic must work on a plane.

```
correct              → one step harder
incorrect            → ask again on the SAME skill at the SAME level
                       (one slip is not evidence)
wrong twice          → step the skill down, move on
right twice          → step the skill up, move on
```

It stops when every planned skill has a verdict, or at `CONFIG.max`. If every
skill retires early and fewer than `CONFIG.min` questions have been asked, it
**widens** rather than stopping — pulling in skills from the grade either side,
which also catches a child working well above or below their enrolled grade.

```js
WW.tutorAssessment.CONFIG = {
  min: 10, max: 20, perSkill: 3, skillsTargeted: 8
};
```

All four are configurable; nothing is hard-coded in the UI. In practice a run
takes **about 16 questions**.

**It costs nothing.** Every question comes from the offline bank and every
answer is scored by comparison. There is no AI call anywhere in
`js/tutor/assessment.js`.

---

## 7. The mastery model

All deterministic. Nothing here asks a model whether a child has learned
something.

```js
{
  skillId, level,
  mastery,          /* 0..1, weighted recent accuracy */
  confidence,       /* how much evidence, not how good  */
  attempted, correct, streak, solidSessions,
  recent: [],       /* last 8 results, newest last */
  lastPracticed, lastAssessment,
  needsReview, nextReview,
  lessons
}
```

**Recency weighting.** The newest answers count most, so a child who has just
understood something is not held back by the attempts they got wrong while
learning it. Six wrong followed by six right reads as `0.92`, not `0.50`.

```js
mastery = Σ(weight_i × correct_i) / Σ(weight_i)      // weight = position, 1..n
```

**Thresholds.** Mastered at `≥ 0.85` with at least 5 attempts. Solid enough to
build on at `≥ 0.70`. Struggling below `0.50`, which sets `needsReview`.

**Levelling up resets the evidence.** A new level is new material, so the old
recent window would make the child look better at it than they are:

```js
if (mastered && Profile.isMastered(skillId)) {
  s.level++;
  s.recent = []; s.attempted = 0; s.mastery = 0;   // earn it again
}
```

A level **never** rises without the mastery to back it. `completeLesson()` can
be told a lesson was mastered and will still refuse if the evidence is not
there — there is a test for exactly that, because this is the guarantee that
stops a level from being a participation trophy.

**Spaced review.** `nextReview` grows `1 → 2 → 4 → 8 → 16 → 30` days with
consecutive solid sessions and contracts on a miss.

---

## 8. The tutoring loop

```
ASSESS → TEACH → PRACTISE → CHECK → ADAPT → REVIEW → ADVANCE
```

`WW.tutorSession` runs one lesson:

| Phase | Shape | Help? |
|---|---|---|
| **LESSON** | 3–4 sentences | — |
| **PRACTICE** | 3 questions | **Yes** — explains and lets them retry |
| **CHECK** | 3 questions | **No** — this is the evidence |
| **VERDICT** | mastered at ≥ 2 of 3 | — |

Practice and check are different on purpose. A child who needs three goes at a
practice question has still learned it; a child who needs three goes at a check
question has not shown it yet. **Only the check counts towards the lesson
verdict.**

On a second miss in practice, the level steps down and the tutor asks the
provider for a *different* explanation (`explain_again`), falling back to the
bank's worked example.

### Never shame

This is product copy, not decoration. There is no "wrong again", no "that's
easy", no "you should know this", and no streak the child can break.

| Situation | What the tutor says |
|---|---|
| First miss | "Not quite — have another go. You're close!" |
| Second miss | "Almost! Let's look at it another way." + a new explanation |
| Correct | "Nice one!" / "That's it!" / "Exactly right." |
| Not mastered | "Good effort — fractions is coming along. We'll come back to it soon." |

A browser test asserts the encouraging phrasing appears **and** that the
shaming phrasing does not.

### Choosing what to do

The tutoring screen offers real options rather than one button:

| Option | What it does |
|---|---|
| **Let's learn _&lt;skill&gt;_** | `WW.tutor.nextSkill()`, named — not a mystery box — with its reason underneath |
| **Choose a subject** | Six domains → the skills inside, each showing where the child is up to |
| **Practise something tricky** | `Profile.weakest()`. Only shown when there genuinely is one |
| **Surprise me** | A random skill at their level |

An earlier version asked "What would you like to do?" and offered exactly one
answer, which is not a choice.

### The typed question box: removed

`WW.tutorSession.ask()` and `WW.tutorAnswers` are **still present and still
tested** — the answerer works out arithmetic, spells 57 words, defines 94 terms
and explains 10 concepts, all offline. It is simply no longer rendered.

A free-text box set an expectation the tutor could not meet. Without a
configured model it answers a decent range and then has to say "I don't know
that one" — and a child does not experience that as a careful boundary, they
experience it as a thing that does not work. Every option on the guided menu
leads somewhere, so it never has that failure mode.

Restoring it is rendering a box again, not rebuilding a feature.

---

## 9. Choosing what to teach

`WW.tutor.nextSkill()`, in priority order. **Foundations always win:**

1. **A prerequisite gap** under something the child is attempting. Teaching
   long division to a child shaky on multiplication wastes everyone's time.
   `prereqGap()` walks down to the *deepest* unmet prerequisite.
2. **A review that has come due** (spaced repetition).
3. **The weakest skill** with real evidence behind it.
4. **Something at grade level never tried.**
5. **The strongest skill, one level up.**

It returns a reason, so the tutor can say something true about its own choice —
`WW.tutor.proactiveOpener()` turns it into a specific sentence:

| Reason | Opener |
|---|---|
| `prereq` | "Before we tackle division, let's make multiplication really solid. It makes the next bit much easier." |
| `review` | "Let's go back over fractions for a moment — a quick refresh makes it stick." |
| `practice` | "I found something we can practise! Let's work on fractions together." |
| `new` | "Today we're going to learn about multiplication!" |
| `advance` | "You're doing really well at addition — ready for a trickier one?" |

**Noticing the game.** `WW.tutor.gameNudge()` reads world accuracy from the
save and, below 70%, offers a matching skill. The save is read **locally**; only
world *names* ever reach the context object.

---

## 10. AI provider architecture

Same shape as billing: game code calls `WW.tutorProvider`, never a model SDK.

```js
WW.tutorProvider.generate('lesson' | 'answer' | 'explain_again', context)
  // -> Promise<{ ok, text, source: 'offline'|'server', reason }>
```

| Provider | State |
|---|---|
| `offline` | The lesson bank. Always available, costs nothing, works on a plane. **The default and the floor — not a degraded mode.** |
| `server` | `POST /api/tutor`, a first-party endpoint on our own origin. Optional in every sense. |

**There is no key in the browser.** No OpenAI SDK, no provider URL, no model
name in client code. Tests assert that no client file mentions
`api.openai.com`, `v1/chat/completions` or `v1/decisions`, and that no
`sk-`-shaped string or `OPENAI_API_KEY` appears anywhere in the client.

**Circuit breaker.** After 2 consecutive failures the server provider stops
being tried for 60 seconds, so a broken deploy costs one slow request rather
than one per turn.

`generate()` **never rejects.** Offline, no endpoint, HTTP error, timeout,
malformed JSON, unsafe output — every path resolves to a usable offline result.

---

## 11. Expressions and the Decisions API

`WW.tutorEmotion` picks the **tutor's** face. See
[§2](#2-what-this-is-not) — it is not a reading of the child.

### The allow-list is the security boundary

```js
EMOTIONS = ['happy', 'excited', 'encouraging', 'curious',
            'celebrating', 'gentle_correction', 'thinking', 'neutral'];
```

A model never returns animation code, CSS, or anything the renderer executes.
It returns one word, and that word must be on the list. **Two independent
checks:** `WW.tutorEmotion` validates a decision before returning it, and
`WW.tutorAvatar.setState()` validates again before touching the DOM. An unknown
state is dropped and the previous face stays.

### Deterministic rules — these are the behaviour

| Signal | Expression |
|---|---|
| `answered_correctly` | `happy` (`excited` on a streak ≥ 3) |
| `answered_incorrectly` | `encouraging` |
| `repeated_incorrect` | `gentle_correction` |
| `asked_question` | `curious` |
| `skill_mastered` / `assessment_completed` | `celebrating` |
| `lesson_completed` | `celebrating` if mastered, else `encouraging` |
| `processing` | `thinking` |
| anything unrecognised | `neutral` |

### The Decisions API

`POST /api/tutor-emotion` → `POST https://api.openai.com/v1/decisions`, using a
`choice` question with `gpt-6-luna`:

```json
{
  "model": "gpt-6-luna",
  "input": "What just happened: answered incorrectly. The child has missed this 2 times in a row.",
  "questions": [{
    "type": "choice",
    "name": "expression",
    "instructions": "Choose the expression a warm, patient teacher would wear…",
    "choices": [{ "value": "encouraging", "description": "Kind and steady…" }, …]
  }]
}
```

The response carries `choice`, per-option `probabilities` and a `confidence`.
A `choice` question is exactly the right shape here: the constraint is enforced
by the API rather than by us parsing and hoping, and it bills **input tokens
only** ($0.10/1M), so the layer that fires most often is close to free.

Three ways the server declines rather than guesses:

- `type === 'refusal'` → no opinion, keep the deterministic answer
- `choice` not on the **server's own** list (not the one in the request)
- `confidence` below `TUTOR_MIN_CONFIDENCE` (default 0.55) — a coin-flip
  between two faces is not better than the rule we already have

**It is off by default.** `WW.tutorEmotion.useDecisionsAPI === false` until an
endpoint is configured, and the client abandons the call after **1.2 seconds**
regardless. A child should never watch a face buffer.

### What is sent

A signal word, two small integers and two booleans. No question text, no answer
text, no nickname, no identifier. There is nothing in the request that could
single out a child, which is why nothing is logged.

---

## 12. The animated character

`WW.tutorAvatar`. Hand-written SVG, moved with CSS. No animation library — the
rest of the game draws its characters this way and a tutor is not a good enough
reason to add the project's first dependency.

**States:** `idle`, `listening`, `thinking`, `talking`, `happy`, `excited`,
`encouraging`, `curious`, `celebrating`, `gentle_correction`, `neutral`.

`setState('encouraging')` puts `is-encouraging` on the root; every brow angle,
eye shape and cheek level for that state lives in `style.css`. **JavaScript
decides what the tutor feels; CSS decides what that looks like.** Nothing in
`js/tutor/` writes a style string, and nothing outside can hand this module
markup to render.

One exception, for correctness: mouth shapes are set from a fixed table in
`avatar.js` via `setAttribute('d', …)`, because the CSS `d` property is not
supported in Firefox and would otherwise leave the mouth — the most expressive
part of the face — frozen. The talking animation uses `transform: scaleY()` for
the same reason.

Blinking is irregular on purpose; a perfectly timed blink looks like a machine.

### How much it talks

Speech is **opt-in per call**, not the default. `say()` and `mountStage()` both
take a `speak` flag, and most callers do not pass it.

| Moment | Spoken? |
|---|---|
| Meeting the tutor for the first time | ✅ |
| The assessment invitation | ✅ once, at the start |
| Before each assessment question | ❌ — and there is no filler line either |
| Finishing the assessment | ❌ — a `levelup` chime and confetti |
| The lesson explanation | ✅ |
| A re-explanation after a second miss | ✅ — the one place hearing it again helps |
| After each practice answer | ❌ — the `good`/`oops` chime already said it |
| The verdict at the end | ✅ |

An earlier version spoke on every screen mount, before every question and
after every answer. That slowed the child down and became noise. It also now
respects the existing **Cheering voice** switch, so a parent can quieten the
tutor without muting the game's sounds.

### Reduced motion

Honours both `prefers-reduced-motion` and the app's own `reduceMotion` setting.

**Motion is decoration; expression is information.** Under reduced motion the
blinking, the idle float and the talking bob all stop — but the face still
*changes*. A child who asked for less movement has not asked to be denied the
difference between "well done" and "let's try that again".

---

## 13. Voice

`WW.tutorVoice` — `speak(text, lang)`, `stop()`, `pause()`, `resume()`.

**The privacy rule is unchanged from `js/core.js`.**
`SpeechSynthesisUtterance` is not necessarily local; several browsers ship
"natural" voices that synthesise in the cloud, which would post whatever the
tutor is saying to a third party we have no relationship with. Only voices with
`localService === true` are used, per language.

If no on-device voice exists for the tutoring language, **WonderTutor stays
silent.** It does not fall back to a cloud voice, and it does not fall back to
the wrong language — which would be worse than silence for a child learning to
read.

While speech plays the avatar is `is-speaking` so the mouth moves; on end,
error or stop it goes back. That handoff lives in `voice.js` rather than
`avatar.js` so the mouth can never be left moving after the audio has stopped.
`WW.Screens.tutor.leave()` and `WW.Nav.go()` both stop speech, so there is no
exit that leaves a voice talking over the next screen.

**Voice is never required.** Everything is on screen as text first.

**Voice INPUT is deliberately not implemented.** A microphone in a children's
app needs a privacy review that has not been done. A text box is enough.

---

## 13a. Real-time voice

Spoken, two-way conversation with the tutor. `WW.tutorVoiceChat`, backed by
`/api/tutor-realtime` and the Realtime API over WebRTC.

> **This is the only feature in WonderWorld that sends anything off the
> device from the microphone.** Everything else in this document is built on
> the opposite premise. It is gated three independent times and it is off by
> default.

### The three gates

| Gate | Where | What it does |
|---|---|---|
| **1. Server** | `TUTOR_REALTIME_ENABLED` must be exactly `'true'` | Off until the privacy review and the published policy update are actually done. An API key alone is not enough — text and voice have different consequences and do not share a switch. |
| **2. Parent** | Parental gate (`multiply-adjust`) + versioned consent | A grown-up reads what is being agreed to and acts. Stored per Explorer, revocable from the dashboard. |
| **3. Child** | Push-to-talk | The audio track is `enabled = false` except while the button is physically held. |

All three must pass. `WW.tutorVoiceChat.available()` is the single question the
UI asks, and it checks capability, consent and budget in that order.

### Push-to-talk, not an open microphone

`turn_detection` is `null` in the session config, so the model never decides on
its own that it is being spoken to. A turn is explicit:

```
hold    → track.enabled = true            the child speaks
release → track.enabled = false
          input_audio_buffer.commit       "that was my turn"
          response.create                 "your go"
```

The mic is genuinely off between turns rather than live and ignored. Releasing
outside the button, losing focus, `pointercancel` and leaving the screen all
end the turn — a microphone left live because a gesture ended somewhere
unexpected is exactly the bug worth designing out, so every exit calls
`release()` or `stop()`.

`WW.Screens.tutor.leave()` and `WW.Nav.go()` both call
`WW.tutorVoiceChat.stop()`, which disables **and** `.stop()`s the track rather
than only muting it.

### The connection, and the one external host

```
browser → POST /api/tutor-realtime          our origin, mints the token
        ← { value: "ek_…" }                 ephemeral, minutes
browser → POST api.openai.com/v1/realtime/calls   SDP offer, ephemeral key
        ↔ audio over WebRTC                 direct, peer to peer
```

Our `OPENAI_API_KEY` is used once, server-side, and never reaches the browser.

**This changed a project invariant worth stating plainly.** Before voice, no
client file named an external host — every request went to our own origin.
WebRTC requires the browser to post its SDP offer directly to the provider, so
`js/tutor/realtime.js` now names `api.openai.com`. The alternative, proxying
audio through our own Worker, would put us *inside* the audio path, which is
worse for privacy and costs more. The tests were changed from "no external
URLs" to "exactly one, in exactly one file, for exactly one purpose", and they
assert that no other client file reaches any external host.

### Safety out loud

The spoken tutor gets the written tutor's rules plus the ones that only matter
in conversation, as session `instructions`:

- Short turns. Stop and let the child answer. Never talk over them.
- Never ask for, repeat, or **acknowledge** personal information. A child will
  volunteer their name out loud far more readily than they will type it.
- Never claim to be human; if asked, say plainly it is a helper in the game.
- Never suggest secrecy, never mention links or buying anything.
- Never diagnose anything.
- **If a child says something suggesting they are in danger, do not counsel
  them** — say a trusted grown-up should be told, and stop.

Transcripts are screened with the same `tutorSafety` functions as typed text.
A tutor utterance that fails `inspectOutput` triggers `response.cancel`,
cutting the audio mid-sentence rather than letting it finish.

### What is and is not stored

Nothing is recorded. No audio is written to disk, buffered or uploaded by us,
and the audio does not pass through our Function at all — it goes browser↔
provider. There is no `MediaRecorder` anywhere in the project, and a test
asserts it.

Transcripts live in `WW.tutorSession._turns` for the lesson and are discarded
when it ends. The only thing persisted is `voiceLog` — `{ at, sec }` entries,
durations only, trimmed to 31 days, for the budget.

### The budget

Voice is the one feature whose cost can exceed the subscription: roughly 3–4
cents a minute against 0.013 cents for a typed exchange. So unlike the lesson
cap, this is an economic limit rather than an abuse backstop.

```js
WW.tutor.ACCESS.plusVoiceMinutesPerDay   = 20;
WW.tutor.ACCESS.plusVoiceMinutesPerMonth = 120;
WW.tutor.ACCESS.freeVoiceMinutes         = 0;
```

Metered from when the data channel opens — not from when the button is held,
because the model streams audio back during the gaps. Checked every 5 seconds,
and counted on teardown *first* so a crash still bills the seconds used.

**The child never sees a number.** Out of allowance reads as *"My talking voice
needs a rest for now — but I can still teach you here!"*. A free Explorer whose
parent consented gets a *different* message — the WonderWorld+ handover —
because calling a plan boundary "a rest" would be a small lie. Full numbers are
in [TUTOR_PRICING.md §5a](TUTOR_PRICING.md#5a-the-voice-budget).

### Degrading

No consent, server switch off, no WebRTC, microphone denied, token refused,
connection lost, budget spent — every path leaves the typed tutor working
exactly as before, and says something true about why. Voice is never required
to learn.

---

## 14. Child safety

`js/tutor/safety.js`, mirrored server-side in `functions/api/tutor.js`. A
client-side rule is a rule you have to assume was bypassed, so both ends check.

### The child's words, before they leave the device

`inspectInput()` refuses and answers locally — the text is **not transmitted**:

- email addresses, phone numbers, URLs, street addresses, postcodes
- "I live at/on/in…", "my address/phone number/email/password"
- "my school is…", "I go to … School"
- "my full/last/real name"
- off-topic or unsafe shapes, and prompt-injection attempts

A child who volunteers something personal gets: *"Let's keep things like names,
addresses and phone numbers private — even with me. Ask me about something
you're learning instead!"* — phrased so it does not teach them how to get
around it.

### The tutor's words, before the child sees them

`inspectOutput()` runs on **every** tutor line, from a model or the offline
bank — a rule that applies to one source is a rule with a hole in it. Rejected
output is **replaced**, never shown:

| Rejected | Why |
|---|---|
| "What is your name?" | asks for PII |
| "Where do you live?" | asks for PII |
| "What school do you go to?" | asks for PII |
| "How old are you?" | asks for age |
| "Don't tell your parents" / "our little secret" | secrecy |
| "I'm a real person" | claims human |
| "I am your best friend" | claims friendship |
| "You might have dyslexia" / "that sounds like ADHD" | clinical |
| any URL or email address | external contact |

Output over 700 characters is trimmed rather than rejected: a wall of text is a
pedagogical failure for this age, not a safety one.

---

## 15. Privacy

The monetization layer added one network call. WonderTutor adds three, all
first-party endpoints on this origin: `/api/tutor`, `/api/tutor-emotion` and
`/api/tutor-realtime`. Tests assert every literal `fetch` target is one of
those or `api/subscribe`.

**One exception, introduced by voice.** `js/tutor/realtime.js` posts an SDP
offer directly to `api.openai.com/v1/realtime/calls`, because that is how
WebRTC works — proxying audio through our own Worker would put us inside the
audio path. It is the only external host named anywhere in the client, it is
quarantined to that one file, and tests assert no other client file reaches any
external host. See [§13a](#13a-real-time-voice).

### What is sent to a model

`WW.tutorSafety.buildContext()` builds the payload by **allow-list**, so the
only way to send a new field is to add it there on purpose:

```js
{
  grade, language, skillId, skillName, level, band,
  recentCorrect, recentAttempted, stuck,
  intent, question,          // one short, already-screened question
  worldsPlayed: ['math'],    // names only
  sessionRef                 // opaque, random, per session, never stored
}
```

Absent **by construction**: the nickname, the avatar, the parent's email, the
save file, XP, gems, crystals, badges, any device identifier, anything
location-shaped, and any persistent id.

`scrubOutbound()` is a final sweep before transmission — it pattern-matches for
emails, phones and addresses, and checks directly for the child's nickname,
which is not pattern-matchable. A context containing it is blocked.

### What is stored, and where

```
wonderworld.tutor.v1               ← Explorer 1's learning profile
wonderworld.tutor.v1.explorer-2    ← and so on
```

Its own key, derived from the same roster seam `core.js` uses, **never inside
the child's save**. The save is the game; a learning profile is a different
lifetime with different privacy properties. A parent can reset tutoring without
wiping crystals, and nothing in the tutor can corrupt a game in progress.

### What is not logged

`functions/api/tutor.js` writes no request body, no question text and no model
output anywhere. The only persisted value is an integer request count against a
truncated hash of the IP, day-bucketed with a 48-hour TTL, for abuse control —
one integer that expires, joined to nothing.

---

## 16. Cost controls

*Referenced from `js/tutor/profile.js`. Full numbers in
[TUTOR_PRICING.md](TUTOR_PRICING.md).*

**Do not call a language model for something ordinary JavaScript can calculate
reliably.** That single rule is most of the cost model.

| Job | How |
|---|---|
| Generating questions | **Deterministic** — `tutorContent` |
| Scoring answers | **Deterministic** — string/number comparison |
| Mastery, confidence, levels | **Deterministic** — arithmetic |
| XP, gems, unlocks | **Deterministic** — existing `WW.Progress` |
| Choosing the next skill | **Deterministic** — `nextSkill()` |
| Facial expression | Deterministic rules; Decisions API optional |
| Lesson explanations (prose skills) | Model, where it genuinely earns it |
| Answering a child's own question | Model |
| Re-explaining after difficulty | Model |

`WW.tutorProvider.shouldAsk(intent)` is the gate. `WORTH_ASKING` is
`['answer', 'explain_again', 'lesson', 'encourage']` — every teaching intent.
Everything NOT on that list stays deterministic, and there are tests asserting
that generating and scoring questions never costs a call.

An earlier version restricted lessons to four "prose" skills and gave the other
thirty a canned sentence. That was a cost decision taken before the cost was
measured; it saved about two cents a month and made the tutor sound like a
worksheet, so it was removed.

**History is bounded, not absent.** Six turns and 700 characters, capped on the
client in `tutorSafety.buildContext()` and re-capped on the server, so the
tutor has continuity without accumulating a transcript. Unbounded history would
grow input tokens linearly with session length — turn 20 costing 20× turn 1 —
and would be the worst thing to do with a child's words. Bounded history is a
flat ~200 tokens forever.

**Spoken conversation is the exception** and has its own hard budget, because
unlike text it can cost more than the subscription. See
[§13a](#13a-real-time-voice).

`WW.learningProfile.countUsage()` records `aiCalls`, `aiTokensIn`,
`aiTokensOut`, `decisionCalls` and `offlineFallbacks` per Explorer. Counts and
token totals only — no content, no per-call timestamps, no identifier. Enough to
validate the cost model, not enough to profile a child.

---

## 17. Failure mode

*Referenced from `js/tutor/content.js`.*

**WonderWorld must remain fully usable when every one of these is broken.**

| Broken | What happens |
|---|---|
| No internet | Offline bank. Lessons, practice, checks, mastery all work. |
| `OPENAI_API_KEY` not set | Endpoint returns 503 `not_configured`; client uses the bank. **This is the shipping state.** |
| `/api/tutor` down or slow | 8s timeout, breaker opens, offline fallback. |
| Model returns unsafe output | Rejected server-side and client-side; child sees a safe line. |
| Decisions API down | Deterministic expression rules — the real behaviour anyway. |
| `speechSynthesis` missing | Text tutoring continues; the mouth does not move. |
| No on-device voice for the language | Silent rather than cloud or wrong-language. |
| Cloudflare Function fails | Offline fallback. |
| Rate limited | Offline fallback. |
| `TUTOR_REALTIME_ENABLED` not set | Voice is simply not offered. Typed tutoring unaffected. |
| Microphone permission denied | "I can't hear the microphone. You can still type to me!" |
| Voice token refused / connection lost | Falls back to typed tutoring, says so. |
| Voice budget spent | "My talking voice needs a rest" — typed tutoring continues. |

When there is genuinely nothing to teach, the child sees *"WonderTutor is
resting right now. You can keep exploring WonderWorld!"* and a button back to
the map. Never a dead end, never a stack trace, never a spinner that does not
end.

A browser test kills `window.fetch` outright, confirms `generate()` does not
throw, confirms the child still gets something kind, and then confirms the map
still renders all seven nodes.

---

## 18. Multilingual architecture

### Two things that are not the same

```
TUTORING LANGUAGE          the language the tutor SPEAKS.
                           A child can learn fractions in Spanish.

LANGUAGE BEING LEARNED     a language that is itself the SUBJECT.
                           An English speaker studying Spanish.
```

Stored in **two separate fields** (`language` and `learningLanguage`), and
neither is ever inferred from the other. Three tests assert that setting one
does not move the other. This sprint implements the first; the second is a skill
domain for the taxonomy when it is built.

### The twelve

These are **"Supported Languages"** — not a claim about the world's most-spoken
languages, because rankings disagree depending on whether you count native
speakers, total speakers, or how you group dialects. Codes are BCP-47, using
ISO 639-3 where no two-letter code exists.

| Code | Language | Native name | State | Validated |
|---|---|---|---|---|
| `en` | English | English | **supported** | ✅ |
| `zh-CN` | Mandarin Chinese | 中文（普通话） | beta | — |
| `hi` | Hindi | हिन्दी | beta | — |
| `es` | Spanish | Español | beta | — |
| `fr` | French | Français | beta | — |
| `ar` | Arabic | العربية (RTL) | beta | — |
| `bn` | Bengali | বাংলা | beta | — |
| `pt` | Portuguese | Português | beta | — |
| `ru` | Russian | Русский | beta | — |
| `ur` | Urdu | اردو (RTL) | beta | — |
| `kos` | Kosraean | *(not set)* | **experimental** | — |
| `haw` | Hawaiian | ʻŌlelo Hawaiʻi | **experimental** | — |

**Quality is not claimed to be equal.** Every entry carries a capability state
and nothing in the app may claim accuracy beyond it:

- **supported** — human-written, reviewed content. English today.
- **beta** — the model can tutor in it, but no native speaker has reviewed the
  output and the offline bank is still English. The UI says so.
- **experimental** — not offered as a teaching medium at all. Listed, visible,
  and honest about why.

All twelve appear in the picker, including the ones that are not ready, because
hiding them would hide the reason they are not ready. The state is rendered as a
**word** (`ready` / `beta` / `needs validation`), never as colour alone.

`canTeachIn()` returns false for experimental languages; selecting one shows the
disclosure and does not change the teaching language. `coerce()` falls back to
English rather than failing.

The Kosraean endonym is deliberately `null` rather than guessed. Writing the
wrong word for someone's own language on a language picker is exactly the kind
of error this design exists to avoid.

---

## 19. What needs native-speaker validation

*Referenced from `js/tutor/languages.js`.*

**Kosraean (`kos`) and Hawaiian (`haw`) are `experimental` and are not offered
as a teaching medium.** Machine translation into low-resource languages fails in
ways that are invisible to a non-speaker. Shipping subtly wrong language to a
child who is learning to read would be worse than not shipping it, and no
amount of prompt engineering substitutes for someone who speaks it.

Before either can move to `beta` or `supported`:

- [ ] A native speaker reviews generated tutoring output at each grade level
- [ ] The endonym is confirmed (Kosraean's is currently `null` by design)
- [ ] Number words, counting and arithmetic phrasing are checked — these are
      where translation most often goes wrong in a maths lesson
- [ ] Orthography and diacritics are confirmed (ʻokina and kahakō for Hawaiian)
- [ ] Someone decides whether a language with no on-device TTS voice should
      offer voice at all
- [ ] The capability state in `languages.js` is updated, and only then

**The nine `beta` languages need the same review** before any accuracy claim is
made about them. They are selectable because a model can genuinely tutor in
them and a bilingual family may prefer that to English — but the UI discloses
that no native speaker has checked it, and the parent dashboard repeats the
disclosure.

Separately, the offline lesson bank is **English-only**. A beta language falls
back to the English bank when the model is unavailable, which is honest but not
good. Per-language content packs are the real fix.

---

## 20. Free vs WonderWorld+

WonderTutor is `tier: 'plus'` in `FEATURES` (`js/entitlements.js`).

```js
WW.entitlements.hasFeature('wonder-tutor')
```

**The core five-world adventure is unchanged and still free.** A test asserts
all five worlds are still `tier: 'free'` after the tutor landed, and that a Plus
subscriber with no crystals still cannot open WonderSpace — paying still never
bypasses learning.

### The free demo

`WW.tutor.ACCESS` — configurable, because the right allowance is a pricing
question:

```js
{
  freeAssessment: true,            // the full diagnostic, free
  freeLessons: 1,                  // then the premium door
  plusLessonsPerDay: 40,           // fair use, for subscribers

  plusVoiceMinutesPerDay: 20,      // economic limits, not abuse backstops
  plusVoiceMinutesPerMonth: 120,
  freeVoiceMinutes: 0              // voice is never in the free demo
}
```

A free Explorer can meet the tutor, sit the whole assessment, get a learning
path and do a real lesson. That is deliberate: a grown-up cannot judge a tutor
they have never seen, and the resulting skill report is the most persuasive
thing in the product. [TUTOR_PRICING.md §8](TUTOR_PRICING.md#8-recommendation)
recommends raising `freeLessons` to 3.

### What the child sees at the door

The same friendly handover as every other premium door in the game:

```
✨ More lessons together

WonderTutor is part of WonderWorld+. Ask a grown-up to help you
keep learning with me.

Everything you've already learned is still yours. Keep exploring! 🌳

[ Ask a Grown-Up ]        ← parental gate, then the Plus page
← Back to the map
```

No price. No "buy". No token counter. No countdown. **Usage limits are a
conversation with the parent** — when the fair-use ceiling is hit the child gets
*"That's a lot of learning for one day — brilliant work! See you tomorrow!"*,
and the number appears only in the parent dashboard with an explicit note that
the child is not shown it.

---

## 21. Rewards

Tutoring pays the same XP and gems the rest of the game pays, for the same
reason: real work.

| Event | Reward |
|---|---|
| Correct practice answer | 2 XP |
| Lesson completed | 12 XP |
| Skill mastered (first time only) | +25 XP, +5 💎 |

**Nothing is exploitable:**

- Chatting earns **nothing at all**. `ask()` pays no reward.
- A lesson pays nothing below 2 check answers (`not_enough_work`).
- A skill's lesson reward pays once per 6 hours (`cooldown`).
- Mastery pays once per skill, ever (`masteredEver`).

All four are tested. Gems, XP and crystals remain unsellable — tutoring is
another way to **earn** them, never a way to buy them.

---

## 22. Parent reporting

Added to the existing Grown-Ups dashboard, behind the existing gate.

- Grade setting, and the tutoring language with its capability state and
  disclosure
- **Initial Skills Assessment** state and question count
- Per domain: estimated level, band in words, counts of skills mastered /
  practising / needing review, and which ones are worth revisiting
- Sessions and lessons completed
- Fair-use count, once above 75% of the ceiling, with a note that the child is
  not shown it
- An explicit statement that these are skill levels and that WonderTutor does
  not diagnose learning difficulties or any medical condition

**Not** a chat transcript. A parent gets to know what their child is working on
and how it is going — which is what a report is for — without the tutor becoming
a surveillance device pointed at a six-year-old's questions. A test asserts the
report contains no "You asked:" lines.

Every figure is computed from the profile. Nothing is fabricated; where a number
cannot be calculated the card says so.

---

## 23. What to configure in Cloudflare and OpenAI

**Nothing is required to ship.** With no key configured both endpoints return
503 and the tutor uses its offline bank. That is a supported state, and it is
how this ships today.

### To enable model-written explanations

1. **OpenAI** → create an API key.
2. **Cloudflare dashboard** → Pages project → Settings → Environment variables
   → add as **encrypted**:

   | Variable | Value |
   |---|---|
   | `OPENAI_API_KEY` | `sk-…` |

3. Optional, same place:

   | Variable | Default | Purpose |
   |---|---|---|
   | `TUTOR_MODEL` | `gpt-6-luna` | Text model for explanations |
   | `TUTOR_MAX_OUTPUT` | `220` | Output token cap |
   | `TUTOR_DAILY_CAP` | `400` | Requests per IP per day |
   | `TUTOR_DECISION_MODEL` | `gpt-6-luna` | Decisions API model |
   | `TUTOR_MIN_CONFIDENCE` | `0.55` | Below this, use the deterministic face |

4. Optional, for the rate limit to actually persist: Workers & Pages → KV →
   create a namespace, then Pages → Settings → Functions → KV bindings:

   | Variable | Binding |
   |---|---|
   | `TUTOR_LIMITS` | the namespace |

   Without it the cap is skipped and only per-request limits apply.

### To enable spoken conversation

**Only after the privacy review and the published policy update.** The switch
exists so that shipping the code and enabling the feature are two separate
decisions.

| Variable | Value |
|---|---|
| `TUTOR_REALTIME_ENABLED` | `true` |

Optional:

| Variable | Default | Purpose |
|---|---|---|
| `TUTOR_REALTIME_MODEL` | `gpt-realtime-2.1` | Realtime model |
| `TUTOR_REALTIME_VOICE` | `marin` | Output voice |
| `TUTOR_REALTIME_CAP` | `40` | Sessions per IP per day |

A grown-up must still consent on the device; the server switch only makes the
feature reachable.

### To enable the Decisions API expression layer

Set `WW.tutorEmotion.useDecisionsAPI = true` in `js/tutor/emotion.js`. It is
`false` today on purpose — the deterministic rules are the real behaviour and
the API is a refinement.

### Verify

```js
WW.tutorProvider.describe()        // { aiAvailable, enabled, fails, endpoint }
WW.learningProfile.data().usage    // aiCalls, tokens, decisionCalls, fallbacks
```

---

## 24. Tests

```bash
node tools/logic-test.js                            # 350 assertions
node tools/browser-test.js http://localhost:8111    # 341 assertions
```

> If the browser run fails with *"Executable doesn't exist"*, the pinned
> `playwright-core` wants a newer browser build than the local cache has.
> Either `npx playwright install`, or:
> ```bash
> CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
>   node tools/browser-test.js http://localhost:8111
> ```

Suites 22–29 of the logic tests are WonderTutor, plus a dedicated browser
block that drives the whole first-run flow and the voice consent gates in a
real browser.

| # | Requirement | Where |
|---|---|---|
| 1 | Tutor requires grade level | logic 22, browser |
| 2 | Diagnostic initialises correctly | logic 24 |
| 3 | Diagnostic adapts difficulty | logic 24 (all-right and all-wrong runs) |
| 4 | Subject skills can have different levels | logic 25 |
| 5 | Mastery updates correctly | logic 25 |
| 6 | Tutor chooses review skills | logic 26 |
| 7 | Tutor can proactively begin a lesson | logic 26, browser |
| 8 | Child can ask a question | browser |
| 9 | Response is grade appropriate | logic 27 (context carries grade/band) |
| 10 | Language preference persists | logic 23 |
| 11 | All 12 language options appear | logic 23, browser |
| 12 | Tutoring vs language-learning stay separate | logic 23 |
| 13 | Invalid animation state cannot execute | logic 28, browser |
| 14 | Emotion decision has deterministic fallback | logic 28 |
| 15 | No API key in client code | logic 27 |
| 16 | Tutor failure does not break WonderWorld | browser (`fetch` killed) |
| 17 | Existing saves still work | logic 28 |
| 18 | Existing monetization tests still pass | logic 10–21 |
| 19 | Free/Plus entitlements still work | logic 28 |
| 20 | Tutor access respects entitlement config | logic 28 |
| 21 | Existing worlds remain free | logic 28 |
| 22 | Paying never bypasses learning | logic 11, 12, 28 |
| 23 | Reduced motion reduces tutor animation | browser |
| 24 | Speech failure falls back to text | §13, browser (no voice in headless) |
| 25 | Tutor does not request child PII | logic 27 |
| 26 | Context excludes nickname/email/location | logic 27, browser |
| 27 | AI usage measurable without identifying the child | logic 27 |

Voice adds its own block (logic 29 + browser):

| Requirement | Where |
|---|---|
| Voice is OFF for a new Explorer | logic 29, browser |
| A child with no consent is offered no microphone at all | browser |
| Enabling requires the parental gate, not a toggle | browser |
| Consent is versioned; an old version does not count | logic 29 |
| Consent survives reload and is revocable | logic 29, browser |
| Resetting the profile clears consent | logic 29 |
| The microphone starts disabled and is push-to-talk only | logic 29 |
| Releasing commits the turn rather than leaving the mic open | logic 29 |
| Stopping tears the track down, not just mutes it | logic 29 |
| Leaving the screen kills a live session | logic 29, browser |
| Spoken transcripts are screened like typed text | logic 29 |
| Unsafe tutor speech is cancelled mid-utterance | logic 29 |
| No audio is written to storage anywhere | logic 29 |
| The server refuses voice unless explicitly enabled | logic 29 |
| The real API key never reaches the browser | logic 29 |
| Only one external host is named, in one file | logic 9 |
| A free Explorer gets the premium door, not a "rest" | logic 29, browser |
| The daily and monthly budgets both bite | logic 29 |
| The child is never shown a minute count | logic 29, browser |
| The privacy policy shipped with the feature | logic 29 |

---

## 25. Production risks

| Risk | Standing | Mitigation |
|---|---|---|
| **A child's voice is sent to a third party** | **Real, and inherent to the feature** | Three gates, push-to-talk, nothing recorded by us, disclosed in `privacy.html`, revocable. This is a trade-off, not a solved problem — see below. |
| **Voice cost exceeding revenue** | Guarded | Metered, daily + monthly caps. [TUTOR_PRICING.md §5a](TUTOR_PRICING.md#5a-the-voice-budget) |
| **The 700-tokens-per-minute assumption** | **Unverified** | The voice budget scales linearly with it. Measure against the first invoice. |
| **COPPA / App Store review of voice in a kids' app** | **Needs legal review** | Microphone access in the Kids Category is scrutinised. `TUTOR_REALTIME_ENABLED` is off so the code can ship before the review concludes. |
| **Model says something unsuitable** | Real, inherent | Rejected server- and client-side; prompt is the third and weakest layer. Residual risk is non-zero. |
| **Model says something unsuitable OUT LOUD** | Real, harder | Transcript screening triggers `response.cancel`, but audio is streaming — a few words may be heard before it cuts. There is no way to pre-screen speech that has not been generated yet. |
| **Beta-language output is subtly wrong** | **Open** | Disclosed in the UI and the parent report. Needs §19. |
| **Offline bank is English-only** | **Open** | A beta language falls back to English content. Honest, not good. |
| **No human review of generated lessons** | **Open** | No sampling or review pipeline exists. See below. |
| Cost blow-out from an architecture change | Guarded | `shouldAsk()` + tests; see [TUTOR_PRICING.md §5](TUTOR_PRICING.md#5-what-would-break-this) |
| Cloud TTS would dominate cost and leak text | Guarded | `localService === true` enforced |
| `gpt-6-luna` is in public beta (Decisions API) | Watch | Expression layer is off by default and optional |
| App Store: AI features in Kids Category | **Needs review** | Apple has tightened guidance on AI in kids' apps. Review notes should state that the tutor is educational-only, has no open chat, no external links, and no purchase surface. |
| Prompt injection via the child's question | Guarded | Input screening, output screening, no tool access, no state mutation |
| Parent expects a diagnosis | Guarded | Explicit disclaimer in the report; language forbidden in output |

**The honest gap about voice:** screening a transcript is inherently behind the
audio. `response.cancel` cuts the stream as soon as a violation is detected,
but the child may hear the beginning of it. Text can be screened before it is
displayed; speech cannot be screened before it is heard. That is a real
limitation of conversational voice for children and it should be stated to
parents rather than engineered around, because it cannot be engineered away.

**The honest gap about lessons:** there is no human-review pipeline for
model-generated lessons. Safety filters catch categories of bad output; they do not catch a
confidently wrong explanation of fractions. For English the offline bank covers
the main skills, so exposure is limited to `AI_PREFERRED` skills and
child-initiated questions — but a sampling-and-review process should exist
before this is marketed as a tutor rather than a study aid.

### Recommended next sprint

1. **Verify the voice cost assumption against a real invoice** before enabling
   `TUTOR_REALTIME_ENABLED` for anyone but yourself. The budget is derived from
   an unpublished token-per-minute figure; everything in §5a scales with it.
2. **Legal/privacy review of voice for the Kids Category**, then publish the
   `privacy.html` update that is already written, then flip the switch. In that
   order.
3. **Raise `freeLessons` to 3** and ship the pricing decision from
   [TUTOR_PRICING.md §8](TUTOR_PRICING.md#8-recommendation).
4. **Native-speaker validation for one beta language** end to end (Spanish is
   the obvious first), including a per-language content pack. That turns the
   multilingual claim from architecture into product.
5. **A lesson-sampling review tool** — dump N generated explanations per skill
   for a human to score. Closes the gap above.
6. **Wire the Decisions API on** behind a flag and measure
   `usage.decisionCalls` against the deterministic rules. If parents and
   children cannot tell the difference, leave it off and keep the latency.
7. **Connect StoreKit** — unchanged from
   [MONETIZATION.md §18](MONETIZATION.md#18-apple-storekit-integration-path),
   and now the tutor makes the subscription worth more.
