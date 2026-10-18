'use strict';

const vscode = require('vscode');
const { randomUUID } = require('node:crypto');
const { CodexClient, findCodexBinary } = require('./codexClient');
const { buildFamilies, buildTurnTree, layoutGitGraph } = require('./graph');
const { inWorkspace, familyInWorkspace } = require('./workspace');
const { previewTurn } = require('./turnPreview');
const { isInstalled: hasOfficialNavigationPatch } = require('./officialPatch');

const VIEW_ID = 'codexSessionTree.sessions';

async function mapWithConcurrency(items, limit, work) {
  const results = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await work(items[index]);
    }
  }));
  return results;
}

class SessionTreeView {
  constructor(context, getClient, turnViewer) {
    this.context = context;
    this.getClient = getClient;
    this.turnViewer = turnViewer;
    this.view = null;
    this.families = [];
    this.selectedKey = null;
    this.refreshing = null;
    this.selectionVersion = 0;
    this.revealVersion = 0;
    this.selectedTurnsByThread = null;
  }

  resolveWebviewView(view) {
    this.view = view;
    const webview = view.webview;
    webview.options = { enableScripts: true, localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, 'media')] };
    const script = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'media', 'view.js'));
    const style = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'media', 'view.css'));
    webview.html = `<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8">
      <meta name="viewport" content="width=device-width,initial-scale=1">
      <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src ${webview.cspSource};">
      <link rel="stylesheet" href="${style}"></head><body>
      <header><button id="back" type="button" title="返回会话列表">‹</button><strong id="heading">Codex 会话树</strong></header>
      <main><section id="familiesPage"><input id="search" type="search" placeholder="搜索原始会话"><div id="families"></div></section>
      <section id="treePage" hidden><div id="treeInfo"></div><div id="graphControls"><button id="mode" type="button">显示全部轮次</button></div><div id="tree"></div></section></main>
      <div id="status"></div><script src="${script}"></script></body></html>`;
    this.context.subscriptions.push(webview.onDidReceiveMessage(message => this.handleMessage(message)));
    this.context.subscriptions.push(view.onDidChangeVisibility(() => { if (view.visible) this.refresh(); }));
  }

  post(message) { this.view?.webview.postMessage(message); }

  async refresh() {
    if (this.refreshing) return this.refreshing;
    this.post({ type: 'status', text: '正在读取 Codex 会话…' });
    this.refreshing = (async () => {
      try {
        const config = vscode.workspace.getConfiguration('codexSessionTree');
        const threads = await this.getClient().listThreads(config.get('showArchived', false));
        const folders = vscode.workspace.workspaceFolders;
        const firstTurns = await mapWithConcurrency(threads, 8, async thread => {
          try { return await this.getClient().firstTurnId(thread.id); }
          catch { return undefined; }
        });
        const firstTurnByThread = new Map(threads.map((thread, index) => [thread.id, firstTurns[index]]));
        this.families = buildFamilies(threads, firstTurnByThread);
        this.post({ type: 'families', workspaceLabel: folders?.map(folder => folder.name).join('、') || '未打开文件夹', families: this.families.map(family => ({
          key: family.key, title: family.title, count: family.threads.length,
          cwd: family.cwd, updatedAt: family.updatedAt, inferred: family.inferred,
          currentWorkspace: familyInWorkspace(family, folders)
        })) });
        this.post({ type: 'status', text: `${this.families.length} 组原始会话 · ${threads.length} 个会话` });
        if (this.selectedKey && this.families.some(family => family.key === this.selectedKey)) await this.select(this.selectedKey);
      } catch (error) {
        this.post({ type: 'error', text: error.message });
      } finally {
        this.refreshing = null;
      }
    })();
    return this.refreshing;
  }

  async select(key) {
    const family = this.families.find(item => item.key === key);
    if (!family) return;
    this.selectedKey = key;
    this.selectedTurnsByThread = null;
    const version = ++this.selectionVersion;
    this.post({ type: 'status', text: '正在构建分叉树…' });
    try {
      const turnLists = await mapWithConcurrency(family.threads, 6, thread => this.getClient().listTurns(thread.id));
      if (version !== this.selectionVersion) return;
      const turnsByThread = new Map(family.threads.map((thread, index) => [thread.id, turnLists[index]]));
      this.selectedTurnsByThread = turnsByThread;
      const root = buildTurnTree(family, turnsByThread);
      this.post({ type: 'tree', family: { key: family.key, title: family.title, rootThreadId: family.threads[0]?.id, count: family.threads.length, inferred: family.inferred },
        compact: layoutGitGraph(root, false), full: layoutGitGraph(root, true) });
      this.post({ type: 'status', text: `${family.threads.length} 个会话 · 点击轮次或会话名称打开` });
    } catch (error) {
      this.post({ type: 'error', text: error.message });
    }
  }

  async handleMessage(message) {
    if (!message || typeof message !== 'object') return;
    if (message.type === 'ready') return this.refresh();
    if (message.type === 'refresh') return this.refresh();
    if (message.type === 'list') { this.selectedKey = null; this.selectedTurnsByThread = null; return this.refresh(); }
    if (message.type === 'select' && typeof message.key === 'string') return this.select(message.key);
    if (message.type === 'open' && typeof message.threadId === 'string') return openSession(message.threadId);
    if (message.type === 'revealTurn' && typeof message.threadId === 'string' && typeof message.turnId === 'string') {
      const thread = this.families.find(family => family.key === this.selectedKey)?.threads.find(item => item.id === message.threadId);
      if (!thread) return;
      const version = ++this.revealVersion;
      try {
        this.post({ type: 'status', text: '正在定位轮次…' });
        const turns = this.selectedTurnsByThread?.get(thread.id) || await this.getClient().listTurns(thread.id);
        if (version !== this.revealVersion) return;
        const index = turns.findIndex(turn => turn.id === message.turnId);
        if (index < 0) throw new Error('所选轮次已不在此会话中，请刷新列表');
        const official = vscode.extensions.getExtension('openai.chatgpt');
        const canRevealInOfficial = official && hasOfficialNavigationPatch(official.extensionPath);
        let reused = false;
        try {
          if (canRevealInOfficial) reused = await revealOfficialTurn(thread.id, message.turnId);
          else await openSession(thread.id);
        }
        catch (error) { vscode.window.showWarningMessage(`Codex 会话未能打开：${error.message}`); }
        if (version !== this.revealVersion) return;
        if (!canRevealInOfficial) this.turnViewer.show(thread.id, thread.name || thread.preview || thread.id, turns, index);
        this.post({ type: 'status', text: `${canRevealInOfficial ? (reused ? '已请求官方 Codex 定位' : '已打开官方 Codex · 目标') : '已在阅读页定位'}第 ${index + 1} 轮 · ${thread.name || thread.id}` });
      } catch (error) {
        if (version === this.revealVersion) vscode.window.showErrorMessage(`无法定位 Codex 轮次：${error.message}`);
      }
    }
  }
}

