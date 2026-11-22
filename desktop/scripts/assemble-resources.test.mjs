// MIT. Regression harness for assemble-resources.mjs — zero network, zero
// upstream build needed. Asserts the fail-closed contracts that the desktop
// canary depends on: target whitelist, SHASUMS verification, tree copying that
// never clobbers, backend completeness. Run with:
//   node --test desktop/scripts/assemble-resources.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {targetPlatform, nodeArchiveName, verifySha256, copyTree, mergeTree, assertBackendComplete} from './assemble-resources.mjs';

test('target platform whitelist accepts only upstream-supported targets', () => {
  assert.deepEqual(targetPlatform('win-x64'), {platform: 'win32', arch: 'x64'});
  assert.deepEqual(targetPlatform('mac-arm64'), {platform: 'darwin', arch: 'arm64'});
  assert.deepEqual(targetPlatform('mac-x64'), {platform: 'darwin', arch: 'x64'});
  // The upstream desktop chain has no Linux target; the assembler must refuse
  // instead of assembling a runtime that could never start.
  assert.throws(() => targetPlatform('linux-x64'), /unsupported upstream target/);
  assert.throws(() => targetPlatform(''), /unsupported upstream target/);
  assert.throws(() => targetPlatform('win-arm64'), /unsupported upstream target/);
});

test('node archive names follow the official nodejs.org dist convention', () => {
  assert.equal(nodeArchiveName('win32', 'x64'), 'node-v22.14.0-win-x64.zip');
  assert.equal(nodeArchiveName('darwin', 'arm64'), 'node-v22.14.0-darwin-arm64.tar.gz');
  assert.equal(nodeArchiveName('darwin', 'x64'), 'node-v22.14.0-darwin-x64.tar.gz');
});

test('verifySha256 fails closed on empty, missing or mismatched SHASUMS lines', () => {
  const bytes = Buffer.from('payload');
  const good = createHash('sha256').update(bytes).digest('hex');
  const file = 'node-v22.14.0-win-x64.zip';
  // Correct hash passes.
  verifySha256(bytes, file, `${good}  ${file}\n`);
  // Wrong hash is rejected with both values in the message.
  assert.throws(
    () => verifySha256(bytes, file, `${'0'.repeat(64)}  ${file}\n`),
    /SHA256 mismatch for node-v22.14.0-win-x64\.zip/,
  );
  // File absent from the manifest is rejected (empty and unrelated manifests).
  assert.throws(() => verifySha256(bytes, file, ''), /absent from the official SHASUMS256/);
  assert.throws(() => verifySha256(bytes, file, `${good}  other-file.zip\n`), /absent from the official SHASUMS256/);
  // A truncated hash line (partial download of SHASUMS itself) is rejected.
  assert.throws(() => verifySha256(bytes, file, `${good.slice(0, 32)}  ${file}\n`), /SHA256 mismatch/);
});

test('copyTree copies and never keeps stale destination files', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ymzz-assemble-copy '));
  try {
    const source = path.join(root, 'src');
    const destination = path.join(root, 'dst');
    fs.mkdirSync(path.join(source, 'bin'), {recursive: true});
    fs.writeFileSync(path.join(source, 'bin', 'node.exe'), 'runtime');
    fs.mkdirSync(destination, {recursive: true});
    fs.writeFileSync(path.join(destination, 'stale.txt'), 'old');
    copyTree(source, destination, 'node runtime');
    assert.equal(fs.readFileSync(path.join(destination, 'bin', 'node.exe'), 'utf8'), 'runtime');
    assert.equal(fs.existsSync(path.join(destination, 'stale.txt')), false, 'stale file must be removed');
  } finally {
    fs.rmSync(root, {recursive: true, force: true});
  }
});

test('mergeTree merges without clobbering existing bytes and fails closed on missing source', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ymzz-assemble-merge '));
  try {
    // The harness-caught bug: copying the DSH tree over backend must not wipe
    // the node runtime that was placed there first.
    const backend = path.join(root, 'backend');
    fs.mkdirSync(path.join(backend, 'dependencies', 'node', 'bin'), {recursive: true});
    fs.writeFileSync(path.join(backend, 'dependencies', 'node', 'bin', 'node.exe'), 'runtime-bytes');
    const dsh = path.join(root, 'dsh');
    fs.mkdirSync(path.join(dsh, 'node_modules', '@ymzz', 'dsh-product'), {recursive: true});
    fs.writeFileSync(path.join(dsh, 'package.json'), '{"name":"dsh"}');
    fs.writeFileSync(path.join(dsh, 'node_modules', '@ymzz', 'dsh-product', 'package.json'), '{"name":"@ymzz/dsh-product"}');
    mergeTree(dsh, backend, 'DSH runtime');
    assert.equal(fs.readFileSync(path.join(backend, 'dependencies', 'node', 'bin', 'node.exe'), 'utf8'), 'runtime-bytes');
    assert.equal(fs.readFileSync(path.join(backend, 'package.json'), 'utf8'), '{"name":"dsh"}');
    assert.equal(fs.readFileSync(path.join(backend, 'node_modules', '@ymzz', 'dsh-product', 'package.json'), 'utf8'), '{"name":"@ymzz/dsh-product"}');
    // A missing source must fail closed, not produce an empty backend.
    assert.throws(
      () => mergeTree(path.join(root, 'missing'), backend, 'DSH runtime'),
      /DSH runtime source .* does not exist\. Run desktop\/scripts\/prepare-upstream-runtime\.mjs first/u,
    );
  } finally {
    fs.rmSync(root, {recursive: true, force: true});
  }
});

test('assertBackendComplete lists every missing payload and points at the packer', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ymzz-assemble-guard '));
  try {
    const backend = path.join(root, 'backend');
    fs.mkdirSync(path.join(backend, 'dependencies', 'node', 'bin'), {recursive: true});
    // Empty backend: all required payloads are reported, and the error names
    // the upstream pack step so the failure is actionable.
    assert.throws(() => assertBackendComplete(backend), (error) => {
      assert.match(error.message, /assembled backend is missing/u);
      assert.match(error.message, /node_modules\/@deepseek-ai\/dsh\/lib\/bin\.js/u);
      assert.match(error.message, /node_modules\/@ymzz\/dsh-product\/package\.json/u);
      assert.match(error.message, /pack-local-packages/u);
      return true;
    });
    // Complete backend passes (all four REQUIRED_BACKEND_FILES present).
    fs.mkdirSync(path.join(backend, 'node_modules', '@ymzz', 'dsh-product'), {recursive: true});
    fs.writeFileSync(path.join(backend, 'node_modules', '@ymzz', 'dsh-product', 'package.json'), '{}');
    const cliDir = path.join(backend, 'node_modules', '@deepseek-ai', 'dsh', 'lib');
    fs.mkdirSync(cliDir, {recursive: true});
    fs.writeFileSync(path.join(cliDir, 'bin.js'), 'entry');
    fs.writeFileSync(path.join(backend, 'node_modules', '@deepseek-ai', 'dsh', 'package.json'), '{}');
    fs.writeFileSync(path.join(backend, 'package.json'), '{}');
    assert.doesNotThrow(() => assertBackendComplete(backend));
  } finally {
    fs.rmSync(root, {recursive: true, force: true});
  }
});
