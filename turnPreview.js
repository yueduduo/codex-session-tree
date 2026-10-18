'use strict';

const { extractUserQuestion, turnLabel } = require('./graph');

function turnText(turn) {
  const user = (turn.items || []).filter(item => item.type === 'userMessage')
    .flatMap(item => item.content || [])
    .filter(part => part.type === 'text' || part.type === 'inputText')
    .map(part => part.text || '').join('\n').trim();
  const assistant = (turn.items || []).filter(item => item.type === 'agentMessage')
    .map(item => item.text || '').filter(Boolean).join('\n\n').trim();
  return { user: extractUserQuestion(user), assistant };
}

function previewTurn(turns, index, threadId, title) {
  const turn = turns[index];
  if (!turn) return null;
  return {
    threadId, title, index, total: turns.length, turnId: turn.id,
    label: turnLabel(turn, index), ...turnText(turn)
  };
}

module.exports = { turnText, previewTurn };
