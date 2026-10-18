'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { previewTurn } = require('../turnPreview');

test('positions the reader on the requested turn and shows its question and replies', () => {
  const turns = [
    { id: 'first', items: [{ type: 'userMessage', content: [{ type: 'text', text: '开始' }] }] },
    { id: 'target', items: [
      { type: 'userMessage', content: [{ type: 'text', text: '# Context from my IDE setup:\n\n## Open tabs:\n- README.md\n\n## My request:\n分析训练结果' }] },
      { type: 'agentMessage', text: '先检查日志。' },
      { type: 'agentMessage', text: '结果如下。' }
    ] }
  ];
  assert.deepEqual(previewTurn(turns, 1, 'branch', '训练分支'), {
    threadId: 'branch', title: '训练分支', index: 1, total: 2, turnId: 'target',
    label: '2. 分析训练结果', user: '分析训练结果', assistant: '先检查日志。\n\n结果如下。'
  });
  assert.equal(previewTurn(turns, 2, 'branch', '训练分支'), null);
});
