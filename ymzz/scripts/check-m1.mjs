// MIT. Actual staged-source preservation/identity checks, not an app/build/inference test.
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { ICON_TARGETS, SOURCE_SHA256 } from '../branding/apply-branding.mjs'

const root = path.resolve(import.meta.dirname, '../..')
const baseline = '39163dd30f703a79079e2d2446545cff3c453738'
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 })
const entries = new Map(git('ls-tree', '-r', '-z', baseline).split('\0').filter(Boolean).map((s) => {
  const m = s.match(/^(\d+) blob ([a-f0-9]+)\t([\s\S]+)$/)
  assert.ok(m, 'Unexpected upstream entry')
  return [m[3], { mode: m[1], oid: m[2] }]
}))
const staged = new Map(git('ls-files', '--stage', '-z').split('\0').filter(Boolean).map((s) => {
  const m = s.match(/^(\d+) ([a-f0-9]+) 0\t([\s\S]+)$/)
  assert.ok(m, 'Unmerged index')
  return [m[3], { mode: m[1], oid: m[2] }]
}))
const allowedModifiedUpstream = new Set(['README.md', '.gitattributes', ...ICON_TARGETS.map((target) => target.path)])
let exact = 0
let symlinks = 0
let iconResourcesReplaced = 0
for (const [rel, original] of entries) {
  assert.ok(staged.has(rel), 'UPSTREAM_FILE_REMOVED: ' + rel)
  if (['README.md', '.gitattributes'].includes(rel)) continue
  if (ICON_TARGETS.some((target) => target.path === rel)) {
    assert.notDeepEqual(staged.get(rel), original, 'ICON_TARGET_STILL_UPSTREAM: ' + rel)
    iconResourcesReplaced++
    continue
  }
  assert.deepEqual(staged.get(rel), original, 'UNAPPROVED_UPSTREAM_CHANGE: ' + rel)
  exact++
  if (original.mode === '120000') symlinks++
}
const attrs = fs.readFileSync(path.join(root, '.gitattributes'), 'utf8')
assert.equal(attrs, git('show', baseline + ':.gitattributes') + 'README.md merge=ours\n')
assert.equal(fs.readFileSync(path.join(root, 'ymzz/docs/upstream/README.md'), 'utf8'), git('show', baseline + ':README.md'))
const allowed = new Set(['README.md', '.gitattributes', 'README.zh-Hant.md', 'NOTICE.md', 'ROADMAP.md'])
for (const rel of staged.keys()) {
  if (!entries.has(rel)) assert.ok(allowed.has(rel) || rel.startsWith('ymzz/') || rel.startsWith('packages/ymzz/'), 'UNAPPROVED_NEW_ROOT_PATH: ' + rel)
}
assert.equal(git('branch', '--show-current').trim(), 'master')
assert.equal(git('config', '--local', 'merge.ours.driver').trim(), 'true')
assert.equal(git('remote', 'get-url', 'origin').trim(), 'https://github.com/Ya-MiC/ymzz.git')
assert.equal(git('remote', 'get-url', 'upstream').trim(), 'https://github.com/deepseek-ai/deepseek-harness.git')
const brand = JSON.parse(fs.readFileSync(path.join(root, 'ymzz/branding/brand.json')))
assert.equal(brand.displayName, '湛箴_ymzz')
assert.equal(brand.meaning, '深淵的清澈的水，纂刻于竹篾上的痕，珍重微小，有所依據，立傳傳世')
assert.equal(brand.applicationBrandingApplied, false)
assert.equal(brand.icon.source, 'icon.svg')
assert.equal(brand.icon.appliedToDocumentedResources, true)
assert.equal(brand.icon.packagedWindowsVerified, false)
const icon = fs.readFileSync(path.join(root, 'ymzz/branding', brand.icon.source))
assert.equal(createHash('sha256').update(icon).digest('hex'), SOURCE_SHA256)
assert.equal(brand.icon.sha256, SOURCE_SHA256)
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json')))
assert.equal(pkg.packageManager, 'pnpm@11.28.5')
assert.equal(JSON.parse(fs.readFileSync(path.join(root, 'ymzz/skills/core-skills.lock.json'))).skills.length, 0)
for (const file of ['README.md', 'README.zh-Hant.md']) {
  const text = fs.readFileSync(path.join(root, file), 'utf8')
  assert.ok(text.includes('v0.1.0 發佈後填 Release 連結'))
  assert.ok(text.includes('pnpm run build:artifacts'))
  assert.ok(text.includes('3081'))
}
console.log(JSON.stringify({
  milestone: 'M1',
  passed: true,
  upstreamEntries: entries.size,
  unchangedEntries: exact,
  retainedSymlinks: symlinks,
  allowedModifiedUpstream: [...allowedModifiedUpstream],
  iconResourcesReplaced,
  rootPackageUnchanged: true,
  originalREADMEByteIdentical: true,
  iconSHA256: brand.icon.sha256,
  branch: 'master',
  runtimeBuilt: false,
  windowsVerified: false,
  releasePublished: false,
}, null, 2))
