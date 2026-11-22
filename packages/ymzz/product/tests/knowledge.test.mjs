// MIT. Knowledge tagging units: tag normalisation, Obsidian rendering, approval,
// commit, idempotency, search, revoke and restart persistence. No model, no network.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {
  normalizeTag,
  normalizeTags,
  normalizeLinks,
  suggestTags,
  renderKnowledgeNote,
  targetPathFor,
  slugFromTitle,
} from '../obsidian-markdown.mjs';
import {KnowledgeStore} from '../knowledge-store.mjs';

const sha = (text) => createHash('sha256').update(text, 'utf8').digest('hex');
const productDir = path.join(import.meta.dirname, '..');

/** Fresh profile + Vault, both with Chinese characters and spaces in the path. */
function fixture(t, {vault = true} = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), '湛箴 知識 store '));
  const dataDir = path.join(root, '資料 home');
  const vaultDir = path.join(root, '我的 Obsidian 倉庫');
  fs.mkdirSync(dataDir, {recursive: true});
  if (vault) fs.mkdirSync(vaultDir, {recursive: true});
  t.after(() => fs.rmSync(root, {recursive: true, force: true}));
  let tick = 0;
  let counter = 0;
  const store = new KnowledgeStore({
    root: dataDir,
    now: () => new Date(Date.UTC(2026, 10, 22, 3, 0, tick++)),
    newId: () => `draft-${String(++counter).padStart(4, '0')}`,
  });
  return {root, dataDir, vaultDir, store};
}

const draftBody = (overrides = {}) => ({
  title: '標籤化 決策記錄',
  summary: '把一次 DSH 會話整理成可檢索的知識資產。',
  tags: ['DSH', ' 知識 管理 ', '#Obsidian', 'dsh'],
  links: ['另一篇 筆記', '[[第三篇]]'],
  sections: {
    decisions: '- 使用本地 Obsidian Markdown\n- 不覆寫同名檔案',
    events: '2026-11-22 完成審批流程',
    resources: 'Vault 路徑由使用者選擇',
    actions: '- [ ] 追加跨端同步說明',
  },
  source: {kind: 'manual'},
  ...overrides,
});

test('tag normalisation lowercases, hyphenates, strips hashes and bounds length', () => {
  assert.equal(normalizeTag('  DSH 知識  '), 'dsh-知識');
  assert.equal(normalizeTag('#Obsidian'), 'obsidian');
  assert.equal(normalizeTag('ＦＵＬＬ　ＷＩＤＴＨ'), 'full-width');
  assert.equal(normalizeTag('!!!'), '');
  assert.equal(normalizeTag(42), '');
  assert.equal(normalizeTag('a'.repeat(120)).length, 40);
  assert.equal(normalizeTag('決策/事件'), '決策/事件');
  assert.equal(normalizeTag('..hidden'), 'hidden');
  assert.deepEqual(normalizeTags(['A', 'a', ' b ', '', null, 'c']), ['a', 'b', 'c']);
  assert.equal(normalizeTags(Array.from({length: 40}, (_, index) => `t${index}`)).length, 24);
  assert.deepEqual(normalizeLinks(['[[甲]]', '乙', '甲', 'x'.repeat(400)]), ['甲', '乙']);
});

test('suggested tags come only from explicit #tags the user typed', () => {
  const text = '決定 #架構 與 #知識-管理，參考 #架構；這不是 #AI 自動理解。';
  assert.deepEqual(suggestTags(text), ['架構', '知識-管理', 'ai']);
  assert.deepEqual(suggestTags(text, {existing: ['架構']}), ['知識-管理', 'ai']);
  assert.deepEqual(suggestTags('沒有井號標籤的句子'), []);
  assert.deepEqual(suggestTags('email#notatag'), []);
  assert.equal(suggestTags('#a #b #c #d', {limit: 2}).length, 2);
});

