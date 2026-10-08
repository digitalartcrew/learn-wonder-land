/* =============================================================
   WonderWorld — functions/api/tutor-realtime.js
   Cloudflare Pages Function: POST /api/tutor-realtime

   Mints a short-lived ephemeral client secret so the browser can
   open a WebRTC voice session with the Realtime API WITHOUT ever
   holding our API key.

       browser  →  POST /api/tutor-realtime      (this file)
                ←  { value: "ek_…" }             ephemeral, minutes
       browser  →  POST /v1/realtime/calls       (SDP, ephemeral key)
                ↔  audio over WebRTC

   Our `OPENAI_API_KEY` is used once, here, server-side. The value
   returned to the browser is scoped to one session and expires on
   its own.

   ⚠️  THIS SENDS A CHILD'S VOICE TO A THIRD PARTY
   -----------------------------------------------
   Everything else in WonderTutor is built so that nothing
   identifying leaves the device. Voice is different in kind: a
   child's recorded speech is biometric-adjacent personal data, it
   can contain anything they happen to say, and it leaves the
   device by definition.

   That is why it is gated three times over, and every gate must
   pass:

     1. SERVER   TUTOR_REALTIME_ENABLED must be exactly 'true'.
                 Absent or anything else → 503. This is the switch
                 that stays off until the privacy review and the
                 published policy update are actually done.
     2. PARENT   A grown-up must pass the parental gate and give
                 explicit, versioned consent, stored per Explorer.
     3. CHILD    Push-to-talk only. The microphone track is disabled
                 between turns — genuinely off, not merely ignored.

   See docs/WONDERTUTOR.md, "Real-time voice", and privacy.html.

   SETUP (Cloudflare dashboard → Pages project → Settings):
     Environment variables (encrypted):
       OPENAI_API_KEY           sk-…
       TUTOR_REALTIME_ENABLED   'true'   ← deliberately opt-in
     Optional:
       TUTOR_REALTIME_MODEL     default gpt-realtime-2.1
       TUTOR_REALTIME_VOICE     default 'marin'
       TUTOR_REALTIME_CAP       sessions per IP per day (default 40)
     Optional KV binding:
       TUTOR_LIMITS  →  a KV namespace (shared with /api/tutor)

   NOTHING IS LOGGED HERE. No audio passes through this Function at
   all — it only mints a token. Audio goes browser↔OpenAI directly.
   ============================================================= */

const CLIENT_SECRETS_URL = 'https://api.openai.com/v1/realtime/client_secrets';
const DEFAULT_MODEL = 'gpt-realtime-2.1';
const DEFAULT_VOICE = 'marin';
const DEFAULT_CAP = 40;
const MAX_BODY = 1024;
const MAX_GRADE = 6;

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

/* The spoken tutor gets the same rules as the written one, plus the ones
   that only matter out loud. This is the model's whole brief for the
   session — it is not re-sent per turn. */
function instructions(grade, language, skillName) {
  const g = grade === null ? 'early elementary' : `grade ${grade}`;
  return [
    'You are WonderTutor, a friendly learning guide inside a children\'s educational game.',
    `You are talking out loud with a child at ${g} level. Speak at that level.`,
    skillName ? `Right now you are working on: ${skillName}.` : '',
    '',
    'HOW TO SPEAK',
    '- Short turns. One or two sentences, then stop and let them answer.',
    '- Warm, patient, unhurried. Leave room for a child who is thinking.',
    '- Never talk over them. If they start speaking, stop.',
    '- Plain words. Explain, give one concrete example, then ask them something.',
    '- Never say "that\'s easy", "you should know this", or "wrong again".',
    '- When they are wrong: "Almost! Let\'s look at it another way."',
    '',
    'HARD RULES',
    '- You are a learning guide. You are NOT a human, a friend, a therapist or a parent.',
    '  If asked whether you are real, say plainly that you are a helper in the game.',
    '- NEVER ask for, repeat, or acknowledge personal information: real name, age,',
    '  birthday, address, phone number, email, school, or where they live.',
    '  If a child volunteers any of it, do not repeat it back. Gently return to learning.',
    '- Never suggest keeping anything secret from a parent or grown-up.',
    '- Never mention links, websites, email, buying anything, prices or subscriptions.',
    '- Never diagnose or speculate about a learning disability, disorder, or any medical',
    '  or psychological condition. You assess SKILLS, never the child.',
    '- If the conversation leaves learning, bring it back kindly and briefly.',
    '- If a child says something that sounds like they are in danger or being hurt,',
    '  do not counsel them. Say that a grown-up they trust should be told, and stop.',
    '',
    `Speak this language (BCP-47): ${language}.`,
    language !== 'en'
      ? 'If you are not confident speaking accurately for a child in that language, use English.'
      : ''
  ].filter(Boolean).join('\n');
}

