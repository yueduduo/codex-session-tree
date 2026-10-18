'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { revealTurnEffect, patchSource, patchHostSource, install, restore, isInstalled, marker, hostMarker } = require('../officialPatch');

const source = `let qt=(0,Q.useRef)(null),[Xt,Zt]=foo;${
  '(0,Q.useEffect)(()=>_i(D,t,{revealItem:Hn,revealResponseTextAnnotation:Un}),[t,Hn,Un,D])'
};`;
const hostSource = 'e.push(Mt.commands.registerCommand("chatgpt.openSidebar",Ru))';

test('the official bridge is guarded, idempotent, and reversible', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-tree-patch-'));
  const assets = path.join(root, 'webview', 'assets');
  fs.mkdirSync(assets, { recursive: true });
  fs.mkdirSync(path.join(root, 'out'));
  const file = path.join(assets, 'local-conversation-thread-example.js');
  const hostFile = path.join(root, 'out', 'extension.js');
  try {
    fs.writeFileSync(file, source);
    fs.writeFileSync(hostFile, hostSource);
    assert.equal(isInstalled(root), false);
    assert.equal(install(root).changed, true);
    assert.equal(isInstalled(root), true);
    assert.equal(install(root).changed, false);
    assert.equal(fs.readFileSync(file, 'utf8'), patchSource(source));
    assert.equal(fs.readFileSync(hostFile, 'utf8'), patchHostSource(hostSource));
    assert.ok(fs.readFileSync(file, 'utf8').includes(marker));
    assert.ok(fs.readFileSync(hostFile, 'utf8').includes(hostMarker));
    assert.match(fs.readFileSync(hostFile, 'utf8'), /codexSessionTree\.revealTurn/);
    assert.match(fs.readFileSync(file, 'utf8'), /codex-tree-reveal-turn/);
    assert.equal(restore(root).restored, true);
    assert.equal(fs.readFileSync(file, 'utf8'), source);
    assert.equal(fs.readFileSync(hostFile, 'utf8'), hostSource);
    assert.equal(isInstalled(root), false);
    assert.throws(() => patchSource('unrecognized version'), /version has changed/);
    assert.throws(() => patchHostSource('unrecognized version'), /version has changed/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('the host command reuses a ready panel for the same conversation', async () => {
  const threadId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const turnId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  const messages = [];
  let reveals = 0;
  const panel = { reveal: () => { reveals++; }, webview: { postMessage: async message => { messages.push(message); return true; } } };
  const registered = new Map();
  const context = {
    e: { push() {} },
    Ru() {},
    Pe: { editorPanels: new Map([[panel, { ready: true, initialRoute: `/local/${threadId}?codexTreeTurnId=old` }]]),
      isPanelAlive: candidate => candidate === panel },
    Mt: { commands: { registerCommand: (name, handler) => { registered.set(name, handler); return {}; } } }
  };
  vm.runInNewContext(patchHostSource(hostSource), context);
  const reveal = registered.get('codexSessionTree.revealTurn');
  assert.equal(await reveal({ threadId, turnId }), true);
  assert.equal(reveals, 1);
  assert.equal(messages.length, 1);
  assert.equal(messages[0].type, 'codex-tree-reveal-turn');
  assert.equal(messages[0].turnId, turnId);
  assert.equal(await reveal({ threadId: 'cccccccc-cccc-cccc-cccc-cccccccccccc', turnId }), false);
  assert.equal(reveals, 1);
});

test('an open conversation scrolls on successive turn messages without remounting', async () => {
  const threadId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const first = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  const second = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
  const scrolled = [];
  let listener;
  const context = {
    document: { querySelector: () => null },
    location: { href: 'https://example.invalid' },
    window: {
      addEventListener: (name, callback) => { if (name === 'message') listener = callback; },
      removeEventListener: (name, callback) => { if (name === 'message' && listener === callback) listener = null; }
    },
    setInterval: () => 1,
    clearInterval() {},
    codexTreeTargetRef: { current: null },
    codexTreeRevealRef: { current: null },
    qt: { current: { scrollToKey: async key => { scrolled.push(key); } } },
    t: threadId,
    Sn: [{ turnId: first, turnKey: first }, { turnId: second, turnKey: second }],
    dt: null
  };
  const cleanup = vm.runInNewContext(`(${revealTurnEffect.toString()})()`, context);
  assert.equal(typeof listener, 'function');
  listener({ data: { type: 'codex-tree-reveal-turn', threadId, turnId: first } });
  await new Promise(resolve => setImmediate(resolve));
  listener({ data: { type: 'codex-tree-reveal-turn', threadId, turnId: second } });
  await new Promise(resolve => setImmediate(resolve));
  listener({ data: { type: 'codex-tree-reveal-turn', threadId, turnId: first } });
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(scrolled, [first, second, first]);
  cleanup();
  assert.equal(listener, null);
});
