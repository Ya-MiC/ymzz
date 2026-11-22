// MIT. Feature service: drafts -> approval -> Vault commit -> search/revoke, plus
// optional native session reads, the multi-nebula projection and the MCP audit.
// Every native dependency is resolved lazily so a Host without one still loads.
import {assert} from './guard.mjs';
import {KnowledgeStore, DRAFT_LIMIT, NOTE_LIMIT, SEARCH_LIMIT} from './knowledge-store.mjs';
import {buildClusters, describeGraph, layoutCluster, MAX_CLUSTERS} from './knowledge-graph.mjs';
import {mcpSnapshot, probeServer, restartServer} from './mcp-audit.mjs';
import {suggestTags, normalizeTags, renderKnowledgeNote} from './obsidian-markdown.mjs';
import {
  TagRegistry,
  ENTITY_KINDS,
  ENTITY_SOURCES,
  ENTITY_LIMIT,
  ENTITY_TAG_LIMIT,
  ENTITY_LIST_LIMIT,
  LIST_LIMIT,
  QUERY_LIMIT,
} from './tag-registry.mjs';

const SESSION_ID = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,159}$/u;

/** Extract the user/assistant text of one session event, defensively. */
export function sessionEventText(event) {
  const type = event?.type;
  const data = event?.data;
  if (!data || typeof data !== 'object') return '';
  if (type === 'user/message') return contentText(data.content);
  if (type === 'assistant/message') return contentText(data.message?.content);
  if (type === 'todo/write') {
    return Array.isArray(data.todos)
      ? data.todos.map((todo) => (typeof todo?.content === 'string' ? todo.content : '')).filter(Boolean).join('\n')
      : '';
  }
  return '';
}

/** Flatten message content parts to plain text. */
function contentText(content) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  const parts = [];
  for (const part of content) {
    if (!part || typeof part !== 'object') continue;
    if (part.type === 'text' && typeof part.text === 'string') parts.push(part.text);
  }
  return parts.join('\n');
}

/**
 * The knowledge feature service. It owns one ledger plus the generic tag
 * registry and exposes only bounded, explicitly authorised operations to the
 * authenticated plugin routes.
 */
export class KnowledgeService {
  /**
   * @param {{ctx?: object|null, root: string, now?: () => Date, newId?: () => string, sessionsLimit?: number, excerptLimit?: number}} options - context and storage.
   */
  constructor({ctx = null, root, now = () => new Date(), newId, sessionsLimit = 20, excerptLimit = 8000}) {
    this.ctx = ctx;
    this.sessionsLimit = sessionsLimit;
    this.excerptLimit = excerptLimit;
    const clock = newId ? {now, newId} : {now};
    // The registry is the panel's single data source. Committed notes are fed into
    // it from the commit path, so nothing is ever gathered by scanning a disk.
    this.registry = new TagRegistry({root, ...clock});
    this.store = new KnowledgeStore({
      root,
      ...clock,
      onNoteCommitted: (note) => this.registry.registerNote(note),
      onNoteRevoked: (note) => this.registry.deregisterNote(note?.id),
    });
  }

  /** Resolve the optional native session-query service, or `null`. */
  sessionQuery() {
    const ctx = this.ctx;
    if (!ctx) return null;
    try {
      const direct = ctx.sessionQuery;
      if (direct && typeof direct.listSessions === 'function') return direct;
    } catch {}
    try {
      if (typeof ctx.get === 'function') {
        const viaGet = ctx.get('sessionQuery');
        if (viaGet && typeof viaGet.listSessions === 'function') return viaGet;
      }
    } catch {}
    return null;
  }

