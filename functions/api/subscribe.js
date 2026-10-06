/* =============================================================
   WonderWorld — functions/api/subscribe.js
   Cloudflare Pages Function: POST /api/subscribe

   Stores family-beta signups in Cloudflare KV. First-party, so no
   third-party processor ever touches a parent's email address.

   Setup (Cloudflare dashboard → your Pages project → Settings):
     1. Workers & Pages → KV → Create namespace "wonderworld-subscribers"
     2. Pages project → Settings → Functions → KV namespace bindings
        Variable name: SUBSCRIBERS   →   the namespace above
     3. Settings → Environment variables → add EXPORT_TOKEN (a long
        random string) so you can download the list later.

   What is stored: the PARENT's email, how many children they have,
   a consent record, a timestamp, and the country Cloudflare already
   knows. Never a child's name, age or anything from the game.
   ============================================================= */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MAX_BODY = 2048;

/* Bump this whenever the consent wording on the form changes, so an old
   record always says which text that person actually agreed to. */
const CONSENT_VERSION = 'v1-2026-10-06';

/* Cloudflare Pages does not apply _headers to Function responses,
   so every security header has to be set here explicitly. */
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

export async function onRequestPost(context) {
  const { request, env } = context;

  /* --- read and size-limit the body --- */
  let body;
  try {
    /* Check the declared size first — request.text() would otherwise pull the
       whole body into memory before we ever got to look at it. */
    const declared = parseInt(request.headers.get('content-length') || '0', 10);
    if (declared > MAX_BODY) return json({ ok: false, error: 'too_large' }, 413);
    const text = await request.text();
    if (text.length > MAX_BODY) return json({ ok: false, error: 'too_large' }, 413);
    body = JSON.parse(text || '{}');
  } catch (e) {
    return json({ ok: false, error: 'bad_json' }, 400);
  }

  /* --- honeypot: real humans never fill this in --- */
  if (body.website) return json({ ok: true });

  const email = String(body.email || '').trim().toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 160) {
    return json({ ok: false, error: 'bad_email' }, 400);
  }
  if (body.consent !== true) {
    return json({ ok: false, error: 'no_consent' }, 400);
  }

  const kids = ['1', '2', '3+'].includes(String(body.kids)) ? String(body.kids) : '';
  /* `source` is an internal tag, so whitelist it rather than trusting the body.
     It ends up in a CSV, and a free-text field there is a formula-injection hole. */
  const source = /^[a-z0-9_-]{1,40}$/.test(String(body.source || ''))
    ? String(body.source) : 'web';

  /* --- the KV binding may not be configured yet --- */
  if (!env.SUBSCRIBERS) {
    return json({ ok: false, error: 'not_configured' }, 503);
  }

  /* --- rate limit: 5 signups per IP per 10 minutes ---
     Deliberately not one-per-IP: two parents in one household, or a
     whole class behind a school's NAT, share a single address. This
     still stops a bot hammering the endpoint. --- */
  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  const rlKey = 'rl:' + ip;
  try {
    const used = parseInt(await env.SUBSCRIBERS.get(rlKey), 10) || 0;
    if (used >= 5) {
      return json({ ok: false, error: 'rate_limited' }, 429);
    }
    await env.SUBSCRIBERS.put(rlKey, String(used + 1), { expirationTtl: 600 });
  } catch (e) { /* rate limiting is best-effort, never block a real signup */ }

  const key = 'sub:' + email;
  try {
    const existing = await env.SUBSCRIBERS.get(key);
    /* Deliberately the SAME response whether or not they were already on the
       list — otherwise anyone can probe "is this person a WonderWorld parent?" */
    if (existing) return json({ ok: true });

    const record = {
      email,
      kids,
      at: new Date().toISOString(),
      country: request.headers.get('cf-ipcountry') || '',
      source,
      consent: true,
      consentText: CONSENT_VERSION      /* GDPR Art. 7: be able to show what they agreed to */
    };
    /* Written to metadata as well as the value, so exporting the list is a
       single list() call instead of one KV read per subscriber. */
    await env.SUBSCRIBERS.put(key, JSON.stringify(record), { metadata: record });
  } catch (e) {
    return json({ ok: false, error: 'store_failed' }, 500);
  }

  return json({ ok: true });
}

/* Anything other than POST */
export async function onRequest(context) {
  if (context.request.method === 'POST') return onRequestPost(context);
  if (context.request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: { allow: 'POST, OPTIONS' } });
  }
  return json({ ok: false, error: 'method_not_allowed' }, 405);
}
