#!/usr/bin/env bash
# =============================================================
# WonderWorld — tools/verify-deploy.sh
# Smoke-tests a live Cloudflare Pages deployment.
#
#   ./tools/verify-deploy.sh https://wonderworld.pages.dev
#
# Checks the things that are specific to Pages and that only show
# up in production: the SPA-fallback trap, redirect behaviour,
# security headers, whether the KV binding is actually attached,
# and whether anything leaked onto the CDN.
# =============================================================
set -uo pipefail

BASE="${1:-}"
if [ -z "$BASE" ]; then
  echo "usage: $0 https://your-project.pages.dev" >&2
  exit 2
fi
BASE="${BASE%/}"

pass=0; fail=0; warn=0
ok()   { printf '  \033[32m✓\033[0m %s\n' "$1"; pass=$((pass+1)); }
bad()  { printf '  \033[31m✗\033[0m %s\n' "$1"; fail=$((fail+1)); }
note() { printf '  \033[33m!\033[0m %s\n' "$1"; warn=$((warn+1)); }

code()   { curl -s -o /dev/null -w '%{http_code}' --max-time 15 "$1"; }
ctype()  { curl -s -o /dev/null -w '%{content_type}' --max-time 15 "$1"; }
hdrs()   { curl -s -D- -o /dev/null --max-time 15 "$1"; }

echo
echo "Verifying $BASE"

echo
echo "— Core pages —"
[ "$(code "$BASE/")" = "200" ] && ok "/ serves the game" || bad "/ returned $(code "$BASE/")"
[ "$(code "$BASE/privacy")" = "200" ] && ok "/privacy serves the policy" || bad "/privacy returned $(code "$BASE/privacy")"
case "$(ctype "$BASE/js/core.js")" in
  *javascript*) ok "js/core.js served as JavaScript" ;;
  *)            bad "js/core.js served as $(ctype "$BASE/js/core.js") — scripts will be blocked" ;;
esac
case "$(ctype "$BASE/assets/manifest.webmanifest")" in
  *manifest*|*json*) ok "manifest served with a JSON MIME type" ;;
  *)                 note "manifest MIME is $(ctype "$BASE/assets/manifest.webmanifest")" ;;
esac

echo
echo "— SPA-fallback trap (needs 404.html) —"
for p in /nonexistent /some/deep/path /wonder/js/core.js; do
  c="$(code "$BASE$p")"
  if [ "$c" = "404" ]; then ok "$p → 404"
  else bad "$p → $c (SPA fallback is on; 404.html missing → blank page for typo'd URLs)"; fi
done

echo
echo "— Nothing leaked onto the CDN —"
# `wrangler pages dev` serves the repo verbatim, including functions/ and
# dotfiles. The real Pages build compiles functions/ instead of serving it,
# so these only mean something against a deployed URL.
IS_LOCAL=0
case "$BASE" in *localhost*|*127.0.0.1*) IS_LOCAL=1 ;; esac

for p in /functions/api/subscribe.js /functions/api/subscribers.js /.gitignore; do
  c="$(code "$BASE$p")"
  if [ "$c" = "404" ]; then ok "$p is not served"
  elif [ "$IS_LOCAL" = "1" ]; then note "$p is served by the dev server (expected locally; must be 404 in production)"
  else bad "$p is PUBLIC ($c)"; fi
done
for p in /README.md /tools/browser-test.js; do
  c="$(code "$BASE$p")"
  [ "$c" = "404" ] && ok "$p is not served" \
    || note "$p is public ($c) — harmless, no secrets, but move files into public/ if you'd rather it weren't"
done

echo
echo "— Security headers —"
H="$(hdrs "$BASE/")"
grep -qi 'x-content-type-options: *nosniff'  <<<"$H" && ok "X-Content-Type-Options"   || bad "X-Content-Type-Options missing"
grep -qi 'referrer-policy'                   <<<"$H" && ok "Referrer-Policy"           || bad "Referrer-Policy missing"
grep -qi 'permissions-policy'                <<<"$H" && ok "Permissions-Policy"        || bad "Permissions-Policy missing"
grep -qi 'x-frame-options'                   <<<"$H" && ok "X-Frame-Options"           || bad "X-Frame-Options missing"
grep -qi 'strict-transport-security'         <<<"$H" && ok "HSTS enabled"              \
  || note "HSTS not set — turn on SSL/TLS → Edge Certificates → HSTS"
grep -qi 'cache-control:.*max-age=0'         <<<"$H" && ok "HTML revalidates"          || note "HTML cache-control: check _headers"

echo
echo "— Icons —"
for f in apple-touch-icon.png icon-192.png icon-512.png icon-512-maskable.png favicon-32.png; do
  [ "$(code "$BASE/assets/$f")" = "200" ] && ok "$f" || bad "$f missing"
done

echo
echo "— Signup API (needs the SUBSCRIBERS KV binding) —"
RESP="$(curl -s --max-time 20 -X POST "$BASE/api/subscribe" \
  -H 'content-type: application/json' \
  -d '{"email":"deploy-verify@example.com","kids":"1","consent":true,"source":"deploy-check"}')"
case "$RESP" in
  *'"ok":true'*)
    ok "signup endpoint accepted a submission" ;;
  *not_configured*)
    bad "KV binding missing — add a KV namespace binding named SUBSCRIBERS, then redeploy"
    bad "  (until then EVERY signup silently fails for your visitors)" ;;
  *)
    bad "unexpected response: $RESP" ;;
esac

echo "  validation still enforced:"
V="$(curl -s --max-time 20 -X POST "$BASE/api/subscribe" -H 'content-type: application/json' -d '{"email":"nope","consent":true}')"
grep -q 'bad_email' <<<"$V" && ok "  malformed email rejected" || bad "  bad email not rejected: $V"
V="$(curl -s --max-time 20 -X POST "$BASE/api/subscribe" -H 'content-type: application/json' -d '{"email":"a@b.co"}')"
grep -q 'no_consent' <<<"$V" && ok "  missing consent rejected" || bad "  consent not enforced: $V"

echo
echo "— Export endpoint must fail closed —"
[ "$(code "$BASE/api/subscribers")" = "403" ] && ok "unauthenticated export refused" \
  || bad "export returned $(code "$BASE/api/subscribers") — expected 403"
[ "$(code "$BASE/api/subscribers?token=guess")" = "403" ] && ok "query-string token refused" \
  || bad "query-string token was accepted"
if [ -n "${EXPORT_TOKEN:-}" ]; then
  if curl -s --max-time 20 -H "Authorization: Bearer $EXPORT_TOKEN" "$BASE/api/subscribers" | grep -q '^email,'; then
    ok "export works with the real token"
  else
    bad "export rejected the token in \$EXPORT_TOKEN"
  fi
else
  note "set EXPORT_TOKEN=... to also test a successful export"
fi

echo
printf 'Result: \033[32m%d passed\033[0m' "$pass"
[ "$warn" -gt 0 ] && printf ', \033[33m%d warning(s)\033[0m' "$warn"
[ "$fail" -gt 0 ] && printf ', \033[31m%d FAILED\033[0m' "$fail"
echo; echo
exit $(( fail > 0 ? 1 : 0 ))
