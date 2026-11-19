// SPDX-License-Identifier: MIT. All identities and provider responses are synthetic; no mail or live OAuth.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { createHmac, generateKeyPairSync, sign } from 'node:crypto';
import { createApp } from '../app.mjs';
import { migrate } from '../auth.mjs';
import { readConfig } from '../config.mjs';

const origin = 'https://accounts.ymzz.test';
const config = { origin, development: false, secret: 'synthetic-test-only-secret-12345678901234567890', email: true, google: true, googleId: 'test-client.apps.googleusercontent.com', googleSecret: 'synthetic-google-secret' };
async function fixture(t, options = {}) {
  const db = new DatabaseSync(':memory:'); db.exec('PRAGMA foreign_keys=ON');
  const deliveries = [];
  const app = createApp({ ...config, ...options }, db, async data => { deliveries.push(data); });
  await migrate(app.auth, db);
  t.after(() => db.close());
  let clientNumber = 0;
  function browser() {
    const clientIP = '192.0.2.' + (++clientNumber);
    const jar = new Map();
    return { jar, async request(path, body, extra = {}) {
      const headers = new Headers({ 'x-ymzz-client-ip': clientIP, cookie: [...jar].map(([k,v])=>k+'='+v).join('; '), ...(body === undefined ? {} : { origin, 'content-type':'application/json' }), ...extra.headers });
      const response = await app.fetch(new Request(origin + path, { method: body === undefined ? 'GET' : 'POST', headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }));
      for (const cookie of response.headers.getSetCookie()) { const first=cookie.split(';')[0];const i=first.indexOf('=');jar.set(first.slice(0,i),first.slice(i+1)); }
      return response;
    } };
  }
  async function login(b, email='owner@example.test') {
    const sent = await b.request('/api/auth/email-otp/send-verification-otp', { email, type:'sign-in' });
    assert.equal(sent.status, 200, await sent.clone().text());
    const otp = deliveries.at(-1).otp;
    const response = await b.request('/api/auth/sign-in/email-otp', { email, otp });
    assert.equal(response.status,200,await response.clone().text());
    return response;
  }
  return { db, app, deliveries, browser, login };
}
function totp(uri) {
  const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';let bits='';
  for(const c of new URL(uri).searchParams.get('secret').replace(/=+$/, '')) bits+=alphabet.indexOf(c.toUpperCase()).toString(2).padStart(5,'0');
  const key=Buffer.from((bits.match(/.{8}/g)||[]).map(v=>parseInt(v,2)));
  const counter=Buffer.alloc(8);counter.writeBigUInt64BE(BigInt(Math.floor(Date.now()/30000)));
  const hmac=createHmac('sha1',key).update(counter).digest();const offset=hmac.at(-1)&15;
  return String((hmac.readUInt32BE(offset)&0x7fffffff)%1000000).padStart(6,'0');
}
async function enroll(b) {
  const r=await b.request('/api/auth/two-factor/enable',{method:'totp'});
  assert.equal(r.status,200,await r.clone().text());
  const data=await r.json();
  const verified=await b.request('/api/auth/two-factor/verify-totp',{code:totp(data.totpURI)});
  assert.equal(verified.status,200,await verified.clone().text());
  return data;
}
function mockGoogle(t, email='google@example.test', overrides={}, badSignature=false) {
  const { privateKey, publicKey }=generateKeyPairSync('rsa',{modulusLength:2048});
  const jwk={...publicKey.export({format:'jwk'}),kid:'test-key',alg:'RS256',use:'sig'};
  const encode=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
  const body=encode({alg:'RS256',kid:'test-key',typ:'JWT'})+'.'+encode({iss:'https://accounts.google.com',aud:config.googleId,sub:'google-synthetic-subject',email,email_verified:true,name:'Synthetic User',iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+300,...overrides});
  const token=body+'.'+(badSignature ? Buffer.from('invalid-signature') : sign('RSA-SHA256',Buffer.from(body),privateKey)).toString('base64url');
  t.mock.method(globalThis,'fetch',async (input,init) => {
    const url=typeof input==='string'?input:input.url || String(input);
    if(url==='https://www.googleapis.com/oauth2/v3/certs') return Response.json({keys:[jwk]});
    if(url==='https://oauth2.googleapis.com/token') {
      const params=new URLSearchParams(init?.body || input.body);
      assert.ok(params.get('code_verifier'),'PKCE verifier must accompany code exchange');
      assert.equal(params.get('redirect_uri'),origin+'/api/auth/callback/google');
      return Response.json({access_token:'synthetic-access-token',token_type:'Bearer',expires_in:300,id_token:token});
    }
    throw new Error('Unexpected external request blocked: '+url);
  });
}
async function googleStart(b, route='/api/auth/sign-in/social') {
  const start=await b.request(route,{provider:'google',callbackURL:'https://attacker.invalid/'});
  assert.equal(start.status,200,await start.clone().text());
  const url=new URL((await start.json()).url);
  assert.equal(url.origin,'https://accounts.google.com');
  assert.equal(url.searchParams.get('code_challenge_method'),'S256');
  assert.ok(url.searchParams.get('state'));
  assert.deepEqual(new Set(url.searchParams.get('scope').split(' ')),new Set(['openid','email','profile']));
  return '/api/auth/callback/google?code=synthetic-code&state='+encodeURIComponent(url.searchParams.get('state'));
}

