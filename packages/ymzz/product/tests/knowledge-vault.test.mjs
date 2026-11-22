// MIT. Vault guard units: path refusal, no overwrite, atomic rename, hash checks,
// trash move and symlink refusal. Synthetic files only; no user Vault is touched.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {
  normalizeRelativePath,
  assertVaultRoot,
  writeNoteAtomic,
  readNote,
  noteExists,
  moveToTrash,
} from '../knowledge-vault.mjs';

const sha = (text) => createHash('sha256').update(text, 'utf8').digest('hex');

function vaultFixture(t) {
  const holder = fs.mkdtempSync(path.join(os.tmpdir(), '湛箴 Vault 空格 '));
  const root = path.join(holder, '我的 倉庫');
  fs.mkdirSync(root);
  t.after(() => fs.rmSync(holder, {recursive: true, force: true}));
  return {holder, root: assertVaultRoot(root)};
}

test('relative note paths stay under the ymzz knowledge root', () => {
  assert.equal(normalizeRelativePath('ymzz/2026/11/標籤 筆記.md'), 'ymzz/2026/11/標籤 筆記.md');
  assert.equal(normalizeRelativePath('ymzz/notes/a.b-c_d(1).md'), 'ymzz/notes/a.b-c_d(1).md');
  for (const bad of [
    '',
    '/absolute.md',
    'C:/absolute.md',
    'ymzz/../escape.md',
    'ymzz/2026/../../x.md',
    'ymzz\\win.md',
    'ymzz/nul\u0000.md',
    'ymzz/.obsidian/app.md',
    'ymzz/.hidden/a.md',
    'ymzz/a.txt',
    'ymzz/con.md',
    'ymzz/note.md ',
    'ymzz/.md',
    'other/note.md',
    'note.md',
  ]) {
    assert.throws(() => normalizeRelativePath(bad), /PATH|MARKDOWN/u, `must reject ${JSON.stringify(bad)}`);
  }
});

test('Vault root must be an existing, non-symlinked directory below the filesystem root', (t) => {
  const {holder, root} = vaultFixture(t);
  assert.equal(assertVaultRoot(root), fs.realpathSync.native(root));
  assert.throws(() => assertVaultRoot(path.join(holder, 'missing')), /VAULT_NOT_FOUND/);
  const file = path.join(holder, 'file.txt');
  fs.writeFileSync(file, 'x');
  assert.throws(() => assertVaultRoot(file), /VAULT_INVALID/);
  assert.throws(() => assertVaultRoot('relative/dir'), /VAULT_INVALID/);
  assert.throws(() => assertVaultRoot(path.parse(root).root), /VAULT_ROOT_FORBIDDEN/);
  const link = path.join(holder, 'link');
  try {
    fs.symlinkSync(root, link, process.platform === 'win32' ? 'junction' : 'dir');
  } catch (error) {
    t.skip(`symlink unavailable: ${error.code}`);
    return;
  }
  assert.throws(() => assertVaultRoot(link), /VAULT_SYMLINK_FORBIDDEN/);
});

test('atomic write creates exactly the approved bytes in a Chinese/space path', (t) => {
  const {root} = vaultFixture(t);
  const text = '---\ntitle: "甲"\n---\n\n# 甲\n\n## 来源\n\n- 手工记录\n';
  const hash = sha(text);
  const written = writeNoteAtomic(root, 'ymzz/2026/11/甲 筆記.md', text, {expectedSha256: hash});
  assert.equal(written.sha256, hash);
  const onDisk = fs.readFileSync(path.join(root, 'ymzz', '2026', '11', '甲 筆記.md'), 'utf8');
  assert.equal(onDisk, text);
  assert.equal(sha(onDisk), hash);
  const entries = fs.readdirSync(path.join(root, 'ymzz', '2026', '11'));
  assert.deepEqual(entries, ['甲 筆記.md'], 'no temporary file remains');
  assert.equal(noteExists(root, 'ymzz/2026/11/甲 筆記.md'), true);
  assert.equal(noteExists(root, 'ymzz/2026/11/不存在.md'), false);
  const read = readNote(root, 'ymzz/2026/11/甲 筆記.md');
  assert.equal(read.text, text);
  assert.equal(read.sha256, hash);
});

test('write refuses overwrite, wrong hash and any temp leakage', (t) => {
  const {root} = vaultFixture(t);
  const text = 'original\n';
  writeNoteAtomic(root, 'ymzz/note.md', text, {expectedSha256: sha(text)});
  assert.throws(
    () => writeNoteAtomic(root, 'ymzz/note.md', 'other\n', {expectedSha256: sha('other\n')}),
    /TARGET_EXISTS/,
  );
  assert.equal(fs.readFileSync(path.join(root, 'ymzz', 'note.md'), 'utf8'), text);
  assert.throws(() => writeNoteAtomic(root, 'ymzz/second.md', 'body\n', {expectedSha256: 'f'.repeat(64)}), /NOTE_HASH_MISMATCH/);
  assert.equal(fs.existsSync(path.join(root, 'ymzz', 'second.md')), false);
  assert.deepEqual(fs.readdirSync(path.join(root, 'ymzz')).sort(), ['note.md']);
});

test('reads reject oversized or non-UTF8 content and symlinked segments', (t) => {
  const {root, holder} = vaultFixture(t);
  fs.mkdirSync(path.join(root, 'ymzz'));
  fs.writeFileSync(path.join(root, 'ymzz', 'big.md'), 'x'.repeat(70000));
  assert.throws(() => readNote(root, 'ymzz/big.md'), /NOTE_TOO_LARGE/);
  fs.writeFileSync(path.join(root, 'ymzz', 'bad.md'), Buffer.from([0xff, 0xfe]));
  assert.throws(() => readNote(root, 'ymzz/bad.md'), /TEXT|UTF/u);
  const outside = path.join(holder, 'outside');
  fs.mkdirSync(outside);
  const junction = path.join(root, 'ymzz', 'linked');
  try {
    fs.symlinkSync(outside, junction, process.platform === 'win32' ? 'junction' : 'dir');
  } catch (error) {
    t.skip(`symlink unavailable: ${error.code}`);
    return;
  }
  assert.throws(
    () => writeNoteAtomic(root, 'ymzz/linked/x.md', 'body\n', {expectedSha256: sha('body\n')}),
    /SYMLINK_FORBIDDEN/,
  );
  assert.equal(fs.existsSync(path.join(outside, 'x.md')), false);
});

test('trash move verifies the current hash and never deletes changed bytes', (t) => {
  const {root, holder} = vaultFixture(t);
  const trashDir = path.join(holder, '資料 home', 'knowledge-trash');
  const text = 'keep me\n';
  writeNoteAtomic(root, 'ymzz/note.md', text, {expectedSha256: sha(text)});
  const file = path.join(root, 'ymzz', 'note.md');
  fs.appendFileSync(file, 'external edit\n');
  const changed = fs.readFileSync(file, 'utf8');
  assert.throws(
    () => moveToTrash({root, relative: 'ymzz/note.md', trashDir, expectedSha256: sha(text)}),
    /NOTE_CHANGED_EXTERNALLY/,
  );
  assert.equal(fs.readFileSync(file, 'utf8'), changed);
  const moved = moveToTrash({root, relative: 'ymzz/note.md', trashDir, expectedSha256: sha(changed)});
  assert.ok(fs.existsSync(moved.trashPath));
  assert.equal(fs.readFileSync(moved.trashPath, 'utf8'), changed);
  assert.equal(fs.existsSync(file), false);
  assert.ok(moved.trashPath.startsWith(trashDir));
});
