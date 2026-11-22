// MIT. Obsidian-compatible Markdown rendering and tag normalisation for ymzz knowledge notes.
// Pure functions only: no filesystem, no network, no ordering dependency on the Host.
import {createHash} from 'node:crypto';
import {assert} from './guard.mjs';

/** Ordered sections rendered into every note body. */
export const KNOWLEDGE_SECTIONS = Object.freeze([
  Object.freeze({key: 'decisions', heading: '决策'}),
  Object.freeze({key: 'events', heading: '事件'}),
  Object.freeze({key: 'resources', heading: '资源'}),
  Object.freeze({key: 'actions', heading: '行动'}),
]);

/** Hard limits shared by the store, the routes and the UI. */
export const TAG_MAX_LENGTH = 40;
export const TAG_MAX_COUNT = 24;
export const TITLE_MAX_LENGTH = 200;
export const SUMMARY_MAX_LENGTH = 2000;
export const SECTION_MAX_LENGTH = 20000;
export const LINK_MAX_COUNT = 32;
export const LINK_MAX_LENGTH = 120;
export const TARGET_PATH_MAX_LENGTH = 200;
export const MARKDOWN_MAX_BYTES = 200000;
/** Knowledge notes always live under this Vault subdirectory. */
export const KNOWLEDGE_ROOT_SEGMENT = 'ymzz';

const sha256 = (text) => createHash('sha256').update(text, 'utf8').digest('hex');
const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u;

/**
 * Normalise one tag: lowercase, trimmed, spaces to hyphens, bounded length.
 * @param {unknown} raw - candidate tag, `#` prefix allowed.
 * @returns {string} normalised tag, or `''` when nothing valid remains.
 */
