'use strict';

// Version-specific bridges into the installed Codex extension. Never applied on activation.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const marker = '/* codex-session-tree:reveal-turn:v2 */';
const hostMarker = '/* codex-session-tree:reveal-command:v1 */';
const refAnchor = 'qt=(0,Q.useRef)(null),[Xt,Zt]=';
const effectAnchor = '(0,Q.useEffect)(()=>_i(D,t,{revealItem:Hn,revealResponseTextAnnotation:Un}),[t,Hn,Un,D])';
const hostAnchor = 'e.push(Mt.commands.registerCommand("chatgpt.openSidebar",Ru))';

// Serialized into the minified conversation component. Its free variables are
// the component's existing virtual list and history-loading functions.
function revealTurnEffect() {
  /* codex-session-tree:reveal-turn:v2 */
  const route = document.querySelector('meta[name="initial-route"]')?.content;
  const initialTurn = route ? new URL(route, location.href).searchParams.get('codexTreeTurnId') : null;
  const pending = codexTreeTargetRef.current;
  let desired = pending?.threadId === t ? pending.turnId : initialTurn;
  let key = `${t}:${desired}`;
  let active = true;
  let busy = false;
  let attempts = 0;
  let version = 0;
  let timer;

  const reveal = async () => {
    if (!active || busy || !qt.current || !desired) return;
    const requested = desired;
    const requestVersion = version;
    busy = true;
    try {
      const entry = Sn.find(item => item.turnId === requested || item.turnKey === requested || item.turnSearchKey === requested);
      if (entry) {
        await qt.current.scrollToKey(entry.turnKey, undefined, { align: 'top' });
        if (active && requestVersion === version) {
          codexTreeRevealRef.current = key;
          clearInterval(timer);
        }
        return;
      }
      if (dt?.items?.some(item => item.turnId === requested)) {
        const page = await Rn(requested);
        const preview = page?.previews?.[0];
        if (preview) {
          await Vn({ id: Wn(requested, preview.itemId), isLoaded: false, turnKey: requested });
          if (active && requestVersion === version) {
            codexTreeRevealRef.current = key;
            clearInterval(timer);
          }
          return;
        }
      }
      if (!be && Sn.length > 0) {
        await Tr(D, i).loadOlderConversationHistoryPage(t, Ct == null ? [] : [Ct]);
        await il();
      }
      if (++attempts >= 30) clearInterval(timer);
    } catch (error) {
      console.warn('Codex Tree: reveal turn failed', error);
      if (++attempts >= 30) clearInterval(timer);
    } finally {
      busy = false;
    }
  };

  const start = turnId => {
    if (!active || !/^[0-9a-f-]{36}$/i.test(turnId)) return;
    desired = turnId;
    key = `${t}:${turnId}`;
    codexTreeTargetRef.current = { threadId: t, turnId };
    codexTreeRevealRef.current = null;
    version++;
    attempts = 0;
    clearInterval(timer);
    timer = setInterval(reveal, 500);
    reveal();
  };
  const onMessage = event => {
    const message = event.data;
    if (message?.type === 'codex-tree-reveal-turn' && message.threadId === t) start(message.turnId);
  };
  window.addEventListener('message', onMessage);
  if (desired && codexTreeRevealRef.current !== key) start(desired);
  return () => {
    active = false;
    clearInterval(timer);
    window.removeEventListener('message', onMessage);
  };
}

// Serialized into the official extension's activation function, where Pe is
// its webview provider and Mt is the VS Code API.
async function revealOpenPanel(input) {
  /* codex-session-tree:reveal-command:v1 */
  if (!input || !/^[0-9a-f-]{36}$/i.test(input.threadId) || !/^[0-9a-f-]{36}$/i.test(input.turnId)) return false;
  for (const [panel, state] of Pe.editorPanels) {
    if (state.initialRoute?.split('?')[0] !== `/local/${input.threadId}` || !state.ready || !Pe.isPanelAlive(panel)) continue;
    panel.reveal();
    return panel.webview.postMessage({ type: 'codex-tree-reveal-turn', threadId: input.threadId, turnId: input.turnId });
  }
  return false;
}

function replaceUnique(source, anchor, replacement) {
  if (source.split(anchor).length !== 2) throw new Error('Installed Codex version has changed; navigation patch was not applied.');
  return source.replace(anchor, replacement);
}

function patchSource(source) {
  if (source.includes(marker)) return source;
  const withRefs = replaceUnique(source, refAnchor,
    'qt=(0,Q.useRef)(null),codexTreeRevealRef=(0,Q.useRef)(null),codexTreeTargetRef=(0,Q.useRef)(null),[Xt,Zt]=');
  return replaceUnique(withRefs, effectAnchor,
    `${effectAnchor},(0,Q.useEffect)(${revealTurnEffect.toString()},[t,Sn,dt,Xt,be,Ct,i])`);
}

function patchHostSource(source) {
  if (source.includes(hostMarker)) return source;
  return replaceUnique(source, hostAnchor,
    `e.push(Mt.commands.registerCommand("codexSessionTree.revealTurn",${revealOpenPanel.toString()})),${hostAnchor}`);
}

function assetPath(extensionPath) {
  const assets = path.join(extensionPath, 'webview', 'assets');
  const names = fs.readdirSync(assets).filter(name => /^local-conversation-thread-[\w-]+\.js$/.test(name)
    && fs.readFileSync(path.join(assets, name), 'utf8').includes(effectAnchor));
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
  const patched = [patchSource(sources[0]), patchHostSource(sources[1])];
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

module.exports = { marker, hostMarker, revealTurnEffect, patchSource, patchHostSource, assetPath, hostPath, install, restore, isInstalled };

if (require.main === module) {
  const [action, extensionPath] = process.argv.slice(2);
  if (!['install', 'restore'].includes(action) || !extensionPath) {
    console.error('Usage: node officialPatch.js <install|restore> <official-extension-path>');
    process.exitCode = 2;
  } else {
    try { console.log(JSON.stringify(action === 'install' ? install(extensionPath) : restore(extensionPath))); }
    catch (error) { console.error(error.message); process.exitCode = 1; }
  }
}
