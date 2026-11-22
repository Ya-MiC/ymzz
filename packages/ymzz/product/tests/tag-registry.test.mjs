// MIT. Generic tag registry units: kinds, locators, metadata privacy, Lists
// many-to-many, query, multi-cluster graph, persistence and revisions.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {TagRegistry, ENTITY_KINDS, normalizeLocator, normalizeMetadata} from '../tag-registry.mjs';
import {normalizeTag} from '../obsidian-markdown.mjs';

const sha = (text) => createHash('sha256').update(String(text), 'utf8').digest('hex');

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), '湛箴 標籤 registry '));
  t.after(() => fs.rmSync(root, {recursive: true, force: true}));
  let tick = 0;
  let counter = 0;
  const registry = new TagRegistry({
    root,
    now: () => new Date(Date.UTC(2026, 10, 22, 6, 0, tick++)),
    newId: () => `entity-${String(++counter).padStart(4, '0')}`,
  });
  return {root, registry};
}

const base = (overrides = {}) => ({
  kind: 'web',
  title: '現代網頁指南',
  locator: 'https://example.com/guide',
  tags: ['Web', ' 指南 '],
  source: 'web',
  consent: true,
  ...overrides,
});

test('all eight kinds register and unknown kinds or sources are refused', (t) => {
  const {registry} = fixture(t);
  const locators = {
    session: 'dsh:session/session-1',
    message: 'dsh:session/session-1#12',
    thought: 'dsh:session/session-1#13',
    web: 'https://example.com/a',
    file: path.resolve('/tmp/湛箴 檔案.txt'),
    artifact: 'https://example.com/out.zip',
    note: 'ymzz:note/abcdef12-3456',
    task: 'ymzz:task/abc123',
  };
  for (const kind of ENTITY_KINDS) {
    const entity = registry.addEntity(base({kind, locator: locators[kind], source: kind === 'note' || kind === 'task' ? 'manual' : 'dsh'}));
    assert.equal(entity.kind, kind);
    assert.equal(entity.locator, locators[kind]);
    assert.equal(entity.revision, 1);
    assert.deepEqual(entity.tags, ['web', '指南']);
  }
  assert.equal(registry.entities().length, 8);
  assert.throws(() => registry.addEntity(base({kind: 'chain-of-thought'})), /ENTITY_KIND_INVALID/);
  assert.throws(() => registry.addEntity(base({source: 'crawler'})), /ENTITY_SOURCE_INVALID/);
  assert.throws(() => registry.addEntity(base({title: '   '})), /TITLE_REQUIRED/);
  assert.throws(() => registry.addEntity(base({consent: false})), /CONSENT_REQUIRED/);
});

test('locators are validated per kind and never carry credentials', () => {
  assert.equal(normalizeLocator('web', 'https://example.com/x?y=1'), 'https://example.com/x?y=1');
  assert.throws(() => normalizeLocator('web', 'javascript:alert(1)'), /LOCATOR_URL_REQUIRED/);
  assert.throws(() => normalizeLocator('web', 'https://user:pass@example.com/'), /LOCATOR_CREDENTIALS_FORBIDDEN/);
  assert.throws(() => normalizeLocator('web', 'example.com/no-scheme'), /LOCATOR_URL_REQUIRED/);
  assert.equal(normalizeLocator('file', process.platform === 'win32' ? 'C:\\工作\\a.md' : '/工作/a.md').length > 0, true);
  assert.throws(() => normalizeLocator('file', 'relative/a.md'), /LOCATOR_PATH_REQUIRED/);
  // The raw string keeps the `..` segment: `path.resolve` would collapse it and
  // hide the traversal we are asserting against.
  assert.throws(() => normalizeLocator('file', '/a/../b.md'), /LOCATOR_INVALID/);
  assert.throws(() => normalizeLocator('file', 'C:\\a\\..\\b.md'), /LOCATOR_PATH_REQUIRED|LOCATOR_INVALID/);
  assert.throws(() => normalizeLocator('session', 'https://example.com'), /LOCATOR_SESSION_REQUIRED/);
  assert.throws(() => normalizeLocator('message', 'dsh:session/s1'), /LOCATOR_MESSAGE_REQUIRED/);
  assert.throws(() => normalizeLocator('thought', 'dsh:session/s1'), /LOCATOR_THOUGHT_REQUIRED/);
  assert.equal(normalizeLocator('thought', 'manual:note-1'), 'manual:note-1');
  assert.throws(() => normalizeLocator('note', 'ymzz:note/x'), /LOCATOR_NOTE_REQUIRED/);
  assert.throws(() => normalizeLocator('task', 'ymzz:task/'), /LOCATOR_TASK_REQUIRED/);
  assert.throws(() => normalizeLocator('web', ''), /LOCATOR_REQUIRED/);
});

