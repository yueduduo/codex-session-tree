'use strict';

const vscode = acquireVsCodeApi();
const $ = id => document.getElementById(id);
const locale = document.documentElement.lang;
const t = CodexBranchI18n.createTranslator(locale);
const svgNS = 'http://www.w3.org/2000/svg';
const palette = [
  'var(--vscode-charts-blue, #5da9f6)', 'var(--vscode-charts-orange, #d99a40)', 'var(--vscode-charts-green, #77bd8b)',
  'var(--vscode-charts-purple, #b38ad7)', 'var(--vscode-charts-red, #d97d7d)', 'var(--vscode-charts-yellow, #c7b55c)'
];
let families = [];
let workspaceLabel = t('noFolder');
const initialState = vscode.getState() || {};
let selectedKey = initialState.selectedKey || null;
let showAll = initialState.showAll || false;
let currentExpanded = initialState.currentExpanded !== false;
let otherExpanded = initialState.otherExpanded || false;
let expandedWorkspaces = new Set(initialState.expandedWorkspaces || []);
let currentTree = null;
let selectedTurnId = null;

function saveState() { vscode.setState({ selectedKey, showAll, currentExpanded, otherExpanded, expandedWorkspaces: [...expandedWorkspaces] }); }

function element(tag, className, value) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (value !== undefined) node.textContent = value;
  return node;
}

function showPage(tree) {
  $('familiesPage').hidden = tree;
  $('treePage').hidden = !tree;
  $('treeNav').hidden = !tree;
  $('treeSummary').hidden = !tree;
}

function date(timestamp) { return timestamp ? new Date(timestamp * 1000).toLocaleDateString(locale) : ''; }

function icon(name) {
  const svg = svgElement('svg', { viewBox: '0 0 16 16', 'aria-hidden': 'true' });
  const paths = {
    conversation: ['M3 3.25h8.5a1.5 1.5 0 0 1 1.5 1.5v5a1.5 1.5 0 0 1-1.5 1.5H7l-3 2v-2H3a1.5 1.5 0 0 1-1.5-1.5v-5A1.5 1.5 0 0 1 3 3.25Z', 'M5 6.5h5', 'M5 8.5h3.5'],
    folder: ['M1.75 4.5h4l1.5 1.5h7v6.5H1.75V4.5Z', 'M1.75 4.5V3.25h4.5L7.5 4.5']
  };
  for (const d of paths[name] || []) svg.append(svgElement('path', { d }));
  return svg;
}

function familyButton(family) {
  const button = element('button', 'family');
  button.type = 'button';
  button.title = family.title;
  const marker = element('span', 'family-icon');
  marker.append(icon('conversation'));
  const body = element('span', 'family-body');
  body.append(element('span', 'family-title', family.title));
  const meta = element('span', 'family-meta');
  const updated = date(family.updatedAt);
  if (updated) {
    meta.append(element('time', 'family-date', updated));
  }
  if (meta.childNodes.length) body.append(meta);
  button.append(marker, body);
  if (family.count > 1) {
    const count = element('span', 'family-count', String(family.count));
    count.title = t('sessionsCount', { count: family.count });
    button.append(count);
  }
  button.append(element('span', 'family-arrow'));
  button.addEventListener('click', () => selectFamily(family.key));
  return button;
}

function workspaceName(directory) {
  return directory?.split(/[\\/]/).filter(Boolean).at(-1) || directory || t('unknownDirectory');
}

function workspaceGroups(items) {
  const grouped = new Map();
  for (const family of items) {
    const directory = family.cwd || '';
    if (!grouped.has(directory)) grouped.set(directory, []);
    grouped.get(directory).push(family);
  }
  return grouped;
}

function watchExpansion(details, query, update) {
  details.addEventListener('toggle', () => {
    if (!details.isConnected || query) return;
    update(details.open);
    saveState();
  });
}

