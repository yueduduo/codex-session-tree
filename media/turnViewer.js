'use strict';

const vscode = acquireVsCodeApi();
const $ = id => document.getElementById(id);

$('previous').addEventListener('click', () => vscode.postMessage({ type: 'navigate', delta: -1 }));
$('next').addEventListener('click', () => vscode.postMessage({ type: 'navigate', delta: 1 }));
$('openSession').addEventListener('click', () => vscode.postMessage({ type: 'openSession' }));

window.addEventListener('message', event => {
  const message = event.data;
  if (message.type !== 'turn') return;
  $('sessionTitle').textContent = message.title;
  $('position').textContent = `第 ${message.index + 1} / ${message.total} 轮`;
  $('turnTitle').textContent = message.label;
  $('turnId').textContent = message.turnId;
  $('userText').textContent = message.user || '（没有可显示的文字问题）';
  $('assistantText').textContent = message.assistant || '（这一轮没有可显示的回复）';
  $('previous').disabled = message.index === 0;
  $('next').disabled = message.index === message.total - 1;
  $('turnTitle').scrollIntoView({ block: 'start' });
});

vscode.postMessage({ type: 'ready' });
