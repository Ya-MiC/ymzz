// MIT. Local knowledge ledger: drafts, bounded revision history, human approval,
// immutable Vault commits, reversible trash and bounded retrieval. Single JSON
// file under DSH_HOME/ymzz.
import fs from 'node:fs';
import path from 'node:path';
import {randomUUID, createHash} from 'node:crypto';
import {assert} from './guard.mjs';
import {readLedgerJson, writeLedgerJson} from './ledger-json.mjs';
import {
  normalizeTags,
  normalizeLinks,
  renderKnowledgeNote,
  targetPathFor,
  TITLE_MAX_LENGTH,
  SUMMARY_MAX_LENGTH,
  SECTION_MAX_LENGTH,
  LINK_MAX_COUNT,
  TARGET_PATH_MAX_LENGTH,
} from './obsidian-markdown.mjs';
import {
  assertVaultRoot,
  normalizeRelativePath,
  writeNoteAtomic,
  readNote,
  noteExists,
  moveToTrash,
} from './knowledge-vault.mjs';
import {UNTAGGED_CLUSTER} from './knowledge-graph.mjs';

export const KNOWLEDGE_VERSION = 1;
export const DRAFT_LIMIT = 200;
export const NOTE_LIMIT = 2000;
export const SEARCH_LIMIT = 40;
/** Bounded per-draft edit history: newest kept, oldest dropped. */
export const REVISION_LIMIT = 20;
export const REVISION_HISTORY_BYTES = 524288;

const sha256 = (text) => createHash('sha256').update(String(text), 'utf8').digest('hex');

/** @returns {string} an empty ledger for a fresh profile. */
function emptyState() {
  return {version: KNOWLEDGE_VERSION, vault: null, drafts: {}, notes: {}, trash: []};
}

/** Reject a structurally broken ledger before it is trusted. */
function validateLedger(parsed) {
  assert(parsed.drafts && typeof parsed.drafts === 'object', 'LEDGER_INVALID');
  assert(parsed.notes && typeof parsed.notes === 'object', 'LEDGER_INVALID');
  assert(Array.isArray(parsed.trash), 'LEDGER_INVALID');
}

/** Capture the editable surface of one draft version plus its content hashes. */
function revisionEntry(draft, at) {
  return {
    revision: draft.revision,
    at,
    title: draft.title,
    summary: draft.summary,
    tags: [...draft.tags],
    links: [...draft.links],
    sections: {...draft.sections},
    targetPath: draft.targetPath,
    source: {...draft.source},
    sha256: {
      text: sha256(
        JSON.stringify({
          title: draft.title,
          summary: draft.summary,
          tags: draft.tags,
          links: draft.links,
          sections: draft.sections,
        }),
      ),
      tags: sha256(draft.tags.join('\n')),
      path: sha256(draft.targetPath),
    },
  };
}

/**
 * Keep the newest entries within both the count and the byte budget, but always
 * pin the first-ever revision. People delete and rewrite, so "give me back what I
 * first wrote" must survive an unbounded number of later edits.
 */
function trimHistory(history) {
  if (history.length <= 1) return history;
  const pinned = history[0];
  const kept = history.slice(1).slice(-(REVISION_LIMIT - 1));
  const combined = [pinned, ...kept];
  while (combined.length > 2 && Buffer.byteLength(JSON.stringify(combined), 'utf8') > REVISION_HISTORY_BYTES) {
    combined.splice(1, 1);
  }
  return combined;
}

/** Clip and normalise free text, returning `''` for anything unusable. */
function text(value, max) {
  if (typeof value !== 'string') return '';
  return value.replace(/\r\n?/gu, '\n').replace(/\u0000/gu, '').trim().slice(0, max);
}

/**
 * Validate and normalise one draft payload. Unknown fields are dropped; every
 * tag, link and section is bounded so the UI can never post an unbounded file.
 * @param {unknown} input - untrusted draft body.
 * @param {{id: string, now: string, previous?: object}} context - identity and prior draft.
 * @returns {{draft: object, changed: boolean}} normalised draft and whether its content changed.
 */
