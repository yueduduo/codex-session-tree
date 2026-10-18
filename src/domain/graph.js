'use strict';

function buildForest(threads) {
  const byId = new Map(threads.map(thread => [thread.id, thread]));
  const children = new Map();
  const roots = [];
  for (const thread of threads) {
    const parentId = thread.forkedFromId;
    if (parentId && parentId !== thread.id && byId.has(parentId) && !wouldCycle(thread.id, parentId, byId)) {
      const siblings = children.get(parentId) || [];
      siblings.push(thread);
      children.set(parentId, siblings);
    } else {
      roots.push(thread);
    }
  }
  const sort = (a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0);
  roots.sort(sort);
  for (const siblings of children.values()) siblings.sort(sort);
  return { roots, children };
}

function wouldCycle(childId, parentId, byId) {
  const seen = new Set([childId]);
  let current = parentId;
  while (current && byId.has(current)) {
    if (seen.has(current)) return true;
    seen.add(current);
    current = byId.get(current).forkedFromId;
  }
  return false;
}

function findForkPoint(parentTurns, childTurns) {
  const parentIds = new Set(parentTurns.map(turn => turn.id));
  let lastSharedId;
  for (const turn of childTurns) {
    if (!parentIds.has(turn.id)) break;
    lastSharedId = turn.id;
  }
  return lastSharedId;
}

function extractUserQuestion(message) {
  const raw = String(message || '').trim();
  if (!/^#\s*Context from my IDE setup\s*:/i.test(raw)) return raw;
  const headings = [...raw.matchAll(/^#{1,4}[ \t]*My request[ \t]*:[ \t]*(?:\r?\n)?/gim)];
  if (!headings.length) return raw;
  const last = headings.at(-1);
  return raw.slice(last.index + last[0].length).trim();
}

function turnLabel(turn, index) {
  const item = (turn.items || []).find(entry => entry.type === 'userMessage');
  const text = (item?.content || []).filter(part => part.type === 'text' || part.type === 'inputText')
    .map(part => part.text || '').join('\n');
  const question = extractUserQuestion(text).replace(/\s+/g, ' ').trim();
  return question ? `${index + 1}. ${question.slice(0, 90)}${question.length > 90 ? '…' : ''}` : `${index + 1}. Turn ${turn.id.slice(0, 8)}`;
}

module.exports = { buildForest, findForkPoint, extractUserQuestion, turnLabel };

function buildFamilies(threads, firstTurnByThread) {
  const byId = new Map(threads.map(thread => [thread.id, thread]));
  const parent = new Map(threads.map(thread => [thread.id, thread.id]));
  const find = id => {
    const current = parent.get(id);
    if (current !== id) parent.set(id, find(current));
    return parent.get(id);
  };
  const union = (a, b) => { if (parent.has(a) && parent.has(b)) parent.set(find(b), find(a)); };
  const byFirstTurn = new Map();
  const bySession = new Map();
  for (const thread of threads) {
    const first = firstTurnByThread.get(thread.id);
    if (first) {
      if (byFirstTurn.has(first)) union(byFirstTurn.get(first), thread.id);
      else byFirstTurn.set(first, thread.id);
    }
    if (thread.sessionId) {
      if (bySession.has(thread.sessionId)) union(bySession.get(thread.sessionId), thread.id);
      else bySession.set(thread.sessionId, thread.id);
    }
    if (thread.forkedFromId && byId.has(thread.forkedFromId)) union(thread.forkedFromId, thread.id);
  }
  const groups = new Map();
  for (const thread of threads) {
    const key = find(thread.id);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(thread);
  }
  return [...groups.values()].map(members => {
    members.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    const root = members[0];
    return {
      key: root.id,
      title: (root.name || root.preview || root.id).replace(/\s+/g, ' ').trim(),
      cwd: root.cwd,
      updatedAt: Math.max(...members.map(thread => thread.updatedAt || thread.createdAt || 0)),
      inferred: members.length > 1 && members.some(thread => !thread.forkedFromId),
      threads: members
    };
  }).sort((a, b) => b.updatedAt - a.updatedAt);
}

function buildTurnTree(family, turnsByThread) {
  const root = { id: 'root', label: 'root', threadId: family.threads[0]?.id, children: [], sessions: [] };
  for (const thread of family.threads) {
    let node = root;
    const turns = turnsByThread.get(thread.id) || [];
    for (let index = 0; index < turns.length; index++) {
      const turn = turns[index];
      let next = node.children.find(child => child.id === turn.id);
      if (!next) {
        next = { id: turn.id, label: turnLabel(turn, index), threadId: thread.id, children: [], sessions: [] };
        node.children.push(next);
      }
      node = next;
    }
    node.sessions.push({ id: thread.id, title: thread.name || thread.preview || thread.id,
      updatedAt: thread.updatedAt || thread.createdAt || 0, archived: !!thread.archived });
  }
  return root;
}

module.exports.buildFamilies = buildFamilies;
module.exports.buildTurnTree = buildTurnTree;

function layoutGitGraph(root, showAll = false) {
  const nodes = [];
  let nextLane = 0;
  function visit(node, parent, depth, lane) {
    const entry = {
      id: node.id, label: node.label, threadId: node.threadId,
      sessions: node.sessions, childCount: node.children.length,
      parentId: parent?.id || null, depth, lane
    };
    nodes.push(entry);
    node.children.forEach((child, index) => visit(child, node, depth + 1, index === 0 ? lane : ++nextLane));
  }
  visit(root, null, 0, 0);
  const byId = new Map(nodes.map(node => [node.id, node]));
  const visible = new Set(nodes.filter(node => showAll || node.id === root.id || node.childCount > 1 || node.sessions.length ||
    (node.parentId && byId.get(node.parentId)?.childCount > 1)).map(node => node.id));
  const rows = nodes.filter(node => visible.has(node.id)).map(node => {
    let parentId = node.parentId;
    while (parentId && !visible.has(parentId)) parentId = byId.get(parentId)?.parentId || null;
    return { ...node, parentId, hiddenBefore: parentId ? node.depth - byId.get(parentId).depth - 1 : 0 };
  }).sort((a, b) => b.depth - a.depth || a.lane - b.lane || a.id.localeCompare(b.id));
  return { rows, laneCount: nextLane + 1, totalTurns: nodes.length - 1 };
}

module.exports.layoutGitGraph = layoutGitGraph;
