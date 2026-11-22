// MIT. Multi-nebula graph units: tag clusters, cross-cluster bridges, stable
// geometry and accessible text alternatives. Pure data, no network.
import test from 'node:test';
import assert from 'node:assert/strict';
import {buildClusters, layoutCluster, describeGraph, MAX_CLUSTERS} from '../knowledge-graph.mjs';

const note = (id, title, tags) => ({id, title, tags});

test('notes are clustered by tag and a multi-tag note bridges clusters', () => {
  const graph = buildClusters([
    note('a', '甲', ['決策', '知識']),
    note('b', '乙', ['決策']),
    note('c', '丙', ['知識']),
  ]);
  assert.equal(graph.noteCount, 3);
  const decision = graph.clusters.find((cluster) => cluster.tag === '決策');
  const knowledge = graph.clusters.find((cluster) => cluster.tag === '知識');
  // Node order is by title code point (乙 U+4E59, 丙 U+4E19, then 甲 U+7532),
  // never by insertion and never by locale data that differs per OS.
  assert.deepEqual(decision.notes.map((entry) => entry.id), ['b', 'a']);
  assert.deepEqual(knowledge.notes.map((entry) => entry.id), ['c', 'a']);
  assert.equal(decision.sharedCount, 1);
  assert.equal(knowledge.sharedCount, 1);
  assert.equal(decision.notes.find((entry) => entry.id === 'a').shared, true);
  assert.equal(decision.notes.find((entry) => entry.id === 'b').shared, false);
  assert.equal(graph.truncated, false);
});

test('cluster count is capped and untagged notes get their own last cluster', () => {
  const notes = [];
  for (let index = 0; index < 12; index += 1) notes.push(note(`t${index}`, `標籤筆記 ${index}`, [`tag${index}`]));
  notes.push(note('u1', '未標一', []));
  notes.push(note('u2', '未標二', []));
  const graph = buildClusters(notes, {maxClusters: 8});
  assert.equal(graph.clusters.length, 8);
  assert.equal(graph.truncated, true);
  assert.equal(graph.clusters.at(-1).tag, 'untagged');
  assert.equal(graph.clusters.at(-1).noteCount, 2);
  const capped = buildClusters(notes, {maxClusters: 3, maxNotesPerCluster: 1});
  assert.equal(capped.clusters.length, 3);
  assert.ok(capped.clusters.every((cluster) => cluster.notes.length <= 1));
});

test('clusters rank by note count then tag name, independent of input order', () => {
  const input = [
    note('1', '一', ['b']),
    note('2', '二', ['b']),
    note('3', '三', ['a']),
    note('4', '四', ['c']),
  ];
  const first = buildClusters(input);
  const reversed = buildClusters([...input].reverse());
  assert.deepEqual(first.clusters.map((cluster) => cluster.tag), ['b', 'a', 'c']);
  assert.deepEqual(reversed.clusters.map((cluster) => cluster.tag), ['b', 'a', 'c']);
  assert.deepEqual(first, reversed);
});

test('layout is deterministic, radial and round-free', () => {
  const graph = buildClusters([note('a', '甲', ['決策']), note('b', '乙', ['決策']), note('c', '丙', ['決策'])]);
  const first = layoutCluster(graph.clusters[0]);
  const second = layoutCluster(graph.clusters[0]);
  assert.deepEqual(first, second);
  assert.equal(first.cx, 160);
  assert.equal(first.cy, 100);
  assert.equal(first.nodes.length, 3);
  for (const node of first.nodes) {
    const distance = Math.round(Math.hypot(node.x - first.cx, node.y - first.cy) * 100) / 100;
    assert.equal(distance, first.r);
    assert.ok(node.x >= 0 && node.x <= first.width && node.y >= 0 && node.y <= first.height);
  }
  // Stable across a re-built projection of the same notes.
  assert.deepEqual(layoutCluster(buildClusters([note('a', '甲', ['決策']), note('b', '乙', ['決策']), note('c', '丙', ['決策'])]).clusters[0]), first);
  assert.deepEqual(layoutCluster(buildClusters([]).clusters[0] ?? {notes: []}).nodes, []);
});

test('text alternative names every cluster and cross-cluster relationship', () => {
  const graph = buildClusters([note('a', '甲', ['決策', '知識']), note('b', '乙', ['決策']), note('u', '未標', [])]);
  const text = describeGraph(graph);
  assert.match(text.summary, /已提交筆記 3 篇/u);
  assert.match(text.summary, /3 簇/u);
  const joined = text.clusters.join('\n');
  assert.match(joined, /#決策 簇：2 篇筆記/u);
  assert.match(joined, /跨簇共享：甲/u);
  assert.match(joined, /未標籤 簇：1 篇筆記/u);
  assert.match(joined, /筆記：乙、甲/u);
  assert.equal(MAX_CLUSTERS, 8);
});