export function normalizeDraft(input, {id, now, previous}) {
  assert(input && typeof input === 'object' && !Array.isArray(input), 'DRAFT_INVALID');
  const title = text(input.title, TITLE_MAX_LENGTH);
  assert(title.length > 0, 'TITLE_REQUIRED');
  const summary = text(input.summary, SUMMARY_MAX_LENGTH);
  const tags = normalizeTags(input.tags);
  const links = normalizeLinks(input.links).slice(0, LINK_MAX_COUNT);
  const rawSections = input.sections && typeof input.sections === 'object' ? input.sections : {};
  const sections = {
    decisions: text(rawSections.decisions, SECTION_MAX_LENGTH),
    events: text(rawSections.events, SECTION_MAX_LENGTH),
    resources: text(rawSections.resources, SECTION_MAX_LENGTH),
    actions: text(rawSections.actions, SECTION_MAX_LENGTH),
  };
  const sourceInput = input.source && typeof input.source === 'object' ? input.source : {};
  const kind = sourceInput.kind === 'session' ? 'session' : 'manual';
  const source =
    kind === 'session'
      ? {
          kind,
          sessionId: text(sourceInput.sessionId, 160),
          sessionTitle: text(sourceInput.sessionTitle, TITLE_MAX_LENGTH),
          excerpt: text(sourceInput.excerpt, 4000),
        }
      : {kind: 'manual', excerpt: text(sourceInput.excerpt, 4000)};
  if (kind === 'session') assert(source.sessionId.length > 0, 'SOURCE_SESSION_REQUIRED');
  const requested = typeof input.targetPath === 'string' ? input.targetPath.trim() : '';
  let targetPath;
  if (requested) {
    assert(requested.length <= TARGET_PATH_MAX_LENGTH, 'TARGET_PATH_INVALID');
    targetPath = normalizeRelativePath(requested);
  } else if (previous && typeof previous.targetPath === 'string' && previous.targetPath) {
    targetPath = previous.targetPath;
  } else {
    targetPath = targetPathFor({title, id, created: now});
  }
  const createdAt = previous?.createdAt ?? now;
  const contentChanged =
    !previous ||
    previous.title !== title ||
    previous.summary !== summary ||
    JSON.stringify(previous.tags) !== JSON.stringify(tags) ||
    JSON.stringify(previous.links) !== JSON.stringify(links) ||
    JSON.stringify(previous.sections) !== JSON.stringify(sections) ||
    JSON.stringify(previous.source) !== JSON.stringify(source) ||
    previous.targetPath !== targetPath;
  return {
    draft: {
      id,
      title,
      summary,
      tags,
      links,
      sections,
      source,
      targetPath,
      createdAt,
      // `updated` feeds the rendered frontmatter, so a no-change save must keep
      // the previous timestamp: otherwise a re-render after approval silently
      // changes the hash and turns a valid approval into APPROVAL_STALE.
      updatedAt: contentChanged ? now : (previous?.updatedAt ?? now),
      status:
        previous?.status === 'committed'
          ? 'committed'
          : contentChanged
            ? 'draft'
            : (previous?.status ?? 'draft'),
      approvedSha256: contentChanged ? null : (previous?.approvedSha256 ?? null),
      approvedAt: contentChanged ? null : (previous?.approvedAt ?? null),
      approvedRevision: contentChanged ? null : (previous?.approvedRevision ?? null),
      revision: contentChanged ? (previous?.revision ?? 0) + 1 : (previous?.revision ?? 1),
      history: previous?.history ?? [],
      noteId: previous?.noteId ?? null,
    },
    changed: contentChanged,
  };
}

