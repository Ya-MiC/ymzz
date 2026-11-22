// MIT. Record the latest upstream release of each bundled-product dependency.
// This script only WRITES A MANIFEST. It does not download, bundle, relicense or
// re-distribute anything; packaging is a separate, human-gated process.
import fs from 'node:fs';
import path from 'node:path';

const manifestPath = path.resolve(import.meta.dirname, '../upstreams.json');

const UPSTREAMS = [
  {repo: 'deepseek-ai/deepseek-harness', role: 'DSH runtime (MIT, unmodified)'},
  {repo: 'chuspeeism/dashi-taskboard', role: 'Dashi Taskboard (Apache-2.0, planned bundle)'},
  {repo: 'pingdotgg/t3code', role: 'T3 Code (MIT, planned bundle)'},
];

const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '';
const headers = {
  Accept: 'application/vnd.github+json',
  'User-Agent': 'ymzz-upstream-watch',
  ...(token ? {Authorization: `Bearer ${token}`} : {}),
};

const upstreams = [];
for (const {repo, role} of UPSTREAMS) {
  const response = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, {headers});
  if (response.ok) {
    const release = await response.json();
    upstreams.push({
      repo,
      role,
      status: 'ok',
      kind: 'release',
      tag: release.tag_name ?? '',
      name: release.name ?? '',
      url: release.html_url ?? '',
      prerelease: release.prerelease === true,
      draft: release.draft === true,
      publishedAt: release.published_at ?? '',
    });
    continue;
  }
  // Repos that publish no releases (e.g. the DSH runtime itself) are tracked by
  // their latest commit on the default branch instead.
  const repoInfo = await fetch(`https://api.github.com/repos/${repo}`, {headers});
  if (!repoInfo.ok) {
    console.error(`${repo}: HTTP ${repoInfo.status} — keeping previous record if any`);
    upstreams.push({repo, role, status: `http-${repoInfo.status}`});
    continue;
  }
  const defaultBranch = (await repoInfo.json()).default_branch ?? 'main';
  const commitInfo = await fetch(`https://api.github.com/repos/${repo}/commits/${defaultBranch}`, {headers});
  if (!commitInfo.ok) {
    console.error(`${repo}: commits HTTP ${commitInfo.status}`);
    upstreams.push({repo, role, status: `http-${commitInfo.status}`});
    continue;
  }
  const commit = await commitInfo.json();
  upstreams.push({
    repo,
    role,
    status: 'ok',
    kind: 'commit',
    tag: `commit ${String(commit.sha ?? '').slice(0, 12)}`,
    name: String(commit.commit?.message ?? '').split('\n')[0].slice(0, 120),
    url: commit.html_url ?? '',
    prerelease: false,
    draft: false,
    publishedAt: commit.commit?.committer?.date ?? '',
  });
}

const manifest = {
  version: 1,
  fetchedAt: new Date().toISOString(),
  note: 'Version records only. No artifact is downloaded or bundled by this workflow; installers require the Tauri shell and the release acceptance gate.',
  upstreams,
};

fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`wrote ${manifestPath}`);
for (const entry of upstreams) console.log(`${entry.repo}: ${entry.tag ?? entry.status}`);