  /**
   * Bounded view for the right-hand dock: drafts, committed notes, graph, Vault
   * status and MCP status. Never reads note bodies or session history.
   * @returns {object} knowledge state.
   */
  state() {
    const snapshot = this.store.snapshot({draftLimit: DRAFT_LIMIT, noteLimit: NOTE_LIMIT});
    const usable = snapshot.notes.filter((note) => note.exists);
    const clusters = buildClusters(usable, {maxClusters: MAX_CLUSTERS});
    const text = describeGraph(clusters);
    // Geometry is computed once on the Host so the panel cannot drift from it.
    const graph = {
      ...clusters,
      text,
      clusters: clusters.clusters.map((cluster) => ({...cluster, layout: layoutCluster(cluster)})),
    };
    return {
      version: 1,
      vault: snapshot.vault,
      drafts: snapshot.drafts,
      notes: snapshot.notes,
      trash: snapshot.trash,
      recoveredFrom: snapshot.recoveredFrom,
      graph,
      mcp: mcpSnapshot(this.ctx),
      sessions: {available: Boolean(this.sessionQuery())},
      tags: this.registrySummary(),
      limits: {
        drafts: DRAFT_LIMIT,
        notes: NOTE_LIMIT,
        search: SEARCH_LIMIT,
        clusters: MAX_CLUSTERS,
        excerpt: this.excerptLimit,
        sessions: this.sessionsLimit,
      },
    };
  }

  /** @returns {object[]} drafts, newest first. */
  drafts() {
    return this.store.drafts();
  }

  /**
   * Create or update a draft, optionally seeding suggested tags from explicit
   * `#tag` text the user pasted. Suggestions are literal extraction only.
   * @param {object} input - draft body.
   * @returns {{draft: object, suggestedTags: string[]}} saved draft and suggestions.
   */
  saveDraft(input) {
    const draft = this.store.saveDraft(input);
    const haystack = [draft.title, draft.summary, ...Object.values(draft.sections), draft.source?.excerpt ?? '']
      .filter(Boolean)
      .join('\n');
    const suggestedTags = suggestTags(haystack, {existing: draft.tags});
    return {draft, suggestedTags};
  }

  /**
   * Bind the final Markdown hash. Returns a preview so the user sees exactly
   * what will be written before consenting.
   * @param {string} id - draft id.
   * @returns {{id: string, sha256: string, approvedAt: string, markdown: string, byteLength: number}} approval.
   */
  approve(id) {
    const receipt = this.store.approve(id);
    const rendered = renderKnowledgeNote(this.store.state.drafts[id]);
    return {...receipt, markdown: rendered.markdown};
  }

  /** Remove a never-committed draft. */
  deleteDraft(id) {
    return this.store.deleteDraft(id);
  }

  /** Write an approved draft into the Vault. */
  commit(id, {consent} = {}) {
    return this.store.commit(id, {consent});
  }

  /** Move a plugin-published, unchanged note into local trash. */
  revoke(id, {consent} = {}) {
    return this.store.revoke(id, {consent});
  }

  /** Literal, case-insensitive search over committed notes still on disk. */
  search({query = '', tag = ''} = {}) {
    return this.store.search({query, tag});
  }

  /** Open one committed note's raw Markdown. */
  open(id) {
    return this.store.open(id);
  }

  /** Point the ledger at a real Vault directory. */
  setVault(directory, {consent} = {}) {
    assert(consent === true, 'CONSENT_REQUIRED');
    return this.store.setVault(directory);
  }

  /** MCP status snapshot (never writes configuration). */
  mcp() {
    return mcpSnapshot(this.ctx);
  }

  /** Probe one native MCP server. */
  async probeMcp(name) {
    return probeServer(this.ctx, name);
  }

  /** Restart one native MCP server through the native manager. */
  async restartMcp(name) {
    return restartServer(this.ctx, name);
  }

  // --- Generic tag registry: the panel's single data source -------------------

  /**
   * Compact registry summary embedded in the polled knowledge state. Carries
   * counts, tag facets and Lists only: no entity page, no graph geometry.
   * @returns {object} bounded summary.
   */
  registrySummary() {
    return {
      counts: this.registry.counts(),
      tags: this.registry.tagIndex().slice(0, 200),
      lists: this.registry.lists(),
      limits: {
        entities: ENTITY_LIMIT,
        lists: LIST_LIMIT,
        tagsPerEntity: ENTITY_TAG_LIMIT,
        listsPerEntity: ENTITY_LIST_LIMIT,
        clusters: MAX_CLUSTERS,
      },
      kinds: [...ENTITY_KINDS],
      sources: [...ENTITY_SOURCES],
      recoveredFrom: this.registry.recoveredFrom,
    };
  }

