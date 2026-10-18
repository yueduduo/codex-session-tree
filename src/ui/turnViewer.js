'use strict';

const vscode = require('vscode');
const { previewTurn } = require('../domain/turnPreview');
const { isInstalled: hasOfficialNavigationPatch } = require('../codex/officialPatch');
const { openSession, revealOfficialTurn } = require('./sessionNavigation');
const { turnViewerHtml } = require('./webviewHtml');
const { createTranslator } = require('../shared/i18n');
const t = createTranslator(vscode.env.language);

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
      this.panel = vscode.window.createWebviewPanel('codexSessionTree.turn', t('turnPanel'), vscode.ViewColumn.Active,
        { enableScripts: true, retainContextWhenHidden: true, localResourceRoots: [
          vscode.Uri.joinPath(this.context.extensionUri, 'webview'),
          vscode.Uri.joinPath(this.context.extensionUri, 'src', 'shared')
        ] });
      const webview = this.panel.webview;
      this.panel.onDidDispose(() => { this.panel = null; this.ready = false; });
      webview.onDidReceiveMessage(message => this.handleMessage(message));
      webview.html = turnViewerHtml(webview, this.context.extensionUri, vscode.env.language, t);
    } else this.panel.reveal(vscode.ViewColumn.Active);
    this.postCurrent();
  }

  postCurrent() {
    if (!this.panel || !this.ready) return;
    this.panel.title = t('turnPanelIndex', { index: this.index + 1 });
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

module.exports = { TurnViewer };