class TurnViewer {
  constructor(context) {
    this.context = context;
    this.panel = null;
    this.ready = false;
    this.turns = [];
    this.index = 0;
    this.threadId = null;
    this.title = '';
  }

  show(threadId, title, turns, index) {
    this.threadId = threadId;
    this.title = title;
    this.turns = turns;
    this.index = index;
    if (!this.panel) {
      this.ready = false;
      this.panel = vscode.window.createWebviewPanel('codexSessionTree.turn', 'Codex 轮次', vscode.ViewColumn.Active,
        { enableScripts: true, retainContextWhenHidden: true, localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, 'media')] });
      const webview = this.panel.webview;
      this.panel.onDidDispose(() => { this.panel = null; this.ready = false; });
      webview.onDidReceiveMessage(message => this.handleMessage(message));
      const script = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'media', 'turnViewer.js'));
      const style = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'media', 'turnViewer.css'));
      webview.html = `<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8">
        <meta name="viewport" content="width=device-width,initial-scale=1">
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src ${webview.cspSource};">
        <link rel="stylesheet" href="${style}"></head><body>
        <div class="top"><div id="sessionTitle" class="session-title"></div><span id="position" class="position"></span>
        <button id="previous" type="button">上一轮</button><button id="next" type="button">下一轮</button>
        <button id="openSession" type="button">在 Codex 中打开</button></div>
        <h1 id="turnTitle"></h1><div id="turnId" class="turn-id"></div>
        <section class="message"><h2>用户问题</h2><pre id="userText"></pre></section>
        <section class="message"><h2>Codex 回复</h2><pre id="assistantText"></pre></section>
        <script src="${script}"></script></body></html>`;
    } else this.panel.reveal(vscode.ViewColumn.Active);
    this.postCurrent();
  }

  postCurrent() {
    if (!this.panel || !this.ready) return;
    this.panel.title = `Codex 第 ${this.index + 1} 轮`;
    this.panel.webview.postMessage({ type: 'turn', ...previewTurn(this.turns, this.index, this.threadId, this.title) });
  }

  handleMessage(message) {
    if (message?.type === 'ready') { this.ready = true; this.postCurrent(); }
    if (message?.type === 'navigate' && (message.delta === -1 || message.delta === 1)) {
      this.index = Math.max(0, Math.min(this.turns.length - 1, this.index + message.delta));
      this.postCurrent();
    }
    if (message?.type === 'openSession' && this.threadId) {
      const official = vscode.extensions.getExtension('openai.chatgpt');
      if (official && hasOfficialNavigationPatch(official.extensionPath)) revealOfficialTurn(this.threadId, this.turns[this.index]?.id);
      else openSession(this.threadId);
    }
  }
}

