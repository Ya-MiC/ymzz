#!/usr/bin/env node
// MIT. Apply the owner-supplied 湛箴_ymzz icon to documented desktop/web
// icon resources only. Does not rename packages, edit runtime, or change
// DSH layout. Archives previous/upstream icon bytes instead of deleting them.
import { spawnSync } from 'node:child_process'
import { applyApplicationBranding } from './application-branding.mjs'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const brandingRoot = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(brandingRoot, '../..')
const brandPath = path.join(brandingRoot, 'brand.json')
const generatedDir = path.join(brandingRoot, 'generated')
const archiveRoot = path.join(brandingRoot, 'archive')
const rasterizeScript = path.join(brandingRoot, 'rasterize-icon.py')

const ALLOWED_XMLNS = new Set([
  'http://www.w3.org/2000/svg',
  'http://www.w3.org/1999/xlink',
])

/** Documented icon resource points inspected from the actual DSH source. */
export const ICON_TARGETS = [
  { path: 'apps/desktop/resources/icon.png', generated: 'icon-1104.png', role: 'designer-original-slot' },
  { path: 'apps/desktop/resources/icon.svg', generated: 'SOURCE_SVG', role: 'designer-original-vector-slot' },
  { path: 'apps/desktop/resources/icon-windows.png', generated: 'icon-1024.png', role: 'electron-builder-win-icon-and-packaged-icon.png' },
  { path: 'apps/desktop/resources/icon-windows.svg', generated: 'SOURCE_SVG', role: 'windows-vector-slot' },
  { path: 'apps/desktop/resources/icon-macos.png', generated: 'icon-1024.png', role: 'electron-builder-mac-icon' },
  { path: 'apps/desktop/resources/icon-macos.svg', generated: 'SOURCE_SVG', role: 'macos-vector-slot' },
  { path: 'apps/desktop/resources/tray-windows.ico', generated: 'tray-windows.ico', role: 'windows-tray-and-win32-window-icon' },
  { path: 'apps/web/public/favicon.svg', generated: 'favicon.svg', role: 'web-favicon-light' },
  { path: 'apps/web/public/favicon-dark.svg', generated: 'favicon.svg', role: 'web-favicon-dark-same-art' },
  { path: 'apps/web/public/apple-touch-icon.png', generated: 'icon-180.png', role: 'web-apple-touch-icon' },
  { path: 'apps/web/public/icon-192.png', generated: 'icon-192.png', role: 'web-manifest-192' },
  { path: 'apps/web/public/icon-512.png', generated: 'preview-512.png', role: 'web-manifest-512' },
  { path: 'apps/web/public/icon-maskable-512.png', generated: 'icon-maskable-512.png', role: 'web-manifest-maskable' },
  { path: 'website/public/favicon.svg', generated: 'favicon.svg', role: 'upstream-website-favicon' },
]

export const PREVIOUS_BRANDING_ARCHIVE = {
  directory: 'previous-m1',
  files: [
    { from: 'icon-source.png', sha256: '65b2af69825756700fe36ffad5b3d5a943b123364d611bd513df71d9c048be2d' },
    { from: 'icon.svg', sha256: '670cef673cc2560b9174d6c0fb4eb36d82fb7b1876e88cc02aad5f8f72d61ac9' },
  ],
}

export const UPSTREAM_ICON_ARCHIVE = {
  directory: 'upstream-dsh-icons',
  files: [
    { path: 'apps/desktop/resources/icon.png', sha256: '982c2859568d83d2576110a527c545f04641f4008bdb2cfeb6758f333c0fb07a' },
    { path: 'apps/desktop/resources/icon.svg', sha256: '0458ed5e4825846a6560e90d3e4de767cd75842f7eb53539dc87a5db380d9146' },
    { path: 'apps/desktop/resources/icon-windows.png', sha256: '12064ff340e65872715cb18e56cfa9d3afe294fed98c81807d39e230a030d972' },
    { path: 'apps/desktop/resources/icon-windows.svg', sha256: '0799d196151083f123a8ae28979471da2276f29664b21c562c82a4b789d2104e' },
    { path: 'apps/desktop/resources/icon-macos.png', sha256: '28a14336e024c1bb4e94d6e74fd23810dac2b737dfd1b8da6b24482e0191abec' },
    { path: 'apps/desktop/resources/icon-macos.svg', sha256: '6ea87fbbb2daeb6aba30ed07ed1e9059e0c2a39a3778d98a475b0ab05034f091' },
    { path: 'apps/desktop/resources/tray-windows.ico', sha256: 'ec9354edad3eb348144569250a18843ab8d61ebcca32bebcaa3f10d1f5707a86' },
    { path: 'apps/web/public/favicon.svg', sha256: '9e983b4f649c25c6ca0623a50be1a6e705fd8f49f756638b980fa13b40575ab6' },
    { path: 'apps/web/public/favicon-dark.svg', sha256: 'dde7db781f41e7aeb4709ff5485af2bdcf7f4b4ea81b4500cfd5df44efdbd817' },
    { path: 'apps/web/public/apple-touch-icon.png', sha256: '30a68c6871fc3974968cd285c63c42ddc80aa0e4d37a349cb4dbe824fa52ab92' },
    { path: 'apps/web/public/icon-192.png', sha256: 'dfbf42e79fa2a44fedb67497efa81e897e446f64b313531738f32974a117602c' },
    { path: 'apps/web/public/icon-512.png', sha256: '0aa6ff8cac04541957b937465341e1840e0323d6076f0c7f3c61ff937b7e6d63' },
    { path: 'apps/web/public/icon-maskable-512.png', sha256: '0b80994078a417bf33370e6c4e5b6174313bbece29ce7f3e8c6dc538d6ec46eb' },
    { path: 'website/public/favicon.svg', sha256: '035b68e57ac4490f6880e25f4e7f534d7b50b249308ccea77af34cc5d9e840c3' },
  ],
}