/* Shared, coarse, day-bucketed. Identical approach to /api/tutor. */
async function underCap(env, request) {
  const cap = parseInt(env.TUTOR_REALTIME_CAP || DEFAULT_CAP, 10);
  if (!env.TUTOR_LIMITS || !cap) return true;
  try {
    const ip = request.headers.get('cf-connecting-ip') || '0';
    const day = new Date().toISOString().slice(0, 10);
    const raw = new TextEncoder().encode('rt|' + ip + '|' + day);
    const digest = await crypto.subtle.digest('SHA-256', raw);
    const key = 'r:' + Array.from(new Uint8Array(digest).slice(0, 8))
      .map((b) => b.toString(16).padStart(2, '0')).join('');
    const current = parseInt((await env.TUTOR_LIMITS.get(key)) || '0', 10);
    if (current >= cap) return false;
    await env.TUTOR_LIMITS.put(key, String(current + 1), { expirationTtl: 172800 });
    return true;
  } catch (e) {
    return true;
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;

  /* Gate 1. Off unless switched on deliberately. A key alone is not enough:
     text tutoring and voice tutoring have different privacy consequences and
     should not share a single switch. */
  if (env.TUTOR_REALTIME_ENABLED !== 'true') {
    return json({ ok: false, reason: 'voice_disabled' }, 503);
  }
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

  /* The client asserts that a grown-up consented. We cannot verify a claim
     made by a browser, so this is a tripwire rather than a control — the
     real enforcement is gate 1 above and the parental gate on the device.
     It is still worth refusing an obviously unconsented request. */
  if (body.parentConsent !== true) {
    return json({ ok: false, reason: 'no_consent' }, 403);
  }

  if (!(await underCap(env, request))) {
    return json({ ok: false, reason: 'rate_limited' }, 429);
  }

  const grade = Number.isFinite(Number(body.grade))
    ? Math.max(0, Math.min(MAX_GRADE, Math.round(Number(body.grade))))
    : null;
  const language = typeof body.language === 'string' ? body.language.slice(0, 12) : 'en';
  const skillName = typeof body.skillName === 'string' ? body.skillName.slice(0, 60) : null;

  const model = env.TUTOR_REALTIME_MODEL || DEFAULT_MODEL;
  const voice = env.TUTOR_REALTIME_VOICE || DEFAULT_VOICE;

  let data;
  try {
    const upstream = await fetch(CLIENT_SECRETS_URL, {
      method: 'POST',
      headers: {
        'authorization': `Bearer ${env.OPENAI_API_KEY}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        session: {
          type: 'realtime',
          model: model,
          instructions: instructions(grade, language, skillName),
          audio: {
            input: {
              /* PUSH-TO-TALK. No automatic turn detection, so the session
                 never decides on its own that the child is talking to it.
                 The client commits a turn explicitly when the button is
                 released. An always-listening microphone in a children's
                 app is a different product and not one we are shipping. */
              turn_detection: null
            },
            output: { voice: voice }
          }
        }
      })
    });
    if (!upstream.ok) return json({ ok: false, reason: 'upstream' }, 502);
    data = await upstream.json();
  } catch (e) {
    return json({ ok: false, reason: 'upstream' }, 502);
  }

  const value = data && data.value;
  if (!value) return json({ ok: false, reason: 'no_token' }, 502);

  /* Only the ephemeral secret goes back. Never the real key, and never the
     session instructions — the browser has no need for either. */
  return json({ ok: true, value: value, model: model });
}

export async function onRequest(context) {
  if (context.request.method === 'POST') return onRequestPost(context);
  return json({ ok: false, reason: 'method_not_allowed' }, 405);
}
