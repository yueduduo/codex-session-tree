'use strict';

const vscode = acquireVsCodeApi();
const $ = id => document.getElementById(id);
const svgNS = 'http://www.w3.org/2000/svg';
const palette = [
  'var(--vscode-charts-blue)', 'var(--vscode-charts-orange)', 'var(--vscode-charts-green)',
  'var(--vscode-charts-purple)', 'var(--vscode-charts-red)', 'var(--vscode-charts-yellow)'
];
let families = [];
let workspaceLabel = '未打开文件夹';
let selectedKey = vscode.getState()?.selectedKey || null;
let showAll = vscode.getState()?.showAll || false;
let otherExpanded = vscode.getState()?.otherExpanded || false;
let currentTree = null;

function saveState() { vscode.setState({ selectedKey, showAll, otherExpanded }); }

function element(tag, className, value) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (value !== undefined) node.textContent = value;
  return node;
}

function showPage(tree) {
  $('familiesPage').hidden = tree;
  $('treePage').hidden = !tree;
  $('back').hidden = !tree;
  $('heading').textContent = tree ? '会话分叉图' : 'Codex 会话树';
}

function date(timestamp) { return timestamp ? new Date(timestamp * 1000).toLocaleDateString() : ''; }

function familyButton(family, showDirectory) {
  const button = element('button', 'family');
  button.type = 'button';
  const top = element('span', 'family-top');
  top.append(element('span', 'family-title', family.title));
  top.append(element('span', 'count', `${family.count} 会话`));
  button.append(top);
  const meta = [showDirectory && family.cwd, date(family.updatedAt), family.inferred && family.count > 1 && '共享历史'].filter(Boolean);
  if (meta.length) button.append(element('span', 'family-meta', meta.join(' · ')));
  button.addEventListener('click', () => selectFamily(family.key));
  return button;
}

function renderFamilies() {
  const query = $('search').value.trim().toLocaleLowerCase();
  const container = $('families');
  container.replaceChildren();
  const filtered = families.filter(family => `${family.title} ${family.cwd || ''}`.toLocaleLowerCase().includes(query));
  const current = filtered.filter(family => family.currentWorkspace);
  const other = filtered.filter(family => !family.currentWorkspace);
  const currentSection = element('section', 'workspace-group');
  currentSection.append(element('div', 'workspace-heading', `当前工作区 · ${current.length}`));
  currentSection.append(element('div', 'workspace-name', workspaceLabel));
  if (current.length) currentSection.append(...current.map(family => familyButton(family, false)));
  else currentSection.append(element('p', 'empty', query ? '当前工作区没有匹配的会话' : '当前工作区暂无会话'));
  container.append(currentSection);
  const otherSection = element('details', 'workspace-group other-group');
  otherSection.open = otherExpanded || !!query;
  otherSection.append(element('summary', 'workspace-heading', `其他工作区 · ${other.length}`));
  if (other.length) otherSection.append(...other.map(family => familyButton(family, true)));
  else otherSection.append(element('p', 'empty', query ? '其他工作区没有匹配的会话' : '暂无其他工作区的会话'));
  otherSection.addEventListener('toggle', () => {
    if (!query) { otherExpanded = otherSection.open; saveState(); }
  });
  container.append(otherSection);
}

function selectFamily(key) {
  selectedKey = key;
  currentTree = null;
  saveState();
  showPage(true);
  $('tree').replaceChildren(element('p', 'empty', '正在构建分叉图…'));
  vscode.postMessage({ type: 'select', key });
}

function svgElement(tag, attributes) {
  const node = document.createElementNS(svgNS, tag);
  for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, String(value));
  return node;
}