test('slug and default target path stay inside the ymzz knowledge root', () => {
  assert.equal(slugFromTitle('  Hello  World!!  '), 'hello-world');
  assert.equal(slugFromTitle('決策 記錄'), '決策-記錄');
  assert.equal(slugFromTitle('***'), 'note');
  assert.equal(
    targetPathFor({title: '標籤 測試', id: 'abcdef12-3456', created: '2026-11-22T00:00:00.000Z'}),
    'ymzz/2026/11/標籤-測試-abcdef12.md',
  );
});

test('rendered note is Obsidian-compatible: frontmatter, four sections, sources, LF, trailing newline', () => {
  const rendered = renderKnowledgeNote({
    id: 'draft-0001',
    title: '標題 "引號"\n第二行',
    summary: '摘要',
    tags: ['DSH', '知識 管理'],
    links: ['甲', '乙'],
    sections: {decisions: '決策內容', events: '', resources: '資源內容', actions: '行動內容'},
    created: '2026-11-22T03:00:00.000Z',
    updated: '2026-11-22T04:00:00.000Z',
    source: {kind: 'session', sessionId: 'session-1', sessionTitle: '來源會話'},
  });
  const {markdown} = rendered;
  assert.equal(rendered.sha256, sha(markdown));
  assert.ok(markdown.endsWith('\n'));
  assert.ok(!markdown.includes('\r'));
  assert.match(markdown, /^---\ntitle: "標題 \\"引號\\"\\n第二行"\ncreated: "2026-11-22T03:00:00.000Z"\n/u);
  assert.match(markdown, /tags: \["dsh", "知識-管理"\]/u);
  assert.match(markdown, /ymzz_id: "draft-0001"/u);
  assert.match(markdown, /source: "session"/u);
  assert.match(markdown, /source_session: "session-1"/u);
  assert.match(markdown, /\n## 决策\n\n決策內容\n/u);
  assert.match(markdown, /\n## 资源\n\n資源內容\n/u);
  assert.match(markdown, /\n## 行动\n\n行動內容\n/u);
  assert.ok(!markdown.includes('## 事件'), 'empty section is omitted');
  assert.match(markdown, /## 来源\n\n- 会话：來源會話 `session-1`/u);
  assert.match(markdown, /- 关联：\[\[甲\]\]、\[\[乙\]\]/u);
});

test('manual note without links still has a source section and no fake inference', () => {
  const rendered = renderKnowledgeNote({
    id: 'draft-0002',
    title: '手工',
    tags: [],
    source: {kind: 'manual'},
    created: '2026-11-22T05:00:00.000Z',
  });
  assert.match(rendered.markdown, /## 来源\n\n- 手工记录\n$/u);
  assert.ok(!rendered.markdown.includes('## 决策'));
  assert.match(rendered.markdown, /tags: \[\]/u);
});

test('a draft is persisted before approval and approval binds the final hash', (t) => {
  const {store, dataDir} = fixture(t);
  const draft = store.saveDraft(draftBody());
  assert.equal(draft.status, 'draft');
  assert.equal(draft.approvedSha256, null);
  assert.deepEqual(draft.tags, ['dsh', '知識-管理', 'obsidian']);
  const onDisk = JSON.parse(fs.readFileSync(path.join(dataDir, 'knowledge.json'), 'utf8'));
  assert.equal(onDisk.drafts[draft.id].title, '標籤化 決策記錄');
  const approval = store.approve(draft.id);
  assert.equal(approval.sha256, sha(renderKnowledgeNote(onDisk.drafts[draft.id]).markdown));
  assert.equal(store.drafts()[0].status, 'approved');
});

test('editing after approval invalidates the bound hash and blocks commit', (t) => {
  const {store, vaultDir} = fixture(t);
  store.setVault(vaultDir);
  const draft = store.saveDraft(draftBody());
  store.approve(draft.id);
  store.saveDraft({...draftBody(), id: draft.id, title: '改過的標題'});
  assert.throws(() => store.commit(draft.id, {consent: true}), /APPROVAL_REQUIRED/);
  // Even a tampered ledger entry is caught by the re-render hash check.
  store.state.drafts[draft.id].status = 'approved';
  store.state.drafts[draft.id].approvedSha256 = 'f'.repeat(64);
  assert.throws(() => store.commit(draft.id, {consent: true}), /APPROVAL_STALE/);
});

test('commit needs explicit consent, writes exactly the approved bytes and is idempotent', (t) => {
  const {store, vaultDir} = fixture(t);
  store.setVault(vaultDir);
  const draft = store.saveDraft(draftBody());
  const approval = store.approve(draft.id);
  assert.throws(() => store.commit(draft.id, {}), /CONSENT_REQUIRED/);
  const first = store.commit(draft.id, {consent: true});
  assert.equal(first.idempotent, false);
  assert.equal(first.note.sha256, approval.sha256);
  assert.equal(first.note.relativePath, draft.targetPath);
  const written = fs.readFileSync(path.join(vaultDir, ...draft.targetPath.split('/')), 'utf8');
  assert.equal(sha(written), approval.sha256);
  const second = store.commit(draft.id, {consent: true});
  assert.equal(second.idempotent, true);
  assert.equal(second.note.sha256, approval.sha256);
  assert.equal(fs.readdirSync(path.join(vaultDir, 'ymzz', '2026', '11')).filter((name) => name.endsWith('.tmp')).length, 0);
});

test('commit never overwrites an existing same-name file', (t) => {
  const {store, vaultDir} = fixture(t);
  store.setVault(vaultDir);
  const target = 'ymzz/2026/11/固定名稱.md';
  const first = store.saveDraft(draftBody({title: '第一篇', targetPath: target}));
  store.approve(first.id);
  store.commit(first.id, {consent: true});
  const before = fs.readFileSync(path.join(vaultDir, 'ymzz', '2026', '11', '固定名稱.md'), 'utf8');
  const second = store.saveDraft(draftBody({title: '第二篇', targetPath: target}));
  store.approve(second.id);
  assert.throws(() => store.commit(second.id, {consent: true}), /TARGET_EXISTS/);
  assert.equal(fs.readFileSync(path.join(vaultDir, 'ymzz', '2026', '11', '固定名稱.md'), 'utf8'), before);
});

test('search is case-insensitive over title, tags and body, and only sees current files', (t) => {
  const {store, vaultDir} = fixture(t);
  store.setVault(vaultDir);
  const draft = store.saveDraft(draftBody());
  store.approve(draft.id);
  const {note} = store.commit(draft.id, {consent: true});
  assert.equal(store.search({query: '標籤化'}).notes.length, 1);
  assert.equal(store.search({query: '標籤化'.toUpperCase()}).notes.length, 1);
  assert.equal(store.search({query: 'OBSIDIAN'}).notes.length, 1);
  assert.equal(store.search({query: '不覆寫同名檔案'}).notes.length, 1);
  assert.equal(store.search({query: '完全不存在'}).notes.length, 0);
  assert.equal(store.search({tag: 'dsh'}).notes.length, 1);
  assert.equal(store.search({tag: '不存在'}).notes.length, 0);
  const opened = store.open(note.id);
  assert.match(opened.markdown, /## 来源/u);
  assert.equal(opened.modified, false);
  assert.deepEqual(opened.tags, ['dsh', '知識-管理', 'obsidian']);
  fs.unlinkSync(path.join(vaultDir, ...note.relativePath.split('/')));
  assert.equal(store.search({query: '標籤化'}).notes.length, 0);
  assert.equal(store.snapshot().notes[0].exists, false);
});

test('revoke moves the note into local trash and refuses externally changed files', (t) => {
  const {store, vaultDir, dataDir} = fixture(t);
  store.setVault(vaultDir);
  const draft = store.saveDraft(draftBody());
  store.approve(draft.id);
  const {note} = store.commit(draft.id, {consent: true});
  const file = path.join(vaultDir, ...note.relativePath.split('/'));
  fs.appendFileSync(file, '\n外部修改\n');
  const changed = fs.readFileSync(file, 'utf8');
  assert.throws(() => store.revoke(note.id, {consent: true}), /NOTE_CHANGED_EXTERNALLY/);
  assert.equal(fs.readFileSync(file, 'utf8'), changed, 'refused revoke leaves the file untouched');
  fs.writeFileSync(file, renderKnowledgeNote(JSON.parse(fs.readFileSync(path.join(dataDir, 'knowledge.json'), 'utf8')).drafts[draft.id]).markdown);
  const result = store.revoke(note.id, {consent: true});
  assert.equal(result.ok, true);
  assert.ok(fs.existsSync(result.trashPath));
  assert.ok(result.trashPath.startsWith(path.join(dataDir, 'knowledge-trash')));
  assert.equal(fs.existsSync(file), false);
  assert.equal(store.snapshot().notes.length, 0);
  assert.equal(store.snapshot().trash.length, 1);
});

test('restart keeps commitments searchable and rejects a tampered ledger safely', (t) => {
  const {store, vaultDir, dataDir} = fixture(t);
  store.setVault(vaultDir);
  const draft = store.saveDraft(draftBody());
  store.approve(draft.id);
  const {note} = store.commit(draft.id, {consent: true});
  const restarted = new KnowledgeStore({root: dataDir});
  assert.equal(restarted.snapshot().notes.length, 1);
  assert.equal(restarted.search({query: '知識'}).notes[0].id, note.id);
  fs.writeFileSync(path.join(dataDir, 'knowledge.json'), '{not json');
  const recovered = new KnowledgeStore({root: dataDir});
  assert.equal(recovered.snapshot().notes.length, 0);
  assert.ok(recovered.recoveredFrom && fs.existsSync(recovered.recoveredFrom), 'corrupt ledger is backed up, not silently lost');
});

test('switching Vault never re-reads a same-named file from another root', (t) => {
  const {store, root} = fixture(t);
  const vaultA = path.join(root, '倉庫 A');
  const vaultB = path.join(root, '倉庫 B');
  fs.mkdirSync(vaultA);
  fs.mkdirSync(vaultB);
  store.setVault(vaultA);
  const draft = store.saveDraft(draftBody());
  store.approve(draft.id);
  const {note} = store.commit(draft.id, {consent: true});
  const segments = note.relativePath.split('/');
  fs.mkdirSync(path.join(vaultB, ...segments.slice(0, -1)), {recursive: true});
  fs.writeFileSync(path.join(vaultB, ...segments), '誘餌內容\n');
  store.setVault(vaultB);
  assert.equal(store.search({query: '標籤化'}).notes.length, 0, 'another Vault is not searched');
  const listed = store.snapshot().notes[0];
  assert.equal(listed.vaultMatch, false);
  assert.equal(listed.exists, false);
  assert.ok(!store.open(note.id).markdown.includes('誘餌'), 'open uses the recorded Vault root');
});

test('draft validation bounds every field and refuses escapes or absolute paths', (t) => {
  const {store} = fixture(t);
  assert.throws(() => store.saveDraft(draftBody({title: '   '})), /TITLE_REQUIRED/);
  assert.throws(() => store.saveDraft(draftBody({targetPath: '../逃逸.md'})), /PATH/);
  assert.throws(() => store.saveDraft(draftBody({targetPath: 'C:/絕對.md'})), /PATH/);
  assert.throws(() => store.saveDraft(draftBody({targetPath: 'ymzz/../../x.md'})), /PATH/);
  assert.throws(() => store.saveDraft(draftBody({targetPath: 'ymzz/\u0000x.md'})), /PATH/);
  assert.throws(() => store.saveDraft(draftBody({targetPath: 'ymzz/.obsidian/app.md'})), /PATH/);
  assert.throws(() => store.saveDraft(draftBody({targetPath: 'other/note.md'})), /PATH_OUTSIDE_KNOWLEDGE_ROOT/);
  const long = store.saveDraft(draftBody({summary: 'x'.repeat(5000), sections: {decisions: 'y'.repeat(30000)}}));
  assert.equal(long.summary.length, 2000);
  assert.equal(long.sections.decisions.length, 20000);
  assert.throws(() => store.saveDraft(draftBody({source: {kind: 'session'}})), /SOURCE_SESSION_REQUIRED/);
  assert.throws(() => store.commit('missing-id', {consent: true}), /DRAFT_NOT_FOUND/);
  assert.throws(() => store.revoke('missing-id', {consent: true}), /NOTE_REQUIRED/);
});

test('committed drafts are locked and a missing Vault blocks commit', (t) => {
  const {store, vaultDir} = fixture(t, {vault: false});
  assert.throws(() => store.commit('x', {consent: true}), /DRAFT_NOT_FOUND/);
  const draft = store.saveDraft(draftBody());
  store.approve(draft.id);
  assert.throws(() => store.commit(draft.id, {consent: true}), /VAULT_NOT_CONFIGURED/);
  fs.mkdirSync(vaultDir);
  store.setVault(vaultDir);
  store.commit(draft.id, {consent: true});
  assert.throws(() => store.saveDraft({...draftBody(), id: draft.id}), /DRAFT_ALREADY_COMMITTED/);
  // A committed draft shell may still be deleted while its note record exists;
  // the Vault file, the note record and the trash are untouched. Quota is freed
  // either way because committed drafts no longer count against the limit.
  store.deleteDraft(draft.id);
});

test('every edit bumps the revision and keeps full editable content with text/tag/path hashes', (t) => {
  const {store} = fixture(t);
  const first = store.saveDraft(draftBody());
  assert.equal(first.revision, 1);
  assert.equal(first.historyCount, 1);
  const second = store.saveDraft({...draftBody(), id: first.id, title: '第二版', tags: ['決策']});
  assert.equal(second.revision, 2);
  assert.equal(second.historyCount, 2);
  const index = store.revisions(first.id);
  assert.deepEqual(index.entries.map((entry) => entry.revision), [1, 2]);
  const v1 = store.readRevision(first.id, 1);
  assert.equal(v1.title, '標籤化 決策記錄');
  assert.deepEqual(v1.tags, ['dsh', '知識-管理', 'obsidian']);
  assert.equal(v1.sha256.text, sha(JSON.stringify({
    title: v1.title,
    summary: v1.summary,
    tags: v1.tags,
    links: v1.links,
    sections: v1.sections,
  })));
  assert.equal(v1.sha256.tags, sha(v1.tags.join('\n')));
  assert.equal(v1.sha256.path, sha(v1.targetPath));
  const v2 = store.readRevision(first.id, 2);
  assert.equal(v2.title, '第二版');
  assert.notEqual(v2.sha256.text, v1.sha256.text);
  // A no-op save keeps the revision and does not duplicate history.
  const same = store.saveDraft({...draftBody(), id: first.id, title: '第二版', tags: ['決策']});
  assert.equal(same.revision, 2);
  assert.equal(same.historyCount, 2);
  assert.throws(() => store.readRevision(first.id, 99), /REVISION_NOT_FOUND/);
  assert.throws(() => store.readRevision(first.id, 0), /REVISION_INVALID/);
});

test('revision history is bounded by count and by bytes', (t) => {
  const {store} = fixture(t);
  let draft = store.saveDraft(draftBody());
  for (let index = 2; index <= 25; index += 1) {
    draft = store.saveDraft({...draftBody(), id: draft.id, title: `版本 ${index}`});
  }
  assert.equal(draft.revision, 25);
  assert.ok(draft.historyCount <= 20, 'history keeps at most 20 revisions');
  const entries = store.revisions(draft.id).entries;
  assert.equal(entries.at(-1).revision, 25);
  // The very first revision is pinned so the original text is never lost; the
  // rest of the budget holds the newest revisions.
  assert.equal(entries[0].revision, 1, 'the first revision is pinned');
  assert.ok(entries.length <= 20, 'pinned entry plus the newest revisions fit the cap');
  // Oversized single revision still cannot grow the ledger without bound.
  const huge = 'z'.repeat(20000);
  let big = store.saveDraft(draftBody({sections: {decisions: huge}}));
  for (let index = 0; index < 40; index += 1) big = store.saveDraft({...draftBody(), id: big.id, sections: {decisions: `${huge}${index}`}});
  const historyBytes = Buffer.byteLength(
    JSON.stringify(JSON.parse(fs.readFileSync(path.join(store.root, 'knowledge.json'), 'utf8')).drafts[big.id].history),
    'utf8',
  );
  assert.ok(historyBytes <= 524288, `history stays under the byte budget (${historyBytes})`);
});

test('edit -> edit again -> old approval is stale -> restore old version -> re-approve -> commit', (t) => {
  const {store, vaultDir} = fixture(t);
  store.setVault(vaultDir);
  const original = store.saveDraft(draftBody());
  const approvedV1 = store.approve(original.id);
  assert.equal(approvedV1.revision, 1);
  const second = store.saveDraft({...draftBody(), id: original.id, title: '第二版', tags: ['決策']});
  assert.equal(second.revision, 2);
  assert.equal(second.approvedSha256, null, 'editing drops the approval');
  assert.equal(second.approvedRevision, null);
  // Old approval cannot be replayed: the draft has no valid approval at all.
  assert.throws(() => store.commit(original.id, {consent: true}), /APPROVAL_REQUIRED/);
  // Tampering with a stale approval is caught by the revision check.
  store.state.drafts[original.id].status = 'approved';
  store.state.drafts[original.id].approvedSha256 = approvedV1.sha256;
  store.state.drafts[original.id].approvedRevision = 1;
  assert.throws(() => store.commit(original.id, {consent: true}), /APPROVAL_STALE/);
  store.state.drafts[original.id].status = 'draft';
  store.state.drafts[original.id].approvedSha256 = null;
  store.state.drafts[original.id].approvedRevision = null;
  // Restore version 1 as a new revision; it is unapproved.
  const restored = store.restoreRevision(original.id, 1);
  assert.equal(restored.revision, 3);
  assert.equal(restored.status, 'draft');
  assert.equal(restored.title, '標籤化 決策記錄');
  assert.equal(restored.approvedSha256, null);
  assert.equal(store.readRevision(original.id, 1).title, '標籤化 決策記錄', 'history is never rewritten');
  assert.throws(() => store.commit(original.id, {consent: true}), /APPROVAL_REQUIRED/);
  const reapproved = store.approve(original.id);
  assert.equal(reapproved.revision, 3);
  // The frontmatter `updated` timestamp legitimately differs, so the restored
  // revision needs its own approval hash; the editable content is the old one.
  assert.notEqual(reapproved.sha256, approvedV1.sha256);
  assert.equal(store.readRevision(original.id, 3).sha256.text, store.readRevision(original.id, 1).sha256.text);
  const {note, idempotent} = store.commit(original.id, {consent: true});
  assert.equal(idempotent, false);
  assert.equal(note.sha256, reapproved.sha256);
});

test('restoring a version as a new draft never inherits approval', (t) => {
  const {store} = fixture(t);
  const original = store.saveDraft(draftBody());
  store.approve(original.id);
  store.saveDraft({...draftBody(), id: original.id, title: '第二版'});
  const copy = store.restoreRevision(original.id, 1, {asNew: true});
  assert.notEqual(copy.id, original.id);
  assert.equal(copy.revision, 1);
  assert.equal(copy.status, 'draft');
  assert.equal(copy.approvedSha256, null);
  assert.equal(copy.historyCount, 1);
  assert.equal(store.readRevision(copy.id, 1).title, '標籤化 決策記錄');
  // A committed draft keeps its history and cannot be re-opened for editing.
  const {store: store2, vaultDir} = fixture(t);
  store2.setVault(vaultDir);
  const committed = store2.saveDraft(draftBody());
  store2.approve(committed.id);
  store2.commit(committed.id, {consent: true});
  assert.throws(() => store2.restoreRevision(committed.id, 1), /COMMITTED_DRAFT_LOCKED/);
  assert.equal(store2.revisions(committed.id).entries.length, 1);
});

test('client panel keeps a stable root, delegated events and no unsafe HTML', () => {
  const script = fs.readFileSync(path.join(productDir, 'knowledge-ui.js'), 'utf8');
  const css = fs.readFileSync(path.join(productDir, 'knowledge-ui.css'), 'utf8');
  assert.match(script, /const DOCK_ID = 'ymzz-knowledge-dock'/u);
  assert.ok(!script.includes('innerHTML'), 'no HTML string injection');
  assert.ok(!script.includes('document.write'));
  assert.match(script, /addEventListener\('click'/u);
  assert.match(script, /aria-live/u);
  assert.match(script, /ymzz-k-alt/u, 'graph has a text alternative list');
  assert.ok(!/Math\.random/u.test(script), 'layout must be deterministic');
  assert.match(css, /prefers-reduced-motion/u);
  assert.match(css, /@media \(max-width: 720px\)/u);
  assert.match(css, /width: min\(360px/u);
});

test('quota counts only unfinished drafts: 200 commits never block the 201st note', (t) => {
  const {store, vaultDir} = fixture(t);
  store.setVault(vaultDir);
  for (let index = 0; index < 200; index += 1) {
    const draft = store.saveDraft(draftBody({title: `配額 第${index + 1}篇`}));
    store.approve(draft.id);
    store.commit(draft.id, {consent: true});
  }
  const extra = store.saveDraft(draftBody({title: '配額 第201篇'}));
  store.approve(extra.id);
  const {note} = store.commit(extra.id, {consent: true});
  assert.equal(note.title, '配額 第201篇');
  // Revoking also frees the quota for the next note.
  store.revoke(extra.id, {consent: true});
  const another = store.saveDraft(draftBody({title: '配額 第202篇'}));
  assert.equal(another.status, 'draft');
});

test('a no-change save keeps the approval binding: commit still succeeds', (t) => {
  const {store, vaultDir} = fixture(t);
  store.setVault(vaultDir);
  const body = draftBody();
  const draft = store.saveDraft(body);
  const approval = store.approve(draft.id);
  // The exact path QA reproduced: edit -> change nothing -> save -> write.
  const untouched = store.saveDraft({...body, id: draft.id});
  assert.equal(untouched.status, 'approved');
  assert.equal(untouched.updatedAt, draft.updatedAt);
  assert.equal(untouched.approvedSha256, approval.sha256);
  const {note, idempotent} = store.commit(draft.id, {consent: true});
  assert.equal(idempotent, false);
  assert.equal(note.sha256, approval.sha256);
  // A real change still invalidates the approval before commit.
  const second = store.saveDraft(body);
  store.approve(second.id);
  const edited = store.saveDraft({...body, id: second.id, title: '改過的標題'});
  assert.equal(edited.status, 'draft');
  assert.equal(edited.approvedSha256, null);
});

test('commit never overwrites a vault file that already exists', (t) => {
  const {store, vaultDir} = fixture(t);
  store.setVault(vaultDir);
  const first = store.saveDraft(draftBody({title: '不覆寫'}));
  store.approve(first.id);
  const {note} = store.commit(first.id, {consent: true});
  const absolute = path.join(vaultDir, note.relativePath);
  const before = fs.readFileSync(absolute, 'utf8');
  // Same target path, different content: the write must fail closed.
  const second = store.saveDraft(draftBody({title: '不覆寫 二號', targetPath: note.relativePath}));
  store.approve(second.id);
  assert.throws(() => store.commit(second.id, {consent: true}), /TARGET_EXISTS/);
  assert.equal(fs.readFileSync(absolute, 'utf8'), before);
});
