// SPDX-License-Identifier: MIT. No tokens, OTPs, TOTP secrets or recovery codes in browser storage.
const $ = id => document.getElementById(id);
const show = (id, visible) => { $(id).hidden = !visible; };
const status = text => { $('status').textContent = text; };
let email = '';
async function api(path, body) {
  const response = await fetch('/api/' + path, { method: body === undefined ? 'GET' : 'POST',
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
    credentials: 'same-origin', cache: 'no-store', ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const value = await response.json();
  if (!response.ok) throw new Error(['MFA_REQUIRED', 'UNAUTHENTICATED'].includes(value.error) ? value.error : response.status === 429 ? '請稍後再試 / Too many attempts; try later' : '操作未完成，請檢查代碼或稍後重試 / Could not complete; check your code or try later');
  return value;
}
function clearSecrets() { for (const id of ['totp-secret','email-code','factor-code','confirm-code']) $(id).value = ''; $('backup-codes').textContent = ''; $('totp-link').removeAttribute('href'); show('enrollment', false); }
async function refresh() {
  for (const id of ['signin', 'challenge', 'profile', 'signout']) show(id, false);
  try {
    const me = await api('account');
    show('profile', true); show('signout', true);
    const capabilities = await api('capabilities'); show('link-google', capabilities.google);
    $('identity').textContent = me.email + (me.emailVerified ? ' · 已驗證 / Verified' : '');
    $('mfa-state').textContent = me.twoFactorEnabled ? '2FA 已啟用 / Authenticator enabled' : '尚未啟用 2FA / Authenticator not enabled';
    show('enroll', !me.twoFactorEnabled); show('disable', me.twoFactorEnabled);
    status('已登入 / Signed in');
  } catch (error) {
    if (error.message === 'MFA_REQUIRED') { show('challenge', true); show('signout', true); status('請完成第二因素驗證 / Complete your second factor'); return; }
    if (error.message !== 'UNAUTHENTICATED') throw error;
    const capabilities = await api('capabilities');
    show('signin', true); show('google', capabilities.google); show('send', capabilities.email);
    status(capabilities.google || capabilities.email ? '歡迎回來 / Welcome' : '帳戶服務尚未啟用；不會發送郵件 / Account service is not configured; no mail will be sent');
  }
}
function action(id, fn, submit = false) {
  $(id).addEventListener(submit ? 'submit' : 'click', async event => {
    event.preventDefault();
    const buttons = [...document.querySelectorAll('button')]; buttons.forEach(b => { b.disabled = true; });
    try { await fn(); } catch (error) { status(error.message); }
    finally { buttons.forEach(b => { b.disabled = false; }); }
  });
}
action('google', async () => { const value = await api('auth/sign-in/social', { provider: 'google' }); const target = new URL(value.url); if (target.origin !== 'https://accounts.google.com') throw new Error('Invalid provider redirect'); location.assign(target.href); });
action('send', async () => { email = $('email').value.trim(); await api('auth/email-otp/send-verification-otp', { email, type: 'sign-in' }); show('otp', true); status('若可送達，驗證碼將於信箱出現；5 分鐘有效 / If deliverable, a code will arrive; valid for 5 minutes'); $('email-code').focus(); }, true);
action('otp', async () => { await api('auth/sign-in/email-otp', { email, otp: $('email-code').value }); clearSecrets(); await refresh(); }, true);
action('factor', async () => { await api('auth/two-factor/' + ($('recovery').checked ? 'verify-backup-code' : 'verify-totp'), { code: $('factor-code').value.trim() }); clearSecrets(); await refresh(); }, true);
action('link-google', async () => { const value = await api('auth/link-social', { provider: 'google' }); const target = new URL(value.url); if (target.origin !== 'https://accounts.google.com') throw new Error('Invalid provider redirect'); location.assign(target.href); });
action('enroll', async () => { const data = await api('auth/two-factor/enable', { method: 'totp' }); const uri = new URL(data.totpURI); if (uri.protocol !== 'otpauth:') throw new Error('Invalid authenticator URI'); $('totp-secret').value = uri.searchParams.get('secret'); $('totp-link').href = uri.href; $('backup-codes').textContent = data.backupCodes.join('\n'); show('enrollment', true); status('請離線保存恢復碼，再輸入驗證器代碼 / Save recovery codes offline, then confirm your authenticator code'); });
action('confirm', async () => { await api('auth/two-factor/verify-totp', { code: $('confirm-code').value }); clearSecrets(); await refresh(); }, true);
action('disable', async () => { if (!confirm('確定停用驗證器？ / Disable your authenticator?')) return; await api('auth/two-factor/disable', {}); clearSecrets(); await refresh(); });
action('signout', async () => { await api('auth/sign-out', {}); clearSecrets(); await refresh(); });
$('theme').addEventListener('change', () => { const [palette,theme] = $('theme').value.split('-'); document.documentElement.dataset.palette = palette; document.documentElement.dataset.theme = theme; });
window.addEventListener('pagehide', clearSecrets);
refresh().catch(() => status('服務暫時不可用 / Service temporarily unavailable'));
