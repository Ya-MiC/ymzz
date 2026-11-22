// MIT. Authenticated knowledge routes against a synthetic Host context: no model,
// no network, no user Vault. Verifies consent, limits, idempotency and degradation.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {Readable} from 'node:stream';
import {createHash} from 'node:crypto';
import {apply} from '../../index.mjs';

const sha = (text) => createHash('sha256').update(text, 'utf8').digest('hex');

/** Build one apply() Host with optional native capabilities, or reuse a profile. */
async function setup(t, {sessionQuery = true, mcp = true, vault = true, profile = null, cleanupRoot = null} = {}) {
  const ownsHome = !profile;
  const removeRoot = cleanupRoot === null ? ownsHome : cleanupRoot;
  const home = profile ? profile.home : fs.mkdtempSync(path.join(os.tmpdir(), '湛箴 知識 route '));
  const dataDir = profile ? profile.dataDir : path.join(home, 'profile 資料');
  const vaultDir = profile ? profile.vaultDir : path.join(home, '我的 Obsidian 倉庫');
  if (ownsHome) {
    fs.mkdirSync(dataDir, {recursive: true});
    if (vault) fs.mkdirSync(vaultDir, {recursive: true});
  }
  let handler;
  const cleanups = [];
  const probed = [];
  const restarted = [];
  const ctx = {
    on() {},
    llm: {registerAdapter() {}},
    tools: {
      register() {},
      definitions: () => [{name: 'mcp__fs__read'}, {name: 'mcp__fs__list'}, {name: 'ymzz_list'}],
    },
    skills: {register() {}},
    approval: {setPolicy() {}},
    directoryPicker: {capability: () => ({kind: 'native', pick: async () => vaultDir})},
    webServer: {register(route) {handler = route.handler; return () => {}}},
    effect(fn) {
      const cleanup = fn();
      if (typeof cleanup === 'function') cleanups.push(cleanup);
    },
    provide() {},
    agents: {async create() { throw new Error('unused'); }},
  };
  if (sessionQuery) {
    ctx.sessionQuery = {
      async listSessions() {
        return [
          {header: {id: 'session-old', createdAt: 1_600_000_000_000, cwd: 'C:\\舊 專案'}, live: false, persisted: true},
          {header: {id: 'session-new', createdAt: 1_700_000_000_000, cwd: 'C:\\工作 區'}, live: true, persisted: true},
        ];
      },
      async readTitleSnapshots(ids) {
        return ids.map((id) => ({status: 'fulfilled', value: {session: {id}, title: `標題 ${id}`, updatedAt: 1_700_000_000_500}}));
      },
      async readSession(id) {
        return {
          events: [
            {type: 'user/message', data: {content: [{type: 'text', text: '請整理 #決策 與 #知識-管理 的內容'}]}},
            {type: 'assistant/message', data: {message: {content: [{type: 'text', text: '已整理完成'}]}}},
            {type: 'tool/call', data: {name: 'ymzz_read', arguments: '{}'}},
          ],
        };
      },
    };
  }
  if (mcp) {
    ctx.mcpManager = {
      list: () => [{name: 'fs', configured: true, status: {state: 'connected', toolCount: 2, connectedAt: 1}}],
      probe: async (name) => {
        probed.push(name);
        return {ok: true, toolNames: ['read', 'list'], truncated: false, durationMs: 7, cleanup: {state: 'closed'}};
      },
      restart: async (name) => {
        restarted.push(name);
      },
    };
  }
  await apply(ctx, {dataDir});
  t.after(() => {
    for (const cleanup of cleanups.reverse()) cleanup();
    if (removeRoot) fs.rmSync(home, {recursive: true, force: true});
  });

  async function request(method, route, body, headers = {}) {
    const req = Readable.from(body === undefined ? [] : [JSON.stringify(body)]);
    req.method = method;
    req.url = route;
    req.headers = {...(body === undefined ? {} : {'content-type': 'application/json', 'x-ymzz-action': '1'}), ...headers};
    let code;
    let text;
    await handler(req, {
      writeHead(status) {
        code = status;
      },
      end(value) {
        text = value;
      },
    });
    return {code, result: JSON.parse(text)};
  }
  const post = (route, body, headers) => request('POST', route, body, headers);
  const get = (route) => request('GET', route);
  return {home, dataDir, vaultDir, post, get, probed, restarted};
}

