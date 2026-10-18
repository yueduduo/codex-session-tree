'use strict';

// Generate the patched files in a temporary directory and parse them without
// modifying the installed official extension.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const childProcess = require('node:child_process');
const patch = require('../../../officialPatch');

const root = process.argv[2];
if (!root || process.argv.length !== 3) {
  console.error('Usage: node skills/official-codex-turn-patch/scripts/check-patched-syntax.js <openai.chatgpt-extension-path>');
  process.exit(2);
}
let temp;
try {
  const webSource = fs.readFileSync(patch.assetPath(root), 'utf8');
  const hostSource = fs.readFileSync(patch.hostPath(root), 'utf8');
  temp = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-tree-patch-check-'));
  const files = [
    [path.join(temp, 'conversation.mjs'), patch.patchSource(webSource)],
    [path.join(temp, 'extension.js'), patch.patchHostSource(hostSource)]
  ];
  for (const [file, source] of files) {
    fs.writeFileSync(file, source);
    const result = childProcess.spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
    if (result.status !== 0) throw new Error(`${file}: ${result.stderr.trim()}`);
  }
  console.log('Both patched bundles parse successfully; installed files were not changed.');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  if (temp) fs.rmSync(temp, { recursive: true, force: true });
}