test('configuration rejects insecure origins, partial credentials and unsafe mail settings',()=>{
  const env={NODE_ENV:'production',AUTH_ORIGIN:origin,AUTH_SECRET:config.secret};
  assert.equal(readConfig(env).email,false);
  for(const patch of [{AUTH_ORIGIN:'http://example.test'},{AUTH_ORIGIN:origin+'/path'},{AUTH_SECRET:'short'},{GOOGLE_CLIENT_ID:'one'},{SMTP_HOST:'mail.test'},{TRUST_PROXY:'any'}]) assert.throws(()=>readConfig({...env,...patch}));
});
test('unconfigured providers are disabled; no fake successful login',async t=>{
  const f=await fixture(t,{email:false,google:false});const b=f.browser();
  assert.deepEqual(await (await b.request('/api/capabilities')).json(),{email:false,google:false,totp:true});
  assert.equal((await b.request('/api/auth/email-otp/send-verification-otp',{email:'a@example.test',type:'sign-in'})).status,503);
  assert.equal((await b.request('/api/account')).status,401);
});
test('CSRF, raw provider APIs, open redirects and same-email second factor are rejected',async t=>{
  const f=await fixture(t);const b=f.browser();
  for(const headers of [{origin:'https://attacker.invalid'},{origin:''},{'sec-fetch-site':'cross-site'}]) assert.equal((await b.request('/api/auth/sign-out',{}, {headers})).status,403);
  assert.equal((await b.request('/api/auth/get-session')).status,404);
  assert.equal((await b.request('/api/auth/sign-in/social',{provider:'google',idToken:{token:'bad'}})).status,400);
  await f.login(b);
  assert.equal((await b.request('/api/auth/two-factor/enable',{method:'otp'})).status,400);
  const response=await b.request('/api/account');assert.equal(response.headers.get('cache-control'),'no-store');assert.match(response.headers.get('content-security-policy'),/frame-ancestors 'none'/);
});
test('email OTP creates a verified session with Secure HttpOnly SameSite cookies and no exposed token; replay fails',async t=>{
  const f=await fixture(t);const b=f.browser();const response=await f.login(b);
  assert.ok(response.headers.getSetCookie().some(c=>/HttpOnly/i.test(c)&&/Secure/i.test(c)&&/SameSite=Lax/i.test(c)));
  assert.equal((await response.json()).token,undefined);
  assert.equal((await (await b.request('/api/account')).json()).emailVerified,true);
  const other=f.browser();
  assert.notEqual((await other.request('/api/auth/sign-in/email-otp',{email:'owner@example.test',otp:f.deliveries[0].otp})).status,200);
  assert.equal((await other.request('/api/account')).status,401);
  assert.ok(!JSON.stringify(f.db.prepare('SELECT * FROM verification').all()).includes(f.deliveries[0].otp));
});
test('expired and wrong OTPs never authenticate; per-address sending is limited across clients',async t=>{
  const f=await fixture(t);const b=f.browser();
  await b.request('/api/auth/email-otp/send-verification-otp',{email:'expiry@example.test',type:'sign-in'});
  f.db.prepare('UPDATE verification SET expiresAt=?').run(Date.now()-1000);
  assert.notEqual((await b.request('/api/auth/sign-in/email-otp',{email:'expiry@example.test',otp:f.deliveries[0].otp})).status,200);
  for(let i=0;i<3;i++) await f.browser().request('/api/auth/email-otp/send-verification-otp',{email:'limit@example.test',type:'sign-in'});
  assert.equal((await f.browser().request('/api/auth/email-otp/send-verification-otp',{email:'LIMIT@example.test',type:'sign-in'})).status,429);
});
test('TOTP enrollment requires confirmation; every fresh email login is server-gated until independent recovery factor',async t=>{
  const f=await fixture(t);const b=f.browser();await f.login(b);const data=await enroll(b);
  assert.equal(data.backupCodes.length,10);
  assert.equal((await (await b.request('/api/account')).json()).twoFactorEnabled,true);
  const other=f.browser();await f.login(other);
  assert.equal((await other.request('/api/account')).status,403);
  for(const route of ['/two-factor/disable','/two-factor/enable','/two-factor/generate-backup-codes','/link-social']) assert.equal((await other.request('/api/auth'+route,{})).status,403);
  assert.notEqual((await other.request('/api/auth/two-factor/verify-totp',{code:totp(data.totpURI)})).status,200,'same TOTP cannot be replayed');
  const backup=await other.request('/api/auth/two-factor/verify-backup-code',{code:data.backupCodes[0]});assert.equal(backup.status,200,await backup.clone().text());
  assert.equal((await other.request('/api/account')).status,200);
  const third=f.browser();await f.login(third);
  assert.notEqual((await third.request('/api/auth/two-factor/verify-backup-code',{code:data.backupCodes[0]})).status,200);
  assert.equal((await third.request('/api/account')).status,403);
  assert.equal((await other.request('/api/auth/sign-out',{})).status,200);
  assert.equal((await other.request('/api/account')).status,401);
});
test('a fresh authenticator code completes email+TOTP login, not merely client UI',async t=>{
  t.mock.timers.enable({apis:['Date'],now:Date.now()});
  const f=await fixture(t);const b=f.browser();await f.login(b);const data=await enroll(b);
  const other=f.browser();await f.login(other);t.mock.timers.tick(31000);
  const result=await other.request('/api/auth/two-factor/verify-totp',{code:totp(data.totpURI)});
  assert.equal(result.status,200,await result.clone().text());
  assert.equal((await other.request('/api/account')).status,200);
});
test('wrong factor attempts are rate-limited per account across sessions',async t=>{
  const f=await fixture(t);const b=f.browser();await f.login(b);await enroll(b);
  const other=f.browser();await f.login(other);
  for(let i=0;i<5;i++) await other.request('/api/auth/two-factor/verify-backup-code',{code:'invalid-recovery-code'});
  assert.equal((await other.request('/api/auth/two-factor/verify-backup-code',{code:'invalid-recovery-code'})).status,429);
  assert.equal((await other.request('/api/account')).status,403);
});
test('Google authorization-code flow validates signed identity, PKCE and state; fresh Google session also requires 2FA',async t=>{
  mockGoogle(t);const f=await fixture(t);const b=f.browser();const callback=await googleStart(b);
  const done=await b.request(callback);assert.equal(done.status,302,await done.clone().text());assert.equal(done.headers.get('location'),origin+'/account');
  assert.equal((await b.request('/api/account')).status,200);
  const data=await enroll(b);
  const other=f.browser();const cb=await googleStart(other);const signIn=await other.request(cb);assert.equal(signIn.status,302);
  assert.equal((await other.request('/api/account')).status,403,'OAuth must not bypass TOTP policy');
  assert.equal((await other.request('/api/auth/two-factor/verify-backup-code',{code:data.backupCodes[0]})).status,200);
  assert.equal((await other.request('/api/account')).status,200);
  const stolen=f.browser();assert.notEqual((await stolen.request(callback)).headers.get('location'),origin+'/account');
  assert.equal((await stolen.request('/api/account')).status,401);
});
test('Google rejects wrong-audience identity and forged state',async t=>{
  mockGoogle(t,'bad@example.test',{aud:'attacker-client'});const f=await fixture(t);const b=f.browser();
  await b.request(await googleStart(b));assert.equal((await b.request('/api/account')).status,401);
  await b.request('/api/auth/callback/google?code=synthetic-code&state=forged');assert.equal((await b.request('/api/account')).status,401);
});
test('matching email never silently links Google to an existing account',async t=>{
  mockGoogle(t,'owner@example.test');const f=await fixture(t);const owner=f.browser();await f.login(owner);
  const other=f.browser();await other.request(await googleStart(other));assert.equal((await other.request('/api/account')).status,401);
  const linked=await owner.request(await googleStart(owner,'/api/auth/link-social'));
  assert.equal(linked.status,302);
  const google=f.browser();await google.request(await googleStart(google));assert.equal((await google.request('/api/account')).status,200);
});
test('account assets build and serve without external scripts, trackers or browser token storage',async t=>{
  const f=await fixture(t);const b=f.browser();
  for(const path of ['/account','/account.js','/account.css','/style.css','/fonts/inter.woff2']) assert.equal((await b.request(path)).status,200,path);
  const js=await (await b.request('/account.js')).text();assert.doesNotMatch(js,/localStorage|sessionStorage|innerHTML/);
  assert.equal((await b.request('/api/auth/list-sessions')).status,404);
});

