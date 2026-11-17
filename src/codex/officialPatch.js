'use strict';

// Version-specific bridges into the installed Codex extension. Never applied on activation.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const marker = '/* codex-session-tree:reveal-turn:v2 */';
const hostMarker = '/* codex-session-tree:reveal-command:v1 */';
const adapters = {
  '26.1007.21434': require('../../skills/official-codex-turn-patch/versions/26.1007.21434/patch'),
  '26.1111.21308': require('../../skills/official-codex-turn-patch/versions/26.1111.21308/patch')
};

function targetAdapter(extensionPath) {
  const info = JSON.parse(fs.readFileSync(path.join(extensionPath, 'package.json'), 'utf8'));
  if (info.publisher !== 'openai' || info.name !== 'chatgpt' || !Object.hasOwn(adapters, info.version)) {
    throw new Error('Unsupported Codex extension: ' + info.version);
  }
  return adapters[info.version];
}

function replaceUnique(source, anchor, replacement) {
  if (source.split(anchor).length !== 2) throw new Error('Installed Codex version has changed; navigation patch was not applied.');
  return source.replace(anchor, replacement);
}

function patchSource(source, adapter = adapters['26.1007.21434']) {
  return source.includes(marker) ? source : adapter.patchSource(source, replaceUnique);
}

function patchHostSource(source, adapter = adapters['26.1007.21434']) {
  return source.includes(hostMarker) ? source : adapter.patchHostSource(source, replaceUnique);
}

function assetPath(extensionPath) {
  const assets = path.join(extensionPath, 'webview', 'assets');
  const { webEffect } = targetAdapter(extensionPath).anchors;
  const names = fs.readdirSync(assets).filter(name => /^local-conversation-thread-[\w-]+\.js$/.test(name)
    && fs.readFileSync(path.join(assets, name), 'utf8').includes(webEffect));
  if (names.length !== 1) throw new Error(`Expected one local conversation asset, found ${names.length}.`);
  return path.join(assets, names[0]);
}

function hostPath(extensionPath) {
  return path.join(extensionPath, 'out', 'extension.js');
}

function install(extensionPath) {
  const files = [assetPath(extensionPath), hostPath(extensionPath)];
  const sources = files.map(file => fs.readFileSync(file, 'utf8'));
  if (sources[0].includes(marker) && sources[1].includes(hostMarker)) return { files, installed: true, changed: false };
  if (sources[0].includes('codex-session-tree:') || sources[1].includes('codex-session-tree:')) {
    throw new Error('An incomplete or older Codex Tree patch is installed; restore it before installing this version.');
  }
  const adapter = targetAdapter(extensionPath);
  const patched = [patchSource(sources[0], adapter), patchHostSource(sources[1], adapter)];
  const backups = files.map(file => `${file}.codex-session-tree-original`);
  for (const backup of backups) if (fs.existsSync(backup)) throw new Error(`Backup already exists: ${backup}`);
  const created = [];
  try {
    for (let index = 0; index < files.length; index++) {
      fs.writeFileSync(backups[index], sources[index], { flag: 'wx' });
      created.push(backups[index]);
    }
    for (let index = 0; index < files.length; index++) fs.writeFileSync(files[index], patched[index]);
  } catch (error) {
    for (let index = 0; index < files.length; index++) {
      if (created.includes(backups[index])) fs.writeFileSync(files[index], sources[index]);
    }
    for (const backup of created) fs.unlinkSync(backup);
    throw error;
  }
  return { files, backups, installed: true, changed: true,
    originalSha256: sources.map(source => crypto.createHash('sha256').update(source).digest('hex')) };
}

function restore(extensionPath) {
  const files = [assetPath(extensionPath), hostPath(extensionPath)];
  const backups = files.map(file => `${file}.codex-session-tree-original`);
  if (backups.some(backup => !fs.existsSync(backup))) throw new Error('Matching Codex Tree backups were not found.');
  if (!fs.readFileSync(files[0], 'utf8').includes(marker) || !fs.readFileSync(files[1], 'utf8').includes(hostMarker)) {
    throw new Error('Current files are not both patched by this Codex Tree version.');
  }
  for (let index = 0; index < files.length; index++) fs.copyFileSync(backups[index], files[index]);
  for (const backup of backups) fs.unlinkSync(backup);
  return { files, restored: true };
}

function isInstalled(extensionPath) {
  try {
    return fs.readFileSync(assetPath(extensionPath), 'utf8').includes(marker)
      && fs.readFileSync(hostPath(extensionPath), 'utf8').includes(hostMarker);
  } catch { return false; }
}

module.exports = { marker, hostMarker, targetAdapter, revealTurnEffect: adapters['26.1007.21434'].revealTurnEffect, patchSource, patchHostSource, assetPath, hostPath, install, restore, isInstalled };

if (require.main === module) {
  const [action, extensionPath] = process.argv.slice(2);
  if (!['install', 'restore'].includes(action) || !extensionPath) {
    console.error('Usage: node src/codex/officialPatch.js <install|restore> <official-extension-path>');
    process.exitCode = 2;
  } else {
    try { console.log(JSON.stringify(action === 'install' ? install(extensionPath) : restore(extensionPath))); }
    catch (error) { console.error(error.message); process.exitCode = 1; }
  }
}