function renderFamilies() {
  const query = $('search').value.trim().toLocaleLowerCase();
  const container = $('families');
  container.replaceChildren();
  const filtered = families.filter(family => `${family.title} ${family.cwd || ''}`.toLocaleLowerCase().includes(query));
  const current = filtered.filter(family => family.currentWorkspace);
  const other = filtered.filter(family => !family.currentWorkspace);
  const currentSection = element('details', 'workspace-group current-group');
  currentSection.open = currentExpanded || !!query;
  const currentHeading = element('summary', 'workspace-heading');
  currentHeading.append(element('span', '', t('currentWorkspace')));
  const workspace = element('span', 'workspace-label');
  workspace.title = workspaceLabel;
  workspace.append(icon('folder'), element('span', '', workspaceLabel));
  currentHeading.append(workspace, element('span', 'group-count', String(current.length)));
  currentSection.append(currentHeading);
  const currentContent = element('div', 'workspace-contents');
  if (current.length) currentContent.append(...current.map(family => familyButton(family)));
  else currentContent.append(element('p', 'empty', t(query ? 'noCurrentMatches' : 'noCurrentSessions')));
  currentSection.append(currentContent);
  watchExpansion(currentSection, query, open => { currentExpanded = open; });
  container.append(currentSection);
  const otherSection = element('details', 'workspace-group other-group');
  otherSection.open = otherExpanded || !!query;
  const otherHeading = element('summary', 'workspace-heading');
  otherHeading.append(element('span', '', t('otherWorkspaces')), element('span', 'group-count', String(other.length)));
  otherSection.append(otherHeading);
  if (other.length) {
    for (const [directory, entries] of workspaceGroups(other)) {
      const group = element('details', 'workspace-folder');
      group.open = expandedWorkspaces.has(directory) || !!query;
      const heading = element('summary', 'workspace-heading folder-heading');
      heading.title = directory || t('unknownDirectory');
      const folderLabel = element('span', 'folder-label');
      folderLabel.append(icon('folder'), element('span', 'folder-name', workspaceName(directory)));
      heading.append(folderLabel, element('span', 'group-count', String(entries.length)));
      group.append(heading);
      const content = element('div', 'workspace-contents');
      content.append(...entries.map(family => familyButton(family)));
      group.append(content);
      watchExpansion(group, query, open => {
        if (open) expandedWorkspaces.add(directory);
        else expandedWorkspaces.delete(directory);
      });
      otherSection.append(group);
    }
  } else otherSection.append(element('p', 'empty', t(query ? 'noOtherMatches' : 'noOtherSessions')));
  watchExpansion(otherSection, query, open => { otherExpanded = open; });
  container.append(otherSection);
}

function selectFamily(key) {
  selectedKey = key;
  currentTree = null;
  selectedTurnId = null;
  $('treeSummary').textContent = '';
  saveState();
  showPage(true);
  $('tree').replaceChildren(element('p', 'empty', t('buildingGraph')));
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
  const laneGap = 16;
  const graphWidth = 36 + (graph.laneCount - 1) * laneGap;
  const rowHeight = row => row.id === 'root' ? 42 : row.sessions.length ? 54 + 22 * row.sessions.length : 51;
  const heights = rows.map(rowHeight);
  let graphHeight = 0;
  const centers = heights.map(height => {
    const center = graphHeight + height / 2;
    graphHeight += height;
    return center;
  });
  const x = lane => 16 + lane * laneGap;
  const y = index => centers[index];
  const indexById = new Map(rows.map((row, index) => [row.id, index]));
  const shell = element('div', 'graph-shell');
  shell.style.setProperty('--graph-width', `${graphWidth}px`);
  const svg = svgElement('svg', { class: 'graph-lines', width: graphWidth, height: graphHeight, viewBox: `0 0 ${graphWidth} ${graphHeight}`, 'aria-hidden': 'true' });
  for (let index = 0; index < rows.length; index++) {
    const row = rows[index];
    if (!row.parentId) continue;
    const parentIndex = indexById.get(row.parentId);
    if (parentIndex === undefined) continue;
    const parent = rows[parentIndex];
    const childX = x(row.lane), parentX = x(parent.lane);
    const joinY = y(parentIndex) - Math.min(12, (y(parentIndex) - y(index)) / 3);
    const path = childX === parentX
      ? `M ${childX} ${y(index)} L ${parentX} ${y(parentIndex)}`
      : `M ${childX} ${y(index)} L ${childX} ${joinY} Q ${childX} ${y(parentIndex)} ${parentX} ${y(parentIndex)}`;
    svg.append(svgElement('path', { d: path, fill: 'none', stroke: palette[row.lane % palette.length], 'stroke-width': 2, 'stroke-linecap': 'round', opacity: '.9' }));
  }
  for (let index = 0; index < rows.length; index++) {
    const row = rows[index];
    svg.append(svgElement('circle', { cx: x(row.lane), cy: y(index), r: row.id === 'root' ? 5 : row.sessions.length ? 5.5 : row.childCount > 1 ? 5 : 3.6,
      fill: row.id === 'root' ? 'var(--vscode-sideBar-background)' : palette[row.lane % palette.length],
      stroke: palette[row.lane % palette.length], 'stroke-width': row.id === 'root' ? 2.5 : 1.5 }));
  }
  shell.append(svg);
  for (const row of rows) {
    const line = element('div', `graph-row${row.id === 'root' ? ' origin' : ''}`);
    line.style.setProperty('--lane-color', palette[row.lane % palette.length]);
    line.style.setProperty('--row-height', `${rowHeight(row)}px`);
    line.dataset.nodeId = row.id;
    line.tabIndex = row.threadId ? 0 : -1;
    line.setAttribute('role', 'button');
    line.setAttribute('aria-label', row.id === 'root' ? t('openOriginal') : t('revealTurn', { label: row.label }));
    if (selectedTurnId === row.id) { line.classList.add('is-selected'); line.setAttribute('aria-current', 'location'); }
    line.append(element('span', 'lane-space'));
    const content = element('div', 'row-content');
    const main = element('div', 'row-main');
    const label = element('span', 'row-label');
    const numbered = row.id === 'root' ? null : /^(\d+\.)\s*/.exec(row.label);
    if (numbered) {
      label.append(element('span', 'turn-number', numbered[1]), document.createTextNode(` ${row.label.slice(numbered[0].length)}`));
    } else label.textContent = row.id === 'root' ? t('originalSession') : row.label;
    label.title = row.id === 'root' ? t('openOriginal') : row.label;
    main.append(label);
    if (row.hiddenBefore > 0 && !row.sessions.length) main.append(element('span', 'skipped', t('skippedTurns', { count: row.hiddenBefore })));
    content.append(main);
    const foot = element('div', 'row-foot');
    for (const session of row.sessions) {
      const ref = element('button', 'ref');
      ref.type = 'button';
      ref.title = `${session.title}\n${session.id}`;
      ref.append(element('span', '', session.title));
      ref.addEventListener('click', event => { event.stopPropagation(); vscode.postMessage({ type: 'open', threadId: session.id }); });
      foot.append(ref);
    }
    if (row.hiddenBefore > 0 && row.sessions.length) foot.append(element('span', 'skipped', t('skippedTurns', { count: row.hiddenBefore })));
    if (foot.childNodes.length) content.append(foot);
    line.append(content);
    line.title = row.id === 'root' ? t('openOriginal') : row.label;
    if (row.threadId) {
      const activate = () => {
        selectedTurnId = row.id;
        for (const candidate of shell.querySelectorAll('.graph-row')) {
          const active = candidate.dataset.nodeId === row.id;
          candidate.classList.toggle('is-selected', active);
          if (active) candidate.setAttribute('aria-current', 'location');
          else candidate.removeAttribute('aria-current');
        }
        vscode.postMessage(row.id === 'root'
          ? { type: 'open', threadId: row.threadId }
          : { type: 'revealTurn', threadId: row.threadId, turnId: row.id });
      };
      line.addEventListener('click', activate);
      line.addEventListener('keydown', event => {
        if (event.target === line && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); activate(); }
      });
    }
    shell.append(line);
  }
  container.append(shell);
  $('compactMode').setAttribute('aria-pressed', String(!showAll));
  $('allMode').setAttribute('aria-pressed', String(showAll));
}