export function normalizeTag(raw) {
  if (typeof raw !== 'string') return '';
  let value = raw.normalize('NFKC').trim().toLowerCase();
  value = value.replace(/^[#＃]+/u, '');
  value = value.replace(/[\s\u3000]+/gu, '-');
  value = value.replace(/[^\p{L}\p{N}\p{M}_\-./]/gu, '');
  value = value.replace(/[-.]{2,}/gu, '-');
  value = value.replace(/^[-./]+/u, '').replace(/[-./]+$/u, '');
  if (!value || value === '.') return '';
  return value.slice(0, TAG_MAX_LENGTH).replace(/[-./]+$/u, '');
}

/**
 * Normalise, de-duplicate and bound a tag list.
 * @param {unknown} list - array-like of tag candidates.
 * @returns {string[]} unique normalised tags in input order.
 */
export function normalizeTags(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  const seen = new Set();
  for (const item of list) {
    const tag = normalizeTag(item);
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    out.push(tag);
    if (out.length >= TAG_MAX_COUNT) break;
  }
  return out;
}

/**
 * Normalise `[[...]]` link targets (note titles), preserving the user's casing.
 * @param {unknown} list - array-like of link candidates.
 * @returns {string[]} unique bounded link targets in input order.
 */
export function normalizeLinks(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  const seen = new Set();
  for (const item of list) {
    if (typeof item !== 'string') continue;
    const cleaned = item
      .normalize('NFKC')
      .replace(/^\s*\[\[/u, '')
      .replace(/\]\]\s*$/u, '')
      .replace(/[\[\]|#^]/gu, '')
      .replace(CONTROL, '')
      .trim();
    if (!cleaned || cleaned.length > LINK_MAX_LENGTH) continue;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(cleaned);
    if (out.length >= LINK_MAX_COUNT) break;
  }
  return out;
}

/**
 * Extract explicit `#tag` occurrences from text. This is literal text extraction,
 * never inference: only tags the user actually typed are suggested.
 * @param {unknown} text - bounded free text.
 * @param {{existing?: string[], limit?: number}} [options] - tags to exclude and a cap.
 * @returns {string[]} suggested tags not already present in `existing`.
 */
export function suggestTags(text, {existing = [], limit = 12} = {}) {
  if (typeof text !== 'string' || !text) return [];
  const known = new Set(normalizeTags(existing));
  const out = [];
  const pattern = /(?:^|[\s(（[【,，;；、。])#([\p{L}\p{N}_-]{1,40})/gu;
  let match;
  while ((match = pattern.exec(text)) !== null) {
    const tag = normalizeTag(match[1]);
    if (!tag || known.has(tag) || out.includes(tag)) continue;
    out.push(tag);
    if (out.length >= limit) break;
  }
  return out;
}

/**
 * Derive a filesystem-safe slug from a human title (UTF-8 letters are kept).
 * @param {unknown} title - note title.
 * @returns {string} lowercase slug of at most 60 characters.
 */
export function slugFromTitle(title) {
  const base = String(title ?? '')
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/[\s\u3000]+/gu, '-')
    .replace(/[^\p{L}\p{N}\p{M}\-_]/gu, '')
    .replace(/-{2,}/gu, '-')
    .replace(/^-+|-+$/gu, '');
  const slug = base.slice(0, 60).replace(/-+$/u, '');
  return slug || 'note';
}

/**
 * Build the default Vault-relative target path: `ymzz/<year>/<month>/<slug>-<id8>.md`.
 * @param {{title?: unknown, id: string, created?: string|Date}} input - note identity.
 * @returns {string} relative path using forward slashes only.
 */
export function targetPathFor({title, id, created}) {
  const date = created instanceof Date ? created : new Date(typeof created === 'string' ? created : Date.now());
  const stamp = Number.isNaN(date.getTime()) ? new Date() : date;
  const year = String(stamp.getUTCFullYear());
  const month = String(stamp.getUTCMonth() + 1).padStart(2, '0');
  const suffix = String(id).replace(/[^a-zA-Z0-9]/gu, '').slice(0, 8) || 'note';
  return `${KNOWLEDGE_ROOT_SEGMENT}/${year}/${month}/${slugFromTitle(title)}-${suffix}.md`;
}

/** Quote a scalar as a YAML-safe double-quoted string (JSON is a YAML 1.2 subset). */
const yaml = (value) => JSON.stringify(String(value ?? ''));

/** Collapse CRLF to LF, strip trailing spaces, and bound one section body. */
function cleanSection(value) {
  if (typeof value !== 'string') return '';
  const text = value.replace(/\r\n?/gu, '\n').replace(/[ \t]+$/gmu, '').trim();
  return text.slice(0, SECTION_MAX_LENGTH);
}

/**
 * Render one Obsidian Markdown note with YAML frontmatter, the four section
 * headings, and a `## 来源` section. Empty sections are omitted. Output is UTF-8
 * safe, LF-only, and ends with exactly one trailing newline.
 * @param {{
 *  id: string, title: string, summary?: string, tags?: string[], links?: string[],
 *  sections?: Record<string, string>, created?: string, updated?: string,
 *  source?: {kind?: string, sessionId?: string, sessionTitle?: string},
 * }} note - validated note input.
 * @returns {{markdown: string, sha256: string, byteLength: number}} rendered note.
 */
export function renderKnowledgeNote(note) {
  assert(note && typeof note === 'object', 'NOTE_REQUIRED');
  const id = String(note.id ?? '');
  assert(/^[A-Za-z0-9-]{8,64}$/u.test(id), 'NOTE_ID_INVALID');
  const title = String(note.title ?? '').trim();
  assert(title.length > 0 && title.length <= TITLE_MAX_LENGTH, 'TITLE_INVALID');
  const tags = normalizeTags(note.tags);
  const links = normalizeLinks(note.links);
  const summary = cleanSection(note.summary).slice(0, SUMMARY_MAX_LENGTH);
  // Dates must be explicit: a wall-clock fallback would make the approved hash
  // unstable between approval and commit.
  const created = String(note.created ?? note.createdAt ?? '').trim();
  assert(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/u.test(created), 'CREATED_REQUIRED');
  const updatedCandidate = String(note.updated ?? note.updatedAt ?? '').trim();
  const updated = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/u.test(updatedCandidate) ? updatedCandidate : created;
  const sourceKind = note.source?.kind === 'session' ? 'session' : 'manual';
  const sessionId = sourceKind === 'session' ? String(note.source?.sessionId ?? '').trim() : '';
  const sessionTitle = sourceKind === 'session' ? String(note.source?.sessionTitle ?? '').trim() : '';
  if (sourceKind === 'session') assert(sessionId.length > 0 && sessionId.length <= 160, 'SOURCE_SESSION_INVALID');

  const lines = [
    '---',
    `title: ${yaml(title)}`,
    `created: ${yaml(created)}`,
    `updated: ${yaml(updated)}`,
    `tags: [${tags.map(yaml).join(', ')}]`,
    `ymzz_id: ${yaml(id)}`,
    `source: ${yaml(sourceKind)}`,
  ];
  if (sessionId) lines.push(`source_session: ${yaml(sessionId)}`);
  if (sessionTitle) lines.push(`source_session_title: ${yaml(sessionTitle)}`);
  lines.push('---', '', `# ${title}`, '');
  if (summary) lines.push(summary, '');
  const sections = note.sections && typeof note.sections === 'object' ? note.sections : {};
  for (const section of KNOWLEDGE_SECTIONS) {
    const body = cleanSection(sections[section.key]);
    if (!body) continue;
    lines.push(`## ${section.heading}`, '', body, '');
  }
  lines.push('## 来源', '');
  if (sourceKind === 'session') {
    const label = sessionTitle ? `${sessionTitle} ` : '';
    lines.push(`- 会话：${label}\`${sessionId}\``);
  } else {
    lines.push('- 手工记录');
  }
  if (links.length > 0) lines.push(`- 关联：${links.map((link) => `[[${link}]]`).join('、')}`);
  lines.push('');

  let markdown = lines.join('\n').replace(/\r\n?/gu, '\n');
  if (!markdown.endsWith('\n')) markdown += '\n';
  const byteLength = Buffer.byteLength(markdown, 'utf8');
  assert(byteLength <= MARKDOWN_MAX_BYTES, 'NOTE_TOO_LARGE');
  return {markdown, sha256: sha256(markdown), byteLength};
}
