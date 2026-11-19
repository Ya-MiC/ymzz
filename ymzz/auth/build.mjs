// SPDX-License-Identifier: MIT
import { mkdir, copyFile, cp } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
const root = new URL('./', import.meta.url);
for (const file of ['app.mjs', 'auth.mjs', 'config.mjs', 'server.mjs', 'storage.mjs', 'migrate.mjs', 'public/account.js']) {
  execFileSync(process.execPath, ['--check', new URL(file, root).pathname], { stdio: 'inherit' });
}
await mkdir(new URL('dist/', root), { recursive: true });
for (const file of ['account.html', 'account.js', 'account.css']) await copyFile(new URL('public/'+file, root), new URL('dist/'+file, root));
for (const file of ['style.css', 'favicon.svg']) await copyFile(new URL('../site/'+file, root), new URL('dist/'+file, root));
await cp(new URL('../site/fonts/', root), new URL('dist/fonts/', root), { recursive: true });
await mkdir(new URL('dist/licenses/', root), { recursive: true });
for (const file of ['Fraunces-OFL.txt', 'Inter-OFL.txt', 'JetBrains-Mono-OFL.txt']) await copyFile(new URL('../site/licenses/'+file, root), new URL('dist/licenses/'+file, root));
console.log('Account site built using the official Wenrun design tokens and local fonts.');
