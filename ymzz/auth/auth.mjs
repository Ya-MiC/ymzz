// SPDX-License-Identifier: MIT
import { betterAuth } from 'better-auth';
import { verifyGoogleIdToken } from 'better-auth/social-providers';
import { emailOTP, twoFactor } from 'better-auth/plugins';
import { getMigrations } from 'better-auth/db/migration';

/** Create the maintained auth provider; mail delivery is awaited and never logged. */
export function createAuth(config, database, sendOTP) {
  return betterAuth({
    appName: '湛箴_ymzz', baseURL: config.origin, secret: config.secret, database,
    trustedOrigins: [config.origin],
    emailAndPassword: { enabled: false },
    socialProviders: config.google ? { google: {
      clientId: config.googleId, clientSecret: config.googleSecret,
      prompt: 'select_account', accessType: 'online', includeGrantedScopes: false,
      // Pin explicit signature/issuer/audience/expiry validation on the code-flow profile path too.
      async getUserInfo(tokens) {
        if (!tokens.idToken) return null;
        const claims = await verifyGoogleIdToken({ token: tokens.idToken, audience: config.googleId, nonce: tokens.expectedIdTokenNonce });
        if (!claims || claims.email_verified !== true || typeof claims.email !== 'string' || typeof claims.sub !== 'string') return null;
        return { user: { id: claims.sub, name: typeof claims.name === 'string' ? claims.name : claims.email,
          email: claims.email, emailVerified: true }, data: claims };
      },
    } } : {},
    account: { accountLinking: { enabled: true, disableImplicitLinking: true, allowDifferentEmails: false }, encryptOAuthTokens: true, storeStateStrategy: 'database' },
    session: { expiresIn: 43200, updateAge: 1800, freshAge: 300, cookieCache: { enabled: false } },
    advanced: { useSecureCookies: !config.development, cookiePrefix: 'ymzz',
      defaultCookieAttributes: { httpOnly: true, sameSite: 'lax', secure: !config.development },
      ipAddress: { ipAddressHeaders: ['x-ymzz-client-ip'] } },
    rateLimit: { enabled: true, storage: 'database', window: 60, max: 40,
      customRules: { '/email-otp/send-verification-otp': { window: 60, max: 3 },
        '/sign-in/email-otp': { window: 60, max: 5 } } },
    logger: { disabled: true },
    plugins: [
      ...(config.email ? [emailOTP({ otpLength: 6, expiresIn: 300, allowedAttempts: 5,
        storeOTP: 'hashed', sendVerificationOTP: sendOTP })] : []),
      twoFactor({ issuer: '湛箴_ymzz', allowPasswordless: true,
        backupCodeOptions: { amount: 10, storeBackupCodes: 'encrypted' } }),
    ],
  });
}

/** Run additive provider migrations; the caller must back up an existing database first. */
export async function migrate(auth, database) {
  const migrations = await getMigrations(auth.options);
  await migrations.runMigrations();
  database.exec(`CREATE TABLE IF NOT EXISTS ymzz_assurance (
    sessionId TEXT PRIMARY KEY REFERENCES session(id) ON DELETE CASCADE,
    userId TEXT NOT NULL, expiresAt INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS ymzz_limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, until INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS ymzz_used_totp (key TEXT PRIMARY KEY, until INTEGER NOT NULL);`);
}
