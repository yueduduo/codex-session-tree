'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { CodexClient } = require('../codexClient');

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
