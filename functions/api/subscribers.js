/* =============================================================
   WonderWorld — functions/api/subscribers.js
   Cloudflare Pages Function: GET /api/subscribers?token=…

   Downloads the family-beta list as CSV, so you can import it into
   Buttondown / Mailchimp / a spreadsheet when you're ready to email.

   Protected by the EXPORT_TOKEN environment variable. If that
   variable isn't set, the endpoint refuses every request — it can
   never be left accidentally open.

   The token goes in a header, never the URL: a token in a query
   string ends up in server logs, shell history and browser history.

     curl -H "Authorization: Bearer THE_TOKEN" \
          https://yourdomain.com/api/subscribers -o list.csv
   ============================================================= */

/* Constant-time compare. Hashing both sides first means even the LENGTH of
   the real token can't be read off the response timing. */
async function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const enc = new TextEncoder();
  const [ha, hb] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(a)),
    crypto.subtle.digest('SHA-256', enc.encode(b))
  ]);
  const x = new Uint8Array(ha), y = new Uint8Array(hb);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

/* One identical response for every refusal, so nothing is leaked by which
   error you get back. */
function deny() {
  return new Response('Forbidden\n', {
    status: 403,
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff'
    }
  });
}

/* A CSV cell beginning with = + - @ (or tab/CR) is executed as a formula by
   Excel, Sheets and LibreOffice. Prefix it with an apostrophe so the list can
   be opened safely. \r must force quoting too, or it fabricates extra rows. */
function csvCell(v) {
  let s = String(v == null ? '' : v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

export async function onRequestGet(context) {
  const { request, env } = context;

  const expected = env.EXPORT_TOKEN;
  if (!expected) {
    /* Fail closed, and say nothing useful — "the token isn't set yet" is a
       handy thing for an attacker to learn right after a deploy. */
    console.warn('subscribers export blocked: EXPORT_TOKEN is not configured');
    return deny();
  }

  const given = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!(await safeEqual(given, expected))) return deny();

  if (!env.SUBSCRIBERS) {
    console.warn('subscribers export blocked: KV namespace SUBSCRIBERS is not bound');
    return deny();
  }

  const rows = [['email', 'kids', 'signed_up', 'country', 'source', 'consent', 'consent_text']];
  let cursor;

  /* KV lists 1000 keys at a time — page through all of them. Each record is
     mirrored into the key's metadata, so this needs no per-subscriber read;
     a list of 10,000 would otherwise be 10,000 serial round-trips and blow
     the Worker CPU budget. get() stays only as a fallback for old keys. */
  do {
    const page = await env.SUBSCRIBERS.list({ prefix: 'sub:', cursor, limit: 1000 });
    for (const k of page.keys) {
      let s = k.metadata;
      if (!s) {
        const raw = await env.SUBSCRIBERS.get(k.name);
        if (!raw) continue;
        try { s = JSON.parse(raw); } catch (e) { continue; }
      }
      rows.push([s.email, s.kids, s.at, s.country, s.source, s.consent === true, s.consentText]);
    }
    cursor = page.list_complete ? null : page.cursor;
  } while (cursor);

  const csv = rows.map((r) => r.map(csvCell).join(',')).join('\n') + '\n';

  return new Response(csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': 'attachment; filename="wonderworld-subscribers.csv"',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'no-referrer'
    }
  });
}

export async function onRequest(context) {
  if (context.request.method === 'GET') return onRequestGet(context);
  return new Response('Method not allowed\n', {
    status: 405,
    headers: { 'content-type': 'text/plain; charset=utf-8', 'x-content-type-options': 'nosniff' }
  });
}