async function openSession(threadId, turnId) {
  if (!vscode.extensions.getExtension('openai.chatgpt')) {
    vscode.window.showErrorMessage('请先安装 OpenAI Codex 扩展，以在 VS Code 中打开会话。');
    return;
  }
  const query = turnId ? new URLSearchParams({ codexTreeTurnId: turnId, codexTreeNav: randomUUID() }).toString() : '';
  const uri = vscode.Uri.from({ scheme: 'openai-codex', authority: 'route', path: `/local/${threadId}`, query });
  await vscode.commands.executeCommand('vscode.open', uri, { preview: Boolean(turnId) });
}

async function revealOfficialTurn(threadId, turnId) {
  try {
    const reused = await vscode.commands.executeCommand('codexSessionTree.revealTurn', { threadId, turnId });
    if (reused) return true;
  } catch {
    // The host command is absent until the patched official extension has reloaded.
  }
  await openSession(threadId, turnId);
  return false;
}

function activate(context) {
  const binary = () => findCodexBinary(vscode, vscode.workspace.getConfiguration('codexSessionTree').get('codexPath', ''));
  let client = new CodexClient(binary());
  const resetClient = async () => {
    await client.disposeAndWait();
    client = new CodexClient(binary());
  };
  const turnViewer = new TurnViewer(context);
  const view = new SessionTreeView(context, () => client, turnViewer);
  context.subscriptions.push(vscode.window.registerWebviewViewProvider(VIEW_ID, view, { webviewOptions: { retainContextWhenHidden: true } }));
  context.subscriptions.push(vscode.commands.registerCommand('codexSessionTree.refresh', () => view.refresh()));
  context.subscriptions.push(vscode.commands.registerCommand('codexSessionTree.open', threadId => openSession(threadId)));
  context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(event => {
    if (event.affectsConfiguration('codexSessionTree')) {
      if (client.binary !== binary()) resetClient().then(() => view.refresh());
      else view.refresh();
    }
  }));
  context.subscriptions.push(vscode.workspace.onDidChangeWorkspaceFolders(() => view.refresh()));
  context.subscriptions.push(vscode.window.onDidChangeWindowState(state => { if (state.focused && view.view?.visible) view.refresh(); }));
  const timer = setInterval(() => { if (view.view?.visible) view.refresh(); }, 60000);
  context.subscriptions.push({ dispose: () => { clearInterval(timer); client.dispose(); } });
}

module.exports = { activate, deactivate() {}, SessionTreeView, TurnViewer, inWorkspace, mapWithConcurrency };
