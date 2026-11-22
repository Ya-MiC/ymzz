// MIT. Bounded Obsidian Vault file guard. NOT an OS sandbox: it refuses unsafe
// names, symlinks, overwrites and escapes, and it never follows a link target.
import fs from 'node:fs';
import path from 'node:path';
import {randomUUID, createHash} from 'node:crypto';
import {assert} from './guard.mjs';
import {KNOWLEDGE_ROOT_SEGMENT} from './obsidian-markdown.mjs';

const key = (value) => (process.platform === 'win32' ? value.toLowerCase() : value);
const sha256 = (buffer) => createHash('sha256').update(buffer).digest('hex');
const RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i;
const SEGMENT = /^[\p{L}\p{N}\p{M}][\p{L}\p{N}\p{M} _.\-()（）]*$/u;
const CONTROL = /[\u0000-\u001f\u007f]/u;
export const NOTE_MAX_BYTES = 65536;

/**
 * Validate and normalise a Vault-relative note path.
 * Rejects absolute paths, `..`, backslashes, NUL/control characters, hidden
 * segments (including `.obsidian`), Windows device names, and escapes from the
 * knowledge root.
 * @param {unknown} input - candidate relative path.
 * @returns {string} normalised relative path using `/` separators.
 */
export function normalizeRelativePath(input) {
  assert(typeof input === 'string', 'PATH_INVALID');
  assert(input.length > 0 && input.length <= 200, 'PATH_INVALID');
  assert(!CONTROL.test(input), 'PATH_INVALID');
  assert(!input.includes('\\'), 'PATH_INVALID');
  assert(!input.startsWith('/') && !/^[a-zA-Z]:/u.test(input), 'PATH_INVALID');
  const parts = input.split('/');
  assert(parts.length >= 2, 'PATH_INVALID');
  assert(parts[0] === KNOWLEDGE_ROOT_SEGMENT, 'PATH_OUTSIDE_KNOWLEDGE_ROOT');
  for (const part of parts) {
    assert(part.length > 0 && part.length <= 80, 'PATH_INVALID');
    assert(part !== '.' && part !== '..', 'PATH_INVALID');
    assert(!part.startsWith('.'), 'PATH_HIDDEN_FORBIDDEN');
    assert(part.toLowerCase() !== '.obsidian', 'PATH_HIDDEN_FORBIDDEN');
    assert(!/[. ]$/u.test(part), 'PATH_INVALID');
    assert(!RESERVED.test(part), 'PATH_INVALID');
    assert(SEGMENT.test(part), 'PATH_INVALID');
  }
  assert(/\.md$/iu.test(parts[parts.length - 1]), 'MARKDOWN_REQUIRED');
  return parts.join('/');
}

/**
 * Validate a Vault root directory and return its real path.
 * The root itself must not be a symbolic link and must not be a filesystem root.
 * @param {unknown} directory - absolute directory path.
 * @returns {string} resolved absolute Vault root.
 */
export function assertVaultRoot(directory) {
  assert(typeof directory === 'string' && directory.length > 0 && directory.length <= 240, 'VAULT_INVALID');
  assert(!CONTROL.test(directory), 'VAULT_INVALID');
  assert(path.isAbsolute(directory), 'VAULT_INVALID');
  assert(!directory.startsWith('\\\\'), 'VAULT_INVALID');
  assert(!directory.split(/[\\/]/u).includes('..'), 'VAULT_INVALID');
  let stat;
  try {
    stat = fs.lstatSync(directory);
  } catch {
    throw new Error('VAULT_NOT_FOUND');
  }
  assert(!stat.isSymbolicLink(), 'VAULT_SYMLINK_FORBIDDEN');
  assert(stat.isDirectory(), 'VAULT_INVALID');
  const real = fs.realpathSync.native(directory);
  assert(key(real) !== key(path.parse(real).root), 'VAULT_ROOT_FORBIDDEN');
  return real;
}

/** Walk to an existing parent directory without following symlinked segments. */
function existingDirectory(root, segments, {create = false} = {}) {
  let current = root;
  for (const segment of segments) {
    current = path.join(current, segment);
    if (fs.existsSync(current)) {
      const stat = fs.lstatSync(current);
      assert(!stat.isSymbolicLink(), 'SYMLINK_FORBIDDEN');
      assert(stat.isDirectory(), 'PATH_TYPE_FORBIDDEN');
    } else {
      assert(create, 'PATH_NOT_FOUND');
      fs.mkdirSync(current, {mode: 0o700});
    }
    const real = fs.realpathSync.native(current);
    assert(key(real).startsWith(key(root) + path.sep), 'PATH_ESCAPE');
  }
  return current;
}