/** Present a stored draft without internal-only fields. */
export function publicDraft(draft) {
  return {
    id: draft.id,
    title: draft.title,
    summary: draft.summary,
    tags: [...draft.tags],
    links: [...draft.links],
    sections: {...draft.sections},
    source: {...draft.source},
    targetPath: draft.targetPath,
    createdAt: draft.createdAt,
    updatedAt: draft.updatedAt,
    status: draft.status,
    approvedSha256: draft.approvedSha256 ?? null,
    approvedAt: draft.approvedAt ?? null,
    approvedRevision: draft.approvedRevision ?? null,
    revision: draft.revision ?? 1,
    historyCount: Array.isArray(draft.history) ? draft.history.length : 0,
    latestRevisionSha256: Array.isArray(draft.history) && draft.history.length > 0 ? draft.history.at(-1).sha256 : null,
    noteId: draft.noteId ?? null,
  };
}

/** Present a stored note record with live existence, never its body. */
function publicNote(note, {root, vaultMatch = true}) {
  const exists = vaultMatch && root ? noteExists(root, note.relativePath) : false;
  return {
    id: note.id,
    title: note.title,
    summary: note.summary ?? '',
    tags: [...note.tags],
    links: [...note.links],
    relativePath: note.relativePath,
    sha256: note.sha256,
    createdAt: note.createdAt,
    committedAt: note.committedAt,
    source: {...note.source},
    vaultRoot: note.vaultRoot,
    vaultMatch,
    exists,
  };
}

/** Compare two absolute paths with the platform's case sensitivity. */
function samePath(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const left = path.resolve(a);
  const right = path.resolve(b);
  return process.platform === 'win32' ? left.toLowerCase() === right.toLowerCase() : left === right;
}

/**
 * The plugin-owned knowledge ledger.
 *
 * Every mutation rewrites a single JSON document through a same-directory temp
 * file and an atomic rename. Draft contents are persisted before approval; only
 * an explicit approval binds the final Markdown SHA256 that a commit may write.
 */
export class KnowledgeStore {
  /**
   * @param {{root: string, now?: () => Date, newId?: () => string, recoverCorrupt?: boolean,
   *   onNoteCommitted?: ((note: object) => void)|null, onNoteRevoked?: ((note: {id: string}) => void)|null}} options - storage, clocks and registry hooks.
   */
  constructor({
    root,
    now = () => new Date(),
    newId = () => randomUUID(),
    recoverCorrupt = true,
    onNoteCommitted = null,
    onNoteRevoked = null,
  }) {
    assert(typeof root === 'string' && path.isAbsolute(root), 'KNOWLEDGE_ROOT_INVALID');
    fs.mkdirSync(root, {recursive: true, mode: 0o700});
    this.root = root;
    this.filePath = path.join(root, 'knowledge.json');
    this.trashDir = path.join(root, 'knowledge-trash');
    this.now = now;
    this.newId = newId;
    this.onNoteCommitted = onNoteCommitted;
    this.onNoteRevoked = onNoteRevoked;
    this.recoveredFrom = null;
    const loaded = readLedgerJson(this.filePath, {
      version: KNOWLEDGE_VERSION,
      validate: validateLedger,
      recoverCorrupt,
    });
    this.recoveredFrom = loaded.recoveredFrom;
    this.state = loaded.state
      ? {
          version: KNOWLEDGE_VERSION,
          vault: loaded.state.vault && typeof loaded.state.vault === 'object' ? loaded.state.vault : null,
          drafts: loaded.state.drafts,
          notes: loaded.state.notes,
          trash: loaded.state.trash,
        }
      : emptyState();
  }

  /** Persist the whole ledger atomically. */
  save() {
    writeLedgerJson(this.filePath, this.state);
  }