test('metadata is bounded and refuses credential-shaped keys and values', () => {
  assert.deepEqual(normalizeMetadata({lang: 'zh', pages: 3, pinned: true}), {lang: 'zh', pages: 3, pinned: true});
  assert.deepEqual(normalizeMetadata(undefined), {});
  assert.throws(() => normalizeMetadata({password: 'x'}), /METADATA_CREDENTIAL_FORBIDDEN/);
  assert.throws(() => normalizeMetadata({apiKey: 'x'}), /METADATA_CREDENTIAL_FORBIDDEN/);
  assert.throws(() => normalizeMetadata({note: 'Bearer abcdefghijklmnop'}), /SECRET_SHAPED_CONTENT_BLOCKED/);
  assert.throws(() => normalizeMetadata({note: 'sk-' + 'a'.repeat(30)}), /SECRET_SHAPED_CONTENT_BLOCKED/);
  assert.throws(() => normalizeMetadata({nested: {a: 1}}), /METADATA_INVALID/);
  assert.throws(() => normalizeMetadata({big: 'x'.repeat(401)}), /METADATA_VALUE_TOO_LONG/);
  const wide = Object.fromEntries(Array.from({length: 21}, (_, index) => [`k${index}`, 1]));
  assert.throws(() => normalizeMetadata(wide), /METADATA_TOO_LARGE/);
});

test('tags normalise, dedupe and cap; add/remove is explicit', (t) => {
  const {registry} = fixture(t);
  const entity = registry.addEntity(base({tags: ['A', 'a', 'B c', '#D']}));
  assert.deepEqual(entity.tags, ['a', 'b-c', 'd']);
  const added = registry.setTag(entity.id, 'New Tag', {consent: true});
  assert.equal(added.changed, true);
  assert(added.entity.tags.includes('new-tag'));
  const again = registry.setTag(entity.id, 'new-tag', {consent: true});
  assert.equal(again.changed, false);
  const removed = registry.setTag(entity.id, 'a', {consent: true, add: false});
  assert.equal(removed.changed, true);
  assert.equal(removed.entity.tags.includes('a'), false);
  assert.throws(() => registry.setTag(entity.id, '  ', {consent: true}), /TAG_INVALID/);
  assert.throws(() => registry.setTag(entity.id, 'x', {consent: false}), /CONSENT_REQUIRED/);
  const many = registry.addEntity(base({locator: 'https://example.com/many', tags: Array.from({length: 40}, (_, i) => `t${i}`)}));
  assert.equal(many.tags.length, 24);
  assert.equal(normalizeTag('  ##Web  '), 'web');
});

test('Lists are many-to-many: one entity in several Lists, one List with several entities', (t) => {
  const {registry} = fixture(t);
  const reading = registry.createList({name: '待讀', description: '稍後閱讀', consent: true});
  const archive = registry.createList({name: '存檔', consent: true});
  assert.throws(() => registry.createList({name: '待讀', consent: true}), /LIST_NAME_EXISTS/);
  assert.throws(() => registry.createList({name: 'x'}), /CONSENT_REQUIRED/);
  const a = registry.addEntity(base({locator: 'https://example.com/a'}));
  const b = registry.addEntity(base({locator: 'https://example.com/b', title: '第二篇'}));
  registry.setMembership({listId: reading.id, entityId: a.id, consent: true});
  registry.setMembership({listId: archive.id, entityId: a.id, consent: true});
  registry.setMembership({listId: reading.id, entityId: b.id, consent: true});
  assert.deepEqual(registry.entity(a.id).lists.sort(), [reading.id, archive.id].sort());
  assert.deepEqual(registry.entity(b.id).lists, [reading.id]);
  assert.equal(registry.query({list: reading.id}).total, 2);
  assert.equal(registry.query({list: archive.id}).total, 1);
  const removed = registry.removeList(reading.id, {consent: true});
  assert.equal(removed.detached, 2);
  assert.deepEqual(registry.entity(a.id).lists, [archive.id]);
  assert.deepEqual(registry.entity(b.id).lists, []);
  assert.throws(() => registry.setMembership({listId: reading.id, entityId: a.id, consent: true}), /LIST_NOT_FOUND/);
  assert.throws(() => registry.addEntity(base({locator: 'https://example.com/c', lists: [reading.id]})), /LIST_NOT_FOUND/);
});