function renderGraph(graph) {
  const container = $('tree');
  container.replaceChildren();
  const rows = graph.rows;
  const rowHeight = 34;
  const laneGap = 16;
  const graphWidth = 40 + (graph.laneCount - 1) * laneGap;
  const x = lane => 17 + lane * laneGap;
  const y = index => index * rowHeight + rowHeight / 2;
  const indexById = new Map(rows.map((row, index) => [row.id, index]));
  const shell = element('div', 'graph-shell');
  shell.style.setProperty('--graph-width', `${graphWidth}px`);
  const svg = svgElement('svg', { class: 'graph-lines', width: graphWidth, height: rows.length * rowHeight, viewBox: `0 0 ${graphWidth} ${rows.length * rowHeight}` });
  for (let index = 0; index < rows.length; index++) {
    const row = rows[index];
    if (!row.parentId) continue;
    const parentIndex = indexById.get(row.parentId);
    if (parentIndex === undefined) continue;
    const parent = rows[parentIndex];
    const childX = x(row.lane), parentX = x(parent.lane);
    const path = childX === parentX
      ? `M ${childX} ${y(index)} L ${parentX} ${y(parentIndex)}`
      : `M ${childX} ${y(index)} L ${childX} ${y(parentIndex) - 9} Q ${childX} ${y(parentIndex)} ${parentX} ${y(parentIndex)}`;
    svg.append(svgElement('path', { d: path, fill: 'none', stroke: palette[row.lane % palette.length], 'stroke-width': 2 }));
  }
  for (let index = 0; index < rows.length; index++) {
    const row = rows[index];
    svg.append(svgElement('circle', { cx: x(row.lane), cy: y(index), r: row.sessions.length ? 6 : row.childCount > 1 ? 5.5 : 4,
      fill: row.id === 'root' ? 'var(--vscode-sideBar-background)' : palette[row.lane % palette.length],
      stroke: palette[row.lane % palette.length], 'stroke-width': row.id === 'root' ? 2.5 : 1 }));
  }
  shell.append(svg);
  for (const row of rows) {
    const line = element('div', `graph-row${row.id === 'root' ? ' origin' : ''}`);
    line.style.setProperty('--lane-color', palette[row.lane % palette.length]);
    line.append(element('span', 'lane-space'));
    const content = element('div', 'row-content');
    for (const session of row.sessions) {
      const ref = element('button', 'ref', session.title);
      ref.type = 'button';
      ref.title = `${session.title}\n${session.id}`;
      ref.addEventListener('click', event => { event.stopPropagation(); vscode.postMessage({ type: 'open', threadId: session.id }); });
      content.append(ref);
    }
    const label = element('button', 'row-label', row.id === 'root' ? '原始会话' : row.label);
    label.type = 'button';
    label.disabled = !row.threadId;
    content.append(label);
    if (row.hiddenBefore > 0) content.append(element('span', 'skipped', `+${row.hiddenBefore} 轮`));
    line.append(content);
    line.title = row.id === 'root' ? '打开原始会话' : `定位到这一轮\n${row.label}`;
    if (row.threadId) line.addEventListener('click', () => vscode.postMessage(row.id === 'root'
      ? { type: 'open', threadId: row.threadId }
      : { type: 'revealTurn', threadId: row.threadId, turnId: row.id }));
    shell.append(line);
  }
  container.append(shell);
  $('mode').textContent = showAll ? '只看分叉与会话' : '显示全部轮次';
}

function renderTree(message) {
  currentTree = message;
  selectedKey = message.family.key;
  saveState();
  showPage(true);
  const info = $('treeInfo');
  info.replaceChildren();
  const title = element('button', 'tree-title', message.family.title);
  title.type = 'button';
  title.title = '打开原始会话';
  title.addEventListener('click', () => vscode.postMessage({ type: 'open', threadId: message.family.rootThreadId }));
  info.append(title);
  const graph = message.compact;
  info.append(element('p', '', `${message.family.count} 个会话 · ${graph.totalTurns} 个轮次 · 彩色轨道表示不同进展`));
  if (message.family.inferred) info.append(element('p', 'inferred', '关系由共同轮次 ID 推断，Codex 未记录父会话 ID。'));
  renderGraph(showAll ? message.full : message.compact);
}

$('back').addEventListener('click', () => { selectedKey = null; currentTree = null; saveState(); showPage(false); vscode.postMessage({ type: 'list' }); });
$('search').addEventListener('input', renderFamilies);
$('mode').addEventListener('click', () => {
  showAll = !showAll;
  saveState();
  if (currentTree) renderGraph(showAll ? currentTree.full : currentTree.compact);
});
window.addEventListener('message', event => {
  const message = event.data;
  if (message.type === 'families') {
    families = message.families;
    workspaceLabel = message.workspaceLabel || '未打开文件夹';
    renderFamilies();
    if (selectedKey && !currentTree && families.some(family => family.key === selectedKey)) selectFamily(selectedKey);
  }
  if (message.type === 'tree' && message.family.key === selectedKey) renderTree(message);
  if (message.type === 'status') $('status').textContent = message.text;
  if (message.type === 'error') $('status').textContent = `错误：${message.text}`;
});
showPage(false);
vscode.postMessage({ type: 'ready' });
