// MIT. Shared atomic JSON ledger for plugin-owned state files. Same-directory
// temporary file + rename, `0600`, and a visible backup when a file is corrupt.
import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {assert} from './guard.mjs';

/**
 * Read one versioned JSON ledger.
 * A corrupt or wrong-version file is renamed to `<file>.corrupt-<time>` and an
 * empty result is returned, so a damaged profile degrades instead of crashing
 * and no bytes are silently discarded.
 * @param {string} filePath - absolute ledger path.
 * @param {{version: number, validate?: (parsed: object) => void, recoverCorrupt?: boolean}} options - expected shape.
 * @returns {{state: object|null, recoveredFrom: string|null}} parsed state or `null` when absent.
 */
export function readLedgerJson(filePath, {version, validate, recoverCorrupt = true} = {}) {
  assert(typeof filePath === 'string' && path.isAbsolute(filePath), 'LEDGER_PATH_INVALID');
  if (!fs.existsSync(filePath)) return {state: null, recoveredFrom: null};
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    assert(parsed && typeof parsed === 'object' && !Array.isArray(parsed), 'LEDGER_INVALID');
    assert(parsed.version === version, 'LEDGER_VERSION');
    if (typeof validate === 'function') validate(parsed);
    return {state: parsed, recoveredFrom: null};
  } catch (error) {
    if (!recoverCorrupt) throw error;
    const backup = `${filePath}.corrupt-${new Date().toISOString().replace(/[:.]/gu, '-')}`;
    fs.renameSync(filePath, backup);
    return {state: null, recoveredFrom: backup};
  }
}

/**
 * Persist one JSON ledger atomically: write a same-directory temp file, then
 * rename over the target. The temporary name is unique per call.
 * @param {string} filePath - absolute ledger path.
 * @param {object} state - JSON-serialisable state.
 * @returns {void}
 */
export function writeLedgerJson(filePath, state) {
  assert(typeof filePath === 'string' && path.isAbsolute(filePath), 'LEDGER_PATH_INVALID');
  assert(state && typeof state === 'object', 'LEDGER_STATE_INVALID');
  fs.mkdirSync(path.dirname(filePath), {recursive: true, mode: 0o700});
  const temp = `${filePath}.${randomUUID()}.tmp`;
  try {
    fs.writeFileSync(temp, JSON.stringify(state), {mode: 0o600});
    fs.renameSync(temp, filePath);
  } catch (error) {
    try {
      fs.unlinkSync(temp);
    } catch {}
    throw error;
  }
}
