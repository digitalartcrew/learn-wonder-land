/* =============================================================
   WonderWorld — functions/api/tutor.js
   Cloudflare Pages Function: POST /api/tutor

   The ONLY path between WonderTutor and a language model. The
   browser never holds a key, never talks to OpenAI, and never sees
   a provider URL — it posts a small educational context here and
   gets back one short paragraph of plain text.

   SETUP (Cloudflare dashboard → Pages project → Settings):
     1. Settings → Environment variables (encrypted):
          OPENAI_API_KEY   sk-...
        Without it this endpoint returns 503 `not_configured`, and
        the client quietly uses its offline lesson bank. That is a
        supported state, not an outage — the game ships like this.
     2. Optional overrides:
          TUTOR_MODEL         default below
          TUTOR_MAX_OUTPUT    default 220 tokens
          TUTOR_DAILY_CAP     requests per IP per day (default 400)
     3. Optional KV binding for the cap:
          TUTOR_LIMITS  →  a KV namespace
        Without it the cap is skipped and only the per-request
        limits apply.

   WHAT ARRIVES HERE
   -----------------
   Grade, language, skill id, level, a band, small counters, a list
   of world NAMES, and optionally one short screened question. There
   is no nickname, no email, no avatar, no save file, no device id,
   no IP-derived location in the payload, and no persistent
   identifier. `sessionRef` is random per session and is never
   stored.

   THE SAFETY RULES ARE ENFORCED TWICE
   -----------------------------------
   js/tutor/safety.js checks the child's question before it leaves
   the device and checks the model's answer before it is displayed.
   This file repeats both checks, because a client-side rule is a
   rule you have to assume was bypassed. The system prompt is the
   third layer and the weakest; it is not relied upon.

   NOTHING IS LOGGED
   -----------------
   No request body, no question text and no model output is written
   anywhere. The only persisted value is an integer request count
   per coarse IP hash, for abuse control.
   ============================================================= */

/* gpt-6-luna is the cheapest current general-purpose text model
   ($0.10 / 1M input, $0.50 / 1M output) and is more than capable of three
   warm sentences at a Grade 2 reading level. Override with TUTOR_MODEL if a
   better fit appears. See docs/TUTOR_PRICING.md. */
const DEFAULT_MODEL = 'gpt-6-luna';
const DEFAULT_MAX_OUTPUT = 220;
const DEFAULT_DAILY_CAP = 400;
const MAX_BODY = 4096;

const INTENTS = ['lesson', 'answer', 'explain_again', 'encourage'];

/* Mirrors EMOTIONS / taxonomy on the client. Anything outside is rejected
   rather than coerced, so a malformed context cannot steer the prompt. */
const MAX_GRADE = 6;
const MAX_QUESTION = 300;

/* Cloudflare Pages does not apply _headers to Function responses, so every
   security header is set explicitly, exactly as subscribe.js does. */
function json(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'no-referrer'
    }
  });
}

/* ---------- the same forbidden shapes the client enforces ---------- */
const EMAIL = /[^\s@]+@[^\s@]+\.[a-z]{2,}/i;
const PHONE = /(?:\+?\d[\d\s().-]{7,}\d)/;
const URL_RE = /\b(?:https?:\/\/|www\.)\S+/i;