for (const [name, claims, badSignature] of [
  ['invalid signature', {}, true], ['wrong issuer', { iss: 'https://attacker.invalid' }, false],
  ['expired identity', { exp: 1 }, false], ['unverified email', { email_verified: false }, false],
]) test('Google rejects ' + name, async t => {
  mockGoogle(t, 'rejected@example.test', claims, badSignature);
  const f = await fixture(t); const b = f.browser();
  await b.request(await googleStart(b));
  assert.equal((await b.request('/api/account')).status, 401);
});
test('concurrent email OTP replay permits only one session', async t => {
  const f = await fixture(t); const b = f.browser();
  await b.request('/api/auth/email-otp/send-verification-otp', { email: 'race@example.test', type: 'sign-in' });
  const code = f.deliveries.at(-1).otp;
  const results = await Promise.all([f.browser(), f.browser()].map(client => client.request('/api/auth/sign-in/email-otp', { email: 'race@example.test', otp: code })));
  assert.equal(results.filter(r => r.status === 200).length, 1);
});
test('TOTP does not activate before confirmation and recovery codes are not stored as plaintext', async t => {
  const f = await fixture(t); const b = f.browser(); await f.login(b);
  const enrollment = await (await b.request('/api/auth/two-factor/enable', { method: 'totp' })).json();
  assert.equal((await (await b.request('/api/account')).json()).twoFactorEnabled, false);
  assert.notEqual((await b.request('/api/auth/two-factor/verify-totp', { code: 'not-a-code' })).status, 200);
  assert.equal((await (await b.request('/api/account')).json()).twoFactorEnabled, false);
  const stored = JSON.stringify(f.db.prepare('SELECT * FROM twoFactor').all());
  for (const code of enrollment.backupCodes) assert.ok(!stored.includes(code));
  assert.ok(!stored.includes(new URL(enrollment.totpURI).searchParams.get('secret')));
});
test('unknown and known email OTP failures have the same public response', async t => {
  const f = await fixture(t); const owner = f.browser(); await f.login(owner);
  const b = f.browser();
  const known = await b.request('/api/auth/sign-in/email-otp', { email: 'owner@example.test', otp: 'bad' });
  const unknown = await b.request('/api/auth/sign-in/email-otp', { email: 'unknown@example.test', otp: 'bad' });
  assert.equal(known.status, unknown.status); assert.deepEqual(await known.json(), await unknown.json());
});

