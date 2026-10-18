'use strict';

const vscode = require('vscode');
const { CodexClient, findCodexBinary } = require('./codex/codexClient');
const { buildFamilies, buildTurnTree, layoutGitGraph } = require('./domain/graph');
const { inWorkspace, familyInWorkspace } = require('./domain/workspace');
const { isInstalled: hasOfficialNavigationPatch } = require('./codex/officialPatch');
const { createTranslator } = require('./shared/i18n');
const { sidebarHtml } = require('./ui/webviewHtml');
const { TurnViewer } = require('./ui/turnViewer');
const { openSession, revealOfficialTurn } = require('./ui/sessionNavigation');

const VIEW_ID = 'codexSessionTree.sessions';
const t = createTranslator(vscode.env.language);

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
    webview.options = { enableScripts: true, localResourceRoots: [
      vscode.Uri.joinPath(this.context.extensionUri, 'webview'),
      vscode.Uri.joinPath(this.context.extensionUri, 'src', 'shared')
    ] };
    webview.html = sidebarHtml(webview, this.context.extensionUri, vscode.env.language, t);
    this.context.subscriptions.push(webview.onDidReceiveMessage(message => this.handleMessage(message)));
    this.context.subscriptions.push(view.onDidChangeVisibility(() => { if (view.visible) this.refresh(); }));
  }

  post(message) { this.view?.webview.postMessage(message); }

  async refresh() {
    if (this.refreshing) return this.refreshing;
    this.post({ type: 'status', text: t('loadingSessions') });
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
        this.post({ type: 'families', workspaceLabel: folders?.map(folder => folder.name).join(', ') || t('noFolder'), families: this.families.map(family => ({
          key: family.key, title: family.title, count: family.threads.length,
          cwd: family.cwd, updatedAt: family.updatedAt,
          currentWorkspace: familyInWorkspace(family, folders)
        })) });
        this.post({ type: 'status', text: t('sourceFamilies', { families: this.families.length, sessions: threads.length }) });
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
    this.post({ type: 'status', text: t('buildingTree') });
    try {
      const turnLists = await mapWithConcurrency(family.threads, 6, thread => this.getClient().listTurns(thread.id));
      if (version !== this.selectionVersion) return;
      const turnsByThread = new Map(family.threads.map((thread, index) => [thread.id, turnLists[index]]));
      this.selectedTurnsByThread = turnsByThread;
      const root = buildTurnTree(family, turnsByThread);
      this.post({ type: 'tree', family: { key: family.key, title: family.title, rootThreadId: family.threads[0]?.id, count: family.threads.length },
        compact: layoutGitGraph(root, false), full: layoutGitGraph(root, true) });
      this.post({ type: 'status', text: '' });
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
        this.post({ type: 'status', text: t('locatingTurn') });
        const turns = this.selectedTurnsByThread?.get(thread.id) || await this.getClient().listTurns(thread.id);
        if (version !== this.revealVersion) return;
        const index = turns.findIndex(turn => turn.id === message.turnId);
        if (index < 0) throw new Error(t('missingTurn'));
        const official = vscode.extensions.getExtension('openai.chatgpt');
        const canRevealInOfficial = official && hasOfficialNavigationPatch(official.extensionPath);
        let reused = false;
        try {
          if (canRevealInOfficial) reused = await revealOfficialTurn(thread.id, message.turnId);
          else await openSession(thread.id);
        }
        catch (error) { vscode.window.showWarningMessage(t('openSessionFailed', { message: error.message })); }
        if (version !== this.revealVersion) return;
        if (!canRevealInOfficial) this.turnViewer.show(thread.id, thread.name || thread.preview || thread.id, turns, index);
        const result = canRevealInOfficial ? (reused ? t('officialRevealRequested') : t('officialOpened')) : t('readerReveal');
        this.post({ type: 'status', text: t('revealStatus', { result, index: index + 1, title: thread.name || thread.id }) });
      } catch (error) {
        if (version === this.revealVersion) vscode.window.showErrorMessage(t('revealFailed', { message: error.message }));
      }
    }
  }
}


function activate(context) {
  const binary = () => findCodexBinary(vscode, vscode.workspace.getConfiguration('codexSessionTree').get('codexPath', ''));
  let client = new CodexClient(binary(), undefined, vscode.env.language);
  const resetClient = async () => {
    await client.disposeAndWait();
    client = new CodexClient(binary(), undefined, vscode.env.language);
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