export const SOURCE_SHA256 = 'c3acc8a88148cadc3648f1a3b5c14b78d2bdf19c3d985ae7e6eeb0fbf14b0872'

function sha256(data) {
  return createHash('sha256').update(data).digest('hex')
}

function readBrand() {
  return JSON.parse(fs.readFileSync(brandPath, 'utf8'))
}

export function inspectSvg(text) {
  const issues = []
  if (/<script\b/i.test(text)) issues.push('script element')
  if (/javascript:/i.test(text)) issues.push('javascript: URL')
  if (/\son[a-z]+\s*=/i.test(text)) issues.push('inline event handler')
  if (/<(foreignObject|iframe|embed|object)\b/i.test(text)) issues.push('foreign element')
  if (/<!DOCTYPE|<!ENTITY|\bSYSTEM\b|\bPUBLIC\b/i.test(text)) issues.push('DTD or entity')
  const stripped = text.replace(/data:[^"']+/g, 'data:STRIPPED')
  for (const url of stripped.match(/https?:\/\/[^\s"'<>]+/gi) ?? []) {
    if (!ALLOWED_XMLNS.has(url)) issues.push(`external URL ${url}`)
  }
  for (const match of stripped.matchAll(/(?:xlink:)?href\s*=\s*(["'])(.*?)\1/gi)) {
    if (!match[2].startsWith('data:STRIPPED')) issues.push(`non-embedded href ${match[2].slice(0, 80)}`)
  }
  return issues
}

function sourceBytes() {
  const brand = readBrand()
  const source = path.join(brandingRoot, brand.icon.source)
  const bytes = fs.readFileSync(source)
  const digest = sha256(bytes)
  if (digest !== brand.icon.sha256) {
    throw new Error(`source hash mismatch: file ${digest} brand.json ${brand.icon.sha256}`)
  }
  if (digest !== SOURCE_SHA256) {
    throw new Error(`source hash is not the owner-supplied SVG: ${digest}`)
  }
  const issues = inspectSvg(bytes.toString('utf8'))
  if (issues.length > 0) throw new Error(`source SVG failed safety scan: ${issues.join(', ')}`)
  return { brand, source, bytes, digest }
}

function generatedBytes(generated, source) {
  if (generated === 'SOURCE_SVG') return source.bytes
  const file = path.join(generatedDir, generated)
  if (!fs.existsSync(file)) throw new Error(`missing generated file: ${generated}`)
  return fs.readFileSync(file)
}

function archiveDestination(rel) {
  return path.join(archiveRoot, UPSTREAM_ICON_ARCHIVE.directory, rel)
}

function copyIfNeeded(from, to, dryRun, expectedSha) {
  const will = { from, to, action: 'copy', sha256: expectedSha ?? (fs.existsSync(from) ? sha256(fs.readFileSync(from)) : null) }
  if (fs.existsSync(to)) {
    const existing = sha256(fs.readFileSync(to))
    if (expectedSha && existing !== expectedSha && existing !== sha256(fs.readFileSync(from))) {
      throw new Error(`refusing to overwrite unexpected archive ${to}: ${existing}`)
    }
    if (existing === (expectedSha ?? sha256(fs.readFileSync(from)))) {
      return { ...will, action: 'unchanged' }
    }
  }
  if (!dryRun) {
    fs.mkdirSync(path.dirname(to), { recursive: true })
    fs.copyFileSync(from, to)
  }
  return will
}

function writeIfNeeded(to, data, dryRun) {
  const digest = sha256(data)
  if (fs.existsSync(to) && sha256(fs.readFileSync(to)) === digest) {
    return { to, action: 'unchanged', sha256: digest, bytes: data.length }
  }
  if (!dryRun) {
    fs.mkdirSync(path.dirname(to), { recursive: true })
    fs.writeFileSync(to, data)
  }
  return { to, action: fs.existsSync(to) ? 'update' : 'write', sha256: digest, bytes: data.length }
}

function archivePreviousBranding(dryRun) {
  const actions = []
  const directory = path.join(archiveRoot, PREVIOUS_BRANDING_ARCHIVE.directory)
  for (const file of PREVIOUS_BRANDING_ARCHIVE.files) {
    const archived = path.join(directory, file.from)
    const live = path.join(brandingRoot, file.from)
    if (fs.existsSync(archived)) {
      const digest = sha256(fs.readFileSync(archived))
      if (digest !== file.sha256) throw new Error(`previous archive corrupted: ${file.from}`)
      actions.push({ to: archived, action: 'unchanged', sha256: digest })
      if (fs.existsSync(live) && sha256(fs.readFileSync(live)) === file.sha256 && file.from !== readBrand().icon.source) {
        // Live previous source still sits at the old path; leave it until the new source is in place.
      }
      continue
    }
    if (!fs.existsSync(live)) throw new Error(`cannot archive missing previous asset ${file.from}`)
    const digest = sha256(fs.readFileSync(live))
    if (digest !== file.sha256) throw new Error(`previous asset hash changed before archive: ${file.from}`)
    actions.push(copyIfNeeded(live, archived, dryRun, file.sha256))
  }
  return actions
}

function archiveUpstreamIcons(dryRun) {
  const actions = []
  for (const file of UPSTREAM_ICON_ARCHIVE.files) {
    const from = path.join(repoRoot, file.path)
    const to = archiveDestination(file.path)
    if (fs.existsSync(to)) {
      const digest = sha256(fs.readFileSync(to))
      if (digest !== file.sha256) throw new Error(`upstream archive corrupted: ${file.path}`)
      actions.push({ to, action: 'unchanged', sha256: digest })
      continue
    }
    if (!fs.existsSync(from)) throw new Error(`cannot archive missing upstream icon ${file.path}`)
    const digest = sha256(fs.readFileSync(from))
    if (digest !== file.sha256) {
      throw new Error(`upstream icon ${file.path} is not the archived DSH original (${digest})`)
    }
    actions.push(copyIfNeeded(from, to, dryRun, file.sha256))
  }
  return actions
}

function rasterize(sourcePath, dryRun) {
  if (dryRun && fs.existsSync(path.join(generatedDir, 'manifest.json'))) {
    return { action: 'reuse-existing-generated', manifest: JSON.parse(fs.readFileSync(path.join(generatedDir, 'manifest.json'), 'utf8')) }
  }
  const result = spawnSync('python3', [rasterizeScript, '--source', sourcePath, '--output-dir', generatedDir], {
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  })
  if (result.status !== 0) {
    throw new Error(`rasterize-icon.py failed: ${result.stderr || result.stdout || result.status}`)
  }
  return { action: 'generated', manifest: JSON.parse(result.stdout) }
}

export function applyBranding({ dryRun = false } = {}) {
  const source = sourceBytes()
  const previous = archivePreviousBranding(dryRun)
  const upstream = archiveUpstreamIcons(dryRun)
  const raster = dryRun && !fs.existsSync(path.join(generatedDir, 'manifest.json'))
    ? rasterize(source.source, false) && rasterize(source.source, true)
    : rasterize(source.source, dryRun)
  // If dry-run needed generation first, ignore that write for the report? Generation under ymzz/branding is additive and required to compute diffs.
  const targets = ICON_TARGETS.map((target) => {
    const data = generatedBytes(target.generated, source)
    const to = path.join(repoRoot, target.path)
    return { ...target, ...writeIfNeeded(to, data, dryRun) }
  })
  const changed = [...previous, ...upstream, ...targets].filter((item) => item.action !== 'unchanged')
  return {
    dryRun,
    displayName: source.brand.displayName,
    source: { path: path.relative(repoRoot, source.source), sha256: source.digest, bytes: source.bytes.length },
    raster: raster.action,
    previousArchive: previous,
    upstreamArchive: upstream,
    targets,
    changed: changed.length,
    applicationBrandingApplied: source.brand.applicationBrandingApplied,
    packagedWindowsVerified: false,
  }
}

function main() {
  const dryRun = process.argv.includes('--dry-run')
  const report = applyBranding({ dryRun })
  if (process.argv.includes('--application')) report.application = applyApplicationBranding({ dryRun })
  console.log(JSON.stringify(report, null, 2))
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main()
}