test('global SMTP budget applies across addresses and sessions', async t => {
  const f = await fixture(t, { mailHourlyLimit: 1 });
  assert.equal((await f.browser().request('/api/auth/email-otp/send-verification-otp', { email: 'first@example.test', type: 'sign-in' })).status, 200);
  assert.equal((await f.browser().request('/api/auth/email-otp/send-verification-otp', { email: 'second@example.test', type: 'sign-in' })).status, 429);
  assert.equal(f.deliveries.length, 1);
});

test('duplicate session cookies cannot transfer another account factor assurance', async t => {
  const f = await fixture(t);
  const alice = f.browser(); await f.login(alice, 'alice@example.test'); await enroll(alice);
  const bob = f.browser(); await f.login(bob, 'bob@example.test'); const bobFactors = await enroll(bob);
  const pendingAlice = f.browser(); await f.login(pendingAlice, 'alice@example.test');
  const cookie = [...bob.jar, ...pendingAlice.jar].map(([key, value]) => key + '=' + value).join('; ');
  await bob.request('/api/auth/two-factor/verify-backup-code', { code: bobFactors.backupCodes[0] }, { headers: { cookie } });
  assert.equal((await pendingAlice.request('/api/account')).status, 403);
});
test('concurrent recovery replay permits only one assured session', async t => {
  const f = await fixture(t); const owner = f.browser(); await f.login(owner); const data = await enroll(owner);
  const clients = [f.browser(), f.browser()];
  for (const client of clients) await f.login(client);
  const results = await Promise.all(clients.map(client => client.request('/api/auth/two-factor/verify-backup-code', { code: data.backupCodes[0] })));
  assert.equal(results.filter(r => r.status === 200).length, 1);
  const statuses = await Promise.all(clients.map(async client => (await client.request('/api/account')).status));
  assert.deepEqual(statuses.sort(), [200, 403]);
});
test('expired provider sessions invalidate account access despite earlier factor assurance', async t => {
  const f = await fixture(t); const owner = f.browser(); await f.login(owner); await enroll(owner);
  f.db.prepare('UPDATE session SET expiresAt=?').run(Date.now() - 1000);
  assert.equal((await owner.request('/api/account')).status, 401);
});

test('script-free forms cannot leak email or codes through native GET submission', async t => {
  const f = await fixture(t); const b = f.browser(); const page = await b.request('/account');
  assert.match(page.headers.get('content-security-policy'), /form-action 'none'/);
  const html = await page.text();
  assert.doesNotMatch(html, /<form(?![^>]*method="post")/);
  const invalidType = await b.request('/api/auth/sign-out', {}, { headers: { 'content-type': 'application/jsonp' } });
  assert.equal(invalidType.status, 415);
});
