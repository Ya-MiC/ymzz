// MIT. Independent knowledge dock for the native DSH web application.
// Own stable DOM root outside the 700ms task-panel re-render; delegated events;
// every write is an explicit, guarded POST to the authenticated /ymzz routes.
(() => {
  const DOCK_ID = 'ymzz-knowledge-dock';
  const POLL_MS = 6000;

  const h = (tag, text, attrs = {}) => {
    const element = document.createElement(tag);
    if (text !== undefined && text !== null) element.textContent = String(text);
    for (const [name, value] of Object.entries(attrs)) {
      if (value === false || value === null || value === undefined) continue;
      element.setAttribute(name, value === true ? '' : String(value));
    }
    return element;
  };
  const svg = (tag, attrs = {}) => {
    const element = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [name, value] of Object.entries(attrs)) element.setAttribute(name, String(value));
    return element;
  };
  const api = async (route, body) => {
    const response = await fetch(`/ymzz/${route}`, {
      method: body ? 'POST' : 'GET',
      headers: body ? {'content-type': 'application/json', 'x-ymzz-action': '1'} : {},
      ...(body ? {body: JSON.stringify(body)} : {}),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'DSH_PLUGIN_REQUEST_FAILED');
    return data;
  };

  const ready = () => {
    if (document.getElementById(DOCK_ID)) return;

    const ui = {
      state: null,
      draft: null,
      filterTag: '',
      query: '',
      active: new Set(),
      lastSignature: '',
      openNoteId: '',
      registry: null,
      reg: {kind: '', tag: ''},
    };

    const status = h('p', '', {class: 'ymzz-k-status', role: 'status', 'aria-live': 'polite'});
    const region = (name) => dock.querySelector(`[data-ymzz-region="${name}"]`);

    const setStatus = (message, kind = 'info') => {
      status.textContent = message;
      status.dataset.kind = kind;
    };
    const guarded = (key, run) => async (event) => {
      event?.preventDefault?.();
      if (key && ui.active.has(key)) return;
      if (key) ui.active.add(key);
      try {
        setStatus('處理中…');
        await run();
        setStatus('');
      } catch (error) {
        setStatus(error.message || '操作失敗', 'error');
      } finally {
        if (key) ui.active.delete(key);
        renderRegions();
      }
    };

    // ---------- skeleton ----------
    const openInDock = () => {
      dock.dataset.ymzzKnowledgeOpen = 'true';
      document.body.dataset.ymzzKnowledgeOpen = 'true';
      tab.setAttribute('aria-expanded', 'true');
      localStorage.setItem('ymzz-knowledge-open', '1');
      void refresh(true);
      void refreshRegistry();
    };
    const closeDock = () => {
      dock.dataset.ymzzKnowledgeOpen = 'false';
      document.body.dataset.ymzzKnowledgeOpen = 'false';
      tab.setAttribute('aria-expanded', 'false');
      localStorage.setItem('ymzz-knowledge-open', '0');
      tab.focus();
    };

    const tab = h('button', '知識', {
      id: 'ymzz-knowledge-tab',
      type: 'button',
      'aria-controls': DOCK_ID,
      'aria-expanded': 'false',
      title: '湛箴 標籤知識面板',
    });
    const dock = h('aside', '', {
      id: DOCK_ID,
      'data-ymzz-knowledge-open': 'false',
      'aria-label': '湛箴 標籤知識面板',
    });
    dock.dataset.ymzzScheme = 'light';

    const heading = h('h2', '標籤知識');
    const closeButton = h('button', '收起', {type: 'button', 'data-ymzz-action': 'close', 'aria-label': '收起標籤知識面板'});
    const newButton = h('button', '新建草稿', {type: 'button', 'data-ymzz-action': 'new-draft'});
    const head = h('header', '', {class: 'ymzz-k-head'});
    head.append(heading, h('div', '', {class: 'ymzz-k-head-actions'}));
    head.lastChild.append(newButton, closeButton);

    const body = h('div', '', {class: 'ymzz-k-body'});
    const draftsSection = h('section', '', {class: 'ymzz-k-section', 'aria-label': '待整理草稿'});
    draftsSection.append(h('h3', '待整理草稿'), h('div', '', {'data-ymzz-region': 'drafts'}));

    const searchSection = h('section', '', {class: 'ymzz-k-section', 'aria-label': '標籤過濾與搜尋'});
    const searchInput = h('input', '', {
      type: 'search',
      name: 'q',
      maxlength: '120',
      placeholder: '搜尋標題、標籤、正文',
      'aria-label': '搜尋已提交筆記',
    });
    const searchButton = h('button', '搜尋', {type: 'submit'});
    const searchForm = h('form', '', {class: 'ymzz-k-search'});
    searchForm.append(searchInput, searchButton);
    const tagBox = h('div', '', {class: 'ymzz-k-tags', 'data-ymzz-region': 'tags', role: 'group', 'aria-label': '標籤過濾'});
    const searchResults = h('div', '', {'data-ymzz-region': 'search-results'});
    searchSection.append(h('h3', '標籤過濾與搜尋'), searchForm, tagBox, searchResults);

    const notesSection = h('section', '', {class: 'ymzz-k-section', 'aria-label': '已提交筆記'});
    const vaultBox = h('div', '', {class: 'ymzz-k-vault', 'data-ymzz-region': 'vault'});
    notesSection.append(h('h3', '已提交筆記'), vaultBox, h('div', '', {'data-ymzz-region': 'notes'}));

    const graphSection = h('section', '', {class: 'ymzz-k-section', 'aria-label': '標籤星雲圖'});
    graphSection.append(
      h('h3', '星雲圖（按頂級標籤分簇）'),
      h('p', '每簇中心為標籤，周圍為筆記；跨簇共享的筆記會出現在多個簇。', {class: 'ymzz-k-hint'}),
      h('div', '', {'data-ymzz-region': 'graph'}),
    );

    const registrySection = h('section', '', {class: 'ymzz-k-section', 'aria-label': '標籤庫'});
    registrySection.append(
      h('h3', '標籤庫（跨會話）'),
      h('p', '會話、訊息、網頁、檔案與筆記都可註冊為條目；只登記你明確加入的內容，不掃描、不讀瀏覽歷史。', {class: 'ymzz-k-hint'}),
      h('div', '', {'data-ymzz-region': 'registry'}),
    );

    const mcpDetails = h('details', '', {class: 'ymzz-k-section ymzz-k-mcp'});
    mcpDetails.append(h('summary', 'MCP 原生狀態'), h('div', '', {'data-ymzz-region': 'mcp'}));

    const editorPanel = h('div', '', {class: 'ymzz-k-editor', 'data-ymzz-region': 'editor', hidden: true});
    body.append(editorPanel, draftsSection, searchSection, notesSection, graphSection, registrySection, mcpDetails);
    dock.append(head, status, body);

    const noteDialog = h('dialog', '', {id: 'ymzz-knowledge-note', 'aria-label': '已提交筆記內容'});
    const noteHead = h('header', '', {class: 'ymzz-k-head'});
    const noteTitle = h('h3', '');
    const noteClose = h('button', '關閉', {type: 'button', 'data-ymzz-action': 'close-note'});
    noteHead.append(noteTitle, noteClose);
    const noteTags = h('p', '', {class: 'ymzz-k-note-tags'});
    const noteMeta = h('p', '', {class: 'ymzz-k-hint'});
    const noteBody = h('pre', '', {class: 'ymzz-k-note-body'});
    const noteRevoke = h('button', '撤銷這篇筆記（移到知識垃圾桶）', {type: 'button', 'data-ymzz-action': 'revoke-open'});
    noteDialog.append(noteHead, noteTags, noteMeta, noteBody, noteRevoke);

    document.body.append(tab, dock, noteDialog);
    document.body.dataset.ymzzKnowledge = '';

    // ---------- rendering ----------
    const renderDrafts = () => {
      const box = region('drafts');
      box.replaceChildren();
      const drafts = ui.state?.drafts ?? [];
      if (!drafts.length) {
        box.append(h('p', '尚無草稿。可從會話或手工文字建立第一篇。', {class: 'ymzz-k-hint'}));
        return;
      }
      for (const draft of drafts) {
        const card = h('article', '', {class: 'ymzz-k-card'});
        card.append(h('h4', draft.title));
        if (draft.summary) card.append(h('p', draft.summary.slice(0, 160)));
        const tags = h('p', '', {class: 'ymzz-k-tagline'});
        tags.textContent = draft.tags.length ? draft.tags.map((tag) => `#${tag}`).join(' ') : '（無標籤）';
        card.append(tags);
        card.append(
          h('p', `${statusLabel(draft.status)} · 目標 ${draft.targetPath}`, {class: 'ymzz-k-hint'}),
        );
        const actions = h('div', '', {class: 'ymzz-k-actions'});
        actions.append(
          button('編輯', 'edit-draft', draft.id),
          button(draft.status === 'approved' ? '重新審批' : '審批（綁定雜湊）', 'approve', draft.id),
          button('寫入 Vault', 'commit', draft.id, draft.status !== 'approved'),
          button('刪除草稿', 'delete-draft', draft.id),
        );
        card.append(actions);
        if (draft.approvedSha256) card.append(h('p', `審批雜湊 ${draft.approvedSha256.slice(0, 16)}…`, {class: 'ymzz-k-hint'}));
        box.append(card);
      }
    };

    const renderTags = () => {
      const box = region('tags');
      box.replaceChildren();
      const counts = new Map();
      for (const note of ui.state?.notes ?? []) {
        if (!note.exists) continue;
        for (const tag of note.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
      }
      if (ui.filterTag) {
        box.append(button(`清除過濾 #${ui.filterTag}`, 'clear-tag'));
      }
      const entries = [...counts.entries()].sort((a, b) => (b[1] - a[1]) || (a[0] < b[0] ? -1 : 1)).slice(0, 24);
      if (!entries.length) {
        box.append(h('p', '尚無已提交筆記的標籤。', {class: 'ymzz-k-hint'}));
        return;
      }
      for (const [tag, count] of entries) {
        const chip = button(`#${tag} (${count})`, 'filter-tag', tag);
        if (tag === ui.filterTag) chip.setAttribute('aria-pressed', 'true');
        box.append(chip);
      }
    };

    const renderNotes = () => {
      const vault = region('vault');
      vault.replaceChildren();
      const config = ui.state?.vault ?? {configured: false};
      const pathText = config.configured ? (config.path || '') : '尚未設定 Vault';
      vault.append(h('p', `Vault：${pathText}`, {class: 'ymzz-k-hint'}));
      if (config.configured && !config.available) {
        vault.append(h('p', `Vault 不可用：${config.reason}`, {class: 'ymzz-k-error'}));
      }
      vault.append(button('用原生目錄選擇器設定 Vault', 'pick-vault'));
      if (ui.state?.recoveredFrom) {
        vault.append(h('p', `已從損壞的 knowledge.json 備份恢復：${ui.state.recoveredFrom}`, {class: 'ymzz-k-error'}));
      }
      const box = region('notes');
      box.replaceChildren();
      const notes = ui.state?.notes ?? [];
      if (!notes.length) {
        box.append(h('p', '尚無已提交筆記。審批後寫入才會出現在此。', {class: 'ymzz-k-hint'}));
        return;
      }
      for (const note of notes) {
        const row = h('article', '', {class: 'ymzz-k-card'});
        row.append(h('h4', note.title));
        row.append(h('p', note.tags.map((tag) => `#${tag}`).join(' ') || '（無標籤）', {class: 'ymzz-k-tagline'}));
        row.append(h('p', note.relativePath, {class: 'ymzz-k-hint'}));
        if (!note.exists) {
          row.append(h('p', note.vaultMatch === false ? '此筆記屬於先前選定的另一個 Vault，目前不可檢索。' : '檔案已不在目前 Vault，僅保留記錄。', {class: 'ymzz-k-error'}));
        }
        const actions = h('div', '', {class: 'ymzz-k-actions'});
        actions.append(button('開啟', 'open-note', note.id, !note.exists));
        row.append(actions);
        box.append(row);
      }
    };

    const renderSearch = (results) => {
      const box = region('search-results');
      box.replaceChildren();
      if (!results) return;
      if (!results.notes.length) {
        box.append(h('p', ui.query || ui.filterTag ? '沒有符合的筆記。' : '輸入關鍵字或點選標籤以搜尋。', {class: 'ymzz-k-hint'}));
        return;
      }
      for (const note of results.notes) {
        const row = h('article', '', {class: 'ymzz-k-card'});
        row.append(h('h4', note.title));
        row.append(h('p', note.snippet || '', {class: 'ymzz-k-hint'}));
        row.append(h('p', note.tags.length ? `#${note.tags.join(' #')}` : '（無標籤）', {class: 'ymzz-k-tagline'}));
        const actions = h('div', '', {class: 'ymzz-k-actions'});
        actions.append(button('開啟', 'open-note', note.id));
        row.append(actions);
        box.append(row);
      }
      if (results.truncated) box.append(h('p', '結果已截斷，請縮小查詢。', {class: 'ymzz-k-hint'}));
    };

    const renderGraph = () => {
      const box = region('graph');
      box.replaceChildren();
      const graph = ui.state?.graph;
      if (!graph || !graph.clusters.length) {
        box.append(h('p', '尚無足夠的已提交筆記形成星雲圖。', {class: 'ymzz-k-hint'}));
        return;
      }
      box.append(h('p', graph.text?.summary || `${graph.noteCount} 篇筆記`, {class: 'ymzz-k-hint'}));
      for (const cluster of graph.clusters) {
        const figure = h('figure', '', {class: 'ymzz-k-figure'});
        const chart = svg('svg', {
          viewBox: '0 0 320 200',
          width: '100%',
          height: '160',
          role: 'img',
          'aria-labelledby': `ymzz-k-cluster-${cluster.tag}`,
        });
        const title = svg('title', {id: `ymzz-k-cluster-${cluster.tag}`});
        title.textContent = `${cluster.label} 簇：${cluster.noteCount} 篇筆記`;
        const desc = svg('desc');
        desc.textContent = cluster.notes.map((note) => note.title).join('、');
        chart.append(title, desc);
        // Geometry comes from the Host (knowledge-graph.mjs); no local math to drift.
        const layout = cluster.layout || {width: 320, height: 200, cx: 160, cy: 100, r: 60, centerRadius: 22, nodeRadius: 8, nodes: []};
        chart.append(svg('circle', {cx: layout.cx, cy: layout.cy, r: layout.r, class: 'ymzz-k-orbit'}));
        chart.append(svg('circle', {cx: layout.cx, cy: layout.cy, r: layout.centerRadius, class: 'ymzz-k-hub'}));
        for (const node of layout.nodes) {
          chart.append(svg('line', {x1: layout.cx, y1: layout.cy, x2: node.x, y2: node.y, class: 'ymzz-k-edge'}));
        }
        for (const node of layout.nodes) {
          const dot = svg('circle', {
            cx: node.x,
            cy: node.y,
            r: layout.nodeRadius,
            class: node.shared ? 'ymzz-k-node ymzz-k-node-shared' : 'ymzz-k-node',
            tabindex: '0',
            role: 'button',
            'aria-label': `開啟筆記 ${node.title}`,
            'data-ymzz-node': node.id,
          });
          const nodeTitle = svg('title');
          nodeTitle.textContent = node.shared ? `${node.title}（跨簇共享）` : node.title;
          dot.append(nodeTitle);
          chart.append(dot);
        }
        const hubLabel = svg('text', {x: layout.cx, y: layout.cy + 4, 'text-anchor': 'middle', class: 'ymzz-k-hub-label'});
        hubLabel.textContent = cluster.tag === 'untagged' ? '未標籤' : `#${cluster.tag}`;
        chart.append(hubLabel);
        const caption = h('figcaption');
        caption.append(button(cluster.label, 'filter-tag', cluster.tag));
        caption.append(h('span', ` ${cluster.noteCount} 篇${cluster.truncated ? '（僅顯示部分）' : ''}`));
        const alt = h('ul', '', {class: 'ymzz-k-alt'});
        for (const note of cluster.notes) alt.append(h('li', note.shared ? `${note.title}（跨簇共享）` : note.title));
        figure.append(chart, caption, alt);
        box.append(figure);
      }
    };

    const renderMcp = () => {
      const box = region('mcp');
      box.replaceChildren();
      const mcp = ui.state?.mcp;
      if (!mcp) {
        box.append(h('p', '狀態未載入。', {class: 'ymzz-k-hint'}));
        return;
      }
      if (!mcp.available) {
        const message =
          mcp.reason === 'NATIVE_SERVICE_DISABLED'
            ? '原生 MCP 服務未啟用（目前 Host 未掛載 mcpManager）。配置與啟停請在 DSH 原生 Settings 完成。'
            : `MCP 狀態讀取失敗：${mcp.reason}${mcp.detail ? ` · ${mcp.detail}` : ''}`;
        box.append(h('p', message, {class: 'ymzz-k-hint'}));
        box.append(h('p', `工具總數 ${mcp.tools.total}，其中 mcp__ ${mcp.tools.mcp}。`, {class: 'ymzz-k-hint'}));
        return;
      }
      box.append(h('p', `工具總數 ${mcp.tools.total}，其中 mcp__ ${mcp.tools.mcp}。配置仍由 DSH 原生 Settings 管理，此面板不寫入配置。`, {class: 'ymzz-k-hint'}));
      if (!mcp.servers.length) {
        box.append(h('p', '目前沒有已配置或已註冊的 MCP server。', {class: 'ymzz-k-hint'}));
        return;
      }
      for (const server of mcp.servers) {
        const row = h('article', '', {class: 'ymzz-k-card'});
        row.append(h('h4', server.name));
        row.append(h('p', `${server.status}${server.configured ? '' : ' · 已從配置移除'}`, {class: 'ymzz-k-hint'}));
        const actions = h('div', '', {class: 'ymzz-k-actions'});
        actions.append(button('檢查連線', 'mcp-probe', server.name), button('重啟', 'mcp-restart', server.name));
        row.append(actions);
        box.append(row);
      }
    };

    const renderEditor = () => {
      const box = region('editor');
      box.replaceChildren();
      if (!ui.draft) {
        box.hidden = true;
        return;
      }
      box.hidden = false;
      const draft = ui.draft;
      box.append(h('h3', draft.id ? '編輯草稿' : '新建草稿'));
      const form = h('form', '', {class: 'ymzz-k-form', 'data-ymzz-role': 'draft-form'});
      const field = (label, control) => {
        const wrap = h('label');
        wrap.append(h('span', label), control);
        return wrap;
      };
      const title = h('input', '', {name: 'title', maxlength: '200', required: true, value: draft.title || ''});
      const summary = h('textarea', '', {name: 'summary', maxlength: '2000', rows: '2'});
      summary.value = draft.summary || '';
      const tags = h('input', '', {name: 'tags', value: (draft.tags || []).join(', '), placeholder: '空格或逗號分隔'});
      const links = h('input', '', {name: 'links', value: (draft.links || []).join(', '), placeholder: '關聯筆記標題'});
      const target = h('input', '', {
        name: 'targetPath',
        maxlength: '200',
        value: draft.targetPath || '',
        placeholder: '留空自動：ymzz/年/月/標題-id.md',
      });
      const sections = {};
      for (const [key, label] of [
        ['decisions', '決策'],
        ['events', '事件'],
        ['resources', '資源'],
        ['actions', '行動'],
      ]) {
        const area = h('textarea', '', {name: `section-${key}`, maxlength: '20000', rows: '3'});
        area.value = draft.sections?.[key] || '';
        sections[key] = area;
        form.append(field(label, area));
      }
      form.prepend(field('標題', title), field('摘要', summary), field('標籤', tags), field('關聯', links));
      form.append(field('寫入路徑', target));
      if (draft.source?.kind === 'session') {
        form.append(h('p', `來源會話：${draft.source.sessionTitle || ''} ${draft.source.sessionId}`, {class: 'ymzz-k-hint'}));
      }
      const suggestions = h('p', '', {class: 'ymzz-k-hint'});
      suggestions.textContent = '建議標籤僅取用內文中你明確寫出的 #標籤，不做自動理解。';
      const actions = h('div', '', {class: 'ymzz-k-actions'});
      actions.append(
        h('button', '儲存草稿', {type: 'submit'}),
        button('從最近的會話取用', 'sessions'),
        button('取消', 'cancel-draft'),
      );
      form.append(suggestions, actions);
      const sessionBox = h('div', '', {'data-ymzz-region': 'sessions'});
      box.append(form, sessionBox);
      form.onsubmit = guarded('save-draft', async () => {
        // Read the live draft, not the render-time closure: a first save assigns
        // the server id, and the second save must update instead of duplicating.
        const current = ui.draft || draft;
        const collected = {
          id: current.id || undefined,
          title: title.value,
          summary: summary.value,
          tags: tags.value.split(/[,，\s]+/u).filter(Boolean),
          links: links.value.split(/[,，]+/u).filter(Boolean),
          targetPath: target.value,
          sections: Object.fromEntries(Object.entries(sections).map(([key, area]) => [key, area.value])),
          source: current.source || {kind: 'manual'},
        };
        const result = await api('knowledge/draft', {draft: collected, consent: true});
        ui.draft = result.draft;
        if (result.suggestedTags?.length) {
          suggestions.textContent = `建議標籤（來自你輸入的 #標籤）：${result.suggestedTags.map((tag) => `#${tag}`).join(' ')}`;
        }
        await refresh(true);
      });
    };

    const renderRegions = () => {
      if (!ui.state) return;
      renderDrafts();
      renderTags();
      renderNotes();
      renderGraph();
      renderRegistry();
      renderMcp();
    };

    // ---------- helpers ----------
    const button = (label, action, id, disabled = false) => {
      const element = h('button', label, {type: 'button', 'data-ymzz-action': action});
      if (id !== undefined && id !== null && id !== '') element.dataset.ymzzId = id;
      if (disabled) element.disabled = true;
      if (ui.active.has(`${action}:${id ?? ''}`)) element.disabled = true;
      return element;
    };
    const statusLabel = (status) =>
      status === 'approved' ? '已審批（尚未寫入）' : status === 'committed' ? '已寫入 Vault' : status === 'revoked' ? '已撤銷' : '草稿';

    // ---------- registry (跨會話標籤庫) ----------
    const KIND_LABELS = {
      session: '會話',
      message: '訊息',
      thought: '思考',
      web: '網頁',
      file: '檔案',
      artifact: '作品',
      note: '筆記',
      task: '任務',
    };

    const refreshRegistry = async () => {
      const box = region('registry');
      try {
        const params = new URLSearchParams();
        if (ui.reg.kind) params.set('kind', ui.reg.kind);
        if (ui.reg.tag) params.set('tag', ui.reg.tag);
        ui.registry = await api(`tags/state?${params.toString()}`);
        renderRegistry();
      } catch (error) {
        ui.registry = null;
        box.replaceChildren(h('p', `標籤庫未連線：${error.message}`, {class: 'ymzz-k-hint'}));
      }
    };

    const renderRegistry = () => {
      const box = region('registry');
      box.replaceChildren();
      const page = ui.registry;
      if (!page) {
        box.append(h('p', '尚未載入標籤庫。', {class: 'ymzz-k-hint'}));
        return;
      }
      const chips = h('div', '', {class: 'ymzz-k-tags'});
      const filterChip = (label, kind) => {
        const element = button(label, 'reg-kind', kind);
        if ((ui.reg.kind || '') === kind) element.setAttribute('aria-pressed', 'true');
        return element;
      };
      chips.append(filterChip('全部', ''));
      for (const kind of page.kinds ?? []) chips.append(filterChip(KIND_LABELS[kind] ?? kind, kind));
      box.append(h('p', `條目 ${page.total ?? 0}${page.truncated ? '（已截斷）' : ''} · 標籤 ${page.counts?.tags ?? 0} · List ${page.counts?.lists ?? 0}`, {class: 'ymzz-k-hint'}), chips);

      const tagChips = h('div', '', {class: 'ymzz-k-tags'});
      for (const {tag, count} of (page.tags ?? []).slice(0, 16)) {
        const element = button(`#${tag} (${count})`, 'reg-tag', tag);
        if (ui.reg.tag === tag) element.setAttribute('aria-pressed', 'true');
        tagChips.append(element);
      }
      if ((page.tags ?? []).length) box.append(tagChips);

      for (const entity of page.entities ?? []) {
        const row = h('article', '', {class: 'ymzz-k-card'});
        row.append(h('h4', entity.title));
        row.append(h('p', `${KIND_LABELS[entity.kind] ?? entity.kind} · ${entity.locator}`, {class: 'ymzz-k-hint'}));
        row.append(h('p', (entity.tags ?? []).map((tag) => `#${tag}`).join(' ') || '（無標籤）', {class: 'ymzz-k-tagline'}));
        const actions = h('div', '', {class: 'ymzz-k-actions'});
        if (entity.kind === 'note' && String(entity.locator || '').startsWith('ymzz:note/')) {
          actions.append(button('開啟筆記', 'reg-open', entity.id));
        }
        for (const list of page.lists ?? []) {
          const member = (entity.lists ?? []).includes(list.id);
          const toggle = h('button', `${member ? '−' : '+'} ${list.name}`, {type: 'button', 'data-ymzz-action': 'reg-member'});
          toggle.dataset.ymzzId = entity.id;
          toggle.dataset.ymzzList = list.id;
          if (member) toggle.setAttribute('aria-pressed', 'true');
          actions.append(toggle);
        }
        actions.append(button('移除條目', 'reg-delete', entity.id));
        row.append(actions);
        box.append(row);
      }
      if (!(page.entities ?? []).length) {
        box.append(h('p', ui.reg.kind || ui.reg.tag ? '沒有符合過濾條件的條目。' : '標籤庫還是空的。已寫入 Vault 的筆記會自動出現在這裡；網頁與檔案用下面的表單登記。', {class: 'ymzz-k-hint'}));
      }

      // Lists management.
      const listRow = h('div', '', {class: 'ymzz-k-actions'});
      for (const list of page.lists ?? []) {
        listRow.append(button(`刪除 List「${list.name}」`, 'reg-list-delete', list.id));
      }
      const listInput = h('input', '', {type: 'text', maxlength: '40', placeholder: '新 List 名稱', 'aria-label': '新 List 名稱', 'data-ymzz-list-name': '1'});
      listRow.append(listInput, button('建立 List', 'reg-list-create', ''));
      box.append(listRow);

      // Manual registration: the only entry point besides committed notes.
      const add = h('div', '', {class: 'ymzz-k-editor'});
      const kindSelect = h('select', '', {'aria-label': '條目類型', 'data-ymzz-reg-kind': '1'});
      for (const kind of page.kinds ?? []) kindSelect.append(h('option', KIND_LABELS[kind] ?? kind, {value: kind}));
      const titleInput = h('input', '', {type: 'text', maxlength: '120', placeholder: '標題（必填）', 'aria-label': '條目標題', 'data-ymzz-reg-title': '1'});
      const locatorInput = h('input', '', {type: 'text', maxlength: '400', placeholder: '定位：https://… 或本機路徑（必填）', 'aria-label': '條目定位', 'data-ymzz-reg-locator': '1'});
      const tagsInput = h('input', '', {type: 'text', maxlength: '200', placeholder: '標籤，逗號或 # 分隔', 'aria-label': '條目標籤', 'data-ymzz-reg-tags': '1'});
      add.append(h('p', '登記網頁或本機檔案', {class: 'ymzz-k-hint'}), kindSelect, titleInput, locatorInput, tagsInput, button('加入標籤庫', 'reg-add', ''));
      box.append(add);
    };

    const refresh = async (force = false) => {
      let state;
      try {
        state = await api('knowledge/state');
      } catch (error) {
        setStatus(`知識面板尚未連線：${error.message}`, 'error');
        return;
      }
      const signature = JSON.stringify({notes: state.notes, drafts: state.drafts, vault: state.vault, mcp: state.mcp, graph: state.graph});
      ui.state = state;
      if (force || signature !== ui.lastSignature) {
        ui.lastSignature = signature;
        renderRegions();
      }
      if (state.vault?.configured && !state.vault.available) setStatus(`Vault 不可用：${state.vault.reason}`, 'error');
    };

    const openNote = async (id) => {
      const note = await api(`knowledge/open?id=${encodeURIComponent(id)}`);
      ui.openNoteId = note.id;
      noteTitle.textContent = note.title;
      noteTags.textContent = note.tags.map((tag) => `#${tag}`).join(' ') || '（無標籤）';
      noteMeta.textContent = `${note.relativePath}${note.modified ? ' · 磁碟內容已被外部修改（撤銷會被拒絕）' : ''}`;
      noteBody.textContent = note.markdown;
      noteRevoke.disabled = note.modified === true;
      noteRevoke.title = note.modified ? '檔案已被外部修改，撤銷會被拒絕' : '移到本機知識垃圾桶，不永久刪除';
      noteDialog.showModal();
    };

    const readSessions = async () => {
      const box = region('sessions');
      box.replaceChildren(h('p', '讀取最近會話…'));
      const result = await api('knowledge/sessions');
      box.replaceChildren();
      if (!result.available) {
        box.append(h('p', result.reason === 'SESSION_QUERY_UNAVAILABLE' ? '此 Host 未提供會話查詢能力，請改用手工輸入。' : `會話讀取失敗：${result.reason}`, {class: 'ymzz-k-hint'}));
        return;
      }
      if (!result.items.length) {
        box.append(h('p', '沒有可讀取的會話。', {class: 'ymzz-k-hint'}));
        return;
      }
      box.append(h('p', '僅取用有界文本；不會自動理解或生成結論。', {class: 'ymzz-k-hint'}));
      for (const item of result.items) {
        const row = h('article', '', {class: 'ymzz-k-card'});
        row.append(h('h4', item.title));
        row.append(h('p', `${item.cwd || '（無工作目錄）'} · ${new Date(item.updatedAt || item.createdAt || Date.now()).toLocaleString()}`, {class: 'ymzz-k-hint'}));
        const actions = h('div', '', {class: 'ymzz-k-actions'});
        actions.append(button('取用為草稿', 'use-session', item.id));
        row.append(actions);
        box.append(row);
      }
    };

    const useSession = async (id) => {
      const session = await api(`knowledge/session?id=${encodeURIComponent(id)}`);
      ui.draft = {
        title: session.title || '會話筆記',
        summary: '',
        tags: [],
        links: [],
        sections: {decisions: '', events: '', resources: '', actions: ''},
        source: {
          kind: 'session',
          sessionId: session.id,
          sessionTitle: session.title || '',
          excerpt: session.text.slice(0, 4000),
        },
        targetPath: '',
      };
      renderEditor();
      const box = region('editor');
      const area = box.querySelector('textarea[name="section-events"]');
      if (area) area.value = session.text.slice(0, 4000);
      setStatus(session.truncated ? '會話文本已截斷，僅保留有界內容。' : '已載入會話文本。');
    };

    // ---------- delegated events ----------
    dock.addEventListener('click', (event) => {
      const source = event.target instanceof Element ? event.target : null;
      if (!source) return;
      // Graph nodes are SVG circles; a click opens the note like Enter/Space does.
      const node = source.closest('[data-ymzz-node]');
      if (node && dock.contains(node)) {
        const noteId = node.getAttribute('data-ymzz-node');
        void guarded(`open-note:${noteId}`, async () => openNote(noteId))();
        return;
      }
      const target = source.closest('[data-ymzz-action]');
      if (!target || !dock.contains(target)) return;
      const action = target.dataset.ymzzAction;
      const id = target.dataset.ymzzId || '';
      const run = async () => {
        if (action === 'close') return closeDock();
        if (action === 'new-draft') {
          ui.draft = {title: '', summary: '', tags: [], links: [], sections: {decisions: '', events: '', resources: '', actions: ''}, source: {kind: 'manual'}, targetPath: ''};
          return renderEditor();
        }
        if (action === 'cancel-draft') {
          ui.draft = null;
          return renderEditor();
        }
        if (action === 'edit-draft') {
          const draft = (ui.state?.drafts ?? []).find((candidate) => candidate.id === id);
          ui.draft = draft ? structuredClone(draft) : null;
          return renderEditor();
        }
        if (action === 'sessions') return readSessions();
        if (action === 'use-session') return useSession(id);
        if (action === 'approve') {
          const result = await api('knowledge/approve', {id, consent: true});
          setStatus(`已審批，綁定 SHA256 ${result.sha256.slice(0, 16)}…；寫入前可再檢查。`);
          return refresh(true);
        }
        if (action === 'commit') {
          const result = await api('knowledge/commit', {id, consent: true});
          setStatus(`已寫入 ${result.note.relativePath}${result.idempotent ? '（重複提交，回傳原結果）' : ''}`);
          return refresh(true);
        }
        if (action === 'delete-draft') {
          await api('knowledge/draft/delete', {id, consent: true});
          if (ui.draft?.id === id) {
            ui.draft = null;
            renderEditor();
          }
          setStatus('已刪除草稿。');
          return refresh(true);
        }
        if (action === 'pick-vault') {
          const result = await api('knowledge/vault/pick', {consent: true});
          if (result.cancelled) return setStatus('已取消選擇 Vault。');
          setStatus(`Vault 已設定：${result.path}`);
          return refresh(true);
        }
        if (action === 'filter-tag') {
          ui.filterTag = id;
          await runSearch();
          return renderTags();
        }
        if (action === 'clear-tag') {
          ui.filterTag = '';
          await runSearch();
          return renderTags();
        }
        if (action === 'open-note') return openNote(id);
        if (action === 'mcp-probe') {
          const result = await api('knowledge/mcp/probe', {name: id});
          setStatus(result.ok ? `${id} 連線成功 · ${result.toolNames.length} 個工具 · ${result.durationMs}ms` : `${id} 連線失敗（${result.stage}）：${result.message}`, result.ok ? 'info' : 'error');
          return refresh(true);
        }
        if (action === 'mcp-restart') {
          await api('knowledge/mcp/restart', {name: id});
          setStatus(`${id} 已請求重啟（配置仍由原生 Settings 管理）。`);
          return refresh(true);
        }
        if (action === 'reg-kind') {
          ui.reg.kind = id;
          return refreshRegistry();
        }
        if (action === 'reg-tag') {
          ui.reg.tag = ui.reg.tag === id ? '' : id;
          return refreshRegistry();
        }
        if (action === 'reg-open') {
          const located = await api(`tags/locate?id=${encodeURIComponent(id)}`);
          if (located.kind === 'note' && located.openable) return openNote(located.noteId);
          return setStatus(located.locator || '此條目沒有可開啟的原生視圖。');
        }
        if (action === 'reg-delete') {
          await api('tags/entity/delete', {id, consent: true});
          setStatus('已移除條目（只刪登記，不刪內容）。');
          return refreshRegistry();
        }
        if (action === 'reg-member') {
          const listId = target.dataset.ymzzList || '';
          const entity = (ui.registry?.entities ?? []).find((candidate) => candidate.id === id);
          const present = entity ? !(entity.lists ?? []).includes(listId) : true;
          await api('tags/membership', {listId, entityId: id, present, consent: true});
          return refreshRegistry();
        }
        if (action === 'reg-list-create') {
          const input = region('registry')?.querySelector('[data-ymzz-list-name]');
          const name = String(input?.value ?? '').trim();
          if (!name) return setStatus('請先輸入 List 名稱。', 'error');
          await api('tags/list', {name, consent: true});
          if (input) input.value = '';
          setStatus('已建立 List。');
          return refreshRegistry();
        }
        if (action === 'reg-list-delete') {
          await api('tags/list/delete', {id, consent: true});
          setStatus('已刪除 List（條目保留）。');
          return refreshRegistry();
        }
        if (action === 'reg-add') {
          const scope = region('registry');
          const kind = scope.querySelector('[data-ymzz-reg-kind]')?.value || 'web';
          const title = String(scope.querySelector('[data-ymzz-reg-title]')?.value ?? '').trim();
          const locator = String(scope.querySelector('[data-ymzz-reg-locator]')?.value ?? '').trim();
          const tags = String(scope.querySelector('[data-ymzz-reg-tags]')?.value ?? '')
            .split(/[,，#\n]/u)
            .map((value) => value.trim())
            .filter(Boolean);
          if (!title || !locator) return setStatus('標題與定位都要填。', 'error');
          await api('tags/entity', {entity: {kind, title, locator, tags, source: 'manual'}, consent: true});
          setStatus('已加入標籤庫。');
          return refreshRegistry();
        }
        return undefined;
      };
      void guarded(`${action}:${id}`, run)();
    });

    dock.addEventListener('keydown', (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const node = target.closest('[data-ymzz-node]');
      if (node && (event.key === 'Enter' || event.key === ' ')) {
        event.preventDefault();
        const noteId = node.getAttribute('data-ymzz-node');
        void guarded(`open-note:${noteId}`, async () => openNote(noteId))();
      }
    });

    noteDialog.addEventListener('click', (event) => {
      const target = event.target instanceof Element ? event.target.closest('[data-ymzz-action]') : null;
      if (!target) return;
      if (target.dataset.ymzzAction === 'close-note') noteDialog.close();
      if (target.dataset.ymzzAction === 'revoke-open') {
        void guarded('revoke-open', async () => {
          await api('knowledge/revoke', {id: ui.openNoteId, consent: true});
          noteDialog.close();
          setStatus('已移到知識垃圾桶（未永久刪除）。');
          await refresh(true);
        })();
      }
    });

    searchForm.addEventListener('submit', (event) => {
      event.preventDefault();
      ui.query = searchInput.value;
      void guarded('search', runSearch)();
    });

    tab.addEventListener('click', openInDock);
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && dock.dataset.ymzzKnowledgeOpen === 'true' && !noteDialog.open) closeDock();
    });
    globalThis.addEventListener('ymzz-open-knowledge', openInDock);

    async function runSearch() {
      ui.query = searchInput.value || ui.query;
      const params = new URLSearchParams();
      if (ui.query) params.set('q', ui.query);
      if (ui.filterTag) params.set('tag', ui.filterTag);
      const result = await api(`knowledge/search?${params.toString()}`);
      renderSearch(result);
    }

    // Theme sync: follow the native Wenrun scheme marker without touching layout.
    const syncScheme = () => {
      const scheme = document.body.dataset.ymzzScheme || document.documentElement.dataset.theme || 'light';
      dock.dataset.ymzzScheme = scheme;
    };
    new MutationObserver(syncScheme).observe(document.body, {attributes: true, attributeFilter: ['data-ymzz-scheme', 'data-ymzz-wenrun']});
    new MutationObserver(syncScheme).observe(document.documentElement, {attributes: true, attributeFilter: ['data-theme']});
    syncScheme();

    if (localStorage.getItem('ymzz-knowledge-open') === '1') openInDock();
    void refresh(true);
    setInterval(() => {
      if (dock.dataset.ymzzKnowledgeOpen === 'true' && !ui.active.size) void refresh();
    }, POLL_MS);
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready, {once: true});
  else ready();
})();