function renderTree(message) {
  currentTree = message;
  selectedKey = message.family.key;
  saveState();
  showPage(true);
  const title = $('navTitle');
  title.textContent = message.family.title;
  title.title = t('openOriginal');
  title.onclick = () => vscode.postMessage({ type: 'open', threadId: message.family.rootThreadId });
  $('treeSummary').textContent = t('treeSummary', { sessions: message.family.count, turns: message.compact.totalTurns });
  renderGraph(showAll ? message.full : message.compact);
}

$('back').addEventListener('click', () => { selectedKey = null; currentTree = null; selectedTurnId = null; saveState(); showPage(false); vscode.postMessage({ type: 'list' }); });
$('search').addEventListener('input', renderFamilies);
for (const [id, value] of [['compactMode', false], ['allMode', true]]) {
  $(id).addEventListener('click', () => {
    if (showAll === value) return;
    showAll = value;
    saveState();
    if (currentTree) renderGraph(showAll ? currentTree.full : currentTree.compact);
  });
}
document.addEventListener('keydown', event => {
  if (event.key === '/' && !event.ctrlKey && !event.metaKey && !event.altKey && !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName) && $('familiesPage').hidden === false) {
    event.preventDefault();
    $('search').focus();
  }
  if (event.key === 'Escape' && document.activeElement === $('search')) {
    $('search').value = '';
    renderFamilies();
    $('search').blur();
  }
});
window.addEventListener('message', event => {
  const message = event.data;
  if (message.type === 'families') {
    families = message.families;
    workspaceLabel = message.workspaceLabel || t('noFolder');
    renderFamilies();
    if (selectedKey && !currentTree && families.some(family => family.key === selectedKey)) selectFamily(selectedKey);
  }
  if (message.type === 'tree' && message.family.key === selectedKey) renderTree(message);
  if (message.type === 'status') $('status').textContent = message.text;
  if (message.type === 'error') $('status').textContent = t('error', { message: message.text });
});
showPage(false);
vscode.postMessage({ type: 'ready' });
