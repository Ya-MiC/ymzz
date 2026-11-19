// SPDX-License-Identifier: MIT
import { readConfig } from './config.mjs';
import { createAuth, migrate } from './auth.mjs';
import { openDatabase } from './storage.mjs';
const config = readConfig(process.env);
const database = openDatabase(config.databasePath);
try {
  await migrate(createAuth(config, database, async () => { throw new Error('Mail unavailable during migration'); }), database);
  console.log('Account database migrations complete.');
} finally { database.close(); }