/** Resolve a note path to its absolute location, refusing links and escapes. */
function locate(root, relative, {mustExist = false} = {}) {
  const parts = normalizeRelativePath(relative).split('/');
  const fileName = parts.pop();
  const directory = existingDirectory(root, parts);
  const full = path.join(directory, fileName);
  if (!fs.existsSync(full)) {
    assert(!mustExist, 'NOTE_NOT_FOUND');
    return {full, exists: false};
  }
  const stat = fs.lstatSync(full);
  assert(!stat.isSymbolicLink(), 'SYMLINK_FORBIDDEN');
  assert(stat.isFile(), 'PATH_TYPE_FORBIDDEN');
  assert(stat.nlink === 1, 'HARDLINK_FORBIDDEN');
  const real = fs.realpathSync.native(full);
  assert(key(real).startsWith(key(root) + path.sep), 'PATH_ESCAPE');
  return {full: real, exists: true};
}

/**
 * Report whether a note file exists in the Vault without reading its body.
 * @param {string} root - resolved Vault root.
 * @param {string} relative - normalised relative note path.
 * @returns {boolean} true when a regular, singly-linked file is present.
 */
export function noteExists(root, relative) {
  try {
    return locate(root, relative).exists;
  } catch {
    return false;
  }
}

/**
 * Read one bounded, UTF-8 note from the Vault.
 * @param {string} root - resolved Vault root.
 * @param {string} relative - normalised relative note path.
 * @param {{maxBytes?: number}} [options] - size ceiling.
 * @returns {{text: string, sha256: string, byteLength: number, absolutePath: string}} note body.
 */
