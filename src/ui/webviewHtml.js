'use strict';

const vscode = require('vscode');
const { languageTag } = require('../shared/i18n');

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

function resource(webview, extensionUri, ...parts) {
  return webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, ...parts));
}

function page(webview, extensionUri, locale, styleFile, scriptFile, body) {
  const style = resource(webview, extensionUri, 'webview', styleFile);
  const i18n = resource(webview, extensionUri, 'src', 'shared', 'i18n.js');
  const script = resource(webview, extensionUri, 'webview', scriptFile);
  return `<!doctype html><html lang="${languageTag(locale)}"><head><meta charset="UTF-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src ${webview.cspSource};">
    <link rel="stylesheet" href="${style}"></head><body>${body}
    <script src="${i18n}"></script><script src="${script}"></script></body></html>`;
}

function sidebarHtml(webview, extensionUri, locale, t) {
  const label = key => escapeHtml(t(key));
  return page(webview, extensionUri, locale, 'view.css', 'view.js', `<div id="app">
    <nav id="treeNav" hidden><button id="back" type="button" aria-label="${label('backToSessions')}" title="${label('backToSessions')}">
      <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m9.5 3.5-4.5 4.5 4.5 4.5"/></svg></button>
      <button id="navTitle" class="tree-title" type="button"></button></nav>
    <main><section id="familiesPage">
      <label class="search-wrap" for="search"><svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="7" cy="7" r="4.5"/><path d="m10.5 10.5 3.5 3.5"/></svg>
        <input id="search" type="search" placeholder="${label('searchPlaceholder')}" autocomplete="off"><kbd>/</kbd></label>
      <div id="families"></div></section>
    <section id="treePage" hidden><div id="graphControls"><span class="graph-section-label">${label('conversationGraph')}</span>
        <div class="view-switch" role="group" aria-label="${label('turnDisplay')}"><button id="compactMode" type="button">${label('summary')}</button><button id="allMode" type="button">${label('all')}</button></div>
      </div><div id="tree" aria-label="${label('branchGraph')}"></div></section></main>
    <footer id="footer"><span id="treeSummary" hidden></span><span id="status" role="status" aria-live="polite"></span></footer></div>`);
}

function turnViewerHtml(webview, extensionUri, locale, t) {
  const label = key => escapeHtml(t(key));
  return page(webview, extensionUri, locale, 'turnViewer.css', 'turnViewer.js', `<div class="top"><div id="sessionTitle" class="session-title"></div><span id="position" class="position"></span>
      <button id="previous" type="button">${label('previousTurn')}</button><button id="next" type="button">${label('nextTurn')}</button>
      <button id="openSession" type="button">${label('openInCodex')}</button></div>
      <h1 id="turnTitle"></h1><div id="turnId" class="turn-id"></div>
      <section class="message"><h2>${label('userQuestion')}</h2><pre id="userText"></pre></section>
      <section class="message"><h2>${label('codexResponse')}</h2><pre id="assistantText"></pre></section>`);
}

module.exports = { sidebarHtml, turnViewerHtml, escapeHtml };