const draftBody = (overrides = {}) => ({
  title: '決策 標籤化',
  summary: '從會話整理出的知識資產。',
  tags: ['DSH', '知識 管理'],
  links: ['相關筆記'],
  sections: {decisions: '- 使用本地 Markdown', events: '完成審批', resources: 'Vault', actions: '- [ ] 同步'},
  source: {kind: 'session', sessionId: 'session-new', sessionTitle: '標題 session-new', excerpt: '請整理 #決策'},
  ...overrides,
});

test('knowledge state exposes drafts, notes, graph, MCP and bounded sessions', async (t) => {
  const host = await setup(t);
  const state = await host.get('/ymzz/knowledge/state');
  assert.equal(state.code, 200);
  assert.equal(state.result.vault.configured, false);
  assert.deepEqual(state.result.drafts, []);
  assert.deepEqual(state.result.notes, []);
  assert.equal(state.result.graph.clusters.length, 0);
  assert.equal(state.result.mcp.available, true);
  assert.equal(state.result.mcp.servers[0].name, 'fs');
  assert.equal(state.result.mcp.servers[0].status, 'connected');
  assert.deepEqual(state.result.mcp.tools, {total: 3, mcp: 2});
  assert.equal(state.result.sessions.available, true);
  assert.equal(state.result.limits.clusters, 8);
});

