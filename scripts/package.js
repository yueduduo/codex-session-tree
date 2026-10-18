'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const { name, version } = require(path.join(root, 'package.json'));
const outputDirectory = path.join(root, 'dist');
fs.mkdirSync(outputDirectory, { recursive: true });

const output = path.join(outputDirectory, `${name}-${version}.vsix`);
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const result = spawnSync(npx, [
  '--yes', '@vscode/vsce', 'package', '--no-dependencies', '--allow-missing-repository',
  '-o', output
], { cwd: root, stdio: 'inherit' });

if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
