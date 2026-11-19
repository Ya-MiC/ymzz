// SPDX-License-Identifier: MIT
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createAuth } from './auth.mjs';

const publicPosts = new Set(['/sign-in/social', '/sign-in/email-otp', '/email-otp/send-verification-otp']);
const factorPosts = new Set(['/two-factor/verify-totp', '/two-factor/verify-backup-code']);
const accountPosts = new Set(['/two-factor/enable', '/two-factor/disable', '/two-factor/generate-backup-codes', '/link-social']);
const digest = value => createHash('sha256').update(value).digest('hex');
const json = (body, status = 200) => Response.json(body, { status });

/** Same-origin account service. All business routes must use this assurance check, not raw provider sessions. */
export function createApp(config, database, sendOTP) {
  const auth = createAuth(config, database, sendOTP);
  function limited(key, max, seconds) {
    const now = Date.now();
    const row = database.prepare(`INSERT INTO ymzz_limits(key,count,until) VALUES(?,1,?)
      ON CONFLICT(key) DO UPDATE SET count=CASE WHEN until < ? THEN 1 ELSE count+1 END,
      until=CASE WHEN until < ? THEN excluded.until ELSE until END RETURNING count`).get(key, now + seconds * 1000, now, now);
    return row.count > max;
  }
  async function sessionFor(headers) { return auth.api.getSession({ headers }); }
  function needsFactor(session) {
    return Boolean(session?.user.twoFactorEnabled && !database.prepare(
      'SELECT 1 FROM ymzz_assurance WHERE sessionId=? AND userId=? AND expiresAt>?',
    ).get(session.session.id, session.user.id, Date.now()));
  }
  async function handle(request) {
    const url = new URL(request.url);
    if (url.origin !== config.origin) return json({ error: 'INVALID_ORIGIN' }, 403);
    const path = url.pathname;
    if (request.method === 'GET' && path === '/api/capabilities') return json({ google: config.google, email: config.email, totp: true });
    if (request.method === 'GET' && ['/account', '/account/', '/account.js', '/account.css', '/style.css', '/favicon.svg', '/fonts/inter.woff2', '/fonts/fraunces.woff2', '/fonts/jetbrains-mono.woff2', '/licenses/Fraunces-OFL.txt', '/licenses/Inter-OFL.txt', '/licenses/JetBrains-Mono-OFL.txt'].includes(path)) {
      const name = ['/account', '/account/'].includes(path) ? 'account.html' : path.slice(1);
      const body = await readFile(new URL('./dist/' + name, import.meta.url));
      return new Response(body, { headers: { 'Content-Type': name.endsWith('.html') ? 'text/html; charset=utf-8' : name.endsWith('.js') ? 'text/javascript; charset=utf-8' : name.endsWith('.svg') ? 'image/svg+xml' : name.endsWith('.woff2') ? 'font/woff2' : name.endsWith('.txt') ? 'text/plain; charset=utf-8' : 'text/css; charset=utf-8' } });
    }
    if (!path.startsWith('/api/')) return json({ error: 'NOT_FOUND' }, 404);
    const origin = request.headers.get('origin');
    if (request.method !== 'GET' && (origin !== config.origin || request.headers.get('sec-fetch-site') === 'cross-site')) return json({ error: 'INVALID_ORIGIN' }, 403);
    let body;
    if (request.method === 'POST') {
      if ((request.headers.get('content-type') || '').split(';')[0].trim().toLowerCase() !== 'application/json') return json({ error: 'JSON_REQUIRED' }, 415);
      // The HTTP adapter bounds the stream too; direct fetch callers are bounded here.
      const text = await request.text();
      if (Buffer.byteLength(text) > 16384) return json({ error: 'BODY_TOO_LARGE' }, 413);
      try { body = JSON.parse(text); } catch { return json({ error: 'INVALID_JSON' }, 400); }
      if (!body || typeof body !== 'object' || Array.isArray(body)) return json({ error: 'INVALID_JSON' }, 400);
      request = new Request(request, { body: text });
    }
    const session = await sessionFor(request.headers);
    const pending = needsFactor(session);
    if (path === '/api/account' && request.method === 'GET') {
      if (!session) return json({ error: 'UNAUTHENTICATED' }, 401);
      if (pending) return json({ error: 'MFA_REQUIRED' }, 403);
      return json({ email: session.user.email, emailVerified: session.user.emailVerified, twoFactorEnabled: Boolean(session.user.twoFactorEnabled) });
    }
    if (!path.startsWith('/api/auth/')) return json({ error: 'NOT_FOUND' }, 404);
    const route = path.slice('/api/auth'.length);
    const callback = route === '/callback/google' && request.method === 'GET';
    const signout = route === '/sign-out' && request.method === 'POST';
    const factor = factorPosts.has(route) && request.method === 'POST';
    const manage = accountPosts.has(route) && request.method === 'POST';
    if (!(callback || signout || factor || manage || (publicPosts.has(route) && request.method === 'POST'))) return json({ error: 'NOT_FOUND' }, 404);
    if (pending && !factor && !signout) return json({ error: 'MFA_REQUIRED' }, 403);
    if ((factor || manage) && !session) return json({ error: 'UNAUTHENTICATED' }, 401);
    if (route === '/two-factor/enable' && body?.method !== 'totp') return json({ error: 'TOTP_ONLY' }, 400);
    if (route === '/link-social') {
      if (!session.user.emailVerified || body.provider !== 'google' || !config.google) return json({ error: 'LINK_NOT_ALLOWED' }, 403);
      request = new Request(request, { body: JSON.stringify({ provider: 'google', callbackURL: config.origin + '/account', errorCallbackURL: config.origin + '/account?error=link' }) });
    }
    if (publicPosts.has(route)) {
      if (session) return json({ error: 'SIGN_OUT_FIRST' }, 409);
      if (route === '/sign-in/social' && (body.provider !== 'google' || body.idToken || body.additionalParams || body.scopes || body.requestSignUp !== undefined || body.loginHint)) return json({ error: 'GOOGLE_REDIRECT_ONLY' }, 400);
      if (route === '/sign-in/social') {
        // A fixed local landing page prevents callback/open redirect injection.
        body = { provider: 'google', callbackURL: config.origin + '/account', errorCallbackURL: config.origin + '/account?error=oauth' };
        request = new Request(request, { body: JSON.stringify(body) });
      } else {
        if (!config.email) return json({ error: 'EMAIL_DISABLED' }, 503);
        if (route === '/email-otp/send-verification-otp' && body.type !== 'sign-in') return json({ error: 'SIGN_IN_ONLY' }, 400);
        const email = String(body.email || '').trim().toLowerCase();
        if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: 'INVALID_EMAIL' }, 400);
        body.email = email;
        request = new Request(request, { body: JSON.stringify(body) });
        const key = 'email:' + digest(email);
        if (limited(key + ':' + route, route.includes('send-') ? 3 : 5, 300)) return json({ error: 'TRY_LATER' }, 429);
        if (route.includes('send-') && limited('mail-global', config.mailHourlyLimit || 100, 3600)) return json({ error: 'TRY_LATER' }, 429);
      }
    }
    if (factor && limited('factor:' + session.user.id, 5, 300)) return json({ error: 'TRY_LATER' }, 429);
    const response = await auth.handler(request);
    if (manage && response.ok && route.startsWith('/two-factor/')) database.prepare('DELETE FROM ymzz_assurance WHERE userId=?').run(session.user.id);
    if (factor && response.ok) {
      const value = await response.clone().json();
      if (value.status === true || value.token) {
        if (route.endsWith('verify-totp')) {
          const key = digest(session.user.id + ':' + body.code);
          database.prepare('DELETE FROM ymzz_used_totp WHERE until<?').run(Date.now());
          try { database.prepare('INSERT INTO ymzz_used_totp(key,until) VALUES(?,?)').run(key, Date.now() + 90000); }
          catch { return json({ error: 'CODE_ALREADY_USED' }, 400); }
        }
        // Enrollment rotates the session; read the resulting HttpOnly cookies internally.
        const cookies = new Map((request.headers.get('cookie') || '').split(';').filter(Boolean).map(s => { const i=s.indexOf('='); return [s.slice(0,i).trim(),s.slice(i+1)]; }));
        for (const cookie of response.headers.getSetCookie()) { const part=cookie.split(';')[0]; const i=part.indexOf('='); cookies.set(part.slice(0,i),part.slice(i+1)); }
        const headers = new Headers(request.headers);
        headers.set('cookie', [...cookies].map(([k,v]) => k+'='+v).join('; '));
        const verified = await sessionFor(headers);
        if (!verified || verified.user.id !== session.user.id) return json({ error: 'SESSION_EXPIRED' }, 401);
        database.prepare('INSERT OR REPLACE INTO ymzz_assurance(sessionId,userId,expiresAt) VALUES(?,?,?)').run(verified.session.id, verified.user.id, new Date(verified.session.expiresAt).getTime());
      }
    }
    if (signout && session) database.prepare('DELETE FROM ymzz_assurance WHERE sessionId=?').run(session.session.id);
    if (!response.ok && response.status >= 400) return json({ error: response.status === 429 ? 'TRY_LATER' : 'INVALID_CODE_OR_REQUEST' }, response.status === 429 ? 429 : response.status >= 500 ? 503 : 400);
    if (response.status !== 302 && response.status !== 303 && response.headers.get('content-type')?.includes('application/json')) {
      const value = await response.json();
      if (value && typeof value === 'object') { delete value.token; if (value.session) delete value.session.token; }
      const headers = new Headers(response.headers); headers.delete('content-length');
      return new Response(JSON.stringify(value), { status: response.status, headers });
    }
    return response;
  }
  return { auth, async fetch(request) {
    // Bounded housekeeping. No email addresses, tokens, request bodies or query strings in logs.
    database.prepare('DELETE FROM ymzz_limits WHERE until<?').run(Date.now() - 300000);
    database.prepare('DELETE FROM ymzz_assurance WHERE expiresAt<?').run(Date.now());
    const response = await handle(request);
    response.headers.set('Cache-Control', 'no-store');
    response.headers.set('Referrer-Policy', 'no-referrer');
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; form-action 'none'; frame-ancestors 'none'; base-uri 'none'");
    if (!config.development) response.headers.set('Strict-Transport-Security', 'max-age=31536000');
    return response;
  } };
}