test('session listing is newest first with bounded fields; reading keeps only text', async (t) => {
  const host = await setup(t);
  const listed = await host.get('/ymzz/knowledge/sessions');
  assert.equal(listed.code, 200);
  assert.equal(listed.result.available, true);
  assert.deepEqual(listed.result.items.map((item) => item.id), ['session-new', 'session-old']);
  const newest = listed.result.items[0];
  assert.equal(newest.title, '標題 session-new');
  assert.equal(newest.cwd, 'C:\\工作 區');
  assert.equal(newest.updatedAt, 1_700_000_000_500);
  const read = await host.get('/ymzz/knowledge/session?id=session-new');
  assert.equal(read.code, 200);
  assert.equal(read.result.truncated, false);
  assert.match(read.result.text, /請整理 #決策 與 #知識-管理/u);
  assert.match(read.result.text, /已整理完成/u);
  assert.ok(!read.result.text.includes('ymzz_read'), 'tool arguments are not knowledge text');
  const invalid = await host.get('/ymzz/knowledge/session?id=..%2Fescape');
  assert.equal(invalid.result.error, 'SESSION_ID_INVALID');
});

test('draft -> approve -> commit is hash-bound, idempotent and searchable', async (t) => {
  const host = await setup(t);
  const picked = await host.post('/ymzz/knowledge/vault/pick', {consent: true});
  assert.equal(picked.code, 200);
  assert.equal(picked.result.path, fs.realpathSync.native(host.vaultDir));

  const saved = await host.post('/ymzz/knowledge/draft', {consent: true, draft: draftBody()});
  assert.equal(saved.code, 200);
  assert.deepEqual(saved.result.draft.tags, ['dsh', '知識-管理']);
  assert.deepEqual(saved.result.suggestedTags, ['決策'], 'suggestions come from explicit #tags only');
  const id = saved.result.draft.id;

  const approved = await host.post('/ymzz/knowledge/approve', {id, consent: true});
  assert.equal(approved.code, 200);
  assert.match(approved.result.markdown, /## 来源/u);
  assert.equal(approved.result.sha256, sha(approved.result.markdown));

  const committed = await host.post('/ymzz/knowledge/commit', {id, consent: true});
  assert.equal(committed.code, 200);
  assert.equal(committed.result.idempotent, false);
  assert.equal(committed.result.note.sha256, approved.result.sha256);
  const file = path.join(host.vaultDir, ...committed.result.note.relativePath.split('/'));
  assert.equal(sha(fs.readFileSync(file, 'utf8')), approved.result.sha256);

  const again = await host.post('/ymzz/knowledge/commit', {id, consent: true});
  assert.equal(again.result.idempotent, true);
  assert.equal(again.result.note.sha256, approved.result.sha256);

  const search = await host.get('/ymzz/knowledge/search?q=' + encodeURIComponent('知識'));
  assert.equal(search.result.notes.length, 1);
  const byTag = await host.get('/ymzz/knowledge/search?tag=dsh');
  assert.equal(byTag.result.notes.length, 1);
  const opened = await host.get('/ymzz/knowledge/open?id=' + encodeURIComponent(id));
  assert.equal(opened.result.tags.length, 2);
  assert.match(opened.result.markdown, /## 决策/u);
  assert.equal(opened.result.modified, false);

  const state = await host.get('/ymzz/knowledge/state');
  assert.equal(state.result.graph.clusters.length, 2);
  assert.equal(state.result.graph.clusters[0].tag, 'dsh');
  assert.equal(state.result.graph.clusters[0].layout.nodes.length, 1);
  assert.match(state.result.graph.text.summary, /已提交筆記 1 篇/u);
  assert.equal(state.result.notes[0].exists, true);
});

test('knowledge writes require consent, the action header and a same-site request', async (t) => {
  const host = await setup(t);
  await host.post('/ymzz/knowledge/vault/pick', {consent: true});
  const saved = await host.post('/ymzz/knowledge/draft', {consent: true, draft: draftBody()});
  const id = saved.result.draft.id;
  await host.post('/ymzz/knowledge/approve', {id, consent: true});
  const noConsent = await host.post('/ymzz/knowledge/commit', {id});
  assert.equal(noConsent.result.error, 'CONSENT_REQUIRED');
  const noHeader = await host.post('/ymzz/knowledge/commit', {id, consent: true}, {'x-ymzz-action': ''});
  assert.equal(noHeader.result.error, 'ACTION_REJECTED');
  const crossSite = await host.post('/ymzz/knowledge/commit', {id, consent: true}, {'sec-fetch-site': 'cross-site'});
  assert.equal(crossSite.result.error, 'ACTION_REJECTED');
  const revokeNoConsent = await host.post('/ymzz/knowledge/revoke', {id});
  assert.equal(revokeNoConsent.result.error, 'CONSENT_REQUIRED');
  const draftNoConsent = await host.post('/ymzz/knowledge/draft', {draft: draftBody({title: '無同意'})});
  assert.equal(draftNoConsent.result.error, 'CONSENT_REQUIRED');
  const approveNoConsent = await host.post('/ymzz/knowledge/approve', {id});
  assert.equal(approveNoConsent.result.error, 'CONSENT_REQUIRED');
  const deleteNoConsent = await host.post('/ymzz/knowledge/draft/delete', {id});
  assert.equal(deleteNoConsent.result.error, 'CONSENT_REQUIRED');
  assert.equal(fs.existsSync(path.join(host.vaultDir, 'ymzz')), false, 'no directory or file was created');
});

test('the old 8KiB limit stays on legacy routes; knowledge routes allow up to 256KiB', async (t) => {
  const host = await setup(t);
  const legacyOk = await host.post('/ymzz/profile', {nickname: 'a'.repeat(50)});
  assert.equal(legacyOk.result.ok, true);
  const legacyOversize = await host.post('/ymzz/profile', {nickname: 'ok', padding: 'y'.repeat(9000)});
  assert.equal(legacyOversize.result.error, 'BODY_TOO_LARGE');
  const drafted = await host.post('/ymzz/knowledge/draft', {consent: true, draft: draftBody({sections: {decisions: 'z'.repeat(9000)}})});
  assert.equal(drafted.code, 200);
  assert.equal(drafted.result.draft.sections.decisions.length, 9000);
  const tooLarge = await host.post('/ymzz/knowledge/draft', {consent: true, draft: draftBody({summary: 'w'.repeat(300000)})});
  assert.equal(tooLarge.result.error, 'BODY_TOO_LARGE');
});

test('MCP panel probes and restarts only, and never writes configuration', async (t) => {
  const host = await setup(t);
  const probe = await host.post('/ymzz/knowledge/mcp/probe', {name: 'fs'});
  assert.equal(probe.code, 200);
  assert.equal(probe.result.ok, true);
  assert.deepEqual(probe.result.toolNames, ['read', 'list']);
  assert.deepEqual(host.probed, ['fs']);
  const restart = await host.post('/ymzz/knowledge/mcp/restart', {name: 'fs'});
  assert.equal(restart.result.ok, true);
  assert.deepEqual(host.restarted, ['fs']);
  const badName = await host.post('/ymzz/knowledge/mcp/probe', {name: '../etc'});
  assert.equal(badName.result.error, 'MCP_SERVER_NAME_INVALID');
});

test('missing native capabilities degrade into readable status instead of a failed plugin', async (t) => {
  const host = await setup(t, {sessionQuery: false, mcp: false});
  const state = await host.get('/ymzz/knowledge/state');
  assert.equal(state.code, 200);
  assert.equal(state.result.sessions.available, false);
  assert.equal(state.result.mcp.available, false);
  assert.equal(state.result.mcp.reason, 'NATIVE_SERVICE_DISABLED');
  assert.deepEqual(state.result.mcp.tools, {total: 3, mcp: 2}, 'tool counts still work');
  const sessions = await host.get('/ymzz/knowledge/sessions');
  assert.equal(sessions.result.available, false);
  assert.equal(sessions.result.reason, 'SESSION_QUERY_UNAVAILABLE');
  assert.deepEqual(sessions.result.items, []);
  const sessionRead = await host.get('/ymzz/knowledge/session?id=session-new');
  assert.equal(sessionRead.result.error, 'SESSION_QUERY_UNAVAILABLE');
  const probe = await host.post('/ymzz/knowledge/mcp/probe', {name: 'fs'});
  assert.equal(probe.result.error, 'NATIVE_SERVICE_DISABLED');
  // The rest of the plugin still works.
  const saved = await host.post('/ymzz/knowledge/draft', {consent: true, draft: draftBody({source: {kind: 'manual'}})});
  assert.equal(saved.code, 200);
});

test('revoke moves the note to the plugin trash and the ledger survives a restart', async (t) => {
  const first = await setup(t, {cleanupRoot: false});
  await first.post('/ymzz/knowledge/vault/pick', {consent: true});
  const saved = await first.post('/ymzz/knowledge/draft', {consent: true, draft: draftBody()});
  const id = saved.result.draft.id;
  await first.post('/ymzz/knowledge/approve', {id, consent: true});
  const committed = await first.post('/ymzz/knowledge/commit', {id, consent: true});
  const relative = committed.result.note.relativePath;

  // A second apply() over the same profile sees the committed note (restart).
  const restarted = await setup(t, {profile: first, cleanupRoot: true});
  const state = await restarted.get('/ymzz/knowledge/state');
  assert.equal(state.result.notes.length, 1);
  assert.equal(state.result.notes[0].relativePath, relative);
  const search = await restarted.get('/ymzz/knowledge/search?q=' + encodeURIComponent('標籤化'));
  assert.equal(search.result.notes.length, 1);

  const revoked = await restarted.post('/ymzz/knowledge/revoke', {id, consent: true});
  assert.equal(revoked.code, 200);
  assert.ok(fs.existsSync(revoked.result.trashPath));
  assert.ok(revoked.result.trashPath.startsWith(path.join(first.dataDir, 'knowledge-trash')));
  assert.equal(fs.existsSync(path.join(first.vaultDir, ...relative.split('/'))), false);
  const after = await restarted.get('/ymzz/knowledge/state');
  assert.equal(after.result.notes.length, 0);
  assert.equal(after.result.trash.length, 1);
  assert.equal(after.result.graph.clusters.length, 0);
});

test('committed notes auto-register as kind=note entities and revoking drops them', async (t) => {
  const host = await setup(t);
  await host.post('/ymzz/knowledge/vault/pick', {consent: true});
  const saved = await host.post('/ymzz/knowledge/draft', {consent: true, draft: draftBody()});
  const id = saved.result.draft.id;
  await host.post('/ymzz/knowledge/approve', {id, consent: true});
  const committed = await host.post('/ymzz/knowledge/commit', {id, consent: true});
  assert.equal(committed.code, 200);

  const tags = await host.get('/ymzz/tags/state');
  assert.equal(tags.code, 200);
  assert.equal(tags.result.total, 1, 'only the committed note is registered, nothing was scanned');
  const entity = tags.result.entities[0];
  assert.equal(entity.kind, 'note');
  assert.equal(entity.id, id);
  assert.equal(entity.locator, `ymzz:note/${id}`);
  assert.deepEqual(entity.tags, ['dsh', '知識-管理']);
  assert.equal(entity.metadata.relativePath, committed.result.note.relativePath);
  assert.equal(tags.result.counts.byKind.note, 1);
  assert.deepEqual(tags.result.tags.map((entry) => entry.tag).sort(), ['dsh', '知識-管理'].sort());
  const cluster = tags.result.graph.clusters.find((entry) => entry.tag === 'dsh');
  assert.equal(cluster.layout.nodes[0].id, id);

  const located = await host.get('/ymzz/tags/locate?id=' + encodeURIComponent(id));
  assert.equal(located.result.kind, 'note');
  assert.equal(located.result.relativePath, committed.result.note.relativePath);
  assert.equal(located.result.openable, true);

  // A second commit is idempotent and must not duplicate the entity.
  await host.post('/ymzz/knowledge/commit', {id, consent: true});
  assert.equal((await host.get('/ymzz/tags/state')).result.total, 1);

  await host.post('/ymzz/knowledge/revoke', {id, consent: true});
  const afterRevoke = await host.get('/ymzz/tags/state');
  assert.equal(afterRevoke.result.total, 0);
  assert.equal(afterRevoke.result.counts.byKind.note, 0);
  const missing = await host.get('/ymzz/tags/locate?id=' + encodeURIComponent(id));
  assert.equal(missing.result.error, 'ENTITY_NOT_FOUND');
});

test('tag registry routes register explicit pointers, Lists and tags with consent', async (t) => {
  const host = await setup(t);
  const state = await host.get('/ymzz/tags/state');
  assert.equal(state.code, 200);
  assert.deepEqual(state.result.entities, []);
  assert.deepEqual(state.result.lists, []);
  assert.deepEqual(state.result.kinds, ['session', 'message', 'thought', 'web', 'file', 'artifact', 'note', 'task']);
  assert.ok(state.result.sources.includes('taskboard'));

  const noConsent = await host.post('/ymzz/tags/entity', {entity: {kind: 'web', title: 'x', locator: 'https://example.com/'}});
  assert.equal(noConsent.result.error, 'CONSENT_REQUIRED');
  const noHeader = await host.post('/ymzz/tags/entity', {consent: true, entity: {kind: 'web', title: 'x', locator: 'https://example.com/'}}, {'x-ymzz-action': ''});
  assert.equal(noHeader.result.error, 'ACTION_REJECTED');

  const list = await host.post('/ymzz/tags/list', {consent: true, name: '待讀', description: '稍後閱讀'});
  assert.equal(list.code, 200);
  const listId = list.result.id;

  const web = await host.post('/ymzz/tags/entity', {
    consent: true,
    entity: {kind: 'web', title: '  現代網頁 指南 ', locator: 'https://example.com/guide', tags: ['Web', '#知識 管理'], lists: [listId], source: 'web'},
  });
  assert.equal(web.code, 200);
  assert.equal(web.result.title, '現代網頁 指南');
  assert.deepEqual(web.result.tags, ['web', '知識-管理']);
  assert.deepEqual(web.result.lists, [listId]);

  const session = await host.post('/ymzz/tags/entity', {
    consent: true,
    entity: {kind: 'session', title: '標題 session-new', locator: 'dsh:session/session-new', tags: ['知識 管理'], source: 'dsh'},
  });
  assert.equal(session.code, 200);
  const badLocator = await host.post('/ymzz/tags/entity', {
    consent: true,
    entity: {kind: 'session', title: '壞', locator: 'https://example.com', source: 'dsh'},
  });
  assert.equal(badLocator.result.error, 'LOCATOR_SESSION_REQUIRED');
  const credential = await host.post('/ymzz/tags/entity', {
    consent: true,
    entity: {kind: 'web', title: '壞', locator: 'https://user:pass@example.com/'},
  });
  assert.equal(credential.result.error, 'LOCATOR_CREDENTIALS_FORBIDDEN');

  // The same entity sits in both clusters because it carries both tags.
  const byTag = await host.get('/ymzz/tags/query?tag=' + encodeURIComponent('知識 管理'));
  assert.equal(byTag.result.total, 2);
  const inList = await host.get('/ymzz/tags/query?list=' + encodeURIComponent(listId));
  assert.equal(inList.result.total, 1);
  const byKind = await host.get('/ymzz/tags/query?kind=session');
  assert.equal(byKind.result.total, 1);
  const keyword = await host.get('/ymzz/tags/query?q=' + encodeURIComponent('網頁'));
  assert.equal(keyword.result.total, 1);

  const tagged = await host.post('/ymzz/tags/tag', {consent: true, id: web.result.id, tag: '研究'});
  assert.ok(tagged.result.entity.tags.includes('研究'));
  const untagged = await host.post('/ymzz/tags/tag', {consent: true, id: web.result.id, tag: '研究', add: false});
  assert.equal(untagged.result.entity.tags.includes('研究'), false);

  const joined = await host.post('/ymzz/tags/membership', {consent: true, listId, entityId: session.result.id});
  assert.deepEqual(joined.result.entity.lists, [listId]);
  const revisions = await host.get('/ymzz/tags/revisions?id=' + encodeURIComponent(web.result.id));
  assert.equal(revisions.result.entries.length >= 1, true);
  const restored = await host.post('/ymzz/tags/restore', {consent: true, id: web.result.id, revision: 1});
  assert.equal(restored.result.title, '現代網頁 指南');

  const removedList = await host.post('/ymzz/tags/list/delete', {consent: true, id: listId});
  assert.equal(removedList.result.detached, 2);
  const removed = await host.post('/ymzz/tags/entity/delete', {consent: true, id: session.result.id});
  assert.equal(removed.result.ok, true);
  const finalState = await host.get('/ymzz/tags/state');
  assert.equal(finalState.result.total, 1);
  assert.equal(finalState.result.lists.length, 0);
  // Registry writes never touch the Vault or the knowledge ledger.
  assert.equal(fs.existsSync(path.join(host.dataDir, 'knowledge.json')), false);
  assert.equal(fs.existsSync(path.join(host.vaultDir, 'ymzz')), false);
});

test('tag registry routes degrade instead of breaking the plugin when knowledge is unavailable', async (t) => {
  const host = await setup(t);
  const ok = await host.get('/ymzz/tags/state');
  assert.equal(ok.code, 200);
  const unknown = await host.get('/ymzz/tags/locate?id=missing');
  assert.equal(unknown.result.error, 'ENTITY_NOT_FOUND');
  const badList = await host.get('/ymzz/tags/query?list=missing');
  assert.equal(badList.result.error, 'LIST_NOT_FOUND');
  const badKind = await host.get('/ymzz/tags/query?kind=crawler');
  assert.equal(badKind.result.error, 'ENTITY_KIND_INVALID');
});
