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
| `js/tutor/provider.js` | `WW.tutorProvider` — offline and server adapters |
| `js/tutor/assessment.js` | `WW.tutorAssessment` — the adaptive diagnostic |
| `js/tutor/engine.js` | `WW.tutor` — skill choice, rewards, access |
| `js/tutor/session.js` | `WW.tutorSession` — one running lesson |
| `js/tutor/screen.js` | `WW.Screens.tutor` — the UI |
| `functions/api/tutor.js` | The only path to a text model |
| `functions/api/tutor-emotion.js` | The Decisions API call for expressions |

Changes to pre-existing files are additive only: a screen section and 13 script
tags in `index.html`, those scripts in the `sw.js` shell (VERSION → `ww-v4`), a
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

### The taxonomy

Six domains, 34 skills, each with a grade range and prerequisites:

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

### Asking at any point

`WW.tutorSession.ask(text)` works in every state, including mid-lesson. The
answer shape the prompt asks for is: explanation → example → a question back.

```
Child:  "Why is 8 x 4 32?"

Tutor:  "Multiplication is repeated addition. 🌟
         8 × 4 means four groups of 8.
         8 + 8 + 8 + 8 = 32.
         Want to try 6 × 4?"
```

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

The monetization layer added one network call. WonderTutor adds two — both
first-party endpoints on this origin. Tests assert that every literal `fetch`
target is one of `api/subscribe`, `/api/tutor`, `/api/tutor-emotion`, and that
no `fetch` anywhere names an external host.

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

`WW.tutorProvider.shouldAsk(intent, skillId)` is the gate. `WORTH_ASKING` is
`['answer', 'explain_again', 'lesson']`, and `lesson` only passes for skills in
`tutorContent.AI_PREFERRED` — comprehension, main idea, inference, vocabulary,
where prose beats a generator. Arithmetic never costs an API call, and there is
a test for that.

**No conversation history is sent.** Each call carries a small structured
context, not a transcript. History-passing grows input tokens linearly with
session length, so turn 20 would cost 20× turn 1 — about a 40× multiplier over a
session — and would also be the worst thing to do with a child's words.

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
  freeAssessment: true,      // the full diagnostic, free
  freeLessons: 1,            // then the premium door
  plusLessonsPerDay: 40      // fair use, for subscribers
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
node tools/logic-test.js                            # 294 assertions
node tools/browser-test.js http://localhost:8111    # 312 assertions
```

> If the browser run fails with *"Executable doesn't exist"*, the pinned
> `playwright-core` wants a newer browser build than the local cache has.
> Either `npx playwright install`, or:
> ```bash
> CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
>   node tools/browser-test.js http://localhost:8111
> ```

Suites 22–28 of the logic tests are WonderTutor, plus a dedicated browser
block that drives the whole first-run flow in a real browser.

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

---

## 25. Production risks

| Risk | Standing | Mitigation |
|---|---|---|
| **Model says something unsuitable** | Real, inherent | Rejected server- and client-side; prompt is the third and weakest layer. Residual risk is non-zero. |
| **Beta-language output is subtly wrong** | **Open** | Disclosed in the UI and the parent report. Needs §19. |
| **Offline bank is English-only** | **Open** | A beta language falls back to English content. Honest, not good. |
| **No human review of generated lessons** | **Open** | No sampling or review pipeline exists. See below. |
| Cost blow-out from an architecture change | Guarded | `shouldAsk()` + tests; see [TUTOR_PRICING.md §5](TUTOR_PRICING.md#5-what-would-break-this) |
| Cloud TTS would dominate cost and leak text | Guarded | `localService === true` enforced |
| `gpt-6-luna` is in public beta (Decisions API) | Watch | Expression layer is off by default and optional |
| App Store: AI features in Kids Category | **Needs review** | Apple has tightened guidance on AI in kids' apps. Review notes should state that the tutor is educational-only, has no open chat, no external links, and no purchase surface. |
| Prompt injection via the child's question | Guarded | Input screening, output screening, no tool access, no state mutation |
| Parent expects a diagnosis | Guarded | Explicit disclaimer in the report; language forbidden in output |

**The honest gap:** there is no human-review pipeline for model-generated
lessons. Safety filters catch categories of bad output; they do not catch a
confidently wrong explanation of fractions. For English the offline bank covers
the main skills, so exposure is limited to `AI_PREFERRED` skills and
child-initiated questions — but a sampling-and-review process should exist
before this is marketed as a tutor rather than a study aid.

### Recommended next sprint

1. **Raise `freeLessons` to 3** and ship the pricing decision from
   [TUTOR_PRICING.md §8](TUTOR_PRICING.md#8-recommendation).
2. **Native-speaker validation for one beta language** end to end (Spanish is
   the obvious first), including a per-language content pack. That turns the
   multilingual claim from architecture into product.
3. **A lesson-sampling review tool** — dump N generated explanations per skill
   for a human to score. Closes the gap above.
4. **Wire the Decisions API on** behind a flag and measure
   `usage.decisionCalls` against the deterministic rules. If parents and
   children cannot tell the difference, leave it off and keep the latency.
5. **Connect StoreKit** — unchanged from
   [MONETIZATION.md §18](MONETIZATION.md#18-apple-storekit-integration-path),
   and now the tutor makes the subscription worth more.