test('query filters by kind, tag, List and keyword over title/tag/locator', (t) => {
  const {registry} = fixture(t);
  const list = registry.createList({name: '研究', consent: true});
  const web = registry.addEntity(base({tags: ['研究', 'web'], lists: [list.id]}));
  const file = registry.addEntity(
    base({kind: 'file', title: '本機 草稿', locator: process.platform === 'win32' ? 'C:\\草稿\\a.md' : '/草稿/a.md', tags: ['研究'], source: 'file'}),
  );
  const note = registry.addEntity(base({kind: 'note', title: '決策 筆記', locator: 'ymzz:note/abcdef12-3456', tags: [], source: 'manual'}));
  assert.equal(registry.query({kind: 'file'}).total, 1);
  assert.equal(registry.query({tag: '研究'}).total, 2);
  assert.equal(registry.query({list: list.id}).total, 1);
  assert.equal(registry.query({query: '決策'}).total, 1);
  assert.equal(registry.query({query: 'example.com'}).total, 1);
  assert.equal(registry.query({kind: 'web', tag: '研究', list: list.id}).total, 1);
  assert.equal(registry.query({query: '不存在'}).total, 0);
  const page = registry.query({limit: 1});
  assert.equal(page.entities.length, 1);
  assert.equal(page.truncated, true);
  assert.equal(registry.query({}).total, 3);
  assert.equal(web.id === file.id, false);
  assert.equal(note.tags.length, 0);
});

test('graph clusters by tag, keeps cross-cluster entities, and nodes stay locatable', (t) => {
  const {registry} = fixture(t);
  const shared = registry.addEntity(base({tags: ['決策', '知識'], locator: 'https://example.com/shared'}));
  registry.addEntity(base({tags: ['決策'], title: '甲', locator: 'https://example.com/1'}));
  registry.addEntity(base({tags: ['知識'], title: '乙', locator: 'https://example.com/2'}));
  const orphan = registry.addEntity(base({tags: [], title: '未標', locator: 'https://example.com/3'}));
  const graph = registry.graph();
  const tags = graph.clusters.map((cluster) => cluster.tag);
  assert.deepEqual(tags.slice(0, 2).sort(), ['知識', '決策'].sort());
  assert.equal(tags.at(-1), 'untagged');
  const decision = graph.clusters.find((cluster) => cluster.tag === '決策');
  assert.ok(decision.notes.some((entry) => entry.id === shared.id && entry.shared === true));
  const node = decision.layout.nodes.find((entry) => entry.id === shared.id);
  assert.equal(node.kind, 'web');
  assert.equal(node.locator, 'https://example.com/shared');
  const resolved = registry.resolve(node.id);
  assert.equal(resolved.locator, 'https://example.com/shared');
  assert.equal(resolved.kind, 'web');
  assert.throws(() => registry.resolve('missing-entity'), /ENTITY_NOT_FOUND/);
  const untaggedCluster = graph.clusters.at(-1);
  assert.equal(untaggedCluster.notes[0].id, orphan.id);
  assert.match(graph.text.summary, /分為 3 簇/u);
  // Deterministic geometry: identical projection on a second call.
  assert.deepEqual(registry.graph().clusters, graph.clusters);
});

