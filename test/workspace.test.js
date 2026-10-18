'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { inWorkspace, familyInWorkspace } = require('../src/domain/workspace');

test('classifies nested session folders in any open VS Code workspace root', () => {
  const folders = [{ uri: { fsPath: '/work/alpha' } }, { uri: { fsPath: '/work/beta' } }];
  assert.equal(inWorkspace({ cwd: '/work/alpha' }, folders), true);
  assert.equal(inWorkspace({ cwd: '/work/beta/subproject' }, folders), true);
  assert.equal(inWorkspace({ cwd: '/work/beta-sibling' }, folders), false);
  assert.equal(inWorkspace({ cwd: '/elsewhere' }, folders), false);
  assert.equal(inWorkspace({ cwd: '/work/alpha' }, []), false);
  assert.equal(inWorkspace({}, folders), false);
});

test('keeps a conversation family in the current group when any branch uses the open workspace', () => {
  const folders = [{ uri: { fsPath: '/work/current' } }];
  const family = { threads: [{ cwd: '/work/older' }, { cwd: '/work/current/project' }] };
  assert.equal(familyInWorkspace(family, folders), true);
  assert.equal(familyInWorkspace({ threads: [{ cwd: '/work/older' }] }, folders), false);
});