  /**
   * Run a registry hook without ever letting it break a commit or a revoke.
   * The knowledge ledger is the source of truth; the tag registry is a
   * projection of it, so a registry failure must stay invisible here.
   * @param {Function|null} hook - callback.
   * @param {object} payload - note record.
   */
  #notify(hook, payload) {
    if (typeof hook !== 'function') return;
    try {
      hook(payload);
    } catch {}
  }

  /** @returns {{configured: boolean, path: string|null, available: boolean, reason: string}} Vault status. */
  vaultState() {
    const configured = Boolean(this.state.vault && typeof this.state.vault.path === 'string');
    if (!configured) return {configured: false, path: null, available: false, reason: 'VAULT_NOT_CONFIGURED'};
    const configuredPath = this.state.vault.path;
    try {
      const real = assertVaultRoot(configuredPath);
      return {configured: true, path: real, available: true, reason: ''};
    } catch (error) {
      return {configured: true, path: configuredPath, available: false, reason: error.message};
    }
  }

  /**
   * Point the ledger at an existing Vault directory.
   * @param {unknown} directory - absolute candidate directory.
   * @returns {{path: string}} the resolved Vault root.
   */
  setVault(directory) {
    const real = assertVaultRoot(directory);
    this.state.vault = {path: real, chosenAt: this.now().toISOString()};
    this.save();
    return {path: real};
  }

