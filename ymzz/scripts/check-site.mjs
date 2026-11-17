// MIT. Official-site checks: IDs, /ymzz/ prefix, no trackers, four themes, installer honesty, CSP.
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'

const root = path.resolve(import.meta.dirname, '../..')
const site = path.join(root, 'ymzz/site')
const official = 'https://ya-mic.github.io/ymzz'
const trackerRe = /google-analytics\.com|www\.googletagmanager\.com|googletagmanager\.com\/gtag|fonts\.googleapis\.com|fonts\.gstatic\.com|doubleclick\.net|connect\.facebook\.net|static\.hotjar\.com|cdn\.mxpnl\.com|cdn\.segment\.com|cdn\.amplitude\.com|plausible\.io\/js|umami\.is\/script|clarity\.ms|scorecardresearch\.com|googlesyndication\.com|browser\.sentry-cdn\.com|fullstory\.com\/s/i
const installClaimRe = /立即下載\s*(Windows|Mac|Linux)|download (the )?(windows|mac|linux) (installer|app) now|三個平台的自動檢查也都通過|電腦版安裝包已經能下載了/i
const windowsPendingRe = /尚未發佈|尚未发布|尚未驗收|尚未验收|not released|not accepted|pending/i
const sourceRe = /從原始碼|从源代码|run from source|pnpm dsh web/i
const meaning = '深淵的清澈的水，纂刻于竹篾上的痕，珍重微小，有所依據，立傳傳世'

function read(rel) {
  return fs.readFileSync(path.join(site, rel), 'utf8')
}
function walk(dir, acc = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name)
    if (ent.isDirectory()) walk(p, acc)
    else acc.push(p)
  }
  return acc
}

assert.ok(fs.existsSync(site), 'SITE_MISSING')
const htmlFiles = walk(site).filter((p) => p.endsWith('.html')).map((p) => path.relative(site, p))
assert.deepEqual(new Set(htmlFiles).size && htmlFiles.sort(), ['404.html', 'family.html', 'index.html', 'start.html'].sort())

const allText = walk(site).filter((p) => /\.(html|js|css|txt|xml|md|json)$/.test(p)).map((p) => fs.readFileSync(p, 'utf8')).join('\n')

// No trackers or font CDNs
assert.doesNotMatch(allText, trackerRe, 'TRACKER_OR_FONT_CDN')
assert.doesNotMatch(allText, /cdn\.jsdelivr|unpkg\.com|cdnjs\.cloudflare|ajax\.googleapis/i, 'REMOTE_SCRIPT_CDN')

// Identity
assert.match(read('index.html'), /湛箴_ymzz/)
assert.match(allText, new RegExp(meaning))
assert.match(read('index.html'), /晏銘湛箴/)

