// SPDX-License-Identifier: MIT
import { createServer } from 'node:http';
import { isIP } from 'node:net';
import nodemailer from 'nodemailer';
import { readConfig } from './config.mjs';
import { openDatabase } from './storage.mjs';
import { createApp } from './app.mjs';

const config = readConfig(process.env);
const database = openDatabase(config.databasePath);
database.prepare('SELECT 1 FROM ymzz_assurance LIMIT 1').get();
const mail = config.email ? nodemailer.createTransport(config.smtp) : null;
const app = createApp(config, database, async ({ email, otp }) => {
  if (!mail) throw new Error('Email disabled');
  await mail.sendMail({ from: config.mailFrom, to: email,
    subject: '湛箴_ymzz · 登入驗證碼 / Sign-in code',
    text: `登入驗證碼 / Sign-in code: ${otp}\n5 分鐘內有效、僅可使用一次 / Expires in 5 minutes, one use only.\n若非本人操作，請忽略 / Ignore if you did not request this.` });
});
const server = createServer({ maxHeaderSize: 16384, requestTimeout: 20000, headersTimeout: 10000 }, async (req, res) => {
  try {
    const chunks = []; let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > 16384) { res.writeHead(413); res.end(); return; }
      chunks.push(chunk);
    }
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (value !== undefined && !['x-ymzz-client-ip', 'x-forwarded-for', 'x-real-ip', 'forwarded', 'host'].includes(key)) headers.set(key, Array.isArray(value) ? value.join(', ') : value);
    }
    const remote = req.socket.remoteAddress || 'unknown';
    const loopback = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(remote);
    const proxyIP = req.headers['x-real-ip'];
    const ip = config.trustProxy && loopback && typeof proxyIP === 'string' && isIP(proxyIP) ? proxyIP : remote;
    headers.set('x-ymzz-client-ip', ip);
    const method = req.method || 'GET';
    const request = new Request(config.origin + (req.url?.startsWith('/') ? req.url : '/'), {
      method, headers, ...(['GET','HEAD'].includes(method) ? {} : { body: Buffer.concat(chunks) }),
    });
    const response = await app.fetch(request);
    res.statusCode = response.status;
    for (const [key, value] of response.headers) if (key !== 'set-cookie') res.setHeader(key, value);
    const cookies = response.headers.getSetCookie();
    if (cookies.length) res.setHeader('set-cookie', cookies);
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch {
    console.error(JSON.stringify({ event: 'account_request_failed' }));
    if (!res.headersSent) { res.writeHead(503, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end('{"error":"TEMPORARILY_UNAVAILABLE"}'); }
    else res.end();
  }
});
// Loopback only: TLS termination and single-valued X-Real-IP must be configured at the local reverse proxy.
server.listen(config.port, '127.0.0.1', () => console.log(JSON.stringify({ event: 'account_listening', port: config.port, google: config.google, email: config.email })));
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => {
  server.close(() => { mail?.close(); database.close(); });
});