/**
 * Create or update one draft.
 * @param {object} input - untrusted draft body; `id` selects an update.
 * @returns {object} the public draft record.
 */
  saveDraft(input) {
    assert(input && typeof input === 'object', 'DRAFT_INVALID');
    const requestedId = typeof input.id === 'string' && input.id ? input.id : '';
    if (requestedId) assert(/^[A-Za-z0-9-]{8,64}$/u.test(requestedId), 'DRAFT_ID_INVALID');
    const previous = requestedId ? this.state.drafts[requestedId] : undefined;
    if (requestedId) assert(previous, 'DRAFT_NOT_FOUND');
    if (!previous) assert(this.#activeDraftCount() < DRAFT_LIMIT, 'DRAFT_LIMIT_REACHED');
    if (previous?.status === 'committed') assert(false, 'DRAFT_ALREADY_COMMITTED');
    const now = this.now().toISOString();
    const id = requestedId || this.newId();
    const {draft, changed} = normalizeDraft(input, {id, now, previous});
    if (!previous) {
      draft.revision = 1;
      draft.history = [];
    }
    if (changed) draft.history = trimHistory([...(previous?.history ?? []), revisionEntry(draft, now)]);
    this.state.drafts[id] = draft;
    this.save();
    return publicDraft(draft);
  }

  /**
   * Bounded edit history for one draft, newest last. Bodies are available through
   * {@link readRevision}; this list stays small enough for frequent polling.
   * @param {string} id - draft id.
   * @returns {{id: string, revision: number, entries: object[]}} revision index.
   */
  revisions(id) {
    const draft = this.state.drafts[id];
    assert(draft, 'DRAFT_NOT_FOUND');
    const history = Array.isArray(draft.history) ? draft.history : [];
    return {
      id,
      revision: draft.revision ?? 1,
      entries: history.map((entry) => ({
        revision: entry.revision,
        at: entry.at,
        title: entry.title,
        tags: [...entry.tags],
        targetPath: entry.targetPath,
        sha256: {...entry.sha256},
        bytes: Buffer.byteLength(JSON.stringify(entry), 'utf8'),
      })),
    };
  }

  /**
   * Read one historical version's full editable content. Approvals are never
   * inherited from history: an old version can only be re-approved explicitly.
   * @param {string} id - draft id.
   * @param {unknown} revision - positive integer revision number.
   * @returns {object} the stored revision entry.
   */
  readRevision(id, revision) {
    const draft = this.state.drafts[id];
    assert(draft, 'DRAFT_NOT_FOUND');
    const wanted = Number(revision);
    assert(Number.isInteger(wanted) && wanted >= 1, 'REVISION_INVALID');
    const entry = (draft.history ?? []).find((candidate) => candidate.revision === wanted);
    assert(entry, 'REVISION_NOT_FOUND');
    return {...entry, tags: [...entry.tags], links: [...entry.links], sections: {...entry.sections}, source: {...entry.source}};
  }

  /**
   * Restore an old version as a NEW revision (never rewrites history). The new
   * revision drops any approval, so commit requires a fresh explicit approval.
   * @param {string} id - draft id to restore into.
   * @param {unknown} revision - historical revision to take content from.
   * @param {{asNew?: boolean}} [options] - `asNew` creates a separate draft instead.
   * @returns {object} the public draft that now holds the restored content.
   */
  restoreRevision(id, revision, {asNew = false} = {}) {
    const source = this.readRevision(id, revision);
    const now = this.now().toISOString();
    if (asNew) {
      assert(this.#activeDraftCount() < DRAFT_LIMIT, 'DRAFT_LIMIT_REACHED');
      const newId = this.newId();
      const {draft} = normalizeDraft(
        {
          title: source.title,
          summary: source.summary,
          tags: source.tags,
          links: source.links,
          sections: source.sections,
          targetPath: '',
          source: source.source,
        },
        {id: newId, now, previous: undefined},
      );
      draft.revision = 1;
      draft.history = [revisionEntry(draft, now)];
      this.state.drafts[newId] = draft;
      this.save();
      return publicDraft(draft);
    }
    const current = this.state.drafts[id];
    assert(current.status !== 'committed', 'COMMITTED_DRAFT_LOCKED');
    const {draft, changed} = normalizeDraft(
      {
        title: source.title,
        summary: source.summary,
        tags: source.tags,
        links: source.links,
        sections: source.sections,
        targetPath: source.targetPath,
        source: source.source,
      },
      {id, now, previous: current},
    );
    if (!changed) return publicDraft(current);
    draft.history = trimHistory([...(current.history ?? []), revisionEntry(draft, now)]);
    this.state.drafts[id] = draft;
    this.save();
    return publicDraft(draft);
  }

  /** @returns {number} drafts that still occupy the quota. Only unfinished
   * drafts count: committed and revoked records are history, and the 201st
   * note must never be permanently blocked behind them. */
  #activeDraftCount() {
    return Object.values(this.state.drafts).filter(
      (draft) => draft.status !== 'committed' && draft.status !== 'revoked',
    ).length;
  }

  /**
   * Remove a draft record. A committed draft may only be removed as an archive
   * shell while its note record still exists; that frees the quota without
   * touching the Vault file, the note record or the trash.
   * @param {string} id - draft id.
   * @returns {{ok: true}} removal acknowledgement.
   */
  deleteDraft(id) {
    const draft = this.state.drafts[id];
    assert(draft, 'DRAFT_NOT_FOUND');
    if (draft.status === 'committed') {
      assert(draft.noteId && this.state.notes[draft.noteId], 'COMMITTED_DRAFT_LOCKED');
    }
    delete this.state.drafts[id];
    this.save();
    return {ok: true};
  }

  /** @returns {object[]} drafts, newest first. */
  drafts() {
    return Object.values(this.state.drafts)
      .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0))
      .map(publicDraft);
  }

  /**
   * Bind the current rendered Markdown hash to a draft. Nothing is written to
   * the Vault here, and any later edit invalidates this approval.
   * @param {string} id - draft id.
   * @returns {{id: string, sha256: string, approvedAt: string}} approval receipt.
   */
  approve(id) {
    const draft = this.state.drafts[id];
    assert(draft, 'DRAFT_NOT_FOUND');
    assert(draft.status !== 'committed', 'DRAFT_ALREADY_COMMITTED');
    const rendered = renderKnowledgeNote(draft);
    draft.approvedSha256 = rendered.sha256;
    draft.approvedAt = this.now().toISOString();
    draft.approvedRevision = draft.revision ?? 1;
    draft.status = 'approved';
    this.save();
    return {
      id,
      sha256: rendered.sha256,
      approvedAt: draft.approvedAt,
      approvedRevision: draft.approvedRevision,
      revision: draft.revision ?? 1,
      byteLength: rendered.byteLength,
    };
  }

  /**
   * Write an approved draft into the configured Vault. Re-renders, re-checks the
   * approved hash, never overwrites, and is idempotent for an already-committed
   * draft.
   * @param {string} id - draft id.
   * @param {{consent: boolean}} options - explicit human consent.
   * @returns {{note: object, idempotent: boolean}} committed note record.
   */
  commit(id, {consent} = {}) {
    assert(consent === true, 'CONSENT_REQUIRED');
    const draft = this.state.drafts[id];
    assert(draft, 'DRAFT_NOT_FOUND');
    const vault = this.vaultState();
    if (draft.status === 'committed' && draft.noteId) {
      const existing = this.state.notes[draft.noteId];
      if (existing) {
        const vaultMatch = vault.available ? samePath(existing.vaultRoot, vault.path) : true;
        // Re-register on the idempotent path too: it heals a registry that was
        // reset or recovered from corruption without touching the note itself.
        this.#notify(this.onNoteCommitted, existing);
        return {note: publicNote(existing, {root: existing.vaultRoot, vaultMatch}), idempotent: true};
      }
    }
    assert(vault.available, vault.reason || 'VAULT_NOT_CONFIGURED');
    assert(draft.status === 'approved' && draft.approvedSha256, 'APPROVAL_REQUIRED');
    // An approval only covers the exact revision it was granted on: restoring an
    // older version bumps the revision and therefore cannot ride an old approval.
    assert(
      draft.approvedRevision === undefined || draft.approvedRevision === null || draft.approvedRevision === draft.revision,
      'APPROVAL_STALE',
    );
    assert(Object.keys(this.state.notes).length < NOTE_LIMIT, 'NOTE_LIMIT_REACHED');
    const rendered = renderKnowledgeNote(draft);
    assert(rendered.sha256 === draft.approvedSha256, 'APPROVAL_STALE');
    const written = writeNoteAtomic(vault.path, draft.targetPath, rendered.markdown, {
      expectedSha256: rendered.sha256,
    });
    const committedAt = this.now().toISOString();
    const note = {
      id: draft.id,
      title: draft.title,
      summary: draft.summary,
      tags: [...draft.tags],
      links: [...draft.links],
      relativePath: written.relativePath,
      sha256: written.sha256,
      byteLength: written.byteLength,
      createdAt: draft.createdAt,
      committedAt,
      source: {...draft.source},
      vaultRoot: vault.path,
    };
    this.state.notes[note.id] = note;
    draft.status = 'committed';
    draft.noteId = note.id;
    this.save();
    // A committed note is a first-class `kind: 'note'` entity: the tag panel has
    // exactly one data source, so the registry is fed here, never by a scan.
    this.#notify(this.onNoteCommitted, note);
    return {note: publicNote(note, {root: vault.path}), idempotent: false};
  }

  /**
   * Move a plugin-published, still-unchanged note into the local trash.
   * @param {string} id - note id.
   * @param {{consent: boolean}} options - explicit human consent.
   * @returns {{ok: true, trashPath: string, sha256: string}} revocation receipt.
   */
  revoke(id, {consent} = {}) {
    assert(consent === true, 'CONSENT_REQUIRED');
    const note = this.state.notes[id];
    assert(note, 'NOTE_REQUIRED');
    const moved = moveToTrash({
      root: note.vaultRoot,
      relative: note.relativePath,
      trashDir: this.trashDir,
      expectedSha256: note.sha256,
      now: this.now(),
    });
    delete this.state.notes[id];
    const draft = this.state.drafts[id];
    if (draft) draft.status = 'revoked';
    this.state.trash.push({
      id,
      title: note.title,
      relativePath: note.relativePath,
      sha256: note.sha256,
      trashPath: moved.trashPath,
      revokedAt: this.now().toISOString(),
    });
    if (this.state.trash.length > NOTE_LIMIT) this.state.trash = this.state.trash.slice(-NOTE_LIMIT);
    this.save();
    // The note no longer exists in the Vault, so its registry entity must not
    // linger as a dead pointer.
    this.#notify(this.onNoteRevoked, {id});
    return {ok: true, trashPath: moved.trashPath, sha256: moved.sha256};
  }

  /** @returns {object[]} committed notes that still exist in the current Vault. */
  notes() {
    const vault = this.vaultState();
    return Object.values(this.state.notes)
      .map((note) => {
        const vaultMatch = vault.available ? samePath(note.vaultRoot, vault.path) : true;
        return publicNote(note, {root: vault.available ? vault.path : null, vaultMatch});
      })
      .sort((a, b) => (a.committedAt < b.committedAt ? 1 : a.committedAt > b.committedAt ? -1 : 0));
  }

  /**
   * Case-insensitive search over title, tags and body of committed notes that
   * still exist in the current Vault.
   * @param {{query?: string, tag?: string, limit?: number}} [options] - literal query and tag filter.
   * @returns {{notes: object[], truncated: boolean}} matching notes with snippets.
   */
  search({query = '', tag = '', limit = SEARCH_LIMIT} = {}) {
    const vault = this.vaultState();
    assert(vault.available, vault.reason || 'VAULT_NOT_CONFIGURED');
    const needle = typeof query === 'string' ? query.normalize('NFKC').toLowerCase().trim().slice(0, 120) : '';
    const tagFilter =
      typeof tag === 'string' && tag === UNTAGGED_CLUSTER ? UNTAGGED_CLUSTER : (typeof tag === 'string' ? normalizeTags([tag])[0] ?? '' : '');
    const results = [];
    let matched = 0;
    for (const note of Object.values(this.state.notes)) {
      // A note committed into a previously selected Vault is not "in the current
      // Vault"; its relative path must never be re-read from a different root.
      if (!samePath(note.vaultRoot, vault.path)) continue;
      if (tagFilter === UNTAGGED_CLUSTER) {
        if (note.tags.length > 0) continue;
      } else if (tagFilter && !note.tags.includes(tagFilter)) {
        continue;
      }
      let body;
      try {
        body = readNote(vault.path, note.relativePath);
      } catch {
        continue;
      }
      if (needle) {
        const inTitle = note.title.toLowerCase().includes(needle);
        const inTags = note.tags.some((value) => value.includes(needle));
        const inBody = body.text.toLowerCase().includes(needle);
        if (!inTitle && !inTags && !inBody) continue;
      }
      matched += 1;
      if (results.length >= limit) continue;
      results.push({
        id: note.id,
        title: note.title,
        tags: [...note.tags],
        relativePath: note.relativePath,
        sha256: note.sha256,
        committedAt: note.committedAt,
        snippet: snippetFor(note, body.text, needle),
      });
    }
    return {notes: results, truncated: matched > results.length};
  }

  /**
   * Read one committed note's Markdown from disk.
   * @param {string} id - note id.
   * @returns {{id: string, title: string, tags: string[], relativePath: string, markdown: string, sha256: string, modified: boolean}} opened note.
   */
  open(id) {
    const note = this.state.notes[id];
    assert(note, 'NOTE_REQUIRED');
    const body = readNote(note.vaultRoot, note.relativePath);
    return {
      id: note.id,
      title: note.title,
      tags: [...note.tags],
      relativePath: note.relativePath,
      markdown: body.text,
      sha256: body.sha256,
      modified: body.sha256 !== note.sha256,
    };
  }

  /** @returns {{drafts: object[], notes: object[], vault: object, trash: object[], recoveredFrom: string|null}} bounded ledger view. */
  snapshot({draftLimit = DRAFT_LIMIT, noteLimit = NOTE_LIMIT} = {}) {
    return {
      drafts: this.drafts().slice(0, draftLimit),
      notes: this.notes().slice(0, noteLimit),
      vault: this.vaultState(),
      trash: this.state.trash.slice(-20),
      recoveredFrom: this.recoveredFrom,
    };
  }
}

/** Build a short, single-line context snippet for one note. */
function snippetFor(note, markdown, needle) {
  const body = markdown
    .replace(/^---[\s\S]*?---\s*/u, '')
    .replace(/^#{1,6}\s+/gmu, '')
    .replace(/\r\n?/gu, '\n');
  const lines = body.split('\n').map((line) => line.trim()).filter(Boolean);
  if (needle) {
    const hit = lines.find((line) => line.toLowerCase().includes(needle));
    if (hit) return hit.slice(0, 160);
  }
  return (note.summary || lines[0] || note.title).slice(0, 160);
}
