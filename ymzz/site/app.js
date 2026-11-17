// SPDX-License-Identifier: MIT · 湛箴_ymzz official site (no telemetry)
(function () {
  "use strict";
  const cfg = window.YMZZ_SITE || {};
  const THEMES = {
    "cloud-light": { theme: "light", palette: "cloud" },
    "cloud-dark": { theme: "dark", palette: "cloud" },
    "earth-light": { theme: "light", palette: "earth" },
    "wood-dark": { theme: "dark", palette: "wood" }
  };
  const LANGS = ["zh-Hant", "zh-CN", "en"];

  function stored(key) {
    try { return localStorage.getItem(key); } catch { return null; }
  }
  function store(key, value) {
    try { localStorage.setItem(key, value); } catch { /* private mode */ }
  }

  function preferDark() {
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  }

  function currentThemeKey() {
    const raw = stored(cfg.storageTheme);
    if (raw && THEMES[raw]) return raw;
    return preferDark() ? "cloud-dark" : "cloud-light";
  }

  function applyTheme(key) {
    const pair = THEMES[key] || THEMES["cloud-light"];
    const root = document.documentElement;
    root.setAttribute("data-theme", pair.theme);
    root.setAttribute("data-palette", pair.palette);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      const bg = getComputedStyle(root).getPropertyValue("--ground").trim() || "#F8F6EF";
      meta.setAttribute("content", bg);
    }
    const sel = document.getElementById("theme");
    if (sel && sel.value !== key) sel.value = key;
    store(cfg.storageTheme, key);
  }

  function normalizeLang(code) {
    if (!code) return cfg.defaultLang || "zh-Hant";
    if (LANGS.includes(code)) return code;
    const lower = code.toLowerCase();
    if (lower.startsWith("zh-tw") || lower.startsWith("zh-hk") || lower.startsWith("zh-hant")) return "zh-Hant";
    if (lower.startsWith("zh")) return "zh-CN";
    if (lower.startsWith("en")) return "en";
    return cfg.defaultLang || "zh-Hant";
  }

  let dict = {};
  function applyDict() {
    document.documentElement.lang = document.documentElement.lang;
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      if (key && dict[key] != null) el.textContent = dict[key];
    });
    document.querySelectorAll("[data-i18n-aria]").forEach((el) => {
      const key = el.getAttribute("data-i18n-aria");
      if (key && dict[key] != null) el.setAttribute("aria-label", dict[key]);
    });
  }

  async function loadLang(lang) {
    const code = normalizeLang(lang);
    document.documentElement.lang = code;
    const sel = document.getElementById("lang");
    if (sel) sel.value = code;
    store(cfg.storageLang, code);
    try {
      const res = await fetch("i18n/" + code + ".json", { credentials: "same-origin" });
      if (!res.ok) throw new Error("PUBLIC_RELEASE_LOOKUP_FAILED");
      dict = await res.json();
      applyDict();
      const file = (location.pathname.split("/").pop() || "index.html") || "index.html";
      const titleKey = file === "start.html" ? "start.doc.title"
        : file === "family.html" ? "family.doc.title"
        : "doc.title";
      if (dict[titleKey]) document.title = dict[titleKey];
    } catch { /* keep server-rendered zh-Hant */ }
  }

  function bootChrome() {
    applyTheme(currentThemeKey());
    const themeSel = document.getElementById("theme");
    if (themeSel) {
      themeSel.value = currentThemeKey();
      themeSel.addEventListener("change", () => applyTheme(themeSel.value));
    }
    const langSel = document.getElementById("lang");
    const initial = stored(cfg.storageLang) || normalizeLang(navigator.language);
    if (langSel) {
      langSel.value = normalizeLang(initial);
      langSel.addEventListener("change", () => loadLang(langSel.value));
    }
    loadLang(initial);
  }

  function hidePre() {
    const pre = document.getElementById("pre");
    if (!pre) return;
    const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const done = () => pre.classList.add("is-done");
    if (reduce) done();
    else window.setTimeout(done, 700);
  }

  function readbar() {
    const bar = document.querySelector(".readbar > i");
    const host = document.querySelector(".readbar");
    if (!bar || !host) return;
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const n = max <= 0 ? 0 : Math.min(100, Math.round((window.scrollY / max) * 100));
      bar.style.width = n + "%";
      host.setAttribute("aria-valuenow", String(n));
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  let releaseRequest;
  const message = (key, fallback) => document.querySelector('[data-i18n="'+key+'"]')?.textContent || fallback;
  function safeReleaseAsset(a) {
    if(!a || typeof a.name!=="string" || a.name.length>255 || a.state!=="uploaded")return false;
    try { const u=new URL(a.browser_download_url);return u.origin==="https://github.com" && !u.username && !u.password && !u.search && !u.hash && /^\/Ya-MiC\/ymzz\/releases\/download\//i.test(u.pathname); }catch{return false}
  }
  function assetLooksLikeInstaller(name) {
    return /\.(exe|msi|msix|dmg|pkg|appimage|deb|rpm|zip|7z)$/i.test(name || "");
  }
  function isWindowsAsset(name) {
    return /\.(exe|msi|msix)$/i.test(name || "") || /win(dows)?/i.test(name || "");
  }

  async function hydrateReleases() {
    const box = document.getElementById("download");
    const status = document.getElementById("release-status");
    const cta = document.getElementById("cta-primary");
    if (cfg.releasesApi!=="https://api.github.com/repos/Ya-MiC/ymzz/releases?per_page=10" || !box) return;
    releaseRequest?.abort(); releaseRequest=new AbortController();
    try {
      const res = await fetch(cfg.releasesApi, {
        headers: { Accept: "application/vnd.github+json" }, redirect: "error",
        credentials: "omit", referrerPolicy: "no-referrer", cache: "no-store", signal: AbortSignal.any([AbortSignal.timeout(8000),releaseRequest.signal])
      });
      if (!res.ok) throw new Error("PUBLIC_RELEASE_LOOKUP_FAILED");
      const list = await res.json();
      if (!Array.isArray(list)) return;
      const published = list.filter((r) => r && r.draft === false);
      const stable = published.filter((r) => r.prerelease === false);
      const assets = [];
      stable.forEach((r) => {
        (r.assets || []).forEach((a) => {
          if (safeReleaseAsset(a)) {
            assets.push({ release: r, asset: a });
          }
        });
      });
      if (!assets.length) { if(status)status.textContent=message("release.none","尚無公開正式產品安裝包；保留未發佈狀態。"); return; }
      const listEl = document.createElement("ul");
      listEl.className = "facts"; listEl.id="ymzz-public-releases";
      assets.forEach(({ release, asset }) => {
        const li = document.createElement("li");
        li.className = "fact";
        const h = document.createElement("h3");
        h.textContent = asset.name;
        const p = document.createElement("p");
        p.textContent = (release.name || release.tag_name || "") + " · " + asset.size + " bytes";
        const a = document.createElement("a");
        a.className = "btn ghost";
        a.href = asset.browser_download_url;
        a.rel = "noopener noreferrer";
        a.textContent = asset.name;
        li.append(h, p, a);
        listEl.append(li);
      });
      const note = box.querySelector(".status-note");
      document.getElementById("ymzz-public-releases")?.remove();
      box.prepend(listEl);
      const win = assets.find(({ asset }) => asset.name.startsWith("湛箴_ymzz-") && isWindowsAsset(asset.name) && assetLooksLikeInstaller(asset.name));
      if(win && note)note.remove();
      if (win && cta) {
        cta.href = win.asset.browser_download_url;
        cta.rel = "noopener noreferrer";
        cta.textContent = win.asset.name;
      }
      if (status && win) {
        status.textContent = "已找到公開（非草稿、非預發佈）Release 資產。請自行核對發版說明與校驗值；本頁不把其他產品的安裝包算進來。";
      }
    } catch {
      if(status)status.textContent=message("release.error","GitHub 查詢失敗或已停用；保留未發佈狀態。");
    }
  }

  bootChrome();
  hidePre();
  readbar();
  // No automatic third-party request: one explicit user-triggered check, with an off switch.
  const download=document.getElementById("download");
  if(download){
    const preferences=document.createElement("div"),label=document.createElement("label"),allow=document.createElement("input"),button=document.createElement("button");
    preferences.className="release-controls";
    allow.type="checkbox";allow.checked=false;allow.setAttribute("aria-label","允許手動連線 GitHub 公開發佈 API");allow.setAttribute("data-i18n-aria","release.consent");
    const consent=document.createElement("span");consent.dataset.i18n="release.consent";consent.textContent=" 允許本次手動連線 GitHub 公開發佈 API（可隨時關閉）";label.append(allow,consent);
    button.type="button";button.className="btn ghost";button.textContent="手動檢查公開發佈";button.dataset.i18n="release.check";button.disabled=true;
    allow.addEventListener("change",()=>{button.disabled=!allow.checked;if(!allow.checked)releaseRequest?.abort()});
    button.addEventListener("click",()=>{if(allow.checked)void hydrateReleases()});
    for(const [key,text]of [["release.none","尚無公開正式產品安裝包；保留未發佈狀態。"],["release.error","GitHub 查詢失敗或已停用；保留未發佈狀態。"]]){const span=document.createElement("span");span.hidden=true;span.dataset.i18n=key;span.textContent=text;preferences.append(span)}
    preferences.append(label,button);download.append(preferences);
  }
})();
