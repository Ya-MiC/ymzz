// MIT. Generic local tag registry: sessions, messages, thoughts, web pages, files,
// artifacts, notes and tasks, with tags, Lists, bounded revisions and a multi-cluster
// graph projection. Local JSON only: no network, no history scraping, no disk scan.
import fs from 'node:fs';
import path from 'node:path';
import {randomUUID, createHash} from 'node:crypto';
import {assert} from './guard.mjs';
import {readLedgerJson, writeLedgerJson} from './ledger-json.mjs';
import {normalizeTag, normalizeTags, TITLE_MAX_LENGTH} from './obsidian-markdown.mjs';
import {buildClusters, describeGraph, layoutCluster, MAX_CLUSTERS} from './knowledge-graph.mjs';
import {noSecrets} from './workspace.mjs';

export const TAG_REGISTRY_VERSION = 1;
/** Entity kinds the registry accepts. Nothing else can be registered. */
export const ENTITY_KINDS = Object.freeze([
  'session',
  'message',
  'thought',
  'web',
  'file',
  'artifact',
  'note',
  'task',
]);
/** Where an entity came from. `dsh` means a native DSH session/message/task. */
export const ENTITY_SOURCES = Object.freeze(['manual', 'dsh', 'web', 'file', 'cloud', 'taskboard']);
export const ENTITY_LIMIT = 5000;
export const LIST_LIMIT = 200;
export const ENTITY_TAG_LIMIT = 24;
export const ENTITY_LIST_LIMIT = 32;
export const METADATA_MAX_KEYS = 20;
export const METADATA_MAX_BYTES = 4096;
export const LOCATOR_MAX_LENGTH = 2048;
export const LIST_NAME_MAX_LENGTH = 80;
export const LIST_DESCRIPTION_MAX_LENGTH = 400;
export const ENTITY_REVISION_LIMIT = 10;
export const ENTITY_REVISION_BYTES = 65536;
export const QUERY_LIMIT = 60;

const sha256 = (text) => createHash('sha256').update(String(text), 'utf8').digest('hex');
const CONTROL = /[\u0000-\u001f\u007f]/u;
/** Metadata keys that would carry credentials or session secrets. */
const CREDENTIAL_KEY =
  /(?:pass(?:word|phrase)?|secret|token|credential|api[-_]?key|apikey|authorization|cookie|private[-_]?key|session[-_]?key|bearer|otp|recovery[-_]?code)/iu;
/**
 * Credential-shaped *values* the shared workspace redactor does not cover.
 * Kept local so the existing `noSecrets` contract stays byte-compatible.
 */
const CREDENTIAL_VALUE =
  /\bBearer\s+[A-Za-z0-9._~+/=-]{8,}|\bsk-[A-Za-z0-9_-]{16,}|\bgh[pousr]_[A-Za-z0-9]{16,}|\bxox[abprs]-[A-Za-z0-9-]{8,}|\bAKIA[0-9A-Z]{16}\b/iu;
const SESSION_LOCATOR = /^dsh:session\/[A-Za-z0-9][A-Za-z0-9_.:-]{0,159}$/u;
const MESSAGE_LOCATOR = /^dsh:session\/[A-Za-z0-9][A-Za-z0-9_.:-]{0,159}#\d{1,9}$/u;
const NOTE_LOCATOR = /^ymzz:note\/[A-Za-z0-9-]{8,64}$/u;
const TASK_LOCATOR = /^(?:dsh|ymzz):task\/[A-Za-z0-9][A-Za-z0-9_.:-]{0,63}$/u;

/** Clip free text, normalising newlines and dropping NUL. */
function text(value, max) {
  if (typeof value !== 'string') return '';
  return value.replace(/\r\n?/gu, '\n').replace(/\u0000/gu, '').trim().slice(0, max);
}

/**
 * Refuse any user-supplied string that looks like a credential. The registry
 * persists user text, so it must never become a secret store.
 * @param {string} value - candidate text.
 * @returns {string} the unchanged value when it is safe.
 */