const FORBIDDEN_OUT = [
  /what(?:'s| is) your (full |real |last )?name/i,
  /where do you live|what(?:'s| is) your address/i,
  /what school do you (go to|attend)|name of your school/i,
  /your (phone|mobile) number|what(?:'s| is) your email/i,
  /how old are you|what(?:'s| is) your (birthday|date of birth)/i,
  /don'?t tell (your )?(mum|mom|dad|parents|grown-?ups?)/i,
  /\b(our|a) (little )?secret\b/i,
  /\bi(?:'m| am) (a )?(real|human|person)\b/i,
  /\b(diagnos|therapy|therapist|counsell?or|medication)\w*/i,
  /\b(dyslexi|adhd|autis|disorder|disabilit)\w*/i,
  URL_RE,
  EMAIL
];

function outputIsSafe(text) {
  return !FORBIDDEN_OUT.some((re) => re.test(text));
}

function inputIsSafe(text) {
  return !(EMAIL.test(text) || PHONE.test(text) || URL_RE.test(text));
}

/* ---------- context validation ----------
   Build a clean object from scratch rather than trusting what arrived.
   Anything unexpected is dropped, so no caller can smuggle a field into
   the prompt. */
function cleanContext(raw) {
  const c = raw && typeof raw === 'object' ? raw : {};
  const grade = Number.isFinite(Number(c.grade))
    ? Math.max(0, Math.min(MAX_GRADE, Math.round(Number(c.grade))))
    : null;

  const out = {
    grade,
    language: typeof c.language === 'string' ? c.language.slice(0, 12) : 'en',
    skillName: typeof c.skillName === 'string' ? c.skillName.slice(0, 60) : null,
    level: Number.isFinite(Number(c.level)) ? Math.round(Number(c.level)) : null,
    band: ['below', 'approaching', 'on', 'above'].includes(c.band) ? c.band : null,
    stuck: c.stuck === true,
    question: null,
    worlds: Array.isArray(c.worldsPlayed)
      ? c.worldsPlayed.filter((w) => typeof w === 'string').slice(0, 6).map((w) => w.slice(0, 20))
      : [],
    /* A short window of the current lesson. Re-bounded here rather than
       trusted: the client caps it too, but a cap that only exists on the
       client is not a cap. */
    turns: Array.isArray(c.recentTurns)
      ? c.recentTurns
          .filter((t) => t && typeof t.text === 'string')
          .slice(-6)
          .map((t) => ({
            who: t.who === 'child' ? 'child' : 'tutor',
            text: t.text.slice(0, 160)
          }))
          .filter((t) => inputIsSafe(t.text))
      : [],
    missedPrompt: typeof c.missedPrompt === 'string' ? c.missedPrompt.slice(0, 160) : null,
    correctAnswer: typeof c.correctAnswer === 'string' ? c.correctAnswer.slice(0, 40) : null
  };

  if (typeof c.question === 'string' && c.question.trim()) {
    const q = c.question.trim().slice(0, MAX_QUESTION);
    if (inputIsSafe(q)) out.question = q;
  }
  return out;
}

/* ---------- the prompt ---------- */
function systemPrompt(ctx) {
  const grade = ctx.grade === null ? 'early elementary' : `grade ${ctx.grade}`;
  return [
    'You are WonderTutor, a friendly learning guide inside a children\'s educational game called WonderWorld.',
    `You are teaching a child at ${grade} level. Write at that reading level.`,
    '',
    'STYLE',
    '- Be brief. Three or four short sentences at most. Never write a wall of text.',
    '- Warm, encouraging, plain language. One emoji at most, and only if it helps.',
    '- Prefer: a short explanation, then one concrete example, then a question back to the child.',
    '- You are mid-conversation. Refer back to what was just said when it helps',
    '  ("like we did with the shells a moment ago"). Never re-introduce yourself.',
    '- Vary your wording. Do not open every turn the same way.',
    '- Never say "that\'s easy", "you should know this", or "wrong again".',
    '- When a child is wrong, say something like "Almost! Let\'s look at it another way."',
    '',
    'HARD RULES',
    '- You are a learning guide. You are NOT a human, a friend, a therapist, or a parent.',
    '- Never ask for or repeat any personal information: real name, age, birthday, address,',
    '  phone number, email, school, or location.',
    '- Never suggest keeping anything secret from a parent or grown-up.',
    '- Never include a link, a URL, or an email address.',
    '- Never discuss buying anything, prices, or subscriptions.',
    '- Never diagnose or speculate about a learning disability, disorder, or any medical or',
    '  psychological condition. You assess SKILLS, never the child.',
    '- If asked something unrelated to learning, gently redirect to the lesson.',
    '',
    `Answer in this language (BCP-47): ${ctx.language}.`,
    ctx.language !== 'en'
      ? 'If you are not confident writing accurately for a child in that language, answer in English instead of guessing.'
      : ''
  ].filter(Boolean).join('\n');
}

function userPrompt(intent, ctx) {
  const bits = [];
  if (ctx.skillName) {
    bits.push(`Skill: ${ctx.skillName}${ctx.level === null ? '' : ` (level ${ctx.level})`}.`);
  }
  if (ctx.band) bits.push(`This skill is ${ctx.band} grade level for this child.`);
  if (ctx.worlds.length) bits.push(`Worlds they have played: ${ctx.worlds.join(', ')}.`);

  if (intent === 'answer' && ctx.question) {
    bits.push(`The child asked: "${ctx.question}"`);
    bits.push('Answer it at their level, briefly, then invite them to try a related example.');
  } else if (intent === 'explain_again') {
    bits.push('They just got this wrong twice, so your first explanation did not land.');
    if (ctx.missedPrompt) bits.push(`The question was: "${ctx.missedPrompt}"`);
    if (ctx.correctAnswer) bits.push(`The answer is ${ctx.correctAnswer}.`);
    bits.push('Explain the SAME idea a COMPLETELY different way — a picture in words, ' +
              'a physical object, counting on fingers. Do not repeat your earlier wording.');
    if (ctx.stuck) bits.push('Be extra gentle and go a step simpler.');
  } else if (intent === 'encourage') {
    bits.push('Say one short, warm, specific thing about how they are doing. One sentence.');
  } else {
    bits.push('Introduce this skill in three or four short sentences, then invite them ' +
              'to practice. Use one concrete example with real numbers or real objects.');
  }
  return bits.join('\n');
}

/* The current lesson as actual conversation turns, so the model continues a
   conversation rather than restarting one. Bounded by cleanContext(). */
function historyMessages(ctx) {
  return ctx.turns.map((t) => ({
    role: t.who === 'child' ? 'user' : 'assistant',
    content: t.text
  }));
}

/* ---------- coarse abuse control ----------
   A day-bucketed count against a truncated hash of the IP. Not an identity:
   it is one integer that expires, and it is never joined to anything. */
async function underCap(env, request) {
  const cap = parseInt(env.TUTOR_DAILY_CAP || DEFAULT_DAILY_CAP, 10);
  if (!env.TUTOR_LIMITS || !cap) return true;
  try {
    const ip = request.headers.get('cf-connecting-ip') || '0';
    const day = new Date().toISOString().slice(0, 10);
    const raw = new TextEncoder().encode(ip + '|' + day);
    const digest = await crypto.subtle.digest('SHA-256', raw);
    const key = 'c:' + Array.from(new Uint8Array(digest).slice(0, 8))
      .map((b) => b.toString(16).padStart(2, '0')).join('');

    const current = parseInt((await env.TUTOR_LIMITS.get(key)) || '0', 10);
    if (current >= cap) return false;
    await env.TUTOR_LIMITS.put(key, String(current + 1), { expirationTtl: 172800 });
    return true;
  } catch (e) {
    /* The cap failing open is better than tutoring failing closed. */
    return true;
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;

  /* No key configured is a normal, supported state: the client has a
     complete offline lesson bank and will use it. */
  if (!env.OPENAI_API_KEY) {
    return json({ ok: false, reason: 'not_configured' }, 503);
  }

  let body;
  try {
    const declared = parseInt(request.headers.get('content-length') || '0', 10);
    if (declared > MAX_BODY) return json({ ok: false, reason: 'too_large' }, 413);
    const text = await request.text();
    if (text.length > MAX_BODY) return json({ ok: false, reason: 'too_large' }, 413);
    body = JSON.parse(text || '{}');
  } catch (e) {
    return json({ ok: false, reason: 'bad_json' }, 400);
  }

  const intent = INTENTS.includes(body.intent) ? body.intent : null;
  if (!intent) return json({ ok: false, reason: 'bad_intent' }, 400);

  const ctx = cleanContext(body.context);

  /* An 'answer' with no usable question means the child's text was rejected
     by the input rules — on the client, or just now. Do not spend a call. */
  if (intent === 'answer' && !ctx.question) {
    return json({ ok: false, reason: 'no_question' }, 400);
  }

  if (!(await underCap(env, request))) {
    return json({ ok: false, reason: 'rate_limited' }, 429);
  }

  const model = env.TUTOR_MODEL || DEFAULT_MODEL;
  const maxOut = parseInt(env.TUTOR_MAX_OUTPUT || DEFAULT_MAX_OUTPUT, 10);

  let data;
  try {
    const upstream = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'authorization': `Bearer ${env.OPENAI_API_KEY}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model,
        max_tokens: maxOut,
        temperature: 0.6,
        messages: [
          { role: 'system', content: systemPrompt(ctx) },
          ...historyMessages(ctx),
          { role: 'user', content: userPrompt(intent, ctx) }
        ]
      })
    });
    if (!upstream.ok) return json({ ok: false, reason: 'upstream' }, 502);
    data = await upstream.json();
  } catch (e) {
    return json({ ok: false, reason: 'upstream' }, 502);
  }

  const text = data && data.choices && data.choices[0] &&
               data.choices[0].message && data.choices[0].message.content;

  if (!text || !String(text).trim()) {
    return json({ ok: false, reason: 'empty' }, 502);
  }

  /* The model's words get the same inspection as anyone else's. A failure
     here is reported as a refusal, never passed through for the client to
     deal with. */
  if (!outputIsSafe(String(text))) {
    return json({ ok: false, reason: 'unsafe_output' }, 200);
  }

  /* Token counts go back so the client can keep a non-identifying usage
     tally for the cost model. They describe the REQUEST, not the child. */
  const usage = (data && data.usage) || {};
  return json({
    ok: true,
    text: String(text).trim(),
    tokensIn: usage.prompt_tokens || 0,
    tokensOut: usage.completion_tokens || 0
  });
}

/* Anything other than POST, including a curious GET, gets nothing useful. */
export async function onRequest(context) {
  if (context.request.method === 'POST') return onRequestPost(context);
  return json({ ok: false, reason: 'method_not_allowed' }, 405);
}
