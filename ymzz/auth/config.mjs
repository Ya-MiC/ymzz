// SPDX-License-Identifier: MIT
/** Validate deployment configuration without logging secret values. */
export function readConfig(env) {
  const development = env.NODE_ENV === 'development';
  const origin = new URL(env.AUTH_ORIGIN || 'http://localhost:3100');
  if (origin.pathname !== '/' || origin.search || origin.hash || origin.username || origin.password ||
      (!development && origin.protocol !== 'https:') ||
      (origin.protocol === 'http:' && (!development || !['localhost', '127.0.0.1'].includes(origin.hostname)))) {
    throw new Error('AUTH_ORIGIN must be an HTTPS origin (loopback HTTP only in development)');
  }
  if (!env.AUTH_SECRET || env.AUTH_SECRET.length < 32 || /^(example|change|replace)/i.test(env.AUTH_SECRET)) {
    throw new Error('AUTH_SECRET must be an independently generated secret of at least 32 characters');
  }
  const port = Number(env.PORT || 3100);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be an integer between 1 and 65535');
  const mailHourlyLimit = Number(env.MAIL_HOURLY_LIMIT || 100);
  if (!Number.isInteger(mailHourlyLimit) || mailHourlyLimit < 1 || mailHourlyLimit > 10000) throw new Error('MAIL_HOURLY_LIMIT must be between 1 and 10000');
  const google = Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
  if (Boolean(env.GOOGLE_CLIENT_ID) !== Boolean(env.GOOGLE_CLIENT_SECRET)) throw new Error('Google credentials must be configured together');
  const mailKeys = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASSWORD', 'MAIL_FROM'];
  const email = mailKeys.every(k => Boolean(env[k]));
  if (mailKeys.some(k => Boolean(env[k])) && !email) throw new Error('SMTP configuration is incomplete');
  if (email && (!/^[^\r\n]+$/.test(env.MAIL_FROM) || ![465, 587].includes(Number(env.SMTP_PORT || 465)))) throw new Error('Mail requires port 465 or STARTTLS port 587 and a single-line sender');
  if (env.TRUST_PROXY !== undefined && env.TRUST_PROXY !== 'loopback') throw new Error('Only a loopback reverse proxy is supported');
  return { origin: origin.origin, development, secret: env.AUTH_SECRET, google, email,
    googleId: env.GOOGLE_CLIENT_ID, googleSecret: env.GOOGLE_CLIENT_SECRET,
    databasePath: env.AUTH_DATABASE || './data/auth.sqlite', port,
    trustProxy: env.TRUST_PROXY === 'loopback', mailHourlyLimit, smtp: email ? { host: env.SMTP_HOST,
      port: Number(env.SMTP_PORT || 465), secure: Number(env.SMTP_PORT || 465) === 465,
      requireTLS: true, auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD },
      connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000,
      tls: { rejectUnauthorized: true } } : null, mailFrom: env.MAIL_FROM };
}
