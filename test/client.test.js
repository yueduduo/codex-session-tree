'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { CodexClient } = require('../src/codex/codexClient');

test('loads every thread page and both archive states when requested', async () => {
  const calls = [];
  const fake = { request: async (method, params) => {
    calls.push({ method, params });
    if (!params.archived && !params.cursor) return { data: [{ id: 'a' }], nextCursor: 'next' };
    if (!params.archived) return { data: [{ id: 'b' }], nextCursor: null };
    return { data: [{ id: 'c' }], nextCursor: null };
  } };
  const result = await CodexClient.prototype.listThreads.call(fake, true);
  assert.deepEqual(result.map(x => [x.id, x.archived]), [['a', false], ['b', false], ['c', true]]);
  assert.equal(calls.length, 3);
  assert.equal(calls[1].params.cursor, 'next');
});

test('merges App Server snapshots with the same session ID', async () => {
  const fake = { request: async (_method, params) => params.cursor
    ? { data: [
      { id: 'same', name: 'Older title', createdAt: 10, updatedAt: 20, forkedFromId: 'parent' },
      { id: 'other', name: 'Another session', createdAt: 12, updatedAt: 22 }
    ], nextCursor: null }
    : { data: [{ id: 'same', name: 'Current title', createdAt: 21, updatedAt: 30 }], nextCursor: 'next' } };
  const result = await CodexClient.prototype.listThreads.call(fake, false);
  assert.equal(result.length, 2);
  assert.deepEqual(result[0], {
    id: 'same', name: 'Current title', createdAt: 10, updatedAt: 30,
    forkedFromId: 'parent', sessionId: undefined, archived: false
  });
  assert.equal(result[1].id, 'other');
});
