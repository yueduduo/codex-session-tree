'use strict';

const vscode = acquireVsCodeApi();
const $ = id => document.getElementById(id);
const t = CodexBranchI18n.createTranslator(document.documentElement.lang);

$('previous').addEventListener('click', () => vscode.postMessage({ type: 'navigate', delta: -1 }));
$('next').addEventListener('click', () => vscode.postMessage({ type: 'navigate', delta: 1 }));
$('openSession').addEventListener('click', () => vscode.postMessage({ type: 'openSession' }));

window.addEventListener('message', event => {
  const message = event.data;
  if (message.type !== 'turn') return;
  $('sessionTitle').textContent = message.title;
  $('position').textContent = t('turnPosition', { index: message.index + 1, total: message.total });
  $('turnTitle').textContent = message.label;
  $('turnId').textContent = message.turnId;
  $('userText').textContent = message.user || t('noQuestion');
  $('assistantText').textContent = message.assistant || t('noResponse');
  $('previous').disabled = message.index === 0;
  $('next').disabled = message.index === message.total - 1;
  $('turnTitle').scrollIntoView({ block: 'start' });
});

vscode.postMessage({ type: 'ready' });