// Four themes
const css = read('style.css')
const js = read('app.js') + read('config.js')
for (const needle of [
  'data-palette=cloud',
  'data-palette=earth',
  'data-palette=wood',
  'data-theme=dark',
  'cloud-light',
  'cloud-dark',
  'earth-light',
  'wood-dark',
  '雲箋淺',
  '雲箋暗',
  '陶土淺',
  '陶土暗',
]) {
  assert.ok(css.includes(needle) || js.includes(needle) || read('index.html').includes(needle), 'THEME_MISSING: ' + needle)
}
assert.match(css, /--c-cloud-paper:\s*#F8F6EF/i)
assert.match(css, /--c-earth-oat:\s*#E8E3CC/i)
assert.match(css, /--ease-ink:\s*cubic-bezier\(\.16,\s*1,\s*\.3,\s*1\)/)
assert.match(css, /--hit:\s*48px/)
assert.match(css, /prefers-reduced-motion:\s*reduce/)
assert.match(css, /min-block-size:\s*var\(--hit\)/)

// Honesty: no false installer claims in static source; pending + source-run required
assert.doesNotMatch(read('index.html') + read('start.html'), installClaimRe, 'FALSE_INSTALLER_CLAIM')
assert.match(read('index.html'), windowsPendingRe)
assert.match(read('start.html'), windowsPendingRe)
assert.match(read('index.html'), sourceRe)
assert.match(read('start.html'), sourceRe)
assert.match(read('index.html') + read('family.html'), /稟冊/)
assert.match(read('index.html'), /ya-mic\.github\.io\/ymzz-loop/)
assert.match(read('index.html'), /bingce\.yanmingx0215\.filegear-sg\.me\/#onboarding/)
assert.match(read('index.html'), /github\.com\/Ya-MiC\/ymzz/)
assert.doesNotMatch(read('index.html'), /alipay\.trade|openapi\.alipay|pay\.weixin|img[^>]+(alipay|wechat-pay|wxpay)/i)
assert.match(read('index.html'), /支付由作者自行接入|Payment will be connected by the author|不提供支付|no payment interface/)

// Path prefix and canonical
for (const file of htmlFiles) {
  const html = read(file)
  assert.match(html, /Content-Security-Policy/)
  assert.match(html, /default-src 'self'/)
  assert.match(html, /connect-src 'self' https:\/\/api\.github\.com/)
  assert.doesNotMatch(html, /script-src[^"]*'unsafe-inline'/)
  const canonical = [...html.matchAll(/rel="canonical" href="([^"]+)"/g)].map((m) => m[1])
  assert.ok(canonical.length, 'CANONICAL_MISSING: ' + file)
  for (const href of canonical) {
    assert.ok(href === official + '/' || href.startsWith(official + '/'), 'CANONICAL_PREFIX: ' + file + ' ' + href)
  }
  const og = [...html.matchAll(/property="og:(?:url|image)" content="([^"]+)"/g)].map((m) => m[1])
  for (const href of og) {
    assert.ok(href.startsWith(official + '/'), 'OG_PREFIX: ' + file + ' ' + href)
  }
  // Root-absolute URLs would escape the project site except /ymzz/
  const abs = [...html.matchAll(/\s(?:href|src)="(\/[^"]*)"/g)].map((m) => m[1])
  for (const href of abs) {
    assert.ok(href === '/ymzz' || href.startsWith('/ymzz/'), 'BAD_ROOT_ABSOLUTE: ' + file + ' ' + href)
  }
}

const robots = read('robots.txt')
assert.match(robots, /Sitemap: https:\/\/ya-mic\.github\.io\/ymzz\/sitemap\.xml/)
const sitemap = read('sitemap.xml')
assert.match(sitemap, /https:\/\/ya-mic\.github\.io\/ymzz\//)
assert.match(sitemap, /https:\/\/ya-mic\.github\.io\/ymzz\/start\.html/)
assert.match(sitemap, /https:\/\/ya-mic\.github\.io\/ymzz\/family\.html/)
assert.doesNotMatch(sitemap, /https:\/\/ya-mic\.github\.io\/(?!ymzz\/)/)

// Internal href IDs
function idsIn(html) {
  return new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]))
}
function hrefsIn(html) {
  return [...html.matchAll(/\s(?:href)="([^"]+)"/g)].map((m) => m[1])
}
for (const file of htmlFiles) {
  const html = read(file)
  const ids = idsIn(html)
  for (const href of hrefsIn(html)) {
    if (!href || href.startsWith('https://') || href.startsWith('http://') || href.startsWith('mailto:')) continue
    assert.doesNotMatch(href, /^javascript:/i, 'JS_URL: ' + file)
    const [rawPath, rawHash] = href.split('#')
    const hash = rawHash != null && (rawPath === '' || rawPath === file || rawPath === './' + file) ? rawHash : (rawPath === '' ? rawHash : null)
    if (href.startsWith('#')) {
      assert.ok(ids.has(href.slice(1)), 'MISSING_ID: ' + file + ' ' + href)
    } else if (rawPath && !rawPath.startsWith('https:') && !rawPath.startsWith('/')) {
      const target = rawPath.split('?')[0]
      if (target && !target.endsWith('/')) {
        const dest = path.join(site, target)
        assert.ok(fs.existsSync(dest), 'MISSING_PATH: ' + file + ' -> ' + target)
      }
      if (rawHash && (rawPath === '' || path.basename(rawPath) === file)) {
        assert.ok(ids.has(rawHash), 'MISSING_ID: ' + file + ' #' + rawHash)
      }
      if (rawHash && rawPath && fs.existsSync(path.join(site, rawPath.split('?')[0]))) {
        const other = read(rawPath.split('?')[0].replace(/^\.\//, ''))
        if (rawPath.split('?')[0].endsWith('.html') || rawPath === 'index.html') {
          assert.ok(idsIn(other).has(rawHash), 'MISSING_CROSS_ID: ' + file + ' -> ' + rawPath + '#' + rawHash)
        }
      }
    }
  }
}

// Required static files
for (const rel of [
  'style.css', 'app.js', 'config.js', 'favicon.svg', 'og.png', 'apple-touch-icon.png',
  'fonts/fraunces.woff2', 'fonts/inter.woff2', 'fonts/jetbrains-mono.woff2',
  'licenses/Fraunces-OFL.txt', 'licenses/Inter-OFL.txt', 'licenses/JetBrains-Mono-OFL.txt', 'licenses/tabler-icons-LICENSE.txt',
  'i18n/zh-Hant.json', 'i18n/zh-CN.json', 'i18n/en.json',
  'llms.txt', 'ai.txt', 'humans.txt', 'robots.txt', 'sitemap.xml', '.nojekyll', 'CREDITS.md',
]) {
  assert.ok(fs.existsSync(path.join(site, rel)), 'MISSING_FILE: ' + rel)
}

// i18n completeness
const zh = JSON.parse(read('i18n/zh-Hant.json'))
for (const lang of ['zh-CN', 'en']) {
  const d = JSON.parse(read('i18n/' + lang + '.json'))
  for (const key of Object.keys(zh)) {
    assert.ok(d[key], 'I18N_MISSING: ' + lang + ' ' + key)
  }
}
const htmlKeys = new Set()
for (const file of htmlFiles) {
  const html = read(file)
  for (const m of html.matchAll(/data-i18n="([^"]+)"/g)) htmlKeys.add(m[1])
  for (const m of html.matchAll(/data-i18n-aria="([^"]+)"/g)) htmlKeys.add(m[1])
}
for (const key of htmlKeys) {
  assert.ok(zh[key], 'I18N_KEY_NOT_IN_ZH: ' + key)
}

// docs
assert.ok(fs.existsSync(path.join(root, 'ymzz/docs/SITE.md')))
assert.ok(fs.existsSync(path.join(root, 'ymzz/docs/github-pages.workflow.yml')))
const wf = fs.readFileSync(path.join(root, 'ymzz/docs/github-pages.workflow.yml'), 'utf8')
assert.match(wf, /path: ymzz\/site/)
assert.doesNotMatch(wf, /enablement:\s*true/)
assert.ok(!fs.existsSync(path.join(root, '.github/workflows/ymzz-pages.yml')), 'WORKFLOW_SHOULD_NOT_BE_INSTALLED_YET')

console.log(JSON.stringify({
  ok: true,
  html: htmlFiles,
  i18nKeys: htmlKeys.size,
  official,
}, null, 2))
