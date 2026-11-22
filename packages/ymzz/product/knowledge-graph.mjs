// MIT. Deterministic multi-nebula graph projection over committed notes.
// No randomness, no network: the same notes always produce the same clusters,
// node order and coordinates, so the panel never jitters between polls.
import {assert} from './guard.mjs';
import {normalizeTag} from './obsidian-markdown.mjs';

export const MAX_CLUSTERS = 8;
export const MAX_NOTES_PER_CLUSTER = 16;
export const UNTAGGED_CLUSTER = 'untagged';

/**
 * One cluster member. `kind`/`locator` are copied only when the caller supplied
 * them, so knowledge notes keep their exact previous shape while tagged entities
 * stay clickable/locatable.
 */
function member(node, shared) {
  const out = {id: node.id, title: node.title, shared};
  if (node.kind !== undefined) out.kind = node.kind;
  if (node.locator !== undefined) out.locator = node.locator;
  return out;
}

/**
 * Group notes into tag-centred clusters. A note is listed in every cluster whose
 * tag it carries, so a note with several tags is a cross-cluster bridge. Clusters
 * are capped; the rest are reported as truncated instead of silently dropped.
 * @param {{id: string, title: string, tags?: string[]}[]} notes - committed notes.
 * @param {{maxClusters?: number, maxNotesPerCluster?: number}} [options] - caps.
 * @returns {{clusters: object[], truncated: boolean, noteCount: number, tagCount: number}} graph projection.
 */
export function buildClusters(notes, {maxClusters = MAX_CLUSTERS, maxNotesPerCluster = MAX_NOTES_PER_CLUSTER} = {}) {
  const list = Array.isArray(notes) ? notes : [];
  const tagCounts = new Map();
  const nodes = [];
  for (const note of list) {
    if (!note || typeof note.id !== 'string' || typeof note.title !== 'string') continue;
    const tags = [];
    for (const candidate of Array.isArray(note.tags) ? note.tags : []) {
      const tag = normalizeTag(candidate);
      if (!tag || tags.includes(tag)) continue;
      tags.push(tag);
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    }
    nodes.push({id: note.id, title: note.title, tags, kind: note.kind, locator: note.locator});
  }
  const ranked = [...tagCounts.entries()].sort((a, b) => (b[1] - a[1]) || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  const untagged = nodes.filter((node) => node.tags.length === 0);
  const hasUntagged = untagged.length > 0;
  const tagBudget = Math.max(0, maxClusters - (hasUntagged ? 1 : 0));
  const selected = ranked.slice(0, tagBudget);
  const truncated = ranked.length > selected.length;
  const clusters = [];
  for (const [tag] of selected) {
    const members = nodes
      .filter((node) => node.tags.includes(tag))
      .map((node) => member(node, node.tags.length > 1))
      .sort((a, b) => (a.title < b.title ? -1 : a.title > b.title ? 1 : a.id < b.id ? -1 : 1));
    clusters.push({
      tag,
      label: `#${tag}`,
      noteCount: members.length,
      sharedCount: members.filter((member) => member.shared).length,
      notes: members.slice(0, maxNotesPerCluster),
      truncated: members.length > maxNotesPerCluster,
    });
  }
  if (hasUntagged) {
    const members = untagged
      .map((node) => member(node, false))
      .sort((a, b) => (a.title < b.title ? -1 : a.title > b.title ? 1 : a.id < b.id ? -1 : 1));
    clusters.push({
      tag: UNTAGGED_CLUSTER,
      label: '未標籤',
      noteCount: members.length,
      sharedCount: 0,
      notes: members.slice(0, maxNotesPerCluster),
      truncated: members.length > maxNotesPerCluster,
    });
  }
  return {clusters, truncated, noteCount: nodes.length, tagCount: ranked.length};
}

/**
 * Lay out one cluster as a deterministic radial mini-nebula. Positions depend
 * only on the note order and index, never on time or randomness.
 * @param {object} cluster - one entry of {@link buildClusters}.
 * @param {{width?: number, height?: number, centerRadius?: number, nodeRadius?: number}} [options] - geometry.
 * @returns {{width: number, height: number, cx: number, cy: number, r: number, centerRadius: number, nodeRadius: number, nodes: object[]}} SVG geometry.
 */
export function layoutCluster(cluster, {width = 320, height = 200, centerRadius = 22, nodeRadius = 8} = {}) {
  assert(cluster && typeof cluster === 'object', 'CLUSTER_REQUIRED');
  const notes = Array.isArray(cluster.notes) ? cluster.notes : [];
  const cx = width / 2;
  const cy = height / 2;
  const orbit = Math.max(centerRadius + nodeRadius + 6, Math.min(width, height) / 2 - nodeRadius - 10);
  const count = notes.length;
  const nodes = notes.map((note, index) => {
    const angle = count === 0 ? 0 : -Math.PI / 2 + (index * 2 * Math.PI) / count;
    const x = round(cx + orbit * Math.cos(angle));
    const y = round(cy + orbit * Math.sin(angle));
    const out = {id: note.id, title: note.title, shared: Boolean(note.shared), x, y, angle: round(angle)};
    if (note.kind !== undefined) out.kind = note.kind;
    if (note.locator !== undefined) out.locator = note.locator;
    return out;
  });
  return {width, height, cx: round(cx), cy: round(cy), r: round(orbit), centerRadius, nodeRadius, nodes};
}

/** Round to two decimals so repeated layouts are byte-identical. */
function round(value) {
  return Math.round(value * 100) / 100;
}

/**
 * Build the accessible text alternative for a cluster graph. Every tag and
 * relationship is spelled out in words for screen readers and no-SVG fallbacks.
 * @param {{clusters: object[], truncated: boolean, noteCount: number}} graph - cluster projection.
 * @returns {{summary: string, clusters: string[]}} plain-text description.
 */
export function describeGraph(graph) {
  const clusters = Array.isArray(graph?.clusters) ? graph.clusters : [];
  const lines = clusters.map((cluster) => {
    const shared = cluster.notes.filter((note) => note.shared);
    const base = `${cluster.label} 簇：${cluster.noteCount} 篇筆記`;
    const bridge = shared.length > 0 ? `；跨簇共享：${shared.map((note) => note.title).join('、')}` : '';
    const more = cluster.truncated ? '；僅顯示前若干篇' : '';
    const names = cluster.notes.map((note) => note.title).join('、');
    return `${base}${bridge}${more}。${names ? `筆記：${names}。` : ''}`;
  });
  const head = `已提交筆記 ${Number(graph?.noteCount) || 0} 篇，分為 ${clusters.length} 簇。`;
  const tail = graph?.truncated ? '部分標籤簇未顯示。' : '';
  return {summary: head + tail, clusters: lines};
}
