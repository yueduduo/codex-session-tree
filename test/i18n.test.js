'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const { messages, languageTag, createTranslator } = require('../src/shared/i18n');

test('host and webviews share complete English and Chinese catalogs', () => {
  assert.deepEqual(Object.keys(messages.en).sort(), Object.keys(messages['zh-CN']).sort());
  assert.equal(languageTag('zh-CN'), 'zh-CN');
  assert.equal(languageTag('en-US'), 'en');
  assert.equal(languageTag('fr'), 'en');
  assert.equal(createTranslator('zh-CN')('treeSummary', { sessions: 2, turns: 8 }), '2 个会话 · 8 轮对话');
  assert.equal(createTranslator('en-US')('treeSummary', { sessions: 2, turns: 8 }), '2 sessions · 8 turns');
});

test('manifest localization covers every contribution placeholder', () => {
  const root = path.resolve(__dirname, '..');
  const manifest = fs.readFileSync(path.join(root, 'package.json'), 'utf8');
  const english = JSON.parse(fs.readFileSync(path.join(root, 'package.nls.json'), 'utf8'));
  const chinese = JSON.parse(fs.readFileSync(path.join(root, 'package.nls.zh-cn.json'), 'utf8'));
  assert.deepEqual(Object.keys(english).sort(), Object.keys(chinese).sort());
  for (const key of manifest.matchAll(/%([^%]+)%/g)) {
    assert.ok(english[key[1]], `Missing English manifest label: ${key[1]}`);
    assert.ok(chinese[key[1]], `Missing Chinese manifest label: ${key[1]}`);
  }
});
