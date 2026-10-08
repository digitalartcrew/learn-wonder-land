/* =============================================================
   WonderWorld — functions/api/tutor-emotion.js
   Cloudflare Pages Function: POST /api/tutor-emotion

   Chooses which face WonderTutor wears, using the OpenAI Decisions
   API:  POST https://api.openai.com/v1/decisions

   WHY THE DECISIONS API AND NOT A CHAT CALL
   -----------------------------------------
   A `choice` question returns one value from a fixed list, plus a
   confidence. That is exactly the shape of this problem, and it
   means the model cannot return prose, markup, an animation name we
   have never heard of, or anything the renderer might act on. The
   constraint is enforced by the API rather than by us parsing and
   hoping.

   It is also almost free: Decisions bills INPUT TOKENS ONLY, at
   $0.10 per 1M. Each call here is a couple of hundred tokens, so the
   expression layer costs a tiny fraction of a cent per thousand
   lessons. See docs/TUTOR_PRICING.md.

   WHAT THIS IS AND IS NOT
   -----------------------
   It picks a TEACHER'S expression from an interaction signal —
   "the child answered correctly", "the same question has been missed
   twice". It does NOT infer, classify or store the child's emotional
   state, mood, personality or any trait or condition. No such
   categories are offered to the model, so none can be returned.

   WHAT ARRIVES HERE
   -----------------
   A signal word, two small integers and two booleans. No question
   text, no answer text, no nickname, no identifier at all. There is
   nothing in the request that could single out a child, which is
   why there is nothing to log and nothing is logged.

   OPTIONAL, ALWAYS
   ----------------
   With no key this returns 503 and the client uses its deterministic
   rules, which are the real behaviour. js/tutor/emotion.js abandons
   this call after 1.2s regardless. A face is never worth a stall.

   SETUP:
     Settings → Environment variables:  OPENAI_API_KEY
     Optional:  TUTOR_DECISION_MODEL   (default gpt-6-luna)
                TUTOR_MIN_CONFIDENCE   (default 0.55)
   ============================================================= */

const DECISIONS_URL = 'https://api.openai.com/v1/decisions';
const DEFAULT_MODEL = 'gpt-6-luna';
const DEFAULT_MIN_CONFIDENCE = 0.55;
const MAX_BODY = 1024;

/* The server's own allow-list. The client sends one too, but a list that
   arrives in the request is not a constraint — this is. */
const EXPRESSIONS = [
  { value: 'happy',
    description: 'Warm and pleased. The child got something right.' },
  { value: 'excited',
    description: 'Bright and energetic. A run of correct answers, or real momentum.' },
  { value: 'encouraging',
    description: 'Kind and steady. The child got something wrong and needs reassurance to try again.' },
  { value: 'curious',
    description: 'Interested and attentive. The child asked a question, or a new idea is being introduced.' },
  { value: 'celebrating',
    description: 'Delighted. A lesson was completed well, or a skill was mastered.' },
  { value: 'gentle_correction',
    description: 'Patient and soft. The same thing has been missed more than once and the tutor is about to explain it differently.' },
  { value: 'thinking',
    description: 'Considering. The tutor is working something out before answering.' },
  { value: 'neutral',
    description: 'Calm and attentive. Nothing in particular has just happened.' }
];

const ALLOWED = EXPRESSIONS.map((e) => e.value);

/* Interaction states we will reason from. Anything else becomes 'idle'. */
const SIGNALS = [
  'answered_correctly',
  'answered_incorrectly',
  'repeated_incorrect',
  'asked_question',
  'lesson_started',
  'lesson_completed',
  'skill_mastered',
  'assessment_completed',
  'processing',
  'idle'
];

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

const INSTRUCTIONS = [
  'You are choosing the facial expression for a friendly animated tutor character',
  'in a children\'s educational game, based only on what just happened in the lesson.',
  '',
  'Choose the expression a warm, patient teacher would wear at this moment.',
  'Favour encouragement over disappointment: a wrong answer is a normal part of learning,',
  'and the tutor should never look let down.',
  '',
  'This is a choice about the TUTOR\'S face. It is not a judgement about the child,',
  'and it is not an assessment of how the child feels.'
].join('\n');

function describe(body) {
  const signal = SIGNALS.includes(body.signal) ? body.signal : 'idle';
  const streak = Math.max(0, Math.min(99, parseInt(body.streak, 10) || 0));
  const wrong = Math.max(0, Math.min(99, parseInt(body.consecutiveWrong, 10) || 0));
  const mastered = body.mastered === true;

  const lines = [`What just happened: ${signal.replace(/_/g, ' ')}.`];
  if (streak > 1) lines.push(`The child has answered ${streak} in a row correctly.`);
  if (wrong > 1) lines.push(`The child has missed this ${wrong} times in a row.`);
  if (mastered) lines.push('The skill has just been mastered.');
  return lines.join(' ');
}

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env.OPENAI_API_KEY) {
    /* Supported state. The client's deterministic rules take over. */
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

  const model = env.TUTOR_DECISION_MODEL || DEFAULT_MODEL;
  const minConfidence = parseFloat(env.TUTOR_MIN_CONFIDENCE || DEFAULT_MIN_CONFIDENCE);

  let data;
  try {
    const upstream = await fetch(DECISIONS_URL, {
      method: 'POST',
      headers: {
        'authorization': `Bearer ${env.OPENAI_API_KEY}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model,
        input: describe(body),
        questions: [{
          type: 'choice',
          name: 'expression',
          instructions: INSTRUCTIONS,
          choices: EXPRESSIONS
        }]
      })
    });
    if (!upstream.ok) return json({ ok: false, reason: 'upstream' }, 502);
    data = await upstream.json();
  } catch (e) {
    return json({ ok: false, reason: 'upstream' }, 502);
  }

  const answer = data && Array.isArray(data.answers)
    ? data.answers.find((a) => a && a.name === 'expression')
    : null;

  /* A refusal is a valid answer type. Treat it as "no opinion" and let the
     client's deterministic rule stand. */
  if (!answer || answer.type === 'refusal') {
    return json({ ok: false, reason: 'no_answer' }, 200);
  }

  /* Validate against OUR list, not the one in the request. */
  if (!ALLOWED.includes(answer.choice)) {
    return json({ ok: false, reason: 'out_of_range' }, 200);
  }

  /* A coin-flip between two faces is not better than the rule we already
     have, so below the threshold we decline rather than guess. */
  if (typeof answer.confidence === 'number' && answer.confidence < minConfidence) {
    return json({ ok: false, reason: 'low_confidence' }, 200);
  }

  return json({
    ok: true,
    expression: answer.choice,
    confidence: typeof answer.confidence === 'number' ? answer.confidence : null
  });
}

export async function onRequest(context) {
  if (context.request.method === 'POST') return onRequestPost(context);
  return json({ ok: false, reason: 'method_not_allowed' }, 405);
}