  /**
   * Bounded registry page for the tag panel: entities, Lists, tag index and the
   * multi-cluster nebula with Host-computed geometry.
   * @param {{limit?: number, kind?: string, tag?: string, list?: string, query?: string}} [filters] - filters and page size.
   * @returns {object} bounded registry state.
   */
  tagState({limit = QUERY_LIMIT, kind = '', tag = '', list = '', query = ''} = {}) {
    // The page size is caller-supplied over HTTP, so clamp it instead of trusting it.
    const size = Math.min(200, Math.max(1, Number(limit) || QUERY_LIMIT));
    return this.registry.panel({limit: size, kind, tag, list, query});
  }

  /**
   * Query registered entities by kind, tag, List and literal keyword.
   * @param {object} [filters] - ANDed filters.
   * @returns {{entities: object[], total: number, truncated: boolean}} matches.
   */
  queryTags(filters = {}) {
    return this.registry.query(filters);
  }

  /**
   * Resolve a clicked nebula node or entity id to the pointer that opens it.
   * @param {unknown} id - entity id.
   * @returns {object} locator payload, plus note details for `kind: 'note'`.
   */
  locateEntity(id) {
    assert(typeof id === 'string' && id.length > 0, 'ENTITY_ID_INVALID');
    const resolved = this.registry.resolve(id);
    if (resolved.kind === 'note') {
      const noteId = resolved.locator.replace(/^ymzz:note\//u, '');
      const note = this.store.state.notes[noteId];
      return {
        ...resolved,
        noteId,
        relativePath: note?.relativePath ?? '',
        openable: Boolean(note),
      };
    }
    return {...resolved, openable: true};
  }

  /**
   * Explicitly register one entity. Consent is mandatory: nothing is collected by
   * scanning, crawling or reading history.
   * @param {object} input - kind, title, locator, tags, lists, source, metadata.
   * @returns {object} the registered entity.
   */
  addEntity(input) {
    assert(input && typeof input === 'object', 'ENTITY_INVALID');
    assert(input.consent === true, 'CONSENT_REQUIRED');
    return this.registry.addEntity(input);
  }

  /** Update one entity's editable fields (`kind`/`id` are immutable). */
  updateEntity(id, patch, {consent} = {}) {
    assert(consent === true, 'CONSENT_REQUIRED');
    return this.registry.updateEntity(id, patch, {consent: true});
  }

  /** Remove one entity from the registry (never the content it points at). */
  removeEntity(id, {consent} = {}) {
    assert(consent === true, 'CONSENT_REQUIRED');
    return this.registry.removeEntity(id, {consent: true});
  }

  /** Add or remove one tag on one entity. */
  setTag(id, tag, {consent, add = true} = {}) {
    assert(consent === true, 'CONSENT_REQUIRED');
    return this.registry.setTag(id, tag, {consent: true, add});
  }

  /** Create a user List (a collection an entity can belong to several of). */
  createList(input) {
    assert(input && typeof input === 'object', 'ENTITY_INVALID');
    assert(input.consent === true, 'CONSENT_REQUIRED');
    return this.registry.createList(input);
  }

  /** Delete a List and detach it from every entity. */
  removeList(id, {consent} = {}) {
    assert(consent === true, 'CONSENT_REQUIRED');
    return this.registry.removeList(id, {consent: true});
  }

  /** Add or remove one entity from one List. */
  setMembership(input) {
    assert(input && typeof input === 'object', 'ENTITY_INVALID');
    assert(input.consent === true, 'CONSENT_REQUIRED');
    return this.registry.setMembership(input);
  }

  /** Bounded revision index for one entity. */
  entityRevisions(id) {
    return this.registry.revisions(id);
  }

  /** Restore an older entity version as a new revision. */
  restoreEntityRevision(id, revision, {consent} = {}) {
    assert(consent === true, 'CONSENT_REQUIRED');
    return this.registry.restoreRevision(id, revision, {consent: true});
  }

  /**
   * List the most recent native sessions with titles. Degrades to
   * `available: false` when the Host does not compose `ctx.sessionQuery`.
   * @returns {Promise<{available: boolean, reason: string, items: object[]}>} bounded session list.
   */
  async listSessions() {
    const query = this.sessionQuery();
    if (!query) return {available: false, reason: 'SESSION_QUERY_UNAVAILABLE', items: []};
    let records;
    try {
      records = await query.listSessions();
    } catch (error) {
      return {available: false, reason: 'SESSION_QUERY_FAILED', detail: safeMessage(error), items: []};
    }
    const sorted = (Array.isArray(records) ? records : [])
      .filter((record) => record && typeof record?.header?.id === 'string')
      .sort((a, b) => (Number(b.header.createdAt) || 0) - (Number(a.header.createdAt) || 0))
      .slice(0, this.sessionsLimit);
    if (sorted.length === 0) return {available: true, reason: '', items: []};
    const ids = sorted.map((record) => record.header.id);
    const titles = new Map();
    try {
      const observations = await query.readTitleSnapshots(ids);
      for (const observation of Array.isArray(observations) ? observations : []) {
        if (observation?.status === 'fulfilled' && observation.value?.session?.id) {
          titles.set(observation.value.session.id, observation.value);
        }
      }
    } catch {}
    const items = sorted.map((record) => {
      const header = record.header;
      const title = titles.get(header.id);
      return {
        id: header.id,
        title: typeof title?.title === 'string' && title.title.trim() ? title.title.trim() : '未命名會話',
        cwd: typeof header.cwd === 'string' ? header.cwd : '',
        createdAt: Number(header.createdAt) || 0,
        updatedAt: Number(title?.updatedAt) || Number(header.createdAt) || 0,
        live: record.live === true,
      };
    });
    return {available: true, reason: '', items};
  }

  /**
   * Read one session and keep only bounded user/assistant text.
   * @param {unknown} id - session id.
   * @returns {Promise<{id: string, title: string, text: string, truncated: boolean, eventCount: number}>} bounded transcript.
   */
  async readSession(id) {
    const query = this.sessionQuery();
    assert(query, 'SESSION_QUERY_UNAVAILABLE');
    assert(typeof id === 'string' && SESSION_ID.test(id), 'SESSION_ID_INVALID');
    let snapshot;
    try {
      snapshot = await query.readSession(id);
    } catch (error) {
      if (typeof error?.code === 'string' && /^[A-Z][A-Z0-9_]+$/u.test(error.code)) throw new Error(error.code);
      throw new Error('SESSION_READ_FAILED');
    }
    const events = Array.isArray(snapshot?.events) ? snapshot.events : [];
    const start = Math.max(0, events.length - 240);
    const chunks = [];
    let total = 0;
    let truncated = start > 0;
    for (let index = start; index < events.length; index += 1) {
      const piece = sessionEventText(events[index]);
      if (!piece) continue;
      const bounded = piece.length > 2000 ? `${piece.slice(0, 2000)}…` : piece;
      if (total + bounded.length > this.excerptLimit) {
        truncated = true;
        break;
      }
      chunks.push(bounded);
      total += bounded.length;
    }
    let title = '';
    try {
      const observations = await query.readTitleSnapshots([id]);
      const first = Array.isArray(observations) ? observations[0] : undefined;
      if (first?.status === 'fulfilled' && typeof first.value?.title === 'string') title = first.value.title.trim();
    } catch {}
    return {id, title, text: chunks.join('\n\n'), truncated, eventCount: events.length};
  }

  /**
   * Suggest tags for a pasted text or session excerpt. Only explicit `#tag`
   * occurrences count; nothing is inferred.
   * @param {{text: string, existingTags?: string[]}} input - literal text.
   * @returns {{tags: string[]}} suggestions.
   */
  suggestTags({text, existingTags = []} = {}) {
    assert(typeof text === 'string', 'TEXT_REQUIRED');
    return {tags: suggestTags(text.slice(0, 40000), {existing: normalizeTags(existingTags)})};
  }
}

/** Keep native error text short and free of stack frames. */
function safeMessage(error) {
  const message = typeof error?.message === 'string' ? error.message : String(error ?? '');
  return message.replace(/\s+/gu, ' ').trim().slice(0, 200);
}
