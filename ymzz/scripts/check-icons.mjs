#!/usr/bin/env node
// MIT. Focused checks for the 湛箴_ymzz icon source, archives, generated
// outputs, documented resource copies, and apply-branding dry-run/idempotence.
import assert from 'node:assert/strict'
import { applyApplicationBranding } from '../branding/application-branding.mjs'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import {
  ICON_TARGETS,
  PREVIOUS_BRANDING_ARCHIVE,
  SOURCE_SHA256,
  UPSTREAM_ICON_ARCHIVE,
  applyBranding,
  inspectSvg,
} from '../branding/apply-branding.mjs'

const root = path.resolve(import.meta.dirname, '../..')
const branding = path.join(root, 'ymzz/branding')
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const ICO = Buffer.from([0x00, 0x00, 0x01, 0x00])

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}

function pngSize(bytes) {
  assert.ok(bytes.subarray(0, 8).equals(PNG), 'not a PNG')
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) }
}

function icoSizes(bytes) {
  assert.ok(bytes.subarray(0, 4).equals(ICO), 'not an ICO')
  const count = bytes.readUInt16LE(4)
  return Array.from({ length: count }, (_, index) => {
    const at = 6 + 16 * index
    const declared = bytes.readUInt8(at)
    const size = declared === 0 ? 256 : declared
    const length = bytes.readUInt32LE(at + 8)
    const offset = bytes.readUInt32LE(at + 12)
    const png = bytes.subarray(offset, offset + length)
    const dimensions = pngSize(png)
    assert.equal(dimensions.width, size)
    assert.equal(dimensions.height, size)
    return size
  })
}

const brand = JSON.parse(fs.readFileSync(path.join(branding, 'brand.json'), 'utf8'))
assert.equal(brand.displayName, '湛箴_ymzz')
assert.equal(brand.icon.source, 'icon.svg')
assert.equal(brand.icon.sha256, SOURCE_SHA256)
assert.equal(brand.icon.appliedToDocumentedResources, true)
assert.equal(brand.icon.packagedWindowsVerified, false)
assert.equal(brand.applicationBrandingApplied, true)
assert.ok(applyApplicationBranding({ dryRun: true }).changes.every(change => !change.changed), 'text branding must be applied and idempotent')

const sourcePath = path.join(branding, brand.icon.source)
const source = fs.readFileSync(sourcePath)
assert.equal(sha256(source), SOURCE_SHA256)
assert.deepEqual(inspectSvg(source.toString('utf8')), [])
assert.deepEqual(inspectSvg('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'), ['script element'])

for (const file of PREVIOUS_BRANDING_ARCHIVE.files) {
  const archived = fs.readFileSync(path.join(branding, 'archive', PREVIOUS_BRANDING_ARCHIVE.directory, file.from))
  assert.equal(sha256(archived), file.sha256, file.from)
}
for (const file of UPSTREAM_ICON_ARCHIVE.files) {
  const archived = fs.readFileSync(path.join(branding, 'archive', UPSTREAM_ICON_ARCHIVE.directory, file.path))
  assert.equal(sha256(archived), file.sha256, file.path)
}

const generated = {
  'preview-512.png': [512, 512],
  'icon-1536.png': [1536, 1536],
  'icon-1024.png': [1024, 1024],
  'icon-1104.png': [1104, 1104],
  'icon-192.png': [192, 192],
  'icon-180.png': [180, 180],
  'icon-maskable-512.png': [512, 512],
  'favicon-256.png': [256, 256],
}
for (const [name, size] of Object.entries(generated)) {
  const bytes = fs.readFileSync(path.join(branding, 'generated', name))
  const dimensions = pngSize(bytes)
  assert.deepEqual([dimensions.width, dimensions.height], size, name)
}
assert.deepEqual(icoSizes(fs.readFileSync(path.join(branding, 'generated', 'tray-windows.ico'))), [16, 20, 24, 32, 40, 48, 64])
assert.deepEqual(icoSizes(fs.readFileSync(path.join(branding, 'generated', 'icon.ico'))), [16, 24, 32, 48, 64, 128, 256])
assert.deepEqual(inspectSvg(fs.readFileSync(path.join(branding, 'generated', 'favicon.svg'), 'utf8')), [])

for (const target of ICON_TARGETS) {
  const actual = fs.readFileSync(path.join(root, target.path))
  const expected = target.generated === 'SOURCE_SVG'
    ? source
    : fs.readFileSync(path.join(branding, 'generated', target.generated))
  assert.equal(sha256(actual), sha256(expected), target.path)
}

const dryRun = applyBranding({ dryRun: true })
assert.equal(dryRun.dryRun, true)
assert.equal(dryRun.changed, 0)
assert.equal(dryRun.packagedWindowsVerified, false)
const second = applyBranding({ dryRun: false })
assert.equal(second.changed, 0)

console.log(JSON.stringify({
  check: 'icons',
  passed: true,
  sourceSha256: SOURCE_SHA256,
  targets: ICON_TARGETS.length,
  dryRunUnchanged: dryRun.changed === 0,
  applyIdempotent: second.changed === 0,
  applicationBrandingApplied: brand.applicationBrandingApplied,
  packagedWindowsVerified: brand.icon.packagedWindowsVerified,
}, null, 2))
