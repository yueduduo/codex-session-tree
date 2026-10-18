'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildForest, findForkPoint, extractUserQuestion, turnLabel, buildFamilies, buildTurnTree, layoutGitGraph } = require('../src/domain/graph');

test('groups nested forks under original roots and keeps missing parents visible', () => {
  const threads = [
    { id: 'child', forkedFromId: 'root', updatedAt: 3 },
    { id: 'grandchild', forkedFromId: 'child', updatedAt: 4 },
    { id: 'root', updatedAt: 1 },
    { id: 'orphan', forkedFromId: 'archived-parent', updatedAt: 2 }
  ];
  const graph = buildForest(threads);
  assert.deepEqual(graph.roots.map(x => x.id), ['orphan', 'root']);
  assert.deepEqual(graph.children.get('root').map(x => x.id), ['child']);
  assert.deepEqual(graph.children.get('child').map(x => x.id), ['grandchild']);
});

test('places fork at the final common turn without guessing when history differs', () => {
  const parent = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  assert.equal(findForkPoint(parent, [{ id: 'a' }, { id: 'b' }, { id: 'new' }]), 'b');
  assert.equal(findForkPoint(parent, [{ id: 'different' }]), undefined);
});

test('uses the user prompt as the turn label', () => {
  const turn = { id: 'turn-123', items: [{ type: 'userMessage', content: [{ type: 'text', text: 'Fix\n  the bug' }] }] };
  assert.equal(turnLabel(turn, 2), '3. Fix the bug');
});

test('uses the question after IDE context instead of the IDE header', () => {
  const message = '# Context from my IDE setup:\n\n## Active file: train_rsl_rl.log\n\n## Open tabs:\n- README.md\n\n## My request:\n分析 FlashSAC 原地跳跃训练';
  const turn = { id: 'turn-123', items: [{ type: 'userMessage', content: [{ type: 'text', text: message }] }] };
  assert.equal(extractUserQuestion(message), '分析 FlashSAC 原地跳跃训练');
  assert.equal(turnLabel(turn, 11), '12. 分析 FlashSAC 原地跳跃训练');
  assert.equal(extractUserQuestion('说明如何使用 ## My request: 这个标题'), '说明如何使用 ## My request: 这个标题');
});

test('groups copied histories despite missing fork metadata, while keeping equal titles separate', () => {
  const threads = [
    { id: 'original', name: 'Same title', createdAt: 1 },
    { id: 'branch', name: 'Same title (2)', createdAt: 2, forkedFromId: null },
    { id: 'unrelated', name: 'Same title', createdAt: 3 }
  ];
  const first = new Map([['original', 'turn-a'], ['branch', 'turn-a'], ['unrelated', 'turn-other']]);
  const families = buildFamilies(threads, first);
  assert.equal(families.length, 2);
  assert.deepEqual(families.find(f => f.threads.length === 2).threads.map(t => t.id), ['original', 'branch']);
});

test('draws common turns once and splits at the actual divergence', () => {
  const family = { threads: [{ id: 'original' }, { id: 'branch' }] };
  const turns = new Map([
    ['original', ['a', 'b', 'left'].map(id => ({ id, items: [] }))],
    ['branch', ['a', 'b', 'right'].map(id => ({ id, items: [] }))]
  ]);
  const tree = buildTurnTree(family, turns);
  assert.equal(tree.children.length, 1);
  assert.equal(tree.children[0].id, 'a');
  assert.equal(tree.children[0].children[0].id, 'b');
  assert.deepEqual(tree.children[0].children[0].children.map(node => node.id), ['left', 'right']);
  assert.deepEqual(tree.children[0].children[0].children.map(node => node.sessions[0].id), ['original', 'branch']);
  const compact = layoutGitGraph(tree);
  assert.equal(compact.rows.find(row => row.id === 'root').threadId, 'original');
  assert.equal(compact.rows.find(row => row.id === 'left').threadId, 'original');
  assert.equal(compact.rows.find(row => row.id === 'right').threadId, 'branch');
  assert.equal(compact.laneCount, 2);
  assert.equal(compact.rows.filter(row => row.sessions.length).length, 2);
  assert.equal(compact.rows.find(row => row.id === 'b').childCount, 2);
  assert.equal(compact.rows.at(-1).id, 'root');
});

test('compact Git graph hides ordinary turns but keeps path endpoints connected', () => {
  const family = { threads: [{ id: 'one' }] };
  const turns = new Map([['one', ['a', 'b', 'c', 'd'].map(id => ({ id, items: [] }))]]);
  const tree = buildTurnTree(family, turns);
  const compact = layoutGitGraph(tree);
  assert.deepEqual(compact.rows.map(row => row.id), ['d', 'root']);
  assert.equal(compact.rows[0].parentId, 'root');
  assert.equal(compact.rows[0].hiddenBefore, 3);
  assert.equal(layoutGitGraph(tree, true).rows.length, 5);
});
