'use strict';

const vscode = require('vscode');
const { randomUUID } = require('node:crypto');
const { createTranslator } = require('../shared/i18n');
const t = createTranslator(vscode.env.language);

async function openSession(threadId, turnId) {
  if (!vscode.extensions.getExtension('openai.chatgpt')) {
    vscode.window.showErrorMessage(t('installOfficial'));
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
    // The command is absent until the patched official extension has reloaded.
  }
  await openSession(threadId, turnId);
  return false;
}

module.exports = { openSession, revealOfficialTurn };