export function readNote(root, relative, {maxBytes = NOTE_MAX_BYTES} = {}) {
  const {full} = locate(root, relative, {mustExist: true});
  const before = fs.lstatSync(full);
  assert(before.size <= maxBytes, 'NOTE_TOO_LARGE');
  const fd = fs.openSync(full, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
  try {
    const opened = fs.fstatSync(fd);
    assert(opened.ino === before.ino && opened.dev === before.dev && opened.nlink === 1, 'NOTE_CHANGED');
    const buffer = Buffer.alloc(maxBytes + 1);
    let length = 0;
    let chunk = 0;
    while (length < buffer.length && (chunk = fs.readSync(fd, buffer, length, buffer.length - length, length)) > 0) {
      length += chunk;
    }
    assert(length <= maxBytes, 'NOTE_TOO_LARGE');
    const bytes = buffer.subarray(0, length);
    assert(!bytes.includes(0), 'TEXT_FILE_REQUIRED');
    let text;
    try {
      text = new TextDecoder('utf-8', {fatal: true, ignoreBOM: true}).decode(bytes);
    } catch {
      throw new Error('TEXT_FILE_REQUIRED');
    }
    return {text, sha256: sha256(bytes), byteLength: length, absolutePath: full};
  } finally {
    fs.closeSync(fd);
  }
}

/**
 * Publish the verified temp file without ever clobbering the destination.
 * `linkSync` is atomic: if the target appeared between the earlier existence
 * check and this call — a second Host instance, or a sync client (Syncthing /
 * OneDrive / iCloud) restoring the file — it fails with EEXIST and the user's
 * file is left untouched. Filesystems without hard-link support (exFAT, some
 * network mounts) fall back to `COPYFILE_EXCL`, which is still an exclusive
 * create and can never overwrite.
 * @param {string} tempPath - verified temporary file, same directory.
 * @param {string} finalPath - note path that must not be overwritten.
 */
function placeTempAtomically(tempPath, finalPath) {
  try {
    fs.linkSync(tempPath, finalPath);
    return;
  } catch (error) {
    if (error && error.code === 'EEXIST') throw new Error('TARGET_EXISTS');
    if (!error || !['EPERM', 'ENOTSUP', 'EOPNOTSUPP', 'EXDEV'].includes(error.code)) throw error;
    if (fs.existsSync(finalPath)) throw new Error('TARGET_EXISTS');
  }
  try {
    fs.copyFileSync(tempPath, finalPath, fs.constants.COPYFILE_EXCL);
  } catch (error) {
    throw error && error.code === 'EEXIST' ? new Error('TARGET_EXISTS') : error;
  }
}

/**
 * Create a note without ever overwriting an existing file. Writes through a
 * same-directory temporary file, verifies the bytes, then publishes it with an
 * exclusive atomic link (see {@link placeTempAtomically}).
 * @param {string} root - resolved Vault root.
 * @param {string} relative - normalised relative note path.
 * @param {string} text - rendered Markdown.
 * @param {{expectedSha256: string}} options - the approved content hash.
 * @returns {{relativePath: string, absolutePath: string, sha256: string, byteLength: number}} written note.
 */
export function writeNoteAtomic(root, relative, text, {expectedSha256} = {}) {
  assert(typeof text === 'string' && text.length > 0, 'NOTE_TEXT_REQUIRED');
  assert(typeof expectedSha256 === 'string' && /^[0-9a-f]{64}$/u.test(expectedSha256), 'EXPECTED_HASH_REQUIRED');
  assert(sha256(Buffer.from(text, 'utf8')) === expectedSha256, 'NOTE_HASH_MISMATCH');
  const normalized = normalizeRelativePath(relative);
  const parts = normalized.split('/');
  const fileName = parts.pop();
  const directory = existingDirectory(root, parts, {create: true});
  const finalPath = path.join(directory, fileName);
  assert(!fs.existsSync(finalPath), 'TARGET_EXISTS');
  const tempPath = path.join(directory, `.${fileName}.${randomUUID()}.tmp`);
  let fd;
  try {
    fd = fs.openSync(tempPath, fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_WRONLY, 0o600);
    fs.writeFileSync(fd, text);
    fs.fsyncSync(fd);
    fs.closeSync(fd);
    fd = undefined;
    const written = fs.readFileSync(tempPath);
    assert(sha256(written) === expectedSha256, 'TEMP_HASH_MISMATCH');
    placeTempAtomically(tempPath, finalPath);
    try {
      fs.unlinkSync(tempPath);
    } catch {}
  } catch (error) {
    if (fd !== undefined) {
      try {
        fs.closeSync(fd);
      } catch {}
    }
    try {
      fs.unlinkSync(tempPath);
    } catch {}
    throw error;
  }
  const after = fs.readFileSync(finalPath);
  assert(sha256(after) === expectedSha256, 'WRITE_VERIFY_FAILED');
  try {
    const dirFd = fs.openSync(directory, fs.constants.O_RDONLY);
    try {
      fs.fsyncSync(dirFd);
    } finally {
      fs.closeSync(dirFd);
    }
  } catch {}
  return {relativePath: normalized, absolutePath: finalPath, sha256: expectedSha256, byteLength: after.byteLength};
}

/**
 * Move a still-unchanged note into the plugin-owned trash directory. Never
 * deletes bytes: an external modification makes the move fail closed.
 * @param {{root: string, relative: string, trashDir: string, expectedSha256: string, now?: Date}} options - move request.
 * @returns {{trashPath: string, sha256: string}} trashed file location.
 */
export function moveToTrash({root, relative, trashDir, expectedSha256, now = new Date()}) {
  const current = readNote(root, relative);
  assert(current.sha256 === expectedSha256, 'NOTE_CHANGED_EXTERNALLY');
  fs.mkdirSync(trashDir, {recursive: true, mode: 0o700});
  const stamp = now.toISOString().replace(/[:.]/gu, '-');
  const target = path.join(trashDir, `${stamp}-${path.basename(current.absolutePath)}`);
  assert(!fs.existsSync(target), 'TRASH_TARGET_EXISTS');
  try {
    fs.renameSync(current.absolutePath, target);
  } catch (error) {
    if (error && error.code !== 'EXDEV') throw error;
    fs.copyFileSync(current.absolutePath, target, fs.constants.COPYFILE_EXCL);
    const copied = fs.readFileSync(target);
    assert(sha256(copied) === expectedSha256, 'TRASH_COPY_MISMATCH');
    fs.unlinkSync(current.absolutePath);
  }
  const moved = fs.readFileSync(target);
  assert(sha256(moved) === expectedSha256, 'TRASH_VERIFY_FAILED');
  return {trashPath: target, sha256: expectedSha256};
}