function assertNoCredentialValue(value) {
  noSecrets(value);
  assert(!CREDENTIAL_VALUE.test(value), 'SECRET_SHAPED_CONTENT_BLOCKED');
  return value;
}

/** Validate one URL locator: http(s) only, no embedded credentials. */
function assertUrlLocator(locator) {
  assert(/^https?:\/\//iu.test(locator), 'LOCATOR_URL_REQUIRED');
  let url;
  try {
    url = new URL(locator);
  } catch {
    throw new Error('LOCATOR_URL_INVALID');
  }
  assert(url.protocol === 'http:' || url.protocol === 'https:', 'LOCATOR_URL_REQUIRED');
  assert(!url.username && !url.password, 'LOCATOR_CREDENTIALS_FORBIDDEN');
}

/** Validate one absolute filesystem locator without reading anything. */
function assertPathLocator(locator) {
  assert(!CONTROL.test(locator), 'LOCATOR_INVALID');
  assert(!locator.startsWith('\\\\'), 'LOCATOR_INVALID');
  assert(path.isAbsolute(locator), 'LOCATOR_PATH_REQUIRED');
  assert(!locator.split(/[\\/]/u).includes('..'), 'LOCATOR_INVALID');
  assert(!/[. ]$/u.test(locator), 'LOCATOR_INVALID');
}

/**
 * Validate a locator for one entity kind. The registry only ever stores the
 * pointer the user supplied; it never resolves, reads or scans it.
 * @param {string} kind - entity kind.
 * @param {unknown} raw - candidate locator.
 * @returns {string} the accepted locator.
 */
export function normalizeLocator(kind, raw) {
  const locator = text(raw, LOCATOR_MAX_LENGTH);
  assert(locator.length > 0, 'LOCATOR_REQUIRED');
  assert(!CONTROL.test(locator), 'LOCATOR_INVALID');
  if (kind === 'web') {
    assertUrlLocator(locator);
  } else if (kind === 'file') {
    assertPathLocator(locator);
  } else if (kind === 'artifact') {
    // A produced artifact may live on disk or behind an https URL.
    if (/^https?:\/\//iu.test(locator)) assertUrlLocator(locator);
    else assertPathLocator(locator);
  } else if (kind === 'session') {
    assert(SESSION_LOCATOR.test(locator), 'LOCATOR_SESSION_REQUIRED');
  } else if (kind === 'message') {
    assert(MESSAGE_LOCATOR.test(locator), 'LOCATOR_MESSAGE_REQUIRED');
  } else if (kind === 'thought') {
    // Only a user-visible message position or an explicitly manual note; never
    // a hidden chain-of-thought stream.
    assert(MESSAGE_LOCATOR.test(locator) || /^manual:[A-Za-z0-9_.:-]{1,160}$/u.test(locator), 'LOCATOR_THOUGHT_REQUIRED');
  } else if (kind === 'note') {
    assert(NOTE_LOCATOR.test(locator), 'LOCATOR_NOTE_REQUIRED');
  } else if (kind === 'task') {
    assert(TASK_LOCATOR.test(locator), 'LOCATOR_TASK_REQUIRED');
  } else {
    assert(false, 'ENTITY_KIND_INVALID');
  }
  // Shape checks run first so `https://user:pass@host` reports the precise
  // reason; this final gate still refuses private keys and `sk-` tokens.
  return assertNoCredentialValue(locator);
}

/**
 * Validate a bounded metadata bag. Credential-shaped keys and values are
 * refused so the registry can never become a secret store.
 * @param {unknown} raw - candidate metadata.
 * @returns {object} flat metadata with primitive values only.
 */
export function normalizeMetadata(raw) {
  if (raw === undefined || raw === null) return {};
  assert(typeof raw === 'object' && !Array.isArray(raw), 'METADATA_INVALID');
  const entries = Object.entries(raw);
  assert(entries.length <= METADATA_MAX_KEYS, 'METADATA_TOO_LARGE');
  const out = {};
  for (const [rawKey, rawValue] of entries) {
    const key = text(rawKey, 40);
    assert(key.length > 0 && !CONTROL.test(key), 'METADATA_INVALID');
    assert(!CREDENTIAL_KEY.test(key), 'METADATA_CREDENTIAL_FORBIDDEN');
    if (rawValue === undefined || rawValue === null) continue;
    assert(['string', 'number', 'boolean'].includes(typeof rawValue), 'METADATA_INVALID');
    if (typeof rawValue === 'string') {
      assert(rawValue.length <= 400, 'METADATA_VALUE_TOO_LONG');
      assertNoCredentialValue(rawValue);
      out[key] = rawValue;
    } else if (typeof rawValue === 'number') {
      assert(Number.isFinite(rawValue), 'METADATA_INVALID');
      out[key] = rawValue;
    } else {
      out[key] = rawValue;
    }
  }
  assert(Buffer.byteLength(JSON.stringify(out), 'utf8') <= METADATA_MAX_BYTES, 'METADATA_TOO_LARGE');
  return out;
}

/** Version content hash for one entity revision. */
function entitySignature(entity) {
  return sha256(
    JSON.stringify({
      title: entity.title,
      locator: entity.locator,
      tags: entity.tags,
      metadata: entity.metadata,
      source: entity.source,
    }),
  );
}

/** Bounded per-entity revision entry (never contains list membership churn). */
function revisionEntry(entity, at) {
  return {
    revision: entity.revision,
    at,
    title: entity.title,
    locator: entity.locator,
    tags: [...entity.tags],
    source: entity.source,
    metadata: {...entity.metadata},
    sha256: {
      text: entitySignature(entity),
      tags: sha256(entity.tags.join('\n')),
      locator: sha256(entity.locator),
    },
  };
}

/**
 * Bound the revision history by count and by bytes, but always pin the
 * first-ever revision: people delete and rewrite, so "get my original back"
 * must keep working no matter how many times the entry was edited.
 */
function trimHistory(history) {
  if (history.length <= 1) return history;
  const pinned = history[0];
  const kept = history.slice(1).slice(-(ENTITY_REVISION_LIMIT - 1));
  const combined = [pinned, ...kept];
  while (combined.length > 2 && Buffer.byteLength(JSON.stringify(combined), 'utf8') > ENTITY_REVISION_BYTES) {
    combined.splice(1, 1);
  }
  return combined;
}

function emptyState() {
  return {version: TAG_REGISTRY_VERSION, entities: {}, lists: {}};
}

function validateLedger(parsed) {
  assert(parsed.entities && typeof parsed.entities === 'object', 'LEDGER_INVALID');
  assert(parsed.lists && typeof parsed.lists === 'object', 'LEDGER_INVALID');
}

/** Public entity projection (never includes internal history bodies). */
function publicEntity(entity) {
  return {
    id: entity.id,
    kind: entity.kind,
    title: entity.title,
    locator: entity.locator,
    tags: [...entity.tags],
    lists: [...entity.lists],
    source: entity.source,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
    revision: entity.revision,
    historyCount: Array.isArray(entity.history) ? entity.history.length : 0,
    metadata: {...entity.metadata},
  };
}

/**
 * The plugin-owned generic tag registry.
 *
 * Every mutation requires explicit consent; there is deliberately no import,
 * scan, crawl or history-reading entry point. Registration records only the
 * pointer and text the user supplied.
 */
export class TagRegistry {
  /**
   * @param {{root: string, now?: () => Date, newId?: () => string, recoverCorrupt?: boolean}} options - storage and clocks.
   */
  constructor({root, now = () => new Date(), newId = () => randomUUID(), recoverCorrupt = true}) {
    assert(typeof root === 'string' && path.isAbsolute(root), 'TAG_ROOT_INVALID');
    fs.mkdirSync(root, {recursive: true, mode: 0o700});
    this.root = root;
    this.filePath = path.join(root, 'tag-registry.json');
    this.now = now;
    this.newId = newId;
    const loaded = readLedgerJson(this.filePath, {
      version: TAG_REGISTRY_VERSION,
      validate: validateLedger,
      recoverCorrupt,
    });
    this.recoveredFrom = loaded.recoveredFrom;
    this.ledger = loaded.state
      ? {version: TAG_REGISTRY_VERSION, entities: loaded.state.entities, lists: loaded.state.lists}
      : emptyState();
  }

  /** Persist the registry atomically. */
  save() {
    writeLedgerJson(this.filePath, this.ledger);
  }

  /** @returns {object[]} all lists, oldest first. */
  lists() {
    return Object.values(this.ledger.lists)
      .sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0))
      .map((list) => ({...list}));
  }

  /** @returns {object[]} all entities, newest first. */
  entities() {
    return Object.values(this.ledger.entities)
      .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0))
      .map(publicEntity);
  }

  /**
   * Read one entity.
   * @param {string} id - entity id.
   * @returns {object} public entity projection.
   */
  entity(id) {
    const entity = this.ledger.entities[id];
    assert(entity, 'ENTITY_NOT_FOUND');
    return publicEntity(entity);
  }

  /**
   * Resolve a graph node or entity id to the pointer a caller needs in order to
   * open it. This is the data behind "click a node to locate the entity".
   * @param {string} id - entity id.
   * @returns {{id: string, kind: string, title: string, locator: string, tags: string[], lists: string[]}} locator.
   */
  resolve(id) {
    const entity = this.ledger.entities[id];
    assert(entity, 'ENTITY_NOT_FOUND');
    return {
      id: entity.id,
      kind: entity.kind,
      title: entity.title,
      locator: entity.locator,
      tags: [...entity.tags],
      lists: [...entity.lists],
    };
  }

  /**
   * Register one entity. Consent is mandatory and there is no bulk form.
   * @param {{kind: string, title: string, locator: string, tags?: string[], lists?: string[], source?: string, metadata?: object, consent: boolean, id?: string}} input - entity body.
   * @returns {object} public entity projection.
   */
  addEntity(input) {
    assert(input && typeof input === 'object', 'ENTITY_INVALID');
    assert(input.consent === true, 'CONSENT_REQUIRED');
    const kind = String(input.kind ?? '');
    assert(ENTITY_KINDS.includes(kind), 'ENTITY_KIND_INVALID');
    const source = String(input.source ?? 'manual');
    assert(ENTITY_SOURCES.includes(source), 'ENTITY_SOURCE_INVALID');
    const title = text(input.title, TITLE_MAX_LENGTH);
    assert(title.length > 0, 'TITLE_REQUIRED');
    assertNoCredentialValue(title);
    const locator = normalizeLocator(kind, input.locator);
    const tags = normalizeTags(input.tags).slice(0, ENTITY_TAG_LIMIT);
    const lists = this.#listIds(input.lists);
    const metadata = normalizeMetadata(input.metadata);
    const requestedId = typeof input.id === 'string' && input.id ? input.id : '';
    if (requestedId) assert(/^[A-Za-z0-9-]{8,64}$/u.test(requestedId), 'ENTITY_ID_INVALID');
    assert(!requestedId || !this.ledger.entities[requestedId], 'ENTITY_EXISTS');
    assert(Object.keys(this.ledger.entities).length < ENTITY_LIMIT, 'ENTITY_LIMIT_REACHED');
    const now = this.now().toISOString();
    const entity = {
      id: requestedId || this.newId(),
      kind,
      title,
      locator,
      tags,
      lists,
      source,
      createdAt: now,
      updatedAt: now,
      revision: 1,
      history: [],
      metadata,
    };
    entity.history = [revisionEntry(entity, now)];
    this.ledger.entities[entity.id] = entity;
    this.save();
    return publicEntity(entity);
  }

  /**
   * Update the editable fields of an entity. `kind` and `id` are immutable.
   * @param {string} id - entity id.
   * @param {object} patch - `title`, `locator`, `tags`, `metadata`, `source`.
   * @param {{consent: boolean}} options - explicit consent.
   * @returns {{entity: object, changed: boolean}} updated entity.
   */
  updateEntity(id, patch, {consent} = {}) {
    assert(consent === true, 'CONSENT_REQUIRED');
    const entity = this.ledger.entities[id];
    assert(entity, 'ENTITY_NOT_FOUND');
    assert(patch && typeof patch === 'object', 'ENTITY_INVALID');
    // `kind` decides which locator shape is legal, so changing it would silently
    // invalidate an existing pointer. Refuse instead of quietly ignoring it.
    assert(patch.kind === undefined || patch.kind === entity.kind, 'ENTITY_KIND_INVALID');
    assert(patch.id === undefined || patch.id === entity.id, 'ENTITY_ID_INVALID');
    const title = patch.title === undefined ? entity.title : text(patch.title, TITLE_MAX_LENGTH);
    assert(title.length > 0, 'TITLE_REQUIRED');
    assertNoCredentialValue(title);
    const locator = patch.locator === undefined ? entity.locator : normalizeLocator(entity.kind, patch.locator);
    const tags = patch.tags === undefined ? entity.tags : normalizeTags(patch.tags).slice(0, ENTITY_TAG_LIMIT);
    const metadata = patch.metadata === undefined ? entity.metadata : normalizeMetadata(patch.metadata);
    const source = patch.source === undefined ? entity.source : String(patch.source);
    assert(ENTITY_SOURCES.includes(source), 'ENTITY_SOURCE_INVALID');
    const changed =
      title !== entity.title ||
      locator !== entity.locator ||
      JSON.stringify(tags) !== JSON.stringify(entity.tags) ||
      JSON.stringify(metadata) !== JSON.stringify(entity.metadata) ||
      source !== entity.source;
    if (!changed) return {entity: publicEntity(entity), changed: false};
    entity.title = title;
    entity.locator = locator;
    entity.tags = tags;
    entity.metadata = metadata;
    entity.source = source;
    entity.revision += 1;
    entity.updatedAt = this.now().toISOString();
    entity.history = trimHistory([...(entity.history ?? []), revisionEntry(entity, entity.updatedAt)]);
    this.save();
    return {entity: publicEntity(entity), changed: true};
  }

  /**
   * Remove one entity (the registry never deletes the pointed-at content).
   * @param {string} id - entity id.
   * @param {{consent: boolean}} options - explicit consent.
   * @returns {{ok: true, id: string}} removal acknowledgement.
   */
  removeEntity(id, {consent} = {}) {
    assert(consent === true, 'CONSENT_REQUIRED');
    assert(this.ledger.entities[id], 'ENTITY_NOT_FOUND');
    delete this.ledger.entities[id];
    this.save();
    return {ok: true, id};
  }

  /**
   * Add or remove one tag on one entity.
   * @param {string} id - entity id.
   * @param {unknown} rawTag - tag candidate.
   * @param {{consent: boolean, add?: boolean}} options - explicit consent and direction.
   * @returns {{entity: object, changed: boolean}} updated entity.
   */
  setTag(id, rawTag, {consent, add = true} = {}) {
    assert(consent === true, 'CONSENT_REQUIRED');
    const entity = this.ledger.entities[id];
    assert(entity, 'ENTITY_NOT_FOUND');
    const tag = normalizeTag(rawTag);
    assert(tag, 'TAG_INVALID');
    const has = entity.tags.includes(tag);
    if (add && has) return {entity: publicEntity(entity), changed: false};
    if (!add && !has) return {entity: publicEntity(entity), changed: false};
    const tags = add
      ? [...entity.tags, tag].slice(0, ENTITY_TAG_LIMIT)
      : entity.tags.filter((candidate) => candidate !== tag);
    return this.updateEntity(id, {tags}, {consent: true});
  }

  /**
   * Create a List (a user collection, like a GitHub List/Stars collection).
   * @param {{name: string, description?: string, consent: boolean}} input - list body.
   * @returns {object} created list.
   */
  createList(input) {
    assert(input && typeof input === 'object', 'LIST_INVALID');
    assert(input.consent === true, 'CONSENT_REQUIRED');
    const name = text(input.name, LIST_NAME_MAX_LENGTH);
    assert(name.length > 0, 'LIST_NAME_REQUIRED');
    assertNoCredentialValue(name);
    const description = text(input.description, LIST_DESCRIPTION_MAX_LENGTH);
    if (description) assertNoCredentialValue(description);
    const existing = Object.values(this.ledger.lists);
    assert(existing.length < LIST_LIMIT, 'LIST_LIMIT_REACHED');
    assert(
      !existing.some((list) => list.name.toLowerCase() === name.toLowerCase()),
      'LIST_NAME_EXISTS',
    );
    const now = this.now().toISOString();
    const list = {id: this.newId(), name, description, createdAt: now, updatedAt: now};
    this.ledger.lists[list.id] = list;
    this.save();
    return {...list};
  }

  /**
   * Delete a List and detach it from every entity.
   * @param {string} id - list id.
   * @param {{consent: boolean}} options - explicit consent.
   * @returns {{ok: true, detached: number}} removal acknowledgement.
   */
  removeList(id, {consent} = {}) {
    assert(consent === true, 'CONSENT_REQUIRED');
    assert(this.ledger.lists[id], 'LIST_NOT_FOUND');
    delete this.ledger.lists[id];
    let detached = 0;
    const now = this.now().toISOString();
    for (const entity of Object.values(this.ledger.entities)) {
      if (!entity.lists.includes(id)) continue;
      entity.lists = entity.lists.filter((candidate) => candidate !== id);
      entity.updatedAt = now;
      detached += 1;
    }
    this.save();
    return {ok: true, detached};
  }

  /**
   * Add or remove one entity from one List. A single entity may belong to many
   * Lists, and one List may hold many entities.
   * @param {{listId: string, entityId: string, present?: boolean, consent: boolean}} input - membership change.
   * @returns {{entity: object, list: object, changed: boolean}} updated membership.
   */
  setMembership({listId, entityId, present = true, consent} = {}) {
    assert(consent === true, 'CONSENT_REQUIRED');
    const list = this.ledger.lists[listId];
    assert(list, 'LIST_NOT_FOUND');
    const entity = this.ledger.entities[entityId];
    assert(entity, 'ENTITY_NOT_FOUND');
    const has = entity.lists.includes(listId);
    if (present === has) return {entity: publicEntity(entity), list: {...list}, changed: false};
    if (present) {
      assert(entity.lists.length < ENTITY_LIST_LIMIT, 'ENTITY_LIST_LIMIT_REACHED');
      entity.lists = [...entity.lists, listId];
    } else {
      entity.lists = entity.lists.filter((candidate) => candidate !== listId);
    }
    entity.updatedAt = this.now().toISOString();
    list.updatedAt = entity.updatedAt;
    this.save();
    return {entity: publicEntity(entity), list: {...list}, changed: true};
  }

  /**
   * Query entities by kind, tag, List and a literal keyword over title/tag/locator.
   * @param {{kind?: string, tag?: string, list?: string, query?: string, limit?: number}} [filters] - ANDed filters.
   * @returns {{entities: object[], total: number, truncated: boolean}} matches.
   */
  query({kind = '', tag = '', list = '', query = '', limit = QUERY_LIMIT} = {}) {
    if (kind) assert(ENTITY_KINDS.includes(kind), 'ENTITY_KIND_INVALID');
    const tagFilter = typeof tag === 'string' && tag ? normalizeTag(tag) : '';
    if (list) assert(this.ledger.lists[list], 'LIST_NOT_FOUND');
    const needle = typeof query === 'string' ? query.normalize('NFKC').toLowerCase().trim().slice(0, 120) : '';
    const all = Object.values(this.ledger.entities).sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
    const matched = all.filter((entity) => {
      if (kind && entity.kind !== kind) return false;
      if (tagFilter && !entity.tags.includes(tagFilter)) return false;
      if (list && !entity.lists.includes(list)) return false;
      if (!needle) return true;
      return (
        entity.title.toLowerCase().includes(needle) ||
        entity.tags.some((candidate) => candidate.includes(needle)) ||
        entity.locator.toLowerCase().includes(needle)
      );
    });
    return {
      entities: matched.slice(0, limit).map(publicEntity),
      total: matched.length,
      truncated: matched.length > limit,
    };
  }

  /**
   * Multi-cluster graph over entities, clustered by tag. One entity with several
   * tags appears in several clusters, exactly like the knowledge graph.
   * @param {{maxClusters?: number}} [options] - cluster cap.
   * @returns {{clusters: object[], truncated: boolean, noteCount: number, tagCount: number, text: object}} graph.
   */
  graph({maxClusters = MAX_CLUSTERS} = {}) {
    const all = Object.values(this.ledger.entities).map((entity) => ({
      id: entity.id,
      title: entity.title,
      tags: entity.tags,
      kind: entity.kind,
      locator: entity.locator,
    }));
    const clusters = buildClusters(all, {maxClusters});
    const text = describeGraph(clusters);
    return {
      ...clusters,
      text,
      clusters: clusters.clusters.map((cluster) => ({...cluster, layout: layoutCluster(cluster)})),
    };
  }

  /**
   * Bounded revision index for one entity.
   * @param {string} id - entity id.
   * @returns {{id: string, revision: number, entries: object[]}} revision index.
   */
  revisions(id) {
    const entity = this.ledger.entities[id];
    assert(entity, 'ENTITY_NOT_FOUND');
    return {
      id,
      revision: entity.revision,
      entries: (entity.history ?? []).map((entry) => ({
        revision: entry.revision,
        at: entry.at,
        title: entry.title,
        tags: [...entry.tags],
        locator: entry.locator,
        sha256: {...entry.sha256},
      })),
    };
  }

  /**
   * Read one historical entity version.
   * @param {string} id - entity id.
   * @param {unknown} revision - positive revision number.
   * @returns {object} the stored revision entry.
   */
  readRevision(id, revision) {
    const entity = this.ledger.entities[id];
    assert(entity, 'ENTITY_NOT_FOUND');
    const wanted = Number(revision);
    assert(Number.isInteger(wanted) && wanted >= 1, 'REVISION_INVALID');
    const entry = (entity.history ?? []).find((candidate) => candidate.revision === wanted);
    assert(entry, 'REVISION_NOT_FOUND');
    return {...entry, tags: [...entry.tags], metadata: {...entry.metadata}};
  }

  /**
   * Restore a historical version as a new revision (history is never rewritten).
   * @param {string} id - entity id.
   * @param {unknown} revision - historical revision number.
   * @param {{consent: boolean}} options - explicit consent.
   * @returns {object} updated public entity.
   */
  restoreRevision(id, revision, {consent} = {}) {
    assert(consent === true, 'CONSENT_REQUIRED');
    const entry = this.readRevision(id, revision);
    const result = this.updateEntity(
      id,
      {title: entry.title, locator: entry.locator, tags: entry.tags, metadata: entry.metadata, source: entry.source},
      {consent: true},
    );
    return result.entity;
  }

  /**
   * Upsert the `kind: 'note'` entity for a knowledge note that was just committed
   * with explicit consent. Internal to the plugin: no extra consent step and no
   * additional user data beyond the note's own metadata.
   * @param {{id: string, title: string, tags: string[], relativePath: string, sha256: string}} note - committed note.
   * @returns {object|null} the registered entity, or `null` when it cannot be registered.
   */
  registerNote(note) {
    if (!note || typeof note.id !== 'string') return null;
    const existing = this.ledger.entities[note.id];
    const payload = {
      kind: 'note',
      title: note.title,
      locator: `ymzz:note/${note.id}`,
      tags: normalizeTags(note.tags).slice(0, ENTITY_TAG_LIMIT),
      source: 'manual',
      metadata: {relativePath: String(note.relativePath ?? '').slice(0, 400)},
    };
    if (existing) {
      const result = this.updateEntity(
        note.id,
        {title: payload.title, tags: payload.tags, locator: payload.locator, metadata: payload.metadata},
        {consent: true},
      );
      return result.entity;
    }
    if (Object.keys(this.ledger.entities).length >= ENTITY_LIMIT) return null;
    return this.addEntity({...payload, id: note.id, lists: [], consent: true});
  }

  /**
   * Drop the `kind: 'note'` entity for a note that was just revoked. Idempotent
   * and consent-free by design: it only ever removes plugin-owned bookkeeping in
   * direct consequence of a revoke the user already consented to.
   * @param {string} id - note id.
   * @returns {{removed: boolean}} whether an entity was dropped.
   */
  deregisterNote(id) {
    if (typeof id !== 'string' || !id) return {removed: false};
    const entity = this.ledger.entities[id];
    if (!entity || entity.kind !== 'note') return {removed: false};
    delete this.ledger.entities[id];
    this.save();
    return {removed: true};
  }

  /**
   * Tag facets over registered entities, most used first.
   * @returns {{tag: string, count: number}[]} tag index.
   */
  tagIndex() {
    const counts = new Map();
    for (const entity of Object.values(this.ledger.entities)) {
      for (const tag of entity.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([tag, count]) => ({tag, count}))
      .sort((a, b) => b.count - a.count || (a.tag < b.tag ? -1 : a.tag > b.tag ? 1 : 0));
  }

  /**
   * Cheap aggregate counts straight off the ledger (no public projections).
   * @returns {{entities: number, lists: number, tags: number, byKind: object}} counts.
   */
  counts() {
    const byKind = {};
    for (const kind of ENTITY_KINDS) byKind[kind] = 0;
    const tags = new Set();
    let entities = 0;
    for (const entity of Object.values(this.ledger.entities)) {
      entities += 1;
      byKind[entity.kind] = (byKind[entity.kind] ?? 0) + 1;
      for (const tag of entity.tags) tags.add(tag);
    }
    return {entities, lists: Object.keys(this.ledger.lists).length, tags: tags.size, byKind};
  }

  /** @returns {{version: number, entities: object[], lists: object[], graph: object, counts: object, limits: object, recoveredFrom: string|null}} bounded state. */
  state() {
    const entities = this.entities();
    return this.snapshot({entities});
  }

  /**
   * Bounded panel view: one page of entities plus the full tag index, List list
   * and pre-computed graph geometry.
   * @param {{limit?: number, kind?: string, tag?: string, list?: string, query?: string}} [filters] - filters and page size.
   * @returns {object} bounded registry state.
   */
  panel({limit = QUERY_LIMIT, kind = '', tag = '', list = '', query = ''} = {}) {
    const page = this.query({kind, tag, list, query, limit});
    const snapshot = this.snapshot({entities: page.entities});
    return {
      ...snapshot,
      entities: page.entities,
      total: page.total,
      truncated: page.truncated,
      tags: this.tagIndex(),
    };
  }

  /** Build the full bounded view from an already-built entity list. */
  snapshot({entities = this.entities()} = {}) {
    const lists = this.lists();
    const byKind = {};
    for (const kind of ENTITY_KINDS) byKind[kind] = 0;
    for (const entity of entities) byKind[entity.kind] = (byKind[entity.kind] ?? 0) + 1;
    return {
      version: TAG_REGISTRY_VERSION,
      entities,
      lists,
      kinds: [...ENTITY_KINDS],
      sources: [...ENTITY_SOURCES],
      graph: this.graph(),
      counts: {
        entities: entities.length,
        lists: lists.length,
        tags: new Set(entities.flatMap((entity) => entity.tags)).size,
        byKind,
      },
      limits: {
        entities: ENTITY_LIMIT,
        lists: LIST_LIMIT,
        tagsPerEntity: ENTITY_TAG_LIMIT,
        listsPerEntity: ENTITY_LIST_LIMIT,
        revisions: ENTITY_REVISION_LIMIT,
        clusters: MAX_CLUSTERS,
      },
      recoveredFrom: this.recoveredFrom,
    };
  }

  /** Validate requested List ids and return them de-duplicated. */
  #listIds(raw) {
    if (raw === undefined || raw === null) return [];
    assert(Array.isArray(raw), 'ENTITY_LISTS_INVALID');
    const out = [];
    for (const candidate of raw) {
      assert(typeof candidate === 'string' && candidate, 'ENTITY_LISTS_INVALID');
      assert(this.ledger.lists[candidate], 'LIST_NOT_FOUND');
      if (!out.includes(candidate)) out.push(candidate);
      assert(out.length <= ENTITY_LIST_LIMIT, 'ENTITY_LIST_LIMIT_REACHED');
    }
    return out;
  }
}