test('entity revisions are bounded, readable and restorable', (t) => {
  const {registry} = fixture(t);
  const entity = registry.addEntity(base());
  const v1 = registry.readRevision(entity.id, 1);
  assert.equal(v1.sha256.tags, sha(v1.tags.join('\n')));
  assert.equal(v1.sha256.locator, sha(v1.locator));
  const updated = registry.updateEntity(entity.id, {title: '第二版', tags: ['決策']}, {consent: true});
  assert.equal(updated.changed, true);
  assert.equal(updated.entity.revision, 2);
  const noop = registry.updateEntity(entity.id, {title: '第二版', tags: ['決策']}, {consent: true});
  assert.equal(noop.changed, false);
  assert.equal(noop.entity.revision, 2);
  assert.throws(() => registry.updateEntity(entity.id, {kind: 'file'}, {consent: true}), /ENTITY_KIND_INVALID|TITLE|LOCATOR/u, 'kind is immutable');
  for (let index = 3; index <= 15; index += 1) {
    registry.updateEntity(entity.id, {title: `版本 ${index}`}, {consent: true});
  }
  const index = registry.revisions(entity.id);
  assert.ok(index.entries.length <= 10);
  assert.equal(index.entries.at(-1).revision, 15);
  const restored = registry.restoreRevision(entity.id, 1, {consent: true});
  assert.equal(restored.title, '現代網頁指南');
  assert.equal(restored.revision, 16);
  assert.equal(registry.readRevision(entity.id, 1).title, '現代網頁指南');
  assert.throws(() => registry.restoreRevision(entity.id, 1, {consent: false}), /CONSENT_REQUIRED/);
  assert.throws(() => registry.readRevision(entity.id, 999), /REVISION_NOT_FOUND/);
});

test('registry persists across restart and recovers a corrupt ledger visibly', (t) => {
  const {root, registry} = fixture(t);
  const list = registry.createList({name: '跨端', consent: true});
  const entity = registry.addEntity(base({lists: [list.id]}));
  const restarted = new TagRegistry({root});
  assert.equal(restarted.entities().length, 1);
  assert.equal(restarted.lists().length, 1);
  assert.equal(restarted.entity(entity.id).locator, 'https://example.com/guide');
  assert.deepEqual(restarted.entity(entity.id).lists, [list.id]);
  fs.writeFileSync(path.join(root, 'tag-registry.json'), '{"broken":');
  const recovered = new TagRegistry({root});
  assert.equal(recovered.entities().length, 0);
  assert.ok(recovered.recoveredFrom && fs.existsSync(recovered.recoveredFrom));
});

test('registry exposes no scan, crawl or history-reading entry point', (t) => {
  const {registry} = fixture(t);
  for (const forbidden of ['scan', 'scanDirectory', 'crawl', 'importChromeHistory', 'readHistory', 'readSession', 'fetchUrl']) {
    assert.equal(typeof registry[forbidden], 'undefined', `${forbidden} must not exist`);
  }
  // Everything that touches user data requires consent, including removal.
  assert.throws(() => registry.removeEntity('anything'), /CONSENT_REQUIRED/);
  assert.throws(() => registry.createList({name: 'x', consent: false}), /CONSENT_REQUIRED/);
  assert.throws(() => registry.removeList('x'), /CONSENT_REQUIRED/);
  assert.throws(() => registry.setMembership({listId: 'a', entityId: 'b'}), /CONSENT_REQUIRED/);
  assert.throws(() => registry.addEntity(base({title: 'Bearer abcdefghijklmnop'})), /SECRET_SHAPED_CONTENT_BLOCKED/);
});

test('committed knowledge notes register as kind=note entities and update in place', (t) => {
  const {registry} = fixture(t);
  const note = {id: 'abcdef12-3456-7890', title: '決策 筆記', tags: ['決策', '知識'], relativePath: 'ymzz/2026/11/a.md', sha256: 'f'.repeat(64)};
  const first = registry.registerNote(note);
  assert.equal(first.kind, 'note');
  assert.equal(first.id, note.id);
  assert.equal(first.locator, `ymzz:note/${note.id}`);
  assert.equal(first.source, 'manual');
  assert.equal(first.metadata.relativePath, note.relativePath);
  const second = registry.registerNote({...note, title: '決策 筆記（二）', tags: ['決策']});
  assert.equal(second.id, note.id);
  assert.equal(second.revision, 2);
  assert.deepEqual(second.tags, ['決策']);
  assert.equal(registry.entities().length, 1);
  assert.equal(registry.query({kind: 'note'}).total, 1);
  assert.equal(registry.registerNote(null), null);
});
